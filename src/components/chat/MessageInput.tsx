"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, Send } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string) => void;
  onAttach?: () => void;
  onEscapeEmpty?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function MessageInput({ onSend, onAttach, onEscapeEmpty, disabled = false, autoFocus = true }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when component mounts
  useEffect(() => {
    if (autoFocus && !disabled) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      // Ensure input keeps focus after sending
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "Escape" && !message.trim()) {
      e.preventDefault();
      onEscapeEmpty?.();
    }
  };

  return (
    <div className="flex-shrink-0 p-3">
      <form
        onSubmit={handleSubmit}
        className="flex items-center bg-hush-bg-dark rounded-xl p-2"
      >
        {/* Attachment Button */}
        <button
          type="button"
          onClick={onAttach}
          disabled={disabled}
          className="p-2 text-hush-purple hover:text-hush-purple-hover transition-colors disabled:opacity-50"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none text-hush-text-primary placeholder-hush-text-accent text-sm px-2 disabled:opacity-50"
        />

        {/* Send Button - always rendered to prevent height jump */}
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className={`p-2 rounded-full transition-all disabled:opacity-50 ${
            message.trim()
              ? "bg-hush-purple hover:bg-hush-purple-hover"
              : "bg-transparent opacity-0 pointer-events-none"
          }`}
        >
          <Send className="w-4 h-4 text-hush-bg-dark" />
        </button>
      </form>
    </div>
  );
}
