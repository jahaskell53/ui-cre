"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, Clock, MapPin, ArrowLeft, Edit, Trash2, FileText } from "lucide-react";
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
    updated_at: string;
}

const colorLabels: Record<string, { label: string; class: string; bgClass: string }> = {
    black: { label: "Gray", class: "bg-gray-700", bgClass: "bg-gray-100 dark:bg-gray-800 border-gray-900 dark:border-gray-300" },
    blue: { label: "Blue", class: "bg-blue-500", bgClass: "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500" },
    green: { label: "Green", class: "bg-green-500", bgClass: "bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-500" },
    purple: { label: "Purple", class: "bg-purple-500", bgClass: "bg-purple-50 dark:bg-purple-900/20 border-purple-600 dark:border-purple-500" },
    red: { label: "Red", class: "bg-red-500", bgClass: "bg-red-50 dark:bg-red-900/20 border-red-600 dark:border-red-500" },
    orange: { label: "Orange", class: "bg-orange-500", bgClass: "bg-orange-50 dark:bg-orange-900/20 border-orange-600 dark:border-orange-500" },
};

export default function EventDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchEvent();
    }, [eventId]);

    const fetchEvent = async () => {
        try {
            const response = await fetch(`/api/events?id=${eventId}`);
            if (!response.ok) throw new Error("Event not found");
            const data = await response.json();
            setEvent(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this event?")) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete event");
            router.push("/calendar");
        } catch (err: any) {
            setError(err.message);
            setIsDeleting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
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

    const isPastEvent = event ? new Date(event.start_time) < new Date() : false;

    if (isLoading) {
        return (
            <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
                <div className="flex items-center justify-center py-12">
                    <div className="text-gray-500 dark:text-gray-400">Loading event...</div>
                </div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
                <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">
                    <div className="flex items-center gap-4">
                        <Link href="/calendar">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="size-5" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Event Not Found</h1>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm text-red-600 dark:text-red-400">{error || "This event does not exist or you don't have permission to view it."}</p>
                    </div>
                    <Link href="/calendar">
                        <Button variant="outline">Back to Calendar</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const colorInfo = colorLabels[event.color] || colorLabels.blue;

    return (
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/calendar">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="size-5" />
                            </Button>
                        </Link>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Event Details</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={`/calendar/events/${event.id}/edit`}>
                            <Button variant="outline" size="sm">
                                <Edit className="size-4 mr-2" />
                                Edit
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 className="size-4 mr-2" />
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </div>
                </div>

                <div className={`border-l-4 rounded-xl p-6 ${colorInfo.bgClass}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-3 h-3 rounded-full ${colorInfo.class}`} />
                                {isPastEvent && (
                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                        Past Event
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                                {event.title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <Calendar className="size-5 text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {formatDate(event.start_time)}
                                </p>
                                {formatDate(event.start_time) !== formatDate(event.end_time) && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        to {formatDate(event.end_time)}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Clock className="size-5 text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {(() => {
                                        const start = new Date(event.start_time);
                                        const end = new Date(event.end_time);
                                        const durationMs = end.getTime() - start.getTime();
                                        const hours = Math.floor(durationMs / (1000 * 60 * 60));
                                        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                                        if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
                                        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
                                        return `${minutes} minutes`;
                                    })()}
                                </p>
                            </div>
                        </div>

                        {event.location && (
                            <div className="flex items-start gap-3">
                                <MapPin className="size-5 text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                        {event.location}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {event.description && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="size-5 text-gray-500 dark:text-gray-400" />
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Description</h2>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {event.description}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
