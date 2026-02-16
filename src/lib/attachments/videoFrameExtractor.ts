/**
 * FEAT-068: Video frame extraction.
 *
 * Extracts frames from video files using HTMLVideoElement + canvas.
 * Returns JPEG blobs scaled to THUMBNAIL_TARGET_WIDTH (300px).
 * Used by the composer overlay for thumbnail preview and frame shuffle.
 */

import { THUMBNAIL_TARGET_WIDTH } from './thumbnailGenerator';

/** Number of frames to extract from a video. */
export const VIDEO_FRAME_COUNT = 5;

/** Timeout per frame seek in milliseconds. */
const FRAME_SEEK_TIMEOUT_MS = 5000;

/** JPEG quality for extracted frames. */
const FRAME_JPEG_QUALITY = 0.85;

/** A single extracted video frame. */
export interface VideoFrame {
  /** JPEG blob of the frame. */
  blob: Blob;
  /** Frame width in pixels (scaled to 300px). */
  width: number;
  /** Frame height in pixels (proportional). */
  height: number;
  /** Timestamp in seconds where this frame was captured. */
  timestamp: number;
}

/**
 * Get the duration of a video file in seconds.
 * Returns 0 if duration cannot be determined.
 */
export async function getVideoDuration(file: Blob): Promise<number> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);

  try {
    return await new Promise<number>((resolve) => {
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const duration = isFinite(video.duration) ? video.duration : 0;
        resolve(duration);
      };

      video.onerror = () => {
        resolve(0);
      };

      video.src = url;
    });
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

/**
 * Extract a single frame from a video at a specific timestamp.
 * Returns null if extraction fails.
 */
export async function extractSingleFrame(
  file: Blob,
  timestamp: number,
): Promise<VideoFrame | null> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);

  try {
    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video load failed'));
      video.src = url;
    });

    // Clamp timestamp to valid range
    const clampedTime = Math.max(0, Math.min(timestamp, video.duration || 0));

    // Seek to timestamp
    await seekToTime(video, clampedTime);

    // Capture frame
    return captureFrame(video, clampedTime);
  } catch {
    return null;
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

/**
 * Extract multiple frames from a video at random timestamps.
 * Returns up to VIDEO_FRAME_COUNT frames. Returns empty array on failure.
 */
export async function extractVideoFrames(
  file: Blob,
  frameCount: number = VIDEO_FRAME_COUNT,
): Promise<VideoFrame[]> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);

  try {
    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video load failed'));
      video.src = url;
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) return [];

    // Generate random timestamps
    const timestamps = generateRandomTimestamps(duration, frameCount);

    // Extract frames sequentially (seeking is serial by nature)
    const frames: VideoFrame[] = [];
    for (const ts of timestamps) {
      try {
        await seekToTime(video, ts);
        const frame = captureFrame(video, ts);
        if (frame) frames.push(frame);
      } catch {
        // Skip failed frame, continue with next
      }
    }

    return frames;
  } catch {
    return [];
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

/**
 * Generate random timestamps spread across the video duration.
 * Avoids the very start (first 5%) and very end (last 5%) for better frames.
 */
function generateRandomTimestamps(duration: number, count: number): number[] {
  const margin = duration * 0.05;
  const safeStart = Math.min(margin, duration / 2);
  const safeEnd = Math.max(duration - margin, duration / 2);
  const range = safeEnd - safeStart;

  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(safeStart + Math.random() * range);
  }

  return timestamps.sort((a, b) => a - b);
}

/** Seek a video element to a specific time with timeout. */
function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Seek timed out at ${time}s`));
    }, FRAME_SEEK_TIMEOUT_MS);

    video.onseeked = () => {
      clearTimeout(timer);
      resolve();
    };

    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Seek failed at ${time}s`));
    };

    video.currentTime = time;
  });
}

/** Capture the current video frame to a canvas and return as JPEG blob. */
function captureFrame(video: HTMLVideoElement, timestamp: number): VideoFrame | null {
  const srcWidth = video.videoWidth;
  const srcHeight = video.videoHeight;
  if (srcWidth === 0 || srcHeight === 0) return null;

  // Scale to target width
  const scale = Math.min(1, THUMBNAIL_TARGET_WIDTH / srcWidth);
  const width = Math.round(srcWidth * scale);
  const height = Math.round(srcHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);

  // Synchronous toBlob isn't available, but we can use toDataURL for sync capture
  const dataUrl = canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY);
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  return { blob, width, height, timestamp };
}

/** Convert a data URL to a Blob. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const byteString = atob(parts[1]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}
