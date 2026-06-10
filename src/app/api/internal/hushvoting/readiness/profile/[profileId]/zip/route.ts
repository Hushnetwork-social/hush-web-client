import { NextResponse } from 'next/server';
import { strToU8, zipSync } from 'fflate';
import {
  buildReadinessProfileDetail,
  renderReadinessProfileCheckReport,
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

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const result = await loadReadinessSourceForRequest(request);

    if (result.blockedResponse) {
      return result.blockedResponse;
    }

    const { profileId } = await params;
    const detail = buildReadinessProfileDetail(result.source, profileId);

    if (!detail) {
      return NextResponse.json(
        {
          success: false,
          state: 'not_found',
          code: 'readiness_profile_not_found',
          message: `Readiness profile ${profileId} is not present in the active register.`,
        },
        { status: 404 }
      );
    }

    const zipBytes = zipSync(
      {
        'profile-check-report.md': strToU8(renderReadinessProfileCheckReport(detail)),
        'profile-check-detail.json': strToU8(JSON.stringify(detail, null, 2)),
        'readiness-register-context.json': strToU8(
          JSON.stringify(
            {
              registerId: result.source.register.registerId,
              registerVersionId: result.source.register.registerVersionId,
              registerVersion: result.source.register.registerVersion,
              manifestHash: result.source.manifest.manifestHash,
              archive: result.source.manifest.archive ?? null,
              files: result.source.manifest.files ?? [],
              catalogArchiveHash: result.source.catalog.currentArchiveHash,
            },
            null,
            2
          )
        ),
      },
      { level: 6 }
    );

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${detail.download.fileName}"`,
        'Content-Length': zipBytes.byteLength.toString(),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return buildReadinessLoadErrorResponse(error);
  }
}
