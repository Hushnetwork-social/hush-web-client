import { NextResponse } from 'next/server';
import {
  type ReadinessDashboardApiResponse,
} from '@/lib/readinessDashboard';
import { projectReadinessDashboard } from '@/lib/readinessDashboard/projection';
import {
  buildReadinessLoadErrorResponse,
  loadReadinessSourceForRequest,
} from '@/lib/readinessDashboard/serverApi';

export async function GET(request: Request) {
  try {
    const result = await loadReadinessSourceForRequest(request);

    if (result.blockedResponse) {
      return result.blockedResponse;
    }

    const dashboard = projectReadinessDashboard(result.source, result.gate);
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
    return buildReadinessLoadErrorResponse(error);
  }
}
