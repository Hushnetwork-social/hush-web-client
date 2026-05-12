export const MOBILE_BENCHMARK_ROUTE = '/internal/hushvoting/mobile-benchmark';
export const MOBILE_BENCHMARK_ENV_FLAG =
  'NEXT_PUBLIC_HUSHVOTING_MOBILE_BENCHMARK_ENABLED';
export const MOBILE_BENCHMARK_PRODUCTION_ENV_FLAG =
  'NEXT_PUBLIC_HUSHVOTING_MOBILE_BENCHMARK_ALLOW_PRODUCTION';

export interface MobileBenchmarkRouteGateInput {
  env?: Record<string, string | undefined>;
}

export interface MobileBenchmarkRouteGate {
  route: typeof MOBILE_BENCHMARK_ROUTE;
  envFlag: typeof MOBILE_BENCHMARK_ENV_FLAG;
  enabled: boolean;
  hiddenFromOrdinaryHushVotingNavigation: true;
  reason: 'enabled' | 'missing_flag' | 'production_blocked';
}

export function getMobileBenchmarkRouteGate(
  input: MobileBenchmarkRouteGateInput = {}
): MobileBenchmarkRouteGate {
  const env = input.env ?? process.env;
  const enabledByFlag = env[MOBILE_BENCHMARK_ENV_FLAG] === 'true';
  const productionBlocked =
    env.NODE_ENV === 'production' && env[MOBILE_BENCHMARK_PRODUCTION_ENV_FLAG] !== 'true';

  return {
    route: MOBILE_BENCHMARK_ROUTE,
    envFlag: MOBILE_BENCHMARK_ENV_FLAG,
    enabled: enabledByFlag && !productionBlocked,
    hiddenFromOrdinaryHushVotingNavigation: true,
    reason: !enabledByFlag ? 'missing_flag' : productionBlocked ? 'production_blocked' : 'enabled',
  };
}
