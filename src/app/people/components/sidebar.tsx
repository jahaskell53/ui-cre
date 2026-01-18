"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SearchIcon, HomeIcon, PeopleIcon, StarIcon, PlusIcon, GridIcon } from "../icons";
import AccountCard from "../account-card";
import type { Person } from "../types";

interface SidebarProps {
  people: Person[];
  selectedPerson: Person | null;
  showStarredOnly: boolean;
  searchQuery: string;
  onToggleStarred: () => void;
  onSelectPerson: (person: Person | null) => void;
  onSearchChange: (query: string) => void;
  onPeopleIconClick: () => void;
}

export interface SidebarRef {
  focusSearch: () => void;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(function Sidebar({
  people,
  selectedPerson,
  showStarredOnly,
  searchQuery,
  onToggleStarred,
  onSelectPerson,
  onSearchChange,
  onPeopleIconClick,
}, ref) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
  }));
  const handleToggleStarred = () => {
    const newShowStarredOnly = !showStarredOnly;
    onToggleStarred();

    // If switching to starred filter, ensure selected person is starred
    if (newShowStarredOnly && selectedPerson && !selectedPerson.starred) {
      const starredPeople = people.filter((p) => p.starred);
      onSelectPerson(starredPeople.length > 0 ? starredPeople[0] : null);
    } else if (!newShowStarredOnly && !selectedPerson) {
      // If switching away from starred and no selection, select first person
      onSelectPerson(people.length > 0 ? people[0] : null);
    }
  };

  return (
    <div className="w-[180px] border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
          <span className="text-white dark:text-gray-900 text-xs font-bold"></span>OM
        </div>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">OM</span>
        <div className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <GridIcon className="text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* My Workspace */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
          <div className="w-4 h-4 bg-emerald-500 rounded" />
          <span className="text-sm text-gray-700 dark:text-gray-300">My Workspace</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-2 space-y-0.5">
        {/* <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-400">
          <HomeIcon className="w-4 h-4" />
          <span className="text-sm">Home</span>
        </div> */}
        <div 
          onClick={onPeopleIconClick}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer text-gray-900 dark:text-gray-100"
        >
          <PeopleIcon className="w-4 h-4" />
          <span className="text-sm font-medium">People</span>
        </div>
      </nav>

      {/* Groups */}
      <div className="px-3 py-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Groups</span>
          <PlusIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300" />
        </div>
        <div
          onClick={handleToggleStarred}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            showStarredOnly
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
        >
          <StarIcon className="w-3.5 h-3.5 text-amber-400" filled />
          <span className="text-sm">Starred</span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto border-t border-gray-200 dark:border-gray-800 p-3">
        <Link
          href="/people/create"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-400"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="text-sm">Create new</span>
        </Link>
      </div>

      {/* Account Card */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3">
        <AccountCard />
      </div>
    </div>
  );
});
