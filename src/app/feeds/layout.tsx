"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Header, Footer, Sidebar, BottomNav } from "@/components/layout";
import { InAppToastContainer, SystemToastContainer } from "@/components/notifications";
import { useAppStore } from "@/stores";
import { useBlockchainStore } from "@/modules/blockchain";
import { useFeedsStore } from "@/modules/feeds";
import { resetIdentitySyncState } from "@/modules/identity";
import { useNotifications, useBackButton, useVisualViewportHeight, useMentionDataLossCheck } from "@/hooks";
import { downloadCredentialsFile, type PortableCredentials } from "@/lib/crypto";
import { Loader2 } from "lucide-react";
import { debugLog, debugError } from "@/lib/debug-logger";
import { GroupCreationWizard } from "@/components/groups/GroupCreationWizard";
import { checkPendingNavigation, setupVisibilityChangeListener } from "@/lib/push";

// Dynamic imports to prevent dev mode race condition
const FeedList = dynamic(
  () => import("@/components/feed/FeedList").then((mod) => mod.FeedList),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-hush-purple" />
      </div>
    )
  }
);

const PasswordDialog = dynamic(
  () => import("@/components/layout/PasswordDialog").then((mod) => mod.PasswordDialog),
  { ssr: false }
);

const ConfirmDialog = dynamic(
  () => import("@/components/shared/ConfirmDialog").then((mod) => mod.ConfirmDialog),
  { ssr: false }
);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, balance, currentUser, credentials, logout, selectedFeedId, selectedNav, setSelectedNav, selectFeed } = useAppStore();
  const blockHeight = useBlockchainStore((state) => state.blockHeight);
  const [isMobile, setIsMobile] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showGroupWizard, setShowGroupWizard] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [pendingMessageCount, setPendingMessageCount] = useState(0);

  // Initialize notification system
  const { toasts, dismissToast, markAsRead } = useNotifications();

  // Check for mention data loss and show notification if detected
  const { toasts: systemToasts, dismissToast: dismissSystemToast } = useMentionDataLossCheck();

  // Handle device back button for PWA navigation
  useBackButton();

  // Track visual viewport height for Android keyboard handling
  // This sets --visual-viewport-height CSS variable that we use for layout height
  const { height: viewportHeight } = useVisualViewportHeight();

  // Redirect to auth page if not authenticated
  useEffect(() => {
    // Small delay to allow store rehydration from localStorage
    const timer = setTimeout(() => {
      setIsCheckingAuth(false);
      if (!isAuthenticated) {
        debugLog('[Dashboard] Not authenticated, redirecting to /auth');
        router.replace("/auth");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  // Get user info from store
  const userDisplayName = currentUser?.displayName || "User";
  const userInitials = currentUser?.initials || "U";

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle pending navigation from push notification tap
  useEffect(() => {
    // Check on mount (app startup)
    checkPendingNavigation();

    // Setup visibility change listener (app resume)
    const cleanup = setupVisibilityChangeListener();

    return cleanup;
  }, []);

  // Define all callbacks before any early return
  const handleNavSelect = useCallback((id: string) => {
    if (id === "create-group") {
      // Open wizard modal instead of changing view
      setShowGroupWizard(true);
    } else {
      setSelectedNav(id);
    }
  }, [setSelectedNav]);

  // Handle group created from wizard
  const handleGroupCreated = useCallback((feedId: string) => {
    debugLog("[Dashboard] Group created:", feedId);
    selectFeed(feedId);
    setSelectedNav("feeds");
  }, [selectFeed, setSelectedNav]);

  // Handle clicking on a toast notification - navigate to the feed
  const handleToastNavigate = useCallback((feedId: string) => {
    selectFeed(feedId);
    // Mark as read when navigating from toast
    markAsRead(feedId);
  }, [selectFeed, markAsRead]);

  const handleDownloadKeys = useCallback(() => {
    if (!credentials) return;
    setShowPasswordDialog(true);
  }, [credentials]);

  const handleAccountDetails = useCallback(() => {
    router.push('/account');
  }, [router]);

  const handlePasswordConfirm = useCallback(async (password: string) => {
    if (!credentials || !currentUser) return;

    try {
      // Build PortableCredentials matching C# format
      const portableCredentials: PortableCredentials = {
        ProfileName: currentUser.displayName || "User",
        PublicSigningAddress: credentials.signingPublicKey,
        PrivateSigningKey: credentials.signingPrivateKey,
        PublicEncryptAddress: credentials.encryptionPublicKey,
        PrivateEncryptKey: credentials.encryptionPrivateKey,
        IsPublic: false,
        Mnemonic: credentials.mnemonic?.join(" ") || null,
      };

      // Download encrypted file
      await downloadCredentialsFile(
        portableCredentials,
        password,
        currentUser.displayName || "hush"
      );

      setShowPasswordDialog(false);
    } catch (error) {
      debugError("Failed to download keys:", error);
      // Dialog stays open on error so user can try again
    }
  }, [credentials, currentUser]);

  // FEAT-058: Perform actual logout
  const performLogout = useCallback(() => {
    // Reset all module stores
    useFeedsStore.getState().reset();
    resetIdentitySyncState();
    // Note: BlockchainStore doesn't need reset (block height is always-running)

    // Reset app store and redirect
    logout();
    router.push("/auth");
  }, [logout, router]);

  // FEAT-058: Check for unsent messages before logout
  const handleLogout = useCallback(() => {
    const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

    if (hasPending) {
      // Get count for dialog message
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();
      setPendingMessageCount(unconfirmed.length);
      setShowLogoutConfirmation(true);
    } else {
      performLogout();
    }
  }, [performLogout]);

  // FEAT-058: Handle logout confirmation
  const handleLogoutConfirm = useCallback(() => {
    setShowLogoutConfirmation(false);
    performLogout();
  }, [performLogout]);

  // Show loading while checking auth
  if (isCheckingAuth || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-hush-bg-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-hush-purple" />
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-hush-bg-dark flex flex-col overflow-hidden"
      style={{ height: viewportHeight > 0 ? `${viewportHeight}px` : '100vh' }}
    >
      {/* Desktop Layout */}
      {!isMobile && (
        <div className="flex-1 min-h-0 flex flex-col p-2 gap-1">
          {/* Header */}
          <Header
            balance={balance?.available || 0}
            blockHeight={blockHeight}
          />

          {/* Content Area */}
          <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
            {/* Sidebar */}
            <Sidebar
              selectedNav={selectedNav}
              onNavSelect={handleNavSelect}
              userDisplayName={userDisplayName}
              userInitials={userInitials}
              onDownloadKeys={handleDownloadKeys}
              onAccountDetails={handleAccountDetails}
              onLogout={handleLogout}
            >
              <FeedList />
            </Sidebar>

            {/* Center Content */}
            <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-hush-bg-element rounded-br-xl">
              {children}
            </main>
          </div>

          {/* Footer - on dark background, not highlighted */}
          <Footer blockHeight={blockHeight} />
        </div>
      )}

      {/* Mobile Layout */}
      {isMobile && (
        <div className="flex-1 min-h-0 flex flex-col p-2 gap-1 safe-area-top safe-area-bottom">
          <Header
            balance={balance?.available || 0}
            blockHeight={blockHeight}
          />
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-hush-bg-element rounded-xl">
            {children}
          </main>
          {/* Hide bottom nav when viewing a feed - use back button instead */}
          {!selectedFeedId && (
            <BottomNav
              selectedNav={selectedNav}
              onNavSelect={handleNavSelect}
              userInitials={userInitials}
              onDownloadKeys={handleDownloadKeys}
              onAccountDetails={handleAccountDetails}
              onLogout={handleLogout}
            />
          )}
          <Footer blockHeight={blockHeight} />
        </div>
      )}

      {/* Password Dialog for Download Keys */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        title="Encrypt Your Keys"
        description="Enter a password to encrypt your keys file. You will need this password to import your keys later."
        confirmLabel="Download"
        requireConfirmation={true}
        onConfirm={handlePasswordConfirm}
        onCancel={() => setShowPasswordDialog(false)}
      />

      {/* In-App Toast Notifications */}
      <InAppToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onNavigate={handleToastNavigate}
      />

      {/* System Toast Notifications (data loss, etc.) */}
      <SystemToastContainer
        toasts={systemToasts}
        onDismiss={dismissSystemToast}
      />

      {/* Group Creation Wizard Modal */}
      <GroupCreationWizard
        isOpen={showGroupWizard}
        onClose={() => setShowGroupWizard(false)}
        onGroupCreated={handleGroupCreated}
      />

      {/* FEAT-058: Logout Confirmation Dialog for Unsent Messages */}
      <div data-testid="logout-confirm-dialog">
        <ConfirmDialog
          isOpen={showLogoutConfirmation}
          title="Unsent Messages"
          message={`You have ${pendingMessageCount} unsent message${pendingMessageCount !== 1 ? 's' : ''} that will be lost if you logout now.`}
          confirmLabel="Logout Anyway"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirmation(false)}
        />
      </div>
    </div>
  );
}
