"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Ban,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ElectionRecordView } from '@/lib/grpc';
import type { ElectionVoidEvidenceReferencePayload } from '../transactionService';
import { getLifecycleLabel } from '../contracts';
import {
  buildEvidenceReferencePayloads,
  CONFIRMATION_PHRASE,
  getLifecycleImpactCopy,
  MAX_JUSTIFICATION_LENGTH,
  validatePublicJustification,
} from './VoidElectionTypes';
import { VoidValue } from './VoidValue';

export function VoidElectionDialog({
  election,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  election: ElectionRecordView;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (
    publicJustification: string,
    evidenceReferences: ElectionVoidEvidenceReferencePayload[],
  ) => Promise<void>;
}) {
  const [publicJustification, setPublicJustification] = useState('');
  const [evidenceReferencesText, setEvidenceReferencesText] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const impactCopy = getLifecycleImpactCopy(election.LifecycleState);
  const justificationErrors = validatePublicJustification(publicJustification);
  const evidenceReferenceDrafts = useMemo(
    () => buildEvidenceReferencePayloads(evidenceReferencesText),
    [evidenceReferencesText],
  );
  const evidenceErrors = evidenceReferenceDrafts
    .map((reference) => reference.error)
    .filter((error): error is string => Boolean(error));
  const validEvidenceReferences = evidenceReferenceDrafts
    .map((reference) => reference.payload)
    .filter((payload): payload is ElectionVoidEvidenceReferencePayload => Boolean(payload));
  const canSubmit =
    justificationErrors.length === 0 &&
    evidenceErrors.length === 0 &&
    confirmation === CONFIRMATION_PHRASE &&
    !isSubmitting;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-election-dialog-title"
      data-testid="void-election-dialog"
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={isSubmitting ? undefined : onClose} />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[#151c33] p-6 shadow-2xl shadow-black/50">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-full p-2 text-hush-text-accent transition-colors hover:bg-white/5 hover:text-hush-text-primary disabled:opacity-50"
          aria-label="Close void election dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-red-500/15 p-3 text-red-100">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-red-100/80">
              Owner authority
            </div>
            <h3 id="void-election-dialog-title" className="mt-2 text-xl font-semibold text-hush-text-primary">
              Void election
            </h3>
            <p className="mt-3 text-sm leading-7 text-hush-text-accent">
              This action is terminal and irreversible. The election will move to VOID, current
              publication refs will be superseded, and no current final result claim will remain.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <VoidValue label="Previous lifecycle" value={getLifecycleLabel(election.LifecycleState)} />
          <VoidValue label="New public status" value="VOID" accentClass="text-red-100" />
          <VoidValue label="Authority" value="ElectionOwner" />
        </div>

        <div className="mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{impactCopy.title}</div>
              <div className="mt-2 leading-6">{impactCopy.body}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm" htmlFor="void-public-justification">
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Public justification *
              </span>
              <span className="text-xs text-hush-text-accent">
                {publicJustification.trim().length} / {MAX_JUSTIFICATION_LENGTH}
              </span>
            </span>
            <textarea
              id="void-public-justification"
              value={publicJustification}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPublicJustification(event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-2xl bg-hush-bg-dark/80 px-4 py-3 text-sm leading-6 text-hush-text-primary placeholder-hush-text-accent/60 focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="State the public reason for voiding this election."
              data-testid="void-public-justification"
            />
          </label>

          <div className="rounded-2xl bg-black/20 p-4 text-sm leading-6 text-hush-text-accent">
            This text appears in the public VOID summary. Do not include secrets, voter identities,
            vote choices, raw support logs, private keys, passwords, personal contact data, or KMS data.
          </div>

          {justificationErrors.length > 0 ? (
            <div className="rounded-2xl bg-red-500/12 p-4 text-sm text-red-100" role="alert">
              <div className="font-semibold">Public justification is not ready</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {justificationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="block text-sm" htmlFor="void-evidence-refs">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Evidence references (optional)
            </span>
            <textarea
              id="void-evidence-refs"
              value={evidenceReferencesText}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEvidenceReferencesText(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl bg-hush-bg-dark/80 px-4 py-3 text-sm leading-6 text-hush-text-primary placeholder-hush-text-accent/60 focus:outline-none focus:ring-2 focus:ring-hush-purple"
              placeholder="One ref per line. Use anomaly:<uuid>, continuity:<uuid>, incident:<uuid>, support:<uuid>, or opaque governance refs."
              data-testid="void-evidence-refs"
            />
          </label>

          {evidenceErrors.length > 0 ? (
            <div className="rounded-2xl bg-red-500/12 p-4 text-sm text-red-100" role="alert">
              <div className="font-semibold">Evidence references need correction</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {evidenceErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="block text-sm" htmlFor="void-confirmation">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Type VOID to confirm
            </span>
            <input
              id="void-confirmation"
              value={confirmation}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmation(event.target.value)}
              className="mt-2 w-full max-w-xs rounded-2xl bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-primary focus:outline-none focus:ring-2 focus:ring-red-300"
              data-testid="void-confirmation"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl bg-hush-bg-dark/80 px-4 py-2.5 text-sm font-medium text-hush-text-accent transition-colors hover:bg-hush-bg-dark hover:text-hush-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit(publicJustification.trim(), validEvidenceReferences)}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
            data-testid="void-submit-button"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            <span>Sign and void</span>
          </button>
        </div>
      </div>
    </div>
  );
}
