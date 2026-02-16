import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractVideoFrames, extractSingleFrame, getVideoDuration, VIDEO_FRAME_COUNT } from './videoFrameExtractor';

/**
 * FEAT-068: Video frame extraction tests.
 *
 * These tests mock the DOM APIs (HTMLVideoElement, canvas, URL) since
 * vitest runs in jsdom which lacks real video decoding capability.
 */

// Save original before spying
const originalCreateElement = document.createElement.bind(document);

let mockVideoOpts = { duration: 30, width: 1920, height: 1080, shouldError: false };

function createMockCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: vi.fn(),
    }),
    toDataURL: () => 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    toBlob: vi.fn(),
  };
}

function createMockVideo() {
  // Use a plain object that behaves like a video element
  const handlers: Record<string, ((...args: unknown[]) => void) | null> = {
    onloadedmetadata: null,
    onerror: null,
    onseeked: null,
  };

  let srcValue = '';
  let currentTimeValue = 0;

  const video = {
    preload: '',
    get src() { return srcValue; },
    set src(val: string) {
      srcValue = val;
      if (val === '') return;
      if (mockVideoOpts.shouldError) {
        setTimeout(() => handlers.onerror?.(new Event('error')), 0);
      } else {
        setTimeout(() => handlers.onloadedmetadata?.(new Event('loadedmetadata')), 0);
      }
    },
    get currentTime() { return currentTimeValue; },
    set currentTime(val: number) {
      currentTimeValue = val;
      setTimeout(() => handlers.onseeked?.(new Event('seeked')), 0);
    },
    get duration() { return mockVideoOpts.duration; },
    get videoWidth() { return mockVideoOpts.width; },
    get videoHeight() { return mockVideoOpts.height; },
    set onloadedmetadata(fn: ((ev: Event) => void) | null) { handlers.onloadedmetadata = fn; },
    get onloadedmetadata() { return handlers.onloadedmetadata; },
    set onerror(fn: ((ev: Event) => void) | null) { handlers.onerror = fn; },
    get onerror() { return handlers.onerror; },
    set onseeked(fn: ((ev: Event) => void) | null) { handlers.onseeked = fn; },
    get onseeked() { return handlers.onseeked; },
  };

  return video;
}

let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') return createMockVideo() as unknown as HTMLElement;
    if (tag === 'canvas') return createMockCanvas() as unknown as HTMLElement;
    return originalCreateElement(tag);
  });

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  mockVideoOpts = { duration: 30, width: 1920, height: 1080, shouldError: false };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FEAT-068: videoFrameExtractor', () => {
  describe('extractVideoFrames', () => {
    it('should return 5 frames for a valid video', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      expect(frames).toHaveLength(VIDEO_FRAME_COUNT);
    });

    it('should return frames with blob, width, height, and timestamp', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      for (const frame of frames) {
        expect(frame.blob).toBeInstanceOf(Blob);
        expect(typeof frame.width).toBe('number');
        expect(typeof frame.height).toBe('number');
        expect(typeof frame.timestamp).toBe('number');
      }
    });

    it('should scale frames to 300px width', async () => {
      mockVideoOpts = { duration: 30, width: 1920, height: 1080, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      for (const frame of frames) {
        expect(frame.width).toBe(300);
        expect(frame.height).toBe(169); // 1080/1920 * 300, rounded
      }
    });

    it('should not upscale small videos', async () => {
      mockVideoOpts = { duration: 10, width: 200, height: 150, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      for (const frame of frames) {
        expect(frame.width).toBe(200);
        expect(frame.height).toBe(150);
      }
    });

    it('should have all timestamps within video duration', async () => {
      mockVideoOpts = { duration: 10, width: 640, height: 480, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      for (const frame of frames) {
        expect(frame.timestamp).toBeGreaterThanOrEqual(0);
        expect(frame.timestamp).toBeLessThanOrEqual(10);
      }
    });

    it('should return timestamps sorted in order', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].timestamp).toBeGreaterThanOrEqual(frames[i - 1].timestamp);
      }
    });

    it('should return empty array on video load error', async () => {
      mockVideoOpts = { duration: 30, width: 1920, height: 1080, shouldError: true };
      const file = new Blob(['bad-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      expect(frames).toEqual([]);
    });

    it('should handle very short video', async () => {
      mockVideoOpts = { duration: 0.5, width: 640, height: 480, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(frame.timestamp).toBeLessThanOrEqual(0.5);
      }
    });

    it('should return empty array for zero duration video', async () => {
      mockVideoOpts = { duration: 0, width: 640, height: 480, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file);
      expect(frames).toEqual([]);
    });

    it('should revoke object URL after extraction', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      await extractVideoFrames(file);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should accept custom frame count', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frames = await extractVideoFrames(file, 3);
      expect(frames).toHaveLength(3);
    });
  });

  describe('extractSingleFrame', () => {
    it('should return a frame at specified timestamp', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frame = await extractSingleFrame(file, 5.0);
      expect(frame).not.toBeNull();
      expect(frame!.blob).toBeInstanceOf(Blob);
      expect(frame!.width).toBe(300);
    });

    it('should return null on error', async () => {
      mockVideoOpts = { duration: 30, width: 1920, height: 1080, shouldError: true };
      const file = new Blob(['bad-data'], { type: 'video/mp4' });
      const frame = await extractSingleFrame(file, 5.0);
      expect(frame).toBeNull();
    });

    it('should clamp timestamp to video duration', async () => {
      mockVideoOpts = { duration: 10, width: 640, height: 480, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const frame = await extractSingleFrame(file, 999);
      expect(frame).not.toBeNull();
    });
  });

  describe('getVideoDuration', () => {
    it('should return duration for a valid video', async () => {
      mockVideoOpts = { duration: 42.5, width: 640, height: 480, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const duration = await getVideoDuration(file);
      expect(duration).toBe(42.5);
    });

    it('should return 0 on error', async () => {
      mockVideoOpts = { duration: 30, width: 640, height: 480, shouldError: true };
      const file = new Blob(['bad-data'], { type: 'video/mp4' });
      const duration = await getVideoDuration(file);
      expect(duration).toBe(0);
    });

    it('should return 0 for Infinity duration', async () => {
      mockVideoOpts = { duration: Infinity, width: 640, height: 480, shouldError: false };
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      const duration = await getVideoDuration(file);
      expect(duration).toBe(0);
    });

    it('should revoke object URL after getting duration', async () => {
      const file = new Blob(['video-data'], { type: 'video/mp4' });
      await getVideoDuration(file);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
