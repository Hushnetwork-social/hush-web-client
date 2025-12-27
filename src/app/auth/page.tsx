"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Download, Key, FolderOpen, Lock, RefreshCw, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds";
import { useBlockchainStore } from "@/modules/blockchain";
import {
  generateMnemonic,
  validateMnemonic,
  deriveKeysFromMnemonic,
  bytesToHex,
  createIdentityTransaction,
  createPersonalFeedTransaction,
  importFromEncryptedBytes,
} from "@/lib/crypto";
import { markIdentityCreatedByAuthPage } from "@/modules/identity";

type Tab = "create" | "import";
type ImportSubTab = "words" | "file";

// Status messages for account creation progress
type CreationStatus =
  | "deriving_keys"
  | "checking_identity"
  | "creating_identity"
  | "checking_feed"
  | "creating_feed"
  | "loading_data"
  | "done";

const STATUS_MESSAGES: Record<CreationStatus, string> = {
  deriving_keys: "Deriving keys from mnemonic...",
  checking_identity: "Checking blockchain for identity...",
  creating_identity: "Creating identity on blockchain...",
  checking_feed: "Checking for personal feed...",
  creating_feed: "Creating personal feed...",
  loading_data: "Loading your data...",
  done: "Account created!",
};

export default function AuthPage() {
  const router = useRouter();
  const { setAuthenticated, setLoading, setCurrentUser, setCredentials } = useAppStore();
  const blockHeight = useBlockchainStore((state) => state.blockHeight);

  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [importSubTab, setImportSubTab] = useState<ImportSubTab>("words");
  const [profileName, setProfileName] = useState("");
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [creationStatus, setCreationStatus] = useState<CreationStatus | null>(null);
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [hasSavedMnemonic, setHasSavedMnemonic] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateKeys = async () => {
    setIsGeneratingKeys(true);
    setError(null);
    try {
      // Generate real BIP-39 mnemonic (24 words)
      const mnemonic = generateMnemonic();
      setMnemonicWords(mnemonic.split(" "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate keys");
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsCreatingAccount(true);
    setCreationStatus("deriving_keys");
    setError(null);

    try {
      // 1. Derive keys from mnemonic
      const mnemonic = mnemonicWords.join(" ");
      const keys = deriveKeysFromMnemonic(mnemonic);

      // Create credentials object with hex-encoded keys
      const credentials = {
        signingPublicKey: keys.signingKey.publicKeyHex,
        signingPrivateKey: bytesToHex(keys.signingKey.privateKey),
        encryptionPublicKey: keys.encryptionKey.publicKeyHex,
        encryptionPrivateKey: bytesToHex(keys.encryptionKey.privateKey),
        mnemonic: mnemonicWords,
      };

      // 2. Check if identity exists in blockchain
      setCreationStatus("checking_identity");
      const identityCheckResponse = await fetch(
        `/api/identity/check?address=${encodeURIComponent(keys.signingKey.publicKeyHex)}`
      );
      const identityCheck = await identityCheckResponse.json();

      let userDisplayName = profileName;

      if (!identityCheck.exists) {
        // 3. Create identity on blockchain
        setCreationStatus("creating_identity");
        const identityTx = await createIdentityTransaction(profileName, keys, false);

        const submitResponse = await fetch("/api/blockchain/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedTransaction: identityTx }),
        });
        const submitResult = await submitResponse.json();

        if (!submitResult.successful) {
          throw new Error(submitResult.message || "Failed to create identity");
        }

        // Mark that we just created identity - prevents IdentitySyncable from duplicating
        markIdentityCreatedByAuthPage();
      } else {
        // Use existing profile name from blockchain
        userDisplayName = identityCheck.identity?.profileName || profileName;
      }

      // 4. Check for personal feed
      setCreationStatus("checking_feed");
      const feedCheckResponse = await fetch(
        `/api/feeds/has-personal?address=${encodeURIComponent(keys.signingKey.publicKeyHex)}`
      );
      const feedCheck = await feedCheckResponse.json();

      if (!feedCheck.hasPersonalFeed) {
        // 5. Create personal feed with encrypted feed key
        setCreationStatus("creating_feed");
        const { signedTransaction: feedTx } = await createPersonalFeedTransaction(keys);

        const feedSubmitResponse = await fetch("/api/blockchain/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedTransaction: feedTx }),
        });
        const feedSubmitResult = await feedSubmitResponse.json();

        if (!feedSubmitResult.successful) {
          throw new Error(feedSubmitResult.message || "Failed to create personal feed");
        }
      }

      // 6. Load feeds and messages
      setCreationStatus("loading_data");
      const feedsResponse = await fetch(
        `/api/feeds/list?address=${encodeURIComponent(keys.signingKey.publicKeyHex)}&blockIndex=0`
      );
      const feedsData = await feedsResponse.json();

      if (feedsData.feeds) {
        useFeedsStore.getState().setFeeds(
          feedsData.feeds.map((feed: { feedId: string; feedTitle: string; feedOwner: string; feedType: number; blockIndex: number; participants: { participantPublicAddress: string }[] }) => ({
            id: feed.feedId,
            type: feed.feedType === 0 ? "personal" : feed.feedType === 1 ? "chat" : "group",
            name: feed.feedTitle,
            participants: feed.participants.map((p: { participantPublicAddress: string }) => p.participantPublicAddress),
            unreadCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        );

        // Load messages for each feed
        for (const feed of feedsData.feeds) {
          const messagesResponse = await fetch(
            `/api/feeds/messages?address=${encodeURIComponent(keys.signingKey.publicKeyHex)}&blockIndex=0`
          );
          const messagesData = await messagesResponse.json();

          if (messagesData.messages) {
            const feedMessages = messagesData.messages
              .filter((m: { feedId: string }) => m.feedId === feed.feedId)
              .map((m: { feedMessageId: string; feedId: string; issuerPublicAddress: string; messageContent: string; timestamp: string | null; blockIndex: number }) => ({
                id: m.feedMessageId,
                feedId: m.feedId,
                senderPublicKey: m.issuerPublicAddress,
                content: m.messageContent,
                timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
                blockHeight: m.blockIndex,
                isConfirmed: true,
              }));

            if (feedMessages.length > 0) {
              useFeedsStore.getState().setMessages(feed.feedId, feedMessages);
            }
          }
        }
      }

      // Create user object
      const user = {
        publicKey: keys.signingKey.publicKeyHex,
        displayName: userDisplayName,
        initials: userDisplayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
      };

      setCreationStatus("done");

      // Update store with credentials and user
      setCredentials(credentials);
      setCurrentUser(user);
      setLoading(false);
      setAuthenticated(true);

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("[Auth] Account creation failed:", err);
      setLoading(false);
      setError(err instanceof Error ? err.message : "Failed to create account");
      setIsCreatingAccount(false);
      setCreationStatus(null);
    }
  };

  const handleImportFromWords = async () => {
    setIsCreatingAccount(true);
    setCreationStatus("deriving_keys");
    setError(null);

    try {
      const mnemonic = importMnemonic.trim().toLowerCase();

      // Validate mnemonic
      if (!validateMnemonic(mnemonic)) {
        throw new Error("Invalid recovery words. Please check and try again.");
      }

      // Derive keys from mnemonic
      const keys = deriveKeysFromMnemonic(mnemonic);

      // Create credentials object
      const credentials = {
        signingPublicKey: keys.signingKey.publicKeyHex,
        signingPrivateKey: bytesToHex(keys.signingKey.privateKey),
        encryptionPublicKey: keys.encryptionKey.publicKeyHex,
        encryptionPrivateKey: bytesToHex(keys.encryptionKey.privateKey),
        mnemonic: mnemonic.split(" "),
      };

      // Check if identity exists
      setCreationStatus("checking_identity");
      const identityCheckResponse = await fetch(
        `/api/identity/check?address=${encodeURIComponent(keys.signingKey.publicKeyHex)}`
      );
      const identityCheck = await identityCheckResponse.json();

      if (!identityCheck.exists) {
        throw new Error("No identity found for these recovery words. Please create a new account instead.");
      }

      // Load user data
      setCreationStatus("loading_data");
      const feedsResponse = await fetch(
        `/api/feeds/list?address=${encodeURIComponent(keys.signingKey.publicKeyHex)}&blockIndex=0`
      );
      const feedsData = await feedsResponse.json();

      if (feedsData.feeds) {
        useFeedsStore.getState().setFeeds(
          feedsData.feeds.map((feed: { feedId: string; feedTitle: string; feedOwner: string; feedType: number; blockIndex: number; participants: { participantPublicAddress: string }[] }) => ({
            id: feed.feedId,
            type: feed.feedType === 0 ? "personal" : feed.feedType === 1 ? "chat" : "group",
            name: feed.feedTitle,
            participants: feed.participants.map((p: { participantPublicAddress: string }) => p.participantPublicAddress),
            unreadCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        );
      }

      // Create user object from identity
      const user = {
        publicKey: keys.signingKey.publicKeyHex,
        displayName: identityCheck.identity?.profileName || "Recovered User",
        initials: (identityCheck.identity?.profileName || "RU")
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      };

      setCreationStatus("done");

      // Update store
      setCredentials(credentials);
      setCurrentUser(user);
      setLoading(false);
      setAuthenticated(true);

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("[Auth] Import failed:", err);
      setLoading(false);
      setError(err instanceof Error ? err.message : "Failed to import account");
      setIsCreatingAccount(false);
      setCreationStatus(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleImportFromFile = async () => {
    if (!selectedFile || !importPassword.trim()) {
      setError("Please select a file and enter your password");
      return;
    }

    setIsCreatingAccount(true);
    setCreationStatus("deriving_keys");
    setError(null);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      const encryptedData = new Uint8Array(arrayBuffer);

      // Decrypt the file
      const portableCredentials = await importFromEncryptedBytes(encryptedData, importPassword);

      // Create credentials object from portable credentials
      const credentials = {
        signingPublicKey: portableCredentials.PublicSigningAddress,
        signingPrivateKey: portableCredentials.PrivateSigningKey,
        encryptionPublicKey: portableCredentials.PublicEncryptAddress,
        encryptionPrivateKey: portableCredentials.PrivateEncryptKey,
        mnemonic: portableCredentials.Mnemonic ? portableCredentials.Mnemonic.split(" ") : [],
      };

      // Check if identity exists
      setCreationStatus("checking_identity");
      const identityCheckResponse = await fetch(
        `/api/identity/check?address=${encodeURIComponent(credentials.signingPublicKey)}`
      );
      const identityCheck = await identityCheckResponse.json();

      if (!identityCheck.exists) {
        throw new Error("No identity found for this backup file. The account may not exist on this network.");
      }

      // Load user data
      setCreationStatus("loading_data");
      const feedsResponse = await fetch(
        `/api/feeds/list?address=${encodeURIComponent(credentials.signingPublicKey)}&blockIndex=0`
      );
      const feedsData = await feedsResponse.json();

      if (feedsData.feeds) {
        useFeedsStore.getState().setFeeds(
          feedsData.feeds.map((feed: { feedId: string; feedTitle: string; feedOwner: string; feedType: number; blockIndex: number; participants: { participantPublicAddress: string }[] }) => ({
            id: feed.feedId,
            type: feed.feedType === 0 ? "personal" : feed.feedType === 1 ? "chat" : "group",
            name: feed.feedTitle,
            participants: feed.participants.map((p: { participantPublicAddress: string }) => p.participantPublicAddress),
            unreadCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        );
      }

      // Create user object from identity or portable credentials
      const displayName = identityCheck.identity?.profileName || portableCredentials.ProfileName || "Restored User";
      const user = {
        publicKey: credentials.signingPublicKey,
        displayName,
        initials: displayName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      };

      setCreationStatus("done");

      // Update store
      setCredentials(credentials);
      setCurrentUser(user);
      setLoading(false);
      setAuthenticated(true);

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("[Auth] Import from file failed:", err);
      setLoading(false);
      setError(err instanceof Error ? err.message : "Failed to import from backup file");
      setIsCreatingAccount(false);
      setCreationStatus(null);
    }
  };

  const canCreateAccount = profileName.trim() && mnemonicWords.length > 0 && hasSavedMnemonic;

  return (
    <main className="min-h-screen bg-hush-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-hush-bg-element rounded-2xl overflow-hidden shadow-2xl">
          {/* Tab Header */}
          <div className="flex bg-hush-bg-element">
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 border-b-2 transition-colors ${
                activeTab === "create"
                  ? "border-hush-purple text-hush-purple font-semibold"
                  : "border-transparent text-hush-text-accent hover:text-hush-purple"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-sm">Create Account</span>
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 border-b-2 transition-colors ${
                activeTab === "import"
                  ? "border-hush-purple text-hush-purple font-semibold"
                  : "border-transparent text-hush-text-accent hover:text-hush-purple"
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Import Keys</span>
            </button>
          </div>

          {/* Create Account Tab */}
          {activeTab === "create" && (
            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Profile Name */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-hush-text-accent">
                  Profile Name / Alias
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="E.g., Satoshi Nakamoto"
                  className="w-full px-3 py-2.5 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-text-primary placeholder-hush-text-accent/50 focus:border-hush-purple outline-none text-sm"
                />
              </div>

              {/* Recovery Words Section */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-hush-purple">
                  Your Recovery Words (SAVE THESE!)
                </h3>

                {isGeneratingKeys ? (
                  <div className="bg-hush-bg-element border border-hush-purple/50 rounded-lg p-6 flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-3 border-hush-purple/30 border-t-hush-purple rounded-full animate-spin" />
                    <p className="text-sm text-hush-purple font-medium">Generating secure keys...</p>
                    <p className="text-xs text-hush-text-accent">This may take a few seconds</p>
                  </div>
                ) : mnemonicWords.length > 0 ? (
                  <>
                    <div className="bg-hush-bg-element border border-hush-purple/50 rounded-lg p-3">
                      <div className="flex flex-wrap gap-2">
                        {mnemonicWords.map((word, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[#1a1f2e] rounded text-xs font-mono text-hush-text-accent"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(mnemonicWords.join(" "))}
                        className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-purple hover:bg-hush-bg-hover transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        <span className="text-sm">Copy Words</span>
                      </button>
                      <button
                        onClick={handleGenerateKeys}
                        className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-purple hover:bg-hush-bg-hover transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-sm">Regenerate</span>
                      </button>
                    </div>

                    {/* Warning */}
                    <div className="bg-[#2a1f1f] border border-[#5c3d3d] rounded-lg p-3">
                      <p className="text-xs text-[#e8a5a5] text-center">
                        Write these words down and store them securely. They are the ONLY way to recover your account.
                      </p>
                    </div>

                    {/* Confirmation */}
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasSavedMnemonic}
                        onChange={(e) => setHasSavedMnemonic(e.target.checked)}
                        className="w-4 h-4 rounded border-hush-purple/50 bg-hush-bg-element text-hush-purple focus:ring-hush-purple"
                      />
                      <span className="text-sm text-hush-text-primary">
                        I have securely saved my recovery words
                      </span>
                    </label>
                  </>
                ) : (
                  <button
                    onClick={handleGenerateKeys}
                    className="w-full py-3 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-purple hover:bg-hush-bg-hover transition-colors"
                  >
                    Generate Recovery Words
                  </button>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-[#2a1f1f] border border-[#5c3d3d] rounded-lg p-3">
                  <p className="text-xs text-[#e8a5a5] text-center">{error}</p>
                </div>
              )}

              {/* Create Button */}
              <button
                onClick={handleCreateAccount}
                disabled={!canCreateAccount || isCreatingAccount}
                className="w-full py-3 bg-hush-purple hover:bg-hush-purple-hover disabled:bg-hush-text-accent disabled:opacity-50 rounded-lg text-hush-bg-dark font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                {isCreatingAccount ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{creationStatus ? STATUS_MESSAGES[creationStatus] : "Creating Account..."}</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>

              {/* Footer */}
              <div className="flex flex-col items-center space-y-1 pt-2">
                <div className="flex items-center space-x-2">
                  <Lock className="w-3 h-3 text-hush-purple" />
                  <span className="text-[10px] text-hush-text-accent">Secured by HushNetwork</span>
                  <span className="text-[10px] text-hush-text-accent">•</span>
                  <span className="text-[10px] text-hush-purple">Blocks: {blockHeight}</span>
                </div>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === "import" && (
            <div className="space-y-4">
              {/* Sub-tabs */}
              <div className="flex bg-hush-bg-element p-1">
                <button
                  onClick={() => setImportSubTab("words")}
                  className={`flex-1 py-2 text-sm rounded transition-colors ${
                    importSubTab === "words"
                      ? "text-hush-purple border-b-2 border-hush-purple font-semibold"
                      : "text-hush-text-accent"
                  }`}
                >
                  Recovery Words
                </button>
                <button
                  onClick={() => setImportSubTab("file")}
                  className={`flex-1 py-2 text-sm rounded transition-colors ${
                    importSubTab === "file"
                      ? "text-hush-purple border-b-2 border-hush-purple font-semibold"
                      : "text-hush-text-accent"
                  }`}
                >
                  Backup File
                </button>
              </div>

              {/* Recovery Words Sub-tab */}
              {importSubTab === "words" && (
                <div className="p-4 space-y-5">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-hush-bg-element flex items-center justify-center">
                      <Key className="w-6 h-6 text-hush-purple" />
                    </div>
                    <h3 className="text-base font-bold text-hush-purple">Recover with Words</h3>
                    <p className="text-xs text-hush-text-accent text-center max-w-[280px]">
                      Enter your 24 recovery words to restore your account.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-hush-text-accent">
                      Your 24 Recovery Words
                    </label>
                    <textarea
                      value={importMnemonic}
                      onChange={(e) => setImportMnemonic(e.target.value)}
                      placeholder="Enter all 24 words separated by spaces"
                      rows={4}
                      className="w-full px-3 py-2.5 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-text-primary placeholder-hush-text-accent/50 focus:border-hush-purple outline-none text-sm resize-none"
                    />
                  </div>

                  <button
                    onClick={handleImportFromWords}
                    disabled={!importMnemonic.trim() || isCreatingAccount}
                    className="w-full py-3 bg-hush-purple hover:bg-hush-purple-hover disabled:opacity-50 rounded-lg text-hush-bg-dark font-semibold transition-colors flex items-center justify-center space-x-2"
                  >
                    {isCreatingAccount ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{creationStatus ? STATUS_MESSAGES[creationStatus] : "Recovering..."}</span>
                      </>
                    ) : (
                      <span>Recover Account</span>
                    )}
                  </button>
                </div>
              )}

              {/* Backup File Sub-tab */}
              {importSubTab === "file" && (
                <div className="p-4 space-y-5">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-hush-bg-element flex items-center justify-center">
                      <Download className="w-6 h-6 text-hush-purple" />
                    </div>
                    <h3 className="text-base font-bold text-hush-purple">Restore from Backup</h3>
                    <p className="text-xs text-hush-text-accent text-center max-w-[280px]">
                      Import your encrypted backup file (.dat) to restore your account.
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dat"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-text-primary hover:bg-hush-bg-hover transition-colors flex items-center justify-center space-x-2"
                  >
                    <FolderOpen className="w-5 h-5 text-hush-purple" />
                    <span className="text-sm">
                      {selectedFile ? selectedFile.name : "Select .dat file"}
                    </span>
                  </button>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-hush-text-accent">
                      Backup Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={importPassword}
                        onChange={(e) => setImportPassword(e.target.value)}
                        placeholder="Enter backup password"
                        className="w-full px-3 py-2.5 bg-hush-bg-element border border-hush-purple/50 rounded-lg text-hush-text-primary placeholder-hush-text-accent/50 focus:border-hush-purple outline-none text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-hush-text-accent hover:text-hush-purple"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-[#2a1f1f] border border-[#5c3d3d] rounded-lg p-3">
                      <p className="text-xs text-[#e8a5a5] text-center">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleImportFromFile}
                    disabled={!selectedFile || !importPassword.trim() || isCreatingAccount}
                    className="w-full py-3 bg-hush-purple hover:bg-hush-purple-hover disabled:opacity-50 rounded-lg text-hush-bg-dark font-semibold transition-colors flex items-center justify-center space-x-2"
                  >
                    {isCreatingAccount ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{creationStatus ? STATUS_MESSAGES[creationStatus] : "Importing..."}</span>
                      </>
                    ) : (
                      <span>Import Keys</span>
                    )}
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-col items-center space-y-1 pb-4">
                <div className="flex items-center space-x-2">
                  <Lock className="w-3 h-3 text-hush-purple" />
                  <span className="text-[10px] text-hush-text-accent">Secured by HushNetwork</span>
                  <span className="text-[10px] text-hush-text-accent">•</span>
                  <span className="text-[10px] text-hush-purple">Blocks: {blockHeight}</span>
                </div>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}
