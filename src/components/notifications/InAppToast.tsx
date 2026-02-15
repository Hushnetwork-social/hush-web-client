'use client';

import { AtSign, X } from 'lucide-react';
import type { NotificationToast } from '@/hooks/useNotifications';

interface InAppToastProps {
  toast: NotificationToast;
  onDismiss: (id: string) => void;
  onNavigate: (feedId: string) => void;
}

/**
 * Renders message preview with @mentions in bold.
 * Splits text on @-prefixed words and renders them as bold spans.
 */
function MentionPreview({ text }: { text: string }) {
  // Match @DisplayName patterns (word characters, spaces allowed until next non-letter)
  const parts = text.split(/(@\w+(?:\s\w+)*)/g);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-hush-purple font-semibold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function InAppToast({ toast, onDismiss, onNavigate }: InAppToastProps) {
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClick = () => {
    onNavigate(toast.feedId);
    onDismiss(toast.id);
  };

  const isMention = toast.isMention ?? false;

  // Mention notifications: bright purple border + subtle purple glow
  // Normal notifications: subtle purple border
  const borderClass = isMention
    ? 'border-hush-purple border-2 shadow-[0_0_12px_rgba(167,139,250,0.3)]'
    : 'border border-hush-purple/50';

  return (
    <div
      className={`
        bg-hush-bg-element ${borderClass} rounded-lg p-4
        shadow-lg w-80 animate-slide-in cursor-pointer
        hover:bg-hush-bg-hover transition-colors
      `}
      onClick={handleClick}
    >
      <div className="flex items-start">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
          <span className="text-hush-bg-dark font-bold text-sm">
            {getInitials(toast.senderName)}
          </span>
        </div>

        {/* Content */}
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-hush-text-primary font-semibold text-sm truncate">
              {toast.senderName}
            </p>
            {isMention && (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-hush-purple rounded-full flex-shrink-0">
                <AtSign className="w-3 h-3 text-hush-bg-dark" strokeWidth={3} />
              </span>
            )}
          </div>
          {toast.feedName && (
            <p className="text-hush-text-accent text-xs truncate">
              in {toast.feedName}
            </p>
          )}
          <p className="text-hush-text-accent text-sm mt-1 line-clamp-2">
            <MentionPreview text={toast.messagePreview} />
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="ml-2 p-1 text-hush-text-accent hover:text-hush-text-primary rounded-full hover:bg-hush-bg-dark transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface InAppToastContainerProps {
  toasts: NotificationToast[];
  onDismiss: (id: string) => void;
  onNavigate: (feedId: string) => void;
}

export function InAppToastContainer({
  toasts,
  onDismiss,
  onNavigate,
}: InAppToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <InAppToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
