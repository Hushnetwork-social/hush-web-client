"use client";

import Link from 'next/link';
import { AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';

type ElectionAccessBoundaryNoticeProps = {
  title: string;
  message: string;
  details?: string[];
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ElectionAccessBoundaryNotice({
  title,
  message,
  details = [],
  primaryHref = '/account/elections',
  primaryLabel = 'Back to HushVoting Hub',
  secondaryHref,
  secondaryLabel,
}: ElectionAccessBoundaryNoticeProps) {
  return (
    <section
      className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-50 shadow-lg shadow-black/10"
      data-testid="election-access-boundary-notice"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/15 p-3">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-red-100/90">{message}</p>
          {details.length > 0 ? (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-red-100/85">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{primaryLabel}</span>
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-medium text-red-50 transition-colors hover:border-red-100/50 hover:bg-red-500/10"
          >
            <ExternalLink className="h-4 w-4" />
            <span>{secondaryLabel}</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
