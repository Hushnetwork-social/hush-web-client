"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  /** Controls dialog visibility */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Description/message text */
  message: string;
  /** Label for confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Visual variant - danger shows red confirm button */
  variant?: "default" | "danger";
  /** If set, user must type this text to enable confirm button */
  requireTextConfirmation?: string;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  requireTextConfirmation,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
    }
  }, [isOpen]);

  // Focus appropriate element when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        if (requireTextConfirmation && inputRef.current) {
          inputRef.current.focus();
        } else if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, requireTextConfirmation]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onCancel();
      }
    },
    [isOpen, onCancel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Determine if confirm button should be enabled
  const isConfirmEnabled = requireTextConfirmation
    ? confirmText === requireTextConfirmation
    : true;

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmEnabled) {
      onConfirm();
    }
  };

  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-hush-bg-dark border border-hush-bg-element rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-hush-text-accent hover:text-hush-text-primary transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon for danger variant */}
        {isDanger && (
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
        )}

        {/* Title */}
        <h2
          id="confirm-dialog-title"
          className={`text-xl font-bold mb-2 ${
            isDanger ? "text-red-400 text-center" : "text-hush-purple"
          }`}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          className={`text-sm text-hush-text-accent mb-4 ${
            isDanger ? "text-center" : ""
          }`}
        >
          {message}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Text confirmation input */}
          {requireTextConfirmation && (
            <div className="mb-4">
              <label className="block text-sm text-hush-text-accent mb-1">
                Type <strong className="text-hush-text-primary">{requireTextConfirmation}</strong> to confirm
              </label>
              <input
                ref={inputRef}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-hush-bg-element border border-hush-bg-hover rounded-lg px-4 py-2.5 text-hush-text-primary placeholder-hush-text-accent/50 focus:outline-none focus:border-hush-purple transition-colors"
                placeholder={`Type "${requireTextConfirmation}"`}
                autoComplete="off"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-hush-bg-hover text-hush-text-accent hover:bg-hush-bg-hover transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              type="submit"
              disabled={!isConfirmEnabled}
              className={`
                flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors
                ${
                  isDanger
                    ? "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-500/30 disabled:text-white/50"
                    : "bg-hush-purple text-hush-bg-dark hover:bg-hush-purple/90 disabled:bg-hush-purple/30 disabled:text-hush-bg-dark/50"
                }
                disabled:cursor-not-allowed
              `}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
