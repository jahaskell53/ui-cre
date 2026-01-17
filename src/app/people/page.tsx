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
  } = usePeople();

  const handleToggleStar = useMemo(
    () => createToggleStarHandler(people, setPeople, selectedPerson, setSelectedPerson, showStarredOnly),
    [people, setPeople, selectedPerson, setSelectedPerson, showStarredOnly]
  );

  // Filter people based on search query and starred filter
  const filteredPeople = people.filter((person) => {
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
