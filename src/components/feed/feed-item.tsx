"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Heart, MessageCircle01, DotsVertical, Trash01 } from "@untitledui/icons";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { formatDistanceToNow } from "date-fns";
import { LinkPreviewCard, LinkPreview } from "./link-preview";
import { FileAttachment } from "./file-attachment";
import { CommentSection } from "./comment-section";

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
    return (
        <Heart
            className={className}
            fill={isLiked ? "currentColor" : "none"}
        />
    );
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

export const FeedItem = ({
    post,
    currentUserId,
    currentUserProfile,
    onLike,
    onComment,
    onDeletePost,
    onDeleteComment,
}: FeedItemProps) => {
    const router = useRouter();
    const [showComments, setShowComments] = useState(false);
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const isArticle = post.type !== "post";
    const isLink = post.type === "link";
    const authorName = post.profile?.full_name || "Anonymous User";
    const initials = authorName === "Anonymous User" ? "AU" : authorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

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
        <article className="bg-primary border border-secondary rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            <div className="flex flex-col">
                <div className="p-6 flex flex-col justify-between flex-1">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-tertiary">
                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                </span>
                            </div>
                            {currentUserId === post.user_id && (
                                <Dropdown.Root>
                                    <ButtonUtility
                                        icon={DotsVertical}
                                        size="sm"
                                        color="tertiary"
                                        tooltip="More options"
                                    />
                                    <Dropdown.Popover>
                                        <Dropdown.Menu>
                                            <Dropdown.Item
                                                icon={Trash01}
                                                onAction={() => {
                                                    if (confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
                                                        onDeletePost(post.id);
                                                    }
                                                }}
                                            >
                                                Delete post
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown.Popover>
                                </Dropdown.Root>
                            )}
                        </div>
                        {!isLink && (
                            <p className="text-secondary text-base mb-6 leading-relaxed">
                                {post.content}
                            </p>
                        )}
                        {post.file_url && (
                            <div className="mb-6">
                                <FileAttachment fileUrl={post.file_url} />
                            </div>
                        )}
                        {isLink && (
                            <div className="mb-6">
                                <LinkPreviewCard
                                    preview={linkPreview}
                                    isLoading={isLoadingPreview}
                                    fallbackUrl={post.content}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                        <div 
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => router.push(`/users/${post.user_id}`)}
                        >
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
                                iconLeading={(props) => <HeartIcon isLiked={post.is_liked || false} {...props} />}
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
