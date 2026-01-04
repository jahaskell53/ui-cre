"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { APP_NAV_ITEMS, FOOTER_NAV_ITEMS } from "@/config/nav";

interface MainLayoutProps {
    children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    const pathname = usePathname();

    return (
        <div className="flex min-h-screen bg-secondary">
            <SidebarNavigationSimple
                items={APP_NAV_ITEMS}
                footerItems={FOOTER_NAV_ITEMS}
                activeUrl={pathname}
            />
            <main className="flex-1">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
};
