"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Avatar } from "@/components/base/avatar/avatar";
import { useUser } from "@/hooks/use-user";
import { formatDistanceToNow } from "date-fns";

interface Notification {
    id: string;
    type: "message";
    sender: {
        id: string;
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    content: string;
    created_at: string;
    read_at: string | null;
}

export default function NotificationsPage() {
    const router = useRouter();
    const { user } = useUser();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
        
        // Poll for new notifications every 5 seconds
        const interval = setInterval(loadNotifications, 5000);
        
        return () => clearInterval(interval);
    }, []);

    const loadNotifications = async () => {
        try {
            const response = await fetch("/api/notifications");
            if (!response.ok) {
                throw new Error("Failed to load notifications");
            }
            const data = await response.json();
            setNotifications(data);
        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (notification.type === "message" && notification.sender) {
            // Mark notification as read
            try {
                await fetch(`/api/notifications/${notification.id}/read`, {
                    method: "POST",
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
        return sender.full_name || sender.username || "Unknown User";
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
        <MainLayout>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Notifications</h1>
                <p className="text-lg text-tertiary mb-8">Stay updated with your latest activity.</p>

                <div className="bg-primary border border-secondary rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-tertiary">Loading notifications...</div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex items-center justify-center py-12 px-4">
                            <div className="text-center text-tertiary">
                                <p className="text-lg mb-2">No notifications</p>
                                <p className="text-sm">You're all caught up!</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-secondary">
                            {notifications.map((notification) => {
                                if (notification.type === "message" && notification.sender) {
                                    const displayName = getDisplayName(notification.sender);
                                    const initials = getInitials(notification.sender);

                                    return (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className="p-4 cursor-pointer transition-colors hover:bg-secondary/5"
                                        >
                                            <div className="flex items-start gap-3">
                                                <Avatar
                                                    size="md"
                                                    src={notification.sender.avatar_url || undefined}
                                                    initials={initials}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="font-semibold text-sm text-primary">
                                                            {displayName}
                                                        </div>
                                                        <span className="text-xs text-tertiary ml-2">
                                                            {formatDistanceToNow(
                                                                new Date(notification.created_at),
                                                                { addSuffix: true }
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-secondary line-clamp-2">
                                                        {notification.content}
                                                    </p>
                                                    <p className="text-xs text-tertiary mt-1">
                                                        New message
                                                    </p>
                                                </div>
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
        </MainLayout>
    );
}

