import { describe, expect, it } from 'vitest';
import type { ReadinessDashboardServerGate } from './contracts';
import {
  buildReadinessGateBlockedResponse,
  buildReadinessLoadErrorResponse,
  readinessDashboardNoStoreHeaders,
} from './serverApi';
import { ReadinessDashboardLoadError } from './serverLoader';

function expectNoStoreHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe(
    readinessDashboardNoStoreHeaders['Cache-Control']
  );
  expect(response.headers.get('pragma')).toBe(readinessDashboardNoStoreHeaders.Pragma);
  expect(response.headers.get('expires')).toBe(readinessDashboardNoStoreHeaders.Expires);
}

describe('readiness dashboard server API helpers', () => {
  it('marks blocked gate responses as uncached', () => {
    const response = buildReadinessGateBlockedResponse({
      enabled: false,
      reason: 'missing_flag',
      route: '/elections/readiness',
      hiddenFromOrdinaryHushVotingNavigation: true,
    } satisfies ReadinessDashboardServerGate);

    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it('marks loader error responses as uncached', () => {
    const response = buildReadinessLoadErrorResponse(
      new ReadinessDashboardLoadError(
        'missing_catalog',
        'register_root_missing',
        'Readiness register root is not configured.',
        503
      )
    );

    expect(response.status).toBe(503);
    expectNoStoreHeaders(response);
  });
});
