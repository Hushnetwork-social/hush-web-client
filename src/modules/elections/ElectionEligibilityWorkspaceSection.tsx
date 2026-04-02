"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import {
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionVotingRightStatusProto,
  type GetElectionEligibilityViewResponse,
  type GetElectionResponse,
} from "@/lib/grpc";
import { electionsService } from "@/lib/grpc/services/elections";
import { submitTransaction } from "@/modules/blockchain/BlockchainService";
import {
  type ElectionRosterImportItemPayload,
  createActivateElectionRosterEntryTransaction,
  createImportElectionRosterTransaction,
} from "./transactionService";

type ElectionEligibilityWorkspaceSectionProps = {
  electionId: string;
  detail: GetElectionResponse | null;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
  embedded?: boolean;
  onContextChanged?: () => Promise<void> | void;
};

type EligibilityFeedback = {
  tone: "success" | "error";
  message: string;
};

type ImportPreviewState = {
  rows: ElectionRosterImportItemPayload[];
  errors: string[];
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEligibilityViewMatch(
  electionId: string,
  actorPublicAddress: string,
  isMatch: (response: GetElectionEligibilityViewResponse) => boolean,
  maxAttempts: number = 12,
  delayMs: number = 500,
): Promise<GetElectionEligibilityViewResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await electionsService.getElectionEligibilityView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      if (response.Success && isMatch(response)) {
        return response;
      }
    } catch {
      // Query indexing is eventually consistent after submission.
    }

    if (attempt < maxAttempts - 1) {
      await delay(delayMs);
    }
  }

  return null;
}

function parseContactType(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "email") {
    return 0;
  }

  if (normalized === "phone" || normalized === "sms") {
    return 1;
  }

  return null;
}

function parseInitiallyActive(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return !["0", "false", "no", "inactive"].includes(normalized);
}

function parseRosterImportText(rawText: string): ImportPreviewState {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return {
      rows: [],
      errors: ["Paste at least one roster row before reviewing the import."],
    };
  }

  const rows: ElectionRosterImportItemPayload[] = [];
  const errors: string[] = [];
  const seenOrganizationVoterIds = new Set<string>();
  const hasHeader = lines[0].toLowerCase().includes("organization_voter_id");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, index) => {
    const parts = line.split(",").map((part) => part.trim());
    const rowNumber = index + 1;
    if (parts.length < 3) {
      errors.push(
        `Row ${rowNumber} must include organization_voter_id, contact_type, and contact_value.`,
      );
      return;
    }

    const [
      organizationVoterId,
      rawContactType,
      contactValue,
      rawIsInitiallyActive,
    ] = parts;
    if (!organizationVoterId) {
      errors.push(`Row ${rowNumber} is missing organization_voter_id.`);
      return;
    }

    const dedupeKey = organizationVoterId.toLowerCase();
    if (seenOrganizationVoterIds.has(dedupeKey)) {
      errors.push(
        `Row ${rowNumber} duplicates organization_voter_id '${organizationVoterId}'.`,
      );
      return;
    }

    const contactType = parseContactType(rawContactType);
    if (contactType === null) {
      errors.push(
        `Row ${rowNumber} has unsupported contact_type '${rawContactType}'. Use 'email' or 'phone'.`,
      );
      return;
    }

    if (!contactValue) {
      errors.push(`Row ${rowNumber} is missing contact_value.`);
      return;
    }

    seenOrganizationVoterIds.add(dedupeKey);
    rows.push({
      OrganizationVoterId: organizationVoterId,
      ContactType: contactType,
      ContactValue: contactValue,
      IsInitiallyActive: parseInitiallyActive(rawIsInitiallyActive),
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid roster rows were found in the pasted import.");
  }

  return { rows, errors };
}

function getParticipationStatusLabel(
  lifecycleState: ElectionLifecycleStateProto | undefined,
  participationStatus: ElectionParticipationStatusProto,
  inCurrentDenominator: boolean,
): string {
  if (
    participationStatus ===
    ElectionParticipationStatusProto.ParticipationCountedAsVoted
  ) {
    return "Counted as voted";
  }

  if (
    participationStatus === ElectionParticipationStatusProto.ParticipationBlank
  ) {
    return "Blank";
  }

  if (
    lifecycleState === ElectionLifecycleStateProto.Open &&
    inCurrentDenominator
  ) {
    return "Not yet voted";
  }

  return "Did not vote";
}

function getVotingRightLabel(status: ElectionVotingRightStatusProto): string {
  return status === ElectionVotingRightStatusProto.VotingRightActive
    ? "Active"
    : "Inactive";
}

export function ElectionEligibilityWorkspaceSection({
  electionId,
  detail,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
  embedded = false,
  onContextChanged,
}: ElectionEligibilityWorkspaceSectionProps) {
  const [eligibilityView, setEligibilityView] =
    useState<GetElectionEligibilityViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<EligibilityFeedback | null>(null);
  const [importText, setImportText] = useState(
    "organization_voter_id,contact_type,contact_value,is_initially_active\n10041,email,member-10041@example.org,true",
  );
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const lifecycleState = detail?.Election?.LifecycleState;

  const restrictedRows = useMemo(() => {
    const rows = eligibilityView?.RestrictedRosterEntries ?? [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter(
      (row) =>
        row.OrganizationVoterId.toLowerCase().includes(normalizedSearch) ||
        row.ContactValueHint.toLowerCase().includes(normalizedSearch),
    );
  }, [eligibilityView?.RestrictedRosterEntries, searchTerm]);

  const activationQueueRows = useMemo(
    () =>
      restrictedRows.filter(
        (row) =>
          row.VotingRightStatus ===
          ElectionVotingRightStatusProto.VotingRightInactive,
      ),
    [restrictedRows],
  );

  useEffect(() => {
    let isActive = true;

    async function loadEligibilityView(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await electionsService.getElectionEligibilityView({
          ElectionId: electionId,
          ActorPublicAddress: actorPublicAddress,
        });

        if (isActive) {
          setEligibilityView(response);
          if (!response.Success) {
            setFeedback({
              tone: "error",
              message:
                response.ErrorMessage || "Failed to load eligibility data.",
            });
          }
        }
      } catch (error) {
        if (isActive) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load eligibility data.",
          });
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadEligibilityView();

    return () => {
      isActive = false;
    };
  }, [actorPublicAddress, electionId]);

  async function refreshContext(
    nextView?: GetElectionEligibilityViewResponse | null,
    nextFeedback?: EligibilityFeedback | null,
  ): Promise<void> {
    if (nextView) {
      setEligibilityView(nextView);
    } else {
      const refreshedView = await electionsService.getElectionEligibilityView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setEligibilityView(refreshedView);
    }

    if (nextFeedback) {
      setFeedback(nextFeedback);
    }

    await onContextChanged?.();
  }

  async function handleConfirmImport(): Promise<void> {
    if (
      !importPreview ||
      importPreview.errors.length > 0 ||
      importPreview.rows.length === 0
    ) {
      return;
    }

    const existingOrganizationVoterIds = new Set(
      (eligibilityView?.RestrictedRosterEntries ?? []).map((row) =>
        row.OrganizationVoterId.trim().toLowerCase(),
      ),
    );
    const importedOrganizationVoterIds = importPreview.rows.map((row) =>
      row.OrganizationVoterId.trim().toLowerCase(),
    );
    const newRosterRowCount = importedOrganizationVoterIds.filter(
      (organizationVoterId) =>
        !existingOrganizationVoterIds.has(organizationVoterId),
    ).length;
    const keptExistingRowCount = importPreview.rows.length - newRosterRowCount;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { signedTransaction } = await createImportElectionRosterTransaction(
        electionId,
        actorPublicAddress,
        actorEncryptionPublicKey,
        actorEncryptionPrivateKey,
        importPreview.rows,
        actorSigningPrivateKey,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        throw new Error(
          submitResult.message || "Roster import submission failed.",
        );
      }

      const awaitedView = await waitForEligibilityViewMatch(
        electionId,
        actorPublicAddress,
        (response) =>
          importedOrganizationVoterIds.every((organizationVoterId) =>
            response.RestrictedRosterEntries.some(
              (row) =>
                row.OrganizationVoterId.trim().toLowerCase() ===
                organizationVoterId,
            ),
          ),
      );

      const successMessage =
        newRosterRowCount === 0
          ? `No new roster rows were added. Kept ${keptExistingRowCount} existing row${keptExistingRowCount === 1 ? "" : "s"}.`
          : keptExistingRowCount === 0
            ? `Added ${newRosterRowCount} roster row${newRosterRowCount === 1 ? "" : "s"}.`
            : `Added ${newRosterRowCount} roster row${newRosterRowCount === 1 ? "" : "s"} and kept ${keptExistingRowCount} existing row${keptExistingRowCount === 1 ? "" : "s"}.`;

      await refreshContext(awaitedView, {
        tone: "success",
        message: successMessage,
      });
      setImportPreview(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Roster import failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateRosterEntry(
    organizationVoterId: string,
  ): Promise<void> {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { signedTransaction } =
        await createActivateElectionRosterEntryTransaction(
          electionId,
          actorPublicAddress,
          actorEncryptionPublicKey,
          actorEncryptionPrivateKey,
          organizationVoterId,
          actorSigningPrivateKey,
        );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        throw new Error(
          submitResult.message || "Activation submission failed.",
        );
      }

      const awaitedView = await waitForEligibilityViewMatch(
        electionId,
        actorPublicAddress,
        (response) =>
          response.RestrictedRosterEntries.some(
            (row) =>
              row.OrganizationVoterId === organizationVoterId &&
              row.VotingRightStatus ===
                ElectionVotingRightStatusProto.VotingRightActive,
          ),
      );

      await refreshContext(awaitedView, {
        tone: "success",
        message: `Activated voting rights for ${organizationVoterId}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Activation failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <section
        className={
          embedded
            ? "py-1"
            : "rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10"
        }
      >
        <div className="flex items-center gap-3 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading eligibility workspace...</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        embedded
          ? "space-y-5"
          : "rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10"
      }
      data-testid="election-eligibility-workspace"
    >
      {!embedded ? (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Voters / Eligibility</h2>
            <p className="mt-1 text-sm text-hush-text-accent">
              Roster import, claim-link rules, denominator policy, and late
              activation stay visible here without collapsing the public
              checkoff layer into ballot identity.
            </p>
          </div>
          <Link
            href={`/elections/${electionId}/eligibility`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Open actor view</span>
          </Link>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border-green-500/40 bg-green-500/10 text-green-100"
              : "border-red-500/40 bg-red-500/10 text-red-100"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!eligibilityView?.Success ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
          {eligibilityView?.ErrorMessage ||
            "Eligibility data is currently unavailable."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Rostered
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {eligibilityView.Summary.RosteredCount}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Linked
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {eligibilityView.Summary.LinkedCount}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Active now
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {eligibilityView.Summary.ActiveCount}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Denominator now
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {eligibilityView.Summary.CurrentDenominatorCount}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Counted participation
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {eligibilityView.Summary.CountedParticipationCount}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    Participation policy
                  </div>
                  <p className="mt-2 text-sm text-hush-text-accent">
                    Named roster visibility stays restricted to owner and
                    accepted trustee review. The current temporary verification
                    code is{" "}
                    <span className="font-semibold text-hush-text-primary">
                      {eligibilityView.TemporaryVerificationCode}
                    </span>
                    .
                  </p>
                </div>
                <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
                  {detail?.Election?.EligibilityMutationPolicy === 1
                    ? "Late activation for rostered voters only"
                    : "Frozen at open"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-sm font-semibold">Current semantics</div>
              <div className="mt-3 space-y-2 text-sm text-hush-text-accent">
                <div>Blank: accepted blank ballot exists.</div>
                <div>
                  Counted as voted: accepted ballot exists for the linked voter
                  identity.
                </div>
                <div>
                  Did not vote: no accepted ballot exists in the current
                  denominator.
                </div>
              </div>
            </div>
          </div>

          {eligibilityView.CanImportRoster ? (
            <div className="mt-5 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    Roster import review
                  </div>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    Paste `organization_voter_id, contact_type, contact_value,
                    is_initially_active` rows. New voter IDs are appended in
                    draft, existing voter IDs are kept as-is, and the roster
                    freezes at open.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setImportPreview(parseRosterImportText(importText))
                  }
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  <span>Review import</span>
                </button>
              </div>

              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={6}
                className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                data-testid="eligibility-import-textarea"
              />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
              {lifecycleState === ElectionLifecycleStateProto.Open
                ? "Roster membership is frozen because the election is already open."
                : "Roster import is only available to the owner while the election remains in draft."}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm font-semibold">
                  Restricted participation roster
                </div>
                <p className="mt-1 text-sm text-hush-text-accent">
                  This table stays on the named checkoff layer only. No ballot
                  id, ciphertext, or vote-choice data is exposed here.
                </p>
              </div>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search voter id or contact hint"
                className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-2 text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple md:max-w-xs"
              />
            </div>

            {restrictedRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-hush-bg-light px-4 py-5 text-sm text-hush-text-accent">
                No restricted roster rows are available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-hush-text-accent">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Org voter id</th>
                      <th className="pb-3 pr-4 font-medium">Contact</th>
                      <th className="pb-3 pr-4 font-medium">Link</th>
                      <th className="pb-3 pr-4 font-medium">Voting right</th>
                      <th className="pb-3 pr-4 font-medium">Participation</th>
                      <th className="pb-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restrictedRows.map((row) => (
                      <tr
                        key={row.OrganizationVoterId}
                        className="border-t border-hush-bg-light/70"
                      >
                        <td className="py-3 pr-4 font-mono text-hush-text-primary">
                          {row.OrganizationVoterId}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {row.ContactValueHint}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {row.LinkStatus === 1 ? "Linked" : "Unlinked"}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {getVotingRightLabel(row.VotingRightStatus)}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {getParticipationStatusLabel(
                            lifecycleState,
                            row.ParticipationStatus,
                            row.InCurrentDenominator,
                          )}
                        </td>
                        <td className="py-3">
                          {eligibilityView.CanActivateRoster &&
                          row.VotingRightStatus ===
                            ElectionVotingRightStatusProto.VotingRightInactive ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleActivateRosterEntry(
                                  row.OrganizationVoterId,
                                )
                              }
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 px-3 py-2 text-xs text-green-100 transition-colors hover:border-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                              data-testid={`eligibility-activate-${row.OrganizationVoterId}`}
                            >
                              {isSubmitting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserRoundCheck className="h-3.5 w-3.5" />
                              )}
                              <span>Activate</span>
                            </button>
                          ) : (
                            <span className="text-xs text-hush-text-accent">
                              {row.VotingRightStatus ===
                              ElectionVotingRightStatusProto.VotingRightActive
                                ? "Already active"
                                : "Read-only"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">
                  Late-activation queue
                </div>
                <div className="text-xs text-hush-text-accent">
                  {activationQueueRows.length} inactive row
                  {activationQueueRows.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {activationQueueRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-hush-bg-light px-4 py-5 text-sm text-hush-text-accent">
                    No inactive rostered voters are waiting in the current
                    queue.
                  </div>
                ) : (
                  activationQueueRows.map((row) => (
                    <div
                      key={row.OrganizationVoterId}
                      className="rounded-xl border border-hush-bg-light px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm text-hush-text-primary">
                            {row.OrganizationVoterId}
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            {row.LinkStatus === 1
                              ? "Linked"
                              : "Must link first"}{" "}
                            • {row.ContactValueHint}
                          </div>
                        </div>
                        <div className="text-xs text-hush-text-accent">
                          {row.InCurrentDenominator
                            ? "Already in denominator"
                            : "Outside denominator"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-sm font-semibold">
                Recent activation events
              </div>
              <div className="mt-3 space-y-3">
                {(eligibilityView.ActivationEvents ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-hush-bg-light px-4 py-5 text-sm text-hush-text-accent">
                    No activation events have been recorded yet.
                  </div>
                ) : (
                  eligibilityView.ActivationEvents.slice(0, 6).map((event) => (
                    <div
                      key={event.Id}
                      className="rounded-xl border border-hush-bg-light px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-hush-text-primary">
                          {event.OrganizationVoterId}
                        </div>
                        <div
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            event.Outcome === 0
                              ? "border-green-500/40 bg-green-500/10 text-green-100"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                          }`}
                        >
                          {event.Outcome === 0 ? "Activated" : "Blocked"}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-hush-text-accent">
                        {new Date(
                          (event.OccurredAt.seconds ?? 0) * 1000,
                        ).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {importPreview ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-hush-bg-light bg-hush-bg-element p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  Review imported voter roster
                </h3>
                <p className="mt-1 text-sm text-hush-text-accent">
                  The temporary `1111` verification flow only becomes meaningful
                  after the imported roster exists in draft.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="rounded-xl border border-hush-bg-light px-3 py-2 text-sm text-hush-text-accent transition-colors hover:border-hush-purple hover:text-hush-text-primary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Rows found
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {importPreview.rows.length + importPreview.errors.length}
                </div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Valid rows
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {importPreview.rows.length}
                </div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Needs correction
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {importPreview.errors.length}
                </div>
              </div>
            </div>

            {importPreview.errors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                <div className="font-semibold">Validation issues</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {importPreview.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-sm font-semibold">Preview</div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-hush-text-accent">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Org voter id</th>
                      <th className="pb-3 pr-4 font-medium">Contact type</th>
                      <th className="pb-3 pr-4 font-medium">Contact value</th>
                      <th className="pb-3 font-medium">Initially active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 12).map((row) => (
                      <tr
                        key={row.OrganizationVoterId}
                        className="border-t border-hush-bg-light/70"
                      >
                        <td className="py-3 pr-4 font-mono text-hush-text-primary">
                          {row.OrganizationVoterId}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {row.ContactType === 1 ? "Phone" : "Email"}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {row.ContactValue}
                        </td>
                        <td className="py-3 text-hush-text-accent">
                          {row.IsInitiallyActive ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="rounded-xl border border-hush-bg-light px-4 py-2 text-sm text-hush-text-accent transition-colors hover:border-hush-purple hover:text-hush-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmImport()}
                disabled={
                  isSubmitting ||
                  importPreview.errors.length > 0 ||
                  importPreview.rows.length === 0
                }
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                data-testid="eligibility-import-confirm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Import valid rows</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
