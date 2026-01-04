"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users01, Clock, MarkerPin01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Avatar } from "@/components/base/avatar/avatar";

export default function CalendarPage() {
    return (
        <MainLayout>
            <div className="flex flex-col gap-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Seminar Calendar</h1>
                        <p className="text-lg text-tertiary">Expert-led training for institutional-grade property management.</p>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button color="secondary" iconLeading={Calendar}>My Bookings</Button>
                        <Button color="primary" iconLeading={Plus}>Suggest Topic</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3">
                        <div className="bg-primary border border-secondary rounded-2xl overflow-x-auto shadow-sm">
                            {/* Calendar Header */}
                            <div className="border-b border-secondary p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary min-w-[700px]">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-lg font-semibold text-primary">December 2025</h2>
                                    <div className="flex items-center border border-secondary rounded-lg overflow-hidden">
                                        <ButtonUtility icon={ChevronLeft} color="tertiary" className="border-none" />
                                        <div className="w-px h-6 bg-border-secondary" />
                                        <ButtonUtility icon={ChevronRight} color="tertiary" className="border-none" />
                                    </div>
                                </div>
                                <div className="flex bg-secondary p-1 rounded-lg">
                                    <button className="px-3 py-1.5 text-sm font-medium bg-primary text-primary rounded-md shadow-sm">Month</button>
                                    <button className="px-3 py-1.5 text-sm font-medium text-tertiary">Week</button>
                                    <button className="px-3 py-1.5 text-sm font-medium text-tertiary">Day</button>
                                </div>
                            </div>

                            {/* Calendar Grid Mock */}
                            <div className="grid grid-cols-7 border-b border-secondary bg-secondary/30 min-w-[700px]">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <div key={day} className="py-3 text-center text-xs font-bold text-quaternary uppercase tracking-widest">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 grid-rows-5 h-[650px] min-w-[700px]">
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <div key={i} className="border-r border-b border-secondary p-3 group hover:bg-secondary/20 transition-colors last:border-r-0 relative">
                                        <span className={`text-sm font-semibold ${(i < 3 || i > 33) ? 'text-quaternary' : 'text-secondary'}`}>
                                            {(i % 31) + 1}
                                        </span>
                                        {i === 12 && (
                                            <div className="mt-2 p-2 bg-brand-secondary border-l-4 border-brand-solid rounded-lg text-xs font-semibold text-brand-secondary shadow-sm">
                                                <p className="truncate">Asset Management 101</p>
                                                <p className="text-[10px] opacity-80">14:00 - 15:30</p>
                                            </div>
                                        )}
                                        {i === 15 && (
                                            <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-600 rounded-lg text-xs font-semibold text-blue-700 shadow-sm">
                                                <p className="truncate">Tax Strategy Q&A</p>
                                                <p className="text-[10px] opacity-80">11:00 - 12:00</p>
                                            </div>
                                        )}
                                        {i === 22 && (
                                            <div className="mt-2 p-2 bg-success-50 border-l-4 border-success-600 rounded-lg text-xs font-semibold text-success-700 shadow-sm">
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
                            <h3 className="text-lg font-bold text-primary">Top Rated Seminars</h3>
                            {[
                                { title: 'Advanced Underwriting', speaker: 'David Goggins', time: 'Dec 22, 10:00 AM', attendees: '45/50', initials: 'DG' },
                                { title: 'Legal Compliance 2026', speaker: 'Sarah Jenkins', time: 'Jan 5, 2:00 PM', attendees: '128/200', initials: 'SJ' },
                            ].map((sem, i) => (
                                <div key={i} className="bg-primary border border-secondary p-5 rounded-2xl shadow-xs flex flex-col gap-4">
                                    <div>
                                        <h4 className="font-bold text-primary mb-1">{sem.title}</h4>
                                        <div className="flex items-center gap-2 text-xs text-tertiary">
                                            <Clock className="size-3" />
                                            {sem.time}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar size="xs" initials={sem.initials} />
                                            <span className="text-xs font-medium text-secondary">{sem.speaker}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-secondary font-medium">
                                            <Users01 className="size-3" />
                                            {sem.attendees}
                                        </div>
                                    </div>
                                    <Button color="secondary" size="sm" className="w-full">Register Now</Button>
                                </div>
                            ))}
                        </section>

                        <section className="bg-secondary/40 rounded-2xl p-6 border border-secondary border-dashed flex flex-col items-center text-center gap-3">
                            <div className="p-3 bg-primary rounded-full shadow-sm">
                                <MarkerPin01 className="size-6 text-brand-solid" />
                            </div>
                            <h4 className="font-bold text-primary">In-Person Meetups</h4>
                            <p className="text-sm text-tertiary">Discover owners in your city for local networking events.</p>
                            <Button color="link-color" size="sm">Explore local groups</Button>
                        </section>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
