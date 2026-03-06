import type { CreateSocialPostContract } from "./contracts";
import { createCreateSocialPostTransaction, hexToBytes, type SocialPostAttachmentPayload } from "@/lib/crypto";
import { submitTransaction } from "@/modules/blockchain/BlockchainService";

export type CreateSocialPostResult = {
  success: boolean;
  message: string;
  errorCode?: string;
  permalink?: string;
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

  const { signedTransaction } = await createCreateSocialPostTransaction(
    contract.postId,
    contract.authorPublicAddress,
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
  };
}
