import { describe, expect, it, vi } from 'vitest';
import {
  QR_CAMERA_DECODER_PACKAGE,
  QrCameraScanError,
  decodeQrTextFromImageElement,
  hasBrowserCameraApi,
  startQrCameraScan,
  type QrCameraReader,
  type QrScannerCallback,
  type QrScannerControls,
} from './qrCamera';

function windowWithCamera(enabled: boolean): Pick<Window, 'navigator'> {
  return {
    navigator: {
      mediaDevices: enabled
        ? {
            getUserMedia: vi.fn(),
          }
        : undefined,
    } as Navigator,
  };
}

function videoElement(): HTMLVideoElement {
  return document.createElement('video');
}

function scannerControls(): QrScannerControls {
  return {
    stop: vi.fn(),
  };
}

function readerFactory(reader: QrCameraReader): () => Promise<QrCameraReader> {
  return async () => reader;
}

describe('FEAT-159 QR camera adapter', () => {
  it('records the selected maintained QR decoder package', () => {
    expect(QR_CAMERA_DECODER_PACKAGE).toEqual({
      name: '@zxing/browser',
      version: '0.2.0',
      license: 'MIT',
      repository: 'https://github.com/zxing-js/browser',
    });
  });

  it('detects whether a browser camera API is available', () => {
    expect(hasBrowserCameraApi(windowWithCamera(true))).toBe(true);
    expect(hasBrowserCameraApi(windowWithCamera(false))).toBe(false);
  });

  it('fails closed when camera APIs are unavailable', async () => {
    await expect(
      startQrCameraScan({
        videoElement: videoElement(),
        windowLike: windowWithCamera(false),
        onDecoded: vi.fn(),
      }),
    ).rejects.toMatchObject({
      issue: {
        code: 'camera_unavailable',
      },
    });
  });

  it('maps browser permission rejection to camera_permission_denied', async () => {
    const reader: QrCameraReader = {
      decodeFromVideoDevice: vi.fn(async () => {
        const error = new Error('Permission denied by browser');
        error.name = 'NotAllowedError';
        throw error;
      }),
      decodeFromImageElement: vi.fn(),
    };

    await expect(
      startQrCameraScan({
        videoElement: videoElement(),
        windowLike: windowWithCamera(true),
        readerFactory: readerFactory(reader),
        onDecoded: vi.fn(),
      }),
    ).rejects.toMatchObject({
      issue: {
        code: 'camera_permission_denied',
      },
    });
  });

  it('returns decoded QR text and stops after the first camera result', async () => {
    const controls = scannerControls();
    const onDecoded = vi.fn();
    const reader: QrCameraReader = {
      decodeFromVideoDevice: vi.fn(async (_deviceId, _video, callback: QrScannerCallback) => {
        callback(
          {
            getText: () => 'HVR1.payload.checksum',
          },
          undefined,
          controls,
        );
        return controls;
      }),
      decodeFromImageElement: vi.fn(),
    };

    await startQrCameraScan({
      videoElement: videoElement(),
      windowLike: windowWithCamera(true),
      readerFactory: readerFactory(reader),
      onDecoded,
    });

    expect(onDecoded).toHaveBeenCalledWith('HVR1.payload.checksum');
    expect(controls.stop).toHaveBeenCalledTimes(1);
  });

  it('reports recoverable decode failures without stopping the scanner', async () => {
    const controls = scannerControls();
    const onIssue = vi.fn();
    const reader: QrCameraReader = {
      decodeFromVideoDevice: vi.fn(async (_deviceId, _video, callback: QrScannerCallback) => {
        callback(undefined, new Error('decode failed'), controls);
        return controls;
      }),
      decodeFromImageElement: vi.fn(),
    };

    await startQrCameraScan({
      videoElement: videoElement(),
      windowLike: windowWithCamera(true),
      readerFactory: readerFactory(reader),
      onDecoded: vi.fn(),
      onIssue,
    });

    expect(onIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'qr_decode_failed',
      }),
    );
    expect(controls.stop).not.toHaveBeenCalled();
  });

  it('decodes deterministic QR image fixtures through the same library seam', async () => {
    const reader: QrCameraReader = {
      decodeFromVideoDevice: vi.fn(),
      decodeFromImageElement: vi.fn(async () => ({
        getText: () => 'HVR1.image.payload',
      })),
    };

    await expect(
      decodeQrTextFromImageElement({
        imageElement: document.createElement('img'),
        readerFactory: readerFactory(reader),
      }),
    ).resolves.toBe('HVR1.image.payload');
  });

  it('maps image decode failure to qr_decode_failed', async () => {
    const reader: QrCameraReader = {
      decodeFromVideoDevice: vi.fn(),
      decodeFromImageElement: vi.fn(async () => {
        throw new Error('not a QR image');
      }),
    };

    await expect(
      decodeQrTextFromImageElement({
        imageElement: document.createElement('img'),
        readerFactory: readerFactory(reader),
      }),
    ).rejects.toBeInstanceOf(QrCameraScanError);
  });
});
