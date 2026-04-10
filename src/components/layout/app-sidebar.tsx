"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { HelpCircle, MessageSquare, Newspaper, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountCard from "@/app/(app)/network/account-card";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, HomeIcon, PeopleIcon } from "@/app/(app)/network/icons";
import { UserSearchBar, type UserSearchBarRef } from "@/components/user-search-bar";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
}

export interface AppSidebarRef {
    focusSearch?: () => void;
}

export const AppSidebar = forwardRef<AppSidebarRef, AppSidebarProps>(function AppSidebar(
    { isCollapsed = false, onToggleCollapse, isMobileOpen = false, onMobileClose },
    ref,
) {
    const pathname = usePathname();
    const searchBarRef = useRef<UserSearchBarRef>(null);
    const isDesktop = useBreakpoint("lg");

    useImperativeHandle(ref, () => ({
        focusSearch: () => {
            searchBarRef.current?.focusSearch?.();
        },
    }));

    const isActive = (href: string) => {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname?.startsWith(href);
    };

    const sidebarContent = (
        <>
            {/* Logo and Toggle */}
            <div className="flex items-center gap-2 p-4">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-900 dark:bg-gray-100">
                    {/* <span className="text-white dark:text-gray-900 text-xs font-bold">OM</span> */}
                </div>
                {!isCollapsed && <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">OM</span>}
                {onToggleCollapse && (
                    <button
                        onClick={onToggleCollapse}
                        className={cn(
                            "ml-auto rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                            isCollapsed && "ml-0",
                            "hidden lg:flex",
                        )}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
                    </button>
                )}
                {onMobileClose && (
                    <button
                        onClick={onMobileClose}
                        className={cn(
                            "ml-auto rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                            "lg:hidden",
                        )}
                        title="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Search */}
            {!isCollapsed && (
                <div data-tour="sidebar-search" className="px-3 py-2">
                    <UserSearchBar ref={searchBarRef} />
                </div>
            )}

            {/* Navigation */}
            <nav data-tour="sidebar-nav" className={cn("space-y-0.5 py-2", isCollapsed ? "px-2" : "px-3")}>
                <Link
                    href="/"
                    onClick={onMobileClose}
                    className={cn(
                        "flex cursor-pointer items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
                        isActive("/") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                    )}
                    title={isCollapsed ? "Home" : undefined}
                >
                    <HomeIcon className="h-4 w-4" />
                    {!isCollapsed && <span className={cn("text-sm", isActive("/") && "font-medium")}>Home</span>}
                </Link>
                <Link
                    href="/analytics"
                    onClick={onMobileClose}
                    className={cn(
                        "flex cursor-pointer items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
                        isActive("/analytics") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                    )}
                    title={isCollapsed ? "Analytics" : undefined}
                >
                    <TrendingUp className="h-4 w-4" />
                    {!isCollapsed && <span className={cn("text-sm", isActive("/analytics") && "font-medium")}>Analytics</span>}
                </Link>
                <Link
                    href="/network"
                    onClick={onMobileClose}
                    className={cn(
                        "flex cursor-pointer items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
                        isActive("/network") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                    )}
                    title={isCollapsed ? "Network" : undefined}
                >
                    <PeopleIcon className="h-4 w-4" />
                    {!isCollapsed && <span className={cn("text-sm", isActive("/network") && "font-medium")}>Network</span>}
                </Link>
                <Link
                    href="/events"
                    onClick={onMobileClose}
                    className={cn(
                        "flex cursor-pointer items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
                        isActive("/events") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                    )}
                    title={isCollapsed ? "Events" : undefined}
                >
                    <CalendarIcon className="h-4 w-4" />
                    {!isCollapsed && <span className={cn("text-sm", isActive("/events") && "font-medium")}>Events</span>}
                </Link>
                <Link
                    href="/news"
                    onClick={onMobileClose}
                    className={cn(
                        "flex cursor-pointer items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
                        isActive("/news") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                    )}
                    title={isCollapsed ? "News" : undefined}
                >
                    <Newspaper className="h-4 w-4" />
                    {!isCollapsed && <span className={cn("text-sm", isActive("/news") && "font-medium")}>News</span>}
                </Link>
                <Link
                    href="/messages"
                    onClick={onMobileClose}
                    className={cn(
                        "flex cursor-pointer items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
                        isActive("/messages") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                    )}
                    title={isCollapsed ? "Messages" : undefined}
                >
                    <MessageSquare className="h-4 w-4" />
                    {!isCollapsed && <span className={cn("text-sm", isActive("/messages") && "font-medium")}>Messages</span>}
                </Link>
            </nav>

            {/* Tour Button and Account Card */}
            <div className="mt-auto">
                {!isCollapsed && (
                    <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
                        <button
                            onClick={() => {
                                // Trigger page-specific tour via custom event
                                window.dispatchEvent(new CustomEvent("trigger-page-tour"));
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                            )}
                        >
                            <HelpCircle className="h-4 w-4" />
                            Take a Tour
                        </button>
                    </div>
                )}
                <div data-tour="account-card" className="p-3">
                    <AccountCard isCollapsed={isCollapsed} onNavigate={isDesktop ? undefined : onMobileClose} />
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar - Only visible on lg and above */}
            {isDesktop && (
                <aside
                    className={cn(
                        "flex h-screen flex-col overflow-hidden border-r border-gray-200 bg-white transition-all duration-200 dark:border-gray-800 dark:bg-gray-900",
                        isCollapsed ? "w-[64px]" : "w-[180px]",
                    )}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* Mobile Sidebar Overlay */}
            {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-hidden="true" />}

            {/* Mobile Sidebar - Only visible on mobile */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex h-screen w-[280px] flex-col overflow-hidden border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900",
                    "lg:hidden",
                    isMobileOpen ? "translate-x-0" : "-translate-x-full",
                )}
                aria-hidden={!isMobileOpen}
            >
                {/* Mobile sidebar always shows expanded content */}
                <div className="flex items-center gap-2 p-4">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-900 dark:bg-gray-100"></div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">OM</span>
                    {onMobileClose && (
                        <button
                            onClick={onMobileClose}
                            className="ml-auto rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            title="Close menu"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <div data-tour="sidebar-search" className="px-3 py-2">
                    <UserSearchBar ref={searchBarRef} />
                </div>

                <nav data-tour="sidebar-nav" className="space-y-0.5 px-3 py-2">
                    <Link
                        href="/"
                        onClick={onMobileClose}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isActive("/") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                        )}
                    >
                        <HomeIcon className="h-4 w-4" />
                        <span className={cn("text-sm", isActive("/") && "font-medium")}>Home</span>
                    </Link>
                    <Link
                        href="/analytics"
                        onClick={onMobileClose}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isActive("/analytics") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                        )}
                    >
                        <TrendingUp className="h-4 w-4" />
                        <span className={cn("text-sm", isActive("/analytics") && "font-medium")}>Analytics</span>
                    </Link>
                    <Link
                        href="/network"
                        onClick={onMobileClose}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isActive("/network") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                        )}
                    >
                        <PeopleIcon className="h-4 w-4" />
                        <span className={cn("text-sm", isActive("/network") && "font-medium")}>Network</span>
                    </Link>
                    <Link
                        href="/events"
                        onClick={onMobileClose}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isActive("/events") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                        )}
                    >
                        <CalendarIcon className="h-4 w-4" />
                        <span className={cn("text-sm", isActive("/events") && "font-medium")}>Events</span>
                    </Link>
                    <Link
                        href="/news"
                        onClick={onMobileClose}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isActive("/news") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                        )}
                    >
                        <Newspaper className="h-4 w-4" />
                        <span className={cn("text-sm", isActive("/news") && "font-medium")}>News</span>
                    </Link>
                    <Link
                        href="/messages"
                        onClick={onMobileClose}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isActive("/messages") ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                        )}
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span className={cn("text-sm", isActive("/messages") && "font-medium")}>Messages</span>
                    </Link>
                </nav>

                {/* Tour Button and Account Card */}
                <div className="mt-auto">
                    <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
                        <button
                            onClick={(e) => {
                                window.dispatchEvent(new CustomEvent("trigger-page-tour"));
                                // Close after blur so aria-hidden is not applied while focus is inside the drawer
                                e.currentTarget.blur();
                                requestAnimationFrame(() => onMobileClose?.());
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                            )}
                        >
                            <HelpCircle className="h-4 w-4" />
                            Take a Tour
                        </button>
                    </div>
                    <div data-tour="account-card" className="p-3">
                        <AccountCard isCollapsed={false} onNavigate={onMobileClose} />
                    </div>
                </div>
            </aside>
        </>
    );
});
