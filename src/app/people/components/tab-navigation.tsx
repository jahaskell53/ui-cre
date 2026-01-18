"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SortIcon, CheckIcon } from "../icons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SortBy } from "../people-context";

interface TabNavigationProps {
  sortBy: SortBy;
  reverse: boolean;
  onSortChange: (sortBy: SortBy) => void;
  onReverseChange: (reverse: boolean) => void;
}

export function TabNavigation({ sortBy, reverse, onSortChange, onReverseChange }: TabNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const tabs = [
    { href: "/people", label: "People", value: "people" },
    { href: "/people/board", label: "Board", value: "board" },
    { href: "/people/map", label: "Map", value: "map" },
  ];

  const isActive = (href: string) => {
    if (href === "/people") {
      return pathname === "/people";
    }
    return pathname?.startsWith(href);
  };

  // Handle Tab/Shift+Tab keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Tab") {
        const currentIndex = tabs.findIndex((tab) => {
          if (tab.href === "/people") {
            return pathname === "/people";
          }
          return pathname?.startsWith(tab.href);
        });
        if (currentIndex !== -1) {
          e.preventDefault();
          let newIndex: number;
          if (e.shiftKey) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          } else {
            newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          }
          router.push(tabs[newIndex].href);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pathname, router]);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.value}
                href={tab.href}
                className={cn(
                  "px-0 py-1 text-sm font-medium border-b-2 rounded-none transition-colors",
                  active
                    ? "text-gray-900 dark:text-gray-100 border-gray-900 dark:border-gray-100"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
                <span>{sortBy === 'recency' ? 'Recency' : 'Alphabetical'}</span>
                <SortIcon className={cn("w-4 h-4", reverse && "rotate-180")} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  if (sortBy === 'recency') {
                    onReverseChange(!reverse);
                  } else {
                    onSortChange('recency');
                    onReverseChange(false);
                  }
                }}
                className="flex items-center justify-between"
              >
                <span>Recency</span>
                {sortBy === 'recency' && <CheckIcon className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (sortBy === 'alphabetical') {
                    onReverseChange(!reverse);
                  } else {
                    onSortChange('alphabetical');
                    onReverseChange(false);
                  }
                }}
                className="flex items-center justify-between"
              >
                <span>Alphabetical</span>
                {sortBy === 'alphabetical' && <CheckIcon className="w-4 h-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

