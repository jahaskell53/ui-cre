"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPopupContent } from "@/components/application/map/map-popup-content";
import type { Person } from "../types";

mapboxgl.accessToken = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

interface PropertiesMapViewProps {
  people: Person[];
  searchQuery: string;
  showStarredOnly: boolean;
  onSelectPerson: (person: Person) => void;
}

interface PropertyLocation {
  person: Person;
  address: string;
  coordinates: [number, number];
  label: "Home" | "Owned";
}

export function PropertiesMapView({
  people,
  searchQuery,
  showStarredOnly,
  onSelectPerson,
}: PropertiesMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const popupRoots = useRef<ReturnType<typeof createRoot>[]>([]);
  const [propertyLocations, setPropertyLocations] = useState<PropertyLocation[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Filter people based on search and starred (memoized to prevent infinite loops)
  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      if (showStarredOnly && !person.starred) return false;
      if (searchQuery && !person.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [people, showStarredOnly, searchQuery]);

  // Geocode all addresses for filtered people
  useEffect(() => {
    let isMounted = true;

    const geocodeProperties = async () => {
      setIsGeocoding(true);
      const locations: PropertyLocation[] = [];

      for (const person of filteredPeople) {
        // Geocode home address
        if (person.address) {
          try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(person.address)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.suggestions && data.suggestions.length > 0) {
                locations.push({
                  person,
                  address: person.address,
                  coordinates: data.suggestions[0].coordinates as [number, number],
                  label: "Home",
                });
              }
            }
          } catch (error) {
            console.error(`Failed to geocode address: ${person.address}`, error);
          }
        }

        // Geocode owned addresses
        if (person.owned_addresses && person.owned_addresses.length > 0) {
          for (const address of person.owned_addresses) {
            try {
              const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
              if (response.ok) {
                const data = await response.json();
                if (data.suggestions && data.suggestions.length > 0) {
                  locations.push({
                    person,
                    address,
                    coordinates: data.suggestions[0].coordinates as [number, number],
                    label: "Owned",
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to geocode address: ${address}`, error);
            }
          }
        }
      }

      if (isMounted) {
        setPropertyLocations(locations);
        setIsGeocoding(false);
      }
    };

    if (filteredPeople.length > 0) {
      geocodeProperties();
    } else {
      setPropertyLocations([]);
      setIsGeocoding(false);
    }

    return () => {
      isMounted = false;
    };
  }, [filteredPeople]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/jahaskell531/cmkipuhbj006p01t03hd10bb1",
      center: [-122.4194, 37.7749],
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      map.current?.resize();
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when property locations change
  useEffect(() => {
    if (!map.current || isGeocoding) return;

    // Store previous roots for cleanup
    const previousRoots = [...popupRoots.current];
    const previousMarkers = [...markers.current];

    // Clear refs immediately
    markers.current = [];
    popupRoots.current = [];

    // Remove existing markers
    previousMarkers.forEach((marker) => marker.remove());

    if (propertyLocations.length === 0) {
      // Cleanup roots asynchronously to avoid race condition
      setTimeout(() => {
        previousRoots.forEach((root) => {
          try {
            root.unmount();
          } catch (e) {
            // Ignore errors if already unmounted
          }
        });
      }, 0);
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    const popups: mapboxgl.Popup[] = [];

    propertyLocations.forEach((location) => {
      // Create a container element for the React component
      const popupContainer = document.createElement("div");
      const root = createRoot(popupContainer);
      popupRoots.current.push(root);
      root.render(
        <MapPopupContent
          personName={location.person.name}
          category={location.person.category}
          label={location.label}
          address={location.address}
        />
      );

      const popup = new mapboxgl.Popup({ 
        offset: 18, 
        className: "property-popup",
        closeButton: true,
        closeOnClick: false,
      }).setDOMContent(popupContainer);

      // Close other popups when this one opens
      popup.on('open', () => {
        popups.forEach((p) => {
          if (p !== popup && p.isOpen()) {
            p.remove();
          }
        });
      });

      popups.push(popup);

      // Create custom pin marker
      const el = document.createElement('div');
      el.className = 'custom-map-marker';
      
      const isHome = location.label === "Home";
      const pinColor = isHome ? '#0ea5e9' : '#7f56d9';
      
      // Set styles to prevent drift - let Mapbox handle positioning
      el.style.width = '32px';
      el.style.height = '40px';
      el.style.margin = '0';
      el.style.padding = '0';
      el.style.border = 'none';
      el.style.outline = 'none';
      el.style.cursor = 'pointer';
      el.style.display = 'block';
      el.style.boxSizing = 'border-box';
      el.style.lineHeight = '0';
      
      el.innerHTML = `
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0; padding: 0; width: 32px; height: 40px;">
          <path d="M16 0C7.16 0 0 7.16 0 16C0 24.84 16 40 16 40C16 40 32 24.84 32 16C32 7.16 24.84 0 16 0Z" fill="${pinColor}"/>
          <circle cx="16" cy="14" r="6" fill="white"/>
        </svg>
      `;

      const marker = new mapboxgl.Marker({ 
        element: el, 
        anchor: 'bottom'
      })
        .setLngLat(location.coordinates)
        .setPopup(popup)
        .addTo(map.current!);

      marker.getElement().addEventListener('click', () => {
        onSelectPerson(location.person);
      });

      markers.current.push(marker);
      bounds.extend(location.coordinates);
    });

    // Fit map to bounds
    if (propertyLocations.length > 0) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
        animate: false,
      });
    }

    // Cleanup previous roots asynchronously after render
    return () => {
      setTimeout(() => {
        previousRoots.forEach((root) => {
          try {
            root.unmount();
          } catch (e) {
            // Ignore errors if already unmounted
          }
        });
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyLocations, isGeocoding]);

  return (
    <div className="flex-1 flex flex-col min-w-0 relative">
      {/* Map */}
      <div
        ref={mapContainer}
        className="flex-1 w-full"
        style={{ minHeight: "400px" }}
      />
    </div>
  );
}

