"use client";

import { useEffect } from 'react';
import {
  getReadinessDashboardClientRouteGate,
  READINESS_DASHBOARD_NAV_ID,
} from '@/lib/readinessDashboard';
import { ReadinessDashboardPage } from '@/modules/readinessDashboard';
import { useAppStore } from '@/stores';

export default function HushVotingReadinessPage() {
  const setActiveApp = useAppStore((state) => state.setActiveApp);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);

  useEffect(() => {
    setActiveApp('voting');
    setSelectedNav(READINESS_DASHBOARD_NAV_ID);
  }, [setActiveApp, setSelectedNav]);

  return <ReadinessDashboardPage gate={getReadinessDashboardClientRouteGate()} />;
}
