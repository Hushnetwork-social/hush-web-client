'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SystemToastProps {
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

/**
 * SystemToast - A simple toast for system messages (not tied to feeds/users)
 *
 * Features:
 * - Warning icon for system alerts
 * - Auto-dismisses after specified duration (default 5s)
 * - Manual dismiss via X button
 * - Slide-in animation
 */
export function SystemToast({
  message,
  onDismiss,
  autoDismissMs = 5000,
}: SystemToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  return (
    <div
      className="
        bg-hush-bg-element border border-yellow-500/50 rounded-lg p-4
        shadow-lg w-80 animate-slide-in
      "
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        {/* Warning Icon */}
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-yellow-500" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="ml-3 flex-1 min-w-0">
          <p className="text-hush-text-primary text-sm">{message}</p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="ml-2 p-1 text-hush-text-accent hover:text-hush-text-primary rounded-full hover:bg-hush-bg-dark transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * SystemToastContainer - Renders system toasts at top-right
 */
interface SystemToastContainerProps {
  toasts: Array<{ id: string; message: string }>;
  onDismiss: (id: string) => void;
}

export function SystemToastContainer({
  toasts,
  onDismiss,
}: SystemToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <SystemToast
          key={toast.id}
          message={toast.message}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}
