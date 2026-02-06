"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { X } from "lucide-react";
import { MemberSelector, type SelectedMember } from "./MemberSelector";
import { GroupDetailsForm } from "./GroupDetailsForm";
import { TypeSelectionStep } from "./TypeSelectionStep";
import { useCreateGroupFlow, type GroupType } from "./useCreateGroupFlow";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds";
import { debugLog, debugError } from "@/lib/debug-logger";
import {
  createGroupFeedTransaction,
  type GroupParticipantInput,
} from "@/lib/crypto/transactions";
import { hexToBytes } from "@/lib/crypto/keys";
import { submitTransaction } from "@/modules/blockchain";
import { buildApiUrl } from "@/lib/api-config";

// Status types for creation flow (mirrors auth/page.tsx pattern)
export type CreationStatus =
  | "idle"
  | "creating"
  | "waiting_for_blockchain"
  | "loading_data"
  | "done";

interface GroupCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (feedId: string) => void;
}

/**
 * Group Creation Wizard
 *
 * A multi-step wizard for creating group feeds:
 * - Public groups: 2 steps (Type Selection → Group Details)
 * - Private groups: 3 steps (Type Selection → Member Selection → Group Details)
 */
export const GroupCreationWizard = memo(function GroupCreationWizard({
  isOpen,
  onClose,
  onGroupCreated,
}: GroupCreationWizardProps) {
  // Flow state management via custom hook
  const flow = useCreateGroupFlow();

  // Local UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationStatus, setCreationStatus] = useState<CreationStatus>("idle");

  // Get current user credentials
  const credentials = useAppStore((state) => state.credentials);
  const currentUser = useAppStore((state) => state.currentUser);

  // Reset state when wizard closes
  useEffect(() => {
    if (!isOpen) {
      flow.reset();
      setIsCreating(false);
      setError(null);
      setCreationStatus("idle");
    }
  }, [isOpen, flow]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isCreating) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCreating, onClose]);

  // Handle type selection
  const handleTypeSelect = useCallback(
    (type: GroupType) => {
      flow.setGroupType(type);
      setError(null);
    },
    [flow]
  );

  // Proceed to next step
  const handleNext = useCallback(() => {
    flow.goNext();
    setError(null);
  }, [flow]);

  // Go back to previous step
  const handleBack = useCallback(() => {
    flow.goBack();
    setError(null);
  }, [flow]);

  // Create the group
  const handleCreate = useCallback(
    async (data: { name: string; description: string; isPublic: boolean }) => {
      if (!credentials || !currentUser) {
        setError("Not authenticated");
        return;
      }

      setIsCreating(true);
      setError(null);
      setCreationStatus("creating");

      try {
        debugLog("[GroupCreationWizard] Creating group:", data.name);
        debugLog("[GroupCreationWizard] Selected members:", flow.selectedMembers.length);

        // Convert selected members to GroupParticipantInput format
        const participants: GroupParticipantInput[] = flow.selectedMembers.map((m) => ({
          publicSigningAddress: m.publicSigningAddress,
          publicEncryptAddress: m.publicEncryptAddress,
        }));

        // Convert hex private key to bytes for signing
        const signingPrivateKeyBytes = hexToBytes(credentials.signingPrivateKey);

        // Create the group transaction with encrypted keys for all participants
        debugLog("[GroupCreationWizard] Creating group transaction...");
        const { signedTransaction, feedId, feedAesKey } = await createGroupFeedTransaction(
          data.name,
          data.description,
          data.isPublic,
          credentials.signingPublicKey,
          credentials.encryptionPublicKey,
          participants,
          signingPrivateKeyBytes
        );

        debugLog("[GroupCreationWizard] Transaction created, feedId:", feedId);

        // Submit the transaction to the blockchain
        debugLog("[GroupCreationWizard] Submitting transaction to blockchain...");
        const result = await submitTransaction(signedTransaction);

        if (!result.successful) {
          throw new Error(result.message || "Failed to submit group creation transaction");
        }

        debugLog("[GroupCreationWizard] Transaction submitted successfully");

        // =====================================================================
        // Poll for blockchain confirmation (like auth/page.tsx pattern)
        // The wizard must wait for the feed to actually exist on the blockchain
        // before closing, otherwise syncs may overwrite local data.
        // =====================================================================
        setCreationStatus("waiting_for_blockchain");
        debugLog("[GroupCreationWizard] Waiting for blockchain confirmation...");

        const maxAttempts = 30;
        const pollInterval = 1000; // 1 second
        let feedConfirmed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            // Check if feed exists via API (same pattern as auth/page.tsx)
            const feedsResponse = await fetch(
              buildApiUrl(`/api/feeds/list?address=${encodeURIComponent(credentials.signingPublicKey)}&blockIndex=0`)
            );
            const feedsData = await feedsResponse.json();

            // Check if our group feed is in the response
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const groupFeed = feedsData.feeds?.find((f: any) => f.feedId === feedId);
            if (groupFeed) {
              debugLog(`[GroupCreationWizard] Feed confirmed on blockchain after ${attempt + 1} attempt(s)`);
              feedConfirmed = true;
              break;
            }

            debugLog(`[GroupCreationWizard] Polling attempt ${attempt + 1}/${maxAttempts}: feed not yet indexed`);
          } catch (pollError) {
            debugError(`[GroupCreationWizard] Polling attempt ${attempt + 1} failed:`, pollError);
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        if (!feedConfirmed) {
          debugError("[GroupCreationWizard] Feed not confirmed after max attempts, proceeding anyway");
        }

        // =====================================================================
        // Load feed data into local store
        // =====================================================================
        setCreationStatus("loading_data");
        debugLog("[GroupCreationWizard] Loading feed data...");

        // Add the new group feed to the local store
        useFeedsStore.getState().addFeeds([{
          id: feedId,
          type: "group",
          name: data.name,
          participants: [
            credentials.signingPublicKey,
            ...flow.selectedMembers.map((m) => m.publicSigningAddress),
          ],
          unreadCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }]);

        // Store the AES key locally for message encryption/decryption
        useFeedsStore.getState().updateFeedAesKey(feedId, feedAesKey);

        // Set user role as Admin for this group
        useFeedsStore.getState().setUserRole(feedId, "Admin");

        // Set group members
        useFeedsStore.getState().setGroupMembers(feedId, [
          {
            publicAddress: credentials.signingPublicKey,
            displayName: currentUser.displayName,
            role: "Admin",
          },
          ...flow.selectedMembers.map((m) => ({
            publicAddress: m.publicSigningAddress,
            displayName: m.displayName,
            role: "Member" as const,
          })),
        ]);

        setCreationStatus("done");
        debugLog("[GroupCreationWizard] Group created successfully:", feedId);

        // Notify parent and close - only after blockchain confirmation
        onGroupCreated(feedId);
        onClose();
      } catch (err) {
        debugError("[GroupCreationWizard] Create failed:", err);
        setError(err instanceof Error ? err.message : "Failed to create group");
        setCreationStatus("idle");
      } finally {
        setIsCreating(false);
      }
    },
    [credentials, currentUser, flow.selectedMembers, onGroupCreated, onClose]
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (!isCreating) {
      onClose();
    }
  }, [isCreating, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        data-testid="group-creation-wizard"
        className="relative w-full max-w-lg h-[80vh] max-h-[600px] mx-4 bg-hush-bg-element rounded-2xl shadow-2xl flex flex-col overflow-hidden md:mx-auto"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-hush-bg-hover">
          <div>
            <h2
              id="wizard-title"
              className="text-lg font-semibold text-hush-text-primary"
            >
              {flow.currentStep === "type"
                ? "Create Group"
                : `Create ${flow.groupType === "public" ? "Public" : "Private"} Group`}
            </h2>
            <p className="text-xs text-hush-text-accent mt-0.5">
              {flow.groupType === null
                ? "Step 1: Choose Type"
                : `Step ${flow.currentStepNumber} of ${flow.totalSteps}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="p-2 rounded-lg hover:bg-hush-bg-hover transition-colors disabled:opacity-50"
            aria-label="Close wizard"
          >
            <X className="w-5 h-5 text-hush-text-accent" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
            role="alert"
          >
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {flow.currentStep === "type" && (
            <TypeSelectionStep
              selectedType={flow.groupType}
              onTypeSelect={handleTypeSelect}
              onNext={handleNext}
            />
          )}
          {flow.currentStep === "members" && (
            <MemberSelector
              selectedMembers={flow.selectedMembers}
              onMembersChange={flow.setSelectedMembers}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {flow.currentStep === "details" && (
            <GroupDetailsForm
              selectedMembers={flow.selectedMembers}
              onBack={handleBack}
              onCreate={handleCreate}
              isCreating={isCreating}
              groupType={flow.groupType}
              creationStatus={creationStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
});

// Re-export types and components for convenience
export type { SelectedMember };
export { MemberSelector, GroupDetailsForm };
