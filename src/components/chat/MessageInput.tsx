"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Paperclip, Send, Smile } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";

interface MessageInputProps {
  onSend: (message: string) => void;
  onAttach?: () => void;
  onEscapeEmpty?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function MessageInput({ onSend, onAttach, onEscapeEmpty, disabled = false, autoFocus = true }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
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
      // Close emoji picker and focus input after sending
      setIsEmojiPickerOpen(false);
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

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessage((prev) => prev + emoji);
    // Focus input after emoji selection
    inputRef.current?.focus();
  }, []);

  // Close emoji picker when user starts typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (isEmojiPickerOpen) {
      setIsEmojiPickerOpen(false);
    }
  };

  // Toggle emoji picker
  const toggleEmojiPicker = () => {
    setIsEmojiPickerOpen((prev) => !prev);
  };

  return (
    <div className="flex-shrink-0 p-3">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-hush-bg-dark rounded-xl p-2"
      >
        {/* Emoji Picker Flyout */}
        <EmojiPicker
          isOpen={isEmojiPickerOpen}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setIsEmojiPickerOpen(false)}
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={onAttach}
          disabled={disabled}
          className="p-2 text-hush-purple hover:text-hush-purple-hover transition-colors disabled:opacity-50"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Emoji Button */}
        <button
          type="button"
          onClick={toggleEmojiPicker}
          disabled={disabled}
          className={`p-2 transition-colors disabled:opacity-50 ${
            isEmojiPickerOpen
              ? "text-hush-purple-hover"
              : "text-hush-purple hover:text-hush-purple-hover"
          }`}
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleInputChange}
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
