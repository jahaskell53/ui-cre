"use client";

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PropertyPopupContent } from './property-popup-content';

mapboxgl.accessToken = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

export type ListingSource = 'loopnet' | 'zillow';

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
}

export type HeatmapMetric = 'none' | 'capRate' | 'rent' | 'valuation' | 'recentSales' | 'trending' | 'neighborhood';

export type MapBounds = { north: number; south: number; east: number; west: number };

interface MapProps {
    className?: string;
    properties: Property[];
    selectedId?: string | number | null;
    heatmapMetric?: HeatmapMetric;
    onMetricChange?: (metric: HeatmapMetric) => void;
    onBoundsChange?: (bounds: MapBounds) => void;
}

// Mock neighborhood data for Bay Area (for neighborhood filter/choropleth)
const mockNeighborhoodData: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { name: "Mission District", id: "mission" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.428, 37.765],
                    [-122.405, 37.765],
                    [-122.405, 37.748],
                    [-122.428, 37.748],
                    [-122.428, 37.765]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "SOMA", id: "soma" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.415, 37.790],
                    [-122.385, 37.790],
                    [-122.385, 37.770],
                    [-122.415, 37.770],
                    [-122.415, 37.790]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Nob Hill", id: "nob-hill" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.425, 37.795],
                    [-122.405, 37.795],
                    [-122.405, 37.785],
                    [-122.425, 37.785],
                    [-122.425, 37.795]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Castro", id: "castro" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.445, 37.768],
                    [-122.428, 37.768],
                    [-122.428, 37.755],
                    [-122.445, 37.755],
                    [-122.445, 37.768]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Marina", id: "marina" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.450, 37.808],
                    [-122.425, 37.808],
                    [-122.425, 37.798],
                    [-122.450, 37.798],
                    [-122.450, 37.808]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Richmond", id: "richmond" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.510, 37.788],
                    [-122.450, 37.788],
                    [-122.450, 37.775],
                    [-122.510, 37.775],
                    [-122.510, 37.788]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Sunset", id: "sunset" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.510, 37.768],
                    [-122.450, 37.768],
                    [-122.450, 37.745],
                    [-122.510, 37.745],
                    [-122.510, 37.768]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Palo Alto", id: "palo-alto" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.180, 37.460],
                    [-122.110, 37.460],
                    [-122.110, 37.410],
                    [-122.180, 37.410],
                    [-122.180, 37.460]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Mountain View", id: "mountain-view" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.120, 37.415],
                    [-122.050, 37.415],
                    [-122.050, 37.375],
                    [-122.120, 37.375],
                    [-122.120, 37.415]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "San Jose Downtown", id: "san-jose" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-121.920, 37.355],
                    [-121.865, 37.355],
                    [-121.865, 37.315],
                    [-121.920, 37.315],
                    [-121.920, 37.355]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Oakland Downtown", id: "oakland" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.285, 37.815],
                    [-122.245, 37.815],
                    [-122.245, 37.790],
                    [-122.285, 37.790],
                    [-122.285, 37.815]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { name: "Berkeley", id: "berkeley" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.295, 37.885],
                    [-122.245, 37.885],
                    [-122.245, 37.855],
                    [-122.295, 37.855],
                    [-122.295, 37.885]
                ]]
            }
        }
    ]
};

// Heatmap color ramps for different metrics
const heatmapColors: Record<HeatmapMetric, string[]> = {
    none: [],
    neighborhood: [],
    capRate: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'], // green to red
    rent: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'], // light to dark blue
    valuation: ['#fef3c7', '#fcd34d', '#f59e0b', '#d97706', '#92400e'], // light to dark amber
    recentSales: ['#f0fdf4', '#86efac', '#22c55e', '#15803d', '#14532d'], // light to dark green
    trending: ['#ef4444', '#fca5a5', '#f5f5f4', '#86efac', '#22c55e'], // red to green
};

const metricLabels: Record<HeatmapMetric, { label: string; description: string }> = {
    none: { label: 'None', description: '' },
    neighborhood: { label: 'Neighborhoods', description: 'Filter by area' },
    capRate: { label: 'Cap Rate', description: 'Higher intensity = higher cap rate' },
    rent: { label: 'Avg Rent', description: 'Higher intensity = higher rent' },
    valuation: { label: 'Valuation', description: 'Higher intensity = higher value' },
    recentSales: { label: 'Recent Sales', description: 'Higher intensity = more activity' },
    trending: { label: 'Trending', description: 'Hot spots = appreciation' },
};

// Helper to parse numeric values from property strings
const parseNumericValue = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
};

// Generate mock values for properties (in production, this would come from real data)
const getMockPropertyValue = (property: Property, metric: HeatmapMetric): number => {
    // Use property id as seed for consistent random values
    const seed = typeof property.id === 'string' ? property.id.charCodeAt(0) : property.id;
    const pseudoRandom = (seed * 9301 + 49297) % 233280;
    const random = pseudoRandom / 233280;

    switch (metric) {
        case 'capRate':
            // Try to parse from property, otherwise generate mock
            const capRate = parseNumericValue(property.capRate);
            return capRate > 0 ? capRate : 2.5 + random * 4; // 2.5% to 6.5%
        case 'rent':
            return 2000 + random * 4000; // $2000 to $6000
        case 'valuation':
            const price = parseNumericValue(property.price);
            return price > 0 ? price / 1000000 : 0.5 + random * 4; // Normalize to millions
        case 'recentSales':
            return random * 10; // 0 to 10 weight
        case 'trending':
            return -5 + random * 15; // -5% to +10%
        default:
            return 1;
    }
};

export const PropertyMap = ({ className, properties, selectedId, heatmapMetric = 'none', onBoundsChange }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<{ [key: string | number]: mapboxgl.Marker }>({});
    const popupRoots = useRef<ReturnType<typeof createRoot>[]>([]);
    const onBoundsChangeRef = useRef(onBoundsChange);
    const [hoveredNeighborhood, setHoveredNeighborhood] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => { onBoundsChangeRef.current = onBoundsChange; });

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-122.4194, 37.7749],
            zoom: 10,
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
        };

        map.current.on('moveend', reportBounds);

        map.current.on('load', () => {
            map.current?.resize();
            reportBounds();

            // Add neighborhood source for choropleth
            map.current?.addSource('neighborhoods', {
                type: 'geojson',
                data: mockNeighborhoodData
            });

            // Neighborhood fill layer (for choropleth mode)
            map.current?.addLayer({
                id: 'neighborhoods-fill',
                type: 'fill',
                source: 'neighborhoods',
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0
                }
            });

            // Neighborhood outline layer
            map.current?.addLayer({
                id: 'neighborhoods-outline',
                type: 'line',
                source: 'neighborhoods',
                paint: {
                    'line-color': '#1d4ed8',
                    'line-width': 2,
                    'line-opacity': 0
                }
            });

            // Neighborhood labels
            map.current?.addLayer({
                id: 'neighborhoods-labels',
                type: 'symbol',
                source: 'neighborhoods',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-size': 12,
                    'text-anchor': 'center',
                },
                paint: {
                    'text-color': '#1e3a8a',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1,
                    'text-opacity': 0
                }
            });

            // Add empty heatmap source (will be populated with property data)
            map.current?.addSource('properties-heatmap', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            // Heatmap layer
            map.current?.addLayer({
                id: 'properties-heatmap-layer',
                type: 'heatmap',
                source: 'properties-heatmap',
                paint: {
                    // Weight based on property value
                    'heatmap-weight': ['get', 'weight'],
                    // Increase intensity as zoom level increases
                    'heatmap-intensity': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 1,
                        15, 3
                    ],
                    // Color ramp
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(0, 0, 255, 0)',
                        0.1, '#3b82f6',
                        0.3, '#22c55e',
                        0.5, '#eab308',
                        0.7, '#f97316',
                        1, '#ef4444'
                    ],
                    // Radius increases with zoom
                    'heatmap-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 2,
                        9, 20,
                        15, 40
                    ],
                    // Opacity
                    'heatmap-opacity': 0
                }
            }, 'waterway-label');

            // Hover interactions for neighborhoods
            map.current?.on('mousemove', 'neighborhoods-fill', (e) => {
                if (e.features && e.features[0]) {
                    const name = e.features[0].properties?.name;
                    setHoveredNeighborhood(name);
                    if (map.current) map.current.getCanvas().style.cursor = 'pointer';
                }
            });

            map.current?.on('mouseleave', 'neighborhoods-fill', () => {
                setHoveredNeighborhood(null);
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            setMapLoaded(true);
        });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update heatmap data when properties or metric changes
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        const isHeatmapMode = heatmapMetric !== 'none' && heatmapMetric !== 'neighborhood';
        const isNeighborhoodMode = heatmapMetric === 'neighborhood';

        // Update heatmap layer
        if (isHeatmapMode && properties.length > 0) {
            // Convert properties to GeoJSON with weights
            const heatmapData: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: properties.map(property => ({
                    type: 'Feature' as const,
                    properties: {
                        weight: getMockPropertyValue(property, heatmapMetric),
                        name: property.name
                    },
                    geometry: {
                        type: 'Point' as const,
                        coordinates: property.coordinates
                    }
                }))
            };

            // Update source data
            const source = map.current.getSource('properties-heatmap') as mapboxgl.GeoJSONSource;
            if (source) {
                source.setData(heatmapData);
            }

            // Update heatmap colors based on metric
            const colors = heatmapColors[heatmapMetric];
            if (colors.length >= 5) {
                map.current.setPaintProperty('properties-heatmap-layer', 'heatmap-color', [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0, 0, 0, 0)',
                    0.2, colors[0],
                    0.4, colors[1],
                    0.6, colors[2],
                    0.8, colors[3],
                    1, colors[4]
                ]);
            }

            // Show heatmap, hide neighborhoods
            map.current.setPaintProperty('properties-heatmap-layer', 'heatmap-opacity', 0.8);
            map.current.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0);
            map.current.setPaintProperty('neighborhoods-outline', 'line-opacity', 0);
            map.current.setPaintProperty('neighborhoods-labels', 'text-opacity', 0);
        } else if (isNeighborhoodMode) {
            // Show neighborhoods, hide heatmap
            map.current.setPaintProperty('properties-heatmap-layer', 'heatmap-opacity', 0);
            map.current.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.15);
            map.current.setPaintProperty('neighborhoods-outline', 'line-opacity', 0.8);
            map.current.setPaintProperty('neighborhoods-labels', 'text-opacity', 1);
        } else {
            // Hide both
            map.current.setPaintProperty('properties-heatmap-layer', 'heatmap-opacity', 0);
            map.current.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0);
            map.current.setPaintProperty('neighborhoods-outline', 'line-opacity', 0);
            map.current.setPaintProperty('neighborhoods-labels', 'text-opacity', 0);
        }
    }, [heatmapMetric, properties, mapLoaded]);

    // Update markers when properties change
    useEffect(() => {
        if (!map.current) return;

        // Clear existing markers
        Object.values(markers.current).forEach(marker => marker.remove());
        markers.current = {};

        // Cleanup previous roots
        const previousRoots = [...popupRoots.current];
        popupRoots.current = [];

        // Only show markers when not in heatmap mode (or show fewer markers)
        const showMarkers = heatmapMetric === 'none' || heatmapMetric === 'neighborhood';
        const markersToShow = showMarkers ? properties : properties.slice(0, 50); // Limit markers in heatmap mode

        markersToShow.forEach((property) => {
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

            const markerColor = property.listingSource === 'zillow' ? '#f97316' : property.listingSource === 'loopnet' ? '#0ea5e9' : (showMarkers ? '#0ea5e9' : '#ffffff');
            const marker = new mapboxgl.Marker({
                color: showMarkers ? markerColor : '#ffffff',
                scale: showMarkers ? 1 : 0.6
            })
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
    }, [properties, heatmapMetric]);

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

    const isHeatmapMode = heatmapMetric !== 'none' && heatmapMetric !== 'neighborhood';

    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

            {/* Heatmap Legend */}
            {isHeatmapMode && (
                <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[180px]">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        {metricLabels[heatmapMetric].label}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                        {metricLabels[heatmapMetric].description}
                    </div>
                    <div className="flex items-center gap-0.5">
                        {heatmapColors[heatmapMetric].map((color, i) => (
                            <div
                                key={i}
                                className="flex-1 h-3"
                                style={{
                                    backgroundColor: color,
                                    borderRadius: i === 0 ? '2px 0 0 2px' : i === heatmapColors[heatmapMetric].length - 1 ? '0 2px 2px 0' : '0'
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                        <span>Low</span>
                        <span>High</span>
                    </div>
                </div>
            )}

            {/* Neighborhood hover info */}
            {heatmapMetric === 'neighborhood' && hoveredNeighborhood && (
                <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {hoveredNeighborhood}
                    </div>
                    <div className="text-xs text-gray-500">Click to filter</div>
                </div>
            )}
        </div>
    );
};

// Export the type with an alias for backwards compatibility
export type ChoroplethMetric = HeatmapMetric;
