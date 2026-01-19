"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/hooks/use-user";
import { ArrowLeft, Heart, MessageCircle, ArrowUpRight, File, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { generateAuroraGradient } from "@/app/people/utils";

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
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="mb-6"
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
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
            <div className="bg-white dark:bg-gray-900 -mx-4 -my-8 px-4 py-8 sm:-mx-6 lg:-mx-8 sm:px-6 lg:px-8 min-h-[calc(100vh-4rem)]">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-8 group"
                    >
                        <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Directory
                    </button>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
                        <div className="flex flex-col items-center text-center">
                            <Avatar className="h-24 w-24 mb-6 ring-4 ring-gray-50 dark:ring-gray-800">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-2xl font-bold text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                {displayName}
                            </h1>
                            {profile.roles && profile.roles.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center mb-6">
                                    {profile.roles.map((role) => (
                                        <span
                                            key={role}
                                            className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700"
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
                                    className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                    <ArrowUpRight className="size-4" />
                                    {profile.website.replace(/^https?:\/\//, '')}
                                </a>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-center gap-8 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{postsCount}</div>
                                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-1">Posts</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                            {isOwnProfile ? (
                                <Button
                                    onClick={() => router.push("/profile")}
                                    variant="outline"
                                    className="w-full h-11 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-semibold"
                                >
                                    Edit Profile
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => router.push(`/messages?user_id=${profile.id}`)}
                                    className="w-full h-11 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 font-semibold gap-2"
                                >
                                    <MessageSquare className="size-4" />
                                    Send Message
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* User Activity Section */}
                    <div className="mt-12">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Activity</h2>
                            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800 ml-6" />
                        </div>

                        {loadingPosts ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                <div className="text-sm">Loading activity...</div>
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl">
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No activity to show yet</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {posts.map((post) => {
                                    const isLink = post.type === "link";
                                    return (
                                        <div
                                            key={post.id}
                                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                                </span>
                                                <div className="flex items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-md">
                                                        <Heart className="w-3.5 h-3.5" />
                                                        <span>{post.likes_count || 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-md">
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                        <span>{post.comments_count || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {!isLink && (
                                                <p className="text-gray-700 dark:text-gray-300 text-[15px] leading-relaxed mb-4">
                                                    {post.content}
                                                </p>
                                            )}

                                            {isLink && post.content && (
                                                <a
                                                    href={post.content}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group mb-4"
                                                >
                                                    <div className="flex items-center gap-3 text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        </div>
                                                        <span className="truncate font-medium text-sm">{post.content}</span>
                                                    </div>
                                                </a>
                                            )}

                                            {post.file_url && (
                                                <div className="mt-4">
                                                    {post.file_url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                                        <img
                                                            src={post.file_url}
                                                            alt="Post attachment"
                                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm"
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                                            <div className="size-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400">
                                                                <File className="size-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                                    {decodeURIComponent(post.file_url.split('/').pop()?.split('-').slice(1).join('-') || "Attachment")}
                                                                </p>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">
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
        </MainLayout>
    );
}
