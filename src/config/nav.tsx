import { Calendar, Home, Map, Settings, User, Users, MessageSquare, Bell, Mail } from "lucide-react";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { Badge } from "@/components/base/badges/badges";

export const APP_NAV_ITEMS: NavItemType[] = [
    {
        label: "Home",
        icon: Home,
        href: "/",
    },
    {
        label: "Listings",
        icon: Map,
        href: "/listings",
    },
    {
        label: "Seminar Calendar",
        icon: Calendar,
        href: "/calendar",
        badge: <Badge className="ml-3" color="orange" type="pill-color" size="sm">Coming Soon</Badge>,
    },
    {
        label: "Users",
        icon: Users,
        href: "/users",
    },
    {
        label: "Messages",
        icon: MessageSquare,
        href: "/messages",
    },
    {
        label: "Notifications",
        icon: Bell,
        href: "/notifications",
    },
    {
        label: "Newsletter",
        icon: Mail,
        href: "https://openmidmarket.com",
    },
];

export const FOOTER_NAV_ITEMS: NavItemType[] = [
    {
        label: "Settings",
        icon: Settings,
        href: "/settings",
    },
    {
        label: "Profile",
        icon: User,
        href: "/profile",
    },
];

