"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, Clock, MapPin, ArrowLeft, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

const colorOptions = [
    { value: "blue", label: "Blue", class: "bg-blue-500" },
    { value: "green", label: "Green", class: "bg-green-500" },
    { value: "purple", label: "Purple", class: "bg-purple-500" },
    { value: "red", label: "Red", class: "bg-red-500" },
    { value: "orange", label: "Orange", class: "bg-orange-500" },
    { value: "black", label: "Gray", class: "bg-gray-700" },
];

export default function EditEventPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("");
    const [location, setLocation] = useState("");
    const [color, setColor] = useState("blue");

    useEffect(() => {
        fetchEvent();
    }, [eventId]);

    const fetchEvent = async () => {
        try {
            const response = await fetch(`/api/events?id=${eventId}`);
            if (!response.ok) throw new Error("Failed to fetch event");
            const data = await response.json();

            setTitle(data.title);
            setDescription(data.description || "");
            setLocation(data.location || "");
            setColor(data.color || "blue");

            const start = new Date(data.start_time);
            const end = new Date(data.end_time);

            setStartDate(start.toISOString().split("T")[0]);
            setStartTime(start.toTimeString().slice(0, 5));
            setEndDate(end.toISOString().split("T")[0]);
            setEndTime(end.toTimeString().slice(0, 5));
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

        if (!endDate || !endTime) {
            setError("End date and time are required");
            return;
        }

        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);

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
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-4">
                    <Link href="/calendar/events/manage">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="size-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Edit Event</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Update your event details</p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar className="size-4" />
                                Start Date *
                            </Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Clock className="size-4" />
                                Start Time *
                            </Label>
                            <Input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar className="size-4" />
                                End Date *
                            </Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Clock className="size-4" />
                                End Time *
                            </Label>
                            <Input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="location" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <MapPin className="size-4" />
                            Location
                        </Label>
                        <Input
                            id="location"
                            placeholder="Add location or virtual meeting link"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="h-11"
                        />
                    </div>

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

                    <div className="flex gap-3 pt-4">
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
                </form>
            </div>
        </div>
    );
}
