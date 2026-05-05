import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProtocolPackageBindingStatusProto } from '@/lib/grpc';
import { createProtocolPackageBinding } from './HushVotingWorkspaceTestUtils';
import { ProtocolPackageBindingPanel } from './ProtocolPackageBindingPanel';

describe('ProtocolPackageBindingPanel', () => {
  it('shows open-blocking stale refs with a refresh action in readiness mode', () => {
    const onRefresh = vi.fn();

    render(
      <ProtocolPackageBindingPanel
        binding={createProtocolPackageBinding({
          PackageVersion: 'v0.9.0',
          Status: ProtocolPackageBindingStatusProto.Stale,
        })}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText('Protocol Omega package refs')).toBeInTheDocument();
    expect(screen.getByText('Stale package refs')).toBeInTheDocument();
    expect(screen.getByText('v0.9.0')).toBeInTheDocument();
    expect(screen.getByText('Opening is blocked until the owner refreshes to the latest approved compatible package.')).toBeInTheDocument();
    expect(screen.getByText('aaaaaaaaaaaa...aaaaaaaa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy full spec package hash/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('protocol-package-refresh'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders sealed refs as evidence without a refresh action', () => {
    render(
      <ProtocolPackageBindingPanel
        binding={createProtocolPackageBinding({
          Status: ProtocolPackageBindingStatusProto.Sealed,
          HasSealedAt: true,
        })}
        mode="evidence"
      />
    );

    expect(screen.getByText('Sealed at open')).toBeInTheDocument();
    expect(screen.getByText('These package refs are immutable evidence for this election.')).toBeInTheDocument();
    expect(screen.getByText('Access-location availability is operational; sealed hashes remain the election evidence.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Public spec package access location' })).toHaveAttribute(
      'href',
      'https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/spec.zip'
    );
    expect(screen.getByRole('link', { name: 'Open Public proof package access location' })).toHaveAttribute(
      'href',
      'https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/proof.zip'
    );
    expect(screen.queryByTestId('protocol-package-refresh')).not.toBeInTheDocument();
  });

  it('keeps missing fallback refs explicit and non-voter specific', () => {
    render(
      <ProtocolPackageBindingPanel
        binding={null}
        fallbackStatus={ProtocolPackageBindingStatusProto.Missing}
        fallbackMessage="Latest approved Protocol Omega package refs are missing."
      />
    );

    expect(screen.getByText('Missing package refs')).toBeInTheDocument();
    expect(screen.getByText('Latest approved Protocol Omega package refs are missing.')).toBeInTheDocument();
    expect(screen.getByText('Not selected')).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded')).toHaveLength(4);
    expect(screen.queryByText(/voter/i)).not.toBeInTheDocument();
  });

  it('renders incompatible refs as blocking recovery work', () => {
    render(
      <ProtocolPackageBindingPanel
        binding={createProtocolPackageBinding({
          Status: ProtocolPackageBindingStatusProto.Incompatible,
        })}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('Incompatible package refs')).toBeInTheDocument();
    expect(screen.getByText('Opening is blocked because the selected profile no longer matches the package refs.')).toBeInTheDocument();
    expect(screen.getByTestId('protocol-package-refresh')).toBeInTheDocument();
  });

  it('keeps reference-only backfill copy separate from sealed-at-open evidence', () => {
    render(
      <ProtocolPackageBindingPanel
        binding={createProtocolPackageBinding({
          Status: ProtocolPackageBindingStatusProto.ReferenceOnly,
        })}
      />
    );

    expect(screen.getByText('Reference only')).toBeInTheDocument();
    expect(screen.getByText(/backfilled for inspection/i)).toBeInTheDocument();
    expect(screen.queryByText('Sealed at open')).not.toBeInTheDocument();
  });
});
