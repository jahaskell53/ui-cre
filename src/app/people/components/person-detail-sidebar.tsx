"use client";

/**
 * PersonDetailSidebar - Fixed-width sidebar for the Person Detail View
 * 
 * Used in: src/app/people/person-detail-view.tsx
 * 
 * This component displays additional metadata and information in a fixed-width (280px)
 * sidebar on the Person Detail View page. It shows network strength, related people,
 * properties, sources, and groups. Unlike DetailPanel, this sidebar has a fixed width
 * and is part of the full-page person detail view layout.
 */
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CellularIcon, MailIcon, EmojiIcon } from "../icons";
import type { Person } from "../types";

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

interface PersonDetailSidebarProps {
  person: Person;
  onToggleStar: (person: Person, e: React.MouseEvent) => void;
}

export function PersonDetailSidebar({ person, onToggleStar }: PersonDetailSidebarProps) {
  const networkStrength: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  return (
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

          {/* Properties */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Properties</h3>
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
              You last chatted with {person.name.split(' ')[0]} 1 month ago via email. You've had two meetings, most recently 4 weeks ago, and emailed them 3 times, most recently 1 month ago.
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
            {person.starred && (
              <Badge
                variant="secondary"
                className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 cursor-pointer"
                onClick={(e) => onToggleStar(person, e)}
              >
                <StarIcon className="w-3 h-3 mr-1 text-amber-400" filled />
                STARRED
              </Badge>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

