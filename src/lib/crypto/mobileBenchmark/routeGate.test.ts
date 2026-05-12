import { describe, expect, it } from 'vitest';
import {
  MOBILE_BENCHMARK_ENV_FLAG,
  MOBILE_BENCHMARK_PRODUCTION_ENV_FLAG,
  MOBILE_BENCHMARK_ROUTE,
  getMobileBenchmarkRouteGate,
} from './routeGate.ts';

describe('FEAT-121 mobile benchmark route gating', () => {
  it('keeps the benchmark hidden from ordinary HushVoting navigation by default', () => {
    const gate = getMobileBenchmarkRouteGate({
      env: {
        NODE_ENV: 'development',
      },
    });

    expect(gate).toMatchObject({
      route: MOBILE_BENCHMARK_ROUTE,
      envFlag: MOBILE_BENCHMARK_ENV_FLAG,
      enabled: false,
      hiddenFromOrdinaryHushVotingNavigation: true,
      reason: 'missing_flag',
    });
  });

  it('requires an explicit benchmark flag outside production', () => {
    const gate = getMobileBenchmarkRouteGate({
      env: {
        NODE_ENV: 'development',
        [MOBILE_BENCHMARK_ENV_FLAG]: 'true',
      },
    });

    expect(gate.enabled).toBe(true);
    expect(gate.reason).toBe('enabled');
  });

  it('keeps production blocked unless a second production flag is explicit', () => {
    const blocked = getMobileBenchmarkRouteGate({
      env: {
        NODE_ENV: 'production',
        [MOBILE_BENCHMARK_ENV_FLAG]: 'true',
      },
    });
    const enabled = getMobileBenchmarkRouteGate({
      env: {
        NODE_ENV: 'production',
        [MOBILE_BENCHMARK_ENV_FLAG]: 'true',
        [MOBILE_BENCHMARK_PRODUCTION_ENV_FLAG]: 'true',
      },
    });

    expect(blocked.enabled).toBe(false);
    expect(blocked.reason).toBe('production_blocked');
    expect(enabled.enabled).toBe(true);
  });
});
