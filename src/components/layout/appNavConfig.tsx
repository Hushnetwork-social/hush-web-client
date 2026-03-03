import { Globe, Search, PlusSquare, MessageSquare, PlusCircle, UsersRound, Users } from "lucide-react";
import type { AppId } from "@/stores/useAppStore";

export interface AppNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  badgeCount?: number;
}

const membersItem: AppNavItem = {
  id: "members",
  label: "Members",
  icon: <Users className="w-5 h-5" />,
  comingSoon: true,
};

export function getAppNavItems(activeApp: AppId, crossAppBadges: Record<AppId, number>): AppNavItem[] {
  if (activeApp === "social") {
    return [
      { id: "feed-wall", label: "Feed Wall", icon: <Globe className="w-5 h-5" /> },
      { id: "search", label: "Search", icon: <Search className="w-5 h-5" /> },
      { id: "new-post", label: "New Post", icon: <PlusSquare className="w-5 h-5" /> },
      membersItem,
      {
        id: "switch-feeds",
        label: "HushFeeds!",
        icon: <MessageSquare className="w-5 h-5" />,
        badgeCount: crossAppBadges.feeds,
      },
    ];
  }

  return [
    { id: "feeds", label: "Feeds", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "new-chat", label: "New Feed", icon: <PlusCircle className="w-5 h-5" /> },
    { id: "create-group", label: "Create Group", icon: <UsersRound className="w-5 h-5" /> },
    membersItem,
    {
      id: "switch-social",
      label: "HushSocial!",
      icon: <Globe className="w-5 h-5" />,
      badgeCount: crossAppBadges.social,
    },
  ];
}
