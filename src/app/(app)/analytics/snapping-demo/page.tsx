"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MoveHorizontal, MoveVertical } from "lucide-react";
import type { MapBounds } from "@/components/application/map/property-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSnappedBounds, createSnappedBoundsKey } from "@/lib/analytics/map-snapping";

const GRID_MIN = -0.3;
const GRID_MAX = 0.3;
const GRID_STEP = 0.1;
const VIEWBOX_SIZE = 360;
const GRID_PADDING = 24;
const SCALE = VIEWBOX_SIZE / (GRID_MAX - GRID_MIN);

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function round(value: number) {
    return Number(value.toFixed(3));
}

function buildBounds(centerLat: number, centerLng: number, height: number, width: number): MapBounds {
    return {
        south: round(centerLat - height / 2),
        north: round(centerLat + height / 2),
        west: round(centerLng - width / 2),
        east: round(centerLng + width / 2),
    };
}

function formatCoordinate(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(3)}deg`;
}

function gridToX(value: number) {
    return (value - GRID_MIN) * SCALE + GRID_PADDING;
}

function gridToY(value: number) {
    return (GRID_MAX - value) * SCALE + GRID_PADDING;
}

function nudgeBounds(bounds: MapBounds, axis: "lat" | "lng", delta: number) {
    if (axis === "lat") {
        const centerLat = (bounds.south + bounds.north) / 2;
        const height = bounds.north - bounds.south;
        return buildBounds(
            clamp(centerLat + delta, GRID_MIN + height / 2, GRID_MAX - height / 2),
            (bounds.west + bounds.east) / 2,
            height,
            bounds.east - bounds.west,
        );
    }

    const centerLng = (bounds.west + bounds.east) / 2;
    const width = bounds.east - bounds.west;
    return buildBounds(
        (bounds.south + bounds.north) / 2,
        clamp(centerLng + delta, GRID_MIN + width / 2, GRID_MAX - width / 2),
        bounds.north - bounds.south,
        width,
    );
}

function BoundsTable({ title, bounds }: { title: string; bounds: MapBounds | null }) {
    if (!bounds) return null;

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                    <dt className="text-gray-500 dark:text-gray-400">North</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">{formatCoordinate(bounds.north)}</dd>
                </div>
                <div>
                    <dt className="text-gray-500 dark:text-gray-400">South</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">{formatCoordinate(bounds.south)}</dd>
                </div>
                <div>
                    <dt className="text-gray-500 dark:text-gray-400">East</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">{formatCoordinate(bounds.east)}</dd>
                </div>
                <div>
                    <dt className="text-gray-500 dark:text-gray-400">West</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">{formatCoordinate(bounds.west)}</dd>
                </div>
            </dl>
        </div>
    );
}

export default function SnappingDemoPage() {
    const [bounds, setBounds] = useState<MapBounds>(() => buildBounds(0.055, -0.045, 0.08, 0.08));
    const [previousKey, setPreviousKey] = useState<string | null>(null);

    const snappedBounds = useMemo(() => createSnappedBounds(bounds), [bounds]);
    const snappedKey = useMemo(() => createSnappedBoundsKey(bounds), [bounds]);
    const tileChanged = previousKey !== null && previousKey !== snappedKey;

    const viewportRect = useMemo(
        () => ({
            x: gridToX(bounds.west),
            y: gridToY(bounds.north),
            width: (bounds.east - bounds.west) * SCALE,
            height: (bounds.north - bounds.south) * SCALE,
        }),
        [bounds],
    );

    const snappedRect = useMemo(() => {
        if (!snappedBounds) return null;
        return {
            x: gridToX(snappedBounds.west),
            y: gridToY(snappedBounds.north),
            width: (snappedBounds.east - snappedBounds.west) * SCALE,
            height: (snappedBounds.north - snappedBounds.south) * SCALE,
        };
    }, [snappedBounds]);

    const gridLines = [];
    for (let value = GRID_MIN; value <= GRID_MAX + 0.0001; value += GRID_STEP) {
        gridLines.push(round(value));
    }

    const captureCurrentTile = () => {
        setPreviousKey(snappedKey);
    };

    const resetDemo = () => {
        setBounds(buildBounds(0.055, -0.045, 0.08, 0.08));
        setPreviousKey(null);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Snapped tile demo</h1>
                    <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                        This page uses the same 0.1 degree snapping logic as the listings map. Move the viewport a little and watch whether the snapped fetch
                        tile changes.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Controls</CardTitle>
                            <CardDescription>Pan the viewport in tiny or larger steps to see when the fetch key changes.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => setBounds((current) => nudgeBounds(current, "lng", 0.01))}
                                >
                                    Small pan east (+0.01deg)
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => setBounds((current) => nudgeBounds(current, "lng", 0.06))}
                                >
                                    Cross east tile (+0.06deg)
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => setBounds((current) => nudgeBounds(current, "lat", 0.01))}
                                >
                                    Small pan north (+0.01deg)
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => setBounds((current) => nudgeBounds(current, "lat", 0.06))}
                                >
                                    Cross north tile (+0.06deg)
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                    onClick={captureCurrentTile}
                                >
                                    Mark current tile
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                    onClick={resetDemo}
                                >
                                    Reset
                                </button>
                            </div>

                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="font-medium text-blue-900 dark:text-blue-100">Current snapped tile key</span>
                                    <span className="font-mono text-xs text-blue-800 dark:text-blue-200">{snappedKey}</span>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                                    <ArrowRight className="size-4" />
                                    {previousKey === null ? (
                                        <span>Mark the current tile, then pan the viewport to compare against it.</span>
                                    ) : tileChanged ? (
                                        <span>The snapped tile changed, so this would trigger a new fetch.</span>
                                    ) : (
                                        <span>The snapped tile stayed the same, so the client can reuse the previous fetch.</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <BoundsTable title="Exact viewport bounds" bounds={bounds} />
                                <BoundsTable title="Snapped fetch bounds" bounds={snappedBounds} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Visualization</CardTitle>
                            <CardDescription>
                                Gray grid lines are 0.1 degree boundaries. The blue box is the exact viewport; the green box is the snapped fetch tile.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                                <svg
                                    viewBox={`0 0 ${VIEWBOX_SIZE + GRID_PADDING * 2} ${VIEWBOX_SIZE + GRID_PADDING * 2}`}
                                    className="h-auto w-full"
                                    role="img"
                                    aria-label="Snapped bounds grid visualization"
                                >
                                    <rect
                                        x="0"
                                        y="0"
                                        width={VIEWBOX_SIZE + GRID_PADDING * 2}
                                        height={VIEWBOX_SIZE + GRID_PADDING * 2}
                                        fill="currentColor"
                                        className="text-white dark:text-gray-950"
                                    />
                                    {gridLines.map((value) => (
                                        <g key={`x-${value}`}>
                                            <line
                                                x1={gridToX(value)}
                                                y1={GRID_PADDING}
                                                x2={gridToX(value)}
                                                y2={VIEWBOX_SIZE + GRID_PADDING}
                                                stroke="currentColor"
                                                className="text-gray-300 dark:text-gray-700"
                                                strokeWidth={value === 0 ? 2 : 1}
                                            />
                                            <text
                                                x={gridToX(value)}
                                                y={GRID_PADDING - 8}
                                                textAnchor="middle"
                                                className="fill-gray-500 text-[10px] dark:fill-gray-400"
                                            >
                                                {value.toFixed(1)}
                                            </text>
                                        </g>
                                    ))}
                                    {gridLines.map((value) => (
                                        <g key={`y-${value}`}>
                                            <line
                                                x1={GRID_PADDING}
                                                y1={gridToY(value)}
                                                x2={VIEWBOX_SIZE + GRID_PADDING}
                                                y2={gridToY(value)}
                                                stroke="currentColor"
                                                className="text-gray-300 dark:text-gray-700"
                                                strokeWidth={value === 0 ? 2 : 1}
                                            />
                                            <text x={10} y={gridToY(value) + 4} className="fill-gray-500 text-[10px] dark:fill-gray-400">
                                                {value.toFixed(1)}
                                            </text>
                                        </g>
                                    ))}

                                    {snappedRect ? (
                                        <rect
                                            x={snappedRect.x}
                                            y={snappedRect.y}
                                            width={snappedRect.width}
                                            height={snappedRect.height}
                                            fill="rgba(34,197,94,0.18)"
                                            stroke="rgb(22,163,74)"
                                            strokeWidth="3"
                                            rx="4"
                                        />
                                    ) : null}
                                    <rect
                                        x={viewportRect.x}
                                        y={viewportRect.y}
                                        width={viewportRect.width}
                                        height={viewportRect.height}
                                        fill="rgba(59,130,246,0.24)"
                                        stroke="rgb(37,99,235)"
                                        strokeWidth="3"
                                        rx="4"
                                    />
                                </svg>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        <MoveHorizontal className="size-4" />
                                        East / west
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        Small horizontal pans stay in the same tile until a snapped west or east edge crosses a 0.1 degree line.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        <MoveVertical className="size-4" />
                                        North / south
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        The same rule applies vertically: only snapped north/south changes imply a new fetch bucket.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Exact vs snapped</div>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        The app fetches for the green box, then filters results down to the exact blue viewport on the client.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
