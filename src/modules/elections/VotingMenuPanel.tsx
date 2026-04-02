"use client";

import { PlusCircle, Search, Vote } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores';
import { VOTING_HOME_ROUTE } from '@/lib/navigation/appRoutes';

interface VotingMenuPanelProps {
  guestMode?: boolean;
  onGuestAction?: () => void;
}

export function VotingMenuPanel({
  guestMode = false,
  onGuestAction,
}: VotingMenuPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);
  const activeView =
    pathname.startsWith('/elections/owner')
      ? 'create'
      : pathname.startsWith('/elections/search')
        ? 'search'
        : 'hub';

  const getButtonClassName = (isSelected: boolean) =>
    `w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
      isSelected
        ? 'bg-hush-purple font-semibold text-hush-bg-dark'
        : 'border border-hush-bg-light text-hush-text-primary hover:border-hush-purple hover:text-hush-purple'
    }`;

  return (
    <div className="p-2 space-y-3" data-testid="voting-menu-panel">
      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
          HushVoting! Menu
        </p>
        <p className="mt-2 text-sm text-hush-text-accent">
          Keep linked elections in view, search before claim-linking, or jump straight into election creation.
        </p>
      </div>

      <button
        type="button"
        data-testid="voting-menu-hub"
        onClick={() => {
          if (guestMode) {
            onGuestAction?.();
            return;
          }

          setSelectedNav('open-voting');
          router.push(VOTING_HOME_ROUTE);
        }}
        aria-disabled={guestMode}
        className={getButtonClassName(activeView === 'hub')}
      >
        <span className="inline-flex items-center gap-2">
          <Vote className="h-4 w-4" />
          <span>Election Hub</span>
        </span>
      </button>

      <button
        type="button"
        data-testid="voting-menu-search"
        onClick={() => {
          if (guestMode) {
            onGuestAction?.();
            return;
          }

          setSelectedNav('open-voting');
          router.push('/elections/search');
        }}
        aria-disabled={guestMode}
        className={getButtonClassName(activeView === 'search')}
      >
        <span className="inline-flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search Election</span>
        </span>
      </button>

      <button
        type="button"
        data-testid="voting-menu-create"
        onClick={() => {
          if (guestMode) {
            onGuestAction?.();
            return;
          }

          setSelectedNav('open-voting');
          router.push('/elections/owner?mode=new');
        }}
        aria-disabled={guestMode}
        className={getButtonClassName(activeView === 'create')}
      >
        <span className="inline-flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          <span>Create Election</span>
        </span>
      </button>
    </div>
  );
}
