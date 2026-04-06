"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail, Users } from "lucide-react";
import { useParams as useNextParams, useRouter as useNextRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
            const response = await fetch(`/api/events/registrations?event_id=${eventId}`);
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
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                    <div className="text-sm font-medium text-gray-500">Loading...</div>
                </div>
            </div>
        );
    }

    if (error && !event) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
                <div className="w-full max-w-md text-center">
                    <div className="mb-6 rounded-md border border-gray-200 bg-white p-4 font-medium text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
                        {error}
                    </div>
                    <Button variant="ghost" onClick={() => router.push(`/events/${eventId}`)} className="group text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to Event
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/50 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/50">
                <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
                    <button
                        onClick={() => router.push(`/events/${eventId}/manage`)}
                        className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Send a Blast</h1>
                    <div className="w-9" />
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
                <div className="space-y-8">
                    {/* Event Info */}
                    {event && (
                        <div className="rounded-md border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">{event.title}</h2>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span>{registrationCount} registered</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    <span>All registered attendees will receive this email</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && sendResults && (
                        <div className="rounded-md border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
                                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="mb-1 font-semibold text-green-900 dark:text-green-100">Blast sent successfully!</h3>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                        Sent to {sendResults.sent} of {sendResults.total} recipients
                                        {sendResults.failed > 0 && ` (${sendResults.failed} failed)`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500">
                                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="mb-1 font-semibold text-red-900 dark:text-red-100">Error</h3>
                                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-6 rounded-md border border-gray-200 bg-white p-6 md:p-8 dark:border-gray-800 dark:bg-gray-900">
                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Subject
                                </Label>
                                <Input
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Enter email subject"
                                    className="h-11 rounded-md border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                                    disabled={isSending}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Message
                                </Label>
                                <Textarea
                                    id="message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Enter your message to all registered attendees..."
                                    className="min-h-[200px] rounded-md border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                                    disabled={isSending}
                                    required
                                />
                                <p className="text-xs text-gray-500">This message will be sent to all {registrationCount} registered attendees.</p>
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
                                className="flex h-11 items-center gap-2 rounded-md px-6 font-semibold"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="h-4 w-4" />
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
