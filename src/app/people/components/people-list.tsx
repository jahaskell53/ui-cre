"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Download, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { cn } from "@/lib/utils";
import { StarIcon, MailIcon } from "../icons";
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
  const { setPeople } = usePeople();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {loading
              ? "Loading..."
              : `${filteredPeople.length} ${showStarredOnly ? "Starred" : ""} People`}
          </span>
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
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
    </>
  );
}
