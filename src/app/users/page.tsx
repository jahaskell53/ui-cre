"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Input } from "@/components/base/input/input";
import { Avatar } from "@/components/base/avatar/avatar";
import { supabase } from "@/utils/supabase";
import { SearchLg } from "@untitledui/icons";
import { useUser } from "@/hooks/use-user";

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    roles: string[] | null;
}

export default function UsersPage() {
    const router = useRouter();
    const { user } = useUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

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
        <MainLayout>
            <div className="max-w-4xl">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Search Users</h1>
                <p className="text-lg text-tertiary mb-8">Find and view user profiles.</p>

                <div className="mb-6">
                    <Input
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={setSearchQuery}
                        icon={SearchLg}
                        autoFocus
                    />
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-tertiary">Searching...</div>
                    </div>
                )}

                {!loading && searchQuery.trim() && users.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-tertiary">No users found</div>
                    </div>
                )}

                {!loading && users.length > 0 && (
                    <div className="space-y-2">
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
                                    className="flex items-center gap-4 p-4 border border-secondary rounded-xl hover:border-tertiary hover:bg-secondary/5 transition-colors cursor-pointer"
                                >
                                    <Avatar
                                        size="lg"
                                        src={userProfile.avatar_url || undefined}
                                        initials={initials}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-primary">
                                            {displayName}
                                        </div>
                                        {userProfile.roles && userProfile.roles.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {userProfile.roles.map((role) => (
                                                    <span
                                                        key={role}
                                                        className="text-xs font-medium text-brand-solid bg-brand-primary/10 px-2 py-1 rounded"
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!searchQuery.trim() && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-tertiary text-center">
                            <p className="mb-2">Start typing to search for users</p>
                            <p className="text-sm">Search by full name</p>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

