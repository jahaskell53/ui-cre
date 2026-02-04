"use client";

import { useEffect, useRef, useState } from 'react';
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

export type ChoroplethMetric = 'none' | 'capRate' | 'rent' | 'valuation' | 'recentSales' | 'trending';

interface MapProps {
    className?: string;
    properties: Property[];
    selectedId?: string | number | null;
    choroplethMetric?: ChoroplethMetric;
    onMetricChange?: (metric: ChoroplethMetric) => void;
}

// Mock neighborhood data for Bay Area
// In production, this would come from an API with real aggregated data
const mockNeighborhoodData: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {
                name: "Mission District",
                capRate: 4.2,
                rent: 3200,
                valuation: 1850000,
                recentSales: 12,
                trending: 5.2 // positive = up
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.428, 37.758],
                    [-122.405, 37.758],
                    [-122.405, 37.748],
                    [-122.428, 37.748],
                    [-122.428, 37.758]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "SOMA",
                capRate: 3.8,
                rent: 3800,
                valuation: 2200000,
                recentSales: 8,
                trending: -2.1
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.415, 37.785],
                    [-122.390, 37.785],
                    [-122.390, 37.770],
                    [-122.415, 37.770],
                    [-122.415, 37.785]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Nob Hill",
                capRate: 3.2,
                rent: 4200,
                valuation: 2800000,
                recentSales: 5,
                trending: 3.8
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.420, 37.795],
                    [-122.405, 37.795],
                    [-122.405, 37.785],
                    [-122.420, 37.785],
                    [-122.420, 37.795]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Castro",
                capRate: 4.5,
                rent: 3000,
                valuation: 1650000,
                recentSales: 15,
                trending: 1.5
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.445, 37.765],
                    [-122.428, 37.765],
                    [-122.428, 37.755],
                    [-122.445, 37.755],
                    [-122.445, 37.765]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Marina",
                capRate: 3.0,
                rent: 4500,
                valuation: 3200000,
                recentSales: 3,
                trending: 6.2
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.445, 37.808],
                    [-122.425, 37.808],
                    [-122.425, 37.798],
                    [-122.445, 37.798],
                    [-122.445, 37.808]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Richmond",
                capRate: 4.8,
                rent: 2800,
                valuation: 1400000,
                recentSales: 18,
                trending: -0.5
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.510, 37.785],
                    [-122.470, 37.785],
                    [-122.470, 37.775],
                    [-122.510, 37.775],
                    [-122.510, 37.785]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Sunset",
                capRate: 5.1,
                rent: 2600,
                valuation: 1200000,
                recentSales: 22,
                trending: 2.3
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.510, 37.765],
                    [-122.470, 37.765],
                    [-122.470, 37.750],
                    [-122.510, 37.750],
                    [-122.510, 37.765]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Palo Alto",
                capRate: 3.5,
                rent: 4800,
                valuation: 3500000,
                recentSales: 7,
                trending: 4.1
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.170, 37.450],
                    [-122.120, 37.450],
                    [-122.120, 37.420],
                    [-122.170, 37.420],
                    [-122.170, 37.450]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Mountain View",
                capRate: 3.8,
                rent: 4200,
                valuation: 2900000,
                recentSales: 9,
                trending: 3.2
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.110, 37.410],
                    [-122.060, 37.410],
                    [-122.060, 37.380],
                    [-122.110, 37.380],
                    [-122.110, 37.410]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "San Jose Downtown",
                capRate: 4.6,
                rent: 3100,
                valuation: 1700000,
                recentSales: 14,
                trending: -1.2
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-121.910, 37.350],
                    [-121.870, 37.350],
                    [-121.870, 37.320],
                    [-121.910, 37.320],
                    [-121.910, 37.350]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Oakland Downtown",
                capRate: 5.2,
                rent: 2400,
                valuation: 1100000,
                recentSales: 25,
                trending: 7.5
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.280, 37.810],
                    [-122.250, 37.810],
                    [-122.250, 37.795],
                    [-122.280, 37.795],
                    [-122.280, 37.810]
                ]]
            }
        },
        {
            type: "Feature",
            properties: {
                name: "Berkeley",
                capRate: 4.0,
                rent: 3400,
                valuation: 2100000,
                recentSales: 11,
                trending: 2.8
            },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-122.290, 37.880],
                    [-122.250, 37.880],
                    [-122.250, 37.860],
                    [-122.290, 37.860],
                    [-122.290, 37.880]
                ]]
            }
        }
    ]
};

// Color scales for different metrics
const colorScales: Record<ChoroplethMetric, { property: string; stops: [number, string][] }> = {
    none: { property: '', stops: [] },
    capRate: {
        property: 'capRate',
        stops: [
            [3.0, '#22c55e'],  // Low cap rate = green (expensive/prime)
            [4.0, '#84cc16'],
            [4.5, '#eab308'],
            [5.0, '#f97316'],
            [5.5, '#ef4444'],  // High cap rate = red (higher risk/reward)
        ]
    },
    rent: {
        property: 'rent',
        stops: [
            [2400, '#dbeafe'],  // Low rent = light blue
            [3000, '#93c5fd'],
            [3600, '#3b82f6'],
            [4200, '#1d4ed8'],
            [4800, '#1e3a8a'],  // High rent = dark blue
        ]
    },
    valuation: {
        property: 'valuation',
        stops: [
            [1000000, '#fef3c7'],  // Low valuation = light amber
            [1500000, '#fcd34d'],
            [2000000, '#f59e0b'],
            [2500000, '#d97706'],
            [3000000, '#92400e'],  // High valuation = dark amber
        ]
    },
    recentSales: {
        property: 'recentSales',
        stops: [
            [3, '#f0fdf4'],   // Few sales = light
            [8, '#86efac'],
            [14, '#22c55e'],
            [20, '#15803d'],
            [25, '#14532d'],  // Many sales = dark green
        ]
    },
    trending: {
        property: 'trending',
        stops: [
            [-3, '#ef4444'],  // Declining = red
            [-1, '#fca5a5'],
            [0, '#f5f5f4'],   // Neutral = gray
            [3, '#86efac'],
            [7, '#22c55e'],   // Rising = green
        ]
    }
};

const metricLabels: Record<ChoroplethMetric, { label: string; unit: string; format: (v: number) => string }> = {
    none: { label: 'None', unit: '', format: () => '' },
    capRate: { label: 'Cap Rate', unit: '%', format: (v) => `${v.toFixed(1)}%` },
    rent: { label: 'Avg Rent', unit: '/mo', format: (v) => `$${v.toLocaleString()}` },
    valuation: { label: 'Valuation', unit: '', format: (v) => `$${(v / 1000000).toFixed(1)}M` },
    recentSales: { label: 'Recent Sales', unit: '', format: (v) => `${v} sales` },
    trending: { label: 'Trending', unit: '%', format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
};

export const PropertyMap = ({ className, properties, selectedId, choroplethMetric = 'none', onMetricChange }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<{ [key: string | number]: mapboxgl.Marker }>({});
    const popupRoots = useRef<ReturnType<typeof createRoot>[]>([]);
    const [hoveredNeighborhood, setHoveredNeighborhood] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-122.4194, 37.7749],
            zoom: 10,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => {
            map.current?.resize();

            // Add the choropleth source
            map.current?.addSource('neighborhoods', {
                type: 'geojson',
                data: mockNeighborhoodData
            });

            // Add choropleth fill layer (initially hidden)
            map.current?.addLayer({
                id: 'neighborhoods-fill',
                type: 'fill',
                source: 'neighborhoods',
                paint: {
                    'fill-color': '#888888',
                    'fill-opacity': 0
                }
            });

            // Add outline layer
            map.current?.addLayer({
                id: 'neighborhoods-outline',
                type: 'line',
                source: 'neighborhoods',
                paint: {
                    'line-color': '#374151',
                    'line-width': 1,
                    'line-opacity': 0
                }
            });

            // Add hover highlight layer
            map.current?.addLayer({
                id: 'neighborhoods-highlight',
                type: 'line',
                source: 'neighborhoods',
                paint: {
                    'line-color': '#000000',
                    'line-width': 2,
                    'line-opacity': 0
                },
                filter: ['==', 'name', '']
            });

            // Hover interactions
            map.current?.on('mousemove', 'neighborhoods-fill', (e) => {
                if (e.features && e.features[0]) {
                    const name = e.features[0].properties?.name;
                    setHoveredNeighborhood(name);
                    map.current?.setFilter('neighborhoods-highlight', ['==', 'name', name]);
                    map.current?.setPaintProperty('neighborhoods-highlight', 'line-opacity', 1);
                    if (map.current) map.current.getCanvas().style.cursor = 'pointer';
                }
            });

            map.current?.on('mouseleave', 'neighborhoods-fill', () => {
                setHoveredNeighborhood(null);
                map.current?.setPaintProperty('neighborhoods-highlight', 'line-opacity', 0);
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

    // Update choropleth layer when metric changes
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        const metric = choroplethMetric;

        if (metric === 'none') {
            // Hide choropleth layers
            map.current.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0);
            map.current.setPaintProperty('neighborhoods-outline', 'line-opacity', 0);
            return;
        }

        const scale = colorScales[metric];
        if (!scale || !scale.stops.length) return;

        // Build the color expression
        const colorExpression: mapboxgl.Expression = [
            'interpolate',
            ['linear'],
            ['get', scale.property],
            ...scale.stops.flatMap(([value, color]) => [value, color])
        ];

        // Update the fill layer
        map.current.setPaintProperty('neighborhoods-fill', 'fill-color', colorExpression);
        map.current.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.6);
        map.current.setPaintProperty('neighborhoods-outline', 'line-opacity', 0.8);

    }, [choroplethMetric, mapLoaded]);

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

            const marker = new mapboxgl.Marker({ color: '#0ea5e9' })
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

    // Get hovered neighborhood data
    const hoveredData = hoveredNeighborhood
        ? mockNeighborhoodData.features.find(f => f.properties?.name === hoveredNeighborhood)?.properties
        : null;

    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

            {/* Choropleth Legend */}
            {choroplethMetric !== 'none' && (
                <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[160px]">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {metricLabels[choroplethMetric].label}
                    </div>
                    <div className="flex items-center gap-1">
                        {colorScales[choroplethMetric].stops.map(([value, color], i) => (
                            <div key={i} className="flex-1">
                                <div
                                    className="h-3 w-full"
                                    style={{
                                        backgroundColor: color,
                                        borderRadius: i === 0 ? '2px 0 0 2px' : i === colorScales[choroplethMetric].stops.length - 1 ? '0 2px 2px 0' : '0'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-500">
                            {metricLabels[choroplethMetric].format(colorScales[choroplethMetric].stops[0][0])}
                        </span>
                        <span className="text-[10px] text-gray-500">
                            {metricLabels[choroplethMetric].format(colorScales[choroplethMetric].stops[colorScales[choroplethMetric].stops.length - 1][0])}
                        </span>
                    </div>
                </div>
            )}

            {/* Hovered Neighborhood Info */}
            {hoveredData && choroplethMetric !== 'none' && (
                <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[180px]">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {hoveredData.name}
                    </div>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Cap Rate</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{hoveredData.capRate}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Avg Rent</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">${hoveredData.rent?.toLocaleString()}/mo</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Valuation</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">${(hoveredData.valuation / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Recent Sales</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{hoveredData.recentSales}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Trending</span>
                            <span className={`font-medium ${hoveredData.trending > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {hoveredData.trending > 0 ? '+' : ''}{hoveredData.trending}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
