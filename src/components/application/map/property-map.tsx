"use client";

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PropertyPopupContent } from './property-popup-content';

mapboxgl.accessToken = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

export interface Property {
    id: string | number;
    name: string;
    address: string;
    location?: string | null;
    units?: number | null;
    price: string;
    coordinates: [number, number];
    thumbnailUrl?: string | null;
    capRate?: string | null;
    squareFootage?: string | null;
}

interface MapProps {
    className?: string;
    properties: Property[];
    selectedId?: string | number | null;
}

export const PropertyMap = ({ className, properties, selectedId }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<{ [key: string | number]: mapboxgl.Marker }>({});
    const popupRoots = useRef<ReturnType<typeof createRoot>[]>([]);

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11', // Cleaner style
            center: [-122.4194, 37.7749],
            zoom: 10,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => {
            map.current?.resize();
        });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update markers when properties change
    useEffect(() => {
        if (!map.current) return;

        // Clear existing markers
        Object.values(markers.current).forEach(marker => marker.remove());
        markers.current = {};

        // Cleanup previous roots
        const previousRoots = [...popupRoots.current];
        popupRoots.current = [];

        properties.forEach((property) => {
            const popupContainer = document.createElement('div');
            const root = createRoot(popupContainer);
            popupRoots.current.push(root);
            root.render(
                <PropertyPopupContent
                    name={property.name}
                    address={property.address}
                    price={property.price}
                    units={property.units}
                    capRate={property.capRate}
                    squareFootage={property.squareFootage}
                    thumbnailUrl={property.thumbnailUrl}
                />
            );

            const popup = new mapboxgl.Popup({ 
                offset: 25, 
                className: 'property-popup',
                closeButton: false,
            }).setDOMContent(popupContainer);

            const marker = new mapboxgl.Marker({ color: '#0ea5e9' }) // Blue marker to match new style
                .setLngLat(property.coordinates)
                .setPopup(popup)
                .addTo(map.current!);

            markers.current[property.id] = marker;
        });

        // Cleanup roots asynchronously
        return () => {
            setTimeout(() => {
                previousRoots.forEach(root => {
                    try {
                        root.unmount();
                    } catch (e) {}
                });
            }, 0);
        };
    }, [properties]);

    // Handle external selection
    useEffect(() => {
        if (!map.current || !selectedId) return;

        const property = properties.find(p => p.id === selectedId);
        const marker = markers.current[selectedId];

        if (property && marker) {
            map.current.flyTo({
                center: property.coordinates,
                zoom: 14,
                essential: true
            });

            // Open the popup
            const popup = marker.getPopup();
            if (popup && !popup.isOpen()) {
                marker.togglePopup();
            }
        }
    }, [selectedId, properties]);

    return (
        <div ref={mapContainer} className={className} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
    );
};
