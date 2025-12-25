"use client";

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
                            <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 2px; color: #101828; line-height: 1.2;">${property.name}</h3>
                            <p style="font-size: 11px; color: #475467; margin-bottom: 2px; line-height: 1.3;">${property.address}</p>
                            ${property.location ? `<p style="font-size: 11px; color: #667085; font-weight: 500; margin-bottom: 6px;">${property.location}</p>` : '<div style="margin-bottom: 6px;"></div>'}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                ${property.units && property.units > 0 ? `<span style="font-size: 11px; font-weight: 600; color: #7f56d9;">${property.units} Units</span>` : '<span></span>'}
                                <span style="font-size: 13px; font-weight: 700; color: #101828;">${property.price}</span>
                            </div>
                            ${property.capRate || property.squareFootage ? `
                                <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                                    ${property.capRate ? `
                                        <span style="font-size: 10px; font-weight: 600; color: #344054; background: #f2f4f7; border: 1px solid #d0d5dd; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                                            ${property.capRate}
                                        </span>
                                    ` : ''}
                                    ${property.squareFootage ? `
                                        <span style="font-size: 10px; font-weight: 600; color: #344054; background: #f2f4f7; border: 1px solid #d0d5dd; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                                            ${property.squareFootage}
                                        </span>
                                    ` : ''}
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
