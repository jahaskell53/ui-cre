"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { formatDistanceToNow } from "date-fns";
import { MentionDropdown, UserSuggestion } from "./mention-dropdown";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profile?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface CommentSectionProps {
    postId: string;
    currentUserId: string | undefined;
    currentUserProfile: { full_name: string | null; avatar_url: string | null } | null;
    onCommentCreated: () => void;
    onCommentDeleted: (commentId: string) => void;
}

export const CommentSection = ({
    postId,
    currentUserId,
    currentUserProfile,
    onCommentCreated,
    onCommentDeleted,
}: CommentSectionProps) => {
    const router = useRouter();
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [mentionSuggestions, setMentionSuggestions] = useState<UserSuggestion[]>([]);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionPosition, setMentionPosition] = useState<number | null>(null);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(-1);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
    const mentionInputRef = useRef<HTMLInputElement>(null);
    const mentionDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadComments();
    }, [postId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                mentionDropdownRef.current &&
                !mentionDropdownRef.current.contains(event.target as Node) &&
                mentionInputRef.current &&
                !(mentionInputRef.current as HTMLElement).contains(event.target as Node)
            ) {
                setShowMentionDropdown(false);
            }
        };

        if (showMentionDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [showMentionDropdown]);

    const loadComments = async () => {
        const { data, error } = await supabase
            .from("comments")
            .select(`
                *,
                profile:profiles(full_name, avatar_url)
            `)
            .eq("post_id", postId)
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

    const searchMentionUsers = useCallback(async (query: string) => {
        if (!query.trim()) {
            setMentionSuggestions([]);
            setShowMentionDropdown(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .ilike("full_name", `%${query}%`)
                .neq("id", currentUserId || "")
                .limit(10);

            if (error) throw error;

            setMentionSuggestions(data || []);
            setShowMentionDropdown((data || []).length > 0);
            setSelectedMentionIndex(-1);
        } catch (error) {
            console.error("Error searching users for mention:", error);
            setMentionSuggestions([]);
            setShowMentionDropdown(false);
        }
    }, [currentUserId]);

    const handleCommentTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCommentText(value);

        setTimeout(() => {
            const input = mentionInputRef.current as HTMLInputElement | null;
            if (!input) return;

            const pos = input.selectionStart || value.length;
            setCursorPosition(pos);

            const textBeforeCursor = value.substring(0, pos);
            const lastAtIndex = textBeforeCursor.lastIndexOf("@");

            if (lastAtIndex !== -1) {
                const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                if (textAfterAt.includes(" ") || textAfterAt.length === 0) {
                    setShowMentionDropdown(false);
                    setMentionQuery("");
                    setMentionPosition(null);
                } else {
                    const query = textAfterAt.trim();
                    setMentionQuery(query);
                    setMentionPosition(lastAtIndex);
                    searchMentionUsers(query);
                }
            } else {
                setShowMentionDropdown(false);
                setMentionQuery("");
                setMentionPosition(null);
            }
        }, 0);
    };

    const insertMention = (username: string) => {
        let pos = mentionPosition;
        if (pos === null) {
            const input = mentionInputRef.current as HTMLInputElement | null;
            if (input) {
                const cursorPos = input.selectionStart || commentText.length;
                const textBeforeCursor = commentText.substring(0, cursorPos);
                pos = textBeforeCursor.lastIndexOf("@");
            }
        }

        if (pos === null || pos === -1) {
            console.error("Could not find @ mention position");
            return;
        }

        const textBefore = commentText.substring(0, pos);
        const textAfter = commentText.substring(pos + 1 + (mentionQuery.length || 0));
        const newText = `${textBefore}@${username} ${textAfter}`;

        setCommentText(newText);
        setShowMentionDropdown(false);
        setMentionQuery("");
        setMentionPosition(null);
        setSelectedMentionIndex(-1);

        setTimeout(() => {
            const input = mentionInputRef.current as HTMLInputElement | null;
            if (input) {
                input.focus();
                const newCursorPos = pos! + username.length + 2;
                input.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = e.currentTarget as HTMLInputElement;
        setTimeout(() => {
            setCursorPosition(input.selectionStart || 0);
        }, 0);

        if (showMentionDropdown && mentionSuggestions.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedMentionIndex(prev =>
                    prev < mentionSuggestions.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : -1);
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (selectedMentionIndex >= 0 && selectedMentionIndex < mentionSuggestions.length) {
                    const selectedUser = mentionSuggestions[selectedMentionIndex];
                    const name = selectedUser.full_name || "";
                    if (name) {
                        insertMention(name);
                    }
                } else if (mentionSuggestions.length > 0) {
                    const firstUser = mentionSuggestions[0];
                    const name = firstUser.full_name || "";
                    if (name) {
                        insertMention(name);
                    }
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                setShowMentionDropdown(false);
                setMentionQuery("");
                setMentionPosition(null);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleComment();
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || !currentUserId) return;

        setIsSubmittingComment(true);
        try {
            const response = await fetch("/api/comments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    post_id: postId,
                    content: commentText.trim(),
                }),
            });

            if (response.ok) {
                setCommentText("");
                setShowMentionDropdown(false);
                setMentionQuery("");
                setMentionPosition(null);
                loadComments();
                onCommentCreated();
            } else {
                const error = await response.json();
                console.error("Error creating comment:", error);
                alert(error.error || "Failed to create comment");
            }
        } catch (error) {
            console.error("Error creating comment:", error);
            alert("Failed to create comment");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        const { error } = await supabase
            .from("comments")
            .delete()
            .eq("id", commentId)
            .eq("user_id", currentUserId);

        if (!error) {
            loadComments();
            onCommentDeleted(commentId);
        } else {
            console.error("Error deleting comment:", error.message);
            alert("Failed to delete comment. Please try again.");
        }
    };

    return (
        <div className="border-t border-secondary bg-secondary/20 p-6 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    {comments.map((comment) => {
                        const commentAuthorName = comment.profile?.full_name || "Anonymous";
                        const commentInitials = commentAuthorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";
                        return (
                            <div key={comment.id} className="flex gap-3">
                                <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => router.push(`/users/${comment.user_id}`)}
                                >
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={comment.profile?.avatar_url || undefined} />
                                        <AvatarFallback style={{ background: generateAuroraGradient(commentAuthorName) }} className="text-[10px] text-white">
                                            {commentInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="flex-1 bg-primary p-3 rounded-xl border border-secondary shadow-xs">
                                    <div className="flex justify-between items-center mb-1">
                                        <span
                                            className="text-xs font-bold text-primary cursor-pointer hover:text-brand-solid transition-colors"
                                            onClick={() => router.push(`/users/${comment.user_id}`)}
                                        >
                                            {commentAuthorName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-tertiary uppercase">
                                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                            </span>
                                            {currentUserId === comment.user_id && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => setPendingDeleteCommentId(comment.id)}
                                                >
                                                    <Trash2 className="size-3 text-tertiary hover:text-red-500" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-secondary">{comment.content}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {currentUserId && currentUserProfile && (
                    <div className="flex gap-3 items-start mt-2">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={currentUserProfile.avatar_url || undefined} />
                            <AvatarFallback style={{ background: generateAuroraGradient(currentUserProfile.full_name || "User") }} className="text-[10px] text-white">
                                {currentUserProfile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex gap-2 relative">
                            <Input
                                ref={mentionInputRef}
                                placeholder="Write a comment..."
                                className="flex-1"
                                value={commentText}
                                onChange={handleCommentTextChange}
                                onKeyDown={handleCommentKeyDown}
                            />
                            {showMentionDropdown && (
                                <MentionDropdown
                                    ref={mentionDropdownRef}
                                    suggestions={mentionSuggestions}
                                    selectedIndex={selectedMentionIndex}
                                    onSelect={insertMention}
                                />
                            )}
                            <Button
                                size="sm"
                                className="shrink-0"
                                onClick={handleComment}
                                disabled={isSubmittingComment}
                            >
                                <Send className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Comment Confirmation Modal */}
            <ModalOverlay
                isOpen={pendingDeleteCommentId !== null}
                onOpenChange={(isOpen) => !isOpen && setPendingDeleteCommentId(null)}
            >
                <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
                    <Dialog className="p-6">
                        {({ close }) => (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete comment</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Are you sure you want to delete this comment? This action cannot be undone.
                                    </p>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPendingDeleteCommentId(null);
                                            close();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (pendingDeleteCommentId) {
                                                handleDeleteComment(pendingDeleteCommentId);
                                            }
                                            setPendingDeleteCommentId(null);
                                            close();
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
};
