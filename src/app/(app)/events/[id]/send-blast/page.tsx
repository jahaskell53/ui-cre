"use client";

import { useState, useEffect } from "react";
import { useRouter as useNextRouter, useParams as useNextParams } from "next/navigation";
import { ArrowLeft, Loader2, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Event {
    id: string;
    title: string;
    user_id: string;
}

export default function SendBlastPage() {
    const router = useNextRouter();
    const params = useNextParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [registrationCount, setRegistrationCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [sendResults, setSendResults] = useState<{
        sent: number;
        failed: number;
        total: number;
    } | null>(null);

    useEffect(() => {
        fetchEvent();
        fetchRegistrationCount();
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

    const fetchRegistrationCount = async () => {
        try {
            const response = await fetch(
                `/api/events/registrations?event_id=${eventId}`
            );
            if (response.ok) {
                const data = await response.json();
                setRegistrationCount(data.count || 0);
            }
        } catch (err) {
            console.error("Error fetching registration count:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!subject.trim() || !message.trim()) {
            setError("Subject and message are required");
            return;
        }

        setIsSending(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch(`/api/events/${eventId}/send-blast`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, message }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to send blast");
            }

            const data = await response.json();
            setSuccess(true);
            setSendResults(data);
            setSubject("");
            setMessage("");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <div className="text-sm font-medium text-gray-500">
                        Loading...
                    </div>
                </div>
            </div>
        );
    }

    if (error && !event) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
                <div className="max-w-md w-full text-center">
                    <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100">
                        {error}
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => router.push(`/events/${eventId}`)}
                        className="text-gray-500 hover:text-gray-900 group"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Event
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.push(`/events/${eventId}/manage`)}
                        className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Send a Blast
                    </h1>
                    <div className="w-9" />
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
                <div className="space-y-8">
                    {/* Event Info */}
                    {event && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {event.title}
                            </h2>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>{registrationCount} registered</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    <span>All registered attendees will receive this email</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && sendResults && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-6">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg
                                        className="w-4 h-4 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                                        Blast sent successfully!
                                    </h3>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                        Sent to {sendResults.sent} of {sendResults.total}{" "}
                                        recipients
                                        {sendResults.failed > 0 &&
                                            ` (${sendResults.failed} failed)`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg
                                        className="w-4 h-4 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                                        Error
                                    </h3>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                        {error}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-6 md:p-8 space-y-6">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="subject"
                                    className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                                >
                                    Subject
                                </Label>
                                <Input
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Enter email subject"
                                    className="h-11 rounded-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                                    disabled={isSending}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="message"
                                    className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                                >
                                    Message
                                </Label>
                                <Textarea
                                    id="message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Enter your message to all registered attendees..."
                                    className="min-h-[200px] rounded-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                                    disabled={isSending}
                                    required
                                />
                                <p className="text-xs text-gray-500">
                                    This message will be sent to all {registrationCount}{" "}
                                    registered attendees.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.push(`/events/${eventId}/manage`)}
                                disabled={isSending}
                                className="text-gray-500 hover:text-gray-900"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSending || !subject.trim() || !message.trim()}
                                className="h-11 px-6 rounded-md font-semibold flex items-center gap-2"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" />
                                        Send Blast
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
