"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/hooks/use-user";
import { ArrowLeft, Heart, MessageCircle01, ArrowUpRight, File02, MessageChatSquare } from "@untitledui/icons";
import { formatDistanceToNow } from "date-fns";

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    roles: string[] | null;
    created_at?: string;
}

interface UserPost {
    id: string;
    type: "post" | "article" | "link";
    content: string;
    file_url?: string | null;
    created_at: string;
    likes_count?: number;
    comments_count?: number;
}

export default function UserProfilePage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;
    const { user: currentUser } = useUser();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [postsCount, setPostsCount] = useState(0);
    const [posts, setPosts] = useState<UserPost[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);

    useEffect(() => {
        if (userId) {
            loadProfile();
            loadPostsCount();
            loadUserPosts();
        }
    }, [userId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, website, roles")
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

    const loadUserPosts = async () => {
        setLoadingPosts(true);
        try {
            const { data: postsData, error } = await supabase
                .from("posts")
                .select("id, type, content, file_url, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) throw error;

            if (postsData) {
                const postIds = postsData.map(p => p.id);

                // Get likes count
                const { data: likesData } = await supabase
                    .from("likes")
                    .select("post_id")
                    .in("post_id", postIds);

                // Get comments count
                const { data: commentsData } = await supabase
                    .from("comments")
                    .select("post_id")
                    .in("post_id", postIds);

                const likesCountMap = new Map<string, number>();
                const commentsCountMap = new Map<string, number>();

                likesData?.forEach(like => {
                    likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
                });

                commentsData?.forEach(comment => {
                    commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
                });

                const postsWithCounts = postsData.map(post => ({
                    ...post,
                    likes_count: likesCountMap.get(post.id) || 0,
                    comments_count: commentsCountMap.get(post.id) || 0,
                }));

                setPosts(postsWithCounts);
            }
        } catch (error) {
            console.error("Error loading user posts:", error);
            setPosts([]);
        } finally {
            setLoadingPosts(false);
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
                    <ButtonUtility
                        icon={ArrowLeft}
                        onClick={() => router.back()}
                        tooltip="Back"
                        className="mb-6"
                    />
                    <div className="text-center py-12">
                        <h2 className="text-xl font-semibold text-primary mb-2">User not found</h2>
                        <p className="text-tertiary">The user profile you're looking for doesn't exist.</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const displayName = profile.full_name || "Unknown User";
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
                <ButtonUtility
                    icon={ArrowLeft}
                    onClick={() => router.back()}
                    tooltip="Back"
                    className="mb-6"
                />

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

                    <div className="mt-6 pt-6 border-t border-secondary">
                        {isOwnProfile ? (
                            <Button
                                onClick={() => router.push("/profile")}
                                color="secondary"
                                className="w-full"
                            >
                                Edit Profile
                            </Button>
                        ) : (
                            <Button
                                onClick={() => router.push(`/messages?user_id=${profile.id}`)}
                                className="w-full"
                                iconLeading={MessageChatSquare}
                            >
                                Message
                            </Button>
                        )}
                    </div>
                </div>

                {/* User Activity Section */}
                <div className="mt-8">
                    <h2 className="text-lg font-semibold text-primary mb-6">Activity</h2>
                    
                    {loadingPosts ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-tertiary">Loading posts...</div>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-12 bg-primary border border-secondary rounded-2xl">
                            <p className="text-tertiary">No posts yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {posts.map((post) => {
                                const isLink = post.type === "link";
                                return (
                                    <div
                                        key={post.id}
                                        className="bg-primary border border-secondary rounded-xl p-6 hover:border-tertiary transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-tertiary">
                                                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                            </span>
                                            <div className="flex items-center gap-4 text-sm text-tertiary">
                                                <div className="flex items-center gap-1">
                                                    <Heart className="w-4 h-4" />
                                                    <span>{post.likes_count || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MessageCircle01 className="w-4 h-4" />
                                                    <span>{post.comments_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {!isLink && (
                                            <p className="text-secondary text-base leading-relaxed mb-4">
                                                {post.content}
                                            </p>
                                        )}
                                        
                                        {isLink && post.content && (
                                            <a
                                                href={post.content}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block border border-secondary rounded-xl p-4 hover:border-tertiary transition-colors group"
                                            >
                                                <div className="flex items-center gap-2 text-primary group-hover:text-brand-solid transition-colors">
                                                    <ArrowUpRight className="w-4 h-4" />
                                                    <span className="truncate">{post.content}</span>
                                                </div>
                                            </a>
                                        )}
                                        
                                        {post.file_url && (
                                            <div className="mt-4">
                                                {post.file_url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                                    <img
                                                        src={post.file_url}
                                                        alt="Post attachment"
                                                        className="w-full rounded-xl border border-secondary"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-3 p-4 border border-secondary rounded-xl bg-secondary/5">
                                                        <div className="size-10 rounded-lg bg-primary border border-secondary flex items-center justify-center text-tertiary">
                                                            <File02 className="size-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-primary truncate">
                                                                {decodeURIComponent(post.file_url.split('/').pop()?.split('-').slice(1).join('-') || "Attachment")}
                                                            </p>
                                                            <p className="text-xs text-tertiary uppercase tracking-wider">
                                                                {post.file_url.split('.').pop()?.toUpperCase()} File
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}

