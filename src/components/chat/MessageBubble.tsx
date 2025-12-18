"use client";

import { Check } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isOwn: boolean;
  isConfirmed?: boolean;
}

export function MessageBubble({
  content,
  timestamp,
  isOwn,
  isConfirmed = false,
}: MessageBubbleProps) {
  // Layout: Left (others) 40% | Center (gap) 20% | Right (own) 40%
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[40%] px-3 py-2
          ${
            isOwn
              ? "bg-hush-purple text-hush-bg-dark rounded-bubble-sent"
              : "bg-hush-bg-dark text-hush-text-primary rounded-bubble-received"
          }
        `}
      >
        <p className="text-sm break-words">{content}</p>
        {/* Only show timestamp and checkmark when confirmed */}
        {isConfirmed && (
          <div
            className={`
              flex items-center justify-end space-x-1 mt-1
              ${isOwn ? "text-hush-bg-dark/70" : "text-hush-text-accent"}
            `}
          >
            <span className="text-[10px]">{timestamp}</span>
            {isOwn && <Check className="w-3.5 h-3.5 opacity-20" />}
          </div>
        )}
      </div>
    </div>
  );
}
