"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MapPin, Edit, Trash2, Check, Users } from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAuroraGradient, getInitials } from "@/app/(app)/people/utils";
import Link from "next/link";

interface Event {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    color: string;
    image_url: string | null;
    user_id: string;
    created_at: string;
    updated_at: string;
}

interface Host {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
}

interface Attendee {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
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
    const [host, setHost] = useState<Host | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [registrationCount, setRegistrationCount] = useState(0);
    const [isRegistering, setIsRegistering] = useState(false);
    const [attendees, setAttendees] = useState<Attendee[]>([]);

    useEffect(() => {
        fetchEvent();
        fetchRegistrationStatus();
    }, [eventId]);

    const fetchRegistrationStatus = async () => {
        try {
            const response = await fetch(`/api/events/registrations?event_id=${eventId}&include_attendees=true`);
            if (response.ok) {
                const data = await response.json();
                setIsRegistered(data.is_registered);
                setRegistrationCount(data.count);
                setAttendees(data.attendees || []);
            }
        } catch (err) {
            console.error("Error fetching registration status:", err);
        }
    };

    const handleToggleRegistration = async () => {
        setIsRegistering(true);
        try {
            if (isRegistered) {
                const response = await fetch(`/api/events/registrations?event_id=${eventId}`, {
                    method: "DELETE",
                });
                if (response.ok) {
                    setIsRegistered(false);
                    setRegistrationCount((prev) => Math.max(0, prev - 1));
                    fetchRegistrationStatus();
                }
            } else {
                const response = await fetch("/api/events/registrations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ event_id: eventId }),
                });
                if (response.ok) {
                    setIsRegistered(true);
                    setRegistrationCount((prev) => prev + 1);
                    fetchRegistrationStatus();
                }
            }
        } catch (err) {
            console.error("Error toggling registration:", err);
        } finally {
            setIsRegistering(false);
        }
    };

    const fetchEvent = async () => {
        try {
            const response = await fetch(`/api/events?id=${eventId}`);
            if (!response.ok) throw new Error("Event not found");
            const data = await response.json();
            setEvent(data);
            
            // Fetch host profile
            if (data.user_id) {
                try {
                    const hostResponse = await fetch(`/api/users?id=${data.user_id}`);
                    if (hostResponse.ok) {
                        const hostData = await hostResponse.json();
                        setHost(hostData);
                    }
                } catch (err) {
                    console.error("Error fetching host:", err);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
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
        });
    };

    const getMonthAbbr = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    };

    const getDayNumber = (dateString: string) => {
        return new Date(dateString).getDate();
    };

    const formatTimeWithZone = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const getTimeZone = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
    };

    const isPastEvent = event ? new Date(event.start_time) < new Date() : false;

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error || "Event not found"}</div>
                    <button
                        onClick={() => router.push("/calendar")}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Back to Calendar
                    </button>
                </div>
            </div>
        );
    }

    const colorInfo = colorLabels[event.color] || colorLabels.blue;

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => router.push("/calendar")}
                    className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="flex items-center gap-2">
                    <Link href={`/calendar/events/${event.id}/edit`}>
                        <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors" title="Edit event">
                            <Edit className="w-5 h-5" />
                        </button>
                    </Link>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
                        title="Delete event"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="max-w-6xl mx-auto px-6 py-6">
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                        {/* Left Side - Image and Host */}
                        <div className="lg:w-80 lg:shrink-0">
                            {event.image_url && (
                                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-6">
                                    <img
                                        src={event.image_url}
                                        alt={event.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                            
                            {host && (
                                <div className="mt-6">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 pb-2 border-b border-gray-200 dark:border-gray-800">Hosted By</p>
                                    <Link 
                                        href={`/users/${host.id}`}
                                        className="flex items-center gap-3 group"
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={host.avatar_url || undefined} alt={host.full_name || "Host"} />
                                            <AvatarFallback
                                                className="text-white text-sm font-medium"
                                                style={{ background: generateAuroraGradient(host.full_name || "Host") }}
                                            >
                                                {getInitials(host.full_name || "Host")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:underline leading-tight">
                                            {host.full_name || "Unknown"}
                                        </span>
                                    </Link>
                                </div>
                            )}
                        </div>
                        
                        {/* Right Side - Content */}
                        <div className="flex-1 min-w-0">
                            <div className={`border-l-4 rounded-lg p-6 ${colorInfo.bgClass}`}>
                                {isPastEvent && (
                                    <div className="mb-4">
                                        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                            Past Event
                                        </span>
                                    </div>
                                )}
                                <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                                    {event.title}
                                </h1>

                                <div className="flex items-center gap-4 mb-8">
                                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-none mb-1">
                                            {getMonthAbbr(event.start_time)}
                                        </span>
                                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                                            {getDayNumber(event.start_time)}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                                            {formatDate(event.start_time)}
                                        </h2>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                                            {formatTimeWithZone(event.start_time)} - {formatTimeWithZone(event.end_time)} {getTimeZone(event.start_time)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {event.location && (
                                        <div className="flex items-center gap-4">
                                            {event.location.includes('meet.google.com') || event.location.includes('meet') ? (
                                                <>
                                                    <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
                                                        <SiGooglemeet className="size-6 text-gray-600 dark:text-gray-300" />
                                                    </div>
                                                    <div>
                                                        <a
                                                            href={event.location.startsWith('http') ? event.location : `https://${event.location}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xl font-bold text-gray-900 dark:text-gray-100 hover:underline leading-tight"
                                                        >
                                                            Google Meet
                                                        </a>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <MapPin className="size-5 text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-gray-100">
                                                            {event.location}
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* RSVP Section */}
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                            <Users className="size-4" />
                                            <span>{registrationCount} {registrationCount === 1 ? 'person' : 'people'} {isPastEvent ? 'attended' : 'going'}</span>
                                        </div>
                                        {!isPastEvent && (
                                            <Button
                                                onClick={handleToggleRegistration}
                                                disabled={isRegistering}
                                                className={isRegistered
                                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                                    : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                                                }
                                            >
                                                {isRegistering ? (
                                                    "..."
                                                ) : isRegistered ? (
                                                    <>
                                                        <Check className="size-4 mr-2" />
                                                        Going
                                                    </>
                                                ) : (
                                                    "RSVP"
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                    {attendees.length > 0 && (
                                        <div className="mt-4">
                                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Attendees</h3>
                                            <div className="flex flex-wrap gap-3">
                                                {attendees.map((attendee) => (
                                                    <Link
                                                        key={attendee.user_id}
                                                        href={`/users/${attendee.user_id}`}
                                                        className="flex items-center gap-2 group"
                                                    >
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={attendee.avatar_url || undefined} alt={attendee.full_name || "Attendee"} />
                                                            <AvatarFallback
                                                                className="text-white text-xs font-medium"
                                                                style={{ background: generateAuroraGradient(attendee.full_name || "Attendee") }}
                                                            >
                                                                {getInitials(attendee.full_name || "Attendee")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:underline">
                                                            {attendee.full_name || "Unknown"}
                                                        </span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {event.description && (
                                <div className="mt-6">
                                    <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 pb-2 border-b border-gray-200 dark:border-gray-800">About Event</h2>
                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-4">
                                        {event.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Event Confirmation Modal */}
            <ModalOverlay
                isOpen={showDeleteModal}
                onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}
            >
                <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
                    <Dialog className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Event</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Are you sure you want to delete "{event?.title}"? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete Event"}
                            </Button>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
}
