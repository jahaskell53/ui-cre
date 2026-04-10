import { describe, expect, it } from "vitest";
import { boundsContainedIn, expandBounds, getUncoveredBounds, snapBounds } from "./viewport-bounds";

describe("viewport bounds helpers", () => {
    it("snaps bounds outward to the 0.1 degree grid", () => {
        expect(
            snapBounds({
                south: 37.751,
                north: 37.801,
                west: -122.451,
                east: -122.401,
            }),
        ).toEqual({
            south: 37.7,
            north: 37.9,
            west: -122.5,
            east: -122.4,
        });
    });

    it("detects when requested bounds are fully covered", () => {
        expect(boundsContainedIn({ south: 37.7, north: 37.8, west: -122.5, east: -122.4 }, { south: 37.6, north: 37.9, west: -122.6, east: -122.3 })).toBe(
            true,
        );
    });

    it("returns no uncovered bounds when the request is already covered", () => {
        expect(getUncoveredBounds({ south: 37.7, north: 37.8, west: -122.5, east: -122.4 }, { south: 37.6, north: 37.9, west: -122.6, east: -122.3 })).toEqual(
            [],
        );
    });

    it("returns only the newly exposed strip when panning east", () => {
        expect(getUncoveredBounds({ south: 37.7, north: 37.9, west: -122.5, east: -122.2 }, { south: 37.7, north: 37.9, west: -122.5, east: -122.3 })).toEqual([
            { south: 37.7, north: 37.9, west: -122.3, east: -122.2 },
        ]);
    });

    it("splits uncovered space into non-overlapping strips", () => {
        expect(getUncoveredBounds({ south: 37.6, north: 38.0, west: -122.7, east: -122.2 }, { south: 37.7, north: 37.9, west: -122.5, east: -122.3 })).toEqual([
            { south: 37.9, north: 38.0, west: -122.7, east: -122.2 },
            { south: 37.6, north: 37.7, west: -122.7, east: -122.2 },
            { south: 37.7, north: 37.9, west: -122.7, east: -122.5 },
            { south: 37.7, north: 37.9, west: -122.3, east: -122.2 },
        ]);
    });

    it("returns the full request when there is no overlap", () => {
        expect(getUncoveredBounds({ south: 38.0, north: 38.2, west: -122.2, east: -122.0 }, { south: 37.7, north: 37.9, west: -122.5, east: -122.3 })).toEqual([
            { south: 38.0, north: 38.2, west: -122.2, east: -122.0 },
        ]);
    });

    it("expands covered bounds to the union of old and new areas", () => {
        expect(expandBounds({ south: 37.7, north: 37.9, west: -122.5, east: -122.3 }, { south: 37.8, north: 38.0, west: -122.4, east: -122.2 })).toEqual({
            south: 37.7,
            north: 38.0,
            west: -122.5,
            east: -122.2,
        });
    });
});
