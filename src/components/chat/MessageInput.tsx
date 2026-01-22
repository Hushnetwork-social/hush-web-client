"use client";

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Paperclip, Send, Smile } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { MentionOverlay, MentionParticipant } from "./MentionOverlay";
import { detectMentionTrigger, replaceMentionTrigger, findMentionAtCursor } from "@/lib/mentions";

interface MessageInputProps {
  onSend: (message: string) => void;
  onAttach?: () => void;
  onEscapeEmpty?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Participants available for @mentions */
  participants?: MentionParticipant[];
}

export interface MessageInputHandle {
  focus: () => void;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({ onSend, onAttach, onEscapeEmpty, disabled = false, autoFocus = true, participants = [] }, ref) {
  const [message, setMessage] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mention overlay state
  const [isMentionOverlayOpen, setIsMentionOverlayOpen] = useState(false);
  const [mentionFilterText, setMentionFilterText] = useState("");
  const [mentionTriggerPosition, setMentionTriggerPosition] = useState(0);

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

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
    // When mention overlay is open, let it handle navigation keys
    if (isMentionOverlayOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Tab") {
        // These keys are handled by MentionOverlay via document listener
        // Prevent default behavior (cursor movement, form submit)
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        // Close overlay without selection
        e.preventDefault();
        setIsMentionOverlayOpen(false);
        setMentionFilterText("");
        return;
      }
    }

    // Atomic delete for mentions: delete entire mention on backspace/delete
    if (e.key === "Backspace" || e.key === "Delete") {
      const cursorPos = inputRef.current?.selectionStart ?? 0;
      const selectionEnd = inputRef.current?.selectionEnd ?? 0;

      // Only handle atomic delete when there's no selection (single cursor)
      if (cursorPos === selectionEnd) {
        const direction = e.key === "Backspace" ? "backward" : "forward";
        const mention = findMentionAtCursor(message, cursorPos, direction);

        if (mention) {
          e.preventDefault();
          // Delete the entire mention
          const newText = message.slice(0, mention.startIndex) + message.slice(mention.endIndex);
          setMessage(newText);

          // Set cursor to where the mention was
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(mention.startIndex, mention.startIndex);
            }
          });
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "Escape" && !message.trim()) {
      e.preventDefault();
      onEscapeEmpty?.();
    }
  };

  // Handle mention selection from overlay
  const handleMentionSelect = useCallback((participant: MentionParticipant) => {
    const cursorPos = inputRef.current?.selectionStart ?? message.length;
    const result = replaceMentionTrigger(
      message,
      mentionTriggerPosition,
      cursorPos,
      participant.displayName,
      participant.identityId
    );

    setMessage(result.text);
    setIsMentionOverlayOpen(false);
    setMentionFilterText("");

    // Set cursor position after the inserted mention
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(result.cursorPosition, result.cursorPosition);
        inputRef.current.focus();
      }
    });
  }, [message, mentionTriggerPosition]);

  // Close mention overlay
  const handleMentionClose = useCallback(() => {
    setIsMentionOverlayOpen(false);
    setMentionFilterText("");
  }, []);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessage((prev) => prev + emoji);
    // Focus input after emoji selection
    inputRef.current?.focus();
  }, []);

  // Close emoji picker when user starts typing and detect @ mention trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;

    setMessage(newValue);

    if (isEmojiPickerOpen) {
      setIsEmojiPickerOpen(false);
    }

    // Detect @ mention trigger
    const trigger = detectMentionTrigger(newValue, cursorPos);
    if (trigger) {
      setIsMentionOverlayOpen(true);
      setMentionFilterText(trigger.filterText);
      setMentionTriggerPosition(trigger.triggerPosition);
    } else {
      setIsMentionOverlayOpen(false);
      setMentionFilterText("");
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
        {/* Mention Overlay */}
        <MentionOverlay
          participants={participants}
          filterText={mentionFilterText}
          isOpen={isMentionOverlayOpen}
          onSelect={handleMentionSelect}
          onClose={handleMentionClose}
        />

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
          placeholder="Type a message..." role="combobox" aria-haspopup="listbox" aria-expanded={isMentionOverlayOpen} aria-controls={isMentionOverlayOpen ? "mention-listbox" : undefined}
          disabled={disabled}
          data-testid="message-input"
          className="flex-1 bg-transparent border-none outline-none text-hush-text-primary placeholder-hush-text-accent text-sm px-2 disabled:opacity-50"
        />

        {/* Send Button - always rendered to prevent height jump */}
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          data-testid="send-button"
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
});
