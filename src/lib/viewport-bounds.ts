export interface ViewportBounds {
    south: number;
    north: number;
    west: number;
    east: number;
}

function snapOut(value: number, direction: "floor" | "ceil"): number {
    return direction === "floor" ? Math.floor(value * 10) / 10 : Math.ceil(value * 10) / 10;
}

export function snapBounds(bounds: ViewportBounds): ViewportBounds {
    return {
        south: snapOut(bounds.south, "floor"),
        north: snapOut(bounds.north, "ceil"),
        west: snapOut(bounds.west, "floor"),
        east: snapOut(bounds.east, "ceil"),
    };
}

export function boundsContainedIn(inner: ViewportBounds, outer: ViewportBounds): boolean {
    return inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;
}

export function expandBounds(left: ViewportBounds, right: ViewportBounds): ViewportBounds {
    return {
        south: Math.min(left.south, right.south),
        north: Math.max(left.north, right.north),
        west: Math.min(left.west, right.west),
        east: Math.max(left.east, right.east),
    };
}

function hasOverlap(a: ViewportBounds, b: ViewportBounds): boolean {
    return a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;
}

function isValidBounds(bounds: ViewportBounds): boolean {
    return bounds.south < bounds.north && bounds.west < bounds.east;
}

export function getUncoveredBounds(requested: ViewportBounds, covered: ViewportBounds): ViewportBounds[] {
    if (boundsContainedIn(requested, covered)) {
        return [];
    }

    if (!hasOverlap(requested, covered)) {
        return [requested];
    }

    const uncovered: ViewportBounds[] = [];

    if (requested.north > covered.north) {
        uncovered.push({
            south: Math.max(covered.north, requested.south),
            north: requested.north,
            west: requested.west,
            east: requested.east,
        });
    }

    if (requested.south < covered.south) {
        uncovered.push({
            south: requested.south,
            north: Math.min(covered.south, requested.north),
            west: requested.west,
            east: requested.east,
        });
    }

    const overlapSouth = Math.max(requested.south, covered.south);
    const overlapNorth = Math.min(requested.north, covered.north);

    if (overlapSouth < overlapNorth && requested.west < covered.west) {
        uncovered.push({
            south: overlapSouth,
            north: overlapNorth,
            west: requested.west,
            east: Math.min(covered.west, requested.east),
        });
    }

    if (overlapSouth < overlapNorth && requested.east > covered.east) {
        uncovered.push({
            south: overlapSouth,
            north: overlapNorth,
            west: Math.max(covered.east, requested.west),
            east: requested.east,
        });
    }

    return uncovered.filter(isValidBounds);
}
