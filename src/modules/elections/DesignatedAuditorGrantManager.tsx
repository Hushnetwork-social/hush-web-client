"use client";

import { FormEvent, useMemo, useState } from 'react';
import type { GetElectionResponse, Identity } from '@/lib/grpc';
import { ElectionTrusteeInvitationStatusProto } from '@/lib/grpc';
import { Loader2, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useElectionsStore } from './useElectionsStore';

type DesignatedAuditorGrantManagerProps = {
  detail: GetElectionResponse | null;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

function getCandidateRestrictionReason(
  candidate: Identity,
  detail: GetElectionResponse | null,
  existingGrantAddresses: Set<string>
): string | null {
  const ownerPublicAddress = detail?.Election?.OwnerPublicAddress;
  if (candidate.PublicSigningAddress === ownerPublicAddress) {
    return 'Owner/admin accounts cannot grant themselves auditor access.';
  }

  const acceptedTrusteeAddresses = new Set(
    (detail?.TrusteeInvitations ?? [])
      .filter((invitation) => invitation.Status === ElectionTrusteeInvitationStatusProto.Accepted)
      .map((invitation) => invitation.TrusteeUserAddress)
  );

  if (acceptedTrusteeAddresses.has(candidate.PublicSigningAddress)) {
    return 'Accepted trustees cannot also be designated auditors on the same election.';
  }

  if (existingGrantAddresses.has(candidate.PublicSigningAddress)) {
    return 'This account already has designated-auditor access for this election.';
  }

  return null;
}

export function DesignatedAuditorGrantManager({
  detail,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: DesignatedAuditorGrantManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    actorPublicAddress,
    canManageReportAccessGrants,
    createReportAccessGrant,
    grantSearchError,
    grantSearchQuery,
    grantSearchResults,
    isLoadingReportAccessGrants,
    isSearchingGrantCandidates,
    isSubmitting,
    loadReportAccessGrants,
    reportAccessGrantDeniedReason,
    reportAccessGrants,
    searchGrantCandidates,
    clearGrantCandidateSearch,
  } = useElectionsStore();

  const existingGrantAddresses = useMemo(
    () => new Set(reportAccessGrants.map((grant) => grant.ActorPublicAddress)),
    [reportAccessGrants]
  );
  const electionId = detail?.Election?.ElectionId;

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await searchGrantCandidates(searchQuery);
  };

  const handleGrant = async (candidate: Identity) => {
    await createReportAccessGrant(
      candidate.PublicSigningAddress,
      actorEncryptionPublicKey,
      actorEncryptionPrivateKey,
      actorSigningPrivateKey
    );
  };

  return (
    <section
      className="rounded-3xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10"
      data-testid="designated-auditor-grant-manager"
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
          Designated-auditor access
        </div>
        <h3 className="text-xl font-semibold text-hush-text-primary">Manage auditor access</h3>
        <p className="text-sm text-hush-text-accent">
          Saved grants take effect on the next read and remain irreversible in v1.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-hush-text-primary">Current grants</div>
              <div className="mt-1 text-xs text-hush-text-accent">
                {isLoadingReportAccessGrants
                  ? 'Refreshing grants...'
                  : `${reportAccessGrants.length} designated auditor(s)`}
              </div>
            </div>
            {electionId ? (
              <button
                type="button"
                onClick={() =>
                  void loadReportAccessGrants(
                    actorPublicAddress ?? detail?.Election?.OwnerPublicAddress ?? '',
                    electionId
                  )
                }
                className="rounded-xl border border-hush-bg-light px-3 py-2 text-xs text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple"
              >
                Refresh
              </button>
            ) : null}
          </div>

          {!canManageReportAccessGrants && reportAccessGrantDeniedReason ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              {reportAccessGrantDeniedReason}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {reportAccessGrants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-hush-bg-light p-4 text-sm text-hush-text-accent">
                No designated auditors have been added yet.
              </div>
            ) : (
              reportAccessGrants.map((grant) => (
                <div
                  key={grant.Id}
                  className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/80 p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-hush-text-primary">
                    <ShieldCheck className="h-4 w-4 text-green-300" />
                    <span>{grant.ActorPublicAddress}</span>
                  </div>
                  <div className="mt-2 text-xs text-hush-text-accent">
                    Granted by {grant.GrantedByPublicAddress}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4">
          <form className="flex flex-col gap-3" onSubmit={handleSearch}>
            <label className="text-sm font-semibold text-hush-text-primary" htmlFor="auditor-search">
              Search Hush accounts
            </label>
            <div className="flex gap-2">
              <input
                id="auditor-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-hush-bg-light bg-hush-bg-element px-4 py-2 text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                placeholder="Handle or name"
              />
              <button
                type="submit"
                disabled={!canManageReportAccessGrants || isSearchingGrantCandidates}
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
              >
                {isSearchingGrantCandidates ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>Search</span>
              </button>
            </div>
          </form>

          {(grantSearchError || reportAccessGrantDeniedReason) && canManageReportAccessGrants ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {grantSearchError || reportAccessGrantDeniedReason}
            </div>
          ) : null}

          {grantSearchQuery ? (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">
                Search results for {grantSearchQuery}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  clearGrantCandidateSearch();
                }}
                className="inline-flex items-center gap-1 text-xs text-hush-text-accent transition-colors hover:text-hush-purple"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {grantSearchQuery && grantSearchResults.length === 0 && !isSearchingGrantCandidates ? (
              <div className="rounded-2xl border border-dashed border-hush-bg-light p-4 text-sm text-hush-text-accent">
                No Hush identities matched this search.
              </div>
            ) : null}

            {grantSearchResults.map((candidate) => {
              const restrictionReason = getCandidateRestrictionReason(
                candidate,
                detail,
                existingGrantAddresses
              );

              return (
                <div
                  key={candidate.PublicSigningAddress}
                  className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/80 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-hush-text-primary">
                        {candidate.DisplayName}
                      </div>
                      <div className="mt-1 break-all text-xs text-hush-text-accent">
                        {candidate.PublicSigningAddress}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleGrant(candidate)}
                      disabled={Boolean(restrictionReason) || isSubmitting || !canManageReportAccessGrants}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      <span>Add auditor</span>
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-hush-text-accent">
                    Encrypt address: {candidate.PublicEncryptAddress}
                  </div>

                  {restrictionReason ? (
                    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                      {restrictionReason}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
