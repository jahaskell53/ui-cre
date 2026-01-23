"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Calendar,
    Clock,
    MapPin,
    ArrowLeft,
    Trash2,
    Edit,
    Plus,
    Eye,
    Users,
    ArrowRight,
    Search,
    ChevronRight,
    Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Event {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    color: string;
    image_url: string | null;
    created_at: string;
}

const colorClasses: Record<string, string> = {
    black: "bg-gray-100",
    blue: "bg-blue-100",
    green: "bg-green-100",
    purple: "bg-purple-100",
    red: "bg-red-100",
    orange: "bg-orange-100",
};

export default function ManageEventsPage() {
    const router = useRouter();
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const response = await fetch("/api/events");
            if (!response.ok) throw new Error("Failed to fetch events");
            const data = await response.json();
            setEvents(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDateHeading = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        return {
            monthDay: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            weekday: isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "long" })
        };
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const filteredEvents = events.filter((e) => {
        const isPast = new Date(e.start_time) < new Date();
        return activeTab === "upcoming" ? !isPast : isPast;
    }).sort((a, b) => {
        const dateA = new Date(a.start_time).getTime();
        const dateB = new Date(b.start_time).getTime();
        return activeTab === "upcoming" ? dateA - dateB : dateB - dateA;
    });

    // Grouping events by date string
    const groupedEvents = filteredEvents.reduce((acc, event) => {
        const dateStr = new Date(event.start_time).toDateString();
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(event);
        return acc;
    }, {} as Record<string, Event[]>);

    return (
        <div className="min-h-screen bg-[#FDFCFB] dark:bg-gray-950">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-12">
                    <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Events</h1>

                    <div className="flex items-center gap-6">
                        {/* Tabs */}
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-md">
                            <button
                                onClick={() => setActiveTab("upcoming")}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === "upcoming"
                                    ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white"
                                    : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                                    }`}
                            >
                                Upcoming
                            </button>
                            <button
                                onClick={() => setActiveTab("past")}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === "past"
                                    ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white"
                                    : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                                    }`}
                            >
                                Past
                            </button>
                        </div>
                        {/* Create New Button */}
                        <Link href="/calendar/events/new">
                            <Button className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 hidden lg:flex">
                                <Plus className="size-4" />
                                Create New
                            </Button>
                        </Link>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm font-medium text-gray-400">Loading your events...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-md flex items-center justify-center mb-6">
                            <Calendar className="w-10 h-10 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No {activeTab} events</h2>
                        <p className="text-gray-500 font-medium mb-8">Ready to host something amazing?</p>
                        <Link href="/calendar/events/new">
                            <Button size="lg" className="rounded-md font-semibold h-12 px-8">
                                <Plus className="w-5 h-5 mr-2" />
                                Create Event
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {Object.entries(groupedEvents).map(([dateStr, dateEvents], groupIdx) => (
                            <div key={dateStr} className="relative">
                                {/* Timeline Group Container */}
                                <div className="grid grid-cols-[120px_1fr] md:grid-cols-[160px_1fr] gap-4 md:gap-8">
                                    {/* Date Label (Stays on left) */}
                                    <div className="flex flex-col pt-4 items-end pr-4 border-r-2 border-gray-100 dark:border-gray-900 relative">
                                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight text-right">
                                            {formatDateHeading(dateStr).monthDay}
                                        </div>
                                        <div className="text-sm font-semibold text-gray-400 capitalize text-right">
                                            {formatDateHeading(dateStr).weekday}
                                        </div>
                                        {/* Dot on timeline */}
                                        <div className="absolute top-6 -right-[7px] w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-800 border-2 border-[#FDFCFB] dark:border-gray-950 z-10" />
                                    </div>

                                    {/* Events for this date */}
                                    <div className="space-y-6 pb-4">
                                        {dateEvents.map((event, eventIdx) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: eventIdx * 0.05 }}
                                                key={event.id}
                                                className="group relative bg-white dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all p-5 flex flex-col sm:flex-row gap-6"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 text-xs font-semibold text-gray-400 mb-2 uppercase tracking-tight">
                                                        <span>{formatTime(event.start_time)}</span>
                                                        {event.location && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {event.location}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-primary transition-colors">
                                                        {event.title}
                                                    </h3>

                                                    <div className="flex items-center gap-4 text-sm font-semibold text-gray-500 mb-6">
                                                        <span className="flex items-center gap-1.5">
                                                            <Users className="w-4 h-4 text-gray-300" />
                                                            0 guests
                                                        </span>
                                                        {/* Google Meet check */}
                                                        {event.title.toLowerCase().includes("meet") && (
                                                            <span className="flex items-center gap-1.5 text-green-600">
                                                                <Video className="w-4 h-4" />
                                                                Google Meet
                                                            </span>
                                                        )}
                                                    </div>

                                                    <Link href={`/calendar/events/${event.id}/manage`}>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="rounded-md font-semibold bg-gray-50 hover:bg-gray-100 border-gray-200/50 group/btn"
                                                        >
                                                            Manage Event
                                                            <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                                                        </Button>
                                                    </Link>
                                                </div>

                                                {/* Event Thumbnail */}
                                                <div className="w-full sm:w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-inner">
                                                    {event.image_url ? (
                                                        <img
                                                            src={event.image_url}
                                                            alt=""
                                                            className="w-full h-full object-cover grayscale-[0.2] transition-all group-hover:grayscale-0 group-hover:scale-105"
                                                        />
                                                    ) : (
                                                        <div className={`w-full h-full flex items-center justify-center opacity-20 ${colorClasses[event.color] || "bg-gray-200"}`}>
                                                            <Calendar className="w-12 h-12" />
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Event Floating Button (Mobile) */}
            <div className="fixed bottom-8 right-8 lg:hidden">
                <Link href="/calendar/events/new">
                    <Button size="icon" className="w-14 h-14 rounded-full shadow-2xl shadow-primary/30">
                        <Plus className="w-6 h-6" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}

