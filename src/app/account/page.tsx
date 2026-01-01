"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Save, Download, Loader2, Check, AlertCircle } from "lucide-react";
import { KeyDisplayField } from "@/components/account";
import { useAppStore } from "@/stores";
import {
  downloadCredentialsFile,
  createUpdateIdentityTransaction,
  hexToBytes,
  type PortableCredentials,
} from "@/lib/crypto";
import { submitTransaction } from "@/modules/identity/IdentityService";
import { debugLog, debugError } from "@/lib/debug-logger";

// Dynamic import to prevent SSR issues with password dialog
const PasswordDialog = dynamic(
  () => import("@/components/layout/PasswordDialog").then((mod) => mod.PasswordDialog),
  { ssr: false }
);

type SaveState = "idle" | "saving" | "success" | "error";

export default function AccountPage() {
  const router = useRouter();
  const { isAuthenticated, currentUser, credentials, setCurrentUser } = useAppStore();

  // Local state
  const [editedName, setEditedName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Initialize name from store when component mounts
  useEffect(() => {
    if (currentUser?.displayName) {
      setEditedName(currentUser.displayName);
    }
  }, [currentUser?.displayName]);

  // Redirect to auth page if not authenticated
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCheckingAuth(false);
      if (!isAuthenticated) {
        router.replace("/auth");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  // Check if name has been modified
  const originalName = currentUser?.displayName || "";
  const hasNameChanged = editedName !== originalName && editedName.trim() !== "";

  // Handle save button click - submits UpdateIdentity transaction
  const handleSave = async () => {
    if (!hasNameChanged || !credentials) return;

    setSaveState("saving");
    setSaveError(null);

    try {
      debugLog(`[AccountPage] Creating UpdateIdentity transaction for: ${editedName}`);

      // Convert hex private key to Uint8Array
      const signingPrivateKeyBytes = hexToBytes(credentials.signingPrivateKey);

      // Create and sign the UpdateIdentity transaction
      const signedTransaction = await createUpdateIdentityTransaction(
        editedName,
        signingPrivateKeyBytes,
        credentials.signingPublicKey
      );

      debugLog("[AccountPage] Submitting UpdateIdentity transaction...");

      // Submit transaction to blockchain
      const result = await submitTransaction(signedTransaction);

      if (!result.successful) {
        throw new Error(result.message || "Transaction failed");
      }

      debugLog("[AccountPage] UpdateIdentity transaction submitted successfully");

      // Update local store with new display name
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          displayName: editedName,
          initials: editedName.substring(0, 2).toUpperCase(),
        });
      }

      setSaveState("success");

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    } catch (error) {
      debugError("[AccountPage] Failed to save display name:", error);
      setSaveState("error");
      setSaveError(
        error instanceof Error ? error.message : "Failed to save display name"
      );

      // Reset to idle after 3 seconds so user can retry
      setTimeout(() => {
        setSaveState("idle");
        setSaveError(null);
      }, 3000);
    }
  };

  // Handle Download Keys
  const handleDownloadKeys = () => {
    if (!credentials) return;
    setShowPasswordDialog(true);
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!credentials || !currentUser) return;

    try {
      const portableCredentials: PortableCredentials = {
        ProfileName: currentUser.displayName || "User",
        PublicSigningAddress: credentials.signingPublicKey,
        PrivateSigningKey: credentials.signingPrivateKey,
        PublicEncryptAddress: credentials.encryptionPublicKey,
        PrivateEncryptKey: credentials.encryptionPrivateKey,
        IsPublic: false,
        Mnemonic: credentials.mnemonic?.join(" ") || null,
      };

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
  };

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  // Show loading while checking auth
  if (isCheckingAuth || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-hush-bg-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-hush-purple" />
      </div>
    );
  }

  // Derive save button content
  const getSaveButtonContent = () => {
    switch (saveState) {
      case "saving":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </>
        );
      case "success":
        return (
          <>
            <Check className="w-4 h-4" />
            <span>Saved!</span>
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Failed</span>
          </>
        );
      default:
        return (
          <>
            <Save className="w-4 h-4" />
            <span>Save</span>
          </>
        );
    }
  };

  const isSaveDisabled = !hasNameChanged || saveState !== "idle";

  return (
    <div className="min-h-screen bg-hush-bg-dark">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-hush-bg-element transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-hush-text-primary" />
          </button>
          <h1 className="text-lg font-medium text-hush-text-primary">
            Account Details
          </h1>
        </div>

        {/* Display Name Section */}
        <section className="bg-hush-bg-element rounded-xl p-4 mb-4">
          <label
            htmlFor="display-name"
            className="text-xs font-semibold text-hush-text-accent uppercase tracking-wider"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="w-full mt-2 px-3 py-2 bg-hush-bg-dark border border-hush-bg-light rounded-lg text-sm text-hush-text-primary focus:outline-none focus:ring-2 focus:ring-hush-purple"
            placeholder="Enter your display name"
          />
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className={`
              mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${isSaveDisabled
                ? "bg-hush-bg-light text-hush-text-accent cursor-not-allowed"
                : "bg-hush-purple text-white hover:bg-hush-purple/90"
              }
              ${saveState === "success" ? "bg-green-600 text-white" : ""}
              ${saveState === "error" ? "bg-red-600 text-white" : ""}
            `}
          >
            {getSaveButtonContent()}
          </button>
          {saveError && (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {saveError}
            </p>
          )}
        </section>

        {/* Backup Section */}
        <section className="bg-hush-bg-element rounded-xl p-4 mb-4">
          <label className="text-xs font-semibold text-hush-text-accent uppercase tracking-wider">
            Backup
          </label>
          <button
            onClick={handleDownloadKeys}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-hush-bg-dark border border-hush-bg-light rounded-lg text-sm text-hush-text-primary hover:border-hush-purple hover:text-hush-purple transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Keys</span>
          </button>
          <p className="mt-2 text-xs text-hush-text-accent">
            Keep your keys safe! You&apos;ll need them to recover your account.
          </p>
        </section>

        {/* Public Keys Section */}
        <section className="bg-hush-bg-element rounded-xl p-4">
          <label className="text-xs font-semibold text-hush-text-accent uppercase tracking-wider mb-3 block">
            Public Keys
          </label>
          <div className="space-y-4">
            <KeyDisplayField
              label="Signing Key"
              value={credentials?.signingPublicKey || ""}
              description="Used to sign transactions and verify your identity"
            />
            <KeyDisplayField
              label="Encryption Key"
              value={credentials?.encryptionPublicKey || ""}
              description="Used to encrypt private messages to you"
            />
          </div>
        </section>
      </div>

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
    </div>
  );
}
