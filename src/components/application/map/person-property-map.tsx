"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

interface PersonPropertyMapProps {
  className?: string;
  addresses: string[];
  personName: string;
}

interface GeocodedAddress {
  address: string;
  coordinates: [number, number];
  label: "Home" | "Owned";
}

export const PersonPropertyMap = ({ className, addresses, personName }: PersonPropertyMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [geocodedAddresses, setGeocodedAddresses] = useState<GeocodedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Geocode addresses
  useEffect(() => {
    if (addresses.length === 0) {
      setIsLoading(false);
      setGeocodedAddresses([]);
      return;
    }

    let isMounted = true;

    const geocodeAddresses = async () => {
      setIsLoading(true);
      const geocoded: GeocodedAddress[] = [];

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        if (!address || address.trim().length === 0) continue;
        
        try {
          const response = await fetch(
            `/api/geocode?q=${encodeURIComponent(address)}`
          );
          
          if (!response.ok) {
            console.error(`Failed to geocode address: ${address}`);
            continue;
          }
          
          const data = await response.json();
          
          if (data.suggestions && data.suggestions.length > 0 && isMounted) {
            const firstResult = data.suggestions[0];
            geocoded.push({
              address,
              coordinates: firstResult.coordinates as [number, number],
              label: i === 0 ? "Home" : "Owned",
            });
          }
        } catch (error) {
          console.error(`Error geocoding address: ${address}`, error);
        }
      }

      if (isMounted) {
        setGeocodedAddresses(geocoded);
        setIsLoading(false);
      }
    };

    geocodeAddresses();

    return () => {
      isMounted = false;
    };
  }, [addresses]);

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

  // Update markers when geocoded addresses change
  useEffect(() => {
    if (!map.current || isLoading) return;

    // Remove existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (geocodedAddresses.length === 0) return;

    // Add new markers
    const bounds = new mapboxgl.LngLatBounds();

    geocodedAddresses.forEach((geocoded) => {
      const popup = new mapboxgl.Popup({ offset: 18, className: "property-popup" }).setHTML(`
        <div style="padding: 8px; width: 220px;">
          <div style="font-weight: 700; font-size: 13px; color: #101828; line-height: 1.2;">
            ${personName}
          </div>
          <div style="margin-top: 8px;">
            <span style="font-size: 10px; font-weight: 700; color: #344054; background: #f2f4f7; border: 1px solid #d0d5dd; padding: 2px 6px; border-radius: 999px;">
              ${geocoded.label}
            </span>
          </div>
          <div style="font-size: 11px; color: #475467; margin-top: 6px; line-height: 1.3;">
            ${geocoded.address}
          </div>
        </div>
      `);

      // Create custom HTML marker element - pin
      const el = document.createElement('div');
      el.className = 'custom-map-marker';
      
      const isHome = geocoded.label === "Home";
      const pinColor = isHome ? '#0ea5e9' : '#7f56d9';
      
      // Container
      el.style.width = '32px';
      el.style.height = '40px';
      el.style.position = 'relative';
      el.style.cursor = 'pointer';
      
      // Create the pin SVG
      el.innerHTML = `
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16 0 0 7.16 0 16C0 24.84 16 40 16 40C16 40 32 24.84 32 16C32 7.16 24.84 0 16 0Z" fill="${pinColor}"/>
          <circle cx="16" cy="14" r="6" fill="white"/>
        </svg>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(geocoded.coordinates)
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
      bounds.extend(geocoded.coordinates);
    });

    // Fit map to bounds if we have multiple addresses
    if (geocodedAddresses.length > 1) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
      });
    } else if (geocodedAddresses.length === 1) {
      map.current.flyTo({
        center: geocodedAddresses[0].coordinates,
        zoom: 14,
        essential: true,
      });
    }
  }, [geocodedAddresses, isLoading, personName]);

  if (addresses.length === 0) {
    return null;
  }

  return (
    <div ref={mapContainer} className={className} style={{ width: "100%", height: "300px", borderRadius: "8px", overflow: "hidden" }} />
  );
};
