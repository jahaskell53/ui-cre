"use client";

/**
 * PersonDetailSidebar - Resizable sidebar for the Person Detail View
 * 
 * Used in: src/app/people/[id]/page.tsx
 * 
 * This component displays additional metadata and information in a resizable sidebar
 * on the Person Detail View page. It shows network strength, related people,
 * properties, sources, and groups. The panel width is adjustable via the panelWidth prop.
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parse, isValid } from "date-fns";
import { CellularIcon, MailIcon, LocationIcon } from "../icons";
import type { Person, TimelineItem } from "../types";

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
import { PersonPropertyMap } from "@/components/application/map/person-property-map";

// Helper function to parse date strings from timeline
function parseTimelineDate(dateStr: string): Date | null {
  // Try parsing relative dates like "1d", "28d", "4 weeks ago"
  if (dateStr.includes('ago')) {
    // This is a relative date, we can't parse it accurately without context
    // Return null to indicate we can't parse it
    return null;
  }
  
  // Try parsing formats like "Nov 21 2025"
  const formats = [
    'MMM d yyyy',
    'MMM dd yyyy',
    'MMM d, yyyy',
    'MMM dd, yyyy',
    'MMM d',
    'MMM dd',
  ];
  
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
  const emails = timeline.filter(item => item.type === 'email');
  const meetings = timeline.filter(item => item.type === 'meeting');
  
  // Parse dates and find most recent
  const emailDates = emails
    .map(item => parseTimelineDate(item.date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime());
  
  const meetingDates = meetings
    .map(item => parseTimelineDate(item.date))
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

// Clock icon for the sidebar
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6V10L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// Star icon for the sidebar
function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill={filled ? "currentColor" : "none"} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1L8.545 4.76L12.5 5.27L9.75 7.94L10.455 11.87L7 10.03L3.545 11.87L4.25 7.94L1.5 5.27L5.455 4.76L7 1Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Phone icon for contact information
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

interface PersonDetailSidebarProps {
  person: Person;
  onToggleStar: (e: React.MouseEvent) => void;
  firstName: string;
  panelWidth: number;
}

export function PersonDetailSidebar({ person, onToggleStar, firstName, panelWidth }: PersonDetailSidebarProps) {
  const [networkStrength, setNetworkStrength] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");

  // Fetch network strength from backend
  useEffect(() => {
    const fetchNetworkStrength = async () => {
      try {
        const response = await fetch(`/api/people/network-strength?id=${person.id}`);
        if (response.ok) {
          const data = await response.json();
          setNetworkStrength(data.networkStrength || "MEDIUM");
        }
      } catch (error) {
        console.error("Error fetching network strength:", error);
      }
    };

    if (person?.id) {
      fetchNetworkStrength();
    }
  }, [person?.id]);
  
  // Calculate interaction stats from timeline
  const stats = calculateInteractionStats(person.timeline);
  
  // Format the sources text
  const formatSourcesText = () => {
    if (!stats.hasInteractions) {
      return "No interactions yet";
    }
    
    const parts: string[] = [];
    
    // Determine most recent interaction overall (for "last chatted")
    const mostRecentInteraction = stats.mostRecentEmail && stats.mostRecentMeeting
      ? (stats.mostRecentEmail.getTime() > stats.mostRecentMeeting.getTime() 
          ? { type: 'email' as const, date: stats.mostRecentEmail }
          : { type: 'meeting' as const, date: stats.mostRecentMeeting })
      : stats.mostRecentEmail 
        ? { type: 'email' as const, date: stats.mostRecentEmail }
        : stats.mostRecentMeeting
          ? { type: 'meeting' as const, date: stats.mostRecentMeeting }
          : null;
    
    // Last chat (most recent interaction)
    if (mostRecentInteraction) {
      const timeAgo = formatDistanceToNow(mostRecentInteraction.date, { addSuffix: true });
      const via = mostRecentInteraction.type === 'email' ? 'via email' : 'in a meeting';
      parts.push(`You last chatted with ${firstName} ${timeAgo} ${via}`);
    }
    
    // Meetings count and most recent
    if (stats.meetingCount > 0) {
      const meetingText = stats.meetingCount === 1 
        ? "1 meeting" 
        : `${stats.meetingCount} meetings`;
      
      if (stats.mostRecentMeeting) {
        const meetingTimeAgo = formatDistanceToNow(stats.mostRecentMeeting, { addSuffix: true });
        parts.push(`You've had ${meetingText}, most recently ${meetingTimeAgo}`);
      } else {
        parts.push(`You've had ${meetingText}`);
      }
    }
    
    // Email count and most recent
    if (stats.emailCount > 0) {
      const emailText = stats.emailCount === 1 
        ? "1 time" 
        : `${stats.emailCount} times`;
      
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
    <div
      className="border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0"
      style={{ width: `${panelWidth}px` }}
    >
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

          {/* History */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">History</h3>
            {stats.hasInteractions && (
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                {formatSourcesText()}
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Last Updated</span>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {person.updated_at
                    ? formatDistanceToNow(new Date(person.updated_at), { addSuffix: true }).replace(/^about /i, '')
                    : "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">Created</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {person.created_at
                    ? formatDistanceToNow(new Date(person.created_at), { addSuffix: true }).replace(/^about /i, '')
                    : "Unknown"}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Contact Information */}
          {(person.email || person.phone) && (
            <>
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Contact Information
                </h3>
                {person.email && (
                  <div className="flex items-center gap-2 mb-3">
                    <MailIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <a
                      href={`mailto:${person.email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {person.email}
                    </a>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      Email
                    </span>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <a
                      href={`tel:${person.phone}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {person.phone}
                    </a>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      Phone
                    </span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />
            </>
          )}

          {/* Properties */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Properties
            </h3>
            <div className="space-y-4">
              {/* Home Address */}
              {person.address && (
                <div>
                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Home
                  </h4>
                  <div className="flex items-start gap-2">
                    <LocationIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                    <a
                      href={getGoogleMapsUrl(person.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline leading-relaxed flex-1"
                    >
                      {getStreetAddress(person.address)}
                    </a>
                  </div>
                </div>
              )}
              {/* Owned Addresses */}
              {person.owned_addresses &&
                person.owned_addresses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Owned
                    </h4>
                    <div className="space-y-2">
                      {person.owned_addresses.map((address, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <LocationIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                          <a
                            href={getGoogleMapsUrl(address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline leading-relaxed flex-1"
                          >
                            {getStreetAddress(address)}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              {!person.address && (!person.owned_addresses || person.owned_addresses.length === 0) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No properties yet
                </p>
              )}
            </div>
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
              onClick={onToggleStar}
            >
              <StarIcon className={cn("w-3 h-3 mr-1", person.starred ? "text-amber-400" : "text-gray-400")} filled={person.starred} />
              STARRED
            </Badge>
          </div>

          {/* Property Map */}
          {((person.address || (person.owned_addresses && person.owned_addresses.length > 0))) && (
            <>
              <Separator className="my-4" />
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Property Map</h3>
                <PersonPropertyMap
                  addresses={[
                    ...(person.address ? [person.address] : []),
                    ...(person.owned_addresses || []),
                  ]}
                  personName={person.name}
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

