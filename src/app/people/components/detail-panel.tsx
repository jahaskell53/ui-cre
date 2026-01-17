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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CellularIcon, MailIcon, CalendarIcon, EmojiIcon, LocationIcon } from "../icons";
import { generateAuroraGradient, getInitials } from "../utils";
import type { Person } from "../types";

interface DetailPanelProps {
  selectedPerson: Person | null;
  panelWidth: number;
}

export function DetailPanel({ selectedPerson, panelWidth }: DetailPanelProps) {
  return (
    <div
      className="flex flex-col bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0 h-screen overflow-hidden"
      style={{ width: `${panelWidth}px` }}
    >
      <ScrollArea className="flex-1 h-full">
        <div className="p-4">
          {selectedPerson ? (
            <>
              {/* Profile Header */}
              <div className="flex flex-col items-center mb-6">
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarFallback
                    className="text-white text-2xl font-medium"
                    style={{ background: generateAuroraGradient(selectedPerson.name) }}
                  >
                    {getInitials(selectedPerson.name)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center truncate max-w-full px-2">
                  {selectedPerson.name}
                </h2>
                <Badge
                  variant="secondary"
                  className="mt-1.5 text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  AUTO
                </Badge>
              </div>

              {/* Network Strength */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Network Strength
                </h3>
                <div className="flex items-center gap-2">
                  <CellularIcon strength="HIGH" className="w-4 h-4" />
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    HIGH
                  </Badge>
                </div>
              </div>

              <Separator className="my-4" />

              {/* History */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  History
                </h3>
                {selectedPerson.timeline && selectedPerson.timeline.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPerson.timeline.map((item, index) => {
                      const iconColor = item.iconColor || "blue";
                      const bgColorClass = {
                        blue: "bg-blue-100 dark:bg-blue-900/30",
                        orange: "bg-orange-100 dark:bg-orange-900/30",
                        purple: "bg-purple-100 dark:bg-purple-900/30",
                        green: "bg-green-100 dark:bg-green-900/30",
                      }[iconColor];
                      const textColorClass = {
                        blue: "text-blue-600 dark:text-blue-400",
                        orange: "text-orange-600 dark:text-orange-400",
                        purple: "text-purple-600 dark:text-purple-400",
                        green: "text-green-600 dark:text-green-400",
                      }[iconColor];
                      const Icon = item.type === "email" ? MailIcon : CalendarIcon;

                      return (
                        <div key={index} className="flex gap-2">
                          <div
                            className={`w-4 h-4 ${bgColorClass} rounded flex items-center justify-center flex-shrink-0 mt-0.5`}
                          >
                            <Icon className={`w-2.5 h-2.5 ${textColorClass}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 dark:text-gray-300 break-words">
                              {item.text}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {item.date}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No history yet
                  </p>
                )}
                {/* Metadata */}
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Last Updated
                      </span>
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      1 hour ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                      Created
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      1 hour ago
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Related People */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Related People
                </h3>
                <button className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <EmojiIcon className="w-4 h-4" />
                  <span>Add related people</span>
                </button>
              </div>

              <Separator className="my-4" />

              {/* Properties */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Properties
                </h3>
                <div className="space-y-4">
                  {/* Home Address */}
                  {selectedPerson.address && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Home
                      </h4>
                      <div className="flex items-start gap-2">
                        <LocationIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
                          {selectedPerson.address}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Owned Addresses */}
                  {selectedPerson.owned_addresses &&
                    selectedPerson.owned_addresses.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Owned
                        </h4>
                        <div className="space-y-2">
                          {selectedPerson.owned_addresses.map((address, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <LocationIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
                                {address}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Contact Information */}
              {selectedPerson.email && (
                <>
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                      Contact Information
                    </h3>
                    <div className="flex items-center gap-2">
                      <MailIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      <a
                        href={`mailto:${selectedPerson.email}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {selectedPerson.email}
                      </a>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                        Email
                      </span>
                    </div>
                  </div>

                  <Separator className="my-4" />
                </>
              )}

              {/* Sources */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Sources
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  You last chatted with {selectedPerson.name.split(" ")[0]} 1 week ago via email.
                  You've had 30 meetings, most recently 3 days ago, and emailed them 119 times,
                  most recently 1 week ago.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Select a person to view details
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
