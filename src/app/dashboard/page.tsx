import { redirect } from 'next/navigation';
import { FEEDS_HOME_ROUTE } from '@/lib/navigation/appRoutes';

export default function DashboardLegacyPage() {
  redirect(FEEDS_HOME_ROUTE);
}
