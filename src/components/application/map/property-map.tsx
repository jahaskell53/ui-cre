"use client";

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PropertyPopupContent } from './property-popup-content';

mapboxgl.accessToken = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

export type ListingSource = 'loopnet' | 'zillow';

export interface UnitMixRow {
    beds: number | null;
    baths: number | null;
    count: number;
    avgPrice: number | null;
}

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
    listingSource?: ListingSource | null;
    isReit?: boolean;
    unitMix?: UnitMixRow[];
}

export type MapBounds = { north: number; south: number; east: number; west: number };

interface MapProps {
    className?: string;
    properties: Property[];
    selectedId?: string | number | null;
    initialCenter?: [number, number];
    initialZoom?: number;
    onBoundsChange?: (bounds: MapBounds) => void;
    onViewChange?: (lat: number, lng: number, zoom: number) => void;
}

export const PropertyMap = ({ className, properties, selectedId, initialCenter, initialZoom, onBoundsChange, onViewChange }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<{ [key: string | number]: mapboxgl.Marker }>({});
    const popupRoots = useRef<ReturnType<typeof createRoot>[]>([]);
    const onBoundsChangeRef = useRef(onBoundsChange);
    const onViewChangeRef = useRef(onViewChange);

    useEffect(() => { onBoundsChangeRef.current = onBoundsChange; });
    useEffect(() => { onViewChangeRef.current = onViewChange; });

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: initialCenter ?? [-122.4194, 37.7749],
            zoom: initialZoom ?? 10,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        const reportBounds = () => {
            if (!map.current) return;
            const b = map.current.getBounds()!;
            onBoundsChangeRef.current?.({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
            });
            const center = map.current.getCenter();
            onViewChangeRef.current?.(center.lat, center.lng, map.current.getZoom());
        };

        map.current.on('moveend', reportBounds);
        map.current.on('load', () => {
            map.current?.resize();
            reportBounds();
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
                    isReit={property.isReit}
                    unitMix={property.unitMix}
                    href={`/analytics/listing/${property.id}`}
                />
            );

            const popup = new mapboxgl.Popup({
                offset: 25,
                className: 'property-popup',
                closeButton: false,
            }).setDOMContent(popupContainer);

            const markerColor = property.listingSource === 'zillow' ? '#f97316' : '#0ea5e9';
            const marker = new mapboxgl.Marker({ color: markerColor })
                .setLngLat(property.coordinates)
                .setPopup(popup)
                .addTo(map.current!);

            markers.current[property.id] = marker;
        });

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

            const popup = marker.getPopup();
            if (popup && !popup.isOpen()) {
                marker.togglePopup();
            }
        }
    }, [selectedId, properties]);

    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};
