"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { NotificationCard } from "@/components/notifications/notification-card";

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

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => router.push("/")}
                    className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="flex flex-col gap-8 p-6 overflow-auto h-full">
                    <div className="max-w-3xl mx-auto w-full">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
                        </div>

                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
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
                                <div>
                                    {notifications.map((notification) => (
                                        <NotificationCard
                                            key={notification.id}
                                            notification={notification}
                                            onClick={() => handleNotificationClick(notification)}
                                            clickable={true}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
