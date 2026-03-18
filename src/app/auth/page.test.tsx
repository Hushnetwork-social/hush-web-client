import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuthPage from "./page";
import { FEEDS_HOME_ROUTE } from "@/lib/navigation/appRoutes";

const mockPush = vi.fn();
const setAuthenticatedMock = vi.fn();
const setLoadingMock = vi.fn();
const setCurrentUserMock = vi.fn();
const setCredentialsMock = vi.fn();
const setFeedsMock = vi.fn();
const setMessagesMock = vi.fn();
const markIdentityCreatedByAuthPageMock = vi.fn();
const createIdentityTransactionMock = vi.fn();
const createPersonalFeedTransactionMock = vi.fn();
const importFromEncryptedBytesMock = vi.fn();

let returnToParam: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "returnTo" ? returnToParam : null),
  }),
}));

vi.mock("@/stores", () => ({
  useAppStore: () => ({
    setAuthenticated: setAuthenticatedMock,
    setLoading: setLoadingMock,
    setCurrentUser: setCurrentUserMock,
    setCredentials: setCredentialsMock,
  }),
}));

vi.mock("@/modules/blockchain", () => ({
  useBlockchainStore: (selector: (state: { blockHeight: number }) => unknown) => selector({ blockHeight: 123 }),
}));

vi.mock("@/modules/feeds", () => ({
  useFeedsStore: {
    getState: () => ({
      setFeeds: setFeedsMock,
      setMessages: setMessagesMock,
    }),
  },
}));

vi.mock("@/lib/crypto", () => ({
  generateMnemonic: () =>
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega",
  validateMnemonic: () => true,
  deriveKeysFromMnemonic: () => ({
    signingKey: {
      publicKeyHex: "signing-public-key",
      privateKey: new Uint8Array([1, 2, 3]),
    },
    encryptionKey: {
      publicKeyHex: "encryption-public-key",
      privateKey: new Uint8Array([4, 5, 6]),
    },
  }),
  bytesToHex: () => "deadbeef",
  createIdentityTransaction: (...args: unknown[]) => createIdentityTransactionMock(...args),
  createPersonalFeedTransaction: (...args: unknown[]) => createPersonalFeedTransactionMock(...args),
  importFromEncryptedBytes: (...args: unknown[]) => importFromEncryptedBytesMock(...args),
}));

vi.mock("@/modules/identity", () => ({
  markIdentityCreatedByAuthPage: () => markIdentityCreatedByAuthPageMock(),
}));

vi.mock("@/lib/api-config", () => ({
  buildApiUrl: (path: string) => path,
}));

vi.mock("@/lib/version", () => ({
  getVersionDisplay: () => "v-test",
}));

function createJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe("AuthPage", () => {
  beforeEach(() => {
    returnToParam = null;
    mockPush.mockReset();
    setAuthenticatedMock.mockReset();
    setLoadingMock.mockReset();
    setCurrentUserMock.mockReset();
    setCredentialsMock.mockReset();
    setFeedsMock.mockReset();
    setMessagesMock.mockReset();
    markIdentityCreatedByAuthPageMock.mockReset();
    createIdentityTransactionMock.mockReset();
    createPersonalFeedTransactionMock.mockReset();
    importFromEncryptedBytesMock.mockReset();
    createIdentityTransactionMock.mockResolvedValue({ tx: "identity" });
    createPersonalFeedTransactionMock.mockResolvedValue({ signedTransaction: { tx: "feed" } });
    importFromEncryptedBytesMock.mockResolvedValue({
      PublicSigningAddress: "backup-signing-public-key",
      PrivateSigningKey: "backup-signing-private-key",
      PublicEncryptAddress: "backup-encryption-public-key",
      PrivateEncryptKey: "backup-encryption-private-key",
      Mnemonic: "alpha beta gamma",
      ProfileName: "Backup User",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/identity/check")) {
          return createJsonResponse({
            exists: true,
            identity: {
              profileName: "Recovered User",
            },
          });
        }

        if (url.includes("/api/blockchain/submit")) {
          return createJsonResponse({
            successful: true,
            message: "ok",
          });
        }

        if (url.includes("/api/feeds/has-personal")) {
          return createJsonResponse({
            hasPersonalFeed: false,
          });
        }

        if (url.includes("/api/feeds/list")) {
          return createJsonResponse({
            feeds: [],
          });
        }

        if (url.includes("/api/feeds/messages")) {
          return createJsonResponse({
            messages: [],
          });
        }

        return createJsonResponse({});
      })
    );
  });

  it("routes new-account creation to a validated social return target", async () => {
    returnToParam = "/social/post/post-123";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/identity/check")) {
          return createJsonResponse({ exists: false });
        }
        if (url.includes("/api/blockchain/submit")) {
          return createJsonResponse({ successful: true, message: "ok" });
        }
        if (url.includes("/api/feeds/has-personal")) {
          return createJsonResponse({ hasPersonalFeed: false });
        }
        if (url.includes("/api/feeds/list")) {
          return createJsonResponse({ feeds: [] });
        }
        if (url.includes("/api/feeds/messages")) {
          return createJsonResponse({ messages: [] });
        }
        return createJsonResponse({});
      })
    );

    render(<AuthPage />);

    fireEvent.change(screen.getByTestId("display-name-input"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByTestId("create-identity-button"));
    fireEvent.click(
      screen.getByLabelText("I have securely saved my recovery words")
    );
    fireEvent.click(screen.getByTestId("submit-identity-button"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/social/post/post-123");
    });
  });

  it("routes mnemonic import to a validated social return target", async () => {
    returnToParam = "/social/post/post-456";

    render(<AuthPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import Keys" })[0]);
    fireEvent.change(
      screen.getByPlaceholderText("Enter all 24 words separated by spaces"),
      { target: { value: "alpha beta gamma" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Recover Account" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/social/post/post-456");
    });
  });

  it("routes backup import to a validated social return target", async () => {
    returnToParam = "/social/post/post-789";

    render(<AuthPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import Keys" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Backup File" }));

    const backupFile = new File(["backup"], "backup.dat", { type: "application/octet-stream" });
    Object.defineProperty(backupFile, "arrayBuffer", {
      value: vi.fn(async () => new TextEncoder().encode("backup").buffer),
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [backupFile],
      },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter backup password"), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Import Keys" })[1]);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/social/post/post-789");
    });
  });

  it("falls back safely to feeds home when the return target is invalid", async () => {
    returnToParam = "https://example.com/social/post/post-999";

    render(<AuthPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import Keys" })[0]);
    fireEvent.change(
      screen.getByPlaceholderText("Enter all 24 words separated by spaces"),
      { target: { value: "alpha beta gamma" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Recover Account" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(FEEDS_HOME_ROUTE);
    });
  });
});
