"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { StarIcon, MailIcon } from "../icons";
import { generateAuroraGradient, getInitials } from "../utils";
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
  const filteredPeople = showStarredOnly ? people.filter((p) => p.starred) : people;

  return (
    <>
      {/* People Count */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {loading
            ? "Loading..."
            : `${filteredPeople.length} ${showStarredOnly ? "Starred" : ""} People`}
        </span>
      </div>

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
    </>
  );
}
