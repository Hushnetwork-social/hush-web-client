'use client';

import { Download, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { triggerUpdateDownload, dismissUpdateOverlay } from '@/hooks/useAutoUpdate';

export function UpdateOverlay() {
  const { status, updateInfo, progress, error, showOverlay } = useUpdateStore();

  if (!showOverlay) return null;

  const getProgressPercent = (): number => {
    if (!progress?.total) return 0;
    return Math.round((progress.downloaded / progress.total) * 100);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={status === 'available' ? dismissUpdateOverlay : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-hush-bg-dark border border-hush-purple/50 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Close button (only when not downloading) */}
        {status === 'available' && (
          <button
            onClick={dismissUpdateOverlay}
            className="absolute top-4 right-4 text-hush-text-accent hover:text-hush-text-primary transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              status === 'error'
                ? 'bg-red-500/20'
                : status === 'ready'
                ? 'bg-green-500/20'
                : 'bg-hush-purple/20'
            }`}
          >
            {status === 'error' ? (
              <AlertCircle className="w-8 h-8 text-red-400" />
            ) : status === 'ready' ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : status === 'downloading' ? (
              <RefreshCw className="w-8 h-8 text-hush-purple animate-spin" />
            ) : (
              <Download className="w-8 h-8 text-hush-purple" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2
          id="update-dialog-title"
          className="text-xl font-bold text-center text-hush-text-primary mb-2"
        >
          {status === 'error'
            ? 'Update Failed'
            : status === 'ready'
            ? 'Update Ready'
            : status === 'downloading'
            ? 'Downloading Update'
            : 'Update Available'}
        </h2>

        {/* Version info */}
        {updateInfo && status !== 'error' && (
          <p className="text-center text-hush-text-accent mb-4">
            <span className="text-hush-text-accent/70">
              v{updateInfo.currentVersion}
            </span>
            <span className="mx-2 text-hush-purple">→</span>
            <span className="text-hush-purple font-semibold">
              v{updateInfo.version}
            </span>
          </p>
        )}

        {/* Release notes */}
        {updateInfo?.body && status === 'available' && (
          <div className="bg-hush-bg-element rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
            <p className="text-sm text-hush-text-accent whitespace-pre-line">
              {updateInfo.body}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {status === 'downloading' && progress && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-hush-text-accent mb-1">
              <span>Downloading...</span>
              <span>
                {formatBytes(progress.downloaded)}
                {progress.total && ` / ${formatBytes(progress.total)}`}
              </span>
            </div>
            <div className="h-2 bg-hush-bg-element rounded-full overflow-hidden">
              <div
                className="h-full bg-hush-purple transition-all duration-300"
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && error && (
          <p className="text-center text-sm text-red-400 mb-4">{error}</p>
        )}

        {/* Ready message */}
        {status === 'ready' && (
          <p className="text-center text-sm text-hush-text-accent mb-4">
            The app will restart to complete the update.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {status === 'available' && (
            <>
              <button
                onClick={dismissUpdateOverlay}
                className="flex-1 px-4 py-2.5 rounded-lg border border-hush-bg-hover text-hush-text-accent hover:bg-hush-bg-hover transition-colors"
              >
                Later
              </button>
              <button
                onClick={triggerUpdateDownload}
                className="flex-1 px-4 py-2.5 rounded-lg bg-hush-purple text-white font-semibold hover:bg-hush-purple/90 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </>
          )}

          {status === 'error' && (
            <button
              onClick={dismissUpdateOverlay}
              className="flex-1 px-4 py-2.5 rounded-lg bg-hush-purple text-white font-semibold hover:bg-hush-purple/90 transition-colors"
            >
              Close
            </button>
          )}

          {status === 'downloading' && (
            <p className="flex-1 text-center text-sm text-hush-text-accent py-2">
              Please wait, do not close the app...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
