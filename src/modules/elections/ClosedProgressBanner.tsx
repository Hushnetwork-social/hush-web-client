"use client";

import type { ElectionHubEntryView } from '@/lib/grpc';
import { Clock3 } from 'lucide-react';
import { getClosedProgressBannerState } from './contracts';

type ClosedProgressBannerProps = {
  entry: ElectionHubEntryView | null;
};

export function ClosedProgressBanner({ entry }: ClosedProgressBannerProps) {
  const bannerState = getClosedProgressBannerState(entry);
  if (!bannerState) {
    return null;
  }

  return (
    <section
      className="rounded-3xl bg-blue-500/10 p-5 text-blue-50 shadow-lg shadow-black/10"
      data-testid="closed-progress-banner"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-blue-500/15 p-3">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100/85">
            Close Progress
          </div>
          <h2 className="mt-2 text-lg font-semibold">{bannerState.title}</h2>
          <p className="mt-2 text-sm text-blue-100/85">{bannerState.description}</p>
        </div>
      </div>
    </section>
  );
}
