"use client";

import { useState, useEffect } from "react";
import { useRouter as useNextRouter, useParams as useNextParams } from "next/navigation";
import { MapPin, Edit, Trash2, Check, Users, Calendar, ArrowLeft, Share2, ExternalLink } from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAuroraGradient, getInitials } from "@/app/(app)/people/utils";
import { useUser } from "@/hooks/use-user";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Event {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    meet_link: string | null;
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

const colorLabels: Record<string, { label: string; class: string; bgClass: string; colorClass: string }> = {
    black: { label: "Gray", class: "bg-gray-700", bgClass: "bg-gray-100 dark:bg-gray-800", colorClass: "text-gray-900 dark:text-gray-100" },
    blue: { label: "Blue", class: "bg-blue-500", bgClass: "bg-blue-50 dark:bg-blue-900/20", colorClass: "text-blue-600 dark:text-blue-400" },
    green: { label: "Green", class: "bg-green-500", bgClass: "bg-green-50 dark:bg-green-900/20", colorClass: "text-green-600 dark:text-green-400" },
    purple: { label: "Purple", class: "bg-purple-500", bgClass: "bg-purple-50 dark:bg-purple-900/20", colorClass: "text-purple-600 dark:text-purple-400" },
    red: { label: "Red", class: "bg-red-500", bgClass: "bg-red-50 dark:bg-red-900/20", colorClass: "text-red-600 dark:text-red-400" },
    orange: { label: "Orange", class: "bg-orange-500", bgClass: "bg-orange-50 dark:bg-orange-900/20", colorClass: "text-orange-600 dark:text-orange-400" },
};

export default function EventDetailsPage() {
    const router = useNextRouter();
    const params = useNextParams();
    const eventId = params.id as string;
    const { user } = useUser();

    const [event, setEvent] = useState<Event | null>(null);
    const [host, setHost] = useState<Host | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isShared, setIsShared] = useState(false);
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

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/calendar/events/${eventId}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: event?.title || "Check out this event!",
                    url: shareUrl,
                });
                return;
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    console.error("Error sharing:", err);
                }
            }
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            setIsShared(true);
            setTimeout(() => setIsShared(false), 2000);
        } catch (err) {
            console.error("Clipboard error:", err);
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

    const formatTimeRange = (start: string, end: string) => {
        const startTime = new Date(start).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
        const endTime = new Date(end).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
        });
        return `${startTime} - ${endTime}`;
    };

    const isPastEvent = event ? new Date(event.start_time) < new Date() : false;
    const isOwner = user && event && user.id === event.user_id;

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <div className="text-sm font-medium text-gray-500">Loading experience...</div>
                </div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
                <div className="max-w-md w-full text-center">
                    <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100">
                        {error || "Event not found"}
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/calendar")}
                        className="text-gray-500 hover:text-gray-900 group"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Calendar
                    </Button>
                </div>
            </div>
        );
    }

    const colorInfo = colorLabels[event.color] || colorLabels.blue;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 selection:bg-primary/10">
            {/* Minimal Header */}
            <header className="sticky top-0 z-50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.push("/calendar")}
                        className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 font-semibold px-3 hidden sm:flex"
                            onClick={handleShare}
                        >
                            {isShared ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                            {isShared ? "Copied" : "Share"}
                        </Button>
                        {isOwner && (
                            <Link href={`/calendar/events/${event.id}/edit`}>
                                <Button variant="outline" size="sm" className="rounded-md font-semibold border-gray-200 dark:border-gray-800 px-4">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                            </Link>
                        )}
                        <Link href={`/calendar/events/${event.id}/manage`}>
                            <Button variant="outline" size="sm" className="rounded-md font-semibold border-gray-200 dark:border-gray-800 px-4">
                                Manage
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-12 lg:gap-16">
                    {/* Left Column: Media & Host */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col gap-8"
                    >
                        {/* Event Image */}
                        <div className="relative aspect-square w-full rounded-md overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            {event.image_url ? (
                                <img
                                    src={event.image_url}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center ${colorInfo.bgClass}`}>
                                    <Calendar className={`w-20 h-20 ${colorInfo.colorClass} opacity-20`} />
                                </div>
                            )}
                        </div>

                        {/* Host Section */}
                        {host && (
                            <section className="flex flex-col gap-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Hosted By</h3>
                                <Link
                                    href={`/users/${host.id}`}
                                    className="flex items-center gap-4 group p-2 -m-2 rounded-md hover:bg-white dark:hover:bg-gray-900 transition-colors"
                                >
                                    <Avatar className="h-12 w-12 border-2 border-white dark:border-gray-800 shadow-sm">
                                        <AvatarImage src={host.avatar_url || undefined} alt={host.full_name || "Host"} />
                                        <AvatarFallback
                                            className="text-white text-sm font-semibold"
                                            style={{ background: generateAuroraGradient(host.full_name || "Host") }}
                                        >
                                            {getInitials(host.full_name || "Host")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-lg group-hover:underline">
                                            {host.full_name || "Unknown"}
                                        </span>
                                        <span className="text-sm text-gray-500">View Profile</span>
                                    </div>
                                </Link>
                            </section>
                        )}

                        {/* Guest List (Mobile optimization: shows below host on mobile) */}
                        <AnimatePresence>
                            {attendees.length > 0 && (
                                <section className="flex flex-col gap-4">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Attendees ({registrationCount})
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {attendees.slice(0, 12).map((attendee) => (
                                            <Link
                                                key={attendee.user_id}
                                                href={`/users/${attendee.user_id}`}
                                                className="transition-transform hover:scale-110"
                                            >
                                                <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-800 shadow-sm" title={attendee.full_name || ""}>
                                                    <AvatarImage src={attendee.avatar_url || undefined} alt={attendee.full_name || "Attendee"} />
                                                    <AvatarFallback
                                                        className="text-white text-xs font-medium"
                                                        style={{ background: generateAuroraGradient(attendee.full_name || "Attendee") }}
                                                    >
                                                        {getInitials(attendee.full_name || "Attendee")}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </Link>
                                        ))}
                                        {registrationCount > 12 && (
                                            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500">
                                                +{registrationCount - 12}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Right Column: Title & Registration */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-8"
                    >
                        <div className="flex flex-col gap-4">
                            {isPastEvent && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 self-start">
                                    Past Event
                                </span>
                            )}
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 balance-text">
                                {event.title}
                            </h1>
                        </div>

                        {/* Logistics Blocks */}
                        <div className="flex flex-col gap-6">
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center justify-center w-14 h-14 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shrink-0">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase leading-none mb-1">
                                        {getMonthAbbr(event.start_time)}
                                    </span>
                                    <span className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-none">
                                        {getDayNumber(event.start_time)}
                                    </span>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h2 className="font-semibold text-xl leading-tight">
                                        {formatDate(event.start_time)}
                                    </h2>
                                    <p className="text-gray-500 font-medium">
                                        {formatTimeRange(event.start_time, event.end_time)}
                                    </p>
                                </div>
                            </div>

                            {(event.location || event.meet_link) && (
                                <div className="flex gap-4">
                                    <div className="flex items-center justify-center w-14 h-14 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shrink-0">
                                        <MapPin className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <h2 className="font-semibold text-xl leading-tight">
                                            {event.location || "Online Event"}
                                        </h2>
                                        {event.location && (
                                            <p className="text-gray-500 font-medium">Physical Location</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Registration Card */}
                        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-6 md:p-8">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-xl">Registration</h3>
                                    {!isPastEvent && (
                                        <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                                            Open
                                        </span>
                                    )}
                                </div>

                                {!isPastEvent ? (
                                    <>
                                        <p className="text-gray-500 font-medium leading-relaxed">
                                            Welcome! To join the event, please RSVP below. You'll receive updates and be able to join the call.
                                        </p>
                                        <Button
                                            onClick={handleToggleRegistration}
                                            disabled={isRegistering}
                                            size="lg"
                                            className={`w-full h-14 text-lg font-semibold rounded-md transition-all ${isRegistered
                                                ? "bg-green-600 hover:bg-green-700 text-white"
                                                : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:scale-[1.02] active:scale-[0.98]"
                                                }`}
                                        >
                                            {isRegistering ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : isRegistered ? (
                                                <span className="flex items-center gap-2">
                                                    <Check className="w-5 h-5" />
                                                    Going
                                                </span>
                                            ) : (
                                                "RSVP"
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <p className="text-gray-500 font-medium italic">
                                        Registration is closed as this event has already taken place.
                                    </p>
                                )}

                                {/* Links Section inside Card */}
                                {isRegistered && event.meet_link && !isPastEvent && (
                                    <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
                                        <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Event Links</h4>
                                        <a
                                            href={event.meet_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-gray-900 rounded-md">
                                                    <SiGooglemeet className="w-5 h-5 text-[#00897B]" />
                                                </div>
                                                <span className="font-semibold">Join Google Meet</span>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* About Section */}
                        {event.description && (
                            <section className="mt-8">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-6 flex items-center gap-2">
                                    About Event
                                    <div className="h-px bg-gray-100 dark:bg-gray-800 flex-1 ml-2" />
                                </h3>
                                <div className="prose prose-lg dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-headings:font-semibold">
                                    <p className="whitespace-pre-wrap">{event.description}</p>
                                </div>
                            </section>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Delete Event Confirmation Modal */}
            <ModalOverlay
                isOpen={showDeleteModal}
                onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}
            >
                <Modal className="max-w-md bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <Dialog className="p-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center mb-6">
                                <Trash2 className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Event?</h2>
                            <p className="text-gray-500 font-medium mb-8">
                                Are you sure you want to delete <span className="text-gray-900 dark:text-gray-100 font-semibold">"{event?.title}"</span>? This action is permanent.
                            </p>
                            <div className="flex flex-col w-full gap-3">
                                <Button
                                    variant="destructive"
                                    size="lg"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="w-full h-14 rounded-md font-semibold"
                                >
                                    {isDeleting ? "Deleting..." : "Yes, Delete Event"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="lg"
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                    className="w-full h-14 rounded-md font-semibold text-gray-500"
                                >
                                    Keep Event
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
}

