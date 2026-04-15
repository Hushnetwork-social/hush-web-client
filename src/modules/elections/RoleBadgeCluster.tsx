"use client";

import type { ElectionApplicationRoleFlagsView } from '@/lib/grpc';

type RoleBadgeClusterProps = {
  roles: ElectionApplicationRoleFlagsView;
  compact?: boolean;
};

const ROLE_BADGES = [
  { key: 'IsOwnerAdmin', label: 'Owner/Admin', className: 'border-hush-purple/40 bg-hush-purple/10 text-hush-purple' },
  { key: 'IsTrustee', label: 'Trustee', className: 'border-blue-500/40 bg-blue-500/10 text-blue-100' },
  { key: 'IsVoter', label: 'Voter', className: 'border-green-500/40 bg-green-500/10 text-green-100' },
  { key: 'IsDesignatedAuditor', label: 'Auditor', className: 'border-amber-500/40 bg-amber-500/10 text-amber-100' },
] as const;

export function RoleBadgeCluster({ roles, compact = false }: RoleBadgeClusterProps) {
  const badgeClassName = compact
    ? 'rounded-full border px-2.5 py-0.5 text-[11px] font-medium'
    : 'rounded-full border px-3 py-1 text-xs font-medium';

  return (
    <div className="flex flex-wrap gap-2" data-testid="role-badge-cluster">
      {ROLE_BADGES.filter((badge) => roles[badge.key]).map((badge) => (
        <span
          key={badge.key}
          className={`${badgeClassName} ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
