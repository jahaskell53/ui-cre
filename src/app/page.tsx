"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Heart, MessageCircle01, Share01, Bookmark, MessageChatSquare, BarChartSquare01 } from "@untitledui/icons";

export default function FeedPage() {
    return (
        <MainLayout>
            <div className="flex flex-col gap-10">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Master Feed</h1>
                        <p className="text-lg text-tertiary">Curated multi-family intelligence and community insights.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button color="secondary" iconLeading={Bookmark}>Saved</Button>
                        <Button color="primary" iconLeading={MessageChatSquare}>New Post</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        {/* News Feed */}
                        <section className="flex flex-col gap-6">
                            <div className="flex justify-between items-center border-b border-secondary pb-4">
                                <h2 className="text-xl font-semibold text-primary">Industry Intelligence</h2>
                                <button className="text-sm font-semibold text-brand-solid hover:text-brand-tertiary">View all</button>
                            </div>

                            <div className="grid gap-8">
                                {[
                                    {
                                        category: 'Market Analysis',
                                        title: 'The Shift from Value-Add to Core-Plus in Secondary Markets',
                                        summary: 'As interest rates stabilize, institutional equity is pivoting towards newer assets with lower operational risk. Here is what it means for your portfolio...',
                                        author: 'Elena Rodriguez',
                                        role: 'Head of Research, PropEdge',
                                        time: '1h ago',
                                        initials: 'ER'
                                    },
                                    {
                                        category: 'Legislative Update',
                                        title: 'New Rental Caps in Florida: What Every Owner Needs to Know',
                                        summary: 'The latest senate bill proposes significant changes to annual rent increase limits in designated high-growth zones. Compliance starts in Q3...',
                                        author: 'Marcus Thorne',
                                        role: 'Legal Counsel',
                                        time: '4h ago',
                                        initials: 'MT'
                                    }
                                ].map((item, i) => (
                                    <article key={i} className="bg-primary border border-secondary rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col md:flex-row">
                                        <div className="w-full md:w-48 h-48 md:h-auto bg-secondary shrink-0 relative">
                                            <div className="absolute inset-0 flex items-center justify-center text-quaternary font-medium">Article Image</div>
                                        </div>
                                        <div className="p-6 flex flex-col justify-between flex-1">
                                            <div>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className="text-xs font-bold text-brand-solid uppercase tracking-widest">{item.category}</span>
                                                    <span className="w-1 h-1 rounded-full bg-quaternary" />
                                                    <span className="text-sm text-tertiary">{item.time}</span>
                                                </div>
                                                <h3 className="text-xl font-bold text-primary mb-3 leading-snug">{item.title}</h3>
                                                <p className="text-secondary text-base mb-6 line-clamp-2">{item.summary}</p>
                                            </div>
                                            <div className="flex items-center justify-between mt-auto">
                                                <div className="flex items-center gap-3">
                                                    <Avatar size="sm" initials={item.initials} />
                                                    <div>
                                                        <p className="text-sm font-semibold text-primary leading-tight">{item.author}</p>
                                                        <p className="text-xs text-tertiary">{item.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button color="tertiary" size="sm" iconLeading={Heart}>12</Button>
                                                    <Button color="tertiary" size="sm" iconLeading={MessageCircle01}>4</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="flex flex-col gap-10">
                        {/* Social / Activity Sidebar */}
                        <section className="flex flex-col gap-6">
                            <h2 className="text-xl font-semibold text-primary border-b border-secondary pb-4">Social Network</h2>
                            <div className="bg-primary border border-secondary rounded-2xl divide-y divide-secondary overflow-hidden shadow-sm">
                                {[
                                    { name: 'John Peterson', action: 'acquired', target: '24 units in Dallas', time: '12m ago', initials: 'JP' },
                                    { name: 'Sarah Wu', action: 'shared', target: 'Tax Strategy Guide', time: '1h ago', initials: 'SW' },
                                    { name: 'Michael Chen', action: 'raised', target: 'JV Equity ($2.4M)', time: '3h ago', initials: 'MC' },
                                    { name: 'Aria Malik', action: 'is looking for', target: 'LPM in Austin', time: '5h ago', initials: 'AM' },
                                ].map((act, i) => (
                                    <div key={i} className="p-5 flex gap-4 hover:bg-secondary/30 transition-colors">
                                        <Avatar size="md" initials={act.initials} status={i === 0 ? 'online' : undefined} />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm text-primary font-bold">{act.name}</p>
                                                <span className="text-[10px] text-quaternary font-medium uppercase">{act.time}</span>
                                            </div>
                                            <p className="text-sm text-secondary leading-relaxed">
                                                {act.action} <span className="text-brand-solid font-semibold">{act.target}</span>
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div className="p-4 bg-secondary/20 text-center">
                                    <button className="text-sm font-semibold text-secondary hover:text-primary">View all network activity</button>
                                </div>
                            </div>
                        </section>

                        {/* Quick Insights Widget */}
                        <section className="bg-brand-solid rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-2">Portfolio Health</h3>
                                <p className="text-brand-secondary text-sm mb-6">Your holdings are performing 12% above market average.</p>
                                <div className="flex items-end gap-3 mb-6">
                                    <span className="text-4xl font-bold">96.4%</span>
                                    <span className="text-sm text-brand-secondary mb-1">avg. occupancy</span>
                                </div>
                                <Button className="w-full bg-white text-brand-solid hover:bg-brand-secondary border-none font-bold">Manage Holdings</Button>
                            </div>
                            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                                <BarChartSquare01 className="size-32" />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
