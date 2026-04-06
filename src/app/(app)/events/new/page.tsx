"use client";

import { useState } from "react";
import { ArrowLeft, Calendar, Clock, ImagePlus, MapPin, Video, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Generate time options in 30-minute intervals
const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
            const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
            options.push({ value: timeString, label: displayTime });
        }
    }
    return options;
};

const timeOptions = generateTimeOptions();

export default function NewEventPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [location, setLocation] = useState("");
    const [isInPerson, setIsInPerson] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to upload image");
            }

            setImageUrl(data.url);
        } catch (err: any) {
            setError(err.message || "Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError("Title is required");
            return;
        }

        if (!startDate || !startTime) {
            setError("Start date and time are required");
            return;
        }

        if (!endTime) {
            setError("End time is required");
            return;
        }

        // Combine date and time (end date is same as start date)
        const startDateString = startDate.toISOString().split("T")[0];
        const startDateTime = new Date(`${startDateString}T${startTime}`);
        const endDateTime = new Date(`${startDateString}T${endTime}`);

        if (endDateTime <= startDateTime) {
            setError("End time must be after start time");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    location,
                    image_url: imageUrl || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create event");
            }

            router.push("/events");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Set default dates to today
    const today = new Date();

    return (
        <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <button
                    onClick={() => router.push("/events")}
                    className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Event</h1>
                <div className="w-9" /> {/* Spacer for centering */}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="title" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Event Title *
                            </Label>
                            <Input id="title" placeholder="Enter event title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                placeholder="Add a description for your event"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1rem_auto] md:gap-3">
                            <DatePicker date={startDate} onDateChange={setStartDate} minDate={today} placeholder="Select date" />
                            <Select value={startTime} onValueChange={setStartTime}>
                                <SelectTrigger className="!h-11 w-full">
                                    <SelectValue placeholder="Start time" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="hidden items-center justify-center md:flex">
                                <span className="text-gray-500 dark:text-gray-400">—</span>
                            </div>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger className="!h-11 w-full">
                                    <SelectValue placeholder="End time" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                            <div className="flex flex-col">
                                <Label htmlFor="in-person" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    In Person
                                </Label>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Enable to add a physical location</p>
                            </div>
                            <Switch id="in-person" checked={isInPerson} onCheckedChange={setIsInPerson} />
                        </div>

                        {isInPerson && (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="location" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <MapPin className="size-4" />
                                    Location
                                </Label>
                                <Input
                                    id="location"
                                    placeholder="Add a physical location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                        )}

                        {/* Google Meet Info */}
                        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                            <Video className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <p className="text-sm text-blue-700 dark:text-blue-300">A Google Meet link will be automatically created for this event.</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <ImagePlus className="size-4" />
                                Cover Image
                            </Label>
                            {imageUrl ? (
                                <div className="relative">
                                    <img
                                        src={imageUrl}
                                        alt="Event cover"
                                        className="h-48 w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl("")}
                                        className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer">
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                                    <div className="flex h-48 flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600">
                                        {isUploading ? (
                                            <span className="text-sm text-gray-500 dark:text-gray-400">Uploading...</span>
                                        ) : (
                                            <>
                                                <ImagePlus className="mb-2 size-8 text-gray-400 dark:text-gray-500" />
                                                <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload cover image</span>
                                                <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">PNG, JPG up to 10MB</span>
                                            </>
                                        )}
                                    </div>
                                </label>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Link href="/events" className="flex-1">
                                <Button type="button" variant="outline" className="h-11 w-full">
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="h-11 flex-1 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                            >
                                {isLoading ? "Creating..." : "Create Event"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
