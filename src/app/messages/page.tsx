"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { ArrowUp, Plus, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { generateAuroraGradient } from "@/app/people/utils";

interface Conversation {
    other_user_id: string;
    other_user: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    last_message: {
        id: string;
        content: string;
        created_at: string;
        sender_id: string;
    };
    unread_count: number;
}

interface Message {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    created_at: string;
    read_at: string | null;
}

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    roles: string[] | null;
}

export default function MessagesPage() {
    const router = useRouter();
    const { user } = useUser();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const fetchUserProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, website, roles")
                .eq("id", userId)
                .single();

            if (error) throw error;

            if (data) {
                setSelectedUserProfile(data);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    }, []);

    // Check for user_id query parameter and fetch user profile
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const userId = params.get("user_id");
        if (userId) {
            setSelectedUserId(userId);
            // Fetch user profile when coming from profile page
            fetchUserProfile(userId);
        }
    }, [fetchUserProfile]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageContent, setMessageContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showNewMessage, setShowNewMessage] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        if (searchQuery.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchUsers(searchQuery);
        }, 300);

        setDebounceTimer(timer);

        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [searchQuery]);

    useEffect(() => {
        if (selectedUserId) {
            loadMessages(selectedUserId);
            // Poll for new messages every 3 seconds
            const interval = setInterval(() => {
                loadMessages(selectedUserId, false);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [selectedUserId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    const loadConversations = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/conversations");
            if (!response.ok) {
                throw new Error("Failed to load conversations");
            }
            const data = await response.json();
            setConversations(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading conversations:", error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (userId: string, showLoading = true) => {
        if (showLoading) {
            setLoadingMessages(true);
        }
        try {
            const response = await fetch(`/api/messages?user_id=${userId}`);
            if (!response.ok) {
                throw new Error("Failed to load messages");
            }
            const data = await response.json();
            setMessages(data);

            // Refresh conversations to update unread counts
            if (showLoading) {
                loadConversations();
            }
        } catch (error) {
            console.error("Error loading messages:", error);
        } finally {
            if (showLoading) {
                setLoadingMessages(false);
            }
        }
    };

    const sendMessage = async () => {
        if (!selectedUserId || !messageContent.trim() || sending) {
            return;
        }

        setSending(true);
        try {
            const response = await fetch("/api/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    recipient_id: selectedUserId,
                    content: messageContent.trim(),
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to send message");
            }

            const newMessage = await response.json();
            setMessages([...messages, newMessage]);
            setMessageContent("");

            // Refresh conversations
            loadConversations();
        } catch (error) {
            console.error("Error sending message:", error);
            alert(error instanceof Error ? error.message : "Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const getDisplayName = (user: Conversation["other_user"]) => {
        if (!user) return "Unknown User";
        return user.full_name || "Unknown User";
    };

    const getInitials = (user: Conversation["other_user"]) => {
        const name = getDisplayName(user);
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const searchUsers = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, website, roles")
                .ilike("full_name", `%${query}%`)
                .neq("id", user?.id || "")
                .limit(20);

            if (error) throw error;

            setSearchResults(data || []);
        } catch (error) {
            console.error("Error searching users:", error);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleStartConversation = (userId: string) => {
        const userProfile = searchResults.find(u => u.id === userId);
        if (userProfile) {
            setSelectedUserProfile(userProfile);
        }
        setSelectedUserId(userId);
        setShowNewMessage(false);
        setSearchQuery("");
        setSearchResults([]);
    };

    useEffect(() => {
        // Clear selected user profile when switching to an existing conversation
        // Or fetch it if we don't have it yet (e.g., from query param)
        if (selectedUserId) {
            const conversation = conversations.find(c => c.other_user_id === selectedUserId);
            if (conversation?.other_user) {
                // If we have a conversation, we don't need the selectedUserProfile
                setSelectedUserProfile(null);
            } else if (!selectedUserProfile) {
                // If no conversation and no profile, fetch it (e.g., from query param)
                fetchUserProfile(selectedUserId);
            }
        } else {
            setSelectedUserProfile(null);
        }
    }, [selectedUserId, conversations, selectedUserProfile, fetchUserProfile]);

    const getInitialsFromUser = (user: UserProfile | Conversation["other_user"]) => {
        const name = user?.full_name || "Unknown User";
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Messages</h1>
                <p className="text-lg text-tertiary mb-8">Chat with other users.</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[600px]">
                    {/* Conversations List */}
                    <div className="lg:col-span-1 bg-primary border border-secondary rounded-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-secondary">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-semibold text-primary">Conversations</h2>
                                <Button
                                    onClick={() => {
                                        setShowNewMessage(!showNewMessage);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                    }}
                                    size="sm"
                                >
                                    {showNewMessage ? <X className="size-4" /> : <Plus className="size-4" />}
                                    {showNewMessage ? "Cancel" : "New"}
                                </Button>
                            </div>
                            {showNewMessage && (
                                <div className="mt-3 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                    <Input
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        {showNewMessage && searchQuery.trim() && (
                            <div className="border-b border-secondary max-h-[200px] overflow-y-auto">
                                {searchLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-tertiary">Searching...</div>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="flex items-center justify-center py-8 px-4">
                                        <div className="text-center text-tertiary">
                                            <p className="text-sm">No users found</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-secondary">
                                        {searchResults.map((userProfile) => {
                                            const displayName = userProfile.full_name || "Unknown User";
                                            const initials = getInitialsFromUser(userProfile);
                                            const isExistingConversation = conversations.some(
                                                c => c.other_user_id === userProfile.id
                                            );

                                            return (
                                                <div
                                                    key={userProfile.id}
                                                    onClick={() => handleStartConversation(userProfile.id)}
                                                    className="p-3 cursor-pointer transition-colors hover:bg-secondary/5"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={userProfile.avatar_url || undefined} />
                                                            <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-sm text-primary truncate">
                                                                {displayName}
                                                            </div>
                                                            {isExistingConversation && (
                                                                <div className="text-xs text-tertiary mt-1">
                                                                    Existing conversation
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-tertiary">Loading...</div>
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="flex items-center justify-center py-12 px-4">
                                    <div className="text-center text-tertiary">
                                        <p>No conversations yet</p>
                                        <p className="text-sm mt-2">Start a conversation from a user profile</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-secondary">
                                    {Array.isArray(conversations) && conversations.map((conversation) => {
                                        const displayName = getDisplayName(conversation.other_user);
                                        const initials = getInitials(conversation.other_user);
                                        const isSelected = selectedUserId === conversation.other_user_id;
                                        const isUnread = conversation.unread_count > 0;

                                        return (
                                            <div
                                                key={conversation.other_user_id}
                                                onClick={() => setSelectedUserId(conversation.other_user_id)}
                                                className={`p-4 cursor-pointer transition-colors ${
                                                    isSelected
                                                        ? "bg-secondary/10 border-l-2 border-brand"
                                                        : "hover:bg-secondary/5"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={conversation.other_user?.avatar_url || undefined} />
                                                        <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white">
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className={`font-semibold text-sm truncate ${
                                                                isUnread ? "text-primary" : "text-secondary"
                                                            }`}>
                                                                {displayName}
                                                            </div>
                                                            {conversation.last_message && (
                                                                <span className="text-xs text-tertiary ml-2">
                                                                    {formatDistanceToNow(
                                                                        new Date(conversation.last_message.created_at),
                                                                        { addSuffix: true }
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <p className={`text-sm truncate ${
                                                                isUnread ? "text-primary font-medium" : "text-tertiary"
                                                            }`}>
                                                                {conversation.last_message.content}
                                                            </p>
                                                            {isUnread && (
                                                                <span className="ml-2 bg-brand-primary text-brand-solid text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                                                    {conversation.unread_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messages View */}
                    <div className="lg:col-span-2 bg-primary border border-secondary rounded-2xl overflow-hidden flex flex-col">
                        {selectedUserId ? (
                            <>
                                {/* Messages Header */}
                                <div className="p-4 border-b border-secondary">
                                    {(() => {
                                        const conversation = conversations.find(
                                            c => c.other_user_id === selectedUserId
                                        );

                                        // If no conversation exists, use selected user profile from search
                                        if (!conversation?.other_user) {
                                            if (selectedUserProfile) {
                                                const displayName = selectedUserProfile.full_name || "Unknown User";
                                                const initials = getInitialsFromUser(selectedUserProfile);

                                                return (
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={selectedUserProfile.avatar_url || undefined} />
                                                            <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <h3 className="font-semibold text-primary">{displayName}</h3>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }

                                        const displayName = getDisplayName(conversation.other_user);
                                        const initials = getInitials(conversation.other_user);

                                        return (
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={conversation.other_user.avatar_url || undefined} />
                                                    <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white">
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-semibold text-primary">{displayName}</h3>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Messages List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-tertiary">Loading messages...</div>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center text-tertiary">
                                                <p>No messages yet</p>
                                                <p className="text-sm mt-2">Start the conversation!</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {messages.map((message) => {
                                                const isOwn = message.sender_id === user?.id;
                                                return (
                                                    <div
                                                        key={message.id}
                                                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <div
                                                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                                                isOwn
                                                                    ? "bg-brand-primary text-brand-solid"
                                                                    : "bg-secondary/10 text-primary"
                                                            }`}
                                                        >
                                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                                {message.content}
                                                            </p>
                                                            <p className={`text-xs mt-1 ${
                                                                isOwn ? "text-brand-solid/70" : "text-tertiary"
                                                            }`}>
                                                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </>
                                    )}
                                </div>

                                {/* Message Input */}
                                <div className="p-4 border-t border-secondary">
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Textarea
                                                placeholder="Type a message..."
                                                value={messageContent}
                                                onChange={(e) => setMessageContent(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                rows={1}
                                                className="resize-none rounded-full h-12 py-3"
                                            />
                                        </div>
                                        <Button
                                            onClick={sendMessage}
                                            disabled={!messageContent.trim() || sending}
                                            size="lg"
                                            className="rounded-full w-12 h-12 p-0"
                                        >
                                            <ArrowUp className="size-5" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-tertiary">
                                    <p className="text-lg mb-2">Select a conversation</p>
                                    <p className="text-sm">Choose a conversation from the list to start messaging</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
