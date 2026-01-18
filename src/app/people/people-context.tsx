"use client";

import { createContext, useContext, ReactNode } from "react";
import type { Person } from "./types";

export type SortBy = 'recency' | 'alphabetical';

interface PeopleContextType {
  people: Person[];
  setPeople: (people: Person[]) => void;
  selectedPerson: Person | null;
  setSelectedPerson: (person: Person | null) => void;
  loading: boolean;
  showStarredOnly: boolean;
  setShowStarredOnly: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  reverse: boolean;
  setReverse: (reverse: boolean) => void;
}

const PeopleContext = createContext<PeopleContextType | undefined>(undefined);

export function PeopleProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PeopleContextType;
}) {
  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>;
}

export function usePeople() {
  const context = useContext(PeopleContext);
  if (context === undefined) {
    throw new Error("usePeople must be used within a PeopleProvider");
  }
  return context;
}

