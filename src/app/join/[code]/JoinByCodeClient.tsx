"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users, AlertCircle, CheckCircle, LogIn } from "lucide-react";
import { groupService } from "@/lib/grpc/services/group";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds";
import type { PublicGroupInfo } from "@/types";
import { debugLog, debugError } from "@/lib/debug-logger";
import { ensureCommitmentRegistered, isReactionsInitialized } from "@/modules/reactions/initializeReactions";

// Storage key for pending invite code (used when user needs to authenticate first)
const PENDING_INVITE_CODE_KEY = "hush_pending_invite_code";

type JoinStatus = "loading" | "found" | "joining" | "joined" | "not_found" | "error" | "needs_auth";

interface JoinByCodeClientProps {
  /** Pre-fetched group info from server (for faster initial render) */
  initialGroupInfo?: PublicGroupInfo | null;
}

export function JoinByCodeClient({ initialGroupInfo }: JoinByCodeClientProps) {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [status, setStatus] = useState<JoinStatus>(initialGroupInfo ? "found" : "loading");
  const [groupInfo, setGroupInfo] = useState<PublicGroupInfo | null>(initialGroupInfo || null);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated
  const credentials = useAppStore((state) => state.credentials);
  const isAuthenticated = !!credentials?.signingPublicKey;

  // Lookup group by invite code
  const lookupGroup = useCallback(async () => {
    if (!code) {
      setStatus("not_found");
      setError("No invite code provided");
      return;
    }

    debugLog("[JoinByCode] Looking up group by code:", code);
    setStatus("loading");
    setError(null);

    try {
      const group = await groupService.getGroupByInviteCode(code);

      if (group) {
        debugLog("[JoinByCode] Found group:", group.name);
        setGroupInfo(group);

        // Check if user is authenticated
        if (!isAuthenticated) {
          // Store the invite code for after authentication
          localStorage.setItem(PENDING_INVITE_CODE_KEY, code);
          setStatus("needs_auth");
        } else {
          setStatus("found");
        }
      } else {
        debugLog("[JoinByCode] Group not found for code:", code);
        setStatus("not_found");
        setError("No group found with this invite code");
      }
    } catch (err) {
      debugError("[JoinByCode] Error looking up group:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to lookup group");
    }
  }, [code, isAuthenticated]);

  // Auto-join the group
  const joinGroup = useCallback(async () => {
    if (!groupInfo || !credentials?.signingPublicKey) return;

    debugLog("[JoinByCode] Joining group:", groupInfo.feedId);
    setStatus("joining");
    setError(null);

    try {
      const result = await groupService.joinGroup(
        groupInfo.feedId,
        credentials.signingPublicKey,
        credentials.encryptionPublicKey  // Pass encrypt key to avoid identity lookup timing issue
      );

      if (result.success) {
        debugLog("[JoinByCode] Successfully joined group");
        setStatus("joined");
        // Clear any pending invite code
        localStorage.removeItem(PENDING_INVITE_CODE_KEY);
        // Set pending group join to trigger full feed resync until feed appears
        useFeedsStore.getState().setPendingGroupJoin(groupInfo.feedId);
        // Register reaction commitment for the new group feed
        // This ensures the user can decrypt reactions from other members
        if (isReactionsInitialized()) {
          debugLog("[JoinByCode] Registering reaction commitment for group feed:", groupInfo.feedId);
          ensureCommitmentRegistered(groupInfo.feedId).then((success) => {
            if (success) {
              debugLog("[JoinByCode] Reaction commitment registered for group feed");
            } else {
              debugLog("[JoinByCode] Failed to register reaction commitment (will retry on sync)");
            }
          });
        }
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push(`/dashboard?feed=${groupInfo.feedId}`);
        }, 1500);
      } else {
        debugLog("[JoinByCode] Failed to join group:", result.error);
        setError(result.error || "Failed to join group");
        setStatus("error");
      }
    } catch (err) {
      debugError("[JoinByCode] Error joining group:", err);
      setError(err instanceof Error ? err.message : "Failed to join group");
      setStatus("error");
    }
  }, [groupInfo, credentials, router]);

  // Initial lookup on mount (only if no initial data provided)
  useEffect(() => {
    if (initialGroupInfo) {
      // We have pre-fetched data, just check auth status
      if (!isAuthenticated) {
        localStorage.setItem(PENDING_INVITE_CODE_KEY, code);
        setStatus("needs_auth");
      } else {
        setStatus("found");
      }
    } else {
      // No pre-fetched data, do client-side lookup
      lookupGroup();
    }
  }, [initialGroupInfo, isAuthenticated, code, lookupGroup]);

  // Handle login redirect
  const handleLogin = useCallback(() => {
    // Store the invite code before redirecting to auth
    localStorage.setItem(PENDING_INVITE_CODE_KEY, code);
    router.push("/auth");
  }, [code, router]);

  // Handle manual join
  const handleJoin = useCallback(() => {
    joinGroup();
  }, [joinGroup]);

  // Navigate to dashboard
  const handleGoToDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-hush-bg-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-hush-bg-element rounded-2xl border border-hush-bg-hover p-6 shadow-xl">
        {/* Loading state */}
        {status === "loading" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-12 h-12 text-hush-purple animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-hush-text-primary mb-2">
              Looking up invite code...
            </h2>
            <p className="text-sm text-hush-text-accent text-center">
              Code: <span className="font-mono">{code}</span>
            </p>
          </div>
        )}

        {/* Group found - show info and join button */}
        {status === "found" && groupInfo && (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-hush-purple/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-hush-purple" />
            </div>
            <h2 className="text-xl font-bold text-hush-text-primary mb-1">
              {groupInfo.name}
            </h2>
            {groupInfo.description && (
              <p className="text-sm text-hush-text-accent text-center mb-4 max-w-xs">
                {groupInfo.description}
              </p>
            )}
            <p className="text-xs text-hush-text-accent mb-6">
              {groupInfo.memberCount} member{groupInfo.memberCount !== 1 ? "s" : ""}
            </p>
            <button
              onClick={handleJoin}
              className="w-full px-6 py-3 bg-hush-purple text-white font-medium rounded-xl hover:bg-hush-purple/90 transition-colors"
            >
              Join Group
            </button>
          </div>
        )}

        {/* Joining state */}
        {status === "joining" && groupInfo && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-12 h-12 text-hush-purple animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-hush-text-primary mb-2">
              Joining {groupInfo.name}...
            </h2>
            <p className="text-sm text-hush-text-accent">Please wait</p>
          </div>
        )}

        {/* Joined successfully */}
        {status === "joined" && groupInfo && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-hush-text-primary mb-2">
              Welcome to {groupInfo.name}!
            </h2>
            <p className="text-sm text-hush-text-accent mb-4">
              Redirecting to the group...
            </p>
          </div>
        )}

        {/* Needs authentication */}
        {status === "needs_auth" && groupInfo && (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-hush-purple/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-hush-purple" />
            </div>
            <h2 className="text-xl font-bold text-hush-text-primary mb-1">
              {groupInfo.name}
            </h2>
            {groupInfo.description && (
              <p className="text-sm text-hush-text-accent text-center mb-4 max-w-xs">
                {groupInfo.description}
              </p>
            )}
            <p className="text-xs text-hush-text-accent mb-4">
              {groupInfo.memberCount} member{groupInfo.memberCount !== 1 ? "s" : ""}
            </p>
            <div className="w-full p-4 bg-hush-bg-dark rounded-xl mb-4">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <LogIn className="w-4 h-4" />
                <span className="text-sm font-medium">Sign in required</span>
              </div>
              <p className="text-xs text-hush-text-accent">
                Please sign in to join this group. You&apos;ll be redirected back here after authentication.
              </p>
            </div>
            <button
              onClick={handleLogin}
              className="w-full px-6 py-3 bg-hush-purple text-white font-medium rounded-xl hover:bg-hush-purple/90 transition-colors"
            >
              Sign In to Join
            </button>
          </div>
        )}

        {/* Not found */}
        {status === "not_found" && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-hush-text-primary mb-2">
              Group Not Found
            </h2>
            <p className="text-sm text-hush-text-accent text-center mb-6 max-w-xs">
              {error || "The invite code may be invalid or the group no longer exists."}
            </p>
            <button
              onClick={handleGoToDashboard}
              className="px-6 py-2 bg-hush-bg-hover text-hush-text-primary font-medium rounded-xl hover:bg-hush-bg-dark transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-hush-text-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-hush-text-accent text-center mb-6 max-w-xs">
              {error || "An error occurred while processing your request."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={lookupGroup}
                className="px-6 py-2 bg-hush-purple text-white font-medium rounded-xl hover:bg-hush-purple/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleGoToDashboard}
                className="px-6 py-2 bg-hush-bg-hover text-hush-text-primary font-medium rounded-xl hover:bg-hush-bg-dark transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
