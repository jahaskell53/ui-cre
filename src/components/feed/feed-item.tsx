"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getFeedInitials } from "@/lib/feed/create-post";
import { CommentSection } from "./comment-section";
import { FileAttachment } from "./file-attachment";
import { LinkPreview, LinkPreviewCard } from "./link-preview";

export interface Post {
    id: string;
    type: "post" | "article" | "link";
    content: string;
    file_url?: string | null;
    created_at: string;
    user_id: string;
    profile?: {
        full_name: string | null;
        avatar_url: string | null;
    };
    likes_count?: number;
    comments_count?: number;
    is_liked?: boolean;
}

const HeartIcon = ({ isLiked, className }: { isLiked: boolean; className?: string }) => {
    return <Heart className={className} fill={isLiked ? "currentColor" : "none"} />;
};

interface FeedItemProps {
    post: Post;
    currentUserId: string | undefined;
    currentUserProfile: { full_name: string | null; avatar_url: string | null } | null;
    onLike: (postId: string) => void;
    onComment: (postId: string, content: string) => void;
    onDeletePost: (postId: string) => void;
    onDeleteComment: (commentId: string, postId: string) => void;
}

export const FeedItem = ({ post, currentUserId, currentUserProfile, onLike, onComment, onDeletePost, onDeleteComment }: FeedItemProps) => {
    const router = useRouter();
    const [showComments, setShowComments] = useState(false);
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const isLink = post.type === "link";
    const authorName = post.profile?.full_name || "Anonymous User";
    const initials = authorName === "Anonymous User" ? "AU" : getFeedInitials(authorName);

    useEffect(() => {
        if (isLink && post.content) {
            loadLinkPreview(post.content);
        }
    }, [isLink, post.content]);

    const loadLinkPreview = async (url: string) => {
        if (!url) return;
        setIsLoadingPreview(true);
        try {
            const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const data = await response.json();
                setLinkPreview(data);
            }
        } catch (error) {
            console.error("Error loading link preview:", error);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleCommentCreated = () => {
        onComment(post.id, "");
    };

    const handleCommentDeleted = (commentId: string) => {
        onDeleteComment(commentId, post.id);
    };

    return (
        <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col">
                <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                </span>
                            </div>
                            {currentUserId === post.user_id && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                                            <MoreVertical className="size-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                if (confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
                                                    onDeletePost(post.id);
                                                }
                                            }}
                                            className="text-red-600"
                                        >
                                            <Trash2 className="mr-2 size-4" />
                                            Delete post
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        {!isLink && <p className="mb-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">{post.content}</p>}
                        {post.file_url && (
                            <div className="mb-4">
                                <FileAttachment fileUrl={post.file_url} />
                            </div>
                        )}
                        {isLink && (
                            <div className="mb-4">
                                <LinkPreviewCard preview={linkPreview} isLoading={isLoadingPreview} fallbackUrl={post.content} />
                            </div>
                        )}
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                        <div
                            className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
                            onClick={() => router.push(`/users/${post.user_id}`)}
                        >
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={post.profile?.avatar_url || undefined} />
                                <AvatarFallback style={{ background: generateAuroraGradient(authorName) }} className="text-xs font-medium text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm leading-tight font-medium text-gray-900 dark:text-gray-100">{authorName}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onLike(post.id)}
                                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                                    post.is_liked
                                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                }`}
                            >
                                <HeartIcon isLiked={post.is_liked || false} className="size-4" />
                            </button>
                            <button
                                onClick={() => setShowComments(!showComments)}
                                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                                    showComments
                                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                }`}
                            >
                                <MessageCircle className="size-4" />
                                {post.comments_count || 0}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showComments && (
                <CommentSection
                    postId={post.id}
                    currentUserId={currentUserId}
                    currentUserProfile={currentUserProfile}
                    onCommentCreated={handleCommentCreated}
                    onCommentDeleted={handleCommentDeleted}
                />
            )}
        </article>
    );
};
