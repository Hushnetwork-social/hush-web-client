import type { ReactNode } from 'react';

type AccountTrusteeProposalSegmentLayoutProps = {
  children: ReactNode;
};

export function generateStaticParams(): Array<{ proposalId: string }> {
  return [{ proposalId: '_placeholder' }];
}

export default function AccountTrusteeProposalSegmentLayout({
  children,
}: AccountTrusteeProposalSegmentLayoutProps) {
  return children;
}
