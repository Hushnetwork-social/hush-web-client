"use client";

import { Copy, Check } from "lucide-react";
import { useCopyToClipboard } from "@/hooks";

interface KeyDisplayFieldProps {
  /** Label displayed above the key */
  label: string;
  /** The full key value (will be truncated for display) */
  value: string;
  /** Optional description displayed below the key */
  description?: string;
}

/**
 * Truncates a key for display, showing first 8 and last 8 characters
 * @param key - The full key string
 * @returns Truncated key in format "abcdefgh...12345678"
 */
function truncateKey(key: string): string {
  if (key.length <= 16) {
    return key;
  }
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

/**
 * KeyDisplayField Component
 *
 * Displays a cryptographic key with truncation and copy-to-clipboard functionality.
 * The copy button copies the FULL key (not the truncated display).
 */
export function KeyDisplayField({ label, value, description }: KeyDisplayFieldProps) {
  const { copy, isCopied } = useCopyToClipboard();

  const handleCopy = () => {
    copy(value);
  };

  return (
    <div className="space-y-1">
      {/* Label */}
      <label className="text-sm font-medium text-hush-text-primary">
        {label}
      </label>

      {/* Key display with copy button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 bg-hush-bg-element rounded-lg">
          <span className="font-mono text-sm text-hush-text-secondary break-all">
            {truncateKey(value)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${isCopied
              ? "bg-green-600 text-white"
              : "bg-hush-bg-element hover:bg-hush-bg-light text-hush-text-accent hover:text-hush-purple"
            }
          `}
          aria-label={isCopied ? "Copied" : `Copy ${label}`}
        >
          {isCopied ? (
            <Check className="w-5 h-5" />
          ) : (
            <Copy className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-hush-text-accent">
          {description}
        </p>
      )}
    </div>
  );
}
