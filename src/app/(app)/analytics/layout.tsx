"use client";

import { useRef } from "react";
import { BarChart3, Map, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
    { href: "/analytics/listings", label: "Listings", icon: Map },
    { href: "/analytics/comps", label: "Comps", icon: BarChart3 },
    { href: "/analytics/trends", label: "Trends", icon: TrendingUp },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Remember the last full URL (path + query) seen for each tab so switching
    // back restores the user's previous state instead of resetting to bare path.
    const tabUrls = useRef<Record<string, string>>(Object.fromEntries(tabs.map((t) => [t.href, t.href])));

    // Update the stored URL whenever the current tab's path/params change.
    const currentTabBase = tabs.find((t) => pathname === t.href)?.href;
    if (currentTabBase) {
        const qs = searchParams.toString();
        tabUrls.current[currentTabBase] = qs ? `${currentTabBase}?${qs}` : currentTabBase;
    }

    // Detail pages have their own full-page layout
    const isDetailPage = /^\/analytics\/(listing|building)\//.test(pathname ?? "");

    if (isDetailPage) {
        return <>{children}</>;
    }

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>

                    <div data-tour="view-tabs" className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const active = pathname === tab.href;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tabUrls.current[tab.href]}
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                                    )}
                                >
                                    <Icon className="size-4" />
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
    );
}
