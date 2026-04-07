"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreatePostInline } from "@/components/feed/create-post-inline";
import { FeedItem, Post } from "@/components/feed/feed-item";
import { NotificationCard } from "@/components/notifications/notification-card";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { usePageTour } from "@/hooks/use-page-tour";
import { useUser } from "@/hooks/use-user";
import { adjustFeedPostComments, enrichFeedPosts, getRecentNotifications, getVisibleFeedPosts, updateFeedPostLike } from "@/lib/feed/feed-page";

const HeartIcon = ({ isLiked, className }: { isLiked: boolean; className?: string }) => {
    return <Heart className={className} fill={isLiked ? "currentColor" : "none"} />;
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
            setNotifications(getRecentNotifications(data, 3));
        } catch (error) {
            console.error("Error loading notifications:", error);
        }
    };

    const loadPosts = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/posts", { credentials: "include" });
            if (!response.ok) {
                console.error("Error loading posts:", response.statusText);
                setLoading(false);
                return;
            }
            const postsData = await response.json();

            const likesData = postsData.flatMap((p: any) => p.likes ?? []);
            const commentsData = postsData.flatMap((p: any) => Array.from({ length: p.comments_count ?? 0 }, () => ({ post_id: p.id })));

            setPosts(enrichFeedPosts(postsData, likesData, commentsData, user?.id));
        } catch (error) {
            console.error("Error loading posts:", error);
        }
        setLoading(false);
    };

    const handleLike = async (postId: string) => {
        if (!user) {
            router.push("/login");
            return;
        }

        const post = posts.find((p) => p.id === postId);
        if (!post) return;

        if (post.is_liked) {
            const response = await fetch(`/api/likes?post_id=${encodeURIComponent(postId)}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (response.ok) {
                setPosts((currentPosts) => updateFeedPostLike(currentPosts, postId, false));
            }
        } else {
            const response = await fetch("/api/likes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ post_id: postId }),
            });
            if (response.ok) {
                setPosts((currentPosts) => updateFeedPostLike(currentPosts, postId, true));
            }
        }
    };

    const handleComment = async (postId: string, content: string) => {
        setPosts((currentPosts) => adjustFeedPostComments(currentPosts, postId, 1));
    };

    const handleDeletePost = async (postId: string) => {
        const response = await fetch(`/api/posts?id=${encodeURIComponent(postId)}`, {
            method: "DELETE",
            credentials: "include",
        });

        if (response.ok) {
            setPosts(posts.filter((p) => p.id !== postId));
        } else {
            const err = await response.json().catch(() => ({}));
            console.error("Error deleting post:", err);
            alert("Failed to delete post. Please try again.");
        }
    };

    const handleDeleteComment = async (commentId: string, postId: string) => {
        const response = await fetch(`/api/comments?id=${encodeURIComponent(commentId)}`, {
            method: "DELETE",
            credentials: "include",
        });

        if (response.ok) {
            setPosts((currentPosts) => adjustFeedPostComments(currentPosts, postId, -1));
        } else {
            const err = await response.json().catch(() => ({}));
            console.error("Error deleting comment:", err);
            alert("Failed to delete comment. Please try again.");
        }
    };

    const handlePostCreated = () => {
        loadPosts();
    };

    if (userLoading || loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
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

    const visiblePosts = getVisibleFeedPosts(posts, showingLiked);

    return (
        <div className="relative flex h-full flex-col gap-8 overflow-auto p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-3">
                    <div className="flex items-baseline justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
                        <h2 className="text-base leading-none font-semibold text-gray-900 dark:text-gray-100">{showingLiked ? "Liked Posts" : "Posts"}</h2>
                        <button
                            data-tour="liked-filter"
                            onClick={() => setShowingLiked(!showingLiked)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                showingLiked
                                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                    : "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
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
                        {visiblePosts.length === 0 ? (
                            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                                {showingLiked ? "You haven't liked any posts yet." : "No posts yet. Be the first to share something!"}
                            </div>
                        ) : (
                            visiblePosts.map((post) => (
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

                <div className="order-1 lg:order-2 lg:col-span-1">
                    <div data-tour="notifications" className="flex flex-col gap-4">
                        <div className="flex items-baseline justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
                            <h2 className="text-base leading-none font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
                            <Link
                                href="/notifications"
                                className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                                View all
                            </Link>
                        </div>
                        {notifications.length > 0 ? (
                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                {notifications.map((notification) => (
                                    <NotificationCard key={notification.id} notification={notification} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
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
