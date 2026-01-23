"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter as useNextRouter, useParams as useNextParams } from "next/navigation";
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
    Send,
    Eye,
    ChevronRight,
    Plus,
    BarChart3,
    MessageSquare,
    MoreHorizontal,
    Video,
    Image as ImageIcon,
    Loader2,
    X
} from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog as ShadDialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { generateAuroraGradient, getInitials } from "@/app/(app)/people/utils";
import { motion, AnimatePresence } from "framer-motion";
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

export default function EventManageDashboard() {
    const router = useNextRouter();
    const params = useNextParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<Event | null>(null);
    const [host, setHost] = useState<Host | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isShared, setIsShared] = useState(false);
    const [activeTab, setActiveTab] = useState("Overview");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [isSendingInvites, setIsSendingInvites] = useState(false);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [registrationCount, setRegistrationCount] = useState(0);
    const [isLoadingGuests, setIsLoadingGuests] = useState(false);
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

    const fetchEventDetails = async () => {
        try {
            const response = await fetch(`/api/events?id=${eventId}`);
            if (!response.ok) throw new Error("Failed to fetch event");
            const data = await response.json();
            setEvent(data);

            // Reusing host fetch logic or just setting a mock for now if not in API
            // In a real app, this might come from the event data or a separate join
            setHost({
                id: data.user_id,
                name: "Jakobi Haskell", // Placeholder/Mock
                email: "jakobi@example.com",
                avatar_url: null
            });
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
        const shareUrl = `${window.location.origin}/calendar/events/${eventId}`;

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

    const handleInviteSubmit = async () => {
        let finalEmails = [...selectedEmails];

        // Also add whatever is currently in the input if it's valid
        if (emailInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
            finalEmails = [...finalEmails, emailInput.trim()];
        }

        if (finalEmails.length === 0) {
            alert("Please enter at least one valid email address.");
            return;
        }

        setIsSendingInvites(true);
        try {
            const response = await fetch("/api/events/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_id: eventId,
                    emails: finalEmails
                }),
            });

            if (!response.ok) throw new Error("Failed to send invitations");

            alert("Invitations sent successfully!");
            setShowInviteModal(false);
            setSelectedEmails([]);
            setEmailInput("");
            // Refresh guests list if on Guests tab
            if (activeTab === "Guests") {
                fetchGuests();
            }
        } catch (err) {
            console.error("Error sending invites:", err);
            alert("Failed to send invitations. Please try again.");
        } finally {
            setIsSendingInvites(false);
        }
    };

    const handleAddEmail = () => {
        const trimmed = emailInput.trim();
        if (!trimmed) return;

        // Simple regex for basic validation
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            if (!selectedEmails.includes(trimmed)) {
                setSelectedEmails([...selectedEmails, trimmed]);
            }
            setEmailInput("");
        }
    };

    const removeEmail = (email: string) => {
        setSelectedEmails(selectedEmails.filter(e => e !== email));
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

    if (isLoading) return (
        <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );

    if (!event) return null;

    const tabs = ["Overview", "Guests", "Blasts"];

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => router.push(`/calendar/events/${event.id}`)}
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
            <div className="flex-1 overflow-y-auto bg-[#FDFCFB] dark:bg-gray-950 pb-20">
                <div className="max-w-5xl mx-auto px-6 pt-12">

                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {event.title}
                        </h1>
                    </div>
                    <Link href={`/calendar/events/${event.id}`}>
                        <Button variant="outline" className="rounded-md font-semibold bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm gap-2">
                            Event Page
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-8 border-b border-gray-100 dark:border-gray-900 mb-10 overflow-x-auto scrollbar-hide">
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
                        className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Invite Guests</div>
                        </div>
                    </button>
                    <button className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left">
                        <div className="w-12 h-12 rounded-md bg-purple-50 flex items-center justify-center text-purple-600">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Send a Blast</div>
                        </div>
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left"
                    >
                        <div className="w-12 h-12 rounded-md bg-pink-50 flex items-center justify-center text-pink-600">
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
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-8 flex gap-8 shadow-sm">
                            <div className="w-48 h-48 shrink-0 rounded-md overflow-hidden bg-gray-50 border border-gray-100 shadow-inner relative group">
                                {event.image_url ? (
                                    <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-200">
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
                                            <div className="w-12 h-12 rounded-md bg-gray-50 flex flex-col items-center justify-center shadow-sm border border-gray-100 shrink-0">
                                                <div className="text-[10px] font-semibold uppercase text-gray-400 leading-none mb-0.5">JAN</div>
                                                <div className="text-lg font-semibold text-gray-900 leading-none">24</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{formatDate(event.start_time)}</div>
                                                <div className="text-sm font-semibold text-gray-500">{formatTimeRange(event.start_time, event.end_time)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-md bg-gray-50 flex items-center justify-center shadow-sm border border-gray-100 shrink-0">
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
                                    <Link href={`/calendar/events/${event.id}/edit`}>
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

                        {/* Invites Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Invites</h3>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="rounded-md font-semibold bg-gray-100"
                                    onClick={() => setShowInviteModal(true)}
                                >
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Invite Guests
                                </Button>
                            </div>
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-12 flex flex-col items-center justify-center text-center shadow-sm">
                                <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center mb-4">
                                    <Mail className="w-8 h-8 text-gray-200" />
                                </div>
                                <div className="font-semibold text-gray-900 dark:text-white mb-1">No Invites Sent</div>
                                <p className="text-sm font-semibold text-gray-400">You can invite subscribers, contacts and past guests via email or SMS.</p>
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
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-4 shadow-sm">
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
                        <div className="space-y-6">
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

                            {isLoadingGuests ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-12 flex items-center justify-center shadow-sm">
                                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                </div>
                            ) : attendees.length === 0 ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-12 flex flex-col items-center justify-center text-center shadow-sm">
                                    <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center mb-4">
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
                                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md shadow-sm overflow-hidden">
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {attendees.map((attendee) => (
                                            <div
                                                key={attendee.user_id}
                                                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
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
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-12 flex flex-col items-center justify-center text-center shadow-sm">
                                <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center mb-4">
                                    <MessageSquare className="w-8 h-8 text-gray-200" />
                                </div>
                                <div className="font-semibold text-gray-900 dark:text-white mb-1">Blasts Coming Soon</div>
                                <p className="text-sm font-semibold text-gray-400">Send messages to all your guests at once.</p>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </div>

            {/* Invite Guests Modal (shadcn) */}
            <ShadDialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                <DialogContent className="sm:max-w-xl rounded-md border-gray-100 dark:border-gray-800 p-8">
                    <DialogHeader className="flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <Mail className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="space-y-2">
                            <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Invite Guests</DialogTitle>
                            <DialogDescription className="text-gray-500 font-medium text-base">
                                Send a personalized invitation to your colleagues and associates.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        <div className="space-y-3">
                            <Label htmlFor="emails" className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-1">
                                Add Emails
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="emails"
                                        value={emailInput}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailInput(e.target.value)}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddEmail();
                                            }
                                        }}
                                        placeholder="Paste or enter emails here"
                                        className="h-11 rounded-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-medium px-4 shadow-none"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleAddEmail}
                                    variant="secondary"
                                    className="h-11 px-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold shadow-none"
                                >
                                    Add
                                </Button>
                            </div>
                        </div>

                        {/* Email Tags */}
                        {selectedEmails.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-gray-50/50 dark:bg-gray-900/50 rounded-md border border-dashed border-gray-200 dark:border-gray-800 min-h-[60px]">
                                {selectedEmails.map((email) => (
                                    <div
                                        key={email}
                                        className="flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
                                    >
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{email}</span>
                                        <button
                                            onClick={() => removeEmail(email)}
                                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowInviteModal(false)}
                                disabled={isSendingInvites}
                                className="h-12 rounded-md font-semibold text-gray-500 sm:flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => handleInviteSubmit()}
                                disabled={isSendingInvites || (selectedEmails.length === 0 && !emailInput)}
                                className="h-12 rounded-md font-semibold flex items-center justify-center gap-2 sm:flex-1 shadow-sm"
                            >
                                {isSendingInvites ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send Invitations
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </ShadDialog>
        </div>
    );
}
