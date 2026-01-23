"use client";

import { useState, useCallback, memo, useEffect, useMemo } from "react";
import { Loader2, ArrowLeft, Lock, Globe, Users } from "lucide-react";
import type { SelectedMember } from "./MemberSelector";
import type { GroupType } from "./useCreateGroupFlow";

interface GroupDetailsFormProps {
  selectedMembers: SelectedMember[];
  onBack: () => void;
  onCreate: (data: { name: string; description: string; isPublic: boolean }) => void;
  isCreating: boolean;
  groupType?: GroupType;
}

/**
 * Group Details Form - Final step of Group Creation Wizard
 *
 * Allows users to configure group name and description.
 * Visibility is determined by the groupType selected in step 1.
 */
export const GroupDetailsForm = memo(function GroupDetailsForm({
  selectedMembers,
  onBack,
  onCreate,
  isCreating,
  groupType,
}: GroupDetailsFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Derive isPublic from groupType (null defaults to private for safety)
  const isPublic = useMemo(() => groupType === "public", [groupType]);

  // Determine back button text based on group type
  const backButtonText = useMemo(() => {
    // Public groups skip member selection, go back to type selection
    if (groupType === "public") {
      return "Back to Type Selection";
    }
    // Private groups go back to member selection
    return "Back to Members";
  }, [groupType]);

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
          aria-label={`Go back to ${groupType === "public" ? "type selection" : "member selection"}`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{backButtonText}</span>
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
            data-testid="group-name-input"
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
            data-testid="group-description-input"
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

        {/* Group Type Banner */}
        {groupType && (
          <div
            className={`flex items-center p-3 rounded-xl border ${
              isPublic
                ? "border-green-500/30 bg-green-500/10"
                : "border-hush-purple/30 bg-hush-purple/10"
            }`}
          >
            {isPublic ? (
              <Globe className="w-4 h-4 mr-2 text-green-400" />
            ) : (
              <Lock className="w-4 h-4 mr-2 text-hush-purple" />
            )}
            <div>
              <span className="text-sm font-medium text-hush-text-primary">
                {isPublic ? "Public" : "Private"} Group
              </span>
              <p className="text-xs text-hush-text-accent">
                {isPublic
                  ? "Anyone can discover and join this group"
                  : "Only invited members can see and join"}
              </p>
            </div>
          </div>
        )}

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
          data-testid="confirm-create-group-button"
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
