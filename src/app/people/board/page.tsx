"use client";

import { useState, useEffect, useMemo } from "react";
import { KanbanBoard } from "../components/kanban-board";
import { usePeople } from "../people-context";
import { createToggleStarHandler } from "../utils";
import type { KanbanColumn, KanbanCard, Person } from "../types";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { Button } from "@/components/ui/button";

// Helper function to generate column ID from title
function generateColumnId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `column-${index}`;
}

export default function BoardPage() {
  const {
    people,
    setPeople,
    selectedPerson,
    setSelectedPerson,
    showStarredOnly,
  } = usePeople();

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([
    { id: "to-contact", title: "To Contact", cards: [] },
    { id: "in-progress", title: "In Progress", cards: [] },
    { id: "follow-up", title: "Follow Up", cards: [] },
    { id: "done", title: "Done", cards: [] },
  ]);

  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch kanban column titles from database
  useEffect(() => {
    const fetchKanbanColumns = async () => {
      try {
        const response = await fetch("/api/kanban-columns");
        if (!response.ok) {
          throw new Error("Failed to fetch kanban columns");
        }
        const data = await response.json();
        const columnTitles = data.columns || [];
        
        if (columnTitles.length > 0) {
          // Generate columns with IDs from titles
          // Try to preserve existing IDs by matching titles, otherwise generate new IDs
          setKanbanColumns((prevColumns) => {
            const newColumns: KanbanColumn[] = columnTitles.map((title: string, index: number) => {
              // Try to find existing column with same title to preserve ID
              const existingColumn = prevColumns.find((col) => col.title === title);
              if (existingColumn) {
                return { ...existingColumn, title, cards: [] };
              }
              // Otherwise generate new ID
              return {
                id: generateColumnId(title, index),
                title: title,
                cards: [],
              };
            });
            return newColumns;
          });
        }
      } catch (error) {
        console.error("Error fetching kanban columns:", error);
      }
    };

    fetchKanbanColumns();
  }, []);

  // Fetch board assignments from database
  useEffect(() => {
    const fetchBoardAssignments = async () => {
      try {
        const response = await fetch("/api/people/board");
        if (!response.ok) {
          throw new Error("Failed to fetch board assignments");
        }
        const assignmentsByColumn = await response.json();

        setKanbanColumns((prevColumns) =>
          prevColumns.map((column) => {
            const personIds = assignmentsByColumn[column.id] || [];
            const cards: KanbanCard[] = personIds
              .map((personId: string) => {
                const person = people.find((p) => p.id === personId);
                if (!person) return null;
                return {
                  id: `card-${personId}`,
                  personId: person.id,
                  personName: person.name,
                };
              })
              .filter((card: KanbanCard | null): card is KanbanCard => card !== null);

            return { ...column, cards };
          })
        );
      } catch (error) {
        console.error("Error fetching board assignments:", error);
      }
    };

    if (people.length > 0) {
      fetchBoardAssignments();
    }
  }, [people]);

  // Save kanban column titles to database
  const saveKanbanColumns = async (columns: KanbanColumn[]) => {
    try {
      const columnTitles = columns.map((col) => col.title);
      const response = await fetch("/api/kanban-columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnTitles }),
      });

      if (!response.ok) {
        throw new Error("Failed to save kanban columns");
      }
    } catch (error) {
      console.error("Error saving kanban columns:", error);
    }
  };

  const handleKanbanColumnsChange = (columns: KanbanColumn[]) => {
    setKanbanColumns(columns);
    saveKanbanColumns(columns);
  };

  const handleAddPersonToColumn = async (personId: string, columnId: string) => {
    const person = people.find((p) => p.id === personId);
    if (!person) return;

    const column = kanbanColumns.find((col) => col.id === columnId);
    if (column?.cards.some((card) => card.personId === personId)) {
      return;
    }

    const newCard: KanbanCard = {
      id: `card-${personId}`,
      personId: person.id,
      personName: person.name,
    };

    setKanbanColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col
      )
    );

    try {
      const response = await fetch("/api/people/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, columnId }),
      });

      if (!response.ok) {
        throw new Error("Failed to add person to board");
      }
    } catch (error) {
      console.error("Error adding person to board:", error);
      setKanbanColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === columnId
            ? { ...col, cards: col.cards.filter((card) => card.id !== newCard.id) }
            : col
        )
      );
    }
  };

  const handleCardDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleCardDragEnd = async () => {
    if (draggedCard && draggedOverColumn) {
      const isNewCard =
        draggedCard.startsWith("card-") &&
        !kanbanColumns.some((col) => col.cards.some((c) => c.id === draggedCard));

      let card: KanbanCard | null = null;
      let oldColumn: KanbanColumn | null = null;

      if (isNewCard) {
        const personId = draggedCard.replace("card-", "");
        const person = people.find((p) => p.id === personId);
        if (!person) {
          setDraggedCard(null);
          setDraggedOverColumn(null);
          return;
        }
        card = {
          id: draggedCard,
          personId: person.id,
          personName: person.name,
        };
      } else {
        card =
          kanbanColumns.flatMap((col) => col.cards).find((c) => c.id === draggedCard) || null;

        if (!card) {
          setDraggedCard(null);
          setDraggedOverColumn(null);
          return;
        }

        oldColumn =
          kanbanColumns.find((col) => col.cards.some((c) => c.id === draggedCard)) || null;
      }

      const newColumns = kanbanColumns.map((column) => {
        const filteredCards = column.cards.filter((c) => c.id !== draggedCard);
        if (column.id === draggedOverColumn && card) {
          return { ...column, cards: [...filteredCards, card] };
        }
        return { ...column, cards: filteredCards };
      });
      setKanbanColumns(newColumns);

      try {
        if (oldColumn && oldColumn.id !== draggedOverColumn && card) {
          const response = await fetch("/api/people/board", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personId: card.personId,
              oldColumnId: oldColumn.id,
              newColumnId: draggedOverColumn,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to update board assignment");
          }
        } else if (!oldColumn && card) {
          const response = await fetch("/api/people/board", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personId: card.personId,
              columnId: draggedOverColumn,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create board assignment");
          }
        }
      } catch (error) {
        console.error("Error saving board assignment:", error);
        setKanbanColumns(kanbanColumns);
      }
    }
    setDraggedCard(null);
    setDraggedOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedOverColumn(columnId);
  };

  const handleColumnDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleToggleStar = useMemo(
    () => createToggleStarHandler(people, setPeople, selectedPerson, setSelectedPerson, showStarredOnly),
    [people, setPeople, selectedPerson, setSelectedPerson, showStarredOnly]
  );

  const handleDeletePerson = async (person: Person) => {
    try {
      const response = await fetch(`/api/people?id=${person.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete person");
      }

      // Remove person from people list
      setPeople(people.filter((p) => p.id !== person.id));

      // Remove card from all kanban columns
      setKanbanColumns((prevColumns) =>
        prevColumns.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.personId !== person.id),
        }))
      );

      // Clear selection if deleted person was selected
      if (selectedPerson?.id === person.id) {
        setSelectedPerson(null);
      }
    } catch (error) {
      console.error("Error deleting person:", error);
      setErrorMessage("Failed to delete person. Please try again.");
    }
  };

  const handleAddColumn = (title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const newId = generateColumnId(trimmedTitle, kanbanColumns.length);
    const newColumn: KanbanColumn = {
      id: newId,
      title: trimmedTitle,
      cards: [],
    };

    const updatedColumns = [...kanbanColumns, newColumn];
    setKanbanColumns(updatedColumns);
    saveKanbanColumns(updatedColumns);
  };

  const handleDeleteColumn = async (columnId: string) => {
    const column = kanbanColumns.find((col) => col.id === columnId);
    if (!column) return;

    try {
      // Delete all board assignments for this column
      if (column.cards.length > 0) {
        const deletePromises = column.cards.map((card) =>
          fetch(`/api/people/board?personId=${card.personId}&columnId=${columnId}`, {
            method: "DELETE",
          })
        );
        const results = await Promise.all(deletePromises);
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          console.error("Some board assignments failed to delete");
        }
      }

      // Remove column from state
      const updatedColumns = kanbanColumns.filter((col) => col.id !== columnId);
      setKanbanColumns(updatedColumns);
      await saveKanbanColumns(updatedColumns);
    } catch (error) {
      console.error("Error deleting column:", error);
      setErrorMessage("Failed to delete column. Please try again.");
    }
  };

  return (
    <>
      <KanbanBoard
        people={people}
        columns={kanbanColumns}
        draggedCard={draggedCard}
        draggedOverColumn={draggedOverColumn}
        onColumnsChange={handleKanbanColumnsChange}
        onDragStart={handleCardDragStart}
        onDragEnd={handleCardDragEnd}
        onColumnDragOver={handleColumnDragOver}
        onColumnDragLeave={handleColumnDragLeave}
        onSelectPerson={setSelectedPerson}
        onToggleStar={handleToggleStar}
        onAddPersonToColumn={handleAddPersonToColumn}
        onDeletePerson={handleDeletePerson}
        onAddColumn={handleAddColumn}
        onDeleteColumn={handleDeleteColumn}
      />

      {/* Error Modal */}
      <ModalOverlay isOpen={errorMessage !== null} onOpenChange={(isOpen) => !isOpen && setErrorMessage(null)}>
        <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
          <Dialog className="p-6">
            {({ close }) => (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="bg-brand-600 hover:bg-brand-700 text-white"
                    onClick={() => {
                      setErrorMessage(null);
                      close();
                    }}
                  >
                    OK
                  </Button>
                </div>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

