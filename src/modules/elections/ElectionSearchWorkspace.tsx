"use client";

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Search } from 'lucide-react';
import type { ElectionSummary, Identity } from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';
import { getLifecycleLabel } from './contracts';

type ElectionDiscoveryResult = {
  election: ElectionSummary;
  ownerDisplayName: string;
};

function abbreviateAddress(address: string): string {
  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

export function ElectionSearchWorkspace() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ElectionDiscoveryResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setHasSearched(false);
      setError('Enter an election title or owner alias to search.');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const ownerLookup = new Map<string, Identity>();
      try {
        const identityResponse = await identityService.searchByDisplayName(normalizedQuery);
        for (const identity of identityResponse.Identities ?? []) {
          if (!ownerLookup.has(identity.PublicSigningAddress)) {
            ownerLookup.set(identity.PublicSigningAddress, identity);
          }
        }
      } catch {
        // Title search should remain available even when alias lookup is unavailable.
      }

      const directoryResponse = await electionsService.searchElectionDirectory({
        SearchTerm: normalizedQuery,
        OwnerPublicAddresses: Array.from(ownerLookup.keys()),
        Limit: 12,
      });

      if (!directoryResponse.Success) {
        throw new Error(directoryResponse.ErrorMessage || 'Failed to search elections.');
      }

      const dedupedResults = new Map<string, ElectionDiscoveryResult>();
      for (const election of directoryResponse.Elections ?? []) {
        dedupedResults.set(election.ElectionId, {
          election,
          ownerDisplayName: ownerLookup.get(election.OwnerPublicAddress)?.DisplayName ?? '',
        });
      }

      setResults(Array.from(dedupedResults.values()));
      setHasSearched(true);
    } catch (searchError) {
      setResults([]);
      setHasSearched(true);
      setError(searchError instanceof Error ? searchError.message : 'Failed to search elections.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-hush-text-accent">
            Protocol Omega
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-hush-text-primary">Search Election</h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Find an election by title or owner alias, then open the eligibility route to claim-link
            your organization voter identifier with the temporary code.
          </p>
        </div>

        <section className="flex flex-col gap-5" data-testid="election-search-workspace">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                Election Discovery
              </div>
              <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
                Search before claim-linking
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                HushVoting! Hub only lists elections already linked to this Hush account. Search
                here first, then continue into eligibility to attach the roster identity.
              </p>
            </div>

            <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3 text-xs text-hush-text-accent">
              Temporary code: <span className="font-mono text-hush-text-primary">1111</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              className="block text-sm font-medium text-hush-text-primary"
              htmlFor="election-search-input"
            >
              Find an election
            </label>
            <div className="mt-2 flex flex-col gap-3 md:flex-row">
              <input
                id="election-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Election title or owner alias"
                className="min-w-0 flex-1 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-primary outline-none transition-colors placeholder:text-hush-text-accent focus:border-hush-purple focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
                aria-label="Search elections"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-hush-purple px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:bg-hush-purple/60"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>{isSearching ? 'Searching...' : 'Search elections'}</span>
              </button>
            </div>
          </form>

          <div className="text-xs text-hush-text-accent">
            Open a result to enter the organization voter ID, confirm with{' '}
            <span className="font-mono text-hush-text-primary">1111</span>, and attach that
            election to your HushVoting! Hub.
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
              {error}
            </div>
          ) : null}

          {isSearching ? (
            <div className="flex items-center gap-3 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3 text-sm text-hush-text-accent">
              <Loader2 className="h-4 w-4 animate-spin text-hush-purple" />
              <span>Searching the election directory...</span>
            </div>
          ) : null}

          {!isSearching && results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result) => (
                <button
                  key={result.election.ElectionId}
                  type="button"
                  className="flex w-full items-start justify-between gap-4 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-4 text-left transition-colors hover:border-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
                  onClick={() => router.push(`/elections/${result.election.ElectionId}/eligibility`)}
                >
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      {result.election.Title || result.election.ElectionId}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-hush-text-accent">
                      {getLifecycleLabel(result.election.LifecycleState)}
                    </div>
                    <div className="mt-2 text-sm text-hush-text-accent">
                      Owner:{' '}
                      <span className="text-hush-text-primary">
                        {result.ownerDisplayName || abbreviateAddress(result.election.OwnerPublicAddress)}
                      </span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-hush-purple">
                    <span>Open eligibility</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!isSearching && hasSearched && results.length === 0 && !error ? (
            <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3 text-sm text-hush-text-accent">
              No elections matched that title or owner alias.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
