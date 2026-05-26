import { NextResponse } from 'next/server';
import {
  READINESS_DASHBOARD_PUBLIC_KEY_HEADER,
  READINESS_DASHBOARD_REGISTER_ROOT_ENV,
  getReadinessDashboardServerRouteGate,
  type ReadinessDashboardApiResponse,
} from '@/lib/readinessDashboard';
import {
  ReadinessDashboardLoadError,
  loadReadinessDashboardSource,
} from '@/lib/readinessDashboard/serverLoader';
import { projectReadinessDashboard } from '@/lib/readinessDashboard/projection';

function blockedResponse(
  state: 'disabled' | 'production_blocked' | 'unauthorized',
  code: string,
  message: string,
  status: number
) {
  const body: ReadinessDashboardApiResponse = {
    success: false,
    state,
    code,
    message,
  };

  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  const publicKey = request.headers.get(READINESS_DASHBOARD_PUBLIC_KEY_HEADER);
  const gate = getReadinessDashboardServerRouteGate({ publicKey });

  if (!gate.enabled) {
    if (gate.reason === 'missing_flag') {
      return blockedResponse(
        'disabled',
        'readiness_dashboard_disabled',
        'Internal readiness dashboard API is disabled.',
        404
      );
    }

    if (gate.reason === 'production_blocked') {
      return blockedResponse(
        'production_blocked',
        'readiness_dashboard_production_blocked',
        'Internal readiness dashboard API is blocked in production without an explicit override.',
        403
      );
    }

    return blockedResponse(
      'unauthorized',
      'readiness_dashboard_unauthorized',
      'Internal readiness dashboard API is restricted to allowlisted collaborators.',
      403
    );
  }

  try {
    const source = await loadReadinessDashboardSource({
      root: process.env[READINESS_DASHBOARD_REGISTER_ROOT_ENV],
    });
    const dashboard = projectReadinessDashboard(source, gate);
    const state =
      dashboard.register.dataHealth === 'blocked' || dashboard.register.dataHealth === 'superseded'
        ? 'superseded_or_blocked_register'
        : 'ready';
    const body: ReadinessDashboardApiResponse = {
      success: true,
      state,
      dashboard,
    };

    return NextResponse.json(body, { status: state === 'ready' ? 200 : 409 });
  } catch (error) {
    if (error instanceof ReadinessDashboardLoadError) {
      const body: ReadinessDashboardApiResponse = {
        success: false,
        state: error.state,
        code: error.code,
        message: error.message,
      };

      return NextResponse.json(body, { status: error.httpStatus });
    }

    const message = error instanceof Error ? error.message : String(error);
    const body: ReadinessDashboardApiResponse = {
      success: false,
      state: 'load_error',
      code: 'readiness_dashboard_load_error',
      message,
    };

    return NextResponse.json(body, { status: 500 });
  }
}
