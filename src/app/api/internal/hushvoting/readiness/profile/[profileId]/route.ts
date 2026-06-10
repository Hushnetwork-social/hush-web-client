import { NextResponse } from 'next/server';
import {
  buildReadinessProfileDetail,
  type ReadinessProfileApiResponse,
} from '@/lib/readinessDashboard';
import {
  buildReadinessLoadErrorResponse,
  loadReadinessSourceForRequest,
} from '@/lib/readinessDashboard/serverApi';

type RouteContext = {
  params: Promise<{
    profileId: string;
  }>;
};

function getProfileState(status: string): 'ready' | 'superseded_or_blocked_register' {
  const normalized = status.toLowerCase();

  return normalized.includes('blocked') || normalized.includes('superseded')
    ? 'superseded_or_blocked_register'
    : 'ready';
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const result = await loadReadinessSourceForRequest(request);

    if (result.blockedResponse) {
      return result.blockedResponse;
    }

    const { profileId } = await params;
    const detail = buildReadinessProfileDetail(result.source, profileId);

    if (!detail) {
      const body: ReadinessProfileApiResponse = {
        success: false,
        state: 'not_found',
        code: 'readiness_profile_not_found',
        message: `Readiness profile ${profileId} is not present in the active register.`,
      };

      return NextResponse.json(body, { status: 404 });
    }

    const state = getProfileState(result.source.register.status);
    const body: ReadinessProfileApiResponse = {
      success: true,
      state,
      detail,
    };

    return NextResponse.json(body, { status: state === 'ready' ? 200 : 409 });
  } catch (error) {
    return buildReadinessLoadErrorResponse(error);
  }
}
