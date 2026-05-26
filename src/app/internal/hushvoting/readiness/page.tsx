import { redirect } from 'next/navigation';
import { READINESS_DASHBOARD_ROUTE } from '@/lib/readinessDashboard';

export default function InternalHushVotingReadinessPage() {
  redirect(READINESS_DASHBOARD_ROUTE);
}
