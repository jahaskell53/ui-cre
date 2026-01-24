"use client";

import { useState } from "react";
import { usePageTour } from "@/hooks/use-page-tour";
import { PropertiesMapView } from "../components/properties-map-view";
import { usePeople } from "../people-context";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";

export default function MapPage() {
  const { people, searchQuery, showStarredOnly, setSelectedPerson } = usePeople();
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Listen for tour trigger from sidebar
  usePageTour(() => setIsTourOpen(true));

  const tourSteps: TourStep[] = [
    {
      id: "map-tab",
      target: '[data-tour="map-tab"]',
      title: "Map View",
      content: "The map view shows all your contacts and their properties on an interactive map. Click on markers to see contact details.",
      position: "bottom",
    },
    {
      id: "map-search",
      target: '[data-tour="search-bar"]',
      title: "Search on Map",
      content: "Search for contacts by name, email, or address. The map will filter to show matching contacts.",
      position: "bottom",
    },
  ];

  return (
    <div className="relative flex-1 overflow-hidden">
      <PropertiesMapView
        people={people}
        searchQuery={searchQuery}
        showStarredOnly={showStarredOnly}
        onSelectPerson={setSelectedPerson}
      />

      {/* Guided Tour */}
      <GuidedTour
        steps={tourSteps}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onComplete={() => {
          console.log("Map tour completed!");
        }}
      />
    </div>
  );
}

