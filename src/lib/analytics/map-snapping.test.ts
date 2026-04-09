import { describe, expect, it } from "vitest";
import { type SnappableBounds, createSnappedBounds, createSnappedBoundsKey, snapOut } from "./map-snapping";

describe("map-snapping helpers", () => {
    it("snaps coordinates outward to the nearest tenth", () => {
        expect(snapOut(37.71, "floor")).toBe(37.7);
        expect(snapOut(37.71, "ceil")).toBe(37.8);
        expect(snapOut(-122.49, "floor")).toBe(-122.5);
        expect(snapOut(-122.49, "ceil")).toBe(-122.4);
    });

    it("creates a snapped bounds object", () => {
        const bounds: SnappableBounds = {
            south: 37.71,
            north: 37.79,
            west: -122.49,
            east: -122.41,
        };

        expect(createSnappedBounds(bounds)).toEqual({
            south: 37.7,
            north: 37.8,
            west: -122.5,
            east: -122.4,
        });
    });

    it("returns the same key for small pans inside the same snapped tile", () => {
        const start: SnappableBounds = {
            south: 37.71,
            north: 37.79,
            west: -122.49,
            east: -122.41,
        };
        const smallPan: SnappableBounds = {
            south: 37.715,
            north: 37.785,
            west: -122.485,
            east: -122.415,
        };

        expect(createSnappedBoundsKey(start)).toBe("37.7,37.8,-122.5,-122.4");
        expect(createSnappedBoundsKey(smallPan)).toBe(createSnappedBoundsKey(start));
    });

    it("changes the key once a snapped edge crosses into a new bucket", () => {
        const start: SnappableBounds = {
            south: 37.71,
            north: 37.79,
            west: -122.49,
            east: -122.41,
        };
        const moved: SnappableBounds = {
            south: 37.81,
            north: 37.89,
            west: -122.39,
            east: -122.31,
        };

        expect(createSnappedBoundsKey(moved)).toBe("37.8,37.9,-122.4,-122.3");
        expect(createSnappedBoundsKey(moved)).not.toBe(createSnappedBoundsKey(start));
    });
});
