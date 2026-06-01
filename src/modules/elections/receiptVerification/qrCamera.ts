export const QR_CAMERA_DECODER_PACKAGE = {
  name: '@zxing/browser',
  version: '0.2.0',
  license: 'MIT',
  repository: 'https://github.com/zxing-js/browser',
} as const;

export type QrCameraIssueCode =
  | 'camera_permission_denied'
  | 'camera_unavailable'
  | 'qr_decode_failed'
  | 'unsupported_browser_feature';

export interface QrCameraIssue {
  code: QrCameraIssueCode;
  message: string;
}

export class QrCameraScanError extends Error {
  readonly issue: QrCameraIssue;

  constructor(issue: QrCameraIssue) {
    super(issue.message);
    this.name = 'QrCameraScanError';
    this.issue = issue;
  }
}

export interface QrScannerResult {
  getText(): string;
}

export interface QrScannerControls {
  stop(): void;
}

export type QrScannerCallback = (
  result: QrScannerResult | undefined,
  error: unknown,
  controls: QrScannerControls,
) => void;

export interface QrCameraReader {
  decodeFromVideoDevice(
    deviceId: string | undefined,
    previewElement: HTMLVideoElement,
    callback: QrScannerCallback,
  ): Promise<QrScannerControls>;
  decodeFromImageElement(source: string | HTMLImageElement): Promise<QrScannerResult>;
}

export type QrCameraReaderFactory = () => Promise<QrCameraReader>;

export interface QrCameraScanOptions {
  videoElement: HTMLVideoElement;
  readerFactory?: QrCameraReaderFactory;
  windowLike?: Pick<Window, 'navigator'>;
  onDecoded: (payloadText: string) => void;
  onIssue?: (issue: QrCameraIssue) => void;
  stopAfterFirstDecode?: boolean;
}

export interface QrCameraImageDecodeOptions {
  imageElement: string | HTMLImageElement;
  readerFactory?: QrCameraReaderFactory;
}

export async function createZxingQrCameraReader(): Promise<QrCameraReader> {
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  return new BrowserQRCodeReader();
}

export function hasBrowserCameraApi(windowLike: Pick<Window, 'navigator'> = window): boolean {
  const mediaDevices = windowLike.navigator.mediaDevices;
  return Boolean(mediaDevices?.getUserMedia);
}

export async function startQrCameraScan({
  videoElement,
  readerFactory = createZxingQrCameraReader,
  windowLike = window,
  onDecoded,
  onIssue,
  stopAfterFirstDecode = true,
}: QrCameraScanOptions): Promise<QrScannerControls> {
  if (!hasBrowserCameraApi(windowLike)) {
    throw new QrCameraScanError(issueForCode('camera_unavailable'));
  }

  const reader = await readerFactory();

  try {
    return await reader.decodeFromVideoDevice(undefined, videoElement, (result, error, controls) => {
      const decodedText = result?.getText();
      if (decodedText) {
        onDecoded(decodedText);
        if (stopAfterFirstDecode) {
          controls.stop();
        }
        return;
      }

      const issue = classifyContinuousDecodeIssue(error);
      if (issue) {
        onIssue?.(issue);
      }
    });
  } catch (error) {
    throw new QrCameraScanError(classifyCameraStartIssue(error));
  }
}

export async function decodeQrTextFromImageElement({
  imageElement,
  readerFactory = createZxingQrCameraReader,
}: QrCameraImageDecodeOptions): Promise<string> {
  const reader = await readerFactory();

  try {
    const result = await reader.decodeFromImageElement(imageElement);
    return result.getText();
  } catch (error) {
    throw new QrCameraScanError(classifyImageDecodeIssue(error));
  }
}

export function classifyCameraStartIssue(error: unknown): QrCameraIssue {
  const name = errorName(error);
  const message = errorMessage(error);
  const normalized = `${name} ${message}`.toLowerCase();

  if (
    normalized.includes('notallowed') ||
    normalized.includes('permission') ||
    normalized.includes('security')
  ) {
    return issueForCode('camera_permission_denied');
  }

  if (
    normalized.includes('notfound') ||
    normalized.includes('devicesnotfound') ||
    normalized.includes('overconstrained') ||
    normalized.includes('notreadable')
  ) {
    return issueForCode('camera_unavailable');
  }

  return issueForCode('unsupported_browser_feature', message);
}

export function classifyImageDecodeIssue(error: unknown): QrCameraIssue {
  return issueForCode('qr_decode_failed', errorMessage(error));
}

function classifyContinuousDecodeIssue(error: unknown): QrCameraIssue | null {
  if (!error) {
    return null;
  }

  const name = errorName(error).toLowerCase();
  if (name.includes('notfoundexception')) {
    return null;
  }

  return issueForCode('qr_decode_failed', errorMessage(error));
}

function issueForCode(code: QrCameraIssueCode, detail?: string): QrCameraIssue {
  const baseMessage = QR_CAMERA_ISSUE_MESSAGES[code];
  return {
    code,
    message: detail ? `${baseMessage} ${detail}` : baseMessage,
  };
}

function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  if (typeof error === 'object' && error && 'name' in error) {
    return String(error.name);
  }

  return '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }

  return '';
}

const QR_CAMERA_ISSUE_MESSAGES: Record<QrCameraIssueCode, string> = {
  camera_permission_denied:
    'Camera access was blocked by the browser. Use QR / Paste, Compact Code, Manual Payload, or File instead.',
  camera_unavailable:
    'This browser or device does not expose an available camera. Use QR / Paste, Compact Code, Manual Payload, or File instead.',
  qr_decode_failed:
    'The QR code could not be decoded. Try scanning again or use QR / Paste, Compact Code, Manual Payload, or File instead.',
  unsupported_browser_feature:
    'This browser could not start local QR scanning. Use QR / Paste, Compact Code, Manual Payload, or File instead.',
};
