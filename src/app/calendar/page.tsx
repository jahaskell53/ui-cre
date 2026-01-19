"use client";

import { Calendar, ChevronLeft, ChevronRight, Plus, Users, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAuroraGradient } from "@/app/people/utils";

export default function CalendarPage() {
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
                        <Button>
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
                                <div className="flex items-center gap-4">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">December 2025</h2>
                                    <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                                        <Button variant="ghost" size="icon" className="rounded-none border-none h-8 w-8">
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />
                                        <Button variant="ghost" size="icon" className="rounded-none border-none h-8 w-8">
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-lg">
                                    <button className="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md shadow-sm">Month</button>
                                    <button className="px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">Week</button>
                                    <button className="px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">Day</button>
                                </div>
                            </div>

                            {/* Calendar Grid Mock */}
                            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 min-w-[700px]">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 grid-rows-5 h-[650px] min-w-[700px]">
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <div key={i} className="border-r border-b border-gray-200 dark:border-gray-800 p-3 group hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors last:border-r-0 relative">
                                        <span className={`text-sm font-semibold ${(i < 3 || i > 33) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {(i % 31) + 1}
                                        </span>
                                        {i === 12 && (
                                            <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-600 dark:border-purple-500 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-300 shadow-sm">
                                                <p className="truncate">Asset Management 101</p>
                                                <p className="text-[10px] opacity-80">14:00 - 15:30</p>
                                            </div>
                                        )}
                                        {i === 15 && (
                                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-500 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-sm">
                                                <p className="truncate">Tax Strategy Q&A</p>
                                                <p className="text-[10px] opacity-80">11:00 - 12:00</p>
                                            </div>
                                        )}
                                        {i === 22 && (
                                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-600 dark:border-green-500 rounded-lg text-xs font-semibold text-green-700 dark:text-green-300 shadow-sm">
                                                <p className="truncate">New Acquisition Tour</p>
                                                <p className="text-[10px] opacity-80">09:00 - 13:00</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
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
                                <MapPin className="size-6 text-purple-600 dark:text-purple-400" />
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
