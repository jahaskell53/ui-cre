"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Heart, MessageCircle01, Bookmark, MessageChatSquare, Send01, X } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { formatDistanceToNow } from "date-fns";

interface Post {
  id: string;
  type: "post" | "article";
  category?: string;
  title?: string;
  content: string;
  summary?: string;
  created_at: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const FeedItem = ({ post, currentUserId, currentUserProfile, onLike, onComment }: { 
  post: Post; 
  currentUserId: string | undefined;
  currentUserProfile: { full_name: string | null; avatar_url: string | null } | null;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
}) => {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const isArticle = post.type !== "post";
    const authorName = post.profile?.full_name || post.profile?.username || "Anonymous User";
    const initials = authorName === "Anonymous User" ? "AU" : authorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

    useEffect(() => {
        if (showComments) {
            loadComments();
        }
    }, [showComments, post.id]);

    const loadComments = async () => {
        const { data, error } = await supabase
            .from("comments")
            .select(`
                *,
                profile:profiles(full_name, username, avatar_url)
            `)
            .eq("post_id", post.id)
            .order("created_at", { ascending: true });

        if (!error && data) {
            setComments(data.map(c => ({
                ...c,
                profile: (c as any).profile
            })));
        } else if (error) {
            console.error("Error loading comments:", error.message);
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || !currentUserId) return;
        
        setIsSubmittingComment(true);
        const { error } = await supabase
            .from("comments")
            .insert({
                post_id: post.id,
                user_id: currentUserId,
                content: commentText.trim()
            });

        if (!error) {
            setCommentText("");
            loadComments();
            onComment(post.id, commentText);
        }
        setIsSubmittingComment(false);
    };

    return (
        <article className="bg-primary border border-secondary rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            <div className={isArticle ? "flex flex-col md:flex-row" : "flex flex-col"}>
                {isArticle && (
                    <div className="w-full md:w-48 h-48 md:h-auto bg-secondary shrink-0 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-quaternary font-medium text-xs">Article Image</div>
                    </div>
                )}
                <div className="p-6 flex flex-col justify-between flex-1">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            {post.category && (
                                <>
                                    <span className="text-xs font-bold text-brand-solid uppercase tracking-widest">{post.category}</span>
                                    <span className="w-1 h-1 rounded-full bg-quaternary" />
                                </>
                            )}
                            <span className="text-sm text-tertiary">
                                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </span>
                        </div>
                        {post.title && <h3 className="text-xl font-bold text-primary mb-3 leading-snug">{post.title}</h3>}
                        <p className="text-secondary text-base mb-6 leading-relaxed">
                            {post.summary || post.content}
                        </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-3">
                            <Avatar 
                                size="sm" 
                                initials={initials}
                                src={post.profile?.avatar_url || undefined}
                            />
                            <div>
                                <p className="text-sm font-semibold text-primary leading-tight">{authorName}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button 
                                color={post.is_liked ? "primary" : "tertiary"} 
                                size="sm" 
                                iconLeading={Heart}
                                onClick={() => onLike(post.id)}
                            >
                                {post.likes_count || 0}
                            </Button>
                            <Button
                                color={showComments ? "secondary" : "tertiary"}
                                size="sm"
                                iconLeading={MessageCircle01}
                                onClick={() => setShowComments(!showComments)}
                            >
                                {post.comments_count || 0}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {showComments && (
                <div className="border-t border-secondary bg-secondary/20 p-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-4">
                            {comments.map((comment) => {
                                const commentAuthorName = comment.profile?.full_name || comment.profile?.username || "Anonymous";
                                const commentInitials = commentAuthorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";
                                return (
                                    <div key={comment.id} className="flex gap-3">
                                        <Avatar 
                                            size="xs" 
                                            initials={commentInitials}
                                            src={comment.profile?.avatar_url || undefined}
                                        />
                                        <div className="flex-1 bg-primary p-3 rounded-xl border border-secondary shadow-xs">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-primary">{commentAuthorName}</span>
                                                <span className="text-[10px] text-tertiary uppercase">
                                                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-secondary">{comment.content}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {currentUserId && currentUserProfile && (
                            <div className="flex gap-3 items-start mt-2">
                                <Avatar 
                                    size="xs" 
                                    initials={currentUserProfile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
                                    src={currentUserProfile.avatar_url || undefined}
                                />
                                <div className="flex-1 flex gap-2">
                                    <Input
                                        placeholder="Write a comment..."
                                        className="flex-1"
                                        size="sm"
                                        value={commentText}
                                        onChange={setCommentText}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleComment();
                                            }
                                        }}
                                    />
                                    <Button 
                                        color="primary" 
                                        size="sm" 
                                        iconLeading={Send01} 
                                        className="shrink-0"
                                        onClick={handleComment}
                                        isLoading={isSubmittingComment}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
};

export default function FeedPage() {
    const router = useRouter();
    const { user, profile, loading: userLoading } = useUser();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPostModal, setShowPostModal] = useState(false);
    const [postType, setPostType] = useState<"post" | "article">("post");
    const [postContent, setPostContent] = useState("");
    const [postTitle, setPostTitle] = useState("");
    const [postCategory, setPostCategory] = useState("");
    const [postSummary, setPostSummary] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                profile:profiles(full_name, username, avatar_url)
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

    const handleCreatePost = async (close?: () => void) => {
        if (!user || !postContent.trim()) return;

        setIsSubmitting(true);
        const { error } = await supabase
            .from("posts")
            .insert({
                user_id: user.id,
                type: postType,
                content: postContent.trim(),
                title: postType === "article" ? postTitle.trim() || null : null,
                category: postType === "article" ? postCategory.trim() || null : null,
                summary: postType === "article" ? postSummary.trim() || null : null,
            });

        if (!error) {
            setShowPostModal(false);
            setPostContent("");
            setPostTitle("");
            setPostCategory("");
            setPostSummary("");
            setPostType("post");
            loadPosts();
            close?.();
        }
        setIsSubmitting(false);
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
                        <h1 className="text-display-sm font-semibold text-primary">Master Feed</h1>
                        <p className="text-lg text-tertiary">Curated multi-family intelligence and community insights.</p>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button color="secondary" iconLeading={Bookmark} className="flex-1 lg:flex-none">Saved</Button>
                        <Button 
                            color="primary" 
                            iconLeading={MessageChatSquare} 
                            className="flex-1 lg:flex-none"
                            onClick={() => setShowPostModal(true)}
                        >
                            New Post
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-10">
                    <div className="flex flex-col gap-8">
                        <section className="flex flex-col gap-6">
                            <div className="flex justify-between items-center border-b border-secondary pb-4">
                                <h2 className="text-xl font-semibold text-primary">Industry Intelligence</h2>
                            </div>

                            <div className="grid gap-8">
                                {posts.length === 0 ? (
                                    <div className="text-center py-12 text-tertiary">
                                        No posts yet. Be the first to share something!
                                    </div>
                                ) : (
                                    posts.map((post) => (
                                        <FeedItem 
                                            key={post.id} 
                                            post={post}
                                            currentUserId={user?.id}
                                            currentUserProfile={profile}
                                            onLike={handleLike}
                                            onComment={handleComment}
                                        />
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {showPostModal && (
                <ModalOverlay isOpen={showPostModal} onOpenChange={setShowPostModal}>
                    <Modal>
                        <Dialog className="w-full max-w-2xl mx-auto bg-primary rounded-xl shadow-lg p-6">
                            {({ close }) => (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-secondary pb-4 -mx-6 px-6 mb-2">
                                        <h2 className="text-lg font-semibold text-primary">Create new post</h2>
                                        <Button
                                            color="tertiary"
                                            size="sm"
                                            iconLeading={X}
                                            onClick={close}
                                            className="p-1!"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-6">
                                        <div className="flex flex-col gap-3">
                                            <span className="text-sm font-medium text-secondary">Select post type</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    color={postType === "post" ? "primary" : "secondary"}
                                                    size="sm"
                                                    onClick={() => setPostType("post")}
                                                    className="flex-1 lg:flex-none"
                                                >
                                                    Post
                                                </Button>
                                                <Button
                                                    color={postType === "article" ? "primary" : "secondary"}
                                                    size="sm"
                                                    onClick={() => setPostType("article")}
                                                    className="flex-1 lg:flex-none"
                                                >
                                                    Article
                                                </Button>
                                            </div>
                                        </div>

                                        {postType === "article" && (
                                            <div className="space-y-4 animate-in fade-in duration-200">
                                                <Input
                                                    label="Title"
                                                    placeholder="Enter article title"
                                                    value={postTitle}
                                                    onChange={setPostTitle}
                                                />
                                                <Input
                                                    label="Category"
                                                    placeholder="e.g., Market Analysis"
                                                    value={postCategory}
                                                    onChange={setPostCategory}
                                                />
                                                <TextArea
                                                    label="Summary"
                                                    placeholder="Brief summary of the article"
                                                    value={postSummary}
                                                    onChange={setPostSummary}
                                                    rows={2}
                                                />
                                            </div>
                                        )}

                                        <TextArea
                                            label={postType === "article" ? "Content" : "What's on your mind?"}
                                            placeholder={postType === "article" ? "Start writing your article..." : "Share your thoughts with the community..."}
                                            value={postContent}
                                            onChange={setPostContent}
                                            rows={postType === "article" ? 8 : 4}
                                        />
                                    </div>

                                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-secondary -mx-6 px-6 mt-2">
                                        <Button
                                            color="secondary"
                                            onClick={() => {
                                                close();
                                                setPostContent("");
                                                setPostTitle("");
                                                setPostCategory("");
                                                setPostSummary("");
                                                setPostType("post");
                                            }}
                                            className="flex-1 sm:flex-none"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => handleCreatePost(close)}
                                            isLoading={isSubmitting}
                                            isDisabled={!postContent.trim()}
                                            className="flex-1 sm:flex-none"
                                        >
                                            {postType === "article" ? "Publish article" : "Post to feed"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            )}
        </MainLayout>
    );
}
