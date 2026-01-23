"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, Clock, MapPin, ArrowLeft, Palette, ImagePlus, X, Video, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import Link from "next/link";

const colorOptions = [
    { value: "blue", label: "Blue", class: "bg-blue-500" },
    { value: "green", label: "Green", class: "bg-green-500" },
    { value: "purple", label: "Purple", class: "bg-purple-500" },
    { value: "red", label: "Red", class: "bg-red-500" },
    { value: "orange", label: "Orange", class: "bg-orange-500" },
    { value: "black", label: "Gray", class: "bg-gray-700" },
];

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

// Round time to nearest 30-minute interval
const roundToNearest30Minutes = (timeString: string): string => {
    const [hours, minutes] = timeString.split(":").map(Number);
    const roundedMinutes = Math.round(minutes / 30) * 30;
    const finalMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;
    const finalHours = roundedMinutes === 60 ? (hours + 1) % 24 : hours;
    return `${finalHours.toString().padStart(2, "0")}:${finalMinutes.toString().padStart(2, "0")}`;
};

export default function EditEventPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [location, setLocation] = useState("");
    const [color, setColor] = useState("blue");
    const [imageUrl, setImageUrl] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [meetLink, setMeetLink] = useState<string | null>(null);

    useEffect(() => {
        fetchEvent();
    }, [eventId]);

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

    const fetchEvent = async () => {
        try {
            const response = await fetch(`/api/events?id=${eventId}`);
            if (!response.ok) throw new Error("Failed to fetch event");
            const data = await response.json();

            setTitle(data.title);
            setDescription(data.description || "");
            setLocation(data.location || "");
            setColor(data.color || "blue");
            setImageUrl(data.image_url || "");
            setMeetLink(data.meet_link || null);

            const start = new Date(data.start_time);
            const end = new Date(data.end_time);

            setStartDate(start);
            setStartTime(roundToNearest30Minutes(start.toTimeString().slice(0, 5)));
            setEndTime(roundToNearest30Minutes(end.toTimeString().slice(0, 5)));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
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

        setIsSaving(true);

        try {
            const response = await fetch(`/api/events?id=${eventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    location,
                    color,
                    image_url: imageUrl || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update event");
            }

            router.push("/calendar/events/manage");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete event");
            router.push("/calendar/events/manage");
        } catch (err: any) {
            setError(err.message);
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
                <div className="flex items-center justify-center py-12">
                    <div className="text-gray-500 dark:text-gray-400">Loading event...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => router.push("/calendar/events/manage")}
                    className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Event</h1>
                <div className="w-9" /> {/* Spacer for centering */}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="title" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Event Title *
                        </Label>
                        <Input
                            id="title"
                            placeholder="Enter event title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-11"
                        />
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

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1rem_auto] gap-2 md:gap-3">
                        <DatePicker
                            date={startDate}
                            onDateChange={setStartDate}
                            placeholder="Select date"
                        />
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
                        <div className="hidden md:flex items-center justify-center">
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

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="location" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <MapPin className="size-4" />
                            Location
                        </Label>
                        <Input
                            id="location"
                            placeholder="Add a physical location (optional)"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="h-11"
                        />
                    </div>

                    {/* Google Meet Link (Read-only) */}
                    {meetLink && (
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Video className="size-4" />
                                Google Meet Link
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={meetLink}
                                    readOnly
                                    className="h-11 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                                />
                                <a
                                    href={meetLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-11 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shrink-0"
                                >
                                    Join
                                </a>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                This link was automatically generated and cannot be changed.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Palette className="size-4" />
                            Event Color
                        </Label>
                        <Select value={color} onValueChange={setColor}>
                            <SelectTrigger className="h-11">
                                <SelectValue>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded-full ${colorOptions.find(c => c.value === color)?.class}`} />
                                        {colorOptions.find(c => c.value === color)?.label}
                                    </div>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {colorOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full ${option.class}`} />
                                            {option.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <ImagePlus className="size-4" />
                            Cover Image
                        </Label>
                        {imageUrl ? (
                            <div className="relative">
                                <img
                                    src={imageUrl}
                                    alt="Event cover"
                                    className="w-full h-48 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => setImageUrl("")}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={isUploading}
                                />
                                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md hover:border-gray-400 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-900">
                                    {isUploading ? (
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Uploading...</span>
                                    ) : (
                                        <>
                                            <ImagePlus className="size-8 text-gray-400 dark:text-gray-500 mb-2" />
                                            <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload cover image</span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG up to 10MB</span>
                                        </>
                                    )}
                                </div>
                            </label>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        <div className="flex gap-3">
                            <Link href="/calendar/events/manage" className="flex-1">
                                <Button type="button" variant="outline" className="w-full h-11">
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 h-11 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setShowDeleteModal(true)}
                            disabled={isSaving || isDeleting}
                            className="h-9 w-9 p-0"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </form>
                </div>
            </div>

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
                                Are you sure you want to delete <span className="text-gray-900 dark:text-gray-100 font-semibold">"{title}"</span>? This action is permanent.
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
