"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

export interface ContactLocation {
    id: string;
    name: string;
    email: string;
    addressLabel: "Home" | "Owned";
    address: string;
    coordinates: [number, number]; // [lng, lat]
}

interface ContactMapProps {
    className?: string;
    locations: ContactLocation[];
    selectedId?: string | null;
}

export const ContactMap = ({ className, locations, selectedId }: ContactMapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<Record<string, mapboxgl.Marker>>({});

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/streets-v12",
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

    // Render markers whenever locations change
    useEffect(() => {
        if (!map.current) return;

        // Remove existing markers
        Object.values(markers.current).forEach((marker) => marker.remove());
        markers.current = {};

        locations.forEach((loc) => {
            const popup = new mapboxgl.Popup({ offset: 18, className: "contact-popup" }).setHTML(`
                <div style="padding: 8px; width: 220px;">
                    <div style="font-weight: 700; font-size: 13px; color: #101828; line-height: 1.2;">
                        ${loc.name}
                    </div>
                    <div style="font-size: 11px; color: #475467; margin-top: 2px;">
                        ${loc.email}
                    </div>
                    <div style="margin-top: 8px;">
                        <span style="font-size: 10px; font-weight: 700; color: #344054; background: #f2f4f7; border: 1px solid #d0d5dd; padding: 2px 6px; border-radius: 999px;">
                            ${loc.addressLabel}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #475467; margin-top: 6px; line-height: 1.3;">
                        ${loc.address}
                    </div>
                </div>
            `);

            const color = loc.addressLabel === "Home" ? "#0ea5e9" : "#7f56d9";

            const marker = new mapboxgl.Marker({ color })
                .setLngLat(loc.coordinates)
                .setPopup(popup)
                .addTo(map.current!);

            markers.current[loc.id] = marker;
        });
    }, [locations]);

    // Handle external selection
    useEffect(() => {
        if (!map.current || !selectedId) return;

        const loc = locations.find((l) => l.id === selectedId);
        const marker = selectedId ? markers.current[selectedId] : undefined;

        if (loc && marker) {
            map.current.flyTo({
                center: loc.coordinates,
                zoom: 14,
                essential: true,
            });

            const popup = marker.getPopup();
            if (popup && !popup.isOpen()) {
                marker.togglePopup();
            }
        }
    }, [selectedId, locations]);

    return <div ref={mapContainer} className={className} style={{ width: "100%", height: "100%", minHeight: "400px" }} />;
};

