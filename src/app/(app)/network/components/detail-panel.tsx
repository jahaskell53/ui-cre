"use client";

/**
 * DetailPanel - Resizable side panel for the People page
 *
 * Used in: src/app/people/page.tsx
 *
 * This component displays person details in a resizable side panel on the main People page.
 * It shows profile information, network strength, history, related people, properties,
 * and contact information. The panel width is adjustable via the panelWidth prop.
 */
import { useEffect, useState } from "react";
import { formatDistanceToNow, isValid, parse } from "date-fns";
import { PersonPropertyMap } from "@/components/application/map/person-property-map";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, CellularIcon, LocationIcon, MailIcon } from "../icons";
import type { Person, TimelineItem } from "../types";
import { generateAuroraGradient, getInitials } from "../utils";

// Note icon for notes
function NoteIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 6.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M6 9.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

// Helper function to extract street address (part before city)
function getStreetAddress(fullAddress: string): string {
    if (!fullAddress) return "";
    // Split by comma and take the first part (street address)
    const parts = fullAddress.split(",");
    return parts[0]?.trim() || fullAddress;
}

// Helper function to generate Google Maps URL
function getGoogleMapsUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Helper function to parse date strings from timeline
function parseTimelineDate(dateStr: string): Date | null {
    // Try parsing relative dates like "1d", "28d", "4 weeks ago"
    if (dateStr.includes("ago")) {
        // This is a relative date, we can't parse it accurately without context
        // Return null to indicate we can't parse it
        return null;
    }

    // Try parsing formats like "Nov 21 2025"
    const formats = ["MMM d yyyy", "MMM dd yyyy", "MMM d, yyyy", "MMM dd, yyyy", "MMM d", "MMM dd"];

    for (const format of formats) {
        try {
            const parsed = parse(dateStr, format, new Date());
            if (isValid(parsed)) {
                return parsed;
            }
        } catch {
            // Continue to next format
        }
    }

    // Try ISO date format
    const isoDate = new Date(dateStr);
    if (isValid(isoDate)) {
        return isoDate;
    }

    return null;
}

// Calculate interaction stats from timeline
function calculateInteractionStats(timeline: TimelineItem[] = []) {
    const emails = timeline.filter((item) => item.type === "email");
    const meetings = timeline.filter((item) => item.type === "meeting");

    // Parse dates and find most recent
    const emailDates = emails
        .map((item) => parseTimelineDate(item.date))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime());

    const meetingDates = meetings
        .map((item) => parseTimelineDate(item.date))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime());

    const mostRecentEmail = emailDates[0] || null;
    const mostRecentMeeting = meetingDates[0] || null;

    return {
        emailCount: emails.length,
        meetingCount: meetings.length,
        mostRecentEmail,
        mostRecentMeeting,
        hasInteractions: emails.length > 0 || meetings.length > 0,
    };
}

interface DetailPanelProps {
    selectedPerson: Person | null;
    panelWidth: number;
}

export function DetailPanel({ selectedPerson, panelWidth }: DetailPanelProps) {
    const [networkStrength, setNetworkStrength] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");

    // Fetch network strength from backend
    useEffect(() => {
        if (!selectedPerson?.id) {
            setNetworkStrength("MEDIUM");
            return;
        }

        const fetchNetworkStrength = async () => {
            try {
                const response = await fetch(`/api/people/network-strength?id=${selectedPerson.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setNetworkStrength(data.networkStrength || "MEDIUM");
                }
            } catch (error) {
                console.error("Error fetching network strength:", error);
            }
        };

        fetchNetworkStrength();
    }, [selectedPerson?.id]);

    // Check if person was imported via mail (has email interactions in timeline)
    const isImportedViaMail = (person: Person | null): boolean => {
        if (!person || !person.timeline) return false;
        return person.timeline.some((item) => item.type === "email");
    };

    // Format the sources text
    const formatSourcesText = (person: Person) => {
        const firstName = person.name.split(" ")[0];
        const stats = calculateInteractionStats(person.timeline);

        if (!stats.hasInteractions) {
            return "No interactions yet";
        }

        const parts: string[] = [];

        // Determine most recent interaction overall (for "last chatted")
        const mostRecentInteraction =
            stats.mostRecentEmail && stats.mostRecentMeeting
                ? stats.mostRecentEmail.getTime() > stats.mostRecentMeeting.getTime()
                    ? { type: "email" as const, date: stats.mostRecentEmail }
                    : { type: "meeting" as const, date: stats.mostRecentMeeting }
                : stats.mostRecentEmail
                  ? { type: "email" as const, date: stats.mostRecentEmail }
                  : stats.mostRecentMeeting
                    ? { type: "meeting" as const, date: stats.mostRecentMeeting }
                    : null;

        // Last chat (most recent interaction)
        if (mostRecentInteraction) {
            const timeAgo = formatDistanceToNow(mostRecentInteraction.date, { addSuffix: true });
            const via = mostRecentInteraction.type === "email" ? "via email" : "in a meeting";
            parts.push(`You last chatted with ${firstName} ${timeAgo} ${via}`);
        }

        // Meetings count and most recent
        if (stats.meetingCount > 0) {
            const meetingText = stats.meetingCount === 1 ? "1 meeting" : `${stats.meetingCount} meetings`;

            if (stats.mostRecentMeeting) {
                const meetingTimeAgo = formatDistanceToNow(stats.mostRecentMeeting, { addSuffix: true });
                parts.push(`You've had ${meetingText}, most recently ${meetingTimeAgo}`);
            } else {
                parts.push(`You've had ${meetingText}`);
            }
        }

        // Email count and most recent
        if (stats.emailCount > 0) {
            const emailText = stats.emailCount === 1 ? "1 time" : `${stats.emailCount} times`;

            if (stats.mostRecentEmail) {
                const emailTimeAgo = formatDistanceToNow(stats.mostRecentEmail, { addSuffix: true });
                parts.push(`and emailed them ${emailText}, most recently ${emailTimeAgo}`);
            } else {
                parts.push(`and emailed them ${emailText}`);
            }
        }

        return parts.join(". ") + ".";
    };

    return (
        <div className="flex h-screen flex-shrink-0 flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-800/50" style={{ width: `${panelWidth}px` }}>
            <ScrollArea className="h-full flex-1">
                <div className="p-4">
                    {selectedPerson ? (
                        <>
                            {/* Profile Header */}
                            <div className="mb-6 flex flex-col items-center">
                                <Avatar className="mb-3 h-20 w-20">
                                    <AvatarFallback
                                        className="text-2xl font-medium text-white"
                                        style={{ background: generateAuroraGradient(selectedPerson.name) }}
                                    >
                                        {getInitials(selectedPerson.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <h2 className="max-w-full truncate px-2 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {selectedPerson.name}
                                </h2>
                                <div className="mt-1.5 flex items-center gap-2">
                                    {isImportedViaMail(selectedPerson) && (
                                        <Badge
                                            variant="secondary"
                                            className="bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                        >
                                            AUTO
                                        </Badge>
                                    )}
                                    {selectedPerson.category && (
                                        <Badge
                                            variant="secondary"
                                            className="bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        >
                                            {selectedPerson.category}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Network Strength */}
                            <div className="mb-6">
                                <h3 className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Network Strength</h3>
                                <div className="flex items-center gap-2">
                                    <CellularIcon strength={networkStrength} className="h-4 w-4" />
                                    <Badge
                                        variant="secondary"
                                        className="bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                    >
                                        {networkStrength}
                                    </Badge>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            {/* History */}
                            <div className="mb-6">
                                <h3 className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">History</h3>
                                {(() => {
                                    const stats = calculateInteractionStats(selectedPerson.timeline);
                                    return (
                                        stats.hasInteractions && (
                                            <p className="mb-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{formatSourcesText(selectedPerson)}</p>
                                        )
                                    );
                                })()}
                                {selectedPerson.timeline && selectedPerson.timeline.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedPerson.timeline.slice(-5).map((item, index) => {
                                            let Icon;
                                            let bgColorClass;
                                            let textColorClass;

                                            if (item.type === "email") {
                                                Icon = MailIcon;
                                                const iconColor = item.iconColor || "blue";
                                                bgColorClass =
                                                    iconColor === "purple" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-blue-100 dark:bg-blue-900/30";
                                                textColorClass =
                                                    iconColor === "purple" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400";
                                            } else if (item.type === "note") {
                                                Icon = NoteIcon;
                                                bgColorClass = "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700";
                                                textColorClass = "text-gray-500 dark:text-gray-400";
                                            } else {
                                                Icon = CalendarIcon;
                                                const iconColor = item.iconColor || "blue";
                                                bgColorClass =
                                                    iconColor === "purple" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-blue-100 dark:bg-blue-900/30";
                                                textColorClass =
                                                    iconColor === "purple" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400";
                                            }

                                            return (
                                                <div key={index} className="flex gap-2">
                                                    <div className={`h-4 w-4 ${bgColorClass} mt-0.5 flex flex-shrink-0 items-center justify-center rounded`}>
                                                        <Icon className={`h-2.5 w-2.5 ${textColorClass}`} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs break-words text-gray-700 dark:text-gray-300">{item.text}</p>
                                                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{item.date}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">No history yet</p>
                                )}
                                {/* Metadata */}
                                <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Last Updated</span>
                                        </div>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                            {selectedPerson.updated_at
                                                ? formatDistanceToNow(new Date(selectedPerson.updated_at), { addSuffix: true }).replace(/^about /i, "")
                                                : "Unknown"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">Created</span>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                            {selectedPerson.created_at
                                                ? formatDistanceToNow(new Date(selectedPerson.created_at), { addSuffix: true }).replace(/^about /i, "")
                                                : "Unknown"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            {/* Properties */}
                            <div className="mb-6">
                                <h3 className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Properties</h3>
                                <div className="space-y-4">
                                    {/* Home Address */}
                                    {selectedPerson.address && (
                                        <div>
                                            <h4 className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Home</h4>
                                            <div className="flex items-start gap-2">
                                                <LocationIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                                <a
                                                    href={getGoogleMapsUrl(selectedPerson.address)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 text-xs leading-relaxed text-blue-600 hover:underline dark:text-blue-400"
                                                >
                                                    {getStreetAddress(selectedPerson.address)}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {/* Owned Addresses */}
                                    {selectedPerson.owned_addresses && selectedPerson.owned_addresses.length > 0 && (
                                        <div>
                                            <h4 className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Owned</h4>
                                            <div className="space-y-2">
                                                {selectedPerson.owned_addresses.map((address, index) => (
                                                    <div key={index} className="flex items-start gap-2">
                                                        <LocationIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                                        <a
                                                            href={getGoogleMapsUrl(address)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 text-xs leading-relaxed text-blue-600 hover:underline dark:text-blue-400"
                                                        >
                                                            {getStreetAddress(address)}
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {!selectedPerson.address && (!selectedPerson.owned_addresses || selectedPerson.owned_addresses.length === 0) && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No properties yet</p>
                                    )}
                                </div>
                            </div>

                            <Separator className="my-4" />

                            {/* Contact Information */}
                            {(selectedPerson.email || selectedPerson.phone) && (
                                <>
                                    <div className="mb-6">
                                        <h3 className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                            Contact Information
                                        </h3>
                                        {selectedPerson.email && (
                                            <div className="mb-3 flex items-center gap-2">
                                                <MailIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                                                <a
                                                    href={`mailto:${selectedPerson.email}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                                >
                                                    {selectedPerson.email}
                                                </a>
                                                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Email</span>
                                            </div>
                                        )}
                                        {selectedPerson.phone && (
                                            <div className="flex items-center gap-2">
                                                <svg
                                                    className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={1.5}
                                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                    />
                                                </svg>
                                                <a href={`tel:${selectedPerson.phone}`} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                                                    {selectedPerson.phone}
                                                </a>
                                                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Phone</span>
                                            </div>
                                        )}
                                    </div>

                                    <Separator className="my-4" />
                                </>
                            )}

                            {/* Property Map */}
                            {(selectedPerson.address || (selectedPerson.owned_addresses && selectedPerson.owned_addresses.length > 0)) && (
                                <>
                                    <Separator className="my-4" />
                                    <div className="mb-6">
                                        <h3 className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Property Map</h3>
                                        <PersonPropertyMap
                                            addresses={[...(selectedPerson.address ? [selectedPerson.address] : []), ...(selectedPerson.owned_addresses || [])]}
                                            personName={selectedPerson.name}
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Select a person to view details</div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
