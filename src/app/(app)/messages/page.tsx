"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePageTour } from "@/hooks/use-page-tour";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";

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
    pending?: boolean; // For optimistic updates
}

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    roles: string[] | null;
}

export default function MessagesPage() {
    const { user } = useUser();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const fetchUserProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url, website, roles").eq("id", userId).single();

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
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isInitialLoadRef = useRef(true);
    const [showNewMessage, setShowNewMessage] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const [isTourOpen, setIsTourOpen] = useState(false);

    // Listen for tour trigger from sidebar
    usePageTour(() => setIsTourOpen(true));

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

    // Use layout effect for initial scroll to avoid flash
    useLayoutEffect(() => {
        if (messages.length === 0) return;

        if (isInitialLoadRef.current) {
            // Instant scroll on initial load
            scrollToBottom(false);
            isInitialLoadRef.current = false;
        }
    }, [messages]);

    // Smooth scroll for new messages after initial load
    useEffect(() => {
        if (messages.length === 0 || isInitialLoadRef.current) return;

        // Only smooth scroll for new messages (optimistic updates)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.pending || lastMessage?.sender_id === user?.id) {
            scrollToBottom(true);
        }
    }, [messages, user?.id]);

    useEffect(() => {
        // Reset initial load flag when switching conversations
        isInitialLoadRef.current = true;
    }, [selectedUserId]);

    const scrollToBottom = (smooth = true) => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: smooth ? "smooth" : "auto",
            });
        } else if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === "function") {
            messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
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

            // Update unread count locally without reloading conversations
            if (showLoading) {
                setConversations((prev) => prev.map((conv) => (conv.other_user_id === userId ? { ...conv, unread_count: 0 } : conv)));
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
        if (!selectedUserId || !messageContent.trim() || sending || !user?.id) {
            return;
        }

        const content = messageContent.trim();
        const tempId = `temp-${Date.now()}`;

        // Optimistic update - add message immediately
        const optimisticMessage: Message = {
            id: tempId,
            sender_id: user.id,
            recipient_id: selectedUserId,
            content,
            created_at: new Date().toISOString(),
            read_at: null,
            pending: true,
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        setMessageContent("");
        setSending(true);

        try {
            const response = await fetch("/api/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    recipient_id: selectedUserId,
                    content,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to send message");
            }

            const newMessage = await response.json();
            // Replace optimistic message with real one
            setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...newMessage, pending: false } : msg)));

            // Refresh conversations
            loadConversations();
        } catch (error) {
            console.error("Error sending message:", error);
            // Remove the optimistic message on error
            setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
            setMessageContent(content); // Restore the message content
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
            .map((n) => n[0])
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
        const userProfile = searchResults.find((u) => u.id === userId);
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
            const conversation = conversations.find((c) => c.other_user_id === selectedUserId);
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
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const tourSteps: TourStep[] = [
        {
            id: "new-message",
            target: '[data-tour="new-message"]',
            title: "Start New Conversation",
            content: "Click here to search for users and start a new conversation. Type a name to find contacts.",
            position: "bottom",
        },
        {
            id: "conversations",
            target: '[data-tour="conversations-list"]',
            title: "Your Conversations",
            content: "View all your conversations here. Click on any conversation to open it and see messages.",
            position: "right",
        },
        {
            id: "message-input",
            target: '[data-tour="message-input"]',
            title: "Send Messages",
            content: "Type your message here and press Enter to send. Messages are delivered in real-time.",
            position: "top",
        },
    ];

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex h-full flex-col gap-8 overflow-auto p-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Messages</h1>

                <div className="grid h-[calc(100vh-200px)] min-h-[600px] grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Conversations List */}
                    <div
                        data-tour="conversations-list"
                        className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-1 dark:border-gray-800 dark:bg-gray-900"
                    >
                        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversations</h2>
                                <button
                                    data-tour="new-message"
                                    onClick={() => {
                                        setShowNewMessage(!showNewMessage);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                    }}
                                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                >
                                    {showNewMessage ? <X className="size-4" /> : <Plus className="size-4" />}
                                    {showNewMessage ? "Cancel" : "New"}
                                </button>
                            </div>
                            {showNewMessage && (
                                <div className="relative mt-3">
                                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                                    <Input
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="border-gray-200 bg-gray-50 pl-9 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        {showNewMessage && searchQuery.trim() && (
                            <div className="max-h-[200px] overflow-y-auto border-b border-gray-200 dark:border-gray-800">
                                {searchLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Searching...</div>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="flex items-center justify-center px-4 py-8">
                                        <div className="text-center text-gray-500 dark:text-gray-400">
                                            <p className="text-sm">No users found</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {searchResults.map((userProfile) => {
                                            const displayName = userProfile.full_name || "Unknown User";
                                            const initials = getInitialsFromUser(userProfile);
                                            const isExistingConversation = conversations.some((c) => c.other_user_id === userProfile.id);

                                            return (
                                                <div
                                                    key={userProfile.id}
                                                    onClick={() => handleStartConversation(userProfile.id)}
                                                    className="cursor-pointer p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={userProfile.avatar_url || undefined} />
                                                            <AvatarFallback
                                                                style={{ background: generateAuroraGradient(displayName) }}
                                                                className="text-xs font-medium text-white"
                                                            >
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                                                            {isExistingConversation && (
                                                                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Existing conversation</div>
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
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {/* Skeleton loading for conversations */}
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                                                <div className="flex-1">
                                                    <div className="mb-1.5 flex items-center justify-between">
                                                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                                        <div className="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                                    </div>
                                                    <div className="h-3 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="flex items-center justify-center px-4 py-12">
                                    <div className="text-center text-gray-500 dark:text-gray-400">
                                        <p className="text-sm">No conversations yet</p>
                                        <p className="mt-2 text-xs">Start a conversation from a user profile</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {Array.isArray(conversations) &&
                                        conversations.map((conversation) => {
                                            const displayName = getDisplayName(conversation.other_user);
                                            const initials = getInitials(conversation.other_user);
                                            const isSelected = selectedUserId === conversation.other_user_id;
                                            const isUnread = conversation.unread_count > 0;

                                            return (
                                                <div
                                                    key={conversation.other_user_id}
                                                    onClick={() => setSelectedUserId(conversation.other_user_id)}
                                                    className={`cursor-pointer px-4 py-3 transition-all duration-150 ${
                                                        isSelected
                                                            ? "bg-gray-100 dark:bg-gray-800"
                                                            : "hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-gray-800/50 dark:active:bg-gray-800"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <Avatar className="h-10 w-10 transition-transform duration-150 hover:scale-105">
                                                                <AvatarImage src={conversation.other_user?.avatar_url || undefined} />
                                                                <AvatarFallback
                                                                    style={{ background: generateAuroraGradient(displayName) }}
                                                                    className="text-xs font-medium text-white"
                                                                >
                                                                    {initials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {isUnread && (
                                                                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 dark:border-gray-900" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-0.5 flex items-center justify-between">
                                                                <div
                                                                    className={`truncate text-sm transition-colors ${
                                                                        isUnread
                                                                            ? "font-semibold text-gray-900 dark:text-gray-100"
                                                                            : "font-medium text-gray-700 dark:text-gray-300"
                                                                    }`}
                                                                >
                                                                    {displayName}
                                                                </div>
                                                                {conversation.last_message && (
                                                                    <span
                                                                        className={`ml-2 text-xs transition-colors ${
                                                                            isUnread ? "font-medium text-blue-500" : "text-gray-400 dark:text-gray-500"
                                                                        }`}
                                                                    >
                                                                        {formatDistanceToNow(new Date(conversation.last_message.created_at), {
                                                                            addSuffix: true,
                                                                        })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <p
                                                                    className={`truncate text-xs transition-colors ${
                                                                        isUnread
                                                                            ? "font-medium text-gray-800 dark:text-gray-200"
                                                                            : "text-gray-500 dark:text-gray-400"
                                                                    }`}
                                                                >
                                                                    {conversation.last_message.content}
                                                                </p>
                                                                {isUnread && (
                                                                    <span className="ml-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
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
                    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
                        {selectedUserId ? (
                            <>
                                {/* Messages Header */}
                                <div className="border-b border-gray-200 p-4 dark:border-gray-800">
                                    {(() => {
                                        const conversation = conversations.find((c) => c.other_user_id === selectedUserId);

                                        // If no conversation exists, use selected user profile from search
                                        if (!conversation?.other_user) {
                                            if (selectedUserProfile) {
                                                const displayName = selectedUserProfile.full_name || "Unknown User";
                                                const initials = getInitialsFromUser(selectedUserProfile);

                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={selectedUserProfile.avatar_url || undefined} />
                                                            <AvatarFallback
                                                                style={{ background: generateAuroraGradient(displayName) }}
                                                                className="text-xs font-medium text-white"
                                                            >
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</h3>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }

                                        const displayName = getDisplayName(conversation.other_user);
                                        const initials = getInitials(conversation.other_user);

                                        return (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage src={conversation.other_user.avatar_url || undefined} />
                                                    <AvatarFallback
                                                        style={{ background: generateAuroraGradient(displayName) }}
                                                        className="text-xs font-medium text-white"
                                                    >
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</h3>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Messages List */}
                                <div ref={messagesContainerRef} className="flex flex-1 flex-col justify-end overflow-y-auto scroll-smooth p-4">
                                    {loadingMessages ? (
                                        <div className="space-y-3">
                                            {/* Skeleton loading for messages */}
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                                                    <div
                                                        className={`rounded-2xl px-4 py-3 ${
                                                            i % 2 === 0 ? "bg-gray-100 dark:bg-gray-800" : "bg-gray-200 dark:bg-gray-700"
                                                        }`}
                                                    >
                                                        <div
                                                            className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-600"
                                                            style={{ width: `${80 + Math.random() * 120}px` }}
                                                        />
                                                        <div className="mt-2 h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center text-gray-500 dark:text-gray-400">
                                                <p className="text-sm">No messages yet</p>
                                                <p className="mt-2 text-xs">Start the conversation!</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <AnimatePresence mode="popLayout">
                                                {messages.map((message) => {
                                                    const isOwn = message.sender_id === user?.id;
                                                    const isPending = message.pending;
                                                    return (
                                                        <motion.div
                                                            key={message.id}
                                                            layout
                                                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                            animate={{ opacity: isPending ? 0.7 : 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                            transition={{
                                                                type: "spring",
                                                                stiffness: 500,
                                                                damping: 40,
                                                                mass: 1,
                                                            }}
                                                            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                                                        >
                                                            <div
                                                                className={`max-w-[70%] rounded-2xl px-4 py-2.5 transition-all duration-200 ${
                                                                    isOwn
                                                                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                                                        : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                                                } ${isPending ? "opacity-70" : ""}`}
                                                            >
                                                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
                                                                <p
                                                                    className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                                                                        isOwn ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"
                                                                    }`}
                                                                >
                                                                    {isPending ? (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
                                                                            Sending...
                                                                        </span>
                                                                    ) : message.created_at && !isNaN(new Date(message.created_at).getTime()) ? (
                                                                        formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
                                                                    ) : (
                                                                        "Just now"
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                            <div ref={messagesEndRef} />
                                        </div>
                                    )}
                                </div>

                                {/* Message Input */}
                                <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                    <div data-tour="message-input" className="flex items-end gap-3">
                                        <div className="relative flex-1">
                                            <Textarea
                                                placeholder="Type a message..."
                                                value={messageContent}
                                                onChange={(e) => setMessageContent(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                rows={1}
                                                className="min-h-[44px] resize-none rounded-2xl border-0 bg-gray-100 px-4 py-3 text-sm text-gray-900 transition-all duration-200 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-700"
                                            />
                                        </div>
                                        <motion.div
                                            initial={false}
                                            animate={{
                                                scale: messageContent.trim() ? 1 : 0.9,
                                                opacity: messageContent.trim() ? 1 : 0.5,
                                            }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        >
                                            <Button
                                                onClick={sendMessage}
                                                disabled={!messageContent.trim() || sending}
                                                size="sm"
                                                className="h-11 w-11 rounded-full bg-gray-900 p-0 text-white transition-all duration-200 hover:bg-gray-800 disabled:bg-gray-300 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-gray-700"
                                            >
                                                <ArrowUp className="size-5" />
                                            </Button>
                                        </motion.div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-center text-gray-500 dark:text-gray-400"
                                >
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                        <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                            />
                                        </svg>
                                    </div>
                                    <p className="mb-1 text-sm font-medium">Select a conversation</p>
                                    <p className="text-xs">Choose from the list to start messaging</p>
                                </motion.div>
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
                    console.log("Messages tour completed!");
                }}
            />
        </div>
    );
}
