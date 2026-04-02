"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { GetElectionResponse, Identity } from '@/lib/grpc';
import { ElectionTrusteeInvitationStatusProto } from '@/lib/grpc';
import { identityService } from '@/lib/grpc/services/identity';
import { Loader2, RefreshCw, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useElectionsStore } from './useElectionsStore';

type DesignatedAuditorGrantManagerProps = {
  detail: GetElectionResponse | null;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

type ResolvedGrantIdentity = {
  profileName: string;
  associatedId: string;
};

type DisplayGrantIdentity =
  | string
  | {
      profileName: string;
      associatedId: string;
    };

function abbreviateAssociatedId(value: string): string {
  if (value.length <= 9) {
    return value;
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

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
  const [grantIdentityLookup, setGrantIdentityLookup] = useState<Record<string, ResolvedGrantIdentity>>({});
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
  const grantIdentityAddresses = useMemo(() => {
    const addresses = new Set<string>();

    reportAccessGrants.forEach((grant) => {
      if (grant.ActorPublicAddress) {
        addresses.add(grant.ActorPublicAddress);
      }

      if (grant.GrantedByPublicAddress) {
        addresses.add(grant.GrantedByPublicAddress);
      }
    });

    return Array.from(addresses);
  }, [reportAccessGrants]);
  const electionId = detail?.Election?.ElectionId;

  useEffect(() => {
    let isActive = true;

    if (grantIdentityAddresses.length === 0) {
      setGrantIdentityLookup({});
      return () => {
        isActive = false;
      };
    }

    void (async () => {
      const resolvedEntries = await Promise.all(
        grantIdentityAddresses.map(async (address) => {
          const identity = await identityService.getIdentity(address);
          return { address, identity };
        })
      );

      if (!isActive) {
        return;
      }

      const nextLookup: Record<string, ResolvedGrantIdentity> = {};

      resolvedEntries.forEach(({ address, identity }) => {
        const profileName = identity.ProfileName.trim();
        if (!identity.Successfull || !profileName) {
          return;
        }

        nextLookup[address] = {
          profileName,
          associatedId: identity.PublicSigningAddress || address,
        };
      });

      setGrantIdentityLookup(nextLookup);
    })();

    return () => {
      isActive = false;
    };
  }, [grantIdentityAddresses]);

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

  const formatResolvedIdentity = (address: string): DisplayGrantIdentity => {
    const resolvedIdentity = grantIdentityLookup[address];
    if (!resolvedIdentity) {
      return address;
    }

    return {
      profileName: resolvedIdentity.profileName,
      associatedId: abbreviateAssociatedId(resolvedIdentity.associatedId),
    };
  };

  return (
    <section
      className="space-y-4"
      data-testid="designated-auditor-grant-manager"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
          Designated-auditor access
        </h2>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-hush-text-primary md:text-xl">
            Manage auditor access
          </h3>
          {electionId ? (
            <button
              type="button"
              onClick={() =>
                void loadReportAccessGrants(
                  actorPublicAddress ?? detail?.Election?.OwnerPublicAddress ?? '',
                  electionId
                )
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hush-text-accent transition-colors hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              aria-label="Refresh auditor grants"
              title="Refresh auditor grants"
            >
              {isLoadingReportAccessGrants ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
        <p className="text-sm text-hush-text-accent">
          Saved grants take effect on the next read and remain irreversible in v1.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-hush-text-primary">Current grants</div>
            <div className="mt-1 text-xs text-hush-text-accent">
              {isLoadingReportAccessGrants
                ? 'Refreshing grants...'
                : `${reportAccessGrants.length} designated auditor(s)`}
            </div>
          </div>

          {!canManageReportAccessGrants && reportAccessGrantDeniedReason ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              {reportAccessGrantDeniedReason}
            </div>
          ) : null}

          <div className="space-y-4">
            {reportAccessGrants.length === 0 ? (
              <div className="text-sm text-hush-text-accent">
                No designated auditors have been added yet.
              </div>
            ) : (
              reportAccessGrants.map((grant, index) => {
                const actorIdentity = formatResolvedIdentity(grant.ActorPublicAddress);
                const grantedByIdentity = formatResolvedIdentity(grant.GrantedByPublicAddress);

                return (
                  <div
                    key={grant.Id}
                    className={index === 0 ? 'space-y-2' : 'border-t border-hush-bg-light/70 pt-4'}
                  >
                  <div className="flex items-center gap-2 text-sm font-semibold text-hush-text-primary">
                    <ShieldCheck className="h-4 w-4 text-green-300" />
                    <div className="min-w-0">
                      {typeof actorIdentity === 'string' ? (
                        <span className="break-all">{actorIdentity}</span>
                      ) : (
                        <div className="flex min-w-0 items-baseline gap-2">
                          <div className="break-words">{actorIdentity.profileName}</div>
                          <span className="shrink-0 text-xs font-normal text-hush-text-accent">
                            ({actorIdentity.associatedId})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 break-all text-xs text-hush-text-accent">
                    {typeof grantedByIdentity === 'string' ? (
                      <>Granted by {grantedByIdentity}</>
                    ) : (
                      <>
                        Granted by {grantedByIdentity.profileName}{' '}
                        <span className="text-[11px]">({grantedByIdentity.associatedId})</span>
                      </>
                    )}
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <form className="flex flex-col gap-3" onSubmit={handleSearch}>
            <label className="text-sm font-semibold text-hush-text-primary" htmlFor="auditor-search">
              Search Hush accounts
            </label>
            <div className="flex gap-2">
              <input
                id="auditor-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-hush-bg-light bg-hush-bg-element px-4 py-2 text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
                placeholder="Handle or name"
              />
              <button
                type="submit"
                disabled={!canManageReportAccessGrants || isSearchingGrantCandidates}
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
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
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {grantSearchError || reportAccessGrantDeniedReason}
            </div>
          ) : null}

          {grantSearchQuery ? (
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">
                Search results for {grantSearchQuery}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  clearGrantCandidateSearch();
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-hush-text-accent transition-colors hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          ) : null}

          <div className="space-y-4">
            {grantSearchQuery && grantSearchResults.length === 0 && !isSearchingGrantCandidates ? (
              <div className="text-sm text-hush-text-accent">
                No Hush identities matched this search.
              </div>
            ) : null}

            {grantSearchResults.map((candidate, index) => {
              const restrictionReason = getCandidateRestrictionReason(
                candidate,
                detail,
                existingGrantAddresses
              );

              return (
                <div
                  key={candidate.PublicSigningAddress}
                  className={index === 0 ? 'space-y-3' : 'border-t border-hush-bg-light/70 pt-4'}
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
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
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
