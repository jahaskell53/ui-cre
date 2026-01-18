"use client";

import { useEffect, useMemo } from "react";
import { PeopleList } from "./components/people-list";
import { usePeople } from "./people-context";
import { createToggleStarHandler } from "./utils";

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
        const aDate = a.updated_at || a.created_at || '';
        const bDate = b.updated_at || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
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
