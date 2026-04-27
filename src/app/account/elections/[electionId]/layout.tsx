import type { ReactNode } from 'react';

type AccountElectionSegmentLayoutProps = {
  children: ReactNode;
};

export function generateStaticParams(): Array<{ electionId: string }> {
  return [{ electionId: '_placeholder' }];
}

export default function AccountElectionSegmentLayout({
  children,
}: AccountElectionSegmentLayoutProps) {
  return children;
}
