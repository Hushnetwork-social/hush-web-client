import type { ReactNode } from 'react';

type AccountTrusteeElectionSegmentLayoutProps = {
  children: ReactNode;
};

export function generateStaticParams(): Array<{ electionId: string }> {
  return [{ electionId: '_placeholder' }];
}

export default function AccountTrusteeElectionSegmentLayout({
  children,
}: AccountTrusteeElectionSegmentLayoutProps) {
  return children;
}
