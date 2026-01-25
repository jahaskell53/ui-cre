"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Download, X, Mail, Calendar, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { cn } from "@/lib/utils";
import { StarIcon, MailIcon, PlusIcon } from "../icons";
import { generateAuroraGradient, getInitials } from "../utils";
import { usePeople } from "../people-context";
import type { Person } from "../types";

interface PeopleListProps {
  people: Person[];
  selectedPerson: Person | null;
  showStarredOnly: boolean;
  loading: boolean;
  onSelectPerson: (person: Person) => void;
  onToggleStar: (person: Person, e: React.MouseEvent) => void;
  onDragStart: (personId: string) => void;
}

export function PeopleList({
  people,
  selectedPerson,
  showStarredOnly,
  loading,
  onSelectPerson,
  onToggleStar,
  onDragStart,
}: PeopleListProps) {
  const router = useRouter();
  const { setPeople, selectedIds, setSelectedIds } = usePeople();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; title: string; start_time: string; end_time: string }>>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const filteredPeople = showStarredOnly ? people.filter((p) => p.starred) : people;

  const toggleSelection = (personId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(personId);
      } else {
        next.delete(personId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      // Delete each selected person
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/people?id=${id}`, { method: "DELETE" })
      );
      
      await Promise.all(deletePromises);
      
      // Update the people list by removing deleted people
      setPeople(people.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting people:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadCSV = () => {
    const selectedPeople = people.filter((p) => selectedIds.has(p.id));
    if (selectedPeople.length === 0) return;

    // Define CSV headers
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Category",
      "Address",
      "Bio",
      "Birthday",
      "LinkedIn",
      "Twitter",
      "Instagram",
      "Facebook",
      "Starred",
    ];

    // Convert people to CSV rows
    const rows = selectedPeople.map((person) => [
      person.name || "",
      person.email || "",
      person.phone || "",
      person.category || "",
      person.address || "",
      person.bio || "",
      person.birthday || "",
      person.linkedin_url || "",
      person.twitter_url || "",
      person.instagram_url || "",
      person.facebook_url || "",
      person.starred ? "Yes" : "No",
    ]);

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `people-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      // Filter to only upcoming events
      const now = new Date();
      const upcomingEvents = data.filter((e: { start_time: string }) => new Date(e.start_time) >= now);
      setEvents(upcomingEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleOpenInviteModal = () => {
    setShowInviteModal(true);
    setSelectedEventId(null);
    fetchEvents();
  };

  const handleSendInvites = async () => {
    if (!selectedEventId) {
      alert("Please select an event");
      return;
    }

    const selectedPeople = people.filter((p) => selectedIds.has(p.id));
    const emails = selectedPeople
      .map((p) => p.email)
      .filter((email): email is string => Boolean(email));

    if (emails.length === 0) {
      alert("Selected people don't have email addresses");
      return;
    }

    setIsSendingInvites(true);
    try {
      const response = await fetch("/api/events/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: selectedEventId,
          emails: emails,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invitations");
      }

      const result = await response.json();
      alert(result.message || "Invitations sent successfully!");
      setShowInviteModal(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Error sending invites:", error);
      alert(error.message || "Failed to send invitations. Please try again.");
    } finally {
      setIsSendingInvites(false);
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatEventTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Handle arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle arrow keys if user is typing in an input, textarea, or contenteditable
      // const target = e.target as HTMLElement;
      // if (
      //   target.tagName === "INPUT" ||
      //   target.tagName === "TEXTAREA" ||
      //   target.isContentEditable ||
      //   target.closest("input") ||
      //   target.closest("textarea")
      // ) {
      //   return;
      // }

      // Don't handle if a modal is open
      if (showDeleteModal) {
        return;
      }

      if (filteredPeople.length === 0) {
        return;
      }

      const currentIndex = selectedPerson
        ? filteredPeople.findIndex((p) => p.id === selectedPerson.id)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex < filteredPeople.length - 1 ? currentIndex + 1 : 0;
        onSelectPerson(filteredPeople[nextIndex]);
        
        // Scroll into view
        const personElement = listContainerRef.current?.querySelector(
          `[data-person-id="${filteredPeople[nextIndex].id}"]`
        );
        personElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredPeople.length - 1;
        onSelectPerson(filteredPeople[prevIndex]);
        
        // Scroll into view
        const personElement = listContainerRef.current?.querySelector(
          `[data-person-id="${filteredPeople[prevIndex].id}"]`
        );
        personElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (e.key === "Enter") {
        if (selectedPerson) {
          e.preventDefault();
          router.push(`/network/${selectedPerson.id}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredPeople, selectedPerson, onSelectPerson, showDeleteModal, router]);

  return (
    <>
      {/* Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInviteModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Mail className="w-4 h-4" />
              Invite
            </button>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* People Count */}
      {selectedIds.size === 0 && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {loading
              ? "Loading..."
              : `${filteredPeople.length} ${showStarredOnly ? "Starred" : ""} People`}
          </span>
          <Link
            href="/network/create"
            data-tour="create-person-button"
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            aria-label="Create new"
          >
            <PlusIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </Link>
        </div>
      )}

      {/* People List */}
      <ScrollArea className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading people...</div>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {showStarredOnly ? "No starred people found" : "No people found"}
            </div>
          </div>
        ) : (
          <div ref={listContainerRef} className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredPeople.map((person, index) => (
              <div
                key={person.id}
                data-person-id={person.id}
                data-tour={index === 0 ? "person-item" : undefined}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  onDragStart(person.id);
                }}
                onMouseEnter={() => onSelectPerson(person)}
                onClick={() => {
                  onSelectPerson(person);
                  router.push(`/network/${person.id}`);
                }}
                className={cn(
                  "flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group",
                  selectedPerson?.id === person.id && "bg-gray-50 dark:bg-gray-800"
                )}
              >
                <Checkbox
                  className={cn(
                    "mr-3 transition-opacity",
                    selectedIds.has(person.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  checked={selectedIds.has(person.id)}
                  onCheckedChange={(checked) => toggleSelection(person.id, checked as boolean)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {person.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => onToggleStar(person, e)}
                        className="p-0.5 -m-0.5 hover:scale-110 transition-transform"
                        aria-label={person.starred ? "Unstar" : "Star"}
                      >
                        <StarIcon
                          className={cn(
                            "w-3 h-3 transition-colors",
                            person.starred
                              ? "text-amber-400"
                              : "text-gray-300 hover:text-amber-400"
                          )}
                          filled={person.starred}
                        />
                      </button>
                      {person.email && <MailIcon className="w-3 h-3 text-teal-500" />}
                    </div>
                  </div>
                </div>
                <Avatar className="h-7 w-7 ml-2">
                  <AvatarFallback
                    className="text-white text-xs font-medium"
                    style={{ background: generateAuroraGradient(person.name) }}
                  >
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation Modal */}
      <ModalOverlay
        isOpen={showDeleteModal}
        onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}
      >
        <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
          <Dialog className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Delete {selectedIds.size === 1 ? "Person" : "People"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "person" : "people"}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Invite to Event Modal */}
      <ModalOverlay
        isOpen={showInviteModal}
        onOpenChange={(isOpen) => !isOpen && setShowInviteModal(false)}
      >
        <Modal className="max-w-2xl bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
          <Dialog className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Invite to Event
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select an event to invite {selectedIds.size} {selectedIds.size === 1 ? "person" : "people"} to
                </p>
              </div>
            </div>

            {isLoadingEvents ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  You don't have any upcoming events to invite people to.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteModal(false);
                    router.push("/events/new");
                  }}
                >
                  Create Event
                </Button>
              </div>
            ) : (
              <>
                <div className="max-h-96 overflow-y-auto mb-6 space-y-2">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-md border transition-colors",
                        selectedEventId === event.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {event.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatEventDate(event.start_time)} at {formatEventTime(event.start_time)}
                          </p>
                        </div>
                        {selectedEventId === event.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <Button
                    variant="outline"
                    onClick={() => setShowInviteModal(false)}
                    disabled={isSendingInvites}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendInvites}
                    disabled={!selectedEventId || isSendingInvites}
                    className="flex items-center gap-2"
                  >
                    {isSendingInvites ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Invitations
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
