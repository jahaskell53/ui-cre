"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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

    // Remove existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (propertyLocations.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    propertyLocations.forEach((location) => {
      const popup = new mapboxgl.Popup({ offset: 18, className: "property-popup" }).setHTML(`
        <div style="padding: 8px; width: 220px;">
          <div style="font-weight: 700; font-size: 13px; color: #101828; line-height: 1.2; margin-bottom: 4px;">
            ${location.person.name}
          </div>
          ${location.person.category ? `
            <div style="margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 700; color: #344054; background: #f2f4f7; border: 1px solid #d0d5dd; padding: 2px 6px; border-radius: 999px;">
                ${location.person.category}
              </span>
            </div>
          ` : ''}
          <div style="margin-top: 8px;">
            <span style="font-size: 10px; font-weight: 700; color: #344054; background: #f2f4f7; border: 1px solid #d0d5dd; padding: 2px 6px; border-radius: 999px;">
              ${location.label}
            </span>
          </div>
          <div style="font-size: 11px; color: #475467; margin-top: 6px; line-height: 1.3;">
            ${location.address}
          </div>
        </div>
      `);

      // Create custom pin marker
      const el = document.createElement('div');
      el.className = 'custom-map-marker';
      
      const isHome = location.label === "Home";
      const pinColor = isHome ? '#0ea5e9' : '#7f56d9';
      
      el.style.width = '32px';
      el.style.height = '40px';
      el.style.position = 'relative';
      el.style.cursor = 'pointer';
      
      el.innerHTML = `
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16 0 0 7.16 0 16C0 24.84 16 40 16 40C16 40 32 24.84 32 16C32 7.16 24.84 0 16 0Z" fill="${pinColor}"/>
          <circle cx="16" cy="14" r="6" fill="white"/>
        </svg>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
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

