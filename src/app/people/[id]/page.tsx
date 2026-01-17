"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Button } from "@/components/ui/button";

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
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 8.5H6.51M10 8.5H10.01M13.5 8.5H13.51M6 13.5L3.5 16V5.5C3.5 4.4 4.4 3.5 5.5 3.5H14.5C15.6 3.5 16.5 4.4 16.5 5.5V11.5C16.5 12.6 15.6 13.5 14.5 13.5H6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6V10L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6.5" y="6.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 6.5V5C13.5 4.17 12.83 3.5 12 3.5H5C4.17 3.5 3.5 4.17 3.5 5V12C3.5 12.83 4.17 13.5 5 13.5H6.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 3.5L16.5 5.5L6.5 15.5L3.5 16.5L4.5 13.5L14.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LabelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4.5C2 3.4 2.9 2.5 4 2.5H7.59C8.12 2.5 8.63 2.71 9 3.09L13.41 7.5C14.2 8.29 14.2 9.54 13.41 10.33L10.33 13.41C9.54 14.2 8.29 14.2 7.5 13.41L3.09 9C2.71 8.63 2.5 8.12 2.5 7.59V4.5H2Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.5 1.5V4M5.5 1.5V4M2 6.5H14M3 3H13C13.5523 3 14 3.44772 14 4V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V4C2 3.44772 2.44772 3 3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4.5L7.2 8.3C7.68 8.62 8.32 8.62 8.8 8.3L14 4.5M3.2 13H12.8C13.46 13 14 12.46 14 11.8V4.2C14 3.54 13.46 3 12.8 3H3.2C2.54 3 2 3.54 2 4.2V11.8C2 12.46 2.54 13 3.2 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmojiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="7" r="0.75" fill="currentColor" />
      <circle cx="10" cy="7" r="0.75" fill="currentColor" />
      <path d="M5.5 9.5C6 10.5 7 11 8 11C9 11 10 10.5 10.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill={filled ? "currentColor" : "none"} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1L8.545 4.76L12.5 5.27L9.75 7.94L10.455 11.87L7 10.03L3.545 11.87L4.25 7.94L1.5 5.27L5.455 4.76L7 1Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CellularIcon({ className, strength }: { className?: string; strength: "HIGH" | "MEDIUM" | "LOW" }) {
  const colorClass = strength === "HIGH" ? "text-green-500" : strength === "MEDIUM" ? "text-orange-500" : "text-yellow-500";
  return (
    <svg className={cn(className, colorClass)} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="10" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="9" y="7" width="2" height="7" rx="0.5" fill="currentColor" />
      <rect x="6" y="4" width="2" height="10" rx="0.5" fill={strength === "HIGH" ? "currentColor" : strength === "MEDIUM" ? "currentColor" : "#E5E7EB"} />
      <rect x="3" y="1" width="2" height="13" rx="0.5" fill={strength === "HIGH" ? "currentColor" : "#E5E7EB"} />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 9.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5H17M8 5V3.5C8 2.67 8.67 2 9.5 2H10.5C11.33 2 12 2.67 12 3.5V5M15.5 5V15.5C15.5 16.33 14.83 17 14 17H6C5.17 17 4.5 16.33 4.5 15.5V5H15.5ZM8.5 8.5V13.5M11.5 8.5V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Timeline item interface
interface TimelineItem {
  id?: string;
  type: 'meeting' | 'import' | 'email' | 'note' | 'other';
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

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("timeline");
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id?: string, index: number } | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  const personId = params.id as string;

  useEffect(() => {
    const fetchPerson = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/people?id=${personId}`);
        if (!response.ok) {
          throw new Error("Person not found");
        }
        const data = await response.json();
        setPerson(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load person");
      } finally {
        setLoading(false);
      }
    };

    if (personId) {
      fetchPerson();
    }
  }, [personId]);

  const handleBack = () => {
    router.push("/people");
  };

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!person) return;

    const newStarredState = !person.starred;
    setPerson({ ...person, starred: newStarredState });

    try {
      const response = await fetch(`/api/people?id=${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: newStarredState }),
      });

      if (!response.ok) {
        throw new Error('Failed to update star status');
      }

      const updatedPerson = await response.json();
      setPerson(updatedPerson);
    } catch (error) {
      console.error('Error toggling star:', error);
      setPerson({ ...person, starred: !newStarredState });
    }
  };

  const handleSaveNote = async () => {
    if (!person || !noteText.trim() || isSavingNote) return;

    setIsSavingNote(true);
    const noteTextToSave = noteText.trim();

    try {
      const currentTimeline = person.timeline || [];
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      const newNote: TimelineItem = {
        id: crypto.randomUUID(),
        type: 'note',
        text: noteTextToSave,
        date: dateStr,
        iconColor: 'green',
      };

      const updatedTimeline = [newNote, ...currentTimeline];

      const response = await fetch(`/api/people?id=${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: updatedTimeline }),
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      const updatedPerson = await response.json();
      setPerson(updatedPerson);
      setNoteText("");
    } catch (error) {
      console.error('Error saving note:', error);
      setError(error instanceof Error ? error.message : 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  const confirmDeleteNote = async () => {
    if (!person || !noteToDelete) return;
    
    setIsDeletingNote(true);
    try {
      const currentTimeline = [...(person.timeline || [])];
      let updatedTimeline;
      
      if (noteToDelete.id) {
        updatedTimeline = currentTimeline.filter(item => item.id !== noteToDelete.id);
      } else {
        // Fallback for notes created before IDs were added
        updatedTimeline = currentTimeline.filter((_, i) => i !== noteToDelete.index);
      }

      const response = await fetch(`/api/people?id=${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: updatedTimeline }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      const updatedPerson = await response.json();
      setPerson(updatedPerson);
      setNoteToDelete(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete note');
    } finally {
      setIsDeletingNote(false);
    }
  };

  const handleDeleteNote = (noteId: string | undefined, index: number) => {
    setNoteToDelete({ id: noteId, index });
  };

  const handleCancelNote = () => {
    setNoteText("");
  };

  const getInitials = (name: string) => {
    const parts = name.split(/[\s@]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0]?.slice(0, 2).toUpperCase() || "??";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error || "Person not found"}</div>
          <button
            onClick={handleBack}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to People
          </button>
        </div>
      </div>
    );
  }

  // Use saved timeline or fall back to mock data
  const nameParts = (person?.name || "").split(' ');
  const firstName = nameParts[0] || "Person";

  const savedTimeline = person.timeline || [];
  const displayTimeline: TimelineItem[] = savedTimeline.length > 0 ? savedTimeline : [
    { type: 'import', text: `${firstName} imported via Calendar`, date: '1d', iconColor: 'blue' },
    { type: 'meeting', text: `You met with ${firstName} Greenpoint <> Capitalize`, date: '28d', iconColor: 'blue', link: 'Greenpoint <> Capitalize' },
    { type: 'email', text: `You emailed ${firstName} Re: Follow-up`, date: 'Nov 21 2025', iconColor: 'purple', link: 'Re: Follow-up' },
    { type: 'meeting', text: `You met with ${firstName} Reconnect`, date: 'Nov 7 2025', iconColor: 'blue', link: 'Reconnect' },
    { type: 'email', text: `You emailed ${firstName} Re: Follow-up`, date: 'Nov 5 2025', iconColor: 'purple', link: 'Re: Follow-up' },
  ];

  const networkStrength: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={handleBack}
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
                {/* Timeline entries */}
                <div className="relative space-y-0">
                  {/* Vertical line through icons */}
                  <div className="absolute left-3 top-0 bottom-0 w-[1px] bg-gray-200 dark:bg-gray-800 -translate-x-1/2 z-0" />

                  {/* Note Input Entry */}
                  <div className="relative z-10 py-4">
                    {/* Header - only shown when editing or has text */}
                    {(isNoteFocused || noteText.trim()) && (
                      <div className="flex items-center gap-3 mb-2 ml-9">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <LabelIcon className="w-4 h-4" />
                          <span>Adding a note...</span>
                        </div>
                        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 mr-1">now</span>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      {/* Timeline Icon */}
                      <div className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded flex items-center justify-center flex-shrink-0 shadow-sm z-10">
                        <NoteIcon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </div>

                      {/* Input Box */}
                      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/30 dark:bg-gray-800/30">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onFocus={() => setIsNoteFocused(true)}
                          onBlur={() => setIsNoteFocused(false)}
                          placeholder="Add a note..."
                          className="w-full min-h-[80px] resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          {noteText.trim() && (
                            <button
                              onClick={handleCancelNote}
                              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            onClick={handleSaveNote}
                            disabled={!noteText.trim() || isSavingNote}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingNote ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {displayTimeline.map((item, index) => {
                    let Icon;
                    let iconBgColor;
                    let iconTextColor;

                    if (item.type === 'email') {
                      Icon = MailIcon;
                      iconBgColor = item.iconColor === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
                      iconTextColor = item.iconColor === 'purple' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400';
                    } else if (item.type === 'note') {
                      Icon = NoteIcon;
                      iconBgColor = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
                      iconTextColor = 'text-gray-500 dark:text-gray-400';
                    } else {
                      Icon = CalendarIcon;
                      iconBgColor = item.iconColor === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
                      iconTextColor = item.iconColor === 'purple' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400';
                    }

                    if (item.type === 'note') {
                      return (
                        <div key={index} className="relative z-10 py-4 group">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-6 h-6 ${iconBgColor} rounded flex items-center justify-center flex-shrink-0 shadow-sm`}>
                              <Icon className={`w-3.5 h-3.5 ${iconTextColor}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              You added a note
                            </span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 mr-1 group-hover:hidden">
                              {item.date}
                            </span>
                            <button
                              onClick={() => handleDeleteNote(item.id, index)}
                              className="ml-auto hidden group-hover:flex p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                              title="Delete note"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="ml-9 p-4 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl">
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {item.text}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={index} className="relative z-10 flex items-start gap-3 py-4">
                        <div className={`w-6 h-6 ${iconBgColor} rounded flex items-center justify-center flex-shrink-0 shadow-sm`}>
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
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">{item.date}</span>
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
      <div className="w-[280px] border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            {/* Clock icon top right */}
            <div className="flex justify-end mb-4">
              <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500">
                <ClockIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Network Strength */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Network Strength</h3>
              <div className="flex items-center gap-2">
                <CellularIcon strength={networkStrength} className="w-4 h-4" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{networkStrength}</span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Related People */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Related People</h3>
              <button className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                <EmojiIcon className="w-4 h-4" />
                <span>Add related people</span>
              </button>
            </div>

            <Separator className="my-4" />

            {/* History */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">History</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Last Updated</span>
                  </div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">1 DAY AGO</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-3 uppercase">Created</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">1 DAY AGO</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Sources */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Sources</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                You last chatted with {firstName} 1 month ago via email. You've had two meetings, most recently 4 weeks ago, and emailed them 3 times, most recently 1 month ago.
              </p>
              {person.email && (
                <div className="flex items-center gap-2">
                  <MailIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <a
                    href={`mailto:${person.email}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {person.email}
                  </a>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto uppercase">Email</span>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Groups */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Groups</h3>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs font-medium px-2 py-0.5 cursor-pointer",
                  person.starred
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                )}
                onClick={handleToggleStar}
              >
                <StarIcon className={cn("w-3 h-3 mr-1", person.starred ? "text-amber-400" : "text-gray-400")} filled={person.starred} />
                STARRED
              </Badge>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Modal */}
      <ModalOverlay
        isOpen={noteToDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setNoteToDelete(null)}
      >
        <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
          <Dialog className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Note</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete this note? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeletingNote}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteNote}
                disabled={isDeletingNote}
              >
                {isDeletingNote ? "Deleting..." : "Delete Note"}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
