"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  MoveDown,
  MoveUp,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  Square,
  X,
} from "lucide-react";
import {
  ElectionBindingStatusProto,
  ElectionCloseCountingJobStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionTrusteeCeremonyStateProto,
  ElectionCeremonyVersionStatusProto,
  type ElectionDraftInput,
  ElectionGovernedActionTypeProto,
  ElectionGovernanceModeProto,
  ElectionGovernedProposalExecutionStatusProto,
  type Identity,
  ProtocolPackageBindingStatusProto,
  type ResolveElectionTrusteeInvitationRequest,
  ElectionTrusteeInvitationStatusProto,
  ElectionWarningCodeProto,
  OutcomeRuleKindProto,
} from "@/lib/grpc";
import { identityService } from "@/lib/grpc/services/identity";
import { useBlockchainStore } from "@/modules/blockchain";
import {
  BINDING_OPTIONS,
  coerceSelectedCeremonyProfileId,
  GOVERNANCE_OPTIONS,
  OUTCOME_RULE_OPTIONS,
  WARNING_CHOICES,
  applyGovernanceModeDefaults,
  canCloseElection,
  canFinalizeElection,
  canOpenElection,
  createDefaultElectionDraft,
  createDraftFromElectionDetail,
  createElectionOption,
  createOutcomeRuleForKind,
  findCeremonyProfileById,
  formatArtifactValue,
  formatTimestamp,
  getAcceptedFinalizationShareCount,
  getActiveCeremonyVersion,
  getAllowedCeremonyProfiles,
  getBindingLabel,
  getFixedCeremonyProfileShape,
  getDisclosureModeLabel,
  getDraftOpenValidationErrors,
  getDraftRevisionLabel,
  getDraftSaveValidationErrors,
  type GovernedActionViewState,
  getElectionClassLabel,
  getGovernedActionLabel,
  getGovernedActionViewStates,
  getFinalizationSessionStatusLabel,
  getFinalizationShareStatusLabel,
  getFinalizationShares,
  getGovernedProposalExecutionStatusLabel,
  getEligibilityMutationLabel,
  getEligibilitySourceLabel,
  getGovernanceLabel,
  getLifecycleLabel,
  getLatestFinalizationReleaseEvidence,
  getOutcomeRuleLabel,
  getParticipationPrivacyLabel,
  getProtocolPackageBindingPresentation,
  getReportingPolicyLabel,
  getRequiredOpenWarningCodes,
  getReviewWindowPolicyLabel,
  getModeProfileFamilyLabel,
  getModeProfileFreezeCopy,
  getSelectedProfileFamilyLabel,
  getSummaryBadge,
  getUnsupportedDraftValueMessages,
  getVoteUpdatePolicyLabel,
  getWarningTitle,
  isDraftEditable,
  normalizeElectionDraft,
  renumberElectionOptions,
} from "./contracts";
import { DesignatedAuditorGrantManager } from "./DesignatedAuditorGrantManager";
import { ElectionCeremonyWorkspaceSection } from "./ElectionCeremonyWorkspaceSection";
import { ElectionEligibilityWorkspaceSection } from "./ElectionEligibilityWorkspaceSection";
import { ElectionFinalizationWorkspaceSection } from "./ElectionFinalizationWorkspaceSection";
import { ProtocolPackageBindingPanel } from "./ProtocolPackageBindingPanel";
import { useElectionsStore } from "./useElectionsStore";

type ElectionsWorkspaceProps = {
  ownerPublicAddress: string;
  ownerEncryptionPublicKey?: string;
  ownerEncryptionPrivateKey?: string;
  ownerSigningPrivateKey: string;
  startInNewDraftMode?: boolean;
  initialElectionId?: string;
};

type FixedPolicyItem = {
  label: string;
  value: string;
  note: string;
};

function formatTrusteeReferenceList(
  trustees:
    | ReadonlyArray<{
        TrusteeDisplayName?: string | null;
        TrusteeUserAddress: string;
      }>
    | null
    | undefined,
): string {
  if (!trustees || trustees.length === 0) {
    return "Not recorded";
  }

  return trustees
    .map((trustee) => trustee.TrusteeDisplayName || trustee.TrusteeUserAddress)
    .join(", ");
}

type OwnerEditorOverlayId =
  | "metadata"
  | "policy"
  | "options"
  | "warnings"
  | "trustees"
  | "roster"
  | null;

type MetadataEditorState = {
  title: string;
  externalReferenceCode: string;
  shortDescription: string;
};

type PolicyEditorState = {
  bindingStatus: ElectionBindingStatusProto;
  selectedProfileId: string;
  governanceMode: ElectionGovernanceModeProto;
  outcomeRuleKind: OutcomeRuleKindProto;
};

type OwnerWorkspaceTabId =
  | "save"
  | "lifecycle"
  | "readiness"
  | "trustees"
  | "policy"
  | "options"
  | "roster"
  | "auditors"
  | "ceremony"
  | "finalization"
  | "governed";

type OwnerWorkspaceTab = {
  id: OwnerWorkspaceTabId;
  label: string;
  helper: string;
};

const sectionClass =
  "rounded-2xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10";
const CEREMONY_REFRESH_INTERVAL_MS = 5_000;

const UNSAVED_DRAFT_LEAVE_MESSAGE =
  "This election has unsaved local edits. Save the draft before leaving, or confirm that you want to discard those edits.";

function getDefaultOwnerWorkspaceTabId({
  canEditDraft,
}: {
  canEditDraft: boolean;
}): OwnerWorkspaceTabId {
  return canEditDraft ? "save" : "lifecycle";
}

function buildFixedPolicyItems(
  draft: ElectionDraftInput,
): FixedPolicyItem[] {
  return [
    {
      label: "Election class",
      value: getElectionClassLabel(draft.ElectionClass),
      note: "Only organizational remote voting is currently supported here.",
    },
    {
      label: "Disclosure mode",
      value: getDisclosureModeLabel(draft.DisclosureMode),
      note: "Final results only is the only supported disclosure mode in this phase.",
    },
    {
      label: "Participation privacy",
      value: getParticipationPrivacyLabel(draft.ParticipationPrivacyMode),
      note: "Phase-one privacy keeps checkoff public while ballot choice stays private.",
    },
    {
      label: "Vote update policy",
      value: getVoteUpdatePolicyLabel(draft.VoteUpdatePolicy),
      note: "Single submission only is currently supported here.",
    },
    {
      label: "Eligibility source",
      value: getEligibilitySourceLabel(draft.EligibilitySourceType),
      note: "This flow records the roster source now and applies roster rules in the eligibility workflow.",
    },
    {
      label: "Eligibility mutation",
      value: getEligibilityMutationLabel(draft.EligibilityMutationPolicy),
      note: "Roster state freezes when the election opens.",
    },
    {
      label: "Reporting policy",
      value: getReportingPolicyLabel(draft.ReportingPolicy),
      note: "The default phase-one reporting package is frozen into the election record.",
    },
    {
      label: "Review window",
      value: getReviewWindowPolicyLabel(draft.ReviewWindowPolicy),
      note:
        draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold
          ? "Trustee-threshold drafts reserve the governed review path for proposal approval."
          : "Admin-only elections stay on the no-review-window path.",
    },
  ];
}

function OwnerOverviewSection({
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  children,
  dataTestId,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children: ReactNode;
  dataTestId?: string;
}) {
  return (
    <section className={sectionClass} data-testid={dataTestId}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {description}
          </p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent lg:ml-6"
          >
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function OwnerEditorOverlay({
  title,
  description,
  children,
  onClose,
  onApply,
  applyLabel,
  applyDisabled = false,
  maxWidthClass = "max-w-4xl",
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  maxWidthClass?: string;
}) {
  const titleId = useId();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        className={`w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto rounded-3xl border border-hush-bg-light bg-hush-bg-element p-6 shadow-2xl shadow-black/30`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id={titleId}
              className="text-xl font-semibold text-hush-text-primary"
            >
              {title}
            </h3>
            <p className="mt-2 text-sm text-hush-text-accent">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-hush-bg-light text-hush-text-accent transition-colors hover:border-hush-purple hover:text-hush-text-primary"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6">{children}</div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-hush-bg-light px-4 py-2 text-sm text-hush-text-accent transition-colors hover:border-hush-purple"
          >
            Cancel
          </button>
          {onApply && applyLabel ? (
            <button
              type="button"
              onClick={onApply}
              disabled={applyDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
            >
              <span>{applyLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getInvitationStatusLabel(
  status: ElectionTrusteeInvitationStatusProto,
): string {
  switch (status) {
    case ElectionTrusteeInvitationStatusProto.Pending:
      return "Pending";
    case ElectionTrusteeInvitationStatusProto.Accepted:
      return "Accepted";
    case ElectionTrusteeInvitationStatusProto.Rejected:
      return "Rejected";
    case ElectionTrusteeInvitationStatusProto.Revoked:
      return "Revoked";
    default:
      return "Unknown";
  }
}

function getGovernedActionStatusLabel(
  status: GovernedActionViewState["status"],
): string {
  switch (status) {
    case "available":
      return "Available";
    case "pending":
      return "Pending";
    case "execution_failed":
      return "Execution failed";
    case "completed":
      return "Completed";
    case "finalize_not_tally_ready":
      return "Awaiting tally readiness";
    case "unavailable":
    default:
      return "Unavailable";
  }
}

function getGovernedActionStatusClass(
  status: GovernedActionViewState["status"],
): string {
  switch (status) {
    case "available":
      return "border-green-500/40 bg-green-500/10 text-green-100";
    case "pending":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "execution_failed":
      return "border-red-500/40 bg-red-500/10 text-red-100";
    case "completed":
      return "border-hush-purple/40 bg-hush-purple/10 text-hush-purple";
    case "finalize_not_tally_ready":
      return "border-blue-500/40 bg-blue-500/10 text-blue-100";
    case "unavailable":
    default:
      return "border-hush-bg-light bg-hush-bg-dark text-hush-text-accent";
  }
}

function toggleWarningCode(
  draft: ElectionDraftInput,
  warningCode: ElectionWarningCodeProto,
  checked: boolean,
): ElectionDraftInput {
  const nextCodes = new Set(draft.AcknowledgedWarningCodes);
  if (checked) {
    nextCodes.add(warningCode);
  } else {
    nextCodes.delete(warningCode);
  }

  return {
    ...draft,
    AcknowledgedWarningCodes: Array.from(nextCodes).sort(
      (left, right) => left - right,
    ),
  };
}

export function ElectionsWorkspace({
  ownerPublicAddress,
  ownerEncryptionPublicKey,
  ownerEncryptionPrivateKey,
  ownerSigningPrivateKey,
  startInNewDraftMode = false,
  initialElectionId,
}: ElectionsWorkspaceProps) {
  const {
    beginNewElection,
    ceremonyActionView,
    clearFeedback,
    closeElection,
    completeElectionCeremonyTrustee,
    createDraft,
    elections,
    error,
    feedback,
    finalizeElection,
    inviteTrustee,
    isLoadingCeremonyActionView,
    isLoadingList,
    isSubmitting,
    loadCeremonyActionView,
    loadElection,
    loadReportAccessGrants,
    loadOpenReadiness,
    loadOwnerDashboard,
    openElection,
    openReadiness,
    recordElectionCeremonyValidationFailure,
    refreshProtocolPackageBinding,
    reset,
    revokeInvitation,
    selectedElection,
    selectedElectionId,
    setOwnerPublicAddress,
    startElectionCeremony,
    startGovernedProposal,
    restartElectionCeremony,
    retryGovernedProposalExecution,
    updateDraft,
  } = useElectionsStore();

  const [draft, setDraft] = useState<ElectionDraftInput>(() =>
    createDefaultElectionDraft(),
  );
  const [snapshotReason, setSnapshotReason] = useState("Initial draft");
  const [trusteeUserAddress, setTrusteeUserAddress] = useState("");
  const [trusteeDisplayName, setTrusteeDisplayName] = useState("");
  const [trusteeSearchQuery, setTrusteeSearchQuery] = useState("");
  const [trusteeSearchResults, setTrusteeSearchResults] = useState<Identity[]>(
    [],
  );
  const [isSearchingTrustees, setIsSearchingTrustees] = useState(false);
  const [hasSearchedTrustees, setHasSearchedTrustees] = useState(false);
  const [activeOverlay, setActiveOverlay] =
    useState<OwnerEditorOverlayId>(null);
  const [activeOwnerTab, setActiveOwnerTab] =
    useState<OwnerWorkspaceTabId | null>(null);
  const [hasManuallySelectedOwnerTab, setHasManuallySelectedOwnerTab] =
    useState(false);
  const [metadataEditor, setMetadataEditor] = useState<MetadataEditorState>({
    title: "",
    externalReferenceCode: "",
    shortDescription: "",
  });
  const [policyEditor, setPolicyEditor] = useState<PolicyEditorState>(() => {
    const defaultDraft = createDefaultElectionDraft();

    return {
      bindingStatus: defaultDraft.BindingStatus,
      selectedProfileId: defaultDraft.SelectedProfileId,
      governanceMode: defaultDraft.GovernanceMode,
      outcomeRuleKind: defaultDraft.OutcomeRule.Kind,
    };
  });
  const [optionsEditor, setOptionsEditor] = useState<
    ElectionDraftInput["OwnerOptions"]
  >([]);
  const [warningChoicesEditor, setWarningChoicesEditor] = useState<
    ElectionWarningCodeProto[]
  >([]);
  const [trusteeApprovalEditor, setTrusteeApprovalEditor] = useState(1);
  const ownerRefreshInFlightRef = useRef(false);
  const blockHeight = useBlockchainStore((state) => state.blockHeight);

  const election = selectedElection?.Election;
  const latestDraftSnapshot = selectedElection?.LatestDraftSnapshot;
  const trusteeInvitations = useMemo(
    () => selectedElection?.TrusteeInvitations ?? [],
    [selectedElection?.TrusteeInvitations],
  );
  const warningAcknowledgements = useMemo(
    () => selectedElection?.WarningAcknowledgements ?? [],
    [selectedElection?.WarningAcknowledgements],
  );
  const boundaryArtifacts = useMemo(
    () => selectedElection?.BoundaryArtifacts ?? [],
    [selectedElection?.BoundaryArtifacts],
  );
  const governedActionStates = useMemo(
    () => getGovernedActionViewStates(selectedElection ?? null),
    [selectedElection],
  );
  const finalizeActionState = useMemo(
    () =>
      governedActionStates.find(
        (state) =>
          state.actionType === ElectionGovernedActionTypeProto.Finalize,
      ) ?? null,
    [governedActionStates],
  );
  const governedCloseActionState = useMemo(
    () =>
      governedActionStates.find(
        (state) => state.actionType === ElectionGovernedActionTypeProto.Close,
      ) ?? null,
    [governedActionStates],
  );
  const governedOpenActionState = useMemo(
    () =>
      governedActionStates.find(
        (state) => state.actionType === ElectionGovernedActionTypeProto.Open,
      ) ?? null,
    [governedActionStates],
  );
  const hasPendingGovernedApprovalProposal = useMemo(
    () =>
      governedActionStates.some(
        (state) =>
          state.proposal?.ExecutionStatus ===
          ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ),
    [governedActionStates],
  );
  const activeCeremonyVersion = useMemo(
    () => getActiveCeremonyVersion(selectedElection ?? null),
    [selectedElection],
  );
  const activeCloseCountingSession = useMemo(() => {
    const sessions = (selectedElection?.FinalizationSessions ?? [])
      .filter(
        (session) =>
          session.SessionPurpose ===
          ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
      )
      .slice()
      .sort((left, right) => {
        const leftSeconds = Number(left.CreatedAt?.seconds ?? 0);
        const rightSeconds = Number(right.CreatedAt?.seconds ?? 0);
        if (leftSeconds === rightSeconds) {
          return (right.CreatedAt?.nanos ?? 0) - (left.CreatedAt?.nanos ?? 0);
        }

        return rightSeconds - leftSeconds;
      });

    return (
      sessions.find(
        (session) =>
          session.Status ===
          ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
      ) ??
      sessions[0] ??
      null
    );
  }, [selectedElection?.FinalizationSessions]);
  const closeCountingShares = useMemo(
    () =>
      getFinalizationShares(
        selectedElection ?? null,
        activeCloseCountingSession?.Id,
      ),
    [activeCloseCountingSession?.Id, selectedElection],
  );
  const closeCountingAcceptedShareCount = useMemo(
    () =>
      getAcceptedFinalizationShareCount(
        selectedElection ?? null,
        activeCloseCountingSession?.Id,
      ),
    [activeCloseCountingSession?.Id, selectedElection],
  );
  const closeCountingReleaseEvidence = useMemo(
    () =>
      getLatestFinalizationReleaseEvidence(
        selectedElection ?? null,
        activeCloseCountingSession?.Id,
      ),
    [activeCloseCountingSession?.Id, selectedElection],
  );
  const hasActiveCloseWorkflowFollowUp = useMemo(() => {
    if (
      governedCloseActionState?.proposal?.ExecutionStatus !==
      ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded
    ) {
      return false;
    }

    return !closeCountingReleaseEvidence;
  }, [
    closeCountingReleaseEvidence,
    governedCloseActionState?.proposal?.ExecutionStatus,
  ]);
  const closeCountingTrusteeProgress = useMemo(() => {
    if (!activeCloseCountingSession) {
      return [];
    }

    return activeCloseCountingSession.EligibleTrustees.map((trustee) => ({
      trustee,
      latestShare:
        closeCountingShares.find(
          (share) =>
            share.TrusteeUserAddress === trustee.TrusteeUserAddress,
        ) ?? null,
    }));
  }, [activeCloseCountingSession, closeCountingShares]);
  const closeCountingEligibleTrusteeCount =
    activeCloseCountingSession?.EligibleTrustees.length ?? 0;
  const closeCountingPendingEligibleTrusteeCount = useMemo(
    () =>
      closeCountingTrusteeProgress.filter(
        ({ latestShare }) =>
          latestShare?.Status !==
          ElectionFinalizationShareStatusProto.FinalizationShareAccepted,
      ).length,
    [closeCountingTrusteeProgress],
  );
  const recoverableCloseCountingFailure =
    activeCloseCountingSession?.CloseCountingJobStatus ===
      ElectionCloseCountingJobStatusProto.CloseCountingJobFailed &&
    !closeCountingReleaseEvidence &&
    closeCountingPendingEligibleTrusteeCount > 0;
  const activeCeremonyTrusteeStates = useMemo(
    () => selectedElection?.ActiveCeremonyTrusteeStates ?? [],
    [selectedElection?.ActiveCeremonyTrusteeStates],
  );
  const fixedCeremonyProfileShape = useMemo(
    () => getFixedCeremonyProfileShape(selectedElection ?? null),
    [selectedElection],
  );
  const availableCeremonyProfiles = useMemo(
    () =>
      getAllowedCeremonyProfiles(
        selectedElection ?? null,
        undefined,
        draft.GovernanceMode,
      ),
    [draft.GovernanceMode, selectedElection],
  );
  const selectedDraftProfile = useMemo(
    () =>
      findCeremonyProfileById(
        availableCeremonyProfiles,
        draft.SelectedProfileId,
        draft.GovernanceMode,
      ),
    [availableCeremonyProfiles, draft.GovernanceMode, draft.SelectedProfileId],
  );
  const compatiblePolicyEditorProfiles = useMemo(
    () =>
      getAllowedCeremonyProfiles(
        selectedElection ?? null,
        policyEditor.bindingStatus,
        policyEditor.governanceMode,
      ),
    [policyEditor.bindingStatus, policyEditor.governanceMode, selectedElection],
  );
  const selectedPolicyEditorProfile = useMemo(
    () =>
      findCeremonyProfileById(
        compatiblePolicyEditorProfiles,
        policyEditor.selectedProfileId,
        policyEditor.governanceMode,
      ),
    [
      compatiblePolicyEditorProfiles,
      policyEditor.governanceMode,
      policyEditor.selectedProfileId,
    ],
  );
  const fixedTrusteeApprovalCount =
    fixedCeremonyProfileShape?.requiredApprovalCount ?? null;
  const fixedCeremonyTrusteeCount =
    fixedCeremonyProfileShape?.trusteeCount ?? null;
  const persistedRequiredApprovalCount =
    latestDraftSnapshot?.Policy.RequiredApprovalCount ??
    election?.RequiredApprovalCount ??
    null;

  const acceptedTrusteeCount = useMemo(
    () =>
      trusteeInvitations.filter(
        (invitation) =>
          invitation.Status === ElectionTrusteeInvitationStatusProto.Accepted,
      ).length,
    [trusteeInvitations],
  );
  const pendingTrusteeCount = useMemo(
    () =>
      trusteeInvitations.filter(
        (invitation) =>
          invitation.Status === ElectionTrusteeInvitationStatusProto.Pending,
      ).length,
    [trusteeInvitations],
  );
  const acceptedTrusteeAddresses = useMemo(
    () =>
      new Set(
        trusteeInvitations
          .filter(
            (invitation) =>
              invitation.Status ===
              ElectionTrusteeInvitationStatusProto.Accepted,
          )
          .map((invitation) => invitation.TrusteeUserAddress),
      ),
    [trusteeInvitations],
  );
  const pendingTrusteeAddresses = useMemo(
    () =>
      new Set(
        trusteeInvitations
          .filter(
            (invitation) =>
              invitation.Status ===
              ElectionTrusteeInvitationStatusProto.Pending,
          )
          .map((invitation) => invitation.TrusteeUserAddress),
      ),
    [trusteeInvitations],
  );

  const unsupportedMessages = useMemo(
    () => getUnsupportedDraftValueMessages(draft),
    [draft],
  );
  const saveValidationErrors = useMemo(
    () => getDraftSaveValidationErrors(draft),
    [draft],
  );
  const openValidationErrors = useMemo(
    () => getDraftOpenValidationErrors(draft),
    [draft],
  );
  const requiredWarningCodes = useMemo(
    () => getRequiredOpenWarningCodes(draft, acceptedTrusteeCount),
    [acceptedTrusteeCount, draft],
  );
  const missingRequiredWarningCodes = useMemo(
    () =>
      requiredWarningCodes.filter(
        (warningCode) =>
          !draft.AcknowledgedWarningCodes.includes(warningCode),
      ),
    [draft.AcknowledgedWarningCodes, requiredWarningCodes],
  );
  const requiredWarningCodeKey = requiredWarningCodes.join(",");

  const fixedPolicyItems = useMemo<FixedPolicyItem[]>(
    () =>
      buildFixedPolicyItems(draft),
    [draft],
  );
  const baselineDraft = useMemo(
    () =>
      selectedElectionId
        ? createDraftFromElectionDetail(selectedElection ?? null)
        : createDefaultElectionDraft(),
    [selectedElection, selectedElectionId],
  );
  const hasPendingDraftChanges = useMemo(
    () =>
      JSON.stringify(normalizeElectionDraft(draft)) !==
      JSON.stringify(normalizeElectionDraft(baselineDraft)),
    [baselineDraft, draft],
  );

  const draftRevisionLabel = getDraftRevisionLabel(
    latestDraftSnapshot,
    election,
  );
  const isScopedElectionWorkspace = !!initialElectionId;
  const isStartingNewDraft = startInNewDraftMode && !selectedElectionId;
  const titleMissing = !draft.Title.trim();
  const saveButtonLabel = selectedElectionId
    ? "Save Next Revision"
    : "Create Election Draft";

  const canEditDraft = isDraftEditable(election);
  const isReadOnlySelectedElection = !!selectedElectionId && !canEditDraft;
  const showDraftCreationActions = !selectedElectionId || canEditDraft;
  const visibleElections = useMemo(
    () =>
      isScopedElectionWorkspace
        ? elections.filter((summary) => summary.ElectionId === initialElectionId)
        : elections,
    [elections, initialElectionId, isScopedElectionWorkspace],
  );
  const workspaceGovernanceMode = canEditDraft
    ? draft.GovernanceMode
    : election?.GovernanceMode ?? draft.GovernanceMode;
  const usesTrusteeThreshold =
    workspaceGovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold;
  const hasSavedElection = !!selectedElectionId;
  const shouldWarnOnLeaveWithUnsavedChanges =
    canEditDraft && hasPendingDraftChanges && !isSubmitting;
  const ownerWorkspaceTabs = useMemo<OwnerWorkspaceTab[]>(
    () => [
      ...(canEditDraft
        ? [
            {
              id: "save" as const,
              label: "Save Draft",
              helper: hasPendingDraftChanges
                ? "This election has unsaved local edits. Save before leaving this workspace."
                : selectedElectionId
                  ? "Review the latest saved revision, local working copy, and the next revision note."
                  : "Create the first saved draft once the required metadata is ready.",
            },
          ]
        : []),
      {
        id: "lifecycle",
        label: "Lifecycle",
        helper: canEditDraft
          ? "Review lifecycle state, timestamps, warning evidence, and frozen policy boundaries here."
          : "Draft editing is frozen, so lifecycle state and boundary evidence stay visible here.",
      },
      {
        id: "readiness",
        label: "Ready to Open",
        helper: usesTrusteeThreshold
          ? "Review draft readiness, warnings, trustee requirements, and governed open status."
          : "Review the current open blockers and warning evidence before opening.",
      },
      ...(usesTrusteeThreshold
        ? [
            {
              id: "trustees" as const,
              label: "Trustee Setup",
              helper:
                "Review the threshold, invitation state, and trustee-specific draft rules.",
            },
          ]
        : []),
      {
        id: "policy",
        label: "Draft Policy",
        helper:
          "Review governance, disclosure, and reporting values without expanding the full page.",
      },
      {
        id: "options",
        label: "Ballot Options",
        helper:
          "Review the current ballot roster and option ordering in a focused block.",
      },
      ...(selectedElectionId
        ? [
            {
              id: "roster" as const,
              label: "Roster",
              helper:
                "Open the restricted named-roster workflow and append operations here.",
            },
            {
              id: "auditors" as const,
              label: "Auditors",
              helper:
                "Manage designated-auditor grants without stacking them into the main page.",
            },
          ]
        : []),
      ...(usesTrusteeThreshold
        ? [
            {
              id: "ceremony" as const,
              label: "Key Ceremony",
              helper:
                "Track trustee-share readiness and ceremony version progress.",
            },
            {
              id: "finalization" as const,
              label: "Finalization",
              helper:
                "Review tally-share progress and aggregate-only release evidence.",
            },
            {
              id: "governed" as const,
              label: "Governed Actions",
              helper:
                "Track open, close, and finalize proposals in one focused area.",
            },
          ]
        : []),
    ],
    [
      canEditDraft,
      hasPendingDraftChanges,
      selectedElectionId,
      usesTrusteeThreshold,
    ],
  );
  const defaultOwnerWorkspaceTab = getDefaultOwnerWorkspaceTabId({
    canEditDraft,
  });
  const activeOwnerWorkspaceTab =
    ownerWorkspaceTabs.find((tab) => tab.id === activeOwnerTab) ?? null;
  const trusteeThresholdNeedsSaveAlignment =
    usesTrusteeThreshold &&
    !!fixedTrusteeApprovalCount &&
    persistedRequiredApprovalCount !== fixedTrusteeApprovalCount;
  const supportsDirectOpen =
    election?.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold;
  const requiredTrusteeCountForOpen = Math.max(
    1,
    selectedDraftProfile?.TrusteeCount ??
      fixedCeremonyTrusteeCount ??
      draft.RequiredApprovalCount ??
      1,
  );
  const selectedTrusteeRosterLabel =
    usesTrusteeThreshold && selectedDraftProfile
      ? `${selectedDraftProfile.RequiredApprovalCount}-of-${selectedDraftProfile.TrusteeCount}`
      : usesTrusteeThreshold &&
          fixedTrusteeApprovalCount &&
          fixedCeremonyTrusteeCount
        ? `${fixedTrusteeApprovalCount}-of-${fixedCeremonyTrusteeCount}`
        : null;
  const hasAcceptedTrusteesForOpen =
    !usesTrusteeThreshold ||
    acceptedTrusteeCount >= requiredTrusteeCountForOpen;
  const isKeyCeremonyReady =
    !usesTrusteeThreshold ||
    activeCeremonyVersion?.Status ===
      ElectionCeremonyVersionStatusProto.CeremonyVersionReady;
  const hasPendingOwnerCeremonyValidation =
    usesTrusteeThreshold &&
    activeCeremonyVersion?.Status ===
      ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress &&
    activeCeremonyTrusteeStates.some(
      (state) =>
        state.State ===
        ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
    );
  const canOpenSelectedElection =
    supportsDirectOpen &&
    canOpenElection(election) &&
    unsupportedMessages.length === 0 &&
    saveValidationErrors.length === 0 &&
    openValidationErrors.length === 0;
  const protocolPackageBinding =
    openReadiness?.ProtocolPackageBinding ?? selectedElection?.ProtocolPackageBinding ?? null;
  const protocolPackagePresentation = useMemo(
    () =>
      getProtocolPackageBindingPresentation(
        protocolPackageBinding,
        openReadiness?.ProtocolPackageBindingStatus ?? ProtocolPackageBindingStatusProto.Missing,
        openReadiness?.ProtocolPackageBindingMessage
      ),
    [
      openReadiness?.ProtocolPackageBindingMessage,
      openReadiness?.ProtocolPackageBindingStatus,
      protocolPackageBinding,
    ]
  );
  const canCloseSelectedElection = canCloseElection(election);
  const canFinalizeSelectedElection = canFinalizeElection(election);
  const governedOpenPrerequisiteIssues = useMemo(() => {
    if (!usesTrusteeThreshold) {
      return [];
    }

    const issues: string[] = [];
    if (!hasSavedElection) {
      issues.push(
        "Save the draft first to create the persisted election record before starting the governed open proposal.",
      );
    }
    if (saveValidationErrors.length > 0) {
      issues.push(
        "Resolve the draft-save blockers before starting the governed open proposal.",
      );
    }
    if (openValidationErrors.length > 0) {
      issues.push(
        "Resolve the ballot or local open-checklist blockers before starting the governed open proposal.",
      );
    }
    if (missingRequiredWarningCodes.length > 0) {
      issues.push(
        "Acknowledge the required warnings before starting the governed open proposal.",
      );
    }
    if (protocolPackagePresentation.openBlocked) {
      issues.push(protocolPackagePresentation.description);
    }
    if (!hasAcceptedTrusteesForOpen) {
      issues.push(
        selectedTrusteeRosterLabel
          ? `Need at least ${requiredTrusteeCountForOpen} accepted trustee(s) to match the selected ${selectedTrusteeRosterLabel} ceremony profile before the governed open proposal can start.`
          : `Need at least ${requiredTrusteeCountForOpen} accepted trustee(s) before the governed open proposal can start.`,
      );
    }
    if (!isKeyCeremonyReady) {
      issues.push(
        hasPendingOwnerCeremonyValidation && activeCeremonyVersion
          ? `Ceremony version ${activeCeremonyVersion.VersionNumber} is waiting for owner validation of submitted trustee packages.`
          : activeCeremonyVersion
            ? `Ceremony version ${activeCeremonyVersion.VersionNumber} is still in progress.`
            : "Start and complete the key ceremony before the governed open proposal can start.",
      );
    }

    return issues;
  }, [
    activeCeremonyVersion,
    hasAcceptedTrusteesForOpen,
    hasPendingOwnerCeremonyValidation,
    hasSavedElection,
    isKeyCeremonyReady,
    missingRequiredWarningCodes.length,
    openValidationErrors.length,
    protocolPackagePresentation.description,
    protocolPackagePresentation.openBlocked,
    requiredTrusteeCountForOpen,
    saveValidationErrors.length,
    selectedTrusteeRosterLabel,
    usesTrusteeThreshold,
  ]);
  const isGovernedOpenWorkflowReady =
    usesTrusteeThreshold &&
    governedOpenPrerequisiteIssues.length === 0 &&
    governedOpenActionState?.status === "available";
  const readyToOpenChecklist = useMemo(
    () => [
      {
        label: "Saved draft exists",
        isReady: hasSavedElection,
        detail: hasSavedElection
          ? "This election already has a saved draft revision."
          : "Save the draft first to create a persisted election record.",
      },
      {
        label: "Draft save checks",
        isReady: saveValidationErrors.length === 0,
        detail:
          saveValidationErrors.length === 0
            ? "Required metadata and policy values are present."
            : "Resolve the draft-save blockers before you continue.",
      },
      {
        label: "Open checklist",
        isReady: openValidationErrors.length === 0,
        detail:
          openValidationErrors.length === 0
            ? "Ballot options and local open prerequisites are clear."
            : "The election still needs ballot or open-preparation work.",
      },
      {
        label: "Required warnings",
        isReady: missingRequiredWarningCodes.length === 0,
        detail:
          missingRequiredWarningCodes.length === 0
            ? "All warning acknowledgements required for open are selected."
            : "Review and acknowledge the required warnings before open.",
      },
      {
        label: "Protocol package refs",
        isReady: !protocolPackagePresentation.openBlocked,
        detail: protocolPackagePresentation.description,
      },
      ...(usesTrusteeThreshold
        ? [
            {
              label: "Accepted trustee roster",
              isReady: hasAcceptedTrusteesForOpen,
              detail: hasAcceptedTrusteesForOpen
                ? selectedTrusteeRosterLabel
                  ? `${acceptedTrusteeCount} accepted trustee(s) satisfy the selected ${selectedTrusteeRosterLabel} profile roster.`
                  : `${acceptedTrusteeCount} accepted trustee(s) satisfy the selected ceremony profile roster.`
                : selectedTrusteeRosterLabel
                  ? `Need at least ${requiredTrusteeCountForOpen} accepted trustee(s) to match the selected ${selectedTrusteeRosterLabel} profile.`
                  : `Need at least ${requiredTrusteeCountForOpen} accepted trustee(s).`,
            },
            {
              label: "Key ceremony",
              isReady: isKeyCeremonyReady,
              detail: isKeyCeremonyReady
                ? activeCeremonyVersion
                  ? `Ceremony version ${activeCeremonyVersion.VersionNumber} is ready.`
                  : "The key ceremony is ready."
                : hasPendingOwnerCeremonyValidation && activeCeremonyVersion
                  ? `Ceremony version ${activeCeremonyVersion.VersionNumber} is waiting for owner validation of submitted trustee packages.`
                  : activeCeremonyVersion
                    ? `Ceremony version ${activeCeremonyVersion.VersionNumber} is not ready yet.`
                    : "Start and complete the key ceremony before open can proceed.",
            },
          ]
        : [
            {
              label: "Server open readiness",
              isReady: !!openReadiness?.IsReadyToOpen,
              detail: hasSavedElection
                ? openReadiness?.IsReadyToOpen
                  ? "Server-side open readiness confirms the election can open."
                  : "Refresh server open readiness after the checklist is clear."
                : "Create the saved draft first to fetch server open readiness.",
            },
          ]),
    ],
    [
      acceptedTrusteeCount,
      activeCeremonyVersion,
      hasAcceptedTrusteesForOpen,
      hasPendingOwnerCeremonyValidation,
      hasSavedElection,
      isKeyCeremonyReady,
      missingRequiredWarningCodes.length,
      openReadiness?.IsReadyToOpen,
      openValidationErrors.length,
      protocolPackagePresentation.description,
      protocolPackagePresentation.openBlocked,
      requiredTrusteeCountForOpen,
      saveValidationErrors.length,
      selectedTrusteeRosterLabel,
      usesTrusteeThreshold,
    ],
  );

  useEffect(() => {
    setOwnerPublicAddress(ownerPublicAddress);
    if (startInNewDraftMode) {
      beginNewElection();
    }

    const loadWorkspace = async () => {
      await loadOwnerDashboard(ownerPublicAddress, {
        autoSelectFirst: !startInNewDraftMode && !initialElectionId,
      });

      if (initialElectionId) {
        await loadElection(initialElectionId);
      }
    };

    void loadWorkspace();
  }, [
    beginNewElection,
    initialElectionId,
    loadElection,
    loadOwnerDashboard,
    ownerPublicAddress,
    setOwnerPublicAddress,
    startInNewDraftMode,
  ]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!selectedElectionId) {
      setDraft(createDefaultElectionDraft());
      setSnapshotReason("Initial draft");
      return;
    }

    setDraft(createDraftFromElectionDetail(selectedElection ?? null));
    setSnapshotReason("Owner draft update");
  }, [selectedElection, selectedElectionId]);

  useEffect(() => {
    setHasManuallySelectedOwnerTab(false);
  }, [selectedElectionId]);

  useEffect(() => {
    const hasActiveTab = ownerWorkspaceTabs.some(
      (tab) => tab.id === activeOwnerTab,
    );

    if (!hasActiveTab) {
      setActiveOwnerTab(defaultOwnerWorkspaceTab);
      return;
    }

    if (
      !hasManuallySelectedOwnerTab &&
      activeOwnerTab !== defaultOwnerWorkspaceTab
    ) {
      setActiveOwnerTab(defaultOwnerWorkspaceTab);
    }
  }, [
    activeOwnerTab,
    defaultOwnerWorkspaceTab,
    hasManuallySelectedOwnerTab,
      ownerWorkspaceTabs,
  ]);

  useEffect(() => {
    if (!shouldWarnOnLeaveWithUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = UNSAVED_DRAFT_LEAVE_MESSAGE;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldWarnOnLeaveWithUnsavedChanges]);

  useEffect(() => {
    if (!shouldWarnOnLeaveWithUnsavedChanges) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.href === current.href) {
        return;
      }

      if (!window.confirm(UNSAVED_DRAFT_LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [shouldWarnOnLeaveWithUnsavedChanges]);

  useEffect(() => {
    if (
      draft.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold ||
      !fixedTrusteeApprovalCount ||
      draft.RequiredApprovalCount === fixedTrusteeApprovalCount
    ) {
      return;
    }

    setDraft((current) => {
      if (
        current.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold ||
        current.RequiredApprovalCount === fixedTrusteeApprovalCount
      ) {
        return current;
      }

      return {
        ...current,
        RequiredApprovalCount: fixedTrusteeApprovalCount,
      };
    });
  }, [
    draft.GovernanceMode,
    draft.RequiredApprovalCount,
    fixedTrusteeApprovalCount,
  ]);

  useEffect(() => {
    if (!selectedElectionId) {
      return;
    }

    void loadReportAccessGrants(ownerPublicAddress, selectedElectionId);
  }, [loadReportAccessGrants, ownerPublicAddress, selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId || !election || !canEditDraft || saveValidationErrors.length > 0) {
      return;
    }

    void loadOpenReadiness(requiredWarningCodes);
  }, [
    canEditDraft,
    election,
    loadOpenReadiness,
    requiredWarningCodeKey,
    requiredWarningCodes,
    saveValidationErrors.length,
    selectedElectionId,
  ]);

  const handleRefreshProtocolPackageBinding = useCallback(async () => {
    const refreshed = await refreshProtocolPackageBinding(
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey
    );

    if (refreshed) {
      await loadOpenReadiness(requiredWarningCodes);
    }
  }, [
    loadOpenReadiness,
    ownerEncryptionPrivateKey,
    ownerEncryptionPublicKey,
    ownerSigningPrivateKey,
    refreshProtocolPackageBinding,
    requiredWarningCodes,
  ]);

  useEffect(() => {
    if (
      !selectedElectionId ||
      election?.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold
    ) {
      return;
    }

    void loadCeremonyActionView(ownerPublicAddress, selectedElectionId);
  }, [
    election?.GovernanceMode,
    loadCeremonyActionView,
    ownerPublicAddress,
    selectedElectionId,
  ]);

  const refreshOwnerContext = useCallback(
    async (options?: { includeCeremonyContext?: boolean }) => {
      if (
        !selectedElectionId ||
        election?.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold
      ) {
        return;
      }

      if (ownerRefreshInFlightRef.current) {
        return;
      }

      ownerRefreshInFlightRef.current = true;
      try {
        const refreshTasks: Array<Promise<unknown>> = [
          loadElection(selectedElectionId, { silent: true }),
        ];
        if (options?.includeCeremonyContext) {
          refreshTasks.push(
            loadCeremonyActionView(ownerPublicAddress, selectedElectionId, {
              silent: true,
            }),
          );
        }
        await Promise.all(refreshTasks);
      } finally {
        ownerRefreshInFlightRef.current = false;
      }
    },
    [
      election?.GovernanceMode,
      loadCeremonyActionView,
      loadElection,
      ownerPublicAddress,
      selectedElectionId,
    ],
  );

  useEffect(() => {
    const refreshableOwnerTabs: OwnerWorkspaceTabId[] = [
      "ceremony",
      "readiness",
      "trustees",
      "lifecycle",
      "governed",
    ];
    const ceremonyRefreshTabs: OwnerWorkspaceTabId[] = ["ceremony", "readiness", "lifecycle"];

    if (
      !selectedElectionId ||
      election?.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold ||
      !activeOwnerTab ||
      !refreshableOwnerTabs.includes(activeOwnerTab)
    ) {
      return;
    }

    const shouldRefreshCeremonyContext =
      ceremonyRefreshTabs.includes(activeOwnerTab);

    const intervalId = window.setInterval(() => {
      void refreshOwnerContext({
        includeCeremonyContext: shouldRefreshCeremonyContext,
      });
    }, CEREMONY_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeOwnerTab,
    election?.GovernanceMode,
    refreshOwnerContext,
    selectedElectionId,
  ]);

  useEffect(() => {
    if (
      blockHeight <= 0 ||
      activeOwnerTab !== "governed" ||
      (!hasPendingGovernedApprovalProposal && !hasActiveCloseWorkflowFollowUp)
    ) {
      return;
    }

    void refreshOwnerContext();
  }, [
    activeOwnerTab,
    blockHeight,
    hasActiveCloseWorkflowFollowUp,
    hasPendingGovernedApprovalProposal,
    refreshOwnerContext,
    selectedElectionId,
  ]);

  const confirmLeaveWithUnsavedChanges = () => {
    if (!shouldWarnOnLeaveWithUnsavedChanges) {
      return true;
    }

    return window.confirm(UNSAVED_DRAFT_LEAVE_MESSAGE);
  };

  const handleSelectElection = async (electionId: string) => {
    if (selectedElectionId === electionId) {
      return;
    }

    if (!confirmLeaveWithUnsavedChanges()) {
      return;
    }

    await loadElection(electionId);
  };

  const handleNewDraft = () => {
    if (!confirmLeaveWithUnsavedChanges()) {
      return;
    }

    beginNewElection();
    clearFeedback();
    setDraft(createDefaultElectionDraft());
    setSnapshotReason("Initial draft");
    setTrusteeUserAddress("");
    setTrusteeDisplayName("");
  };

  const handleSaveDraft = async () => {
    const normalizedDraft = normalizeElectionDraft(
      draft,
      availableCeremonyProfiles,
    );
    setDraft(normalizedDraft);

    const reason = snapshotReason.trim();
    if (!reason) {
      return;
    }

    if (selectedElectionId) {
      await updateDraft(
        normalizedDraft,
        reason,
        ownerEncryptionPublicKey ?? "",
        ownerEncryptionPrivateKey ?? "",
        ownerSigningPrivateKey,
      );
      return;
    }

    await createDraft(
      normalizedDraft,
      reason,
      ownerEncryptionPublicKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const openMetadataOverlay = () => {
    setMetadataEditor({
      title: draft.Title,
      externalReferenceCode: draft.ExternalReferenceCode,
      shortDescription: draft.ShortDescription,
    });
    setActiveOverlay("metadata");
  };

  const applyMetadataChanges = () => {
    setDraft((current) => ({
      ...current,
      Title: metadataEditor.title,
      ExternalReferenceCode: metadataEditor.externalReferenceCode,
      ShortDescription: metadataEditor.shortDescription,
    }));
    setActiveOverlay(null);
  };

  const openPolicyOverlay = () => {
    setPolicyEditor({
      bindingStatus: draft.BindingStatus,
      selectedProfileId: draft.SelectedProfileId,
      governanceMode: draft.GovernanceMode,
      outcomeRuleKind: draft.OutcomeRule.Kind,
    });
    setActiveOverlay("policy");
  };

  const applyPolicyChanges = () => {
    const nextSelectedProfileId = coerceSelectedCeremonyProfileId(
      policyEditor.bindingStatus,
      policyEditor.governanceMode,
      policyEditor.selectedProfileId,
      compatiblePolicyEditorProfiles,
    );
    const nextSelectedProfile = findCeremonyProfileById(
      compatiblePolicyEditorProfiles,
      nextSelectedProfileId,
      policyEditor.governanceMode,
    );
    setDraft((current) => {
      const governanceUpdated = applyGovernanceModeDefaults(
        current,
        policyEditor.governanceMode,
      );
      return {
        ...governanceUpdated,
        BindingStatus: policyEditor.bindingStatus,
        SelectedProfileId: nextSelectedProfileId,
        OutcomeRule: createOutcomeRuleForKind(policyEditor.outcomeRuleKind),
        RequiredApprovalCount:
          policyEditor.governanceMode ===
          ElectionGovernanceModeProto.TrusteeThreshold
            ? Math.max(
                1,
                nextSelectedProfile?.RequiredApprovalCount ??
                  governanceUpdated.RequiredApprovalCount ??
                  1,
              )
            : undefined,
      };
    });
    setActiveOverlay(null);
  };

  const openOptionsOverlay = () => {
    setOptionsEditor(
      draft.OwnerOptions.map((option) => ({
        ...option,
      })),
    );
    setActiveOverlay("options");
  };

  const applyOptionsChanges = () => {
    setDraft((current) => ({
      ...current,
      OwnerOptions: renumberElectionOptions(
        optionsEditor.map((option) => ({
          ...option,
        })),
      ),
    }));
    setActiveOverlay(null);
  };

  const openWarningsOverlay = () => {
    setWarningChoicesEditor([...draft.AcknowledgedWarningCodes]);
    setActiveOverlay("warnings");
  };

  const applyWarningChoiceChanges = () => {
    setDraft((current) => ({
      ...current,
      AcknowledgedWarningCodes: [...warningChoicesEditor].sort(
        (left, right) => left - right,
      ),
    }));
    setActiveOverlay(null);
  };

  const openTrusteeOverlay = () => {
    setTrusteeApprovalEditor(
      fixedTrusteeApprovalCount ?? draft.RequiredApprovalCount ?? 1,
    );
    setTrusteeUserAddress("");
    setTrusteeDisplayName("");
    setTrusteeSearchQuery("");
    setTrusteeSearchResults([]);
    setHasSearchedTrustees(false);
    setActiveOverlay("trustees");
  };

  const applyTrusteeDraftChanges = () => {
    setDraft((current) => ({
      ...current,
      RequiredApprovalCount: Math.max(
        1,
        fixedTrusteeApprovalCount ?? trusteeApprovalEditor ?? 1,
      ),
    }));
    setActiveOverlay(null);
  };

  const openRosterOverlay = () => {
    setActiveOverlay("roster");
  };

  const inviteTrusteeCandidate = async (
    trusteeAddress: string,
    trusteeName: string,
  ) => {
    if (
      !selectedElectionId ||
      !trusteeAddress.trim() ||
      !trusteeName.trim()
    ) {
      return false;
    }

    const didInvite = await inviteTrustee(
      {
        ElectionId: selectedElectionId,
        ActorPublicAddress: ownerPublicAddress,
        TrusteeUserAddress: trusteeAddress.trim(),
        TrusteeDisplayName: trusteeName.trim(),
      },
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );

    if (didInvite) {
      setTrusteeUserAddress("");
      setTrusteeDisplayName("");
      setTrusteeSearchQuery("");
      setTrusteeSearchResults([]);
      setHasSearchedTrustees(false);
    }
    return didInvite;
  };

  const handleInviteTrustee = async () => {
    await inviteTrusteeCandidate(trusteeUserAddress, trusteeDisplayName);
  };

  const handleSearchTrusteeCandidates = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedQuery = trusteeSearchQuery.trim();
    if (!normalizedQuery) {
      setTrusteeSearchResults([]);
      setHasSearchedTrustees(false);
      return;
    }

    setIsSearchingTrustees(true);
    setHasSearchedTrustees(true);

    try {
      const response = await identityService.searchByDisplayName(
        normalizedQuery,
      );
      setTrusteeSearchResults(response.Identities ?? []);
    } finally {
      setIsSearchingTrustees(false);
    }
  };

  const clearTrusteeCandidateSearch = () => {
    setTrusteeSearchQuery("");
    setTrusteeSearchResults([]);
    setHasSearchedTrustees(false);
  };

  const getTrusteeCandidateRestrictionReason = (candidate: Identity) => {
    if (candidate.PublicSigningAddress === ownerPublicAddress) {
      return "Owner/admin accounts cannot invite themselves as trustees.";
    }

    if (!candidate.PublicEncryptAddress.trim()) {
      return "This account cannot be invited because it has no public encryption key.";
    }

    if (acceptedTrusteeAddresses.has(candidate.PublicSigningAddress)) {
      return "This account is already an accepted trustee on this election.";
    }

    if (pendingTrusteeAddresses.has(candidate.PublicSigningAddress)) {
      return "This account already has a pending trustee invitation.";
    }

    return null;
  };

  const handleInviteTrusteeFromSearch = async (candidate: Identity) => {
    const restrictionReason = getTrusteeCandidateRestrictionReason(candidate);
    if (restrictionReason) {
      return;
    }

    await inviteTrusteeCandidate(
      candidate.PublicSigningAddress,
      candidate.DisplayName.trim() || candidate.PublicSigningAddress,
    );
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!selectedElectionId) {
      return;
    }

    const request: ResolveElectionTrusteeInvitationRequest = {
      ElectionId: selectedElectionId,
      InvitationId: invitationId,
      ActorPublicAddress: ownerPublicAddress,
    };

    await revokeInvitation(
      request,
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleOpenElection = async () => {
    if (!canOpenSelectedElection) {
      return;
    }

    const readiness =
      openReadiness ?? (await loadOpenReadiness(requiredWarningCodes));
    if (!readiness?.IsReadyToOpen) {
      return;
    }

    await openElection(
      requiredWarningCodes,
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleCloseElection = async () => {
    await closeElection(
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleFinalizeElection = async () => {
    await finalizeElection(
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleOptionsEditorMove = (index: number, direction: -1 | 1) => {
    setOptionsEditor((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const nextOptions = [...current];
      const [movedOption] = nextOptions.splice(index, 1);
      nextOptions.splice(targetIndex, 0, movedOption);
      return renumberElectionOptions(nextOptions);
    });
  };

  const handleOptionsEditorRemove = (index: number) => {
    setOptionsEditor((current) =>
      renumberElectionOptions(
        current.filter((_, optionIndex) => optionIndex !== index),
      ),
    );
  };

  const handleOptionsEditorAdd = () => {
    setOptionsEditor((current) =>
      renumberElectionOptions([
        ...current,
        createElectionOption(current.length + 1),
      ]),
    );
  };

  const handleStartGovernedProposal = async (
    actionType: ElectionGovernedActionTypeProto,
  ) => {
    if (
      actionType === ElectionGovernedActionTypeProto.Open &&
      governedOpenPrerequisiteIssues.length > 0
    ) {
      return;
    }

    await startGovernedProposal(
      actionType,
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleRetryGovernedProposal = async (proposalId: string) => {
    await retryGovernedProposalExecution(
      proposalId,
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleStartCeremony = async (profileId: string) => {
    if (!selectedElectionId) {
      return false;
    }

    return startElectionCeremony(
      {
        ElectionId: selectedElectionId,
        ActorPublicAddress: ownerPublicAddress,
        ProfileId: profileId,
      },
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleRestartCeremony = async (
    profileId: string,
    restartReason: string,
  ) => {
    if (!selectedElectionId) {
      return false;
    }

    return restartElectionCeremony(
      {
        ElectionId: selectedElectionId,
        ActorPublicAddress: ownerPublicAddress,
        ProfileId: profileId,
        RestartReason: restartReason,
      },
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleCompleteCeremonyTrustee = async (
    trusteeUserAddress: string,
    shareVersion: string,
    tallyPublicKeyFingerprint: string | null,
  ) => {
    if (!selectedElectionId || !activeCeremonyVersion) {
      return false;
    }

    return completeElectionCeremonyTrustee(
      {
        ElectionId: selectedElectionId,
        ActorPublicAddress: ownerPublicAddress,
        CeremonyVersionId: activeCeremonyVersion.Id,
        TrusteeUserAddress: trusteeUserAddress,
        ShareVersion: shareVersion,
        TallyPublicKeyFingerprint: tallyPublicKeyFingerprint ?? null,
      },
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  const handleRecordCeremonyValidationFailure = async (
    trusteeUserAddress: string,
    validationFailureReason: string,
    evidenceReference: string,
  ) => {
    if (!selectedElectionId || !activeCeremonyVersion) {
      return false;
    }

    return recordElectionCeremonyValidationFailure(
      {
        ElectionId: selectedElectionId,
        ActorPublicAddress: ownerPublicAddress,
        CeremonyVersionId: activeCeremonyVersion.Id,
        TrusteeUserAddress: trusteeUserAddress,
        ValidationFailureReason: validationFailureReason,
        EvidenceReference: evidenceReference,
      },
      ownerEncryptionPublicKey ?? "",
      ownerEncryptionPrivateKey ?? "",
      ownerSigningPrivateKey,
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/elections"
              className="mb-3 inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to HushVoting! Hub</span>
            </Link>
            <h1 className="text-2xl font-semibold">
              Election Lifecycle Workspace
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
              {isStartingNewDraft
                ? "Start a brand-new election draft here. Complete the required fields, then save it to create the first saved revision."
                : isScopedElectionWorkspace
                  ? "This owner workspace is scoped to the election you opened from the hub. Review or edit this election's current draft here without mixing it with your other saved elections."
                : isReadOnlySelectedElection
                  ? "Review the selected election here. Draft editing is frozen after open, so this workspace now focuses on lifecycle state, warning evidence, boundary artifacts, and any remaining owner-only follow-up."
                  : "Select a saved election on the left, edit its current draft here, and save local changes as the next draft revision while keeping policy boundaries, warning acknowledgements, and trustee-threshold limitations explicit."}
            </p>
          </div>
          {selectedElectionId && canEditDraft && !isScopedElectionWorkspace ? (
            <button
              type="button"
              onClick={handleNewDraft}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
            >
              <Plus className="h-4 w-4" />
              <span>New Election Draft</span>
            </button>
          ) : null}
        </div>

        {feedback && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-green-500/40 bg-green-500/10 text-green-100"
                : "border-red-500/40 bg-red-500/10 text-red-100"
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-medium">
              {feedback.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{feedback.message}</span>
            </div>
            {feedback.details.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside
            className={`${sectionClass} h-fit`}
            data-testid="elections-sidebar"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  {isStartingNewDraft
                    ? "New Election Draft"
                    : isScopedElectionWorkspace
                      ? "Current Election"
                      : "Saved Elections"}
                </h2>
                <p className="mt-1 text-xs text-hush-text-accent">
                  {isStartingNewDraft
                    ? "Creation mode"
                    : isLoadingList
                      ? isScopedElectionWorkspace
                        ? "Loading current election..."
                        : "Refreshing saved elections..."
                      : isScopedElectionWorkspace
                        ? `${visibleElections.length} selected election`
                        : `${elections.length} saved election(s)`}
                </p>
                <p className="mt-1 text-xs text-hush-text-accent">
                  {isStartingNewDraft
                    ? "This blank draft is separate from your existing saved elections. They stay hidden until you save or leave create mode."
                    : isScopedElectionWorkspace
                      ? "This workspace stays focused on the election you opened from the hub."
                    : isReadOnlySelectedElection
                      ? "Select one to review it here. Open elections stay read-only in this workspace."
                      : "Select one to continue editing it, or start a brand-new election draft below."}
                </p>
              </div>
              {isLoadingList && (
                <Loader2 className="h-4 w-4 animate-spin text-hush-purple" />
              )}
            </div>

            <div className="space-y-3">
              {showDraftCreationActions && !isScopedElectionWorkspace ? (
                <button
                  type="button"
                  onClick={handleNewDraft}
                  className={`w-full rounded-xl px-4 py-3 text-left shadow-sm transition-colors ${
                    selectedElectionId
                      ? "bg-hush-bg-dark/80 hover:bg-hush-bg-dark"
                      : "bg-hush-purple/10 ring-1 ring-hush-purple/40"
                  }`}
                >
                  <div className="text-sm font-medium">
                    {isStartingNewDraft
                      ? "Blank election draft"
                      : "Start new election draft"}
                  </div>
                  <div className="mt-1 text-xs text-hush-text-accent">
                    {isStartingNewDraft
                      ? "Required fields are still empty. Save this draft to create the first saved election revision."
                      : "Start a brand-new election draft. It becomes a saved election only after the first save."}
                  </div>
                </button>
              ) : null}

              {!isStartingNewDraft &&
                visibleElections.map((summary) => (
                  <button
                    key={summary.ElectionId}
                    type="button"
                    onClick={() => void handleSelectElection(summary.ElectionId)}
                    className={`w-full rounded-xl px-4 py-3 text-left shadow-sm transition-colors ${
                      selectedElectionId === summary.ElectionId
                        ? "bg-hush-purple/10 ring-1 ring-hush-purple/40"
                        : "bg-hush-bg-dark/80 hover:bg-hush-bg-dark"
                    }`}
                    data-testid={`election-summary-${summary.ElectionId}`}
                  >
                    <div className="text-sm font-medium">
                      {summary.Title || "Untitled election"}
                    </div>
                    <div className="mt-1 text-xs text-hush-text-accent">
                      {getSummaryBadge(summary)}
                    </div>
                    <div className="mt-2 text-xs text-hush-text-accent">
                      Updated {formatTimestamp(summary.LastUpdatedAt)}
                    </div>
                  </button>
                ))}
            </div>
          </aside>

          <main
            className="flex min-w-0 flex-col gap-6"
            data-testid="elections-workspace"
          >
            <section className={sectionClass}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-hush-purple/10 px-3 py-1 text-xs font-medium text-hush-purple">
                      {getLifecycleLabel(election?.LifecycleState)}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {draftRevisionLabel}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {getBindingLabel(draft.BindingStatus)}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {getGovernanceLabel(draft.GovernanceMode)}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {getOutcomeRuleLabel(draft.OutcomeRule.Kind)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">
                    {draft.Title.trim() || "Untitled election draft"}
                  </h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    Owner address:{" "}
                    <span className="font-mono text-xs">
                      {ownerPublicAddress}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div
                    className="rounded-xl bg-hush-bg-dark/80 px-3 py-2 text-xs text-hush-text-accent"
                    data-testid="elections-mode-freeze-summary"
                  >
                    {selectedDraftProfile
                      ? `${selectedDraftProfile.DisplayName}. ${getModeProfileFreezeCopy(draft.BindingStatus)}`
                      : getModeProfileFreezeCopy(draft.BindingStatus)}
                  </div>
                  {draft.BindingStatus ===
                    ElectionBindingStatusProto.NonBinding && (
                    <div
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                      data-testid="elections-binding-advisory"
                    >
                      Non-binding elections still freeze the same policy and
                      lifecycle data, but the result is advisory.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {selectedElectionId && !canEditDraft && (
              <section
                className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sky-100"
                data-testid="elections-read-only-banner"
              >
                Draft editing is frozen after open. This surface stays read-only
                while lifecycle state, warning evidence, and boundary artifacts
                remain visible.
              </section>
            )}

            {unsupportedMessages.length > 0 && (
              <section
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-100"
                data-testid="elections-unsupported-panel"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Unsupported values detected</span>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {unsupportedMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </section>
            )}

            {canEditDraft && saveValidationErrors.length > 0 && (
              <section
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-100"
                data-testid="elections-save-blockers-banner"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    {selectedElectionId
                      ? "Before you can save the next revision"
                      : "Before you can create this draft"}
                  </span>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {saveValidationErrors.map((validationError) => (
                    <li key={validationError}>{validationError}</li>
                  ))}
                </ul>
              </section>
            )}

            <OwnerOverviewSection
              title="Election Metadata"
              description={
                titleMissing
                  ? "Title is required before the first save. External reference code and short description are optional."
                  : "Review the draft identity fields here. Edit them in a focused overlay, then return to this read-only view before saving the draft."
              }
              actionLabel={canEditDraft ? "Edit metadata" : undefined}
              onAction={canEditDraft ? openMetadataOverlay : undefined}
              dataTestId="elections-metadata-overview"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div
                  className={`rounded-xl border bg-hush-bg-dark/80 p-4 ${
                    titleMissing
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-hush-bg-light"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Title
                  </div>
                  <div className="mt-2 text-sm font-medium text-hush-text-primary">
                    {draft.Title || "Required before save"}
                  </div>
                  <div className="mt-2 text-xs text-hush-text-accent">
                    {titleMissing
                      ? "Add the election title in Edit metadata."
                      : "Required for saving and for later participant-facing views."}
                  </div>
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    External reference code
                  </div>
                  <div className="mt-2 text-sm font-medium text-hush-text-primary">
                    {draft.ExternalReferenceCode || "Not set"}
                  </div>
                  <div className="mt-2 text-xs text-hush-text-accent">
                    Optional for draft creation.
                  </div>
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Short description
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {draft.ShortDescription ||
                      "No short description has been added yet."}
                  </div>
                  <div className="mt-2 text-xs text-hush-text-accent">
                    Optional for draft creation.
                  </div>
                </div>
              </div>
            </OwnerOverviewSection>

            <section
              className={sectionClass}
              data-testid="elections-detail-tabs"
              style={{ order: 1 }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Workspace Detail Sections
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                    Keep metadata fixed at the top, then switch the workspace
                    detail below one focused section at a time.
                  </p>
                </div>
                {activeOwnerWorkspaceTab ? (
                  <div className="rounded-2xl bg-hush-bg-dark/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Focused detail
                    </div>
                    <div className="mt-2 text-sm font-medium text-hush-text-primary">
                      {activeOwnerWorkspaceTab.label}
                    </div>
                    <div className="mt-1 max-w-sm text-xs text-hush-text-accent">
                      {activeOwnerWorkspaceTab.helper}
                    </div>
                  </div>
                ) : null}
              </div>

              {shouldWarnOnLeaveWithUnsavedChanges && (
                <div
                  className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  data-testid="elections-dirty-draft-banner"
                >
                  Unsaved local edits are still only on this device. Open Save
                  Draft before leaving this election.
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {ownerWorkspaceTabs.map((tab) => {
                  const isActive = tab.id === activeOwnerTab;
                  const isDirtySaveTab =
                    tab.id === "save" && shouldWarnOnLeaveWithUnsavedChanges;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveOwnerTab(tab.id);
                        setHasManuallySelectedOwnerTab(true);
                      }}
                      aria-pressed={isActive}
                      data-testid={`elections-detail-tab-${tab.id}`}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-hush-purple text-white shadow-sm shadow-hush-purple/20"
                          : "bg-hush-bg-dark/70 text-hush-text-accent hover:bg-hush-bg-dark hover:text-hush-text-primary"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span>{tab.label}</span>
                        {isDirtySaveTab ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                            Unsaved
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {usesTrusteeThreshold && activeOwnerTab === "trustees" && (
              <div style={{ order: 4 }}>
                <OwnerOverviewSection
                title="Trustee Setup"
                description="Trustee approvals and invitations are reviewed here. Open the editor to adjust the approval threshold or manage invitation records without editing the whole page inline."
                actionLabel={canEditDraft ? "Edit trustee setup" : undefined}
                onAction={canEditDraft ? openTrusteeOverlay : undefined}
                dataTestId="elections-trustee-overview"
              >
                <div
                  className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  data-testid="elections-trustee-blocked-panel"
                >
                  Proposal approval is active for trustee-threshold elections.
                  Critical lifecycle changes now move through proposal approval
                  instead of direct buttons.
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Required approval count
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {draft.RequiredApprovalCount ?? 1}
                    </div>
                    <div className="mt-2 text-xs text-hush-text-accent">
                      {fixedTrusteeApprovalCount && fixedCeremonyTrusteeCount
                        ? trusteeThresholdNeedsSaveAlignment
                          ? `Aligned locally to the current ${fixedTrusteeApprovalCount}-of-${fixedCeremonyTrusteeCount} trustee rollout. Save the next draft revision to persist it.`
                          : `Fixed by the current ${fixedTrusteeApprovalCount}-of-${fixedCeremonyTrusteeCount} trustee rollout.`
                        : "This threshold is saved with the next draft revision."}
                    </div>
                  </div>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Accepted trustees
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {acceptedTrusteeCount}
                    </div>
                    <div className="mt-2 text-xs text-hush-text-accent">
                      Pending invitations: {pendingTrusteeCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Review window policy
                    </div>
                    <div className="mt-2 text-sm font-medium">
                      {getReviewWindowPolicyLabel(draft.ReviewWindowPolicy)}
                    </div>
                    <div className="mt-2 text-xs text-hush-text-accent">
                      Reserved now so governed review can inherit the frozen
                      policy boundary later.
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-sm font-semibold">Invitation status</div>
                  {selectedElectionId ? (
                    trusteeInvitations.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                        No trustee invitations recorded yet.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {trusteeInvitations.map((invitation) => (
                          <div
                            key={invitation.Id}
                            className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-4"
                          >
                            <div className="text-sm font-medium text-hush-text-primary">
                              {invitation.TrusteeDisplayName} (
                              {invitation.TrusteeUserAddress})
                            </div>
                            <div className="mt-1 text-xs text-hush-text-accent">
                              {getInvitationStatusLabel(invitation.Status)} ·
                              Sent at draft revision{" "}
                              {invitation.SentAtDraftRevision}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                      Save the draft first to create trustee invitations.
                    </div>
                  )}
                </div>
                </OwnerOverviewSection>
              </div>
            )}

            {activeOwnerTab === "readiness" && (
              <div style={{ order: 4 }}>
                <OwnerOverviewSection
              title="Ready to Open"
              description={
                usesTrusteeThreshold
                  ? "This checklist makes the trustee-threshold path explicit. You need the saved draft, accepted trustees, a ready key ceremony, and then the governed open proposal."
                  : "This checklist shows exactly what is still missing before the owner can open the election directly."
              }
              actionLabel={canEditDraft ? "Edit warning choices" : undefined}
              onAction={canEditDraft ? openWarningsOverlay : undefined}
              dataTestId="elections-open-preparation-overview"
            >
              <div
                className="mb-5 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                data-testid="elections-open-mode-profile-summary"
              >
                <div className="text-sm font-semibold">Mode and profile contract</div>
                <div className="mt-3 text-sm text-hush-text-primary">
                  {getBindingLabel(draft.BindingStatus)} election.{" "}
                  {getModeProfileFamilyLabel(draft.BindingStatus)} are valid for
                  this open path.
                </div>
                <div className="mt-2 text-sm text-hush-text-accent">
                  {selectedDraftProfile
                    ? `Selected circuit: ${selectedDraftProfile.DisplayName}. ${getModeProfileFreezeCopy(draft.BindingStatus)}`
                    : getModeProfileFreezeCopy(draft.BindingStatus)}
                </div>
              </div>

              <div
                className="mb-5 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                data-testid="elections-ready-to-open-checklist"
              >
                <div className="text-sm font-semibold">Ready-to-open checklist</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {readyToOpenChecklist.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-xl border px-4 py-3 ${
                        item.isReady
                          ? "border-green-500/30 bg-green-500/10 text-green-100"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {item.isReady ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span>{item.label}</span>
                      </div>
                      <div className="mt-2 text-sm">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedElectionId ? (
                <div className="mb-5">
                  <ProtocolPackageBindingPanel
                    binding={protocolPackageBinding}
                    fallbackStatus={
                      openReadiness?.ProtocolPackageBindingStatus ??
                      ProtocolPackageBindingStatusProto.Missing
                    }
                    fallbackMessage={openReadiness?.ProtocolPackageBindingMessage}
                    onRefresh={canEditDraft ? handleRefreshProtocolPackageBinding : undefined}
                    refreshDisabled={isSubmitting || !canEditDraft}
                    testId="elections-protocol-package-readiness"
                  />
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div
                  className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  data-testid="elections-validation-panel"
                >
                  <div className="text-sm font-semibold">Draft save checks</div>
                  {saveValidationErrors.length === 0 ? (
                    <div className="mt-3 text-sm text-green-200">
                      Draft save validations are clear.
                    </div>
                  ) : (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                      {saveValidationErrors.map((validationError) => (
                        <li key={validationError}>{validationError}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-sm font-semibold">Local open checks</div>
                  {openValidationErrors.length === 0 ? (
                    <div className="mt-3 text-sm text-green-200">
                      Local open-preparation checks are clear.
                    </div>
                  ) : (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                      {openValidationErrors.map((validationError) => (
                        <li key={validationError}>{validationError}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-sm font-semibold">
                    Acknowledged warnings in this working draft
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-hush-text-accent">
                    {WARNING_CHOICES.map((warningChoice) => (
                      <div
                        key={warningChoice.code}
                        className="flex items-start justify-between gap-3 rounded-xl border border-hush-bg-light/70 px-3 py-3"
                      >
                        <div>
                          <div className="font-medium text-hush-text-primary">
                            {warningChoice.title}
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            {warningChoice.description}
                          </div>
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-xs ${
                            draft.AcknowledgedWarningCodes.includes(
                              warningChoice.code,
                            )
                              ? "bg-green-500/15 text-green-100"
                              : "bg-hush-bg-light text-hush-text-accent"
                          }`}
                        >
                          {draft.AcknowledgedWarningCodes.includes(
                            warningChoice.code,
                          )
                            ? "Acknowledged"
                            : "Not acknowledged"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {usesTrusteeThreshold
                          ? "Governed open path"
                          : "Server open readiness"}
                      </div>
                      <div className="mt-1 text-xs text-hush-text-accent">
                        {usesTrusteeThreshold
                          ? "Direct open is disabled here. When the checklist is clear and the key ceremony is ready, start the Open proposal in Governed Actions."
                          : "This uses the current saved draft revision and the selected warning acknowledgements."}
                      </div>
                    </div>
                    {!usesTrusteeThreshold &&
                      selectedElectionId &&
                      canOpenSelectedElection && (
                      <button
                        type="button"
                        onClick={() =>
                          void loadOpenReadiness(requiredWarningCodes)
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-hush-purple"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        <span>Refresh</span>
                      </button>
                      )}
                  </div>

                  {!usesTrusteeThreshold ? (
                    selectedElectionId && openReadiness ? (
                      <div
                        className="mt-4 space-y-3"
                        data-testid="elections-open-readiness"
                      >
                        <div
                          className={`rounded-xl border px-3 py-3 text-sm ${
                            openReadiness!.IsReadyToOpen
                              ? "border-green-500/40 bg-green-500/10 text-green-100"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                          }`}
                        >
                          {openReadiness!.IsReadyToOpen
                            ? "Ready to open."
                            : "Not ready to open yet."}
                        </div>

                        <div className="text-xs text-hush-text-accent">
                          Required warning codes:{" "}
                          {openReadiness!.RequiredWarningCodes.length > 0
                            ? openReadiness!.RequiredWarningCodes.map(
                                (warningCode) => getWarningTitle(warningCode),
                              ).join(", ")
                            : "None"}
                        </div>

                        {openReadiness!.MissingWarningAcknowledgements.length >
                          0 && (
                          <div className="text-xs text-hush-text-accent">
                            Missing acknowledgements:{" "}
                            {openReadiness!.MissingWarningAcknowledgements.map(
                              (warningCode) => getWarningTitle(warningCode),
                            ).join(", ")}
                          </div>
                        )}

                        {openReadiness!.ValidationErrors.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
                            {openReadiness!.ValidationErrors.map(
                              (validationError) => (
                                <li key={validationError}>{validationError}</li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-hush-text-accent">
                        {selectedElectionId
                          ? "Save a valid admin-only draft to evaluate server open readiness."
                          : "Create the draft first to fetch server open readiness."}
                      </div>
                    )
                  ) : null}

                  {usesTrusteeThreshold ? (
                    <div
                      className="mt-4 space-y-3"
                      data-testid="elections-governed-open-readiness"
                    >
                      <div
                        className={`rounded-xl border px-3 py-3 text-sm ${
                          isGovernedOpenWorkflowReady
                            ? "border-green-500/40 bg-green-500/10 text-green-100"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                        }`}
                      >
                        {isGovernedOpenWorkflowReady
                          ? "Ready to start the governed open proposal."
                          : "Not ready to start the governed open proposal yet."}
                      </div>

                      <div className="text-xs text-hush-text-accent">
                        {governedOpenPrerequisiteIssues[0] ||
                          governedOpenActionState?.reason ||
                          "Resolve the checklist above, then use Governed Actions to start the Open proposal."}
                      </div>
                    </div>
                  ) : null}

                  <div
                    className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-xs text-hush-text-accent"
                    data-testid="elections-warning-evidence"
                  >
                    Persisted warning evidence on the selected election:{" "}
                    {warningAcknowledgements.length > 0
                      ? warningAcknowledgements
                          .map((acknowledgement) =>
                            getWarningTitle(acknowledgement.WarningCode),
                          )
                          .join(", ")
                      : "No warning acknowledgements have been read back yet."}
                  </div>
                  </div>
                </div>
                </OwnerOverviewSection>
              </div>
            )}

            {activeOwnerTab === "roster" && (
              <div style={{ order: 4 }}>
                <OwnerOverviewSection
                  title="Roster Management"
                  description="Roster import and append are managed separately from draft metadata. Open the roster manager to append voter IDs, review the restricted named roster, and handle draft-only activation work."
                  actionLabel={selectedElectionId ? "Manage roster" : undefined}
                  onAction={selectedElectionId ? openRosterOverlay : undefined}
                  dataTestId="elections-roster-overview"
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Eligibility source
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {getEligibilitySourceLabel(draft.EligibilitySourceType)}
                      </div>
                      <div className="mt-2 text-xs text-hush-text-accent">
                        Imported roster remains the named checkoff source for this
                        election.
                      </div>
                    </div>

                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Mutation policy
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {getEligibilityMutationLabel(
                          draft.EligibilityMutationPolicy,
                        )}
                      </div>
                      <div className="mt-2 text-xs text-hush-text-accent">
                        Append and activation work stay available only while the
                        election remains editable.
                      </div>
                    </div>

                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Workspace status
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {selectedElectionId
                          ? canEditDraft
                            ? "Ready for roster edits"
                            : "Read-only roster review"
                          : "Create the draft first"}
                      </div>
                      <div className="mt-2 text-xs text-hush-text-accent">
                        Roster operations are intentionally separated from the
                        draft save action.
                      </div>
                    </div>
                  </div>
                </OwnerOverviewSection>
              </div>
            )}

            {selectedElectionId && activeOwnerTab === "auditors" ? (
              <div
                className={sectionClass}
                data-testid="elections-auditor-access-overview"
                style={{ order: 4 }}
              >
                <DesignatedAuditorGrantManager
                  detail={selectedElection}
                  actorEncryptionPublicKey={ownerEncryptionPublicKey ?? ""}
                  actorEncryptionPrivateKey={ownerEncryptionPrivateKey ?? ""}
                  actorSigningPrivateKey={ownerSigningPrivateKey}
                />
              </div>
            ) : null}

            {canEditDraft && activeOwnerTab === "save" ? (
              <div style={{ order: 4 }}>
                <OwnerOverviewSection
                title="Save Current Draft"
                description="This panel applies only to the election selected on the left. It shows the latest saved revision, the status of local edits, and the single save action that turns those edits into the next draft revision."
                dataTestId="elections-draft-save-overview"
              >
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Latest saved revision
                      </div>
                      <div className="mt-2 text-sm font-medium text-hush-text-primary">
                        {draftRevisionLabel}
                      </div>
                    </div>
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Local working copy
                      </div>
                      <div className="mt-2 text-sm font-medium text-hush-text-primary">
                        {hasPendingDraftChanges
                          ? "Unsaved local edits"
                          : "No unsaved local edits"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Save status
                      </div>
                      <div className="mt-2 text-sm font-medium text-hush-text-primary">
                        {saveValidationErrors.length === 0
                          ? "Ready to save"
                          : `${saveValidationErrors.length} required item(s) missing`}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <label className="text-sm">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Revision note
                      </span>
                      <input
                        type="text"
                        value={snapshotReason}
                        onChange={(event) =>
                          setSnapshotReason(event.target.value)
                        }
                        disabled={!canEditDraft || isSubmitting}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>
                    <p className="mt-2 text-xs text-hush-text-accent">
                      This note is stored with the saved revision for the selected
                      election.
                    </p>

                    {saveValidationErrors.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        <div className="font-medium">
                          Save is blocked until these required items are completed:
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {saveValidationErrors.map((validationError) => (
                            <li key={validationError}>{validationError}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => void handleSaveDraft()}
                        disabled={
                          !snapshotReason.trim() ||
                          saveValidationErrors.length > 0 ||
                          !canEditDraft ||
                          isSubmitting
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                        data-testid="elections-save-button"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        <span>{saveButtonLabel}</span>
                      </button>
                    </div>
                    </div>
                  </div>
                </OwnerOverviewSection>
              </div>
            ) : null}

            {activeOwnerTab === "policy" && (
              <div style={{ order: 4 }}>
                <OwnerOverviewSection
              title="Draft Policy"
              description="These policy values are part of the draft itself. Edit them in one place, then save the draft when you are ready to persist the combined change set."
              actionLabel={canEditDraft ? "Edit draft policy" : undefined}
              onAction={canEditDraft ? openPolicyOverlay : undefined}
              dataTestId="elections-policy-overview"
            >
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Binding status
                  </div>
                  <div className="mt-2 text-sm font-medium text-hush-text-primary">
                    {getBindingLabel(draft.BindingStatus)}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Governance mode
                  </div>
                  <div className="mt-2 text-sm font-medium text-hush-text-primary">
                    {getGovernanceLabel(draft.GovernanceMode)}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Selected circuit
                  </div>
                  <div className="mt-2 text-sm font-medium text-hush-text-primary">
                    {selectedDraftProfile?.DisplayName || draft.SelectedProfileId || "Not set"}
                  </div>
                  <div className="mt-2 text-xs text-hush-text-accent">
                    {getSelectedProfileFamilyLabel(selectedDraftProfile?.DevOnly)}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Outcome rule
                  </div>
                  <div className="mt-2 text-sm font-medium text-hush-text-primary">
                    {getOutcomeRuleLabel(draft.OutcomeRule.Kind)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {fixedPolicyItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      {item.label}
                    </div>
                    <div className="mt-2 text-sm font-medium text-hush-text-primary">
                      {item.value}
                    </div>
                    <div className="mt-2 text-xs text-hush-text-accent">
                      {item.note}
                    </div>
                  </div>
                ))}
              </div>
                </OwnerOverviewSection>
              </div>
            )}

            {activeOwnerTab === "options" && (
              <div style={{ order: 4 }}>
                <OwnerOverviewSection
              title="Ballot Options"
              description="Candidate and option edits stay local until you save the draft. Ballot options can be added later, but at least two named options are required before the election can open."
              actionLabel={canEditDraft ? "Edit ballot options" : undefined}
              onAction={canEditDraft ? openOptionsOverlay : undefined}
              dataTestId="elections-options-overview"
            >
              {draft.OwnerOptions.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent"
                  data-testid="elections-empty-options"
                >
                  No ballot options yet. You can still save this draft now and
                  add options later, but the election cannot open until at least
                  two named options are configured.
                </div>
              ) : (
                <div className="space-y-3">
                  {draft.OwnerOptions.map((option) => (
                    <div
                      key={option.OptionId}
                      className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-hush-text-primary">
                            {option.DisplayLabel ||
                              `Option ${option.BallotOrder}`}
                          </div>
                          <div className="mt-1 text-sm text-hush-text-accent">
                            {option.ShortDescription || "No description yet."}
                          </div>
                        </div>
                        <div className="rounded-full border border-hush-bg-light px-3 py-1 text-xs text-hush-text-accent">
                          Ballot order {option.BallotOrder}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </OwnerOverviewSection>
              </div>
            )}

            {false &&
              draft.GovernanceMode ===
                ElectionGovernanceModeProto.TrusteeThreshold && (
                <section className={sectionClass}>
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Trustee Draft Setup
                      </h2>
                      <p className="mt-1 text-sm text-hush-text-accent">
                        Trustee invitations and approval-count metadata are
                        configured here; the governed `open`, `close`, and
                        `finalize` actions are handled below through proposal
                        approval.
                      </p>
                    </div>
                    <div
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                      data-testid="elections-trustee-blocked-panel"
                    >
                      Proposal approval is active for trustee-threshold
                      elections. Critical lifecycle changes now move through
                      proposal approval instead of direct buttons.
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Required Approval Count
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={draft.RequiredApprovalCount ?? 1}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            RequiredApprovalCount: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          }))
                        }
                        disabled={!canEditDraft || isSubmitting}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Accepted trustees
                      </div>
                      <div className="mt-2 text-2xl font-semibold">
                        {acceptedTrusteeCount}
                      </div>
                      <div className="mt-1 text-xs text-hush-text-accent">
                        Pending invitations: {pendingTrusteeCount}
                      </div>
                    </div>

                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Review window policy
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {getReviewWindowPolicyLabel(draft.ReviewWindowPolicy)}
                      </div>
                      <div className="mt-2 text-xs text-hush-text-accent">
                        Reserved now so governed review can inherit the frozen
                        policy boundary later.
                      </div>
                    </div>
                  </div>

                  {selectedElectionId ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <label className="text-sm">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                            Trustee User Address
                          </span>
                          <input
                            type="text"
                            value={trusteeUserAddress}
                            onChange={(event) =>
                              setTrusteeUserAddress(event.target.value)
                            }
                            disabled={!canEditDraft || isSubmitting}
                            data-testid="elections-trustee-user-address-input"
                            className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                            Trustee Display Name
                          </span>
                          <input
                            type="text"
                            value={trusteeDisplayName}
                            onChange={(event) =>
                              setTrusteeDisplayName(event.target.value)
                            }
                            disabled={!canEditDraft || isSubmitting}
                            data-testid="elections-trustee-display-name-input"
                            className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => void handleInviteTrustee()}
                            disabled={
                              !canEditDraft ||
                              isSubmitting ||
                              !trusteeUserAddress.trim() ||
                              !trusteeDisplayName.trim()
                            }
                            data-testid="elections-invite-trustee-button"
                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-hush-bg-light px-4 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            <span>Invite trustee</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {trusteeInvitations.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                            No trustee invitations recorded yet.
                          </div>
                        ) : (
                          trusteeInvitations.map((invitation) => (
                            <div
                              key={invitation.Id}
                              className="flex flex-col gap-3 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <div className="text-sm font-medium">
                                  {invitation.TrusteeDisplayName} (
                                  {invitation.TrusteeUserAddress})
                                </div>
                                <div className="mt-1 text-xs text-hush-text-accent">
                                  {getInvitationStatusLabel(invitation.Status)}{" "}
                                  • Sent at draft revision{" "}
                                  {invitation.SentAtDraftRevision}
                                </div>
                              </div>
                              {invitation.Status ===
                                ElectionTrusteeInvitationStatusProto.Pending &&
                                canEditDraft && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRevokeInvitation(invitation.Id)
                                    }
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isSubmitting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Square className="h-4 w-4" />
                                    )}
                                    <span>Revoke</span>
                                  </button>
                                )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                      Save the draft first to create trustee invitations.
                    </div>
                  )}
                </section>
              )}

            {false && (
              <section className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">
                    Validation and Warning Acknowledgement
                  </h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    Draft-save checks and pre-open checks are shown separately
                    so the owner can keep editing without guessing what still
                    blocks open.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div
                    className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                    data-testid="elections-validation-panel"
                  >
                    <div className="text-sm font-semibold">
                      Draft save checks
                    </div>
                    {saveValidationErrors.length === 0 ? (
                      <div className="mt-3 text-sm text-green-200">
                        Draft save validations are clear.
                      </div>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                        {saveValidationErrors.map((validationError) => (
                          <li key={validationError}>{validationError}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-sm font-semibold">Open checklist</div>
                    {openValidationErrors.length === 0 ? (
                      <div className="mt-3 text-sm text-green-200">
                        Local open-preparation checks are clear.
                      </div>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                        {openValidationErrors.map((validationError) => (
                          <li key={validationError}>{validationError}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-sm font-semibold">
                      Required warning choices before open
                    </div>
                    {WARNING_CHOICES.map((warningChoice) => {
                      const checked = draft.AcknowledgedWarningCodes.includes(
                        warningChoice.code,
                      );
                      return (
                        <label
                          key={warningChoice.code}
                          className="flex gap-3 rounded-xl border border-hush-bg-light px-3 py-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setDraft((current) =>
                                toggleWarningCode(
                                  current,
                                  warningChoice.code,
                                  event.target.checked,
                                ),
                              )
                            }
                            disabled={!canEditDraft || isSubmitting}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-medium">
                              {warningChoice.title}
                            </span>
                            <span className="mt-1 block text-xs text-hush-text-accent">
                              {warningChoice.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          Server open readiness
                        </div>
                        <div className="mt-1 text-xs text-hush-text-accent">
                          This uses the current saved draft revision and the
                          selected warning acknowledgements.
                        </div>
                      </div>
                      {selectedElectionId && canOpenSelectedElection && (
                        <button
                          type="button"
                          onClick={() =>
                            void loadOpenReadiness(requiredWarningCodes)
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-hush-purple"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          <span>Refresh</span>
                        </button>
                      )}
                    </div>

                    {selectedElectionId && openReadiness ? (
                      <div
                        className="mt-4 space-y-3"
                        data-testid="elections-open-readiness"
                      >
                        <div
                          className={`rounded-xl border px-3 py-3 text-sm ${
                            openReadiness!.IsReadyToOpen
                              ? "border-green-500/40 bg-green-500/10 text-green-100"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                          }`}
                        >
                          {openReadiness!.IsReadyToOpen
                            ? "Ready to open."
                            : "Not ready to open yet."}
                        </div>

                        <div className="text-xs text-hush-text-accent">
                          Required warning codes:{" "}
                          {openReadiness!.RequiredWarningCodes.length > 0
                            ? openReadiness!.RequiredWarningCodes.map(
                                (warningCode) => getWarningTitle(warningCode),
                              ).join(", ")
                            : "None"}
                        </div>

                        {openReadiness!.MissingWarningAcknowledgements.length >
                          0 && (
                          <div className="text-xs text-hush-text-accent">
                            Missing acknowledgements:{" "}
                            {openReadiness!.MissingWarningAcknowledgements.map(
                              (warningCode) => getWarningTitle(warningCode),
                            ).join(", ")}
                          </div>
                        )}

                        {openReadiness!.ValidationErrors.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
                            {openReadiness!.ValidationErrors.map(
                              (validationError) => (
                                <li key={validationError}>{validationError}</li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-hush-text-accent">
                        {selectedElectionId
                          ? "Save a valid admin-only draft to evaluate server open readiness."
                          : "Create the draft first to fetch server open readiness."}
                      </div>
                    )}

                    <div
                      className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-xs text-hush-text-accent"
                      data-testid="elections-warning-evidence"
                    >
                      Persisted warning evidence on the selected election:{" "}
                      {warningAcknowledgements.length > 0
                        ? warningAcknowledgements
                            .map((acknowledgement) =>
                              getWarningTitle(acknowledgement.WarningCode),
                            )
                            .join(", ")
                        : "No warning acknowledgements have been read back yet."}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {election?.GovernanceMode ===
              ElectionGovernanceModeProto.TrusteeThreshold &&
              activeOwnerTab === "ceremony" && (
              <div style={{ order: 4 }}>
                <ElectionCeremonyWorkspaceSection
                detail={selectedElection}
                actionView={ceremonyActionView}
                ownerPublicAddress={ownerPublicAddress}
                isSubmitting={isSubmitting}
                isLoadingCeremonyActionView={isLoadingCeremonyActionView}
                pendingSaveAlignmentMessage={
                  trusteeThresholdNeedsSaveAlignment &&
                  fixedTrusteeApprovalCount &&
                  fixedCeremonyTrusteeCount
                    ? `Save the next draft revision to persist the aligned ${fixedTrusteeApprovalCount}-of-${fixedCeremonyTrusteeCount} threshold before the ceremony can start.`
                    : null
                }
                onStart={handleStartCeremony}
                onRestart={handleRestartCeremony}
                onCompleteTrustee={handleCompleteCeremonyTrustee}
                onRecordValidationFailure={handleRecordCeremonyValidationFailure}
                />
              </div>
            )}

            {election?.GovernanceMode ===
              ElectionGovernanceModeProto.TrusteeThreshold &&
              activeOwnerTab === "finalization" && (
              <div style={{ order: 4 }}>
                <ElectionFinalizationWorkspaceSection
                detail={selectedElection}
                finalizeActionState={finalizeActionState}
                />
              </div>
            )}

            {election?.GovernanceMode ===
              ElectionGovernanceModeProto.TrusteeThreshold &&
              activeOwnerTab === "governed" && (
              <section
                className={sectionClass}
                data-testid="elections-governed-actions"
                style={{ order: 4 }}
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Governed Actions</h2>
                    <p className="mt-1 text-sm text-hush-text-accent">
                      Critical `open`, `close`, and `finalize` transitions stay
                      in this workspace while pending, failed, and unavailable
                      states remain explicit.
                    </p>
                  </div>
                  <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
                    Trustee-threshold elections use proposal approval instead of
                    direct lifecycle buttons.
                  </div>
                </div>

                {!selectedElectionId ? (
                  <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                    Save the trustee-threshold draft first to start governed
                    actions.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-3">
                    {governedActionStates.map((state) => {
                      const openWorkflowBlocked =
                        state.actionType ===
                          ElectionGovernedActionTypeProto.Open &&
                        state.status === "available" &&
                        governedOpenPrerequisiteIssues.length > 0;
                      const isCloseProposal =
                        state.actionType ===
                        ElectionGovernedActionTypeProto.Close;
                      const presentationStatus =
                        openWorkflowBlocked ? "unavailable" : state.status;
                      const resolvedReason = openWorkflowBlocked
                        ? governedOpenPrerequisiteIssues[0]
                        : state.reason;
                      const showCloseCountingSummary =
                        isCloseProposal && !!state.proposal;
                      const closeProposalIsWaitingForApprovals =
                        state.proposal?.ExecutionStatus ===
                        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals;
                      const closeProposalExecuted =
                        state.proposal?.ExecutionStatus ===
                        ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded;

                      return (
                        <article
                          key={state.actionType}
                          className="rounded-2xl bg-hush-bg-dark/80 p-4"
                          data-testid={`elections-governed-card-${state.actionType}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {getGovernedActionLabel(state.actionType)}{" "}
                                proposal
                              </div>
                              <div className="mt-1 text-xs text-hush-text-accent">
                                {state.requiredApprovalCount !== null
                                  ? `${state.approvalCount} of ${state.requiredApprovalCount} approvals recorded`
                                  : "Approval threshold not yet recorded"}
                              </div>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${getGovernedActionStatusClass(presentationStatus)}`}
                            >
                              {getGovernedActionStatusLabel(presentationStatus)}
                            </span>
                          </div>

                          <p className="mt-4 text-sm text-hush-text-accent">
                            {resolvedReason}
                          </p>

                          {state.proposal && (
                            <div className="mt-4 rounded-xl bg-hush-bg-dark px-3 py-3 text-xs text-hush-text-accent">
                              <div>
                                Proposal id:{" "}
                                <span className="font-mono text-hush-text-primary">
                                  {state.proposal.Id}
                                </span>
                              </div>
                              <div className="mt-1">
                                Created:{" "}
                                {formatTimestamp(state.proposal.CreatedAt)}
                              </div>
                              <div className="mt-1">
                                Execution state:{" "}
                                {getGovernedProposalExecutionStatusLabel(
                                  state.proposal.ExecutionStatus,
                                )}
                              </div>
                            </div>
                          )}

                          {state.approvals.length > 0 && (
                            <div className="mt-4 rounded-xl bg-hush-bg-dark px-3 py-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                                Recorded approvals
                              </div>
                              <div className="mt-3 space-y-2">
                                {state.approvals.map((approval) => (
                                  <div
                                    key={approval.Id}
                                    className="rounded-lg bg-hush-bg-element/80 px-3 py-2 text-xs text-hush-text-accent"
                                  >
                                    <div className="font-medium text-hush-text-primary">
                                      {approval.TrusteeDisplayName ||
                                        approval.TrusteeUserAddress}
                                    </div>
                                    <div className="mt-1">
                                      Approved at{" "}
                                      {formatTimestamp(approval.ApprovedAt)}
                                    </div>
                                    {approval.ApprovalNote ? (
                                      <div className="mt-1 text-hush-text-primary">
                                        Note: {approval.ApprovalNote}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {showCloseCountingSummary && (
                            <div
                              className="mt-4 rounded-xl bg-hush-bg-dark px-3 py-3"
                              data-testid="elections-governed-close-share-progress"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                                  Close-counting shares
                                </div>
                                <div className="text-xs text-hush-text-accent">
                                  {activeCloseCountingSession
                                    ? `${closeCountingAcceptedShareCount} accepted / ${closeCountingEligibleTrusteeCount} eligible trustees`
                                    : closeProposalExecuted
                                      ? "Indexing share session"
                                      : "Waiting for close threshold"}
                                </div>
                              </div>

                              <div className="mt-2 text-xs text-hush-text-accent">
                                {closeCountingReleaseEvidence
                                  ? `Aggregate tally release completed at ${formatTimestamp(closeCountingReleaseEvidence.CompletedAt)}. Release subset: ${formatTrusteeReferenceList(closeCountingReleaseEvidence.AcceptedTrustees)}.`
                                  : activeCloseCountingSession && recoverableCloseCountingFailure
                                    ? `Session status: ${getFinalizationSessionStatusLabel(activeCloseCountingSession.Status)}. Threshold is met, but none of the accepted ${activeCloseCountingSession.RequiredShareCount}-share subsets reconstruct the bound tally yet. Pending eligible trustees can still submit on this same session, and the executor retries automatically after the next accepted share.`
                                    : activeCloseCountingSession
                                      ? `Session status: ${getFinalizationSessionStatusLabel(activeCloseCountingSession.Status)}. Trustees listed below show who has already submitted the bound tally share. Threshold: ${activeCloseCountingSession.RequiredShareCount} shares.`
                                    : closeProposalExecuted
                                      ? "Close reached threshold. The server is creating the bound close-counting session now."
                                      : "Share submission does not begin until close reaches trustee threshold."}
                              </div>

                              {activeCloseCountingSession ? (
                                <div className="mt-3 space-y-2">
                                  {closeCountingTrusteeProgress.map(
                                    ({ trustee, latestShare }) => (
                                      <div
                                        key={trustee.TrusteeUserAddress}
                                        className="rounded-lg bg-hush-bg-element/80 px-3 py-2 text-xs text-hush-text-accent"
                                      >
                                        <div className="font-medium text-hush-text-primary">
                                          {trustee.TrusteeDisplayName ||
                                            trustee.TrusteeUserAddress}
                                        </div>
                                        <div className="mt-1">
                                          {latestShare
                                            ? `${getFinalizationShareStatusLabel(latestShare.Status)} at ${formatTimestamp(latestShare.SubmittedAt)}`
                                            : "Pending share submission"}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : closeProposalIsWaitingForApprovals ? (
                                <div className="mt-3 rounded-lg bg-hush-bg-element/70 px-3 py-2 text-xs text-hush-text-accent">
                                  The tally-share step stays locked until the
                                  required close approvals are recorded.
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {presentationStatus === "available" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleStartGovernedProposal(
                                    state.actionType,
                                  )
                                }
                                disabled={isSubmitting || openWorkflowBlocked}
                                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                                data-testid={`elections-governed-start-${state.actionType}`}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Lock className="h-4 w-4" />
                                )}
                                <span>Start {state.label}</span>
                              </button>
                            )}

                            {state.status === "execution_failed" &&
                              state.proposal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRetryGovernedProposal(
                                      state.proposal!.Id,
                                    )
                                  }
                                  disabled={isSubmitting}
                                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-100 transition-colors hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                  data-testid={`elections-governed-retry-${state.actionType}`}
                                >
                                  {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCcw className="h-4 w-4" />
                                  )}
                                  <span>Retry execution</span>
                                </button>
                              )}

                            {state.proposal && (
                              <Link
                                href={`/elections/${state.proposal.ElectionId}/trustee/proposal/${state.proposal.Id}`}
                                className="inline-flex items-center gap-2 rounded-xl bg-hush-bg-dark px-4 py-2 text-sm text-hush-text-primary transition-colors hover:bg-hush-bg-dark/90"
                              >
                                <span>Open trustee approval page</span>
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeOwnerTab === "lifecycle" && (
              <section className={sectionClass} style={{ order: 4 }}>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Lifecycle Controls and Frozen Policy View
                  </h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    Lifecycle state, timestamps, warning evidence, and policy
                    freeze remain visible to the owner.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canOpenSelectedElection && (
                    <button
                      type="button"
                      onClick={() => void handleOpenElection()}
                      disabled={isSubmitting || !openReadiness?.IsReadyToOpen}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                      data-testid="elections-open-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>Open election</span>
                    </button>
                  )}

                  {canCloseSelectedElection && (
                    <button
                      type="button"
                      onClick={() => void handleCloseElection()}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
                      data-testid="elections-close-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span>Close election</span>
                    </button>
                  )}

                  {canFinalizeSelectedElection && (
                    <button
                      type="button"
                      onClick={() => void handleFinalizeElection()}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
                      data-testid="elections-finalize-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>Finalize election</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Lifecycle state
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {getLifecycleLabel(election?.LifecycleState)}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Created at
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {formatTimestamp(election?.CreatedAt)}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Opened at
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {formatTimestamp(election?.OpenedAt)}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Closed / finalized
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {formatTimestamp(
                      election?.FinalizedAt !== undefined
                        ? election.FinalizedAt
                        : election?.ClosedAt,
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div
                  className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  data-testid="elections-frozen-policy"
                >
                  <div className="text-sm font-semibold">
                    Frozen policy snapshot
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Binding
                      </div>
                      <div className="mt-1 text-sm">
                        {getBindingLabel(draft.BindingStatus)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Governance
                      </div>
                      <div className="mt-1 text-sm">
                        {getGovernanceLabel(draft.GovernanceMode)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Outcome rule
                      </div>
                      <div className="mt-1 text-sm">
                        {getOutcomeRuleLabel(draft.OutcomeRule.Kind)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Review window
                      </div>
                      <div className="mt-1 text-sm">
                        {getReviewWindowPolicyLabel(draft.ReviewWindowPolicy)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Protocol Omega version
                      </div>
                      <div className="mt-1 text-sm">
                        {draft.ProtocolOmegaVersion}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Warning evidence
                      </div>
                      <div className="mt-1 text-sm">
                        {warningAcknowledgements.length > 0
                          ? warningAcknowledgements.length
                          : draft.AcknowledgedWarningCodes.length}
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-xs text-hush-text-accent"
                    data-testid="elections-warning-evidence"
                  >
                    Persisted warning evidence on the selected election:{" "}
                    {warningAcknowledgements.length > 0
                      ? warningAcknowledgements
                          .map((acknowledgement) =>
                            getWarningTitle(acknowledgement.WarningCode),
                          )
                          .join(", ")
                      : "No warning acknowledgements have been read back yet."}
                  </div>
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-sm font-semibold">
                    Boundary artifacts
                  </div>
                  {boundaryArtifacts.length === 0 ? (
                    <div className="mt-3 text-sm text-hush-text-accent">
                      No lifecycle boundary artifacts have been recorded yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {boundaryArtifacts.map((artifact) => (
                        <div
                          key={artifact.Id}
                          className="rounded-xl border border-hush-bg-light px-3 py-3"
                        >
                          <div className="text-sm font-medium">
                            {getLifecycleLabel(artifact.LifecycleState)}{" "}
                            artifact
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            Recorded {formatTimestamp(artifact.RecordedAt)} •
                            Source draft revision {artifact.SourceDraftRevision}
                          </div>
                          <div className="mt-2 text-xs text-hush-text-accent">
                            Frozen roster hash:{" "}
                            {formatArtifactValue(
                              artifact.FrozenEligibleVoterSetHash,
                            )}
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            Final tally hash:{" "}
                            {formatArtifactValue(
                              artifact.FinalEncryptedTallyHash,
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedElection?.ProtocolPackageBinding ? (
                <div className="mt-5">
                  <ProtocolPackageBindingPanel
                    binding={selectedElection.ProtocolPackageBinding}
                    mode="evidence"
                    testId="elections-protocol-package-sealed-refs"
                  />
                </div>
              ) : null}
              </section>
            )}

            {activeOverlay === "metadata" && (
              <OwnerEditorOverlay
                title="Edit metadata"
                description="Update the election identity fields in a focused editor. These changes stay local until you save the draft."
                onClose={() => setActiveOverlay(null)}
                onApply={applyMetadataChanges}
                applyLabel="Apply metadata changes"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Title
                    </span>
                    <input
                      type="text"
                      value={metadataEditor.title}
                      onChange={(event) =>
                        setMetadataEditor((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      data-testid="elections-title-input"
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      External reference code
                    </span>
                    <input
                      type="text"
                      value={metadataEditor.externalReferenceCode}
                      onChange={(event) =>
                        setMetadataEditor((current) => ({
                          ...current,
                          externalReferenceCode: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                    />
                  </label>

                  <label className="text-sm md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Short description
                    </span>
                    <textarea
                      value={metadataEditor.shortDescription}
                      onChange={(event) =>
                        setMetadataEditor((current) => ({
                          ...current,
                          shortDescription: event.target.value,
                        }))
                      }
                      rows={5}
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                    />
                  </label>
                </div>
              </OwnerEditorOverlay>
            )}

            {activeOverlay === "policy" && (
              <OwnerEditorOverlay
                title="Edit draft policy"
                description="Update the policy fields that belong to the working draft. The overview will refresh immediately, but nothing is persisted until you save the draft."
                onClose={() => setActiveOverlay(null)}
                onApply={applyPolicyChanges}
                applyLabel="Apply policy changes"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Binding status
                    </span>
                    <select
                      value={policyEditor.bindingStatus}
                      onChange={(event) => {
                        const nextBindingStatus = Number(
                          event.target.value,
                        ) as ElectionBindingStatusProto;
                        setPolicyEditor((current) => ({
                          ...current,
                          bindingStatus: nextBindingStatus,
                          selectedProfileId: coerceSelectedCeremonyProfileId(
                            nextBindingStatus,
                            current.governanceMode,
                            current.selectedProfileId,
                            getAllowedCeremonyProfiles(
                              selectedElection ?? null,
                              undefined,
                              current.governanceMode,
                            ),
                          ),
                        }));
                      }}
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                    >
                      {BINDING_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-accent md:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Mode and profile freeze
                    </div>
                    <p
                      className="mt-2 leading-6 text-hush-text-primary"
                      data-testid="elections-policy-mode-freeze-note"
                    >
                      {getModeProfileFreezeCopy(policyEditor.bindingStatus)}
                    </p>
                    <p className="mt-2 text-xs text-hush-text-accent">
                      FEAT-105 keeps the existing draft workflow, but the election mode and selected circuit/profile must be settled before the election opens.
                    </p>
                  </div>

                  <label className="text-sm md:col-span-3">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Circuit / profile
                    </span>
                    <select
                      value={coerceSelectedCeremonyProfileId(
                        policyEditor.bindingStatus,
                        policyEditor.governanceMode,
                        policyEditor.selectedProfileId,
                        compatiblePolicyEditorProfiles,
                      )}
                      onChange={(event) =>
                        setPolicyEditor((current) => ({
                          ...current,
                          selectedProfileId: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                      data-testid="elections-policy-profile-select"
                    >
                      {compatiblePolicyEditorProfiles.map((profile) => (
                        <option key={profile.ProfileId} value={profile.ProfileId}>
                          {profile.DisplayName}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 rounded-2xl bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-accent">
                      <div className="text-hush-text-primary">
                        {selectedPolicyEditorProfile?.Description ||
                          "Select the circuit/profile that this election will freeze before open."}
                      </div>
                      <div className="mt-2 text-xs text-hush-text-accent">
                        {selectedPolicyEditorProfile
                          ? `Selected family: ${getSelectedProfileFamilyLabel(selectedPolicyEditorProfile.DevOnly)}.`
                          : "A selected circuit/profile is required before save and open."}
                      </div>
                    </div>
                  </label>

                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Governance mode
                    </span>
                    <select
                      value={policyEditor.governanceMode}
                      onChange={(event) => {
                        const nextGovernanceMode = Number(
                          event.target.value,
                        ) as ElectionGovernanceModeProto;
                        setPolicyEditor((current) => ({
                          ...current,
                          governanceMode: nextGovernanceMode,
                          selectedProfileId: coerceSelectedCeremonyProfileId(
                            current.bindingStatus,
                            nextGovernanceMode,
                            current.selectedProfileId,
                            getAllowedCeremonyProfiles(
                              selectedElection ?? null,
                              undefined,
                              nextGovernanceMode,
                            ),
                          ),
                        }));
                      }}
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                    >
                      {GOVERNANCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Outcome rule
                    </span>
                    <select
                      value={policyEditor.outcomeRuleKind}
                      onChange={(event) =>
                        setPolicyEditor((current) => ({
                          ...current,
                          outcomeRuleKind: Number(
                            event.target.value,
                          ) as OutcomeRuleKindProto,
                        }))
                      }
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                    >
                      {OUTCOME_RULE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </OwnerEditorOverlay>
            )}

            {activeOverlay === "options" && (
              <OwnerEditorOverlay
                title="Edit ballot options"
                description="Add, rename, reorder, or remove ballot options. These edits update the local working draft until you save it."
                onClose={() => setActiveOverlay(null)}
                onApply={applyOptionsChanges}
                applyLabel="Apply option changes"
                maxWidthClass="max-w-5xl"
              >
                <div className="space-y-4">
                  {optionsEditor.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                      No ballot options yet. Add your first option below.
                    </div>
                  ) : (
                    optionsEditor.map((option, index) => (
                      <div
                        key={option.OptionId}
                        className={index === 0 ? "pb-1" : "border-t border-hush-bg-light/60 pt-5 pb-1"}
                      >
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                          <label className="text-sm">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Option label
                            </span>
                            <input
                              type="text"
                              value={option.DisplayLabel}
                              onChange={(event) =>
                                setOptionsEditor((current) =>
                                  current.map((currentOption, currentIndex) =>
                                    currentIndex === index
                                      ? {
                                          ...currentOption,
                                          DisplayLabel: event.target.value,
                                        }
                                      : currentOption,
                                  ),
                                )
                              }
                              data-testid={`elections-option-label-${index}`}
                              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                            />
                          </label>

                          <label className="text-sm">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Short description
                            </span>
                            <input
                              type="text"
                              value={option.ShortDescription}
                              onChange={(event) =>
                                setOptionsEditor((current) =>
                                  current.map((currentOption, currentIndex) =>
                                    currentIndex === index
                                      ? {
                                          ...currentOption,
                                          ShortDescription: event.target.value,
                                        }
                                      : currentOption,
                                  ),
                                )
                              }
                              data-testid={`elections-option-description-${index}`}
                              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple"
                            />
                          </label>

                          <div className="flex items-end justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOptionsEditorMove(index, -1)}
                              disabled={index === 0}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-hush-bg-light text-hush-text-accent transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Move option ${index + 1} up`}
                            >
                              <MoveUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOptionsEditorMove(index, 1)}
                              disabled={index === optionsEditor.length - 1}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-hush-bg-light text-hush-text-accent transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Move option ${index + 1} down`}
                            >
                              <MoveDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOptionsEditorRemove(index)}
                              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-500/40 px-3 text-sm text-red-100 transition-colors hover:border-red-400"
                            >
                              <Square className="h-4 w-4" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={handleOptionsEditorAdd}
                    className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add option</span>
                  </button>
                </div>
              </OwnerEditorOverlay>
            )}

            {activeOverlay === "warnings" && (
              <OwnerEditorOverlay
                title="Edit warning choices"
                description="Acknowledge or clear warning evidence for the working draft. Save the draft afterward to persist the selected acknowledgements."
                onClose={() => setActiveOverlay(null)}
                onApply={applyWarningChoiceChanges}
                applyLabel="Apply warning changes"
              >
                <div className="space-y-3">
                  {WARNING_CHOICES.map((warningChoice) => {
                    const checked = warningChoicesEditor.includes(
                      warningChoice.code,
                    );
                    return (
                      <label
                        key={warningChoice.code}
                        className="flex gap-3 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-4 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setWarningChoicesEditor((current) =>
                              event.target.checked
                                ? [
                                    ...new Set([
                                      ...current,
                                      warningChoice.code,
                                    ]),
                                  ].sort((left, right) => left - right)
                                : current.filter(
                                    (code) => code !== warningChoice.code,
                                  ),
                            )
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium text-hush-text-primary">
                            {warningChoice.title}
                          </span>
                          <span className="mt-1 block text-xs text-hush-text-accent">
                            {warningChoice.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </OwnerEditorOverlay>
            )}

            {activeOverlay === "trustees" && (
              <OwnerEditorOverlay
                title="Edit trustee setup"
                description="Manage the approval threshold and trustee invitations from a focused overlay. Draft-backed changes stay local; invitation actions still submit immediately."
                onClose={() => setActiveOverlay(null)}
                onApply={applyTrusteeDraftChanges}
                applyLabel="Apply trustee changes"
                maxWidthClass="max-w-5xl"
              >
                <div className="space-y-5">
                  <label className="block text-sm max-w-xs">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Required approval count
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={trusteeApprovalEditor}
                      onChange={(event) =>
                        setTrusteeApprovalEditor(
                          Math.max(1, Number(event.target.value) || 1),
                        )
                      }
                      readOnly={!!fixedTrusteeApprovalCount}
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple read-only:cursor-default read-only:opacity-80"
                    />
                    <span className="mt-2 block text-xs text-hush-text-accent">
                      {fixedTrusteeApprovalCount && fixedCeremonyTrusteeCount
                        ? `The current ceremony rollout is fixed to ${fixedTrusteeApprovalCount}-of-${fixedCeremonyTrusteeCount}, so this threshold stays aligned with the allowed trustee model.`
                        : "Choose how many accepted trustees are required for the trustee-threshold path."}
                    </span>
                  </label>

                  {selectedElectionId ? (
                    <>
                      <div className="space-y-4 rounded-2xl bg-hush-bg-dark/40 p-4">
                        <div>
                          <div className="text-sm font-semibold text-hush-text-primary">
                            Search Hush accounts
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            Search by profile name and invite the trustee
                            directly from the matching account.
                          </div>
                        </div>

                        <form
                          className="flex flex-col gap-3 lg:flex-row"
                          onSubmit={(event) =>
                            void handleSearchTrusteeCandidates(event)
                          }
                        >
                          <label className="min-w-0 flex-1 text-sm">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Trustee search
                            </span>
                            <input
                              type="text"
                              value={trusteeSearchQuery}
                              onChange={(event) =>
                                setTrusteeSearchQuery(event.target.value)
                              }
                              disabled={!canEditDraft || isSubmitting}
                              data-testid="elections-trustee-search-input"
                              placeholder="Profile or display name"
                              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </label>
                          <div className="flex items-end gap-2">
                            <button
                              type="submit"
                              disabled={
                                !canEditDraft ||
                                isSubmitting ||
                                isSearchingTrustees ||
                                !trusteeSearchQuery.trim()
                              }
                              data-testid="elections-search-trustees-button"
                              className="inline-flex h-11 items-center gap-2 rounded-xl bg-hush-purple px-4 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                            >
                              {isSearchingTrustees ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                              <span>Search</span>
                            </button>
                            {(trusteeSearchQuery ||
                              trusteeSearchResults.length > 0 ||
                              hasSearchedTrustees) && (
                              <button
                                type="button"
                                onClick={clearTrusteeCandidateSearch}
                                disabled={isSubmitting || isSearchingTrustees}
                                data-testid="elections-clear-trustee-search-button"
                                className="inline-flex h-11 items-center gap-2 rounded-xl border border-hush-bg-light px-4 text-sm text-hush-text-accent transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                                <span>Clear</span>
                              </button>
                            )}
                          </div>
                        </form>

                        {hasSearchedTrustees &&
                        trusteeSearchResults.length === 0 &&
                        !isSearchingTrustees ? (
                          <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-element/60 px-4 py-4 text-sm text-hush-text-accent">
                            No Hush accounts matched this search.
                          </div>
                        ) : null}

                        {trusteeSearchResults.length > 0 ? (
                          <div className="space-y-3">
                            {trusteeSearchResults.map((candidate) => {
                              const candidateLabel =
                                candidate.DisplayName.trim() ||
                                candidate.PublicSigningAddress;
                              const restrictionReason =
                                getTrusteeCandidateRestrictionReason(candidate);

                              return (
                                <div
                                  key={candidate.PublicSigningAddress}
                                  className="rounded-xl border border-hush-bg-light bg-hush-bg-element/60 px-4 py-4"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-hush-text-primary">
                                        {candidateLabel}
                                      </div>
                                      <div className="mt-1 break-all text-xs text-hush-text-accent">
                                        {candidate.PublicSigningAddress}
                                      </div>
                                      <div className="mt-2 text-xs text-hush-text-accent">
                                        Encrypt address:{" "}
                                        {candidate.PublicEncryptAddress ||
                                          "Not published"}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleInviteTrusteeFromSearch(
                                          candidate,
                                        )
                                      }
                                      disabled={
                                        !canEditDraft ||
                                        isSubmitting ||
                                        Boolean(restrictionReason)
                                      }
                                      aria-label={`Invite trustee ${candidateLabel}`}
                                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                                    >
                                      {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Plus className="h-4 w-4" />
                                      )}
                                      <span>Invite trustee</span>
                                    </button>
                                  </div>

                                  {restrictionReason ? (
                                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                      {restrictionReason}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-4 rounded-2xl bg-hush-bg-dark/40 p-4">
                        <div>
                          <div className="text-sm font-semibold text-hush-text-primary">
                            Manual invite fallback
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            Use direct address entry only if the trustee cannot
                            be found in search.
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                          <label className="text-sm">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Trustee user address
                            </span>
                            <input
                              type="text"
                              value={trusteeUserAddress}
                              onChange={(event) =>
                                setTrusteeUserAddress(event.target.value)
                              }
                              disabled={!canEditDraft || isSubmitting}
                              data-testid="elections-trustee-user-address-input"
                              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </label>
                          <label className="text-sm">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Trustee display name
                            </span>
                            <input
                              type="text"
                              value={trusteeDisplayName}
                              onChange={(event) =>
                                setTrusteeDisplayName(event.target.value)
                              }
                              disabled={!canEditDraft || isSubmitting}
                              data-testid="elections-trustee-display-name-input"
                              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </label>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => void handleInviteTrustee()}
                              disabled={
                                !canEditDraft ||
                                isSubmitting ||
                                !trusteeUserAddress.trim() ||
                                !trusteeDisplayName.trim()
                              }
                              data-testid="elections-invite-trustee-button"
                              className="inline-flex h-11 items-center gap-2 rounded-xl border border-hush-bg-light px-4 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              <span>Invite trustee</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {trusteeInvitations.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                            No trustee invitations recorded yet.
                          </div>
                        ) : (
                          trusteeInvitations.map((invitation) => (
                            <div
                              key={invitation.Id}
                              className="flex flex-col gap-3 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <div className="text-sm font-medium text-hush-text-primary">
                                  {invitation.TrusteeDisplayName} (
                                  {invitation.TrusteeUserAddress})
                                </div>
                                <div className="mt-1 text-xs text-hush-text-accent">
                                  {getInvitationStatusLabel(invitation.Status)}{" "}
                                  · Sent at draft revision{" "}
                                  {invitation.SentAtDraftRevision}
                                </div>
                              </div>
                              {invitation.Status ===
                                ElectionTrusteeInvitationStatusProto.Pending &&
                                canEditDraft && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRevokeInvitation(invitation.Id)
                                    }
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isSubmitting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Square className="h-4 w-4" />
                                    )}
                                    <span>Revoke</span>
                                  </button>
                                )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                      Save the draft first to create trustee invitations.
                    </div>
                  )}
                </div>
              </OwnerEditorOverlay>
            )}

            {activeOverlay === "roster" && selectedElectionId && (
              <OwnerEditorOverlay
                title="Roster manager"
                description="Import or append roster rows, review the restricted named roster, and perform draft-only activation work here. These roster operations remain separate from the draft save action above."
                onClose={() => setActiveOverlay(null)}
                maxWidthClass="max-w-6xl"
              >
                <ElectionEligibilityWorkspaceSection
                  electionId={selectedElectionId}
                  detail={selectedElection}
                  actorPublicAddress={ownerPublicAddress}
                  actorEncryptionPublicKey={ownerEncryptionPublicKey ?? ""}
                  actorEncryptionPrivateKey={ownerEncryptionPrivateKey ?? ""}
                  actorSigningPrivateKey={ownerSigningPrivateKey}
                  embedded
                  onContextChanged={() => loadElection(selectedElectionId)}
                />
              </OwnerEditorOverlay>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
