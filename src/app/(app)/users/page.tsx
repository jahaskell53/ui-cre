"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/utils/supabase";
import { Search } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { generateAuroraGradient } from "@/app/(app)/network/utils";

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
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6 overflow-auto h-full">
                <div className="max-w-5xl mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Search Users</h1>
                    </div>

                    <div className="mb-8 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-gray-500" />
                        <Input
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-900/5 dark:focus:ring-gray-100/5"
                            autoFocus
                        />
                    </div>

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400 gap-3">
                            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-900 dark:border-t-gray-100 rounded-full animate-spin" />
                            <div className="text-sm font-medium">Searching...</div>
                        </div>
                    )}

                    {!loading && searchQuery.trim() && users.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                            <Search className="size-8 mb-3 opacity-20" />
                            <div className="text-sm font-medium">No users found for &quot;{searchQuery}&quot;</div>
                        </div>
                    )}

                    {!loading && users.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {users.map((userProfile) => {
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
                                        className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer group shadow-sm hover:shadow-md"
                                    >
                                        <Avatar className="h-12 w-12 border-2 border-white dark:border-gray-800 shadow-sm">
                                            <AvatarImage src={userProfile.avatar_url || undefined} />
                                            <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-sm font-semibold text-white">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                                                {displayName}
                                            </div>
                                            {userProfile.roles && userProfile.roles.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {userProfile.roles.map((role) => (
                                                        <span
                                                            key={role}
                                                            className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700"
                                                        >
                                                            {role}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-gray-300 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-600 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-800">
                                <Search className="size-6" />
                            </div>
                            <h3 className="text-gray-900 dark:text-gray-100 font-medium mb-1">Search Directory</h3>
                            <p className="text-sm max-w-xs text-center">Enter a name to find people in your network and view their professional profiles.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-900 dark:border-t-gray-100 rounded-full animate-spin" />
            </div>
        }>
            <UsersPageContent />
        </Suspense>
    );
}
