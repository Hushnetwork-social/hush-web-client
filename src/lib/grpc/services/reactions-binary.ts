import { buildApiUrl } from '@/lib/api-config';

export interface ECPointBytes {
  x: Uint8Array;
  y: Uint8Array;
}

export interface ReactionTally {
  messageId: string;
  tallyC1: ECPointBytes[];
  tallyC2: ECPointBytes[];
  totalCount: number;
}

interface ReactionTallyDto {
  messageId: string;
  tallyC1: { x: string; y: string }[];
  tallyC2: { x: string; y: string }[];
  reactionCount: number;
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/**
 * Fetch reaction tallies through the Next.js API proxy.
 *
 * This avoids long-lived direct browser gRPC calls to `host.docker.internal`,
 * which were the unstable hop in HushSocial E2E observer refresh flows.
 */
export async function getTallies(feedId: string, messageIds: string[]): Promise<ReactionTally[]> {
  const requestUrl = buildApiUrl('/api/reactions/tallies');
  const resolvedUrl =
    requestUrl.startsWith('/') && typeof window !== 'undefined'
      ? `${window.location.origin}${requestUrl}`
      : requestUrl;

  const response = await fetch(resolvedUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feedId, messageIds }),
  });

  if (!response.ok) {
    throw new Error(`Reaction tallies proxy failed: ${response.status}`);
  }

  const payload = (await response.json()) as { tallies?: ReactionTallyDto[] };
  const tallies = payload.tallies ?? [];

  return tallies.map((tally) => ({
    messageId: tally.messageId,
    tallyC1: tally.tallyC1.map((point) => ({
      x: base64ToBytes(point.x),
      y: base64ToBytes(point.y),
    })),
    tallyC2: tally.tallyC2.map((point) => ({
      x: base64ToBytes(point.x),
      y: base64ToBytes(point.y),
    })),
    totalCount: tally.reactionCount,
  }));
}
