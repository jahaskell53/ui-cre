import { BarChartSquare01, Calendar, Home01, Map01, Settings01, User01, TrendUp02, Users01, MessageChatSquare, Bell01, Mail01 } from "@untitledui/icons";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { Badge } from "@/components/base/badges/badges";

export const APP_NAV_ITEMS: NavItemType[] = [
    {
        label: "Home",
        icon: Home01,
        href: "/",
    },
    {
        label: "Property Map",
        icon: Map01,
        href: "/map",
    },
    {
        label: "Seminar Calendar",
        icon: Calendar,
        href: "/calendar",
        badge: <Badge className="ml-3" color="orange" type="pill-color" size="sm">Coming Soon</Badge>,
    },
    {
        label: "Holdings & Insights",
        icon: BarChartSquare01,
        href: "/holdings",
        badge: <Badge className="ml-3" color="orange" type="pill-color" size="sm">Coming Soon</Badge>,
    },
    {
        label: "Market Intelligence",
        icon: TrendUp02,
        href: "/market-intelligence",
        badge: <Badge className="ml-3" color="orange" type="pill-color" size="sm">Coming Soon</Badge>,
    },
    {
        label: "Users",
        icon: Users01,
        href: "/users",
    },
    {
        label: "Messages",
        icon: MessageChatSquare,
        href: "/messages",
    },
    {
        label: "Notifications",
        icon: Bell01,
        href: "/notifications",
    },
    {
        label: "Newsletter",
        icon: Mail01,
        href: "https://openmidmarket.com",
    },
];

export const FOOTER_NAV_ITEMS: NavItemType[] = [
    {
        label: "Settings",
        icon: Settings01,
        href: "/settings",
    },
    {
        label: "Profile",
        icon: User01,
        href: "/profile",
    },
];

