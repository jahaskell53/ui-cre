"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonDetailSidebar } from "./components/person-detail-sidebar";
import { useState } from "react";

// Generate a deterministic hash from a string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Convert HSL to hex color
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate an aurora gradient from any unique identifier
function generateAuroraGradient(identifier: string): string {
  const hash = hashString(identifier);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 40 + (hash % 60)) % 360;
  const saturation1 = 70 + (hash % 20);
  const saturation2 = 65 + ((hash >> 8) % 25);
  const lightness1 = 60 + (hash % 15);
  const lightness2 = 55 + ((hash >> 4) % 20);
  const color1 = hslToHex(hue1, saturation1, lightness1);
  const color2 = hslToHex(hue2, saturation2, lightness2);
  const angle = 120 + (hash % 40);
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}

// Icons
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 8.5H6.51M10 8.5H10.01M13.5 8.5H13.51M6 13.5L3.5 16V5.5C3.5 4.4 4.4 3.5 5.5 3.5H14.5C15.6 3.5 16.5 4.4 16.5 5.5V11.5C16.5 12.6 15.6 13.5 14.5 13.5H6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}


function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="1" fill="currentColor"/>
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6.5" y="6.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13.5 6.5V5C13.5 4.17 12.83 3.5 12 3.5H5C4.17 3.5 3.5 4.17 3.5 5V12C3.5 12.83 4.17 13.5 5 13.5H6.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 3.5L16.5 5.5L6.5 15.5L3.5 16.5L4.5 13.5L14.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LabelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4.5C2 3.4 2.9 2.5 4 2.5H7.59C8.12 2.5 8.63 2.71 9 3.09L13.41 7.5C14.2 8.29 14.2 9.54 13.41 10.33L10.33 13.41C9.54 14.2 8.29 14.2 7.5 13.41L3.09 9C2.71 8.63 2.5 8.12 2.5 7.59V4.5H2Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor"/>
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.5 1.5V4M5.5 1.5V4M2 6.5H14M3 3H13C13.5523 3 14 3.44772 14 4V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V4C2 3.44772 2.44772 3 3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4.5L7.2 8.3C7.68 8.62 8.32 8.62 8.8 8.3L14 4.5M3.2 13H12.8C13.46 13 14 12.46 14 11.8V4.2C14 3.54 13.46 3 12.8 3H3.2C2.54 3 2 3.54 2 4.2V11.8C2 12.46 2.54 13 3.2 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6V10L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}


function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Timeline item interface
interface TimelineItem {
  type: 'meeting' | 'import' | 'email' | 'other';
  text: string;
  date: string;
  iconColor?: 'blue' | 'orange' | 'purple' | 'green';
  link?: string;
}

// Person interface
interface Person {
  id: string;
  name: string;
  starred: boolean;
  email: string | null;
  signal: boolean;
  address: string | null;
  owned_addresses?: string[];
  timeline?: TimelineItem[];
  created_at?: string;
  updated_at?: string;
}

interface PersonDetailViewProps {
  person: Person;
  onBack: () => void;
  onToggleStar: (person: Person, e: React.MouseEvent) => void;
}

export default function PersonDetailView({ person, onBack, onToggleStar }: PersonDetailViewProps) {
  const [selectedTab, setSelectedTab] = useState("timeline");

  const getInitials = (name: string) => {
    const parts = name.split(/[\s@]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0]?.slice(0, 2).toUpperCase() || "??";
  };

  // Mock timeline data for display
  const mockTimeline: TimelineItem[] = person.timeline && person.timeline.length > 0 ? person.timeline : [
    { type: 'import', text: `${person.name.split(' ')[0]} imported via Calendar`, date: '1d', iconColor: 'blue' },
    { type: 'meeting', text: `You met with ${person.name.split(' ')[0]} Greenpoint <> Capitalize`, date: '28d', iconColor: 'blue', link: 'Greenpoint <> Capitalize' },
    { type: 'email', text: `You emailed ${person.name.split(' ')[0]} Re: Alon <> Capitalize Follow-up`, date: 'Nov 21 2025', iconColor: 'purple', link: 'Re: Alon <> Capitalize Follow-up' },
    { type: 'meeting', text: `You met with ${person.name.split(' ')[0]} Alon <> Capitalize Reconnect`, date: 'Nov 7 2025', iconColor: 'blue', link: 'Alon <> Capitalize Reconnect' },
    { type: 'email', text: `You emailed ${person.name.split(' ')[0]} Re: Alon <> Capitalize Follow-up`, date: 'Nov 5 2025', iconColor: 'purple', link: 'Re: Alon <> Capitalize Follow-up' },
  ];

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          >
            <BackIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
              INVITE
            </button>
            <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
              <MessageIcon className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
              <ClockIcon className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
              <TargetIcon className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
              <CopyIcon className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
              <PencilIcon className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
              <MoreIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Header */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback
                className="text-white text-2xl font-medium"
                style={{ background: generateAuroraGradient(person.name) }}
              >
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{person.name}</h1>
              <Badge variant="secondary" className="mt-1 text-xs font-medium px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                AUTO
              </Badge>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <TabsList className="bg-transparent h-auto p-0 space-x-6">
                <TabsTrigger
                  value="timeline"
                  className="bg-transparent px-0 py-2 text-sm font-medium data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 border-b-2 border-transparent data-[state=active]:border-gray-900 dark:data-[state=active]:border-gray-100 rounded-none"
                >
                  Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="bg-transparent px-0 py-2 text-sm font-medium data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 border-b-2 border-transparent data-[state=active]:border-gray-900 dark:data-[state=active]:border-gray-100 rounded-none"
                >
                  About
                </TabsTrigger>
              </TabsList>
              <button className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                <FilterIcon className="w-4 h-4" />
                <span>FILTER</span>
              </button>
            </div>
          </div>

          <TabsContent value="timeline" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                {/* Add note input */}
                <div className="flex items-start gap-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <LabelIcon className="w-4 h-4" />
                    <span>Add a label</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span>Adding a note...</span>
                  </div>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">now</span>
                </div>

                {/* Note input box */}
                <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <ClockIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" />
                    <div className="flex-1 min-h-[60px]">
                      {/* Empty note area */}
                    </div>
                    <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Timeline entries */}
                <div className="space-y-4">
                  {mockTimeline.map((item, index) => {
                    const Icon = item.type === 'email' ? MailIcon : CalendarIcon;
                    const iconBgColor = item.iconColor === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
                    const iconTextColor = item.iconColor === 'purple' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400';

                    // Check if this is the "1 EMAILS" separator
                    if (index === 3) {
                      return (
                        <div key="emails-separator">
                          <div className="flex items-center gap-2 py-2">
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">1 EMAILS</span>
                          </div>
                          <div className="flex items-start gap-3 py-2">
                            <div className={`w-6 h-6 ${iconBgColor} rounded flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-3.5 h-3.5 ${iconTextColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {item.text.split(item.link || '')[0]}
                                {item.link && (
                                  <a href="#" className="text-gray-900 dark:text-gray-100 underline underline-offset-2 decoration-gray-400 dark:decoration-gray-500 hover:decoration-gray-600 dark:hover:decoration-gray-300">
                                    {item.link}
                                  </a>
                                )}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{item.date}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={index} className="flex items-start gap-3 py-2">
                        <div className={`w-6 h-6 ${iconBgColor} rounded flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${iconTextColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {item.link ? (
                              <>
                                {item.text.split(item.link)[0]}
                                <a href="#" className="text-gray-900 dark:text-gray-100 underline underline-offset-2 decoration-gray-400 dark:decoration-gray-500 hover:decoration-gray-600 dark:hover:decoration-gray-300">
                                  {item.link}
                                </a>
                              </>
                            ) : (
                              item.text
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{item.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="about" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">About information coming soon...</p>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Sidebar */}
      <PersonDetailSidebar person={person} onToggleStar={onToggleStar} />
    </div>
  );
}
