"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ArrowUpRight, File, Heart, MessageCircle, MessageSquare } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";

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
            const response = await fetch(`/api/users?id=${encodeURIComponent(userId)}`);
            if (!response.ok) throw new Error("Profile not found");
            const data = await response.json();
            setProfile(data);
        } catch (error) {
            console.error("Error loading profile:", error);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    const loadPostsCount = async () => {
        // count is derived from loadUserPosts, so this is a no-op
    };

    const loadUserPosts = async () => {
        setLoadingPosts(true);
        try {
            const response = await fetch(`/api/posts?user_id=${encodeURIComponent(userId)}`);
            if (!response.ok) throw new Error("Failed to load posts");
            const postsData = await response.json();

            const postsWithCounts = postsData.map((post: any) => ({
                id: post.id,
                type: post.type,
                content: post.content,
                file_url: post.file_url,
                created_at: post.created_at,
                likes_count: (post.likes ?? []).length,
                comments_count: post.comments_count ?? 0,
            }));

            setPosts(postsWithCounts);
            setPostsCount(postsWithCounts.length);
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
                    <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">User not found</div>
                    <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                        Back
                    </button>
                </div>
            </div>
        );
    }

    const displayName = profile.full_name || "Unknown User";
    const initials = displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    const isOwnProfile = currentUser?.id === profile.id;

    return (
        <div className="flex h-screen bg-white dark:bg-gray-900">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Top Header Bar */}
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                    <button
                        onClick={() => router.back()}
                        className="-ml-1.5 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                </div>

                {/* Profile Header */}
                <div className="px-4 py-6 md:px-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 md:h-20 md:w-20">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback className="text-2xl font-medium text-white" style={{ background: generateAuroraGradient(displayName) }}>
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{displayName}</h1>
                                <div className="mt-1 flex items-center gap-2">
                                    {profile.roles && profile.roles.length > 0 && (
                                        <>
                                            {profile.roles.map((role) => (
                                                <span
                                                    key={role}
                                                    className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
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
                                        className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                    >
                                        <ArrowUpRight className="h-4 w-4" />
                                        {profile.website.replace(/^https?:\/\//, "")}
                                    </a>
                                )}
                            </div>
                        </div>
                        {isOwnProfile ? (
                            <Button onClick={() => router.push("/profile")} variant="ghost" size="sm" className="text-gray-700 dark:text-gray-300">
                                Edit Profile
                            </Button>
                        ) : (
                            <Button
                                onClick={() => router.push(`/messages?user_id=${profile.id}`)}
                                variant="ghost"
                                size="sm"
                                className="text-gray-700 dark:text-gray-300"
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Message
                            </Button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-4 md:px-6">
                        {/* Stats */}
                        <div className="mb-8 border-b border-gray-200 pb-6 dark:border-gray-800">
                            <div className="flex items-center gap-8">
                                <div>
                                    <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{postsCount}</div>
                                    <div className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Posts</div>
                                </div>
                            </div>
                        </div>

                        {/* Activity Section */}
                        <div>
                            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Activity</h2>

                            {loadingPosts ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                                    <div className="text-sm">Loading activity...</div>
                                </div>
                            ) : posts.length === 0 ? (
                                <div className="py-16 text-center">
                                    <p className="font-medium text-gray-500 dark:text-gray-400">No activity to show yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {posts.map((post) => {
                                        const isLink = post.type === "link";
                                        return (
                                            <div
                                                key={post.id}
                                                className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                                    </span>
                                                    <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <Heart className="h-3.5 w-3.5" />
                                                            <span>{post.likes_count || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <MessageCircle className="h-3.5 w-3.5" />
                                                            <span>{post.comments_count || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {!isLink && (
                                                    <p className="mb-3 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                                        {post.content}
                                                    </p>
                                                )}

                                                {isLink && post.content && (
                                                    <a
                                                        href={post.content}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group mb-3 block rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800"
                                                    >
                                                        <div className="flex items-center gap-3 text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                                            <div className="rounded border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-700">
                                                                <ArrowUpRight className="h-4 w-4" />
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
                                                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                                                                <div className="flex size-10 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-700">
                                                                    <File className="h-4 w-4" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                        {decodeURIComponent(
                                                                            post.file_url.split("/").pop()?.split("-").slice(1).join("-") || "Attachment",
                                                                        )}
                                                                    </p>
                                                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                                        {post.file_url.split(".").pop()?.toUpperCase()} File
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
