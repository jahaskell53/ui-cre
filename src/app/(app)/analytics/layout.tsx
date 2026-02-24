"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Map, BarChart3, Calculator, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
    { href: "/analytics/trends", label: "Trends", icon: TrendingUp },
    { href: "/analytics/map", label: "Map", icon: Map },
    { href: "/analytics/comps", label: "Comps", icon: BarChart3 },
    { href: "/analytics/valuation", label: "Valuation", icon: Calculator },
    { href: "/analytics/properties", label: "Your Properties", icon: Building2 },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Detail pages have their own full-page layout
    const isDetailPage = /^\/analytics\/(listing|your-properties)\//.test(pathname ?? "");

    if (isDetailPage) {
        return <>{children}</>;
    }

    return (
        <div className="relative flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>

                    <div data-tour="view-tabs" className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const active = pathname === tab.href;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                        active
                                            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
