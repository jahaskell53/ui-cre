"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, MapPin, ArrowLeft, Trash2, Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Event {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    color: string;
    created_at: string;
}

const colorClasses: Record<string, string> = {
    black: "bg-gray-100 dark:bg-gray-800 border-gray-900 dark:border-gray-300",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500",
    green: "bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-500",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-600 dark:border-purple-500",
    red: "bg-red-50 dark:bg-red-900/20 border-red-600 dark:border-red-500",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-600 dark:border-orange-500",
};

export default function ManageEventsPage() {
    const router = useRouter();
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this event?")) return;

        setDeletingId(id);
        try {
            const response = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete event");
            setEvents(events.filter((e) => e.id !== id));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const upcomingEvents = events.filter((e) => new Date(e.start_time) >= new Date());
    const pastEvents = events.filter((e) => new Date(e.start_time) < new Date());

    return (
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/calendar">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="size-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Events</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your calendar events</p>
                        </div>
                    </div>
                    <Link href="/calendar/events/new">
                        <Button className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">
                            <Plus className="size-4 mr-2" />
                            Create Event
                        </Button>
                    </Link>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-gray-500 dark:text-gray-400">Loading events...</div>
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Calendar className="size-12 text-gray-300 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-gray-400">No events yet</p>
                        <Link href="/calendar/events/new">
                            <Button className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">
                                <Plus className="size-4 mr-2" />
                                Create Your First Event
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {upcomingEvents.length > 0 && (
                            <section>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                    Upcoming Events ({upcomingEvents.length})
                                </h2>
                                <div className="flex flex-col gap-3">
                                    {upcomingEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`border-l-4 rounded-lg p-4 shadow-sm ${colorClasses[event.color] || colorClasses.blue}`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                                        {event.title}
                                                    </h3>
                                                    {event.description && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {event.description}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="size-3" />
                                                            {formatDate(event.start_time)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="size-3" />
                                                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                                        </span>
                                                        {event.location && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="size-3" />
                                                                {event.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/calendar/events/${event.id}/edit`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <Edit className="size-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        onClick={() => handleDelete(event.id)}
                                                        disabled={deletingId === event.id}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {pastEvents.length > 0 && (
                            <section>
                                <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-4">
                                    Past Events ({pastEvents.length})
                                </h2>
                                <div className="flex flex-col gap-3 opacity-60">
                                    {pastEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`border-l-4 rounded-lg p-4 shadow-sm ${colorClasses[event.color] || colorClasses.blue}`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                                        {event.title}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="size-3" />
                                                            {formatDate(event.start_time)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="size-3" />
                                                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    onClick={() => handleDelete(event.id)}
                                                    disabled={deletingId === event.id}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
