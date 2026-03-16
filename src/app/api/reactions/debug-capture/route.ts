import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type DebugCaptureRequest = {
  source?: string;
  payload?: unknown;
};

function resolveCaptureDirectory(source: string): string {
  return path.join(process.cwd(), ".tmp", "reaction-debug", source);
}

function sanitizeSource(source?: string): string {
  if (!source || source.trim().length === 0) {
    return "unknown";
  }

  return source.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DebugCaptureRequest;
    const source = sanitizeSource(body.source);
    const captureDirectory = resolveCaptureDirectory(source);
    await mkdir(captureDirectory, { recursive: true });

    const requestId = `capture-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const filePath = path.join(captureDirectory, `${requestId}.json`);

    await writeFile(
      filePath,
      JSON.stringify(
        {
          capturedAtUtc: new Date().toISOString(),
          source,
          payload: body.payload ?? null,
        },
        null,
        2
      )
    );

    return NextResponse.json({ success: true, filePath });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to capture debug payload",
      },
      { status: 500 }
    );
  }
}
