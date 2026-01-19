"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Heart, MessageSquare } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { FeedItem, Post } from "@/components/feed/feed-item";
import { CreatePostModal } from "@/components/feed/create-post-modal";

const HeartIcon = ({ isLiked, className }: { isLiked: boolean; className?: string }) => {
    return (
        <Heart
            className={className}
            fill={isLiked ? "currentColor" : "none"}
        />
    );
};

export default function FeedPage() {
    const router = useRouter();
    const { user, profile, loading: userLoading } = useUser();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPostModal, setShowPostModal] = useState(false);
    const [showingLiked, setShowingLiked] = useState(false);

    useEffect(() => {
        if (!userLoading) {
            loadPosts();
        }
    }, [userLoading]);

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
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-tertiary">Loading...</div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="flex flex-col gap-10">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Feed</h1>
                        <p className="text-lg text-tertiary">Industry Intelligence and community insights.</p>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button
                            variant={showingLiked ? "default" : "outline"}
                            className="flex-1 lg:flex-none"
                            onClick={() => setShowingLiked(!showingLiked)}
                        >
                            <HeartIcon isLiked={showingLiked} className="size-4" />
                            Liked
                        </Button>
                        <Button
                            className="flex-1 lg:flex-none"
                            onClick={() => setShowPostModal(true)}
                        >
                            <MessageSquare className="size-4" />
                            New Post
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-10">
                    <div className="flex flex-col gap-8">
                        <section className="flex flex-col gap-6">
                            <div className="flex justify-between items-center border-b border-secondary pb-4">
                                <h2 className="text-xl font-semibold text-primary">
                                    {showingLiked ? "Liked Posts" : "Posts"}
                                </h2>
                            </div>

                            <div className="grid gap-8">
                                {posts.filter(p => !showingLiked || p.is_liked).length === 0 ? (
                                    <div className="text-center py-12 text-tertiary">
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
                        </section>
                    </div>
                </div>
            </div>

            {user && (
                <CreatePostModal
                    isOpen={showPostModal}
                    onClose={() => setShowPostModal(false)}
                    onSuccess={handlePostCreated}
                    userId={user.id}
                    isAdmin={profile?.is_admin || false}
                />
            )}
        </MainLayout>
    );
}
