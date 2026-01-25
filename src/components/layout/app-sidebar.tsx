"use client";

import { forwardRef, useRef, useImperativeHandle } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Newspaper, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomeIcon, PeopleIcon, ChevronLeftIcon, ChevronRightIcon, LocationIcon, CalendarIcon } from "@/app/(app)/network/icons";
import AccountCard from "@/app/(app)/network/account-card";
import { UserSearchBar, type UserSearchBarRef } from "@/components/user-search-bar";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export interface AppSidebarRef {
  focusSearch?: () => void;
}

export const AppSidebar = forwardRef<AppSidebarRef, AppSidebarProps>(function AppSidebar({
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onMobileClose,
}, ref) {
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
      <div className="p-4 flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
          {/* <span className="text-white dark:text-gray-900 text-xs font-bold">OM</span> */}
        </div>
        {!isCollapsed && (
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">OM</span>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "ml-auto p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors",
              isCollapsed && "ml-0",
              "hidden lg:flex"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <ChevronLeftIcon className="w-4 h-4" />
            )}
          </button>
        )}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className={cn(
              "ml-auto p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors",
              "lg:hidden"
            )}
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div data-tour="sidebar-search" className="px-3 py-2">
          <UserSearchBar ref={searchBarRef} />
        </div>
      )}

      {/* Tour Button */}
      {!isCollapsed && (
        <div className="px-3 py-2">
          <Button
            onClick={() => {
              // Trigger page-specific tour via custom event
              window.dispatchEvent(new CustomEvent('trigger-page-tour'));
            }}
            variant="outline"
            size="sm"
            className="w-full bg-white dark:bg-gray-900 shadow-sm"
          >
            <HelpCircle className="size-4 mr-2" />
            Take a Tour
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav data-tour="sidebar-nav" className={cn("py-2 space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
        <Link
          href="/"
          onClick={onMobileClose}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Home" : undefined}
        >
          <HomeIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/") && "font-medium")}>Home</span>
          )}
        </Link>
        <Link
          href="/listings"
          onClick={onMobileClose}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/listings")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Listings" : undefined}
        >
          <LocationIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/listings") && "font-medium")}>Listings</span>
          )}
        </Link>
        <Link
          href="/network"
          onClick={onMobileClose}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/network")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Network" : undefined}
        >
          <PeopleIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/network") && "font-medium")}>Network</span>
          )}
        </Link>
        <Link
          href="/events"
          onClick={onMobileClose}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/events")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Events" : undefined}
        >
          <CalendarIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/events") && "font-medium")}>Events</span>
          )}
        </Link>
        <Link
          href="/news"
          onClick={onMobileClose}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/news")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "News" : undefined}
        >
          <Newspaper className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/news") && "font-medium")}>News</span>
          )}
        </Link>
        <Link
          href="/messages"
          onClick={onMobileClose}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/messages")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Messages" : undefined}
        >
          <MessageSquare className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/messages") && "font-medium")}>Messages</span>
          )}
        </Link>
      </nav>

      {/* Account Card */}
      <div data-tour="account-card" className="mt-auto border-t border-gray-200 dark:border-gray-800 p-3">
        <AccountCard isCollapsed={isCollapsed} onNavigate={isDesktop ? undefined : onMobileClose} />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar - Only visible on lg and above */}
      {isDesktop && (
        <aside className={cn(
          "border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 transition-all duration-200",
          isCollapsed ? "w-[64px]" : "w-[180px]"
        )}>
          {sidebarContent}
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar - Only visible on mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 transition-transform duration-300 ease-in-out",
          "lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!isMobileOpen}
      >
        {/* Mobile sidebar always shows expanded content */}
        <div className="p-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center"></div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">OM</span>
          {onMobileClose && (
            <button
              onClick={onMobileClose}
                className="ml-auto p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div data-tour="sidebar-search" className="px-3 py-2">
          <UserSearchBar ref={searchBarRef} />
        </div>

        {/* Tour Button */}
        <div className="px-3 py-2">
          <Button
            onClick={() => {
              // Trigger page-specific tour via custom event
              window.dispatchEvent(new CustomEvent('trigger-page-tour'));
              onMobileClose?.();
            }}
            variant="outline"
            size="sm"
            className="w-full bg-white dark:bg-gray-900 shadow-sm"
          >
            <HelpCircle className="size-4 mr-2" />
            Take a Tour
          </Button>
        </div>

        <nav data-tour="sidebar-nav" className="py-2 space-y-0.5 px-3">
          <Link
            href="/"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer px-2 py-1.5",
              isActive("/")
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <HomeIcon className="w-4 h-4" />
            <span className={cn("text-sm", isActive("/") && "font-medium")}>Home</span>
          </Link>
          <Link
            href="/listings"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer px-2 py-1.5",
              isActive("/listings")
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <LocationIcon className="w-4 h-4" />
            <span className={cn("text-sm", isActive("/listings") && "font-medium")}>Listings</span>
          </Link>
          <Link
            href="/network"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer px-2 py-1.5",
              isActive("/network")
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <PeopleIcon className="w-4 h-4" />
            <span className={cn("text-sm", isActive("/network") && "font-medium")}>Network</span>
          </Link>
          <Link
            href="/events"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer px-2 py-1.5",
              isActive("/events")
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className={cn("text-sm", isActive("/events") && "font-medium")}>Events</span>
          </Link>
          <Link
            href="/news"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer px-2 py-1.5",
              isActive("/news")
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <Newspaper className="w-4 h-4" />
            <span className={cn("text-sm", isActive("/news") && "font-medium")}>News</span>
          </Link>
          <Link
            href="/messages"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer px-2 py-1.5",
              isActive("/messages")
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span className={cn("text-sm", isActive("/messages") && "font-medium")}>Messages</span>
          </Link>
        </nav>

        <div data-tour="account-card" className="mt-auto border-t border-gray-200 dark:border-gray-800 p-3">
          <AccountCard isCollapsed={false} onNavigate={onMobileClose} />
        </div>
      </aside>
    </>
  );
});
