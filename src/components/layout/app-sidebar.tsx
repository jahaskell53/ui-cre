"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HomeIcon, PeopleIcon, ChevronLeftIcon, ChevronRightIcon, LocationIcon, CalendarIcon } from "@/app/people/icons";
import AccountCard from "@/app/people/account-card";

interface AppSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface AppSidebarRef {
  focusSearch?: () => void;
}

export const AppSidebar = forwardRef<AppSidebarRef, AppSidebarProps>(function AppSidebar({
  isCollapsed = false,
  onToggleCollapse,
}, ref) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className={cn(
      "border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 transition-all duration-200",
      isCollapsed ? "w-[64px]" : "w-[180px]"
    )}>
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
              isCollapsed && "ml-0"
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
      </div>

      {/* Navigation */}
      <nav className={cn("py-2 space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
        <Link
          href="/"
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
          href="/people"
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/people")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "People" : undefined}
        >
          <PeopleIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/people") && "font-medium")}>People</span>
          )}
        </Link>
        <Link
          href="/calendar"
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            isActive("/calendar")
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Calendar" : undefined}
        >
          <CalendarIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className={cn("text-sm", isActive("/calendar") && "font-medium")}>Calendar</span>
          )}
        </Link>
      </nav>

      {/* Account Card */}
      <div className="mt-auto border-t border-gray-200 dark:border-gray-800 p-3">
        <AccountCard isCollapsed={isCollapsed} />
      </div>
    </div>
  );
});
