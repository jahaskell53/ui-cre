"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SortIcon, CheckIcon, SearchIcon } from "../icons";
import { cn } from "@/lib/utils";
import { usePeople, type SortBy } from "../people-context";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TabNavigationProps {
  sortBy: SortBy;
  reverse: boolean;
  onSortChange: (sortBy: SortBy) => void;
  onReverseChange: (reverse: boolean) => void;
}

export function TabNavigation({ sortBy, reverse, onSortChange, onReverseChange }: TabNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { people, setSelectedIds, searchQuery, setSearchQuery } = usePeople();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectAll = () => {
    setSelectedIds(new Set(people.map((p) => p.id)));
  };

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Handle Cmd+F / Ctrl+F to expand and focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        if (pathname === "/people" || pathname === "/people/map") {
          e.preventDefault();
          setIsSearchExpanded(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pathname]);
  
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
          {/* Search - shown on both people and map pages */}
          {(pathname === "/people" || pathname === "/people/map") && (
            <>
              {isSearchExpanded ? (
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchQuery.trim()) {
                        setIsSearchExpanded(false);
                      }
                    }}
                    className="pl-8 pr-8 h-8 w-48 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchExpanded(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Close search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchExpanded(true)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Search"
                >
                  <SearchIcon className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          
          {/* Filter type and select all - only shown on people page */}
          {pathname === "/people" && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                    <span>
                      {sortBy === 'recency' ? 'Recency' : 
                       sortBy === 'alphabetical' ? 'Alphabetical' : 
                       'Network Strength'}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => onSortChange(value as SortBy)}>
                    <DropdownMenuRadioItem value="recency">Recency</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="alphabetical">Alphabetical</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="network-strength">Network Strength</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onReverseChange(!reverse)}>
                    <SortIcon className={cn("w-4 h-4 mr-2", reverse && "rotate-180")} />
                    {reverse ? 'Ascending' : 'Descending'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={handleSelectAll}
                className="p-0 border-0 bg-transparent cursor-pointer hover:opacity-70 transition-opacity"
                aria-label="Select all contacts"
              >
                <CheckIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

