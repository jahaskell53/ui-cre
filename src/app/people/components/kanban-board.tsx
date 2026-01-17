"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PlusIcon, StarIcon, MailIcon } from "../icons";
import { generateAuroraGradient, getInitials } from "../utils";
import type { Person, KanbanColumn, KanbanCard } from "../types";

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
}: KanbanBoardProps) {
  const router = useRouter();
  const [addPersonSearch, setAddPersonSearch] = useState<Record<string, string>>({});
  const [openAddDropdown, setOpenAddDropdown] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

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
      const updatedColumns = columns.map((col) =>
        col.id === columnId ? { ...col, title: editingTitle.trim() } : col
      );
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
    <div className="flex-1 overflow-x-auto overflow-y-hidden bg-white dark:bg-gray-900">
      <div className="flex gap-4 p-4 h-full min-w-fit">
        {columns.map((column) => (
          <div
            key={column.id}
            className={cn(
              "flex flex-col w-64 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700",
              draggedOverColumn === column.id && "ring-2 ring-blue-500"
            )}
            onDragOver={(e) => onColumnDragOver(e, column.id)}
            onDragLeave={onColumnDragLeave}
            onDrop={onDragEnd}
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                {editingColumnId === column.id ? (
                  <Input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleSaveEdit(column.id)}
                    onKeyDown={(e) => handleKeyDown(e, column.id)}
                    className="text-sm font-medium h-7 px-2 py-1"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <h3
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-text hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded -mx-2 -my-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(column.id, column.title);
                    }}
                    title="Click to edit"
                  >
                    {column.title}
                  </h3>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {column.cards.length}
                  </span>
                  <DropdownMenu
                    open={openAddDropdown === column.id}
                    onOpenChange={(open) => setOpenAddDropdown(open ? column.id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PlusIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-0">
                      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
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
                              const isInColumn = column.cards.some(
                                (card) => card.personId === person.id
                              );
                              return (
                                !isInColumn &&
                                (searchTerm === "" ||
                                  person.name.toLowerCase().includes(searchTerm))
                              );
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
                                <div className="flex items-center gap-2 w-full">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback
                                      className="text-white text-xs font-medium"
                                      style={{
                                        background: generateAuroraGradient(person.name),
                                      }}
                                    >
                                      {getInitials(person.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {person.name}
                                  </span>
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
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {column.cards.map((card) => {
                  const person = people.find((p) => p.id === card.personId);
                  if (!person) return null;
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => onDragStart(card.id)}
                      onDragEnd={onDragEnd}
                      onMouseEnter={() => onSelectPerson(person)}
                      onClick={() => {
                        onSelectPerson(person);
                        router.push(`/people/${person.id}`);
                      }}
                      className={cn(
                        "bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-move hover:shadow-md transition-shadow",
                        draggedCard === card.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className="text-white text-xs font-medium"
                            style={{ background: generateAuroraGradient(person.name) }}
                          >
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {person.name}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleStar(person, e);
                              }}
                              className="p-0.5 -m-0.5"
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
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}
