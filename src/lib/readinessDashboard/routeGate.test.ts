import { describe, expect, it } from 'vitest';
import {
  READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV,
  READINESS_DASHBOARD_CLIENT_ENV_FLAG,
  READINESS_DASHBOARD_CLIENT_PRODUCTION_ENV_FLAG,
  READINESS_DASHBOARD_ROUTE,
  READINESS_DASHBOARD_SERVER_ENV_FLAG,
  READINESS_DASHBOARD_SERVER_PRODUCTION_ENV_FLAG,
  getReadinessDashboardClientRouteGate,
  getReadinessDashboardServerRouteGate,
  parseAllowedReadinessDashboardPublicKeys,
} from './routeGate';

describe('FEAT-142 readiness dashboard route gates', () => {
  it('enables the client route by default in local development', () => {
    const gate = getReadinessDashboardClientRouteGate({
      env: {
        NODE_ENV: 'development',
      },
    });

    expect(gate).toMatchObject({
      route: READINESS_DASHBOARD_ROUTE,
      enabled: true,
      reason: 'enabled',
      hiddenFromOrdinaryHushVotingNavigation: false,
    });
  });

  it('keeps the client route hidden when development explicitly disables it', () => {
    const gate = getReadinessDashboardClientRouteGate({
      env: {
        NODE_ENV: 'development',
        [READINESS_DASHBOARD_CLIENT_ENV_FLAG]: 'false',
      },
    });

    expect(gate.enabled).toBe(false);
    expect(gate.reason).toBe('missing_flag');
    expect(gate.hiddenFromOrdinaryHushVotingNavigation).toBe(true);
  });

  it('blocks the client route in production without the second override', () => {
    const blocked = getReadinessDashboardClientRouteGate({
      env: {
        NODE_ENV: 'production',
        [READINESS_DASHBOARD_CLIENT_ENV_FLAG]: 'true',
      },
    });
    const enabled = getReadinessDashboardClientRouteGate({
      env: {
        NODE_ENV: 'production',
        [READINESS_DASHBOARD_CLIENT_ENV_FLAG]: 'true',
        [READINESS_DASHBOARD_CLIENT_PRODUCTION_ENV_FLAG]: 'true',
      },
    });

    expect(blocked.enabled).toBe(false);
    expect(blocked.reason).toBe('production_blocked');
    expect(enabled.enabled).toBe(true);
    expect(enabled.hiddenFromOrdinaryHushVotingNavigation).toBe(false);
  });

  it('requires an allowlisted collaborator public key when an explicit allowlist is configured', () => {
    const unauthorized = getReadinessDashboardServerRouteGate({
      publicKey: 'NPub-1',
      env: {
        NODE_ENV: 'development',
        [READINESS_DASHBOARD_SERVER_ENV_FLAG]: 'true',
        [READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV]: 'npub-2',
      },
    });
    const enabled = getReadinessDashboardServerRouteGate({
      publicKey: ' NPub-1 ',
      env: {
        NODE_ENV: 'development',
        [READINESS_DASHBOARD_SERVER_ENV_FLAG]: 'true',
        [READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV]: 'npub-1,npub-2',
      },
    });

    expect(unauthorized.enabled).toBe(false);
    expect(unauthorized.reason).toBe('unauthorized');
    expect(enabled.enabled).toBe(true);
    expect(enabled.reason).toBe('enabled');
    expect(enabled.allowedPublicKey).toBe('npub-1');
    expect(enabled.hiddenFromOrdinaryHushVotingNavigation).toBe(false);
  });

  it('parses comma-separated allowlist values safely', () => {
    expect(parseAllowedReadinessDashboardPublicKeys(' A , ,b,C ').has('c')).toBe(true);
  });

  it('allows local development without an explicit allowlist or with a wildcard', () => {
    const defaultDevelopment = getReadinessDashboardServerRouteGate({
      publicKey: 'NPub-1',
      env: {
        NODE_ENV: 'development',
      },
    });
    const development = getReadinessDashboardServerRouteGate({
      publicKey: 'NPub-1',
      env: {
        NODE_ENV: 'development',
        [READINESS_DASHBOARD_SERVER_ENV_FLAG]: 'true',
        [READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV]: '*',
      },
    });
    const production = getReadinessDashboardServerRouteGate({
      publicKey: 'NPub-1',
      env: {
        NODE_ENV: 'production',
        [READINESS_DASHBOARD_SERVER_ENV_FLAG]: 'true',
        [READINESS_DASHBOARD_SERVER_PRODUCTION_ENV_FLAG]: 'true',
        [READINESS_DASHBOARD_ALLOWED_PUBLIC_KEYS_ENV]: '*',
      },
    });

    expect(defaultDevelopment.enabled).toBe(true);
    expect(defaultDevelopment.reason).toBe('enabled');
    expect(development.enabled).toBe(true);
    expect(development.reason).toBe('enabled');
    expect(production.enabled).toBe(false);
    expect(production.reason).toBe('unauthorized');
  });
});
