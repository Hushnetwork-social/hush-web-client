import {
  READINESS_DASHBOARD_ROUTE,
  type ReadinessDashboardClientGate,
  type ReadinessDashboardServerGate,
} from './contracts';

export {
  READINESS_DASHBOARD_LEGACY_INTERNAL_ROUTE,
  READINESS_DASHBOARD_NAV_ID,
  READINESS_DASHBOARD_ROUTE,
} from './contracts';

export const READINESS_DASHBOARD_CLIENT_ENV_FLAG =
  'NEXT_PUBLIC_HUSHVOTING_READINESS_DASHBOARD_ENABLED';
export const READINESS_DASHBOARD_CLIENT_PRODUCTION_ENV_FLAG =
  'NEXT_PUBLIC_HUSHVOTING_READINESS_DASHBOARD_ALLOW_PRODUCTION';
export const READINESS_DASHBOARD_SERVER_ENV_FLAG =
  'HUSHVOTING_READINESS_DASHBOARD_ENABLED';
export const READINESS_DASHBOARD_SERVER_PRODUCTION_ENV_FLAG =
  'HUSHVOTING_READINESS_DASHBOARD_ALLOW_PRODUCTION';
export const READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV =
  'HUSHVOTING_READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS';
export const READINESS_DASHBOARD_REGISTER_ROOT_ENV =
  'HUSHVOTING_READINESS_REGISTER_ROOT';
export const READINESS_DASHBOARD_PUBLIC_KEY_HEADER =
  'x-hush-readiness-public-key';

export interface ReadinessDashboardRouteGateInput {
  env?: Record<string, string | undefined>;
}

export interface ReadinessDashboardServerRouteGateInput
  extends ReadinessDashboardRouteGateInput {
  publicKey?: string | null;
}

function normalizePublicKey(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function parseAllowedReadinessDashboardPublicKeys(
  value?: string
): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => normalizePublicKey(item))
      .filter((item): item is string => item !== null)
  );
}

export function getReadinessDashboardClientRouteGate(
  input: ReadinessDashboardRouteGateInput = {}
): ReadinessDashboardClientGate {
  const env = input.env ?? process.env;
  const isProduction = env.NODE_ENV === 'production';
  const enabledByFlag =
    env[READINESS_DASHBOARD_CLIENT_ENV_FLAG] === 'true' ||
    (!isProduction && env[READINESS_DASHBOARD_CLIENT_ENV_FLAG] !== 'false');
  const productionBlocked =
    isProduction &&
    env[READINESS_DASHBOARD_CLIENT_PRODUCTION_ENV_FLAG] !== 'true';

  return {
    route: READINESS_DASHBOARD_ROUTE,
    envFlag: READINESS_DASHBOARD_CLIENT_ENV_FLAG,
    enabled: enabledByFlag && !productionBlocked,
    hiddenFromOrdinaryHushVotingNavigation: !enabledByFlag || productionBlocked,
    reason: !enabledByFlag
      ? 'missing_flag'
      : productionBlocked
        ? 'production_blocked'
        : 'enabled',
  };
}

export function getReadinessDashboardServerRouteGate(
  input: ReadinessDashboardServerRouteGateInput = {}
): ReadinessDashboardServerGate {
  const env = input.env ?? process.env;
  const isProduction = env.NODE_ENV === 'production';
  const enabledByFlag =
    env[READINESS_DASHBOARD_SERVER_ENV_FLAG] === 'true' ||
    (!isProduction && env[READINESS_DASHBOARD_SERVER_ENV_FLAG] !== 'false');
  const productionBlocked =
    isProduction &&
    env[READINESS_DASHBOARD_SERVER_PRODUCTION_ENV_FLAG] !== 'true';
  const publicKey = normalizePublicKey(input.publicKey);
  const allowedPublicKeys = parseAllowedReadinessDashboardPublicKeys(
    env[READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV]
  );
  const allowsAnyDevelopmentKey =
    !isProduction &&
    (env[READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV] === undefined ||
      allowedPublicKeys.has('*'));
  const allowed =
    publicKey !== null &&
    (allowedPublicKeys.has(publicKey) || allowsAnyDevelopmentKey);

  return {
    route: READINESS_DASHBOARD_ROUTE,
    enabled: enabledByFlag && !productionBlocked && allowed,
    hiddenFromOrdinaryHushVotingNavigation: !enabledByFlag || productionBlocked || !allowed,
    reason: !enabledByFlag
      ? 'missing_flag'
      : productionBlocked
        ? 'production_blocked'
        : allowed
          ? 'enabled'
          : 'unauthorized',
    allowedPublicKey: allowed ? publicKey : null,
  };
}
