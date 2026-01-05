"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/hooks/use-user";
import { ArrowLeft } from "@untitledui/icons";

interface UserProfile {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    roles: string[] | null;
    created_at?: string;
}

export default function UserProfilePage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;
    const { user: currentUser } = useUser();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [postsCount, setPostsCount] = useState(0);

    useEffect(() => {
        if (userId) {
            loadProfile();
            loadPostsCount();
        }
    }, [userId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, full_name, avatar_url, website, roles")
                .eq("id", userId)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error("Error loading profile:", error);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    const loadPostsCount = async () => {
        try {
            const { count, error } = await supabase
                .from("posts")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);

            if (error) throw error;
            setPostsCount(count || 0);
        } catch (error) {
            console.error("Error loading posts count:", error);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-tertiary">Loading...</div>
                </div>
            </MainLayout>
        );
    }

    if (!profile) {
        return (
            <MainLayout>
                <div className="max-w-2xl">
                    <Button
                        color="secondary"
                        size="sm"
                        onClick={() => router.back()}
                        className="mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div className="text-center py-12">
                        <h2 className="text-xl font-semibold text-primary mb-2">User not found</h2>
                        <p className="text-tertiary">The user profile you're looking for doesn't exist.</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const displayName = profile.full_name || profile.username || "Unknown User";
    const initials = displayName
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    const isOwnProfile = currentUser?.id === profile.id;

    return (
        <MainLayout>
            <div className="max-w-2xl">
                <Button
                    color="secondary"
                    size="sm"
                    onClick={() => router.back()}
                    className="mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>

                <div className="bg-primary border border-secondary rounded-2xl p-8">
                    <div className="flex flex-col items-center text-center mb-8">
                        <Avatar
                            size="2xl"
                            src={profile.avatar_url || undefined}
                            initials={initials}
                            className="mb-4"
                        />
                        <h1 className="text-display-sm font-semibold text-primary mb-2">
                            {displayName}
                        </h1>
                        {profile.username && (
                            <p className="text-lg text-tertiary mb-4">@{profile.username}</p>
                        )}
                        {profile.roles && profile.roles.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                                {profile.roles.map((role) => (
                                    <span
                                        key={role}
                                        className="text-sm font-medium text-brand-solid bg-brand-primary/10 px-3 py-1 rounded-lg"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        )}
                        {profile.website && (
                            <a
                                href={profile.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-brand-solid hover:underline"
                            >
                                {profile.website}
                            </a>
                        )}
                    </div>

                    <div className="border-t border-secondary pt-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex justify-between items-center p-4 bg-secondary/5 rounded-xl">
                                <span className="text-secondary">Posts</span>
                                <span className="text-lg font-semibold text-primary">{postsCount}</span>
                            </div>
                        </div>
                    </div>

                    {isOwnProfile && (
                        <div className="mt-6 pt-6 border-t border-secondary">
                            <Button
                                onClick={() => router.push("/profile")}
                                color="secondary"
                                className="w-full"
                            >
                                Edit Profile
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}

