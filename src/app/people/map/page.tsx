"use client";

import { PropertiesMapView } from "../components/properties-map-view";
import { usePeople } from "../people-context";

export default function MapPage() {
  const { people, searchQuery, showStarredOnly, setSelectedPerson } = usePeople();

  return (
    <PropertiesMapView
      people={people}
      searchQuery={searchQuery}
      showStarredOnly={showStarredOnly}
      onSelectPerson={setSelectedPerson}
    />
  );
}

