"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTour } from "@/hooks/use-page-tour";

type ViewType = "month" | "week" | "day";

interface CalendarEvent {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    color: string;
}

export default function CalendarPage() {
    const [currentView, setCurrentView] = useState<ViewType>("month");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTourOpen, setIsTourOpen] = useState(false);

    // Listen for tour trigger from sidebar
    usePageTour(() => setIsTourOpen(true));

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const response = await fetch("/api/events");
            if (response.ok) {
                const data = await response.json();
                setEvents(data);
            }
        } catch (error) {
            console.error("Failed to fetch events:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleMonthChange = (monthIndex: string) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(parseInt(monthIndex));
        setCurrentDate(newDate);
    };

    const handleYearChange = (year: string) => {
        const newDate = new Date(currentDate);
        newDate.setFullYear(parseInt(year));
        setCurrentDate(newDate);
    };

    const formatDateHeader = () => {
        if (currentView === "month") {
            return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        } else if (currentView === "week") {
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        } else {
            return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        }
    };

    const navigateDate = (direction: "prev" | "next") => {
        const newDate = new Date(currentDate);
        if (currentView === "month") {
            newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1));
        } else if (currentView === "week") {
            newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7));
        } else {
            newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1));
        }
        setCurrentDate(newDate);
    };

    const navigateMonth = (direction: "prev" | "next") => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1));
        setCurrentDate(newDate);
    };

    const getEventsForDay = (year: number, month: number, day: number) => {
        return events.filter((event) => {
            const eventDate = new Date(event.start_time);
            return eventDate.getFullYear() === year && eventDate.getMonth() === month && eventDate.getDate() === day;
        });
    };

    const formatEventTime = (startTime: string, endTime: string) => {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")} - ${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
    };

    const colorClasses: Record<string, string> = {
        black: "border-l-gray-900 dark:border-l-gray-300",
        blue: "border-l-blue-600 dark:border-l-blue-500",
        green: "border-l-green-600 dark:border-l-green-500",
        purple: "border-l-purple-600 dark:border-l-purple-500",
        red: "border-l-red-600 dark:border-l-red-500",
        orange: "border-l-orange-600 dark:border-l-orange-500",
    };

    const renderMonthView = () => {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

        return (
            <>
                <div className="grid min-w-[700px] grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                        <div key={day} className="py-3 text-center text-xs font-semibold tracking-widest text-gray-400 uppercase dark:text-gray-500">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid h-[650px] min-w-[700px] grid-cols-7 grid-rows-5">
                    {Array.from({ length: 35 }).map((_, i) => {
                        const dayNumber = i - startingDayOfWeek + 1;
                        const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                        const dayEvents = isCurrentMonth ? getEventsForDay(currentDate.getFullYear(), currentDate.getMonth(), dayNumber) : [];

                        return (
                            <div
                                key={i}
                                className="group relative overflow-hidden border-r border-b border-gray-200 p-3 transition-colors last:border-r-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/20"
                            >
                                <span
                                    className={`text-sm font-semibold ${isCurrentMonth ? "text-gray-600 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}
                                >
                                    {isCurrentMonth ? dayNumber : ""}
                                </span>
                                <div className="mt-2 flex flex-col gap-1 overflow-hidden">
                                    {dayEvents.map((event) => (
                                        <Link key={event.id} href={`/events/${event.id}`}>
                                            <div
                                                className={`cursor-pointer rounded-md border border-l-4 border-gray-200 bg-white p-2 text-xs font-semibold text-gray-900 transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-700 ${colorClasses[event.color] || colorClasses.blue}`}
                                            >
                                                <p className="truncate">{event.title}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                    {formatEventTime(event.start_time, event.end_time)}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    };

    const getEventsForWeekDay = (date: Date) => {
        return events.filter((event) => {
            const eventDate = new Date(event.start_time);
            return eventDate.getFullYear() === date.getFullYear() && eventDate.getMonth() === date.getMonth() && eventDate.getDate() === date.getDate();
        });
    };

    const renderWeekView = () => {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday

        const hours = Array.from({ length: 24 }, (_, i) => i);
        const days = Array.from({ length: 7 }, (_, i) => {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            return day;
        });

        return (
            <>
                <div className="grid min-w-[900px] grid-cols-8 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30">
                    <div className="border-r border-gray-200 py-3 text-center text-xs font-semibold tracking-widest text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500"></div>
                    {days.map((day, idx) => (
                        <div key={idx} className="border-r border-gray-200 py-3 text-center last:border-r-0 dark:border-gray-800">
                            <div className="text-xs font-semibold tracking-widest text-gray-400 uppercase dark:text-gray-500">
                                {day.toLocaleDateString("en-US", { weekday: "short" })}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{day.getDate()}</div>
                        </div>
                    ))}
                </div>
                <div className="grid h-[650px] min-w-[900px] grid-cols-8 overflow-y-auto">
                    <div className="border-r border-gray-200 dark:border-gray-800">
                        {hours.map((hour) => (
                            <div key={hour} className="h-[60px] border-b border-gray-200 px-2 py-1 dark:border-gray-800">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{hour.toString().padStart(2, "0")}:00</span>
                            </div>
                        ))}
                    </div>
                    {days.map((day, dayIdx) => {
                        const dayEvents = getEventsForWeekDay(day);
                        return (
                            <div key={dayIdx} className="relative border-r border-gray-200 last:border-r-0 dark:border-gray-800">
                                {hours.map((hour) => (
                                    <div
                                        key={hour}
                                        className="group relative h-[60px] border-b border-gray-200 p-1 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/20"
                                    >
                                        {dayEvents
                                            .filter((e) => {
                                                const eventHour = new Date(e.start_time).getHours();
                                                return eventHour === hour;
                                            })
                                            .map((event) => {
                                                const startDate = new Date(event.start_time);
                                                const endDate = new Date(event.end_time);
                                                const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
                                                const minuteOffset = startDate.getMinutes();
                                                return (
                                                    <Link key={event.id} href={`/events/${event.id}`}>
                                                        <div
                                                            className={`absolute right-1 left-1 z-10 cursor-pointer rounded-md border border-l-4 border-gray-200 bg-white p-2 text-xs font-semibold text-gray-900 transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-700 ${colorClasses[event.color] || colorClasses.blue}`}
                                                            style={{ height: `${Math.max(duration * 60, 30)}px`, top: `${minuteOffset}px` }}
                                                        >
                                                            <p className="truncate">{event.title}</p>
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                {startDate.getHours().toString().padStart(2, "0")}:
                                                                {startDate.getMinutes().toString().padStart(2, "0")}
                                                            </p>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </>
        );
    };

    const renderDayView = () => {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const dayEvents = getEventsForDay(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        return (
            <>
                <div className="min-w-[700px] border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30">
                    <div className="py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </div>
                </div>
                <div className="flex h-[650px] min-w-[700px] overflow-y-auto">
                    <div className="w-20 shrink-0 border-r border-gray-200 dark:border-gray-800">
                        {hours.map((hour) => (
                            <div key={hour} className="flex h-[60px] items-center border-b border-gray-200 px-3 py-2 dark:border-gray-800">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{hour.toString().padStart(2, "0")}:00</span>
                            </div>
                        ))}
                    </div>
                    <div className="relative flex-1">
                        {hours.map((hour) => (
                            <div
                                key={hour}
                                className="group relative h-[60px] border-b border-gray-200 p-2 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/20"
                            >
                                {dayEvents
                                    .filter((e) => {
                                        const eventHour = new Date(e.start_time).getHours();
                                        return eventHour === hour;
                                    })
                                    .map((event) => {
                                        const startDate = new Date(event.start_time);
                                        const endDate = new Date(event.end_time);
                                        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
                                        const minuteOffset = startDate.getMinutes();
                                        return (
                                            <Link key={event.id} href={`/events/${event.id}`}>
                                                <div
                                                    className={`absolute right-2 left-2 z-10 cursor-pointer rounded-md border border-l-4 border-gray-200 bg-white p-3 text-sm font-semibold text-gray-900 transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-700 ${colorClasses[event.color] || colorClasses.blue}`}
                                                    style={{ height: `${Math.max(duration * 60, 30)}px`, top: `${minuteOffset}px` }}
                                                >
                                                    <p className="mb-1 font-semibold">{event.title}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {formatEventTime(event.start_time, event.end_time)}
                                                    </p>
                                                </div>
                                            </Link>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    };

    const tourSteps: TourStep[] = [
        {
            id: "create-event",
            target: '[data-tour="create-event"]',
            title: "Create Events",
            content: "Click here to create a new event. You can schedule meetings, set locations, and add Google Meet links.",
            position: "bottom",
        },
        {
            id: "view-toggle",
            target: '[data-tour="view-toggle"]',
            title: "Switch Views",
            content: "Switch between Month, Week, and Day views to see your events in different timeframes.",
            position: "bottom",
        },
        {
            id: "calendar",
            target: '[data-tour="calendar"]',
            title: "Calendar View",
            content: "View all your events on the calendar. Click on any event to see details and manage it.",
            position: "top",
        },
    ];

    return (
        <div className="relative flex h-full flex-col overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Events</h1>
                    </div>
                    <div className="flex w-full gap-3 lg:w-auto">
                        <Link href="/events/manage">
                            <Button variant="outline">
                                <Calendar className="size-4" />
                                My Events
                            </Button>
                        </Link>
                        <Link href="/events/new">
                            <Button
                                data-tour="create-event"
                                className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                            >
                                <Plus className="size-4" />
                                Create New
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-4">
                    <div className="xl:col-span-3">
                        <div data-tour="calendar" className="overflow-x-auto rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                            {/* Calendar Header */}
                            <div className="flex min-w-[700px] flex-col items-start justify-between gap-4 border-b border-gray-200 bg-white p-4 sm:flex-row sm:items-center dark:border-gray-800 dark:bg-gray-900">
                                <div className="flex flex-wrap items-center gap-4">
                                    {currentView === "month" ? (
                                        <div className="flex items-center gap-2">
                                            <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
                                                <SelectTrigger className="h-8 w-[140px]">
                                                    <SelectValue>{months[currentMonth]}</SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {months.map((month, idx) => (
                                                        <SelectItem key={idx} value={idx.toString()}>
                                                            {month}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={currentYear.toString()} onValueChange={handleYearChange}>
                                                <SelectTrigger className="h-8 w-[100px]">
                                                    <SelectValue>{currentYear}</SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {years.map((year) => (
                                                        <SelectItem key={year} value={year.toString()}>
                                                            {year}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatDateHeader()}</h2>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-none border-none"
                                                onClick={() => (currentView === "month" ? navigateMonth("prev") : navigateDate("prev"))}
                                            >
                                                <ChevronLeft className="size-4" />
                                            </Button>
                                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800" />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-none border-none"
                                                onClick={() => (currentView === "month" ? navigateMonth("next") : navigateDate("next"))}
                                            >
                                                <ChevronRight className="size-4" />
                                            </Button>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={goToToday} className="h-8">
                                            Today
                                        </Button>
                                    </div>
                                </div>
                                <div data-tour="view-toggle" className="flex rounded-md bg-gray-50 p-1 dark:bg-gray-800">
                                    <button
                                        onClick={() => setCurrentView("month")}
                                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                            currentView === "month"
                                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                                                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        }`}
                                    >
                                        Month
                                    </button>
                                    <button
                                        onClick={() => setCurrentView("week")}
                                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                            currentView === "week"
                                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                                                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        }`}
                                    >
                                        Week
                                    </button>
                                    <button
                                        onClick={() => setCurrentView("day")}
                                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                            currentView === "day"
                                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                                                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        }`}
                                    >
                                        Day
                                    </button>
                                </div>
                            </div>

                            {/* Calendar Views */}
                            {currentView === "month" && renderMonthView()}
                            {currentView === "week" && renderWeekView()}
                            {currentView === "day" && renderDayView()}
                        </div>
                    </div>

                    {/* Upcoming Events Sidebar */}
                    <div className="flex flex-col gap-6">
                        <section className="flex flex-col gap-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upcoming Events</h3>
                            {isLoading ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">Loading events...</div>
                            ) : events.filter((e) => new Date(e.start_time) >= new Date()).length === 0 ? (
                                <div className="rounded-md border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
                                    <Calendar className="mx-auto mb-2 size-8 text-gray-300 dark:text-gray-600" />
                                    <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">No upcoming events</p>
                                    <Link href="/events/new">
                                        <Button variant="outline" size="sm" className="w-full">
                                            <Plus className="mr-1 size-3" />
                                            Create Event
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                events
                                    .filter((e) => new Date(e.start_time) >= new Date())
                                    .slice(0, 5)
                                    .map((event) => {
                                        const eventDate = new Date(event.start_time);
                                        const formattedDate = eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                        const formattedTime = eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                                        const colorDot = colorClasses[event.color]?.split(" ")[0] || "bg-blue-50";

                                        return (
                                            <Link key={event.id} href={`/events/${event.id}`}>
                                                <div className="flex cursor-pointer flex-col gap-3 rounded-md border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
                                                    <div>
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <div
                                                                className={`h-2 w-2 rounded-full ${event.color === "black" ? "bg-gray-700" : event.color === "blue" ? "bg-blue-500" : event.color === "green" ? "bg-green-500" : event.color === "purple" ? "bg-purple-500" : event.color === "red" ? "bg-red-500" : event.color === "orange" ? "bg-orange-500" : "bg-blue-500"}`}
                                                            />
                                                            <h4 className="truncate font-semibold text-gray-900 dark:text-gray-100">{event.title}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                            <Clock className="size-3" />
                                                            {formattedDate}, {formattedTime}
                                                        </div>
                                                    </div>
                                                    {event.location && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                            {event.location.includes("meet.google.com") || event.location.includes("meet") ? (
                                                                <>
                                                                    <SiGooglemeet className="size-3" />
                                                                    <span className="truncate">Google Meet</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <MapPin className="size-3" />
                                                                    <span className="truncate">{event.location}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })
                            )}
                            {events.filter((e) => new Date(e.start_time) >= new Date()).length > 5 && (
                                <Link href="/events/manage">
                                    <Button variant="ghost" size="sm" className="w-full text-gray-500 hover:text-gray-700">
                                        View all events
                                    </Button>
                                </Link>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            {/* Guided Tour */}
            <GuidedTour
                steps={tourSteps}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                onComplete={() => {
                    console.log("Events tour completed!");
                }}
            />
        </div>
    );
}
