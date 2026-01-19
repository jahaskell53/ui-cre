"use client";

import { useEffect, useMemo } from "react";
import { parse, isValid } from "date-fns";
import { PeopleList } from "./components/people-list";
import { usePeople } from "./people-context";
import { createToggleStarHandler } from "./utils";
import type { TimelineItem } from "./types";

// Helper function to parse date strings from timeline
function parseTimelineDate(dateStr: string): Date | null {
  // Try parsing relative dates like "1d", "28d", "4 weeks ago"
  if (dateStr.includes('ago')) {
    // This is a relative date, we can't parse it accurately without context
    // Return null to indicate we can't parse it
    return null;
  }
  
  // Try parsing formats like "Nov 21 2025"
  const formats = [
    'MMM d yyyy',
    'MMM dd yyyy',
    'MMM d, yyyy',
    'MMM dd, yyyy',
    'MMM d',
    'MMM dd',
  ];
  
  for (const format of formats) {
    try {
      const parsed = parse(dateStr, format, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to next format
    }
  }
  
  // Try ISO date format
  const isoDate = new Date(dateStr);
  if (isValid(isoDate)) {
    return isoDate;
  }
  
  return null;
}

// Get the most recent interaction date from timeline
function getMostRecentInteractionDate(timeline: TimelineItem[] = []): Date | null {
  const interactions = timeline.filter(item => item.type === 'email' || item.type === 'meeting');
  
  if (interactions.length === 0) {
    return null;
  }
  
  const dates = interactions
    .map(item => parseTimelineDate(item.date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime());
  
  return dates[0] || null;
}

export default function PeoplePage() {
  const {
    people,
    setPeople,
    selectedPerson,
    setSelectedPerson,
    loading,
    showStarredOnly,
    searchQuery,
    sortBy,
    reverse,
  } = usePeople();

  const handleToggleStar = useMemo(
    () => createToggleStarHandler(people, setPeople, selectedPerson, setSelectedPerson, showStarredOnly),
    [people, setPeople, selectedPerson, setSelectedPerson, showStarredOnly]
  );

  // Sort people based on sortBy and reverse
  const sortedPeople = useMemo(() => {
    const sorted = [...people].sort((a, b) => {
      if (sortBy === 'recency') {
        // Get most recent interaction date, fall back to updated_at or created_at
        const aInteractionDate = getMostRecentInteractionDate(a.timeline);
        const bInteractionDate = getMostRecentInteractionDate(b.timeline);
        
        const aDate = aInteractionDate || (a.updated_at ? new Date(a.updated_at) : null) || (a.created_at ? new Date(a.created_at) : null);
        const bDate = bInteractionDate || (b.updated_at ? new Date(b.updated_at) : null) || (b.created_at ? new Date(b.created_at) : null);
        
        // If both have dates, compare them
        if (aDate && bDate) {
          return bDate.getTime() - aDate.getTime();
        }
        // If only one has a date, prioritize it
        if (aDate && !bDate) return -1;
        if (!aDate && bDate) return 1;
        // If neither has a date, maintain order
        return 0;
      } else if (sortBy === 'network-strength') {
        // Network strength order: HIGH > MEDIUM > LOW
        const strengthOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const aStrength = a.network_strength || 'MEDIUM';
        const bStrength = b.network_strength || 'MEDIUM';
        const aOrder = strengthOrder[aStrength as keyof typeof strengthOrder] || 2;
        const bOrder = strengthOrder[bStrength as keyof typeof strengthOrder] || 2;
        return bOrder - aOrder;
      } else {
        // alphabetical
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        return aName.localeCompare(bName);
      }
    });

    return reverse ? sorted.reverse() : sorted;
  }, [people, sortBy, reverse]);

  // Filter people based on search query and starred filter
  const filteredPeople = sortedPeople.filter((person) => {
    // Apply starred filter
    if (showStarredOnly && !person.starred) {
      return false;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchableFields = [
        person.name,
        person.email,
        person.phone,
        person.category,
        person.address,
        ...(person.owned_addresses || []),
      ]
        .filter(Boolean)
        .map((field) => field?.toLowerCase() || "");

      return searchableFields.some((field) => field.includes(query));
    }

    return true;
  });

  // Update selected person if they're filtered out
  useEffect(() => {
    if (selectedPerson && !filteredPeople.find((p) => p.id === selectedPerson.id)) {
      setSelectedPerson(filteredPeople.length > 0 ? filteredPeople[0] : null);
    } else if (!selectedPerson && filteredPeople.length > 0) {
      setSelectedPerson(filteredPeople[0]);
    }
  }, [filteredPeople, selectedPerson, setSelectedPerson]);

  return (
    <PeopleList
      people={filteredPeople}
      selectedPerson={selectedPerson}
      showStarredOnly={showStarredOnly}
      loading={loading}
      onSelectPerson={setSelectedPerson}
      onToggleStar={handleToggleStar}
      onDragStart={() => {}}
    />
  );
}
