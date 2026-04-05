"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, ChevronRight, Clock, Edit, Eye, MapPin, Plus, Search, Trash2, Users, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
            weekday: isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "long" }),
        };
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const filteredEvents = events
        .filter((e) => {
            const isPast = new Date(e.start_time) < new Date();
            return activeTab === "upcoming" ? !isPast : isPast;
        })
        .sort((a, b) => {
            const dateA = new Date(a.start_time).getTime();
            const dateB = new Date(b.start_time).getTime();
            return activeTab === "upcoming" ? dateA - dateB : dateB - dateA;
        });

    // Grouping events by date string
    const groupedEvents = filteredEvents.reduce(
        (acc, event) => {
            const dateStr = new Date(event.start_time).toDateString();
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(event);
            return acc;
        },
        {} as Record<string, Event[]>,
    );

    return (
        <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="border-b border-gray-200 dark:border-gray-800">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
                    <button
                        onClick={() => router.push("/events")}
                        className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Events</h1>
                    <div className="w-9" /> {/* Spacer for centering */}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="mx-auto max-w-4xl px-6 py-12">
                    {/* Header Section */}
                    <div className="mb-12 flex items-center justify-between">
                        <div></div>
                        <div className="flex items-center gap-6">
                            {/* Tabs */}
                            <div className="flex rounded-md bg-gray-100 p-1 dark:bg-gray-900">
                                <button
                                    onClick={() => setActiveTab("upcoming")}
                                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
                                        activeTab === "upcoming"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                                            : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                                    }`}
                                >
                                    Upcoming
                                </button>
                                <button
                                    onClick={() => setActiveTab("past")}
                                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
                                        activeTab === "past"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                                            : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                                    }`}
                                >
                                    Past
                                </button>
                            </div>
                            {/* Create New Button */}
                            <Link href="/events/new">
                                <Button className="hidden bg-gray-900 text-white hover:bg-gray-800 lg:flex dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                                    <Plus className="size-4" />
                                    Create New
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                            <p className="text-sm font-medium text-gray-400">Loading your events...</p>
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-center">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                <Calendar className="h-10 w-10 text-gray-300" />
                            </div>
                            <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">No {activeTab} events</h2>
                            <p className="mb-8 font-medium text-gray-500">Ready to host a webinar?</p>
                            <Link href="/events/new">
                                <Button size="lg" className="h-12 rounded-md px-8 font-semibold">
                                    <Plus className="mr-2 h-5 w-5" />
                                    Create Event
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {Object.entries(groupedEvents).map(([dateStr, dateEvents], groupIdx) => (
                                <div key={dateStr} className="relative">
                                    {/* Timeline Group Container */}
                                    <div className="grid grid-cols-[120px_1fr] gap-4 md:grid-cols-[160px_1fr] md:gap-8">
                                        {/* Date Label (Stays on left) */}
                                        <div className="relative flex flex-col items-end border-r-2 border-gray-200 pt-4 pr-4 dark:border-gray-800">
                                            <div className="text-right text-lg leading-tight font-semibold text-gray-900 dark:text-gray-100">
                                                {formatDateHeading(dateStr).monthDay}
                                            </div>
                                            <div className="text-right text-sm font-semibold text-gray-400 capitalize">
                                                {formatDateHeading(dateStr).weekday}
                                            </div>
                                            {/* Dot on timeline */}
                                            <div className="absolute top-6 -right-[7px] z-10 h-3 w-3 rounded-full border-2 border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-800" />
                                        </div>

                                        {/* Events for this date */}
                                        <div className="space-y-6 pb-4">
                                            {dateEvents.map((event, eventIdx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: eventIdx * 0.05 }}
                                                    key={event.id}
                                                    className="group relative flex flex-col gap-6 rounded-md border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm sm:flex-row dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-2 flex items-center gap-3 text-xs font-semibold tracking-tight text-gray-400 uppercase">
                                                            <span>{formatTime(event.start_time)}</span>
                                                            {event.location && (
                                                                <>
                                                                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                                                                    <span className="flex items-center gap-1">
                                                                        <MapPin className="h-3 w-3" />
                                                                        {event.location}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>

                                                        <h3 className="mb-3 text-xl font-semibold text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
                                                            {event.title}
                                                        </h3>

                                                        <div className="mb-6 flex items-center gap-4 text-sm font-semibold text-gray-500">
                                                            <span className="flex items-center gap-1.5">
                                                                <Users className="h-4 w-4 text-gray-300" />0 guests
                                                            </span>
                                                            {/* Google Meet check */}
                                                            {event.title.toLowerCase().includes("meet") && (
                                                                <span className="flex items-center gap-1.5 text-green-600">
                                                                    <Video className="h-4 w-4" />
                                                                    Google Meet
                                                                </span>
                                                            )}
                                                        </div>

                                                        <Link href={`/events/${event.id}/manage`}>
                                                            <Button variant="secondary" size="sm" className="group/btn rounded-md font-semibold">
                                                                Manage Event
                                                                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                                                            </Button>
                                                        </Link>
                                                    </div>

                                                    {/* Event Thumbnail */}
                                                    <div className="h-32 w-full shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white sm:w-32 md:h-40 md:w-40 dark:border-gray-800 dark:bg-gray-900">
                                                        {event.image_url ? (
                                                            <img
                                                                src={event.image_url}
                                                                alt=""
                                                                className="h-full w-full object-cover grayscale-[0.2] transition-all group-hover:scale-105 group-hover:grayscale-0"
                                                            />
                                                        ) : (
                                                            <div
                                                                className={`flex h-full w-full items-center justify-center opacity-20 ${colorClasses[event.color] || "bg-gray-200"}`}
                                                            >
                                                                <Calendar className="h-12 w-12" />
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
            </div>

            {/* Create Event Floating Button (Mobile) */}
            <div className="fixed right-8 bottom-8 lg:hidden">
                <Link href="/events/new">
                    <Button size="icon" className="h-14 w-14 rounded-full">
                        <Plus className="h-6 w-6" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
