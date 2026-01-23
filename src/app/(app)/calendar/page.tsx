"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin } from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

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

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

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
            return (
                eventDate.getFullYear() === year &&
                eventDate.getMonth() === month &&
                eventDate.getDate() === day
            );
        });
    };

    const formatEventTime = (startTime: string, endTime: string) => {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
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
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[700px]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="py-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 grid-rows-5 h-[650px] min-w-[700px]">
                    {Array.from({ length: 35 }).map((_, i) => {
                        const dayNumber = i - startingDayOfWeek + 1;
                        const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                        const dayEvents = isCurrentMonth
                            ? getEventsForDay(currentDate.getFullYear(), currentDate.getMonth(), dayNumber)
                            : [];

                        return (
                            <div key={i} className="border-r border-b border-gray-200 dark:border-gray-800 p-3 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors last:border-r-0 relative overflow-hidden">
                                <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {isCurrentMonth ? dayNumber : ''}
                                </span>
                                <div className="flex flex-col gap-1 mt-2 overflow-hidden">
                                    {dayEvents.map((event) => (
                                        <Link key={event.id} href={`/calendar/events/${event.id}`}>
                                            <div className={`p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 rounded-md text-xs font-semibold cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all text-gray-900 dark:text-gray-100 ${colorClasses[event.color] || colorClasses.blue}`}>
                                                <p className="truncate">{event.title}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatEventTime(event.start_time, event.end_time)}</p>
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
            return (
                eventDate.getFullYear() === date.getFullYear() &&
                eventDate.getMonth() === date.getMonth() &&
                eventDate.getDate() === date.getDate()
            );
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
                <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[900px]">
                    <div className="py-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-r border-gray-200 dark:border-gray-800"></div>
                    {days.map((day, idx) => (
                        <div key={idx} className="py-3 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                {day.toLocaleDateString("en-US", { weekday: "short" })}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                                {day.getDate()}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-8 h-[650px] min-w-[900px] overflow-y-auto">
                    <div className="border-r border-gray-200 dark:border-gray-800">
                        {hours.map(hour => (
                            <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 px-2 py-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {hour.toString().padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>
                    {days.map((day, dayIdx) => {
                        const dayEvents = getEventsForWeekDay(day);
                        return (
                            <div key={dayIdx} className="border-r border-gray-200 dark:border-gray-800 last:border-r-0 relative">
                                {hours.map(hour => (
                                    <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 p-1 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors relative">
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
                                                    <Link key={event.id} href={`/calendar/events/${event.id}`}>
                                                        <div
                                                            className={`absolute left-1 right-1 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 rounded-md text-xs font-semibold z-10 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all text-gray-900 dark:text-gray-100 ${colorClasses[event.color] || colorClasses.blue}`}
                                                            style={{ height: `${Math.max(duration * 60, 30)}px`, top: `${minuteOffset}px` }}
                                                        >
                                                            <p className="truncate">{event.title}</p>
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                {startDate.getHours().toString().padStart(2, '0')}:{startDate.getMinutes().toString().padStart(2, '0')}
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
                <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[700px]">
                    <div className="py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </div>
                </div>
                <div className="flex h-[650px] min-w-[700px] overflow-y-auto">
                    <div className="border-r border-gray-200 dark:border-gray-800 w-20 shrink-0">
                        {hours.map(hour => (
                            <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {hour.toString().padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 relative">
                        {hours.map(hour => (
                            <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 p-2 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors relative">
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
                                            <Link key={event.id} href={`/calendar/events/${event.id}`}>
                                                <div
                                                    className={`absolute left-2 right-2 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 rounded-md text-sm font-semibold z-10 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all text-gray-900 dark:text-gray-100 ${colorClasses[event.color] || colorClasses.blue}`}
                                                    style={{ height: `${Math.max(duration * 60, 30)}px`, top: `${minuteOffset}px` }}
                                                >
                                                    <p className="font-semibold mb-1">{event.title}</p>
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

    return (
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Seminar Calendar</h1>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Link href="/calendar/events/manage">
                            <Button variant="outline">
                                <Calendar className="size-4" />
                                My Events
                            </Button>
                        </Link>
                        <Link href="/calendar/events/new">
                            <Button className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">
                                <Plus className="size-4" />
                                Create New
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md overflow-x-auto">
                            {/* Calendar Header */}
                            <div className="border-b border-gray-200 dark:border-gray-800 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 min-w-[700px]">
                                <div className="flex items-center gap-4 flex-wrap">
                                    {currentView === "month" ? (
                                        <div className="flex items-center gap-2">
                                            <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
                                                <SelectTrigger className="w-[140px] h-8">
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
                                                <SelectTrigger className="w-[100px] h-8">
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
                                        <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                                            <Button variant="ghost" size="icon" className="rounded-none border-none h-8 w-8" onClick={() => currentView === "month" ? navigateMonth("prev") : navigateDate("prev")}>
                                                <ChevronLeft className="size-4" />
                                            </Button>
                                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />
                                            <Button variant="ghost" size="icon" className="rounded-none border-none h-8 w-8" onClick={() => currentView === "month" ? navigateMonth("next") : navigateDate("next")}>
                                                <ChevronRight className="size-4" />
                                            </Button>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={goToToday} className="h-8">
                                            Today
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-md">
                                    <button
                                        onClick={() => setCurrentView("month")}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentView === "month"
                                                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                            }`}
                                    >
                                        Month
                                    </button>
                                    <button
                                        onClick={() => setCurrentView("week")}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentView === "week"
                                                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                            }`}
                                    >
                                        Week
                                    </button>
                                    <button
                                        onClick={() => setCurrentView("day")}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentView === "day"
                                                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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
                            ) : events.filter(e => new Date(e.start_time) >= new Date()).length === 0 ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-md text-center">
                                    <Calendar className="size-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No upcoming events</p>
                                    <Link href="/calendar/events/new">
                                        <Button variant="outline" size="sm" className="w-full">
                                            <Plus className="size-3 mr-1" />
                                            Create Event
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                events
                                    .filter(e => new Date(e.start_time) >= new Date())
                                    .slice(0, 5)
                                    .map((event) => {
                                        const eventDate = new Date(event.start_time);
                                        const formattedDate = eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                        const formattedTime = eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                                        const colorDot = colorClasses[event.color]?.split(" ")[0] || "bg-blue-50";

                                        return (
                                            <Link key={event.id} href={`/calendar/events/${event.id}`}>
                                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-md flex flex-col gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors hover:shadow-sm cursor-pointer">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className={`w-2 h-2 rounded-full ${event.color === 'black' ? 'bg-gray-700' : event.color === 'blue' ? 'bg-blue-500' : event.color === 'green' ? 'bg-green-500' : event.color === 'purple' ? 'bg-purple-500' : event.color === 'red' ? 'bg-red-500' : event.color === 'orange' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                                                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{event.title}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                            <Clock className="size-3" />
                                                            {formattedDate}, {formattedTime}
                                                        </div>
                                                    </div>
                                                    {event.location && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                            {event.location.includes('meet.google.com') || event.location.includes('meet') ? (
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
                            {events.filter(e => new Date(e.start_time) >= new Date()).length > 5 && (
                                <Link href="/calendar/events/manage">
                                    <Button variant="ghost" size="sm" className="w-full text-gray-500 hover:text-gray-700">
                                        View all events
                                    </Button>
                                </Link>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
