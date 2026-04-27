import type { ReactNode } from 'react';

type TrusteeProposalSegmentLayoutProps = {
  children: ReactNode;
};

export function generateStaticParams(): Array<{ proposalId: string }> {
  return [{ proposalId: '_placeholder' }];
}

export default function TrusteeProposalSegmentLayout({
  children,
}: TrusteeProposalSegmentLayoutProps) {
  return children;
}
