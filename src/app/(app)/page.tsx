"use client";

import { useState, useEffect } from "react";
import { usePageTour } from "@/hooks/use-page-tour";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { FeedItem, Post } from "@/components/feed/feed-item";
import { CreatePostInline } from "@/components/feed/create-post-inline";
import { NotificationCard } from "@/components/notifications/notification-card";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";

const HeartIcon = ({ isLiked, className }: { isLiked: boolean; className?: string }) => {
    return (
        <Heart
            className={className}
            fill={isLiked ? "currentColor" : "none"}
        />
    );
};

interface Notification {
    id: string;
    type: "message" | "system" | "mention" | "like" | "comment";
    title: string | null;
    content: string;
    created_at: string;
    read_at: string | null;
    sender: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
}

export default function FeedPage() {
    const router = useRouter();
    const { user, profile, loading: userLoading } = useUser();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showingLiked, setShowingLiked] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notificationsLoading, setNotificationsLoading] = useState(true);
    const [isTourOpen, setIsTourOpen] = useState(false);

    // Listen for tour trigger from sidebar
    usePageTour(() => setIsTourOpen(true));

    useEffect(() => {
        if (!userLoading) {
            loadPosts();
            loadNotifications();
        }
    }, [userLoading]);

    const loadNotifications = async () => {
        if (!user) return;

        try {
            const response = await fetch("/api/notifications", {
                credentials: "include",
            });
            if (!response.ok) {
                if (response.status === 401) {
                    return;
                }
                throw new Error("Failed to load notifications");
            }
            const data = await response.json();
            setNotifications(data.slice(0, 3));
        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setNotificationsLoading(false);
        }
    };

    const loadPosts = async () => {
        setLoading(true);
        const { data: postsData, error } = await supabase
            .from("posts")
            .select(`
                *,
                profile:profiles(full_name, avatar_url)
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error loading posts:", error.message, error.details, error.hint);
            setLoading(false);
            return;
        }

        if (postsData) {
            const postIds = postsData.map(p => p.id);

            // Get likes count and check if current user liked
            const { data: likesData } = await supabase
                .from("likes")
                .select("post_id, user_id")
                .in("post_id", postIds);

            // Get comments count
            const { data: commentsData } = await supabase
                .from("comments")
                .select("post_id")
                .in("post_id", postIds);

            const likesCountMap = new Map<string, number>();
            const userLikedMap = new Map<string, boolean>();
            const commentsCountMap = new Map<string, number>();

            likesData?.forEach(like => {
                likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
                if (like.user_id === user?.id) {
                    userLikedMap.set(like.post_id, true);
                }
            });

            commentsData?.forEach(comment => {
                commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
            });

            const postsWithCounts = postsData.map(post => ({
                ...post,
                profile: (post as any).profile,
                likes_count: likesCountMap.get(post.id) || 0,
                is_liked: userLikedMap.get(post.id) || false,
                comments_count: commentsCountMap.get(post.id) || 0,
            }));

            setPosts(postsWithCounts);
        }
        setLoading(false);
    };

    const handleLike = async (postId: string) => {
        if (!user) {
            router.push("/login");
            return;
        }

        const post = posts.find(p => p.id === postId);
        if (!post) return;

        if (post.is_liked) {
            // Unlike
            const { error } = await supabase
                .from("likes")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", user.id);

            if (!error) {
                setPosts(posts.map(p =>
                    p.id === postId
                        ? { ...p, is_liked: false, likes_count: (p.likes_count || 0) - 1 }
                        : p
                ));
            }
        } else {
            // Like
            const { error } = await supabase
                .from("likes")
                .insert({
                    post_id: postId,
                    user_id: user.id
                });

            if (!error) {
                setPosts(posts.map(p =>
                    p.id === postId
                        ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 }
                        : p
                ));
            }
        }
    };

    const handleComment = async (postId: string, content: string) => {
        setPosts(posts.map(p =>
            p.id === postId
                ? { ...p, comments_count: (p.comments_count || 0) + 1 }
                : p
        ));
    };

    const handleDeletePost = async (postId: string) => {
        const { error } = await supabase
            .from("posts")
            .delete()
            .eq("id", postId)
            .eq("user_id", user?.id);

        if (!error) {
            setPosts(posts.filter(p => p.id !== postId));
        } else {
            console.error("Error deleting post:", error.message);
            alert("Failed to delete post. Please try again.");
        }
    };

    const handleDeleteComment = async (commentId: string, postId: string) => {
        const { error } = await supabase
            .from("comments")
            .delete()
            .eq("id", commentId)
            .eq("user_id", user?.id);

        if (!error) {
            setPosts(posts.map(p =>
                p.id === postId
                    ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) }
                    : p
            ));
        } else {
            console.error("Error deleting comment:", error.message);
            alert("Failed to delete comment. Please try again.");
        }
    };

    const handlePostCreated = () => {
        loadPosts();
    };

    if (userLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    const tourSteps: TourStep[] = [
        {
            id: "create-post",
            target: '[data-tour="create-post"]',
            title: "Create Posts",
            content: "Share updates, announcements, or insights with your network. Click here to create a new post.",
            position: "bottom",
        },
        {
            id: "posts-feed",
            target: '[data-tour="posts-feed"]',
            title: "View Posts",
            content: "See all posts from your network. Like and comment to engage with your community.",
            position: "top",
        },
        {
            id: "liked-filter",
            target: '[data-tour="liked-filter"]',
            title: "Filter Liked Posts",
            content: "Click here to view only posts you've liked. Great for finding content you want to revisit.",
            position: "bottom",
        },
        {
            id: "notifications",
            target: '[data-tour="notifications"]',
            title: "Recent Notifications",
            content: "Stay updated with recent notifications. Click 'View all' to see your complete notification history.",
            position: "left",
        },
    ];

    return (
        <div className="relative flex flex-col gap-8 p-6 overflow-auto h-full">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="flex justify-between items-baseline border-b border-gray-200 dark:border-gray-800 pb-4">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-none">
                            {showingLiked ? "Liked Posts" : "Posts"}
                        </h2>
                        <button
                            data-tour="liked-filter"
                            onClick={() => setShowingLiked(!showingLiked)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                showingLiked
                                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
                            }`}
                        >
                            <HeartIcon isLiked={showingLiked} className="size-4" />
                            Liked
                        </button>
                    </div>

                    {user && (
                        <div data-tour="create-post">
                            <CreatePostInline
                                onSuccess={handlePostCreated}
                                userId={user.id}
                                isAdmin={profile?.is_admin || false}
                                userAvatarUrl={profile?.avatar_url || null}
                                userFullName={profile?.full_name || null}
                            />
                        </div>
                    )}

                    <div data-tour="posts-feed" className="grid gap-6">
                        {posts.filter(p => !showingLiked || p.is_liked).length === 0 ? (
                            <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                                {showingLiked ? "You haven't liked any posts yet." : "No posts yet. Be the first to share something!"}
                            </div>
                        ) : (
                            posts
                                .filter(p => !showingLiked || p.is_liked)
                                .map((post) => (
                                    <FeedItem
                                        key={post.id}
                                        post={post}
                                        currentUserId={user?.id}
                                        currentUserProfile={profile}
                                        onLike={handleLike}
                                        onComment={handleComment}
                                        onDeletePost={handleDeletePost}
                                        onDeleteComment={handleDeleteComment}
                                    />
                                ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div data-tour="notifications" className="flex flex-col gap-4">
                        <div className="flex justify-between items-baseline border-b border-gray-200 dark:border-gray-800 pb-4">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-none">Notifications</h2>
                            <Link
                                href="/notifications"
                                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            >
                                View all
                            </Link>
                        </div>
                        {notifications.length > 0 ? (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                                {notifications.map((notification) => (
                                    <NotificationCard
                                        key={notification.id}
                                        notification={notification}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No new notifications</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Guided Tour */}
            <GuidedTour
                steps={tourSteps}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                onComplete={() => {
                    console.log("Home tour completed!");
                }}
            />
        </div>
    );
}
