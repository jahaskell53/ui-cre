"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-user";
import { formatDistanceToNow } from "date-fns";
import { generateAuroraGradient } from "@/app/people/utils";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    type: "message";
    sender: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    content: string;
    created_at: string;
    read_at: string | null;
}

export default function NotificationsPage() {
    const router = useRouter();
    const { user, loading: userLoading } = useUser();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const loadNotifications = useCallback(async () => {
        if (!user) return;

        try {
            const response = await fetch("/api/notifications", {
                credentials: "include",
            });
            if (!response.ok) {
                if (response.status === 401) {
                    router.push("/login");
                    return;
                }
                throw new Error("Failed to load notifications");
            }
            const data = await response.json();
            setNotifications(data);
        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setLoading(false);
        }
    }, [user, router]);

    useEffect(() => {
        if (userLoading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        loadNotifications();

        // Poll for new notifications every 5 seconds
        const interval = setInterval(loadNotifications, 5000);

        return () => clearInterval(interval);
    }, [user, userLoading, router, loadNotifications]);

    const handleNotificationClick = async (notification: Notification) => {
        if (notification.type === "message" && notification.sender) {
            // Mark notification as read
            try {
                await fetch(`/api/notifications/${notification.id}/read`, {
                    method: "POST",
                    credentials: "include",
                });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }

            // Navigate to messages
            router.push(`/messages?user_id=${notification.sender.id}`);
        }
    };

    const getDisplayName = (sender: Notification["sender"]) => {
        if (!sender) return "Unknown User";
        return sender.full_name || "Unknown User";
    };

    const getInitials = (sender: Notification["sender"]) => {
        const name = getDisplayName(sender);
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
                <div className="max-w-3xl mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Stay updated with your professional network and activity.</p>
                    </div>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                <div className="text-sm">Loading notifications...</div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-800 text-gray-300">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">All caught up!</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">You don't have any new notifications at the moment.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {notifications.map((notification) => {
                                    if (notification.type === "message" && notification.sender) {
                                        const displayName = getDisplayName(notification.sender);
                                        const initials = getInitials(notification.sender);
                                        const isUnread = !notification.read_at;

                                        return (
                                            <div
                                                key={notification.id}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={cn(
                                                    "p-5 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 flex gap-4 group relative",
                                                    isUnread && "bg-blue-50/30 dark:bg-blue-900/10"
                                                )}
                                            >
                                                {isUnread && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                                )}
                                                
                                                <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-800 shadow-sm flex-shrink-0">
                                                    <AvatarImage src={notification.sender.avatar_url || undefined} />
                                                    <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs font-bold text-white">
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                                                            {displayName}
                                                        </div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                            {formatDistanceToNow(
                                                                new Date(notification.created_at),
                                                                { addSuffix: true }
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className={cn(
                                                        "text-[13px] leading-relaxed line-clamp-2",
                                                        isUnread ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400"
                                                    )}>
                                                        {notification.content}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                            New Message
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-shrink-0 self-center text-gray-300 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-600 transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
