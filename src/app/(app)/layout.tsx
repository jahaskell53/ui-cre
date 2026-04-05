"use client";

import { useRef, useState } from "react";
import { useEffect } from "react";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar, type AppSidebarRef } from "@/components/layout/app-sidebar";
import { useUser } from "@/hooks/use-user";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading: authLoading } = useUser();
    const sidebarRef = useRef<AppSidebarRef>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Check if current route is a public event page
    const isPublicEventPage = pathname?.startsWith("/events/") && /^\/events\/[^\/]+$/.test(pathname);

    // Redirect to login if not authenticated (only after loading is complete)
    // Skip redirect for public event pages
    useEffect(() => {
        if (!authLoading && !user && !isPublicEventPage) {
            router.push("/login");
        }
    }, [authLoading, user, router, isPublicEventPage]);

    // Show loading state while checking authentication
    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    // If not authenticated and not loading, show nothing (redirect will happen via useEffect)
    // But also render children in case there's a race condition - the middleware will handle redirect
    // Exception: allow public event pages to render without authentication
    if (!user && !isPublicEventPage) {
        return null;
    }

    // For public event pages, render without sidebar
    if (isPublicEventPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen bg-white dark:bg-gray-900">
            {/* Left Sidebar */}
            <AppSidebar
                ref={sidebarRef}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                isMobileOpen={isMobileOpen}
                onMobileClose={() => setIsMobileOpen(false)}
            />

            {/* Main Content */}
            <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-white lg:ml-0 dark:bg-gray-900">
                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="fixed top-4 left-4 z-30 rounded-md border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-100 lg:hidden dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label="Open menu"
                >
                    <Menu className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            </div>
        </div>
    );
}
