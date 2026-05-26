import {
  FileCheck2,
  Globe,
  Gauge,
  Search,
  PlusSquare,
  MessageSquare,
  PlusCircle,
  UsersRound,
  Vote,
} from "lucide-react";
import {
  getReadinessDashboardClientRouteGate,
  READINESS_DASHBOARD_NAV_ID,
} from "@/lib/readinessDashboard/routeGate";
import type { AppId } from "@/stores/useAppStore";

export interface AppNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  badgeCount?: number;
  guestAllowed?: boolean;
}

export function getAppNavItems(activeApp: AppId, crossAppBadges: Record<AppId, number>): AppNavItem[] {
  if (activeApp === "social") {
    return [
      { id: "search", label: "Search", icon: <Search className="w-5 h-5" /> },
      { id: "new-post", label: "New Post", icon: <PlusSquare className="w-5 h-5" /> },
      {
        id: "switch-feeds",
        label: "HushFeeds!",
        icon: <MessageSquare className="w-5 h-5" />,
        badgeCount: crossAppBadges.feeds,
      },
      {
        id: "open-voting",
        label: "HushVoting!",
        icon: <Vote className="w-5 h-5" />,
      },
    ];
  }

  if (activeApp === "voting") {
    const readinessDashboardGate = getReadinessDashboardClientRouteGate();
    const votingNavItems: AppNavItem[] = [
      { id: "open-voting", label: "Election Hub", icon: <Vote className="w-5 h-5" /> },
      {
        id: "verify-receipt",
        label: "Verify receipt",
        icon: <FileCheck2 className="w-5 h-5" />,
        guestAllowed: true,
      },
    ];

    if (readinessDashboardGate.enabled) {
      votingNavItems.push({
        id: READINESS_DASHBOARD_NAV_ID,
        label: "Readiness",
        icon: <Gauge className="w-5 h-5" />,
      });
    }

    votingNavItems.push(
      {
        id: "switch-feeds",
        label: "HushFeeds!",
        icon: <MessageSquare className="w-5 h-5" />,
        badgeCount: crossAppBadges.feeds,
      },
      {
        id: "switch-social",
        label: "HushSocial!",
        icon: <Globe className="w-5 h-5" />,
        badgeCount: crossAppBadges.social,
      },
    );

    return votingNavItems;
  }

  return [
    { id: "feeds", label: "Feeds", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "new-chat", label: "New Feed", icon: <PlusCircle className="w-5 h-5" /> },
    { id: "create-group", label: "Create Group", icon: <UsersRound className="w-5 h-5" /> },
    {
      id: "switch-social",
      label: "HushSocial!",
      icon: <Globe className="w-5 h-5" />,
      badgeCount: crossAppBadges.social,
    },
    {
      id: "open-voting",
      label: "HushVoting!",
      icon: <Vote className="w-5 h-5" />,
    },
  ];
}
