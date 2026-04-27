import type { ReactNode } from 'react';

type AccountVoterElectionSegmentLayoutProps = {
  children: ReactNode;
};

export function generateStaticParams(): Array<{ electionId: string }> {
  return [{ electionId: '_placeholder' }];
}

export default function AccountVoterElectionSegmentLayout({
  children,
}: AccountVoterElectionSegmentLayoutProps) {
  return children;
}
