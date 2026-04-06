"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, Check, Edit, ExternalLink, MapPin, Share2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useParams as useNextParams, useRouter as useNextRouter } from "next/navigation";
import { SiGooglemeet } from "react-icons/si";
import { generateAuroraGradient, getInitials } from "@/app/(app)/network/utils";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";

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
        if (!user) {
            router.push(`/signup?redirect=/events/${eventId}`);
            return;
        }

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
            router.push("/events");
        } catch (err: any) {
            setError(err.message);
            setIsDeleting(false);
        }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/events/${eventId}`;

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
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                    <div className="text-sm font-medium text-gray-500">Loading experience...</div>
                </div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
                <div className="w-full max-w-md text-center">
                    <div className="mb-6 rounded-md border border-gray-200 bg-white p-4 font-medium text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
                        {error || "Event not found"}
                    </div>
                    <Button variant="ghost" onClick={() => router.push("/events")} className="group text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to Events
                    </Button>
                </div>
            </div>
        );
    }

    const colorInfo = colorLabels[event.color] || colorLabels.blue;

    return (
        <div className="min-h-screen bg-white text-gray-900 selection:bg-primary/10 dark:bg-gray-900 dark:text-gray-100">
            {/* Minimal Header */}
            <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/50 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/50">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                    <button
                        onClick={() => router.push("/events")}
                        className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="hidden px-3 font-semibold text-gray-500 sm:flex" onClick={handleShare}>
                            {isShared ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                            {isShared ? "Copied" : "Share"}
                        </Button>
                        {isOwner && (
                            <>
                                <Link href={`/events/${event.id}/edit`}>
                                    <Button variant="outline" size="sm" className="rounded-md border-gray-200 px-4 font-semibold dark:border-gray-800">
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit
                                    </Button>
                                </Link>
                                <Link href={`/events/${event.id}/manage`}>
                                    <Button variant="outline" size="sm" className="rounded-md border-gray-200 px-4 font-semibold dark:border-gray-800">
                                        Manage
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-[380px_1fr] lg:gap-16">
                    {/* Left Column: Media & Host */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-8">
                        {/* Event Image */}
                        <div className="relative aspect-square w-full overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                            {event.image_url ? (
                                <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
                            ) : (
                                <div className={`flex h-full w-full items-center justify-center ${colorInfo.bgClass}`}>
                                    <Calendar className={`h-20 w-20 ${colorInfo.colorClass} opacity-20`} />
                                </div>
                            )}
                        </div>

                        {/* Host Section */}
                        {host && (
                            <section className="flex flex-col gap-4">
                                <h3 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Hosted By</h3>
                                <Link
                                    href={`/users/${host.id}`}
                                    className="group -m-2 flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-white dark:hover:bg-gray-900"
                                >
                                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm dark:border-gray-800">
                                        <AvatarImage src={host.avatar_url || undefined} alt={host.full_name || "Host"} />
                                        <AvatarFallback
                                            className="text-sm font-semibold text-white"
                                            style={{ background: generateAuroraGradient(host.full_name || "Host") }}
                                        >
                                            {getInitials(host.full_name || "Host")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-semibold group-hover:underline">{host.full_name || "Unknown"}</span>
                                        <span className="text-sm text-gray-500">View Profile</span>
                                    </div>
                                </Link>
                            </section>
                        )}

                        {/* Guest List (Mobile optimization: shows below host on mobile) */}
                        <AnimatePresence>
                            {attendees.length > 0 && (
                                <section className="flex flex-col gap-4">
                                    <h3 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Attendees ({registrationCount})</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {attendees.slice(0, 12).map((attendee) => (
                                            <Link key={attendee.user_id} href={`/users/${attendee.user_id}`} className="transition-transform hover:scale-110">
                                                <Avatar
                                                    className="h-10 w-10 border-2 border-white shadow-sm dark:border-gray-800"
                                                    title={attendee.full_name || ""}
                                                >
                                                    <AvatarImage src={attendee.avatar_url || undefined} alt={attendee.full_name || "Attendee"} />
                                                    <AvatarFallback
                                                        className="text-xs font-medium text-white"
                                                        style={{ background: generateAuroraGradient(attendee.full_name || "Attendee") }}
                                                    >
                                                        {getInitials(attendee.full_name || "Attendee")}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </Link>
                                        ))}
                                        {registrationCount > 12 && (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800">
                                                +{registrationCount - 12}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Right Column: Title & Registration */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8">
                        <div className="flex flex-col gap-4">
                            {isPastEvent && (
                                <span className="inline-flex items-center self-start rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                                    Past Event
                                </span>
                            )}
                            <h1 className="balance-text text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl lg:text-6xl dark:text-gray-100">
                                {event.title}
                            </h1>
                        </div>

                        {/* Logistics Blocks */}
                        <div className="flex flex-col gap-6">
                            <div className="flex gap-4">
                                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                    <span className="mb-1 text-[10px] leading-none font-semibold text-gray-400 uppercase">
                                        {getMonthAbbr(event.start_time)}
                                    </span>
                                    <span className="text-xl leading-none font-semibold text-gray-900 dark:text-gray-100">
                                        {getDayNumber(event.start_time)}
                                    </span>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h2 className="text-xl leading-tight font-semibold">{formatDate(event.start_time)}</h2>
                                    <p className="font-medium text-gray-500">{formatTimeRange(event.start_time, event.end_time)}</p>
                                </div>
                            </div>

                            {(event.location || event.meet_link) && (
                                <div className="flex gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                        {event.meet_link && !event.location ? (
                                            <SiGooglemeet className="h-6 w-6 text-[#00897B]" />
                                        ) : (
                                            <MapPin className="h-6 w-6 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        {event.meet_link && !event.location ? (
                                            <a
                                                href={event.meet_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xl leading-tight font-semibold text-[#00897B] hover:underline"
                                            >
                                                Join Google Meet
                                            </a>
                                        ) : (
                                            <h2 className="text-xl leading-tight font-semibold">{event.location || "Online Event"}</h2>
                                        )}
                                        {event.location && <p className="font-medium text-gray-500">Physical Location</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Registration Card */}
                        <div className="rounded-md border border-gray-200 bg-white p-6 md:p-8 dark:border-gray-800 dark:bg-gray-900">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-semibold">Registration</h3>
                                    {!isPastEvent && <span className="rounded-md bg-green-50 px-2 py-1 text-sm font-semibold text-green-600">Open</span>}
                                </div>

                                {!isPastEvent ? (
                                    <>
                                        <p className="leading-relaxed font-medium text-gray-500">
                                            {user
                                                ? "Welcome! To join the event, please RSVP below. You'll receive updates and be able to join the call."
                                                : "Welcome! To RSVP for this event, please create an account or sign in."}
                                        </p>
                                        <Button
                                            onClick={handleToggleRegistration}
                                            disabled={isRegistering}
                                            size="lg"
                                            className={`h-14 w-full rounded-md text-lg font-semibold transition-all ${
                                                isRegistered
                                                    ? "bg-green-600 text-white hover:bg-green-700"
                                                    : "bg-gray-900 text-white hover:scale-[1.02] active:scale-[0.98] dark:bg-white dark:text-gray-900"
                                            }`}
                                        >
                                            {isRegistering ? (
                                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            ) : isRegistered ? (
                                                <span className="flex items-center gap-2">
                                                    <Check className="h-5 w-5" />
                                                    Going
                                                </span>
                                            ) : user ? (
                                                "RSVP"
                                            ) : (
                                                "Sign in to RSVP"
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <p className="font-medium text-gray-500 italic">Registration is closed as this event has already taken place.</p>
                                )}
                            </div>
                        </div>

                        {/* About Section */}
                        {event.description && (
                            <section className="mt-8">
                                <h3 className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                                    About Event
                                    <div className="ml-2 h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                                </h3>
                                <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-p:text-gray-600 dark:prose-p:text-gray-400">
                                    <p className="whitespace-pre-wrap">{event.description}</p>
                                </div>
                            </section>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Delete Event Confirmation Modal */}
            <ModalOverlay isOpen={showDeleteModal} onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}>
                <Modal className="max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Event</h2>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">"{event?.title}"</span>? This
                            action is permanent.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? "Deleting..." : "Delete Event"}
                            </Button>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
}
