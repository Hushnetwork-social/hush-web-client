/**
 * Notification Service
 *
 * Handles real-time notifications via gRPC server streaming and unread count management.
 * Uses gRPC-Web protocol for browser compatibility.
 *
 * NOTE: This service runs CLIENT-SIDE in the browser, unlike other services that use
 * API routes. It must use browser-compatible APIs (no Node.js Buffer).
 */

import {
  buildSubscribeToEventsRequest,
  buildMarkFeedAsReadRequest,
  buildGetUnreadCountsRequest,
  buildRegisterDeviceTokenRequest,
  parseFeedEventResponse,
  parseMarkFeedAsReadResponse,
  parseGetUnreadCountsResponse,
  parseRegisterDeviceTokenResponse,
  parseGrpcResponse,
  PushPlatform,
  type FeedEventResponse,
  type PushPlatformType,
  type RegisterDeviceTokenResult,
} from '../grpc-web-helper';
import { debugLog, debugError } from '@/lib/debug-logger';

// Client-side gRPC URL (port 4666 for gRPC-Web HTTP/1.1)
const GRPC_WEB_URL = process.env.NEXT_PUBLIC_GRPC_URL || 'http://localhost:4666';
const SERVICE_NAME = 'rpcHush.HushNotification';

// Log the gRPC URL on module load (critical for debugging production issues)
if (typeof window !== 'undefined') {
  console.log('[NotificationService] gRPC URL:', GRPC_WEB_URL);
}

/**
 * Browser-compatible gRPC-Web call (doesn't use Node.js Buffer)
 */
async function browserGrpcCall(
  service: string,
  method: string,
  requestBytes: Uint8Array
): Promise<Uint8Array> {
  const url = `${GRPC_WEB_URL}/${service}/${method}`;

  // Create gRPC frame
  const frame = new Uint8Array(5 + requestBytes.length);
  frame[0] = 0; // No compression
  frame[1] = (requestBytes.length >> 24) & 0xff;
  frame[2] = (requestBytes.length >> 16) & 0xff;
  frame[3] = (requestBytes.length >> 8) & 0xff;
  frame[4] = requestBytes.length & 0xff;
  frame.set(requestBytes, 5);

  debugLog(`[NotificationService] Calling ${service}/${method} at ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web+proto',
      'Accept': 'application/grpc-web+proto',
      'X-Grpc-Web': '1',
    },
    body: frame, // Use Uint8Array directly (browser compatible)
  });

  if (!response.ok) {
    throw new Error(`gRPC call failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export type FeedEventCallback = (event: FeedEventResponse) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * Subscribe to real-time notification events via server streaming.
 *
 * @param userId - The user's public signing address
 * @param onEvent - Callback for each received event
 * @param onError - Callback for errors
 * @param onStreamEnd - Callback when stream ends normally (server-initiated close, not user abort)
 * @param deviceId - Optional device identifier for debugging
 * @param platform - Optional platform identifier ('browser', 'tauri', etc.)
 * @returns AbortController to cancel the subscription
 */
export function subscribeToEvents(
  userId: string,
  onEvent: FeedEventCallback,
  onError?: ErrorCallback,
  onStreamEnd?: () => void,
  deviceId?: string,
  platform: string = 'browser'
): AbortController {
  const abortController = new AbortController();

  const requestBytes = buildSubscribeToEventsRequest(userId, deviceId, platform);
  const url = `${GRPC_WEB_URL}/${SERVICE_NAME}/SubscribeToEvents`;

  // Create gRPC-Web frame
  const frame = new Uint8Array(5 + requestBytes.length);
  frame[0] = 0; // No compression
  frame[1] = (requestBytes.length >> 24) & 0xff;
  frame[2] = (requestBytes.length >> 16) & 0xff;
  frame[3] = (requestBytes.length >> 8) & 0xff;
  frame[4] = requestBytes.length & 0xff;
  frame.set(requestBytes, 5);

  // Always log subscription attempts (critical for debugging)
  console.log(`[NotificationService] Subscribing to events at ${url}`);

  // Use fetch with streaming response
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web+proto',
      'Accept': 'application/grpc-web+proto',
      'X-Grpc-Web': '1',
    },
    body: frame,
    signal: abortController.signal,
  })
    .then(async (response) => {
      console.log(`[NotificationService] Response received: status=${response.status}, ok=${response.ok}`);
      if (!response.ok) {
        throw new Error(`gRPC streaming failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null - streaming not supported');
      }

      console.log(`[NotificationService] Stream connected, reading events...`);

      const reader = response.body.getReader();
      let buffer = new Uint8Array(0);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log(`[NotificationService] Stream ended`);
            break;
          }

          // Append new data to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // Process complete frames from buffer
          while (buffer.length >= 5) {
            const flag = buffer[0];
            const messageLength =
              (buffer[1] << 24) |
              (buffer[2] << 16) |
              (buffer[3] << 8) |
              buffer[4];

            // Check if we have the complete message
            if (buffer.length < 5 + messageLength) {
              break; // Wait for more data
            }

            // Extract message bytes
            const messageBytes = buffer.slice(5, 5 + messageLength);

            // Remove processed frame from buffer
            buffer = buffer.slice(5 + messageLength);

            // Data frame (flag = 0)
            if (flag === 0 && messageLength > 0) {
              try {
                const event = parseFeedEventResponse(messageBytes);
                console.log(`[NotificationService] Received event: type=${event.type}, feedId=${event.feedId?.substring(0, 8)}..., unreadCount=${event.unreadCount}`);
                onEvent(event);
              } catch (parseError) {
                console.error(`[NotificationService] Failed to parse event:`, parseError);
              }
            }
            // Trailer frame (flag = 128) - contains status
            else if (flag === 128) {
              console.log(`[NotificationService] Received trailer frame (end of stream or error)`);
            }
          }
        }
        // Stream ended normally (server closed the stream)
        // Only notify caller if the stream wasn't aborted by the user
        if (!abortController.signal.aborted && onStreamEnd) {
          debugLog(`[NotificationService] Stream ended, notifying caller`);
          onStreamEnd();
        }
      } catch (readError) {
        if (abortController.signal.aborted) {
          debugLog(`[NotificationService] Stream aborted by user`);
        } else {
          throw readError;
        }
      }
    })
    .catch((error) => {
      if (!abortController.signal.aborted) {
        console.error(`[NotificationService] Stream error:`, error);
        onError?.(error);
      } else {
        console.log(`[NotificationService] Stream aborted (user navigation or cleanup)`);
      }
    });

  return abortController;
}

/**
 * Mark a feed as read up to a given block index.
 *
 * @param userId - The user's public signing address
 * @param feedId - The feed ID to mark as read
 * @param upToBlockIndex - Optional block index watermark (0 or omitted = mark all as read)
 * @returns Promise resolving to success status
 */
export async function markFeedAsRead(
  userId: string,
  feedId: string,
  upToBlockIndex?: number
): Promise<{ success: boolean }> {
  try {
    const requestBytes = buildMarkFeedAsReadRequest(userId, feedId, upToBlockIndex);
    const responseBytes = await browserGrpcCall(SERVICE_NAME, 'MarkFeedAsRead', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return { success: false };
    }

    const response = parseMarkFeedAsReadResponse(messageBytes);
    debugLog(`[NotificationService] MarkFeedAsRead response:`, response);
    return response;
  } catch (error) {
    debugError(`[NotificationService] MarkFeedAsRead error:`, error);
    return { success: false };
  }
}

/**
 * Get current unread counts for all feeds of a user.
 *
 * @param userId - The user's public signing address
 * @returns Promise resolving to a map of feedId -> unread count
 */
export async function getUnreadCounts(
  userId: string
): Promise<Record<string, number>> {
  try {
    const requestBytes = buildGetUnreadCountsRequest(userId);
    const responseBytes = await browserGrpcCall(SERVICE_NAME, 'GetUnreadCounts', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return {};
    }

    const response = parseGetUnreadCountsResponse(messageBytes);
    debugLog(`[NotificationService] GetUnreadCounts response:`, response);
    return response.counts;
  } catch (error) {
    debugError(`[NotificationService] GetUnreadCounts error:`, error);
    return {};
  }
}

/**
 * Register a device token for push notifications.
 *
 * @param userId - The user's public signing address
 * @param platform - The push platform (ANDROID, IOS, WEB)
 * @param token - The FCM/APNs token
 * @param deviceName - Optional device name for user reference
 * @returns Promise resolving to registration result
 */
export async function registerDeviceToken(
  userId: string,
  platform: PushPlatformType,
  token: string,
  deviceName?: string
): Promise<RegisterDeviceTokenResult> {
  try {
    const requestBytes = buildRegisterDeviceTokenRequest(userId, platform, token, deviceName);
    const responseBytes = await browserGrpcCall(SERVICE_NAME, 'RegisterDeviceToken', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return { success: false, message: 'Empty response from server' };
    }

    const response = parseRegisterDeviceTokenResponse(messageBytes);
    debugLog(`[NotificationService] RegisterDeviceToken response:`, response);
    return response;
  } catch (error) {
    debugError(`[NotificationService] RegisterDeviceToken error:`, error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export { PushPlatform, type PushPlatformType, type RegisterDeviceTokenResult };

export const notificationService = {
  subscribeToEvents,
  markFeedAsRead,
  getUnreadCounts,
  registerDeviceToken,
};
