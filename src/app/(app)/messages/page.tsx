"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { usePageTour } from "@/hooks/use-page-tour";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { ArrowUp, Plus, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { motion, AnimatePresence } from "motion/react";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";

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
                behavior: smooth ? "smooth" : "auto"
            });
        } else if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
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
                setConversations(prev => 
                    prev.map(conv => 
                        conv.other_user_id === userId 
                            ? { ...conv, unread_count: 0 }
                            : conv
                    )
                );
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

        setMessages(prev => [...prev, optimisticMessage]);
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
            setMessages(prev => prev.map(msg =>
                msg.id === tempId ? { ...newMessage, pending: false } : msg
            ));

            // Refresh conversations
            loadConversations();
        } catch (error) {
            console.error("Error sending message:", error);
            // Remove the optimistic message on error
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
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
        <div className="relative flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6 overflow-auto h-full">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Messages</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
                    {/* Conversations List */}
                    <div data-tour="conversations-list" className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversations</h2>
                                <button
                                    data-tour="new-message"
                                    onClick={() => {
                                        setShowNewMessage(!showNewMessage);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                                >
                                    {showNewMessage ? <X className="size-4" /> : <Plus className="size-4" />}
                                    {showNewMessage ? "Cancel" : "New"}
                                </button>
                            </div>
                            {showNewMessage && (
                                <div className="mt-3 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-gray-500" />
                                    <Input
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        {showNewMessage && searchQuery.trim() && (
                            <div className="border-b border-gray-200 dark:border-gray-800 max-h-[200px] overflow-y-auto">
                                {searchLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Searching...</div>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="flex items-center justify-center py-8 px-4">
                                        <div className="text-center text-gray-500 dark:text-gray-400">
                                            <p className="text-sm">No users found</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
                                                    className="p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={userProfile.avatar_url || undefined} />
                                                            <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white font-medium">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                                                {displayName}
                                                            </div>
                                                            {isExistingConversation && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {/* Skeleton loading for conversations */}
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
                                                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-12" />
                                                    </div>
                                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-36" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="flex items-center justify-center py-12 px-4">
                                    <div className="text-center text-gray-500 dark:text-gray-400">
                                        <p className="text-sm">No conversations yet</p>
                                        <p className="text-xs mt-2">Start a conversation from a user profile</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {Array.isArray(conversations) && conversations.map((conversation) => {
                                        const displayName = getDisplayName(conversation.other_user);
                                        const initials = getInitials(conversation.other_user);
                                        const isSelected = selectedUserId === conversation.other_user_id;
                                        const isUnread = conversation.unread_count > 0;

                                        return (
                                            <div
                                                key={conversation.other_user_id}
                                                onClick={() => setSelectedUserId(conversation.other_user_id)}
                                                className={`px-4 py-3 cursor-pointer transition-all duration-150 ${
                                                    isSelected
                                                        ? "bg-gray-100 dark:bg-gray-800"
                                                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Avatar className="h-10 w-10 transition-transform duration-150 hover:scale-105">
                                                            <AvatarImage src={conversation.other_user?.avatar_url || undefined} />
                                                            <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white font-medium">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {isUnread && (
                                                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <div className={`text-sm truncate transition-colors ${
                                                                isUnread ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"
                                                            }`}>
                                                                {displayName}
                                                            </div>
                                                            {conversation.last_message && (
                                                                <span className={`text-xs ml-2 transition-colors ${
                                                                    isUnread ? "text-blue-500 font-medium" : "text-gray-400 dark:text-gray-500"
                                                                }`}>
                                                                    {formatDistanceToNow(
                                                                        new Date(conversation.last_message.created_at),
                                                                        { addSuffix: true }
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <p className={`text-xs truncate transition-colors ${
                                                                isUnread ? "text-gray-800 dark:text-gray-200 font-medium" : "text-gray-500 dark:text-gray-400"
                                                            }`}>
                                                                {conversation.last_message.content}
                                                            </p>
                                                            {isUnread && (
                                                                <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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
                    <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex flex-col">
                        {selectedUserId ? (
                            <>
                                {/* Messages Header */}
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
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
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={selectedUserProfile.avatar_url || undefined} />
                                                            <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white font-medium">
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
                                                    <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white font-medium">
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
                                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col justify-end scroll-smooth">
                                    {loadingMessages ? (
                                        <div className="space-y-3">
                                            {/* Skeleton loading for messages */}
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                                                    <div className={`rounded-2xl px-4 py-3 ${
                                                        i % 2 === 0
                                                            ? "bg-gray-100 dark:bg-gray-800"
                                                            : "bg-gray-200 dark:bg-gray-700"
                                                    }`}>
                                                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" style={{ width: `${80 + Math.random() * 120}px` }} />
                                                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mt-2 w-12" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center text-gray-500 dark:text-gray-400">
                                                <p className="text-sm">No messages yet</p>
                                                <p className="text-xs mt-2">Start the conversation!</p>
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
                                                                        ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                                                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                                                } ${isPending ? "opacity-70" : ""}`}
                                                            >
                                                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                                    {message.content}
                                                                </p>
                                                                <p className={`text-[10px] mt-1.5 flex items-center gap-1.5 ${
                                                                    isOwn ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"
                                                                }`}>
                                                                    {isPending ? (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="w-1 h-1 bg-current rounded-full animate-pulse" />
                                                                            Sending...
                                                                        </span>
                                                                    ) : (
                                                                        message.created_at && !isNaN(new Date(message.created_at).getTime())
                                                                            ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
                                                                            : 'Just now'
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
                                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                                    <div data-tour="message-input" className="flex gap-3 items-end">
                                        <div className="flex-1 relative">
                                            <Textarea
                                                placeholder="Type a message..."
                                                value={messageContent}
                                                onChange={(e) => setMessageContent(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                rows={1}
                                                className="resize-none rounded-2xl min-h-[44px] py-3 px-4 bg-gray-100 dark:bg-gray-800 border-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-700 transition-all duration-200"
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
                                                className="rounded-full h-11 w-11 p-0 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 transition-all duration-200 disabled:bg-gray-300 dark:disabled:bg-gray-700"
                                            >
                                                <ArrowUp className="size-5" />
                                            </Button>
                                        </motion.div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-center text-gray-500 dark:text-gray-400"
                                >
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium mb-1">Select a conversation</p>
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
