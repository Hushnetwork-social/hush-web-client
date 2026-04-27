import type { ReactNode } from 'react';

type ElectionSegmentLayoutProps = {
  children: ReactNode;
};

export function generateStaticParams(): Array<{ electionId: string }> {
  return [{ electionId: '_placeholder' }];
}

export default function ElectionSegmentLayout({ children }: ElectionSegmentLayoutProps) {
  return children;
}
