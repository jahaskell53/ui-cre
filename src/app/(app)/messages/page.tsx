"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { ArrowUp, Plus, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { generateAuroraGradient } from "@/app/(app)/people/utils";

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
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isInitialLoadRef = useRef(true);
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
        if (messages.length === 0) return;
        
        // Use setTimeout to ensure DOM has updated
        const timer = setTimeout(() => {
            const isInitialLoad = isInitialLoadRef.current;
            scrollToBottom(!isInitialLoad);
            if (isInitialLoad) {
                isInitialLoadRef.current = false;
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [messages]);

    useEffect(() => {
        // Reset initial load flag when switching conversations
        isInitialLoadRef.current = true;
    }, [selectedUserId]);

    const scrollToBottom = (smooth = true) => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
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
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6 overflow-auto h-full">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Messages</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
                    {/* Conversations List */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversations</h2>
                                <button
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
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
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
                                                className={`px-4 py-2.5 cursor-pointer transition-colors ${
                                                    isSelected
                                                        ? "bg-gray-50 dark:bg-gray-800"
                                                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage src={conversation.other_user?.avatar_url || undefined} />
                                                        <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white font-medium">
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <div className={`text-sm truncate ${
                                                                isUnread ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
                                                            }`}>
                                                                {displayName}
                                                            </div>
                                                            {conversation.last_message && (
                                                                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                                                                    {formatDistanceToNow(
                                                                        new Date(conversation.last_message.created_at),
                                                                        { addSuffix: true }
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <p className={`text-xs truncate ${
                                                                isUnread ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-500 dark:text-gray-400"
                                                            }`}>
                                                                {conversation.last_message.content}
                                                            </p>
                                                            {isUnread && (
                                                                <span className="ml-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
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
                                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col justify-end">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-sm text-gray-500 dark:text-gray-400">Loading messages...</div>
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
                                            {messages.map((message) => {
                                                const isOwn = message.sender_id === user?.id;
                                                return (
                                                    <div
                                                        key={message.id}
                                                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <div
                                                            className={`max-w-[70%] rounded-lg px-3 py-2 ${
                                                                isOwn
                                                                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                                            }`}
                                                        >
                                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                                {message.content}
                                                            </p>
                                                            <p className={`text-xs mt-1 ${
                                                                isOwn ? "text-gray-300 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
                                                            }`}>
                                                                {message.created_at && !isNaN(new Date(message.created_at).getTime()) 
                                                                    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
                                                                    : 'Just now'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    )}
                                </div>

                                {/* Message Input */}
                                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Textarea
                                                placeholder="Type a message..."
                                                value={messageContent}
                                                onChange={(e) => setMessageContent(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                rows={1}
                                                className="resize-none rounded-lg h-10 py-2.5 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
                                            />
                                        </div>
                                        <Button
                                            onClick={sendMessage}
                                            disabled={!messageContent.trim() || sending}
                                            size="sm"
                                            className="rounded-lg h-10 w-10 p-0 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                                        >
                                            <ArrowUp className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-gray-500 dark:text-gray-400">
                                    <p className="text-sm mb-2">Select a conversation</p>
                                    <p className="text-xs">Choose a conversation from the list to start messaging</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
