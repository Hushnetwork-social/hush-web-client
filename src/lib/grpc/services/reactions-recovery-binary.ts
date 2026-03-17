import { buildApiUrl } from "@/lib/api-config";

const RECOVERY_PROXY_URL = "/api/reactions/recovery";

export interface ReactionBackupProxyResponse {
  exists: boolean;
  encryptedEmojiBackup: string;
}

async function postRecoveryRequest<T>(body: Record<string, string>): Promise<T> {
  const requestUrl = buildApiUrl(RECOVERY_PROXY_URL);
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reaction recovery proxy failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function getReactionBackup(
  nullifierBase64: string
): Promise<ReactionBackupProxyResponse> {
  const payload = await postRecoveryRequest<{
    success?: boolean;
    backup?: ReactionBackupProxyResponse;
  }>({
    action: "backup",
    nullifier: nullifierBase64,
  });

  return {
    exists: payload.backup?.exists ?? false,
    encryptedEmojiBackup: payload.backup?.encryptedEmojiBackup ?? "",
  };
}

export async function nullifierExists(nullifierBase64: string): Promise<boolean> {
  const payload = await postRecoveryRequest<{
    success?: boolean;
    nullifierExists?: boolean;
  }>({
    action: "nullifier-exists",
    nullifier: nullifierBase64,
  });

  return payload.nullifierExists ?? false;
}
