import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CIRCUIT } from "@/lib/crypto/reactions/constants";
import { getApprovedCircuitArtifacts } from "@/lib/zk/artifactManifest";
import type { CircuitInputs, Groth16Proof } from "@/lib/zk/types";

type ProveRequestBody = {
  circuitVersion?: string;
  inputs?: CircuitInputs;
};

type SnarkJsGroth16 = {
  fullProve(
    input: CircuitInputs,
    wasmFile: string,
    zkeyFile: string
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
};

type SnarkJsModule = {
  groth16: SnarkJsGroth16;
};

type CapturePayload = {
  requestId: string;
  capturedAtUtc: string;
  circuitVersion: string;
  wasmSha256: string;
  zkeySha256: string;
  inputs: CircuitInputs;
};

const DEFAULT_PROVE_ROUTE_TIMEOUT_MS = 25_000;

function resolvePublicArtifactPath(assetPath: string): string {
  const relativePath = assetPath.replace(/^\/+/, "").split("/").join(path.sep);
  return path.join(process.cwd(), "public", relativePath);
}

async function assertFileExists(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} circuit artifact not found at '${filePath}'`);
  }
}

async function loadSnarkJs(): Promise<SnarkJsModule> {
  try {
    return (await import("snarkjs")) as SnarkJsModule;
  } catch (nativeImportError) {
    try {
      const dynamicImport = new Function("specifier", "return import(specifier);") as (
        specifier: string
      ) => Promise<unknown>;
      return (await dynamicImport("snarkjs")) as SnarkJsModule;
    } catch (fallbackError) {
      const detail =
        fallbackError instanceof Error
          ? fallbackError.message
          : nativeImportError instanceof Error
            ? nativeImportError.message
            : String(fallbackError);

      throw new Error(`snarkjs is required for non-dev proof generation: ${detail}`);
    }
  }
}

function shouldCaptureInputs(): boolean {
  return process.env.REACTION_PROVE_CAPTURE_INPUTS === "true";
}

function resolveCaptureDirectory(): string {
  return path.join(process.cwd(), ".tmp", "prove-captures");
}

async function captureInputsToDisk(payload: CapturePayload): Promise<string> {
  const captureDirectory = resolveCaptureDirectory();
  await mkdir(captureDirectory, { recursive: true });

  const filePath = path.join(captureDirectory, `${payload.requestId}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function getProveRouteTimeoutMs(): number {
  const raw = process.env.REACTION_PROVE_ROUTE_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_PROVE_ROUTE_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROVE_ROUTE_TIMEOUT_MS;
  }

  return parsed;
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(onTimeout()), timeoutMs);
    });

    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function POST(request: Request) {
  const requestId = `prove-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const requestStartedAt = Date.now();
  const proveTimeoutMs = getProveRouteTimeoutMs();

  try {
    console.log(`[ReactionProveRoute:${requestId}] request started`);

    const parseStartedAt = Date.now();
    const body = (await request.json()) as ProveRequestBody;
    console.log(
      `[ReactionProveRoute:${requestId}] request parsed in ${Date.now() - parseStartedAt}ms`
    );

    const inputs = body.inputs;
    const circuitVersion = body.circuitVersion?.trim() || CIRCUIT.version;

    if (!inputs) {
      console.warn(`[ReactionProveRoute:${requestId}] missing inputs`);
      return NextResponse.json(
        { success: false, message: "inputs are required" },
        { status: 400 }
      );
    }

    console.log(
      `[ReactionProveRoute:${requestId}] using circuitVersion=${circuitVersion}, inputKeys=${Object.keys(inputs).join(",")}`
    );

    const artifactResolveStartedAt = Date.now();
    const artifacts = getApprovedCircuitArtifacts(circuitVersion);
    const wasmPath = resolvePublicArtifactPath(artifacts.wasmPath);
    const zkeyPath = resolvePublicArtifactPath(artifacts.zkeyPath);
    console.log(
      `[ReactionProveRoute:${requestId}] artifacts resolved in ${Date.now() - artifactResolveStartedAt}ms`
    );
    console.log(
      `[ReactionProveRoute:${requestId}] wasmPath=${wasmPath}, zkeyPath=${zkeyPath}, wasmSha256=${artifacts.wasmSha256}, zkeySha256=${artifacts.zkeySha256}`
    );

    if (shouldCaptureInputs()) {
      const capturePath = await captureInputsToDisk({
        requestId,
        capturedAtUtc: new Date().toISOString(),
        circuitVersion,
        wasmSha256: artifacts.wasmSha256,
        zkeySha256: artifacts.zkeySha256,
        inputs,
      });
      console.log(`[ReactionProveRoute:${requestId}] captured inputs at ${capturePath}`);
    }

    const fileCheckStartedAt = Date.now();
    await Promise.all([
      assertFileExists(wasmPath, "WASM"),
      assertFileExists(zkeyPath, "zkey"),
    ]);
    console.log(
      `[ReactionProveRoute:${requestId}] artifact existence confirmed in ${Date.now() - fileCheckStartedAt}ms`
    );

    const loadSnarkStartedAt = Date.now();
    const snarkjs = await loadSnarkJs();
    console.log(
      `[ReactionProveRoute:${requestId}] snarkjs loaded in ${Date.now() - loadSnarkStartedAt}ms`
    );

    const proveStartedAt = Date.now();
    console.log(
      `[ReactionProveRoute:${requestId}] fullProve starting (timeout=${proveTimeoutMs}ms)`
    );
    const { proof, publicSignals } = await withTimeout(
      snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath),
      proveTimeoutMs,
      () => {
        console.error(
          `[ReactionProveRoute:${requestId}] fullProve timed out after ${proveTimeoutMs}ms`
        );
        return new Error(
          `Reaction proof generation timed out after ${proveTimeoutMs}ms`
        );
      }
    );
    console.log(
      `[ReactionProveRoute:${requestId}] fullProve finished in ${Date.now() - proveStartedAt}ms`
    );
    console.log(
      `[ReactionProveRoute:${requestId}] request completed in ${Date.now() - requestStartedAt}ms`
    );

    return NextResponse.json({
      success: true,
      proof,
      publicSignals,
      circuitVersion,
    });
  } catch (error) {
    console.error(
      `[ReactionProveRoute:${requestId}] request failed after ${Date.now() - requestStartedAt}ms:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to generate proof",
      },
      { status: 502 }
    );
  }
}
