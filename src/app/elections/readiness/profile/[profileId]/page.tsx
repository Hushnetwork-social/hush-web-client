"use client";

import { use, useEffect } from 'react';
import {
  READINESS_DASHBOARD_NAV_ID,
  getReadinessDashboardClientRouteGate,
} from '@/lib/readinessDashboard';
import { ReadinessProfileCheckPage } from '@/modules/readinessDashboard';
import { useAppStore } from '@/stores';

type ReadinessProfilePageProps = {
  params: Promise<{
    profileId: string;
  }>;
};

export default function HushVotingReadinessProfilePage({ params }: ReadinessProfilePageProps) {
  const { profileId } = use(params);
  const setActiveApp = useAppStore((state) => state.setActiveApp);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);

  useEffect(() => {
    setActiveApp('voting');
    setSelectedNav(READINESS_DASHBOARD_NAV_ID);
  }, [setActiveApp, setSelectedNav]);

  return (
    <ReadinessProfileCheckPage
      profileId={profileId}
      gate={getReadinessDashboardClientRouteGate()}
    />
  );
}
