"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAuroraGradient } from "@/app/people/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ViewType = "month" | "week" | "day";

export default function CalendarPage() {
    const [currentView, setCurrentView] = useState<ViewType>("month");
    const [currentDate, setCurrentDate] = useState(new Date(2025, 11, 1)); // December 2025

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

    const renderMonthView = () => {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

        const events = [
            { day: 13, title: "Asset Management 101", time: "14:00 - 15:30", color: "black" },
            { day: 16, title: "Tax Strategy Q&A", time: "11:00 - 12:00", color: "blue" },
            { day: 23, title: "New Acquisition Tour", time: "09:00 - 13:00", color: "green" },
        ];

        return (
            <>
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[700px]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 grid-rows-5 h-[650px] min-w-[700px]">
                    {Array.from({ length: 35 }).map((_, i) => {
                        const dayNumber = i - startingDayOfWeek + 1;
                        const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                        const dayEvents = events.filter(e => e.day === dayNumber);
                        
                        return (
                            <div key={i} className="border-r border-b border-gray-200 dark:border-gray-800 p-3 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors last:border-r-0 relative">
                                <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {isCurrentMonth ? dayNumber : ''}
                                </span>
                                {isCurrentMonth && dayEvents.map((event, idx) => {
                                    const colorClasses = {
                                        black: "bg-gray-100 dark:bg-gray-800 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-gray-100",
                                        blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300",
                                        green: "bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-500 text-green-700 dark:text-green-300",
                                    };
                                    return (
                                        <div key={idx} className={`mt-2 p-2 border-l-4 rounded-lg text-xs font-semibold shadow-sm ${colorClasses[event.color as keyof typeof colorClasses]}`}>
                                            <p className="truncate">{event.title}</p>
                                            <p className="text-[10px] opacity-80">{event.time}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </>
        );
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

        const events = [
            { day: 1, hour: 14, title: "Asset Management 101", duration: 1.5, color: "black" },
            { day: 4, hour: 11, title: "Tax Strategy Q&A", duration: 1, color: "blue" },
            { day: 6, hour: 9, title: "New Acquisition Tour", duration: 4, color: "green" },
        ];

        return (
            <>
                <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[900px]">
                    <div className="py-3 text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-r border-gray-200 dark:border-gray-800"></div>
                    {days.map((day, idx) => (
                        <div key={idx} className="py-3 text-center border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                            <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
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
                    {days.map((day, dayIdx) => (
                        <div key={dayIdx} className="border-r border-gray-200 dark:border-gray-800 last:border-r-0 relative">
                            {hours.map(hour => (
                                <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 p-1 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors relative">
                                    {events
                                        .filter(e => e.day === dayIdx + 1 && Math.floor(e.hour) === hour)
                                        .map((event, idx) => {
                                            const colorClasses = {
                                                black: "bg-gray-100 dark:bg-gray-800 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-gray-100",
                                                blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300",
                                                green: "bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-500 text-green-700 dark:text-green-300",
                                            };
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`absolute left-1 right-1 p-2 border-l-4 rounded-lg text-xs font-semibold shadow-sm ${colorClasses[event.color as keyof typeof colorClasses]}`}
                                                    style={{ height: `${event.duration * 60}px`, top: `${(event.hour % 1) * 60}px` }}
                                                >
                                                    <p className="truncate">{event.title}</p>
                                                    <p className="text-[10px] opacity-80">
                                                        {Math.floor(event.hour).toString().padStart(2, '0')}:{((event.hour % 1) * 60).toString().padStart(2, '0')}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </>
        );
    };

    const renderDayView = () => {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        
        const events = [
            { hour: 9, title: "New Acquisition Tour", duration: 4, color: "green" },
            { hour: 14, title: "Asset Management 101", duration: 1.5, color: "black" },
        ];

        return (
            <>
                <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[700px]">
                    <div className="py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </div>
                </div>
                <div className="grid grid-cols-2 h-[650px] min-w-[700px] overflow-y-auto">
                    <div className="border-r border-gray-200 dark:border-gray-800">
                        {hours.map(hour => (
                            <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {hour.toString().padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="relative">
                        {hours.map(hour => (
                            <div key={hour} className="h-[60px] border-b border-gray-200 dark:border-gray-800 p-2 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors relative">
                                {events
                                    .filter(e => Math.floor(e.hour) === hour)
                                    .map((event, idx) => {
                                        const colorClasses = {
                                            black: "bg-gray-100 dark:bg-gray-800 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-gray-100",
                                            blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300",
                                            green: "bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-500 text-green-700 dark:text-green-300",
                                        };
                                        return (
                                            <div
                                                key={idx}
                                                className={`p-3 border-l-4 rounded-lg text-sm font-semibold shadow-sm ${colorClasses[event.color as keyof typeof colorClasses]}`}
                                                style={{ height: `${event.duration * 60}px`, top: `${(event.hour % 1) * 60}px` }}
                                            >
                                                <p className="font-bold mb-1">{event.title}</p>
                                                <p className="text-xs opacity-80">
                                                    {Math.floor(event.hour).toString().padStart(2, '0')}:{((event.hour % 1) * 60).toString().padStart(2, '0')} - {Math.floor(event.hour + event.duration).toString().padStart(2, '0')}:{(((event.hour + event.duration) % 1) * 60).toString().padStart(2, '0')}
                                                </p>
                                            </div>
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Expert-led training for institutional-grade property management.</p>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button variant="outline">
                            <Calendar className="size-4" />
                            My Bookings
                        </Button>
                        <Button className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">
                            <Plus className="size-4" />
                            Suggest Topic
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto shadow-sm">
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
                                        <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
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
                                <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-lg">
                                    <button
                                        onClick={() => setCurrentView("month")}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                            currentView === "month"
                                                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                        }`}
                                    >
                                        Month
                                    </button>
                                    <button
                                        onClick={() => setCurrentView("week")}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                            currentView === "week"
                                                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                        }`}
                                    >
                                        Week
                                    </button>
                                    <button
                                        onClick={() => setCurrentView("day")}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                            currentView === "day"
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

                    {/* Featured Seminars / Sidebar */}
                    <div className="flex flex-col gap-6">
                        <section className="flex flex-col gap-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Top Rated Seminars</h3>
                            {[
                                { title: 'Advanced Underwriting', speaker: 'David Goggins', time: 'Dec 22, 10:00 AM', attendees: '45/50', initials: 'DG' },
                                { title: 'Legal Compliance 2026', speaker: 'Sarah Jenkins', time: 'Jan 5, 2:00 PM', attendees: '128/200', initials: 'SJ' },
                            ].map((sem, i) => (
                                <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{sem.title}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <Clock className="size-3" />
                                            {sem.time}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback style={{ background: generateAuroraGradient(sem.speaker) }} className="text-[10px] text-white">
                                                    {sem.initials}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{sem.speaker}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                            <Users className="size-3" />
                                            {sem.attendees}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full">Register Now</Button>
                                </div>
                            ))}
                        </section>

                        <section className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-6 border border-gray-200 dark:border-gray-800 border-dashed flex flex-col items-center text-center gap-3">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-full shadow-sm">
                                <MapPin className="size-6 text-gray-900 dark:text-gray-100" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-gray-100">In-Person Meetups</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Discover owners in your city for local networking events.</p>
                            <Button variant="link" size="sm">Explore local groups</Button>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
