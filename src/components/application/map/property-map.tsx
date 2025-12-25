"use client";

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

export interface Property {
    id: string | number;
    name: string;
    address: string;
    units?: number | null;
    price: string;
    coordinates: [number, number];
    thumbnailUrl?: string | null;
    capRate?: string | null;
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

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-122.4194, 37.7749],
            zoom: 10,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Initial markers
        properties.forEach((property) => {
            const popup = new mapboxgl.Popup({ offset: 25, className: 'property-popup' })
                .setHTML(`
                    <div style="padding: 0px; width: 200px;">
                        ${property.thumbnailUrl ? `
                            <div style="width: 100%; height: 100px; border-radius: 8px 8px 0 0; overflow: hidden; background: #f2f4f7;">
                                <img src="${property.thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="${property.name}" />
                            </div>
                        ` : ''}
                        <div style="padding: 8px;">
                            <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #101828;">${property.name}</h3>
                            <p style="font-size: 12px; color: #475467; margin-bottom: 8px;">${property.address}</p>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                ${property.units && property.units > 0 ? `<span style="font-size: 11px; font-weight: 600; color: #7f56d9;">${property.units} Units</span>` : '<span></span>'}
                                <span style="font-size: 13px; font-weight: 700; color: #101828;">${property.price}</span>
                            </div>
                            ${property.capRate ? `
                                <div style="display: flex; justify-content: flex-start; align-items: center;">
                                    <span style="font-size: 11px; font-weight: 500; color: #475467; background: #f2f4f7; padding: 2px 6px; border-radius: 4px;">
                                        ${property.capRate}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `);

            const marker = new mapboxgl.Marker({ color: '#7f56d9' })
                .setLngLat(property.coordinates)
                .setPopup(popup)
                .addTo(map.current!);

            markers.current[property.id] = marker;
        });

        map.current.on('load', () => {
            map.current?.resize();
        });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
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
            if (!marker.getPopup().isOpen()) {
                marker.togglePopup();
            }
        }
    }, [selectedId, properties]);

    return (
        <div ref={mapContainer} className={className} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
    );
};
