"use client";

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

interface MapProps {
    className?: string;
}

export const PropertyMap = ({ className }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-74.5, 40],
            zoom: 9,
        });

        // Add navigation controls (zoom, rotate)
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        return () => {
            map.current?.remove();
        };
    }, []);

    return (
        <div ref={mapContainer} className={className} style={{ width: '100%', height: '100%' }} />
    );
};
