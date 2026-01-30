"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter as useNextRouter, useParams as useNextParams } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import {
    MapPin,
    Edit,
    Trash2,
    Check,
    Users,
    Calendar,
    ArrowLeft,
    Share2,
    ExternalLink,
    Mail,
    Eye,
    ChevronRight,
    Plus,
    BarChart3,
    MoreHorizontal,
    Video,
    Image as ImageIcon,
    Loader2,
    X
} from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { generateAuroraGradient, getInitials } from "@/app/(app)/network/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { InviteGuestsModal } from "@/components/events/invite-guests-modal";

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
                            avatar_url: hostData.avatar_url
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

    if (isLoading) return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );

    if (isUnauthorized || !event) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Access Denied
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        You don't have permission to manage this event. Only the event host can access this page.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/events/${eventId}`)}
                            className="rounded-md font-semibold"
                        >
                            View Event
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => router.push("/events")}
                            className="rounded-md font-semibold"
                        >
                            Back to Calendar
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const tabs = ["Overview", "Guests", "Blasts"];

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Event</h1>
                <div className="w-9" /> {/* Spacer for centering */}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 pb-20">
                <div className="max-w-5xl mx-auto px-6 pt-12">

                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {event.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="destructive"
                            onClick={() => setShowDeleteModal(true)}
                            disabled={isDeleting}
                            className="rounded-md font-semibold"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                        </Button>
                        <Link href={`/events/${event.id}`}>
                            <Button variant="outline" className="rounded-md font-semibold bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-2">
                                Event Page
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-8 border-b border-gray-200 dark:border-gray-800 mb-10 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 text-sm font-semibold transition-all relative ${activeTab === tab
                                ? "text-gray-900 dark:text-gray-100"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 dark:bg-gray-100"
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Quick Actions Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-sm text-left group"
                    >
                        <div className="w-12 h-12 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-blue-600">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Invite Guests</div>
                        </div>
                    </button>
                    <Link href={`/events/${eventId}/send-blast`}>
                        <button className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-sm text-left w-full">
                            <div className="w-12 h-12 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-purple-600">
                                <Mail className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 dark:text-white">Send a Blast</div>
                            </div>
                        </button>
                    </Link>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-sm text-left"
                    >
                        <div className="w-12 h-12 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-pink-600">
                            {isShared ? <Check className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                                {isShared ? "Link Copied!" : "Share Event"}
                            </div>
                        </div>
                    </button>
                </div>

                {/* Main Content Area */}
                <div>
                    {activeTab === "Overview" && (
                        <div className="space-y-8">
                            {/* Summary Card */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-8 flex gap-8">
                            <div className="w-48 h-48 shrink-0 rounded-md overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 relative group">
                                {event.image_url ? (
                                    <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900 text-gray-200">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                )}
                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">When & Where</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-md bg-white dark:bg-gray-900 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800 shrink-0">
                                                <div className="text-[10px] font-semibold uppercase text-gray-400 leading-none mb-0.5">JAN</div>
                                                <div className="text-lg font-semibold text-gray-900 leading-none">24</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{formatDate(event.start_time)}</div>
                                                <div className="text-sm font-semibold text-gray-500">{formatTimeRange(event.start_time, event.end_time)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-md bg-white dark:bg-gray-900 flex items-center justify-center border border-gray-200 dark:border-gray-800 shrink-0">
                                                <Video className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">Google Meet</div>
                                                <div className="text-sm font-semibold text-blue-600 truncate max-w-[200px] cursor-pointer hover:underline">
                                                    https://meet.google.com/qhn-fjrm-mos
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Link href={`/events/${event.id}/edit`}>
                                        <Button variant="secondary" className="rounded-md font-semibold px-6">Edit Event</Button>
                                    </Link>
                                    <Button
                                        variant="secondary"
                                        className="rounded-md font-semibold px-6"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? "Uploading..." : "Change Photo"}
                                    </Button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handlePhotoChange}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hosts Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Hosts</h3>
                                <Button variant="secondary" size="sm" className="rounded-md font-semibold bg-gray-100">
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Add Host
                                </Button>
                            </div>
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-4">
                                {host && (
                                    <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                                                <AvatarImage src={host.avatar_url || ""} />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                                    {getInitials(host.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-semibold text-sm text-gray-900 dark:text-white">{host.name}</div>
                                                <div className="text-xs font-semibold text-gray-400">Primary Host</div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="rounded-md text-gray-400">
                                            <MoreHorizontal className="w-5 h-5" />
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
                                    <p className="text-sm font-semibold text-gray-400 mt-1">
                                        {registrationCount} {registrationCount === 1 ? "guest" : "guests"} registered
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
                                    className="rounded-md font-semibold bg-gray-100"
                                    onClick={() => setShowInviteModal(true)}
                                >
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Invite Guests
                                </Button>
                            </div>

                            {/* Invites sent - same card design as Overview */}
                            {invites.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invites sent</h3>
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
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
                                                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex flex-col"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            {emails.length > 0 ? (
                                                                <ul className="text-sm text-gray-900 dark:text-white space-y-0.5">
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
                                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                                                    {invite.message}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-sm font-semibold text-gray-400 mt-2 text-right">
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
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-12 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                </div>
                            ) : attendees.length === 0 ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md flex items-center justify-center mb-4">
                                        <Users className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white mb-1">No Guests Yet</div>
                                    <p className="text-sm font-semibold text-gray-400 mb-6">Invite people to your event to see them here.</p>
                                    <Button
                                        variant="secondary"
                                        className="rounded-md font-semibold"
                                        onClick={() => setShowInviteModal(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-1.5" />
                                        Invite Guests
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {attendees.map((attendee) => (
                                            <div
                                                key={attendee.user_id}
                                                className="flex items-center justify-between p-4 hover:bg-white dark:hover:bg-gray-900 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Link href={`/users/${attendee.user_id}`}>
                                                        <Avatar className="w-12 h-12 border-2 border-white dark:border-gray-800 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                                                            <AvatarImage src={attendee.avatar_url || ""} />
                                                            <AvatarFallback
                                                                className="text-white text-sm font-semibold"
                                                                style={{ background: generateAuroraGradient(attendee.full_name || "Guest") }}
                                                            >
                                                                {getInitials(attendee.full_name || "Guest")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </Link>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-white">
                                                            {attendee.full_name || "Guest"}
                                                        </div>
                                                        <div className="text-xs font-semibold text-gray-400">Registered</div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="rounded-md text-gray-400">
                                                    <MoreHorizontal className="w-5 h-5" />
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
                                    <p className="text-sm font-semibold text-gray-400 mt-1">
                                        Send messages to all registered attendees
                                    </p>
                                </div>
                                <Link href={`/events/${eventId}/send-blast`}>
                                    <Button
                                        variant="secondary"
                                        className="rounded-md font-semibold bg-gray-100"
                                    >
                                        <Mail className="w-4 h-4 mr-1.5" />
                                        Send a Blast
                                    </Button>
                                </Link>
                            </div>

                            {isLoadingBlasts ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-12 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                </div>
                            ) : blasts.length === 0 ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md flex items-center justify-center mb-4">
                                        <Mail className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white mb-1">No Blasts Sent Yet</div>
                                    <p className="text-sm font-semibold text-gray-400 mb-6">Send your first email blast to all registered attendees.</p>
                                    <Link href={`/events/${eventId}/send-blast`}>
                                        <Button
                                            variant="secondary"
                                            className="rounded-md font-semibold"
                                        >
                                            <Mail className="w-4 h-4 mr-1.5" />
                                            Send a Blast
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
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
                                                <div
                                                    key={blast.id}
                                                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1 space-y-3">
                                                            <div>
                                                                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                                                                    {blast.subject}
                                                                </h3>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                                    {blast.message}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                                <span className="flex items-center gap-1.5">
                                                                    <Mail className="w-3.5 h-3.5" />
                                                                    {blast.sent_count} of {blast.recipient_count} sent
                                                                </span>
                                                                {blast.failed_count > 0 && (
                                                                    <span className="text-red-500">
                                                                        {blast.failed_count} failed
                                                                    </span>
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
            <InviteGuestsModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                eventId={eventId}
                onSuccess={handleInviteSuccess}
            />

            {/* Delete Event Confirmation Modal */}
            <ModalOverlay
                isOpen={showDeleteModal}
                onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}
            >
                <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
                    <Dialog className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Delete Event
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Are you sure you want to delete{" "}
                            <span className="text-gray-900 dark:text-gray-100 font-semibold">"{event.title}"</span>? This
                            action is permanent.
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
