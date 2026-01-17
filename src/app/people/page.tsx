"use client";

import { useState, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sidebar } from "./components/sidebar";
import { PeopleList } from "./components/people-list";
import { KanbanBoard } from "./components/kanban-board";
import { DetailPanel } from "./components/detail-panel";
import { SortIcon, CheckIcon } from "./icons";
import type { Person, KanbanColumn, KanbanCard } from "./types";

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedTab, setSelectedTab] = useState("people");
  const [panelWidth, setPanelWidth] = useState(340);
  const [isDragging, setIsDragging] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([
    { id: "to-contact", title: "To Contact", cards: [] },
    { id: "in-progress", title: "In Progress", cards: [] },
    { id: "follow-up", title: "Follow Up", cards: [] },
    { id: "done", title: "Done", cards: [] },
  ]);

  // Fetch people from database
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch("/api/people");
        if (!response.ok) {
          throw new Error("Failed to fetch people");
        }
        const data = await response.json();
        setPeople(data);
        if (data.length > 0 && !selectedPerson) {
          setSelectedPerson(data[0]);
        }
      } catch (error) {
        console.error("Error fetching people:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (people.length > 0 && !loading) {
      fetchBoardAssignments();
    }
  }, [people, loading]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 340;
      const maxWidth = 800;
      setPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // Handle keyboard navigation
  useEffect(() => {
    const tabs = ["people", "board", "map", "archive"];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Tab") {
        const currentIndex = tabs.indexOf(selectedTab);
        if (currentIndex !== -1) {
          e.preventDefault();
          let newIndex: number;
          if (e.shiftKey) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          } else {
            newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          }
          setSelectedTab(tabs[newIndex]);
        }
        return;
      }

      if (selectedTab !== "people") return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!selectedPerson) return;
        const currentIndex = people.findIndex((p) => p.id === selectedPerson.id);

        if (currentIndex === -1) return;

        let newIndex: number;
        if (e.key === "ArrowDown") {
          newIndex = currentIndex < people.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : people.length - 1;
        }

        const newPerson = people[newIndex];
        if (newPerson) {
          setSelectedPerson(newPerson);
          setTimeout(() => {
            const element = document.querySelector(`[data-person-id="${newPerson.id}"]`);
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }, 0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTab, selectedPerson, people]);

  const handleMouseDown = () => {
    setIsDragging(true);
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

  const handleToggleStar = async (person: Person, e: React.MouseEvent) => {
    e.stopPropagation();

    const newStarredState = !person.starred;
    const optimisticPerson = { ...person, starred: newStarredState };
    setPeople(people.map((p) => (p.id === person.id ? optimisticPerson : p)));

    if (selectedPerson?.id === person.id) {
      if (showStarredOnly && !newStarredState) {
        const starredPeople = people.filter((p) => p.starred && p.id !== person.id);
        setSelectedPerson(starredPeople.length > 0 ? starredPeople[0] : null);
      } else {
        setSelectedPerson(optimisticPerson);
      }
    }

    try {
      const response = await fetch(`/api/people?id=${person.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: newStarredState }),
      });

      if (!response.ok) {
        throw new Error("Failed to update star status");
      }

      const updatedPerson = await response.json();
      setPeople(people.map((p) => (p.id === person.id ? updatedPerson : p)));

      if (selectedPerson?.id === person.id) {
        if (showStarredOnly && !updatedPerson.starred) {
          const starredPeople = people.filter((p) => p.starred && p.id !== person.id);
          setSelectedPerson(starredPeople.length > 0 ? starredPeople[0] : null);
        } else {
          setSelectedPerson(updatedPerson);
        }
      }
    } catch (error) {
      console.error("Error toggling star:", error);
      setPeople(people.map((p) => (p.id === person.id ? person : p)));
      if (selectedPerson?.id === person.id) {
        setSelectedPerson(person);
      }
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Sidebar */}
      <Sidebar
        people={people}
        selectedPerson={selectedPerson}
        showStarredOnly={showStarredOnly}
        onToggleStarred={() => setShowStarredOnly(!showStarredOnly)}
        onSelectPerson={setSelectedPerson}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-gray-900">
        <Tabs
          value={selectedTab}
          onValueChange={setSelectedTab}
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
        >
          {/* Header with Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <TabsList className="bg-transparent h-auto p-0 space-x-4">
                <TabsTrigger
                  value="people"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 border-b-2 border-transparent data-[state=active]:border-gray-900 dark:data-[state=active]:border-gray-100 rounded-none focus-visible:outline-none focus-visible:ring-0"
                >
                  People
                </TabsTrigger>
                <TabsTrigger
                  value="board"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 border-b-2 border-transparent data-[state=active]:border-gray-900 dark:data-[state=active]:border-gray-100 rounded-none focus-visible:outline-none focus-visible:ring-0"
                >
                  Board
                </TabsTrigger>
                <TabsTrigger
                  value="map"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 border-b-2 border-transparent data-[state=active]:border-gray-900 dark:data-[state=active]:border-gray-100 rounded-none focus-visible:outline-none focus-visible:ring-0"
                >
                  Map
                </TabsTrigger>
                <TabsTrigger
                  value="archive"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 border-b-2 border-transparent data-[state=active]:border-gray-900 dark:data-[state=active]:border-gray-100 rounded-none focus-visible:outline-none focus-visible:ring-0"
                >
                  Archive
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
                  <span>Recency</span>
                  <SortIcon className="w-4 h-4" />
                </div>
                <CheckIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          </div>

          <TabsContent value="people" className="flex-1 flex flex-col min-w-0 m-0 overflow-hidden">
            <PeopleList
              people={people}
              selectedPerson={selectedPerson}
              showStarredOnly={showStarredOnly}
              loading={loading}
              onSelectPerson={setSelectedPerson}
              onToggleStar={handleToggleStar}
              onDragStart={(personId) => setDraggedCard(`card-${personId}`)}
            />
          </TabsContent>

          <TabsContent value="board" className="flex-1 flex flex-col min-w-0 m-0">
            <KanbanBoard
              people={people}
              columns={kanbanColumns}
              draggedCard={draggedCard}
              draggedOverColumn={draggedOverColumn}
              onColumnsChange={setKanbanColumns}
              onDragStart={handleCardDragStart}
              onDragEnd={handleCardDragEnd}
              onColumnDragOver={handleColumnDragOver}
              onColumnDragLeave={handleColumnDragLeave}
              onSelectPerson={setSelectedPerson}
              onToggleStar={handleToggleStar}
              onAddPersonToColumn={handleAddPersonToColumn}
            />
          </TabsContent>

          <TabsContent value="map" className="flex-1 flex flex-col min-w-0 m-0">
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">Map view coming soon</p>
            </div>
          </TabsContent>

          <TabsContent value="archive" className="flex-1 flex flex-col min-w-0 m-0">
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">Archive view coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Resizable Divider */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className="w-1 flex items-center justify-center cursor-col-resize flex-shrink-0 group"
      >
        <div className="w-px h-full bg-gray-200 dark:bg-gray-800 group-hover:bg-gray-300 dark:group-hover:bg-gray-700 transition-colors" />
      </div>

      {/* Right Detail Panel */}
      <DetailPanel selectedPerson={selectedPerson} panelWidth={panelWidth} />
    </div>
  );
}
