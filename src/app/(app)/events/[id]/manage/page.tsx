"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeft,
    BarChart3,
    Calendar,
    Check,
    ChevronRight,
    Edit,
    ExternalLink,
    Eye,
    Image as ImageIcon,
    Loader2,
    Mail,
    MapPin,
    MoreHorizontal,
    Plus,
    Share2,
    Trash2,
    Users,
    Video,
    X,
} from "lucide-react";
import Link from "next/link";
import { useParams as useNextParams, useRouter as useNextRouter } from "next/navigation";
import { SiGooglemeet } from "react-icons/si";
import { generateAuroraGradient, getInitials } from "@/app/(app)/network/utils";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { InviteGuestsModal } from "@/components/events/invite-guests-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-user";

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
}

interface Host {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
}

interface Attendee {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
}

interface Blast {
    id: string;
    event_id: string;
    user_id: string;
    subject: string;
    message: string;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
}

interface Invite {
    id: string;
    event_id: string;
    user_id: string;
    message: string | null;
    recipient_count: number;
    recipient_emails?: string[] | null;
    created_at: string;
}

export default function EventManageDashboard() {
    const router = useNextRouter();
    const params = useNextParams();
    const eventId = params.id as string;
    const { user } = useUser();

    const [event, setEvent] = useState<Event | null>(null);
    const [host, setHost] = useState<Host | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUnauthorized, setIsUnauthorized] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isShared, setIsShared] = useState(false);
    const [activeTab, setActiveTab] = useState("Overview");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [registrationCount, setRegistrationCount] = useState(0);
    const [isLoadingGuests, setIsLoadingGuests] = useState(false);
    const [blasts, setBlasts] = useState<Blast[]>([]);
    const [isLoadingBlasts, setIsLoadingBlasts] = useState(false);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [isLoadingInvites, setIsLoadingInvites] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (eventId) {
            fetchEventDetails();
        }
    }, [eventId]);

    useEffect(() => {
        if (eventId && activeTab === "Guests") {
            fetchGuests();
        }
    }, [eventId, activeTab]);

    useEffect(() => {
        if (eventId && activeTab === "Blasts") {
            fetchBlasts();
        }
    }, [eventId, activeTab]);

    useEffect(() => {
        if (eventId) {
            fetchInvites();
        }
    }, [eventId]);

    const fetchEventDetails = async () => {
        try {
            const response = await fetch(`/api/events?id=${eventId}`);
            if (!response.ok) throw new Error("Failed to fetch event");
            const data = await response.json();
            setEvent(data);

            // Check if current user is the owner
            if (user && data.user_id !== user.id) {
                setIsUnauthorized(true);
                setIsLoading(false);
                return;
            }

            // Fetch host profile
            if (data.user_id) {
                try {
                    const hostResponse = await fetch(`/api/users?id=${data.user_id}`);
                    if (hostResponse.ok) {
                        const hostData = await hostResponse.json();
                        setHost({
                            id: hostData.id,
                            name: hostData.full_name || "Unknown",
                            email: hostData.email || "",
                            avatar_url: hostData.avatar_url,
                        });
                    }
                } catch (err) {
                    console.error("Error fetching host:", err);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !event) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            // 1. Upload to S3 via API
            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) throw new Error("Failed to upload image");
            const { url } = await uploadRes.json();

            // 2. Update event in database
            const updateRes = await fetch(`/api/events?id=${eventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_url: url }),
            });

            if (!updateRes.ok) throw new Error("Failed to update event image");

            // 3. Update local state
            setEvent({ ...event, image_url: url });
        } catch (err) {
            console.error("Error updating photo:", err);
            alert("Failed to update photo. Please try again.");
        } finally {
            setIsUploading(false);
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
                // User cancelled or error, fall through to clipboard
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
    };

    const handleInviteSuccess = () => {
        fetchInvites();
        // Refresh guests list if on Guests tab
        if (activeTab === "Guests") {
            fetchGuests();
        }
    };

    const fetchGuests = async () => {
        setIsLoadingGuests(true);
        try {
            const response = await fetch(`/api/events/registrations?event_id=${eventId}&include_attendees=true`);
            if (response.ok) {
                const data = await response.json();
                setAttendees(data.attendees || []);
                setRegistrationCount(data.count || 0);
            }
        } catch (err) {
            console.error("Error fetching guests:", err);
        } finally {
            setIsLoadingGuests(false);
        }
    };

    const fetchBlasts = async () => {
        setIsLoadingBlasts(true);
        try {
            const response = await fetch(`/api/events/${eventId}/blasts`);
            if (response.ok) {
                const data = await response.json();
                setBlasts(data || []);
            }
        } catch (err) {
            console.error("Error fetching blasts:", err);
        } finally {
            setIsLoadingBlasts(false);
        }
    };

    const fetchInvites = async () => {
        setIsLoadingInvites(true);
        try {
            const response = await fetch(`/api/events/${eventId}/invites`);
            if (response.ok) {
                const data = await response.json();
                setInvites(data || []);
            }
        } catch (err) {
            console.error("Error fetching invites:", err);
        } finally {
            setIsLoadingInvites(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete event");
            router.push("/events/manage");
        } catch (err: any) {
            console.error("Error deleting event:", err);
            alert("Failed to delete event. Please try again.");
            setIsDeleting(false);
        }
    };

    if (isLoading)
        return (
            <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            </div>
        );

    if (isUnauthorized || !event) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-gray-900">
                <div className="w-full max-w-md text-center">
                    <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Access Denied</h1>
                    <p className="mb-6 text-gray-500 dark:text-gray-400">
                        You don't have permission to manage this event. Only the event host can access this page.
                    </p>
                    <div className="flex justify-center gap-3">
                        <Button variant="outline" onClick={() => router.push(`/events/${eventId}`)} className="rounded-md font-semibold">
                            View Event
                        </Button>
                        <Button variant="secondary" onClick={() => router.push("/events")} className="rounded-md font-semibold">
                            Back to Calendar
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const tabs = ["Overview", "Guests", "Blasts"];

    return (
        <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <button
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Event</h1>
                <div className="w-9" /> {/* Spacer for centering */}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white pb-20 dark:bg-gray-900">
                <div className="mx-auto max-w-5xl px-6 pt-12">
                    <div className="mb-8 flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl leading-tight font-semibold text-gray-900 dark:text-gray-100">{event.title}</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="destructive" onClick={() => setShowDeleteModal(true)} disabled={isDeleting} className="rounded-md font-semibold">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                            <Link href={`/events/${event.id}`}>
                                <Button
                                    variant="outline"
                                    className="gap-2 rounded-md border-gray-200 bg-white font-semibold dark:border-gray-800 dark:bg-gray-900"
                                >
                                    Event Page
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mb-10 scrollbar-hide flex items-center gap-8 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative pb-4 text-sm font-semibold transition-all ${
                                    activeTab === tab ? "text-gray-900 dark:text-gray-100" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div layoutId="activeTab" className="absolute right-0 bottom-0 left-0 h-0.5 bg-gray-900 dark:bg-gray-100" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Quick Actions Card Grid */}
                    <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="group flex items-center gap-4 rounded-md border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-white text-blue-600 dark:border-gray-800 dark:bg-gray-900">
                                <Plus className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 dark:text-white">Invite Guests</div>
                            </div>
                        </button>
                        <Link href={`/events/${eventId}/send-blast`}>
                            <button className="flex w-full items-center gap-4 rounded-md border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
                                <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-white text-purple-600 dark:border-gray-800 dark:bg-gray-900">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-900 dark:text-white">Send a Blast</div>
                                </div>
                            </button>
                        </Link>
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-4 rounded-md border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-white text-pink-600 dark:border-gray-800 dark:bg-gray-900">
                                {isShared ? <Check className="h-6 w-6" /> : <Share2 className="h-6 w-6" />}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 dark:text-white">{isShared ? "Link Copied!" : "Share Event"}</div>
                            </div>
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div>
                        {activeTab === "Overview" && (
                            <div className="space-y-8">
                                {/* Summary Card */}
                                <div className="flex gap-8 rounded-md border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
                                    <div className="group relative h-48 w-48 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                        {event.image_url ? (
                                            <img src={event.image_url} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-white text-gray-200 dark:bg-gray-900">
                                                <ImageIcon className="h-12 w-12" />
                                            </div>
                                        )}
                                        {isUploading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-6">
                                        <div>
                                            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">When & Where</h3>
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                                        <div className="mb-0.5 text-[10px] leading-none font-semibold text-gray-400 uppercase">JAN</div>
                                                        <div className="text-lg leading-none font-semibold text-gray-900">24</div>
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-white">{formatDate(event.start_time)}</div>
                                                        <div className="text-sm font-semibold text-gray-500">
                                                            {formatTimeRange(event.start_time, event.end_time)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-4">
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                                        <Video className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-white">Google Meet</div>
                                                        <div className="max-w-[200px] cursor-pointer truncate text-sm font-semibold text-blue-600 hover:underline">
                                                            https://meet.google.com/qhn-fjrm-mos
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Link href={`/events/${event.id}/edit`}>
                                                <Button variant="secondary" className="rounded-md px-6 font-semibold">
                                                    Edit Event
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="secondary"
                                                className="rounded-md px-6 font-semibold"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                            >
                                                {isUploading ? "Uploading..." : "Change Photo"}
                                            </Button>
                                            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                                        </div>
                                    </div>
                                </div>

                                {/* Hosts Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Hosts</h3>
                                        <Button variant="secondary" size="sm" className="rounded-md bg-gray-100 font-semibold">
                                            <Plus className="mr-1.5 h-4 w-4" />
                                            Add Host
                                        </Button>
                                    </div>
                                    <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                        {host && (
                                            <div className="flex items-center justify-between p-2">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                        <AvatarImage src={host.avatar_url || ""} />
                                                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                                            {getInitials(host.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{host.name}</div>
                                                        <div className="text-xs font-semibold text-gray-400">Primary Host</div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="rounded-md text-gray-400">
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "Guests" && (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Guests</h2>
                                        <p className="mt-1 text-sm font-semibold text-gray-400">
                                            {registrationCount} {registrationCount === 1 ? "guest" : "guests"} registered
                                        </p>
                                    </div>
                                    <Button variant="secondary" className="rounded-md bg-gray-100 font-semibold" onClick={() => setShowInviteModal(true)}>
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        Invite Guests
                                    </Button>
                                </div>

                                {/* Invites sent - same card design as Overview */}
                                {invites.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invites sent</h3>
                                        <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {invites.map((invite) => {
                                                    const sentDate = new Date(invite.created_at);
                                                    const formattedDate = sentDate.toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    });
                                                    const formattedTime = sentDate.toLocaleTimeString("en-US", {
                                                        hour: "numeric",
                                                        minute: "2-digit",
                                                    });
                                                    const emails = invite.recipient_emails ?? [];
                                                    return (
                                                        <div
                                                            key={invite.id}
                                                            className="flex flex-col p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                {emails.length > 0 ? (
                                                                    <ul className="space-y-0.5 text-sm text-gray-900 dark:text-white">
                                                                        {emails.map((email) => (
                                                                            <li key={email} className="truncate">
                                                                                {email}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                        {invite.recipient_count} recipient{invite.recipient_count === 1 ? "" : "s"}
                                                                    </div>
                                                                )}
                                                                {invite.message && (
                                                                    <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                                                                        {invite.message}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 text-right text-sm font-semibold text-gray-400">
                                                                {formattedDate} at {formattedTime}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isLoadingGuests ? (
                                    <div className="flex items-center justify-center rounded-md border border-gray-200 bg-white p-12 dark:border-gray-800 dark:bg-gray-900">
                                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                                    </div>
                                ) : attendees.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-md border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                            <Users className="h-8 w-8 text-gray-200" />
                                        </div>
                                        <div className="mb-1 font-semibold text-gray-900 dark:text-white">No Guests Yet</div>
                                        <p className="mb-6 text-sm font-semibold text-gray-400">Invite people to your event to see them here.</p>
                                        <Button variant="secondary" className="rounded-md font-semibold" onClick={() => setShowInviteModal(true)}>
                                            <Plus className="mr-1.5 h-4 w-4" />
                                            Invite Guests
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {attendees.map((attendee) => (
                                                <div
                                                    key={attendee.user_id}
                                                    className="flex items-center justify-between p-4 transition-colors hover:bg-white dark:hover:bg-gray-900"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Link href={`/users/${attendee.user_id}`}>
                                                            <Avatar className="h-12 w-12 cursor-pointer border-2 border-white shadow-sm transition-transform hover:scale-105 dark:border-gray-800">
                                                                <AvatarImage src={attendee.avatar_url || ""} />
                                                                <AvatarFallback
                                                                    className="text-sm font-semibold text-white"
                                                                    style={{ background: generateAuroraGradient(attendee.full_name || "Guest") }}
                                                                >
                                                                    {getInitials(attendee.full_name || "Guest")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </Link>
                                                        <div>
                                                            <div className="font-semibold text-gray-900 dark:text-white">{attendee.full_name || "Guest"}</div>
                                                            <div className="text-xs font-semibold text-gray-400">Registered</div>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="rounded-md text-gray-400">
                                                        <MoreHorizontal className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "Blasts" && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Email Blasts</h2>
                                        <p className="mt-1 text-sm font-semibold text-gray-400">Send messages to all registered attendees</p>
                                    </div>
                                    <Link href={`/events/${eventId}/send-blast`}>
                                        <Button variant="secondary" className="rounded-md bg-gray-100 font-semibold">
                                            <Mail className="mr-1.5 h-4 w-4" />
                                            Send a Blast
                                        </Button>
                                    </Link>
                                </div>

                                {isLoadingBlasts ? (
                                    <div className="flex items-center justify-center rounded-md border border-gray-200 bg-white p-12 dark:border-gray-800 dark:bg-gray-900">
                                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                                    </div>
                                ) : blasts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-md border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                            <Mail className="h-8 w-8 text-gray-200" />
                                        </div>
                                        <div className="mb-1 font-semibold text-gray-900 dark:text-white">No Blasts Sent Yet</div>
                                        <p className="mb-6 text-sm font-semibold text-gray-400">Send your first email blast to all registered attendees.</p>
                                        <Link href={`/events/${eventId}/send-blast`}>
                                            <Button variant="secondary" className="rounded-md font-semibold">
                                                <Mail className="mr-1.5 h-4 w-4" />
                                                Send a Blast
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {blasts.map((blast) => {
                                                const sentDate = new Date(blast.created_at);
                                                const formattedDate = sentDate.toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                });
                                                const formattedTime = sentDate.toLocaleTimeString("en-US", {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                });

                                                return (
                                                    <div key={blast.id} className="p-6 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 space-y-3">
                                                                <div>
                                                                    <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                                                                        {blast.subject}
                                                                    </h3>
                                                                    <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{blast.message}</p>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Mail className="h-3.5 w-3.5" />
                                                                        {blast.sent_count} of {blast.recipient_count} sent
                                                                    </span>
                                                                    {blast.failed_count > 0 && (
                                                                        <span className="text-red-500">{blast.failed_count} failed</span>
                                                                    )}
                                                                    <span>
                                                                        {formattedDate} at {formattedTime}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Invite Guests Modal */}
            <InviteGuestsModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} eventId={eventId} onSuccess={handleInviteSuccess} />

            {/* Delete Event Confirmation Modal */}
            <ModalOverlay isOpen={showDeleteModal} onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}>
                <Modal className="max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Event</h2>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">"{event.title}"</span>? This action
                            is permanent.
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
