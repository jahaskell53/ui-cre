"use client";

import { forwardRef, useState, useRef, useImperativeHandle, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/utils/supabase";
import { generateAuroraGradient } from "@/app/people/utils";
import { SearchIcon } from "@/app/people/icons";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  roles: string[] | null;
}

export interface UserSearchBarRef {
  focusSearch?: () => void;
}

interface UserSearchBarProps {
  className?: string;
  containerClassName?: string;
}

export const UserSearchBar = forwardRef<UserSearchBarRef, UserSearchBarProps>(function UserSearchBar(
  { className, containerClassName },
  ref
) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
  }));

  // Search users with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowPreview(false);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    debounceTimerRef.current = timer;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowPreview(false);
      return;
    }

    setIsSearchLoading(true);
    setShowPreview(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, website, roles")
        .ilike("full_name", `%${query}%`)
        .limit(5);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Close preview when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showPreview]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/users?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setShowPreview(false);
    }
  };

  const handleUserClick = (userId: string) => {
    router.push(`/users/${userId}`);
    setSearchQuery("");
    setShowPreview(false);
  };

  return (
    <div className={cn("relative", containerClassName)} ref={searchContainerRef}>
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 z-10" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim() && searchResults.length > 0) {
                setShowPreview(true);
              }
            }}
            className={cn(
              "pl-8 h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
              className
            )}
          />
        </div>
      </form>

      {/* Search Preview Dropdown */}
      {showPreview && searchQuery.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {isSearchLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-900 dark:border-t-gray-100 rounded-full animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-1">
              {searchResults.map((userProfile) => {
                const displayName = userProfile.full_name || "Unknown User";
                const initials = displayName
                  .split(" ")
                  .map(n => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={userProfile.id}
                    onClick={() => handleUserClick(userProfile.id)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                      <AvatarImage src={userProfile.avatar_url || undefined} />
                      <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs font-semibold text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {displayName}
                      </div>
                      {userProfile.roles && userProfile.roles.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {userProfile.roles[0]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {searchQuery.trim() && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/users?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery("");
                    setShowPreview(false);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-t border-gray-200 dark:border-gray-800"
                >
                  View all results for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
});
