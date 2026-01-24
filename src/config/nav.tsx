import { Calendar, Home, Map, Settings, User, Users, MessageSquare, Bell, Mail } from "lucide-react";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { Badge } from "@/components/ui/badge";

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
        label: "Events",
        icon: Calendar,
        href: "/events",
        badge: <Badge className="ml-3 bg-orange-100 text-orange-700 border-orange-200">Coming Soon</Badge>,
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

