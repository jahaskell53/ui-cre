"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/app/(app)/network/icons";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase";

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

export const UserSearchBar = forwardRef<UserSearchBarRef, UserSearchBarProps>(function UserSearchBar({ className, containerClassName }, ref) {
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
                    <SearchIcon className="absolute top-1/2 left-2.5 z-10 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
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
                            "h-8 border-gray-200 bg-gray-50 pl-8 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500",
                            className,
                        )}
                    />
                </div>
            </form>

            {/* Search Preview Dropdown */}
            {showPreview && searchQuery.trim() && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    {isSearchLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-gray-100" />
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="py-1">
                            {searchResults.map((userProfile) => {
                                const displayName = userProfile.full_name || "Unknown User";
                                const initials = displayName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2);

                                return (
                                    <div
                                        key={userProfile.id}
                                        onClick={() => handleUserClick(userProfile.id)}
                                        className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                                            <AvatarImage src={userProfile.avatar_url || undefined} />
                                            <AvatarFallback
                                                style={{ background: generateAuroraGradient(displayName) }}
                                                className="text-xs font-semibold text-white"
                                            >
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                                            {userProfile.roles && userProfile.roles.length > 0 && (
                                                <div className="truncate text-xs text-gray-500 dark:text-gray-400">{userProfile.roles[0]}</div>
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
                                    className="cursor-pointer border-t border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                                >
                                    View all results for &quot;{searchQuery}&quot;
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No users found</div>
                    )}
                </div>
            )}
        </div>
    );
});
