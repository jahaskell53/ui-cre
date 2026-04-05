"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Download, Loader2, Mail, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MailIcon, PlusIcon, StarIcon } from "../icons";
import { usePeople } from "../people-context";
import type { Person } from "../types";
import { generateAuroraGradient, getInitials } from "../utils";

interface PeopleListProps {
    people: Person[];
    selectedPerson: Person | null;
    showStarredOnly: boolean;
    loading: boolean;
    onSelectPerson: (person: Person) => void;
    onToggleStar: (person: Person, e: React.MouseEvent) => void;
    onDragStart: (personId: string) => void;
}

export function PeopleList({ people, selectedPerson, showStarredOnly, loading, onSelectPerson, onToggleStar, onDragStart }: PeopleListProps) {
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
            const deletePromises = Array.from(selectedIds).map((id) => fetch(`/api/people?id=${id}`, { method: "DELETE" }));

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
        const headers = ["Name", "Email", "Phone", "Category", "Address", "Bio", "Birthday", "LinkedIn", "Twitter", "Instagram", "Facebook", "Starred"];

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
        const csvContent = [headers.join(","), ...rows.map((row) => row.map(escapeCSV).join(","))].join("\n");

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
        const emails = selectedPeople.map((p) => p.email).filter((email): email is string => Boolean(email));

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

            const currentIndex = selectedPerson ? filteredPeople.findIndex((p) => p.id === selectedPerson.id) : -1;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                const nextIndex = currentIndex < filteredPeople.length - 1 ? currentIndex + 1 : 0;
                onSelectPerson(filteredPeople[nextIndex]);

                // Scroll into view
                const personElement = listContainerRef.current?.querySelector(`[data-person-id="${filteredPeople[nextIndex].id}"]`);
                personElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredPeople.length - 1;
                onSelectPerson(filteredPeople[prevIndex]);

                // Scroll into view
                const personElement = listContainerRef.current?.querySelector(`[data-person-id="${filteredPeople[prevIndex].id}"]`);
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
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedIds.size} selected</span>
                        <button onClick={clearSelection} className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Clear selection">
                            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenInviteModal}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <Mail className="h-4 w-4" />
                            Invite
                        </button>
                        <button
                            onClick={handleDownloadCSV}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <Download className="h-4 w-4" />
                            Download CSV
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* People Count */}
            {selectedIds.size === 0 && (
                <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
                    <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                        {loading ? "Loading..." : `${filteredPeople.length} ${showStarredOnly ? "Starred" : ""} People`}
                    </span>
                    <Link
                        href="/network/create"
                        data-tour="create-person-button"
                        className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label="Create new"
                    >
                        <PlusIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
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
                        <div className="text-sm text-gray-500 dark:text-gray-400">{showStarredOnly ? "No starred people found" : "No people found"}</div>
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
                                    "group flex cursor-pointer items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800",
                                    selectedPerson?.id === person.id && "bg-gray-50 dark:bg-gray-800",
                                )}
                            >
                                <Checkbox
                                    className={cn("mr-3 transition-opacity", selectedIds.has(person.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                                    checked={selectedIds.has(person.id)}
                                    onCheckedChange={(checked) => toggleSelection(person.id, checked as boolean)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm text-gray-900 dark:text-gray-100">{person.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => onToggleStar(person, e)}
                                                className="-m-0.5 p-0.5 transition-transform hover:scale-110"
                                                aria-label={person.starred ? "Unstar" : "Star"}
                                            >
                                                <StarIcon
                                                    className={cn(
                                                        "h-3 w-3 transition-colors",
                                                        person.starred ? "text-amber-400" : "text-gray-300 hover:text-amber-400",
                                                    )}
                                                    filled={person.starred}
                                                />
                                            </button>
                                            {person.email && <MailIcon className="h-3 w-3 text-teal-500" />}
                                        </div>
                                    </div>
                                </div>
                                <Avatar className="ml-2 h-7 w-7">
                                    <AvatarFallback className="text-xs font-medium text-white" style={{ background: generateAuroraGradient(person.name) }}>
                                        {getInitials(person.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Delete Confirmation Modal */}
            <ModalOverlay isOpen={showDeleteModal} onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}>
                <Modal className="max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Delete {selectedIds.size === 1 ? "Person" : "People"}</h2>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete {selectedIds.size} {selectedIds.size === 1 ? "person" : "people"}? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {/* Invite to Event Modal */}
            <ModalOverlay isOpen={showInviteModal} onOpenChange={(isOpen) => !isOpen && setShowInviteModal(false)}>
                <Modal className="max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                <Mail className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invite to Event</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Select an event to invite {selectedIds.size} {selectedIds.size === 1 ? "person" : "people"} to
                                </p>
                            </div>
                        </div>

                        {isLoadingEvents ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : events.length === 0 ? (
                            <div className="py-12 text-center">
                                <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
                                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">You don't have any upcoming events to invite people to.</p>
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
                                <div className="mb-6 max-h-96 space-y-2 overflow-y-auto">
                                    {events.map((event) => (
                                        <button
                                            key={event.id}
                                            onClick={() => setSelectedEventId(event.id)}
                                            className={cn(
                                                "w-full rounded-md border p-4 text-left transition-colors",
                                                selectedEventId === event.id
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800",
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">{event.title}</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {formatEventDate(event.start_time)} at {formatEventTime(event.start_time)}
                                                    </p>
                                                </div>
                                                {selectedEventId === event.id && (
                                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500">
                                                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                                    <Button variant="outline" onClick={() => setShowInviteModal(false)} disabled={isSendingInvites}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSendInvites} disabled={!selectedEventId || isSendingInvites} className="flex items-center gap-2">
                                        {isSendingInvites ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="h-4 w-4" />
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
