"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/hooks/use-user";
import { ArrowLeft, Heart, MessageCircle, ArrowUpRight, File, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { generateAuroraGradient } from "@/app/(app)/network/utils";

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
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">User not found</div>
                    <button
                        onClick={() => router.back()}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Back
                    </button>
                </div>
            </div>
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
        <div className="flex h-screen bg-white dark:bg-gray-900">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => router.back()}
                        className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Header */}
                <div className="px-4 py-6 md:px-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 md:h-20 md:w-20">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback
                                    className="text-white text-2xl font-medium"
                                    style={{ background: generateAuroraGradient(displayName) }}
                                >
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{displayName}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    {profile.roles && profile.roles.length > 0 && (
                                        <>
                                            {profile.roles.map((role) => (
                                                <span
                                                    key={role}
                                                    className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                        </>
                                    )}
                                </div>
                                {profile.website && (
                                    <a
                                        href={profile.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mt-2"
                                    >
                                        <ArrowUpRight className="w-4 h-4" />
                                        {profile.website.replace(/^https?:\/\//, '')}
                                    </a>
                                )}
                            </div>
                        </div>
                        {isOwnProfile ? (
                            <Button
                                onClick={() => router.push("/profile")}
                                variant="ghost"
                                size="sm"
                                className="text-gray-700 dark:text-gray-300"
                            >
                                Edit Profile
                            </Button>
                        ) : (
                            <Button
                                onClick={() => router.push(`/messages?user_id=${profile.id}`)}
                                variant="ghost"
                                size="sm"
                                className="text-gray-700 dark:text-gray-300"
                            >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Message
                            </Button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 md:px-6 py-4">
                        {/* Stats */}
                        <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-8">
                                <div>
                                    <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{postsCount}</div>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Posts</div>
                                </div>
                            </div>
                        </div>

                        {/* Activity Section */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Activity</h2>

                            {loadingPosts ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                                    <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                    <div className="text-sm">Loading activity...</div>
                                </div>
                            ) : posts.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">No activity to show yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {posts.map((post) => {
                                        const isLink = post.type === "link";
                                        return (
                                            <div
                                                key={post.id}
                                                className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                                    </span>
                                                    <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <Heart className="w-3.5 h-3.5" />
                                                            <span>{post.likes_count || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                            <span>{post.comments_count || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {!isLink && (
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3 whitespace-pre-wrap">
                                                        {post.content}
                                                    </p>
                                                )}

                                                {isLink && post.content && (
                                                    <a
                                                        href={post.content}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group mb-3"
                                                    >
                                                        <div className="flex items-center gap-3 text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                            <div className="p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                                                <ArrowUpRight className="w-4 h-4" />
                                                            </div>
                                                            <span className="truncate text-sm">{post.content}</span>
                                                        </div>
                                                    </a>
                                                )}

                                                {post.file_url && (
                                                    <div className="mt-3">
                                                        {post.file_url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                                            <img
                                                                src={post.file_url}
                                                                alt="Post attachment"
                                                                className="w-full rounded-lg border border-gray-200 dark:border-gray-800"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                                <div className="size-10 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400">
                                                                    <File className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                                        {decodeURIComponent(post.file_url.split('/').pop()?.split('-').slice(1).join('-') || "Attachment")}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
                </div>
            </div>
        </div>
    );
}
