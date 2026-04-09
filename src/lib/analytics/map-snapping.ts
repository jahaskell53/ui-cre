export interface SnappableBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export function snapOut(value: number, direction: "floor" | "ceil"): number {
    return direction === "floor" ? Math.floor(value * 10) / 10 : Math.ceil(value * 10) / 10;
}

export function createSnappedBounds(bounds: SnappableBounds | null): SnappableBounds | null {
    if (!bounds) return null;

    return {
        south: snapOut(bounds.south, "floor"),
        north: snapOut(bounds.north, "ceil"),
        west: snapOut(bounds.west, "floor"),
        east: snapOut(bounds.east, "ceil"),
    };
}

export function createSnappedBoundsKey(bounds: SnappableBounds | null): string | null {
    const snappedBounds = createSnappedBounds(bounds);
    if (!snappedBounds) return null;
    return `${snappedBounds.south},${snappedBounds.north},${snappedBounds.west},${snappedBounds.east}`;
}
