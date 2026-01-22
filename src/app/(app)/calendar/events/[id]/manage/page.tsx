"use client";

import { useState, useEffect } from "react";
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
    Image as ImageIcon
} from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/application/modals/modal";
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

export default function EventManageDashboard() {
    const router = useNextRouter();
    const params = useNextParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<Event | null>(null);
    const [host, setHost] = useState<Host | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("Overview");

    useEffect(() => {
        if (eventId) {
            fetchEventDetails();
        }
    }, [eventId]);

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

    if (isLoading) return (
        <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );

    if (!event) return null;

    const tabs = ["Overview", "Guests", "Registration", "Blasts", "Insights", "More"];

    return (
        <div className="min-h-screen bg-[#FDFCFB] dark:bg-gray-950 pb-20">
            {/* Top Navigation / Breadcrumb */}
            <div className="max-w-5xl mx-auto px-6 pt-12">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-2">
                    <Link href="/calendar/events/manage" className="hover:text-gray-600 transition-colors">Events</Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{event.title}</span>
                </div>

                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {event.title}
                        </h1>
                    </div>
                    <Link href={`/calendar/events/${event.id}`}>
                        <Button variant="outline" className="rounded-xl font-semibold bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm gap-2">
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
                    <button className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left group">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Invite Guests</div>
                        </div>
                    </button>
                    <button className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Send a Blast</div>
                        </div>
                    </button>
                    <button className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left">
                        <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
                            <Share2 className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Share Event</div>
                        </div>
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
                    {/* Left Column: Info & Setup */}
                    <div className="space-y-8">
                        {/* Summary Card */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-8 flex gap-8 shadow-sm">
                            <div className="w-48 h-48 shrink-0 rounded-[1.5rem] overflow-hidden bg-gray-50 border border-gray-100 shadow-inner">
                                {event.image_url ? (
                                    <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-200">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">When & Where</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex flex-col items-center justify-center shadow-sm border border-gray-100 shrink-0">
                                                <div className="text-[10px] font-semibold uppercase text-gray-400 leading-none mb-0.5">JAN</div>
                                                <div className="text-lg font-semibold text-gray-900 leading-none">24</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{formatDate(event.start_time)}</div>
                                                <div className="text-sm font-semibold text-gray-500">{formatTimeRange(event.start_time, event.end_time)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shadow-sm border border-gray-100 shrink-0">
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
                                        <Button variant="secondary" className="rounded-xl font-semibold px-6">Edit Event</Button>
                                    </Link>
                                    <Button variant="secondary" className="rounded-xl font-semibold px-6">Change Photo</Button>
                                </div>
                            </div>
                        </div>

                        {/* Invites Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Invites</h3>
                                <Button variant="secondary" size="sm" className="rounded-xl font-semibold bg-gray-100">
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Invite Guests
                                </Button>
                            </div>
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
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
                                <Button variant="secondary" size="sm" className="rounded-xl font-semibold bg-gray-100">
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Add Host
                                </Button>
                            </div>
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-4 shadow-sm">
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
                                        <Button variant="ghost" size="icon" className="rounded-xl text-gray-400">
                                            <MoreHorizontal className="w-5 h-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Insights / Status */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-tight mb-4">Insights</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">0</div>
                                    <div className="text-xs font-semibold text-gray-400 underline cursor-pointer">Registration Views</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">0</div>
                                    <div className="text-xs font-semibold text-gray-400 underline cursor-pointer">Approved Guests</div>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full mt-6 rounded-xl font-semibold border-gray-100 shadow-sm gap-2">
                                All Insights
                                <BarChart3 className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-tight mb-4">Registration</h4>
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm font-semibold text-gray-600">Status</div>
                                <div className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded-md uppercase tracking-wider">Accepting</div>
                            </div>
                            <Button variant="secondary" className="w-full rounded-xl font-semibold bg-gray-50 border-gray-100 shadow-sm">
                                Manage Registration
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
