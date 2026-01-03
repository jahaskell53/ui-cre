import { BarChartSquare01, Calendar, Home01, Map01, Settings01, User01, TrendUp02 } from "@untitledui/icons";
import type { NavItemType } from "@/components/application/app-navigation/config";

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
    },
    {
        label: "Holdings & Insights",
        icon: BarChartSquare01,
        href: "/holdings",
    },
    {
        label: "Market Intelligence",
        icon: TrendUp02,
        href: "/market-intelligence",
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
