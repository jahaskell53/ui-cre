"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MailIcon, PlusIcon, StarIcon } from "../icons";
import type { KanbanCard, KanbanColumn, Person } from "../types";
import { generateAuroraGradient, getInitials } from "../utils";

interface KanbanBoardProps {
    people: Person[];
    columns: KanbanColumn[];
    draggedCard: string | null;
    draggedOverColumn: string | null;
    onColumnsChange: (columns: KanbanColumn[]) => void;
    onDragStart: (cardId: string) => void;
    onDragEnd: () => void;
    onColumnDragOver: (e: React.DragEvent, columnId: string) => void;
    onColumnDragLeave: () => void;
    onSelectPerson: (person: Person) => void;
    onToggleStar: (person: Person, e: React.MouseEvent) => void;
    onAddPersonToColumn: (personId: string, columnId: string) => void;
    onDeletePerson: (person: Person) => void;
    onAddColumn: (title: string) => void;
    onDeleteColumn: (columnId: string) => void;
}

export function KanbanBoard({
    people,
    columns,
    draggedCard,
    draggedOverColumn,
    onDragStart,
    onDragEnd,
    onColumnDragOver,
    onColumnDragLeave,
    onSelectPerson,
    onToggleStar,
    onAddPersonToColumn,
    onColumnsChange,
    onDeletePerson,
    onAddColumn,
    onDeleteColumn,
}: KanbanBoardProps) {
    const router = useRouter();
    const [addPersonSearch, setAddPersonSearch] = useState<Record<string, string>>({});
    const [openAddDropdown, setOpenAddDropdown] = useState<string | null>(null);
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState<string>("");
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [newColumnTitle, setNewColumnTitle] = useState("");
    const [pendingDeleteColumn, setPendingDeleteColumn] = useState<{ id: string; title: string } | null>(null);
    const [pendingDeletePerson, setPendingDeletePerson] = useState<Person | null>(null);

    const handleAddPerson = (personId: string, columnId: string) => {
        onAddPersonToColumn(personId, columnId);
        setOpenAddDropdown(null);
        setAddPersonSearch((prev) => ({ ...prev, [columnId]: "" }));
    };

    const handleStartEdit = (columnId: string, currentTitle: string) => {
        setEditingColumnId(columnId);
        setEditingTitle(currentTitle);
    };

    const handleSaveEdit = (columnId: string) => {
        if (editingTitle.trim()) {
            const updatedColumns = columns.map((col) => (col.id === columnId ? { ...col, title: editingTitle.trim() } : col));
            onColumnsChange(updatedColumns);
        }
        setEditingColumnId(null);
        setEditingTitle("");
    };

    const handleCancelEdit = () => {
        setEditingColumnId(null);
        setEditingTitle("");
    };

    const handleKeyDown = (e: React.KeyboardEvent, columnId: string) => {
        if (e.key === "Enter") {
            handleSaveEdit(columnId);
        } else if (e.key === "Escape") {
            handleCancelEdit();
        }
    };

    return (
        <div className="h-full flex-1 overflow-x-auto overflow-y-hidden bg-white dark:bg-gray-900">
            <div className="flex h-full gap-4 p-4">
                {columns.map((column) => (
                    <div
                        key={column.id}
                        className={cn(
                            "flex w-64 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800",
                            draggedOverColumn === column.id && "ring-2 ring-blue-500",
                        )}
                        onDragOver={(e) => onColumnDragOver(e, column.id)}
                        onDragLeave={onColumnDragLeave}
                        onDrop={onDragEnd}
                    >
                        {/* Column Header */}
                        <div className="group border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                {editingColumnId === column.id ? (
                                    <Input
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onBlur={() => handleSaveEdit(column.id)}
                                        onKeyDown={(e) => handleKeyDown(e, column.id)}
                                        className="h-7 px-2 py-1 text-sm font-medium"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                        <h3
                                            data-tour="column-title"
                                            className="-mx-2 -my-1 cursor-text truncate rounded px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartEdit(column.id, column.title);
                                            }}
                                            title="Click to edit"
                                        >
                                            {column.title}
                                        </h3>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingDeleteColumn({ id: column.id, title: column.title });
                                        }}
                                        title="Delete column"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                                    </Button>
                                    <DropdownMenu open={openAddDropdown === column.id} onOpenChange={(open) => setOpenAddDropdown(open ? column.id : null)}>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                data-tour="add-person-button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <PlusIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-64 p-0">
                                            <div className="border-b border-gray-200 p-2 dark:border-gray-700">
                                                <Input
                                                    type="text"
                                                    placeholder="Search people..."
                                                    value={addPersonSearch[column.id] || ""}
                                                    onChange={(e) =>
                                                        setAddPersonSearch((prev) => ({
                                                            ...prev,
                                                            [column.id]: e.target.value,
                                                        }))
                                                    }
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    className="h-8 text-sm"
                                                    autoFocus
                                                />
                                            </div>
                                            <ScrollArea className="max-h-64">
                                                <div className="p-1">
                                                    {(() => {
                                                        const searchTerm = (addPersonSearch[column.id] || "").toLowerCase();
                                                        const filteredPeople = people.filter((person) => {
                                                            const isInColumn = column.cards.some((card) => card.personId === person.id);
                                                            return !isInColumn && (searchTerm === "" || person.name.toLowerCase().includes(searchTerm));
                                                        });

                                                        if (filteredPeople.length === 0) {
                                                            return (
                                                                <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                                                    No people found
                                                                </div>
                                                            );
                                                        }

                                                        return filteredPeople.map((person) => (
                                                            <DropdownMenuItem
                                                                key={person.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAddPerson(person.id, column.id);
                                                                }}
                                                                className="cursor-pointer"
                                                            >
                                                                <div className="flex w-full items-center gap-2">
                                                                    <Avatar className="h-6 w-6">
                                                                        <AvatarFallback
                                                                            className="text-xs font-medium text-white"
                                                                            style={{
                                                                                background: generateAuroraGradient(person.name),
                                                                            }}
                                                                        >
                                                                            {getInitials(person.name)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="truncate text-sm text-gray-900 dark:text-gray-100">{person.name}</span>
                                                                </div>
                                                            </DropdownMenuItem>
                                                        ));
                                                    })()}
                                                </div>
                                            </ScrollArea>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>

                        {/* Column Cards */}
                        <div className="flex-1 overflow-x-hidden overflow-y-auto p-2">
                            <div className="space-y-2">
                                {column.cards.map((card) => {
                                    const person = people.find((p) => p.id === card.personId);
                                    if (!person) return null;
                                    return (
                                        <div
                                            key={card.id}
                                            data-tour="person-card"
                                            draggable
                                            onDragStart={() => onDragStart(card.id)}
                                            onDragEnd={onDragEnd}
                                            onMouseEnter={() => onSelectPerson(person)}
                                            onClick={() => {
                                                onSelectPerson(person);
                                                router.push(`/people/${person.id}`);
                                            }}
                                            className={cn(
                                                "group cursor-move rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900",
                                                draggedCard === card.id && "opacity-50",
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8 flex-shrink-0">
                                                    <AvatarFallback
                                                        className="text-xs font-medium text-white"
                                                        style={{ background: generateAuroraGradient(person.name) }}
                                                    >
                                                        {getInitials(person.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{person.name}</p>
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onToggleStar(person, e);
                                                            }}
                                                            className="-m-0.5 flex-shrink-0 p-0.5"
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
                                                        {person.email && <MailIcon className="h-3 w-3 flex-shrink-0 text-teal-500" />}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPendingDeletePerson(person);
                                                    }}
                                                    className="-m-1 flex-shrink-0 p-1 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
                                                    aria-label="Delete person"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                {/* Add Column Button */}
                <div className="w-64 flex-shrink-0">
                    <button
                        data-tour="add-column-button"
                        onClick={() => setIsAddColumnModalOpen(true)}
                        className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                    >
                        <PlusIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Add Column</span>
                    </button>
                </div>
            </div>

            {/* Add Column Modal */}
            <ModalOverlay
                isOpen={isAddColumnModalOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setIsAddColumnModalOpen(false);
                        setNewColumnTitle("");
                    }
                }}
            >
                <Modal className="max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        {({ close }) => (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Column</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Create a new column for your board.</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Column name</label>
                                    <Input type="text" placeholder="e.g. Outreach" value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsAddColumnModalOpen(false);
                                            setNewColumnTitle("");
                                            close();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
                                        onClick={() => {
                                            const trimmed = newColumnTitle.trim();
                                            if (!trimmed) return;
                                            onAddColumn(trimmed);
                                            setIsAddColumnModalOpen(false);
                                            setNewColumnTitle("");
                                            close();
                                        }}
                                        disabled={!newColumnTitle.trim()}
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {/* Delete Column Confirmation Modal */}
            <ModalOverlay isOpen={pendingDeleteColumn !== null} onOpenChange={(isOpen) => !isOpen && setPendingDeleteColumn(null)}>
                <Modal className="max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        {({ close }) => (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete column</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">This will remove the column and all cards in it from the board.</p>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    Column: <span className="font-medium text-gray-900 dark:text-gray-100">{pendingDeleteColumn?.title}</span>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPendingDeleteColumn(null);
                                            close();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (pendingDeleteColumn) {
                                                onDeleteColumn(pendingDeleteColumn.id);
                                            }
                                            setPendingDeleteColumn(null);
                                            close();
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {/* Delete Person Confirmation Modal */}
            <ModalOverlay isOpen={pendingDeletePerson !== null} onOpenChange={(isOpen) => !isOpen && setPendingDeletePerson(null)}>
                <Modal className="max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <Dialog className="p-6">
                        {({ close }) => (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete person</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    Person: <span className="font-medium text-gray-900 dark:text-gray-100">{pendingDeletePerson?.name}</span>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPendingDeletePerson(null);
                                            close();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (pendingDeletePerson) {
                                                onDeletePerson(pendingDeletePerson);
                                            }
                                            setPendingDeletePerson(null);
                                            close();
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
}
