"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailIcon, PlusIcon, StarIcon } from "@/app/(app)/network/icons";
import { usePeople } from "@/app/(app)/network/people-context";
import type { Person } from "@/app/(app)/network/types";
import { generateAuroraGradient, getInitials } from "@/app/(app)/network/utils";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
                    router.push(`/people/${selectedPerson.id}`);
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
                    <Link href="/network/create" className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Create new">
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
                        {filteredPeople.map((person) => (
                            <div
                                key={person.id}
                                data-person-id={person.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = "move";
                                    onDragStart(person.id);
                                }}
                                onMouseEnter={() => onSelectPerson(person)}
                                onClick={() => {
                                    onSelectPerson(person);
                                    router.push(`/people/${person.id}`);
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
        </>
    );
}
