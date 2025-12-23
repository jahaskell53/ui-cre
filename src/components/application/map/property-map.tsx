"use client";

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

interface MapProps {
    className?: string;
}

const PROPERTIES = [
    { id: 1, name: 'Palms at Mission', address: '8200 Mission St, San Francisco', units: 120, price: '$18.5M', coordinates: [-122.4194, 37.7749] as [number, number] },
    { id: 2, name: 'The Heights', address: '123 Market St, San Francisco', units: 85, price: '$12.2M', coordinates: [-122.4014, 37.7889] as [number, number] },
    { id: 3, name: 'Oakland Lofts', address: '456 Broadway, Oakland', units: 45, price: '$8.7M', coordinates: [-122.2711, 37.8044] as [number, number] },
    { id: 4, name: 'Sunnyvale Garden', address: '789 Garden Way, Sunnyvale', units: 200, price: '$45M', coordinates: [-122.0363, 37.3688] as [number, number] },
];

export const PropertyMap = ({ className }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (!mapContainer.current) return;
        if (map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-122.4194, 37.7749], // Centered on San Francisco
            zoom: 10,
        });

        // Add navigation controls (zoom, rotate)
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add markers and popups
        PROPERTIES.forEach((property) => {
            const popup = new mapboxgl.Popup({ offset: 25, className: 'property-popup' })
                .setHTML(`
                    <div style="padding: 4px;">
                        <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #101828;">${property.name}</h3>
                        <p style="font-size: 12px; color: #475467; margin-bottom: 8px;">${property.address}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 11px; font-weight: 600; color: #7f56d9;">${property.units} Units</span>
                            <span style="font-size: 13px; font-weight: 700; color: #101828;">${property.price}</span>
                        </div>
                    </div>
                `);

            new mapboxgl.Marker({ color: '#7f56d9' })
                .setLngLat(property.coordinates)
                .setPopup(popup)
                .addTo(map.current!);
        });

        // Fix for container sizing issues on load
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

    return (
        <div ref={mapContainer} className={className} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
    );
};
