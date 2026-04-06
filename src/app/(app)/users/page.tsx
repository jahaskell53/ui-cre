"use client";

import { Suspense, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    roles: string[] | null;
}

function UsersPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    // Initialize search query from URL params
    useEffect(() => {
        const q = searchParams.get("q");
        if (q) {
            setSearchQuery(q);
        }
    }, [searchParams]);

    useEffect(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        if (searchQuery.trim().length === 0) {
            setUsers([]);
            return;
        }

        const timer = setTimeout(() => {
            searchUsers(searchQuery);
        }, 300);

        setDebounceTimer(timer);

        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [searchQuery]);

    const searchUsers = async (query: string) => {
        if (!query.trim()) {
            setUsers([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, website, roles")
                .ilike("full_name", `%${query}%`)
                .limit(20);

            if (error) throw error;

            setUsers(data || []);
        } catch (error) {
            console.error("Error searching users:", error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleUserClick = (userId: string) => {
        router.push(`/users/${userId}`);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex h-full flex-col overflow-auto">
                {/* Header */}
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Search Users</h1>
                </div>

                {/* Search Input */}
                <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
                    <div className="relative">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <Input
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 border-gray-200 bg-white pl-10 text-gray-900 placeholder:text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-4">
                        {loading && (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900 dark:border-t-gray-100" />
                                <div className="text-sm">Searching...</div>
                            </div>
                        )}

                        {!loading && searchQuery.trim() && users.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                                <Search className="mb-3 size-8 opacity-20" />
                                <div className="text-sm">No users found for &quot;{searchQuery}&quot;</div>
                            </div>
                        )}

                        {!loading && users.length > 0 && (
                            <div className="space-y-1">
                                {users.map((userProfile) => {
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
                                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
                                        >
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={userProfile.avatar_url || undefined} />
                                                <AvatarFallback
                                                    style={{ background: generateAuroraGradient(displayName) }}
                                                    className="text-sm font-medium text-white"
                                                >
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                                                {userProfile.roles && userProfile.roles.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {userProfile.roles.map((role) => (
                                                            <span
                                                                key={role}
                                                                className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                            >
                                                                {role}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-gray-400 dark:text-gray-600">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!searchQuery.trim() && (
                            <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800">
                                    <Search className="size-5" />
                                </div>
                                <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">Search Directory</h3>
                                <p className="max-w-xs text-center text-xs">Enter a name to find people in your network</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function UsersPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                </div>
            }
        >
            <UsersPageContent />
        </Suspense>
    );
}
