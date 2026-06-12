import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  READINESS_DASHBOARD_API_ROUTE,
  READINESS_DASHBOARD_CLIENT_ENV_FLAG,
  READINESS_DASHBOARD_PUBLIC_KEY_HEADER,
  READINESS_DASHBOARD_ROUTE,
  createReadinessDashboardFixtureSource,
  getReadinessDashboardClientRouteGate,
  type ReadinessDashboardApiResponse,
  type ReadinessDashboardServerGate,
} from '@/lib/readinessDashboard';
import { projectReadinessDashboard } from '@/lib/readinessDashboard/projection';
import { ReadinessDashboardPage } from './ReadinessDashboardPage';

const clientGate = getReadinessDashboardClientRouteGate({
  env: {
    NODE_ENV: 'development',
    [READINESS_DASHBOARD_CLIENT_ENV_FLAG]: 'true',
  },
});

const serverGate: ReadinessDashboardServerGate = {
  route: READINESS_DASHBOARD_ROUTE,
  enabled: true,
  hiddenFromOrdinaryHushVotingNavigation: false,
  reason: 'enabled',
  allowedPublicKey: 'npub-1',
};

const readyResponse: ReadinessDashboardApiResponse = {
  success: true,
  state: 'ready',
  dashboard: projectReadinessDashboard(createReadinessDashboardFixtureSource(), serverGate),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReadinessDashboardPage', () => {
  it('shows an explicit disabled state when the public route flag is closed', () => {
    render(
      <ReadinessDashboardPage
        gate={getReadinessDashboardClientRouteGate({
          env: {
            NODE_ENV: 'development',
            [READINESS_DASHBOARD_CLIENT_ENV_FLAG]: 'false',
          },
        })}
      />
    );

    expect(screen.getByTestId('readiness-state-disabled')).toHaveTextContent(
      'Readiness dashboard disabled'
    );
  });

  it('shows unauthorized API state without rendering dashboard data', () => {
    render(
      <ReadinessDashboardPage
        gate={clientGate}
        initialResponse={{
          success: false,
          state: 'unauthorized',
          code: 'readiness_dashboard_unauthorized',
          message: 'No access.',
        }}
      />
    );

    expect(screen.getByTestId('readiness-state-unauthorized')).toHaveTextContent(
      'Internal collaborator access required'
    );
    expect(screen.queryByTestId('readiness-summary')).not.toBeInTheDocument();
  });

  it('fetches the current readiness register without browser cache reuse', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => readyResponse,
    } as Response);

    render(
      <ReadinessDashboardPage
        gate={clientGate}
        credentialsPublicKey="npub-1"
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Internal Readiness Dashboard' })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(READINESS_DASHBOARD_API_ROUTE),
      {
        cache: 'no-store',
        headers: {
          [READINESS_DASHBOARD_PUBLIC_KEY_HEADER]: 'npub-1',
        },
      }
    );
  });

  it('renders the dashboard with profile gates and separate blocker status', () => {
    render(<ReadinessDashboardPage gate={clientGate} initialResponse={readyResponse} />);

    expect(screen.getByRole('heading', { name: 'Internal Readiness Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('RDY-REG-v0.1.3')).toBeInTheDocument();
    expect(screen.getByText('60 / 100')).toBeInTheDocument();
    expect(screen.getByTestId('readiness-report-last-updated')).toHaveTextContent(
      'Last updated: May 25, 2026, 3:45 PM'
    );

    const claimGates = screen.getByTestId('readiness-claim-gates');
    expect(within(claimGates).queryByText('internal audit rehearsal boundary')).not.toBeInTheDocument();
    expect(within(claimGates).queryByText('friendly organization pilot boundary')).not.toBeInTheDocument();
    expect(within(claimGates).getByText('Binding HushVoting! Direct')).toBeInTheDocument();
    const warningBadge = within(claimGates).getByText(/amber \/ with_warnings/);
    expect(warningBadge).toBeInTheDocument();
    expect(warningBadge).toHaveAttribute(
      'title',
      expect.stringContaining('operational_security_access_snapshot_missing')
    );
    expect(claimGates).toHaveTextContent('OPS-002');
    expect(claimGates).toHaveTextContent(
      'HushVoting! Direct / Binding / isNonBindingElection: false / direct'
    );
    expect(
      within(claimGates).getByRole('link', {
        name: 'View evidence checks for Binding HushVoting! Direct',
      })
    ).toHaveAttribute(
      'href',
      '/elections/readiness/profile/hushvoting.direct.binding'
    );

    const blockers = screen.getByTestId('readiness-blockers');
    expect(blockers).toHaveTextContent('RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-003');
    expect(blockers).toHaveTextContent('red / open');
    expect(blockers).toHaveTextContent('green / resolved');
  });

  it('does not let verifier warnings mask not-observed profile gates', () => {
    const source = createReadinessDashboardFixtureSource();
    const profile = source.register.claimProfiles?.find(
      (item) => item.profileId === 'hushvoting.direct.binding'
    );

    if (!profile) {
      throw new Error('Expected fixture readiness profile was not found.');
    }

    profile.gateSeverity = 'amber';
    profile.gateStatus = 'not_observed';
    profile.verifierWarningCount = 1;
    profile.verifierWarnings = [
      {
        checkCode: 'OPS-002',
        resultCode: 'operational_security_access_snapshot_missing',
        message: 'SP-10 access-control snapshot evidence is missing.',
        evidenceRef: 'public-verifier-output-current-public/VerifierOutput.json',
      },
    ];

    const response: ReadinessDashboardApiResponse = {
      success: true,
      state: 'ready',
      dashboard: projectReadinessDashboard(source, serverGate),
    };

    render(<ReadinessDashboardPage gate={clientGate} initialResponse={response} />);

    const claimGates = screen.getByTestId('readiness-claim-gates');
    const profileGate = within(claimGates).getByText('amber / not_observed');

    expect(profileGate).toBeInTheDocument();
    expect(profileGate).toHaveAttribute(
      'title',
      expect.stringContaining('operational_security_access_snapshot_missing')
    );
    expect(within(claimGates).queryByText('amber / with_warnings')).not.toBeInTheDocument();
  });

  it('keeps claim gates and blockers before dimensions in the document order', () => {
    render(<ReadinessDashboardPage gate={clientGate} initialResponse={readyResponse} />);

    const claimGates = screen.getByTestId('readiness-claim-gates');
    const blockers = screen.getByTestId('readiness-blockers');
    const dimensions = screen.getByTestId('readiness-dimensions');

    expect(Boolean(claimGates.compareDocumentPosition(dimensions) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(blockers.compareDocumentPosition(dimensions) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('shows missing catalog/register states as non-approval states', () => {
    render(
      <ReadinessDashboardPage
        gate={clientGate}
        initialResponse={{
          success: false,
          state: 'missing_catalog',
          code: 'catalog_missing',
          message: 'Readiness register catalog is missing.',
        }}
      />
    );

    expect(screen.getByTestId('readiness-state-missing_catalog')).toHaveTextContent(
      'Readiness catalog unavailable'
    );
  });
});
