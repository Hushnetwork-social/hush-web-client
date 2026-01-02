"use client";

import { useState, useCallback, memo, useEffect } from "react";
import { Loader2, ArrowLeft, Lock, Globe, Users } from "lucide-react";
import type { SelectedMember } from "./MemberSelector";

interface GroupDetailsFormProps {
  selectedMembers: SelectedMember[];
  onBack: () => void;
  onCreate: (data: { name: string; description: string; isPublic: boolean }) => void;
  isCreating: boolean;
}

/**
 * Step 2 of Group Creation Wizard - Group Details Form
 *
 * Allows users to configure group name, description, and visibility.
 */
export const GroupDetailsForm = memo(function GroupDetailsForm({
  selectedMembers,
  onBack,
  onCreate,
  isCreating,
}: GroupDetailsFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Validate name on change
  useEffect(() => {
    if (name.length === 0) {
      setNameError("Group name is required");
    } else if (name.length > 100) {
      setNameError("Group name must be 100 characters or less");
    } else {
      setNameError(null);
    }
  }, [name]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (name.trim().length === 0 || name.length > 100) {
        return;
      }

      onCreate({
        name: name.trim(),
        description: description.trim(),
        isPublic,
      });
    },
    [name, description, isPublic, onCreate]
  );

  const canCreate = name.trim().length > 0 && name.length <= 100 && !isCreating;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header with Back Button */}
      <div className="flex-shrink-0 p-4 border-b border-hush-bg-hover">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className="flex items-center gap-2 text-hush-text-accent hover:text-hush-text-primary transition-colors disabled:opacity-50"
          aria-label="Go back to member selection"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Members</span>
        </button>
      </div>

      {/* Form Fields */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Group Name */}
        <div>
          <label
            htmlFor="group-name"
            className="block text-sm font-medium text-hush-text-primary mb-1.5"
          >
            Group Name <span className="text-red-400">*</span>
          </label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            maxLength={100}
            disabled={isCreating}
            className={`w-full bg-hush-bg-dark border rounded-xl px-4 py-2.5 text-sm text-hush-text-primary placeholder-hush-text-accent focus:outline-none transition-colors ${
              nameError && name.length > 0
                ? "border-red-500 focus:border-red-500"
                : "border-hush-bg-hover focus:border-hush-purple"
            }`}
            aria-invalid={nameError !== null && name.length > 0}
            aria-describedby={nameError ? "name-error" : undefined}
          />
          <div className="flex justify-between mt-1">
            {nameError && name.length > 0 ? (
              <span id="name-error" className="text-xs text-red-400" role="alert">
                {nameError}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-hush-text-accent">
              {name.length}/100
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="group-description"
            className="block text-sm font-medium text-hush-text-primary mb-1.5"
          >
            Description <span className="text-hush-text-accent">(optional)</span>
          </label>
          <textarea
            id="group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group about?"
            maxLength={500}
            rows={3}
            disabled={isCreating}
            className="w-full bg-hush-bg-dark border border-hush-bg-hover rounded-xl px-4 py-2.5 text-sm text-hush-text-primary placeholder-hush-text-accent focus:outline-none focus:border-hush-purple resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-hush-text-accent">
              {description.length}/500
            </span>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <span className="block text-sm font-medium text-hush-text-primary mb-2">
            Visibility
          </span>
          <div className="space-y-2">
            <label
              className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                !isPublic
                  ? "border-hush-purple bg-hush-purple/10"
                  : "border-hush-bg-hover bg-hush-bg-dark hover:bg-hush-bg-hover"
              } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                disabled={isCreating}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                  !isPublic ? "border-hush-purple" : "border-hush-text-accent"
                }`}
              >
                {!isPublic && (
                  <div className="w-2 h-2 rounded-full bg-hush-purple" />
                )}
              </div>
              <Lock className="w-4 h-4 mr-2 text-hush-text-accent" />
              <div>
                <span className="text-sm font-medium text-hush-text-primary">
                  Private
                </span>
                <p className="text-xs text-hush-text-accent">
                  Only invited members can see and join
                </p>
              </div>
            </label>

            <label
              className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                isPublic
                  ? "border-hush-purple bg-hush-purple/10"
                  : "border-hush-bg-hover bg-hush-bg-dark hover:bg-hush-bg-hover"
              } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
                disabled={isCreating}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                  isPublic ? "border-hush-purple" : "border-hush-text-accent"
                }`}
              >
                {isPublic && (
                  <div className="w-2 h-2 rounded-full bg-hush-purple" />
                )}
              </div>
              <Globe className="w-4 h-4 mr-2 text-hush-text-accent" />
              <div>
                <span className="text-sm font-medium text-hush-text-primary">
                  Public
                </span>
                <p className="text-xs text-hush-text-accent">
                  Anyone can discover and request to join
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Members Summary */}
        <div className="p-3 bg-hush-bg-dark rounded-xl border border-hush-bg-hover">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-hush-purple" />
            <span className="text-sm font-medium text-hush-text-primary">
              Members ({selectedMembers.length + 1})
            </span>
          </div>
          <p className="text-xs text-hush-text-accent">
            You + {selectedMembers.length} invited member
            {selectedMembers.length !== 1 ? "s" : ""}
          </p>
          {selectedMembers.length <= 3 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedMembers.map((member) => (
                <span
                  key={member.publicSigningAddress}
                  className="px-2 py-0.5 bg-hush-purple/20 text-hush-purple text-xs rounded-full"
                >
                  {member.displayName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer with Create Button */}
      <div className="flex-shrink-0 p-4 border-t border-hush-bg-hover">
        <button
          type="submit"
          disabled={!canCreate}
          className="w-full px-6 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          aria-label="Create group"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Group"
          )}
        </button>
      </div>
    </form>
  );
});
