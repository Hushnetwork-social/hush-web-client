import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  READINESS_DASHBOARD_PUBLIC_KEY_HEADER,
  READINESS_DASHBOARD_REGISTER_ROOT_ENV,
  getReadinessDashboardServerRouteGate,
} from './routeGate';
import {
  ReadinessDashboardLoadError,
  loadReadinessDashboardSource,
} from './serverLoader';
import type { ReadinessDashboardSource } from './contracts';

export function getReadinessRegisterRoot(): string | null {
  const configuredRoot = process.env[READINESS_DASHBOARD_REGISTER_ROOT_ENV]?.trim();

  if (configuredRoot) {
    return configuredRoot;
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return path.resolve(
    process.cwd(),
    '..',
    'hush-documents',
    'PrivateServer_ElectronicVoting',
    'HushVoting-Readiness-Register'
  );
}

export function getReadinessGateForRequest(request: Request) {
  const publicKey = request.headers.get(READINESS_DASHBOARD_PUBLIC_KEY_HEADER);

  return getReadinessDashboardServerRouteGate({ publicKey });
}

export function buildReadinessGateBlockedResponse(gate: ReturnType<typeof getReadinessGateForRequest>) {
  if (gate.reason === 'missing_flag') {
    return NextResponse.json(
      {
        success: false,
        state: 'disabled',
        code: 'readiness_dashboard_disabled',
        message: 'Internal readiness dashboard API is disabled.',
      },
      { status: 404 }
    );
  }

  if (gate.reason === 'production_blocked') {
    return NextResponse.json(
      {
        success: false,
        state: 'production_blocked',
        code: 'readiness_dashboard_production_blocked',
        message:
          'Internal readiness dashboard API is blocked in production without an explicit override.',
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      state: 'unauthorized',
      code: 'readiness_dashboard_unauthorized',
      message: 'Internal readiness dashboard API is restricted to allowlisted collaborators.',
    },
    { status: 403 }
  );
}

export async function loadReadinessSourceForRequest(
  request: Request
): Promise<
  | {
      gate: ReturnType<typeof getReadinessGateForRequest>;
      source: ReadinessDashboardSource;
      blockedResponse?: never;
    }
  | {
      gate: ReturnType<typeof getReadinessGateForRequest>;
      source?: never;
      blockedResponse: NextResponse;
    }
> {
  const gate = getReadinessGateForRequest(request);

  if (!gate.enabled) {
    return {
      gate,
      blockedResponse: buildReadinessGateBlockedResponse(gate),
    };
  }

  return {
    gate,
    source: await loadReadinessDashboardSource({
      root: getReadinessRegisterRoot(),
    }),
  };
}

export function buildReadinessLoadErrorResponse(error: unknown): NextResponse {
  if (error instanceof ReadinessDashboardLoadError) {
    return NextResponse.json(
      {
        success: false,
        state: error.state,
        code: error.code,
        message: error.message,
      },
      { status: error.httpStatus }
    );
  }

  const message = error instanceof Error ? error.message : String(error);

  return NextResponse.json(
    {
      success: false,
      state: 'load_error',
      code: 'readiness_dashboard_load_error',
      message,
    },
    { status: 500 }
  );
}
