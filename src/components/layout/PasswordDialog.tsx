"use client";

import { useState, useEffect, useRef } from "react";
import { X, Eye, EyeOff } from "lucide-react";

interface PasswordDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireConfirmation?: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

export function PasswordDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  requireConfirmation = true,
  onConfirm,
  onCancel,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state when closed
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (requireConfirmation && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    onConfirm(password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-hush-bg-dark border border-hush-bg-element rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-hush-text-accent hover:text-hush-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold text-hush-purple mb-2">{title}</h2>

        {/* Description */}
        {description && (
          <p className="text-sm text-hush-text-accent mb-4">{description}</p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password field */}
          <div>
            <label className="block text-sm text-hush-text-accent mb-1">
              Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-hush-bg-element border border-hush-bg-hover rounded-lg px-4 py-2.5 pr-10 text-hush-text-primary placeholder-hush-text-accent/50 focus:outline-none focus:border-hush-purple transition-colors"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-hush-text-accent hover:text-hush-text-primary transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm password field */}
          {requireConfirmation && (
            <div>
              <label className="block text-sm text-hush-text-accent mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-hush-bg-element border border-hush-bg-hover rounded-lg px-4 py-2.5 text-hush-text-primary placeholder-hush-text-accent/50 focus:outline-none focus:border-hush-purple transition-colors"
                placeholder="Confirm password"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-hush-bg-hover text-hush-text-accent hover:bg-hush-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-hush-purple text-hush-bg-dark font-semibold hover:bg-hush-purple/90 transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
