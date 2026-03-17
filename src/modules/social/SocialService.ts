import type { CreateSocialPostContract } from "./contracts";
import { createCreateSocialPostTransaction, hexToBytes, type SocialPostAttachmentPayload } from "@/lib/crypto";
import { submitTransaction } from "@/modules/blockchain/BlockchainService";
import { useAppStore } from "@/stores";
import { initializeReactionsSystem } from "@/modules/reactions/initializeReactions";
import { useReactionsStore } from "@/modules/reactions/useReactionsStore";

export type CreateSocialPostResult = {
  success: boolean;
  message: string;
  errorCode?: string;
  permalink?: string;
  authorCommitment?: string;
};

type SocialAttachmentBlob = {
  attachmentId: string;
  bytes: Uint8Array;
};

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function bigintToFixed32Bytes(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function getAuthorCommitmentBase64(): Promise<string | undefined> {
  let userCommitment = useReactionsStore.getState().getUserCommitment();
  if (!userCommitment) {
    const mnemonic = useAppStore.getState().credentials?.mnemonic;
    if (mnemonic && mnemonic.length > 0) {
      const initialized = await initializeReactionsSystem(mnemonic);
      if (initialized) {
        userCommitment = useReactionsStore.getState().getUserCommitment();
      }
    }
  }

  return userCommitment
    ? toBase64(bigintToFixed32Bytes(userCommitment))
    : undefined;
}

export async function createSocialPost(
  contract: CreateSocialPostContract,
  signingPrivateKeyHex: string,
  attachmentBlobs: SocialAttachmentBlob[] = []
): Promise<CreateSocialPostResult> {
  const signingPrivateKey = hexToBytes(signingPrivateKeyHex);
  const attachments: SocialPostAttachmentPayload[] = contract.attachments.map((attachment) => ({
    AttachmentId: attachment.attachmentId,
    MimeType: attachment.mimeType,
    Size: attachment.size,
    FileName: attachment.fileName,
    Hash: attachment.hash,
    Kind: attachment.kind === "video" ? 1 : 0,
  }));

  const authorCommitmentBase64 = await getAuthorCommitmentBase64();

  const { signedTransaction } = await createCreateSocialPostTransaction(
    contract.postId,
    contract.postId,
    contract.authorPublicAddress,
    authorCommitmentBase64,
    contract.content,
    contract.audience.visibility,
    contract.audience.circleFeedIds,
    attachments,
    contract.createdAtUnixMs,
    signingPrivateKey
  );

  const result = await submitTransaction(
    signedTransaction,
    attachmentBlobs.map((attachment) => ({
      attachmentId: attachment.attachmentId,
      encryptedOriginal: toBase64(attachment.bytes),
      encryptedThumbnail: null,
    }))
  );
  return {
    success: result.successful,
    message: result.message,
    permalink: result.successful ? `/social/post/${contract.postId}` : undefined,
    authorCommitment: authorCommitmentBase64,
  };
}
