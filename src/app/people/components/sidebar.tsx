"use client";

import { forwardRef, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HomeIcon, PeopleIcon, StarIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";
import AccountCard from "../account-card";
import type { Person } from "../types";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";

interface SidebarProps {
  people: Person[];
  selectedPerson: Person | null;
  showStarredOnly: boolean;
  onToggleStarred: () => void;
  onSelectPerson: (person: Person | null) => void;
  onPeopleIconClick: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface SidebarRef {
  focusSearch?: () => void;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(function Sidebar({
  people,
  selectedPerson,
  showStarredOnly,
  onToggleStarred,
  onSelectPerson,
  onPeopleIconClick,
  isCollapsed = false,
  onToggleCollapse,
}, ref) {
  const { user, profile, loading } = useUser();
  const [workspaceName, setWorkspaceName] = useState("");
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const workspaceInputRef = useRef<HTMLInputElement>(null);

  // Load workspace name from profile on mount or when profile changes
  useEffect(() => {
    if (loading) {
      setWorkspaceName("");
      return;
    }
    
    if (profile?.workspace_name) {
      setWorkspaceName(profile.workspace_name);
    } else {
      setWorkspaceName("My Workspace");
    }
  }, [profile, loading]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingWorkspace && workspaceInputRef.current && !isCollapsed) {
      workspaceInputRef.current.focus();
      workspaceInputRef.current.select();
    }
  }, [isEditingWorkspace, isCollapsed]);

  const handleWorkspaceClick = () => {
    if (!isCollapsed) {
      setIsEditingWorkspace(true);
    }
  };

  const saveWorkspaceName = async (name: string) => {
    if (!user) return;

    const trimmedName = name.trim() || "My Workspace";
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ workspace_name: trimmedName })
        .eq("id", user.id);

      if (error) throw error;
      setWorkspaceName(trimmedName);
    } catch (error) {
      console.error("Error saving workspace name:", error);
      // Revert to previous value on error
      if (profile?.workspace_name) {
        setWorkspaceName(profile.workspace_name);
      } else {
        setWorkspaceName("My Workspace");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkspaceBlur = () => {
    setIsEditingWorkspace(false);
    saveWorkspaceName(workspaceName);
  };

  const handleWorkspaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setIsEditingWorkspace(false);
      // Revert to saved value
      if (profile?.workspace_name) {
        setWorkspaceName(profile.workspace_name);
      } else {
        setWorkspaceName("My Workspace");
      }
    }
  };

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
    <div className={cn(
      "border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 transition-all duration-200",
      isCollapsed ? "w-[64px]" : "w-[180px]"
    )}>
      {/* Logo and Toggle */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
          <span className="text-white dark:text-gray-900 text-xs font-bold">OM</span>
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

      {/* My Workspace */}
      <div className={cn("py-2", isCollapsed ? "px-2" : "px-3")}>
        <div 
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5"
          )}
          title={isCollapsed ? workspaceName : undefined}
          onClick={handleWorkspaceClick}
        >
          <div className="w-4 h-4 bg-emerald-500 rounded flex-shrink-0" />
          {!isCollapsed && (
            <>
              {isEditingWorkspace ? (
                <input
                  ref={workspaceInputRef}
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onBlur={handleWorkspaceBlur}
                  onKeyDown={handleWorkspaceKeyDown}
                  className="text-sm text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none flex-1 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {loading ? "" : workspaceName}
                </span>
              )}
            </>
          )}
        </div>
      </div>


      {/* Navigation */}
      <nav className={cn("py-2 space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
        <div 
          onClick={onPeopleIconClick}
          className={cn(
            "flex items-center rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer text-gray-900 dark:text-gray-100",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5"
          )}
          title={isCollapsed ? "People" : undefined}
        >
          <PeopleIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className="text-sm font-medium">People</span>
          )}
        </div>
      </nav>

      {/* Groups */}
      <div className={cn("py-4", isCollapsed ? "px-2" : "px-3")}>
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Groups</span>
          </div>
        )}
        <div
          onClick={handleToggleStarred}
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5",
            showStarredOnly
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400"
          )}
          title={isCollapsed ? "Starred" : undefined}
        >
          <StarIcon className="w-3.5 h-3.5 text-amber-400" filled />
          {!isCollapsed && (
            <span className="text-sm">Starred</span>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto border-t border-gray-200 dark:border-gray-800 p-3">
        <Link
          href="/people/create"
          className={cn(
            "flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-400",
            isCollapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2 py-1.5"
          )}
          title={isCollapsed ? "Create new" : undefined}
        >
          <PlusIcon className="w-4 h-4" />
          {!isCollapsed && (
            <span className="text-sm">Create new</span>
          )}
        </Link>
      </div>

      {/* Account Card */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3">
        <AccountCard isCollapsed={isCollapsed} />
      </div>
    </div>
  );
});
