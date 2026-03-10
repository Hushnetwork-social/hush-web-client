import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CIRCUIT } from "@/lib/crypto/reactions/constants";
import { getApprovedCircuitArtifacts, listApprovedCircuitVersions } from "@/lib/zk/artifactManifest";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolvePublicArtifactPath(assetPath: string): string {
  const relativePath = assetPath.replace(/^\/+/, "").split("/").join(path.sep);
  return path.join(process.cwd(), "public", relativePath);
}

export async function GET() {
  const approvedVersions = await Promise.all(
    listApprovedCircuitVersions().map(async (version) => {
      const artifacts = getApprovedCircuitArtifacts(version);
      const [wasmExists, zkeyExists] = await Promise.all([
        fileExists(resolvePublicArtifactPath(artifacts.wasmPath)),
        fileExists(resolvePublicArtifactPath(artifacts.zkeyPath)),
      ]);

      return {
        version,
        proverArtifactsAvailable: wasmExists && zkeyExists,
        provenance: artifacts.provenance,
      };
    })
  );

  return NextResponse.json({
    currentVersion: CIRCUIT.version,
    minimumVersion: CIRCUIT.version,
    deprecatedVersions: [],
    approvedVersions,
  });
}
