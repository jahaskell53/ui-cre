import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapPage from "./page";

const replaceMock = vi.fn();

const BOUNDS_A = {
    west: -122.49,
    south: 37.71,
    east: -122.41,
    north: 37.79,
};

const BOUNDS_A_SMALL_PAN = {
    west: -122.485,
    south: 37.715,
    east: -122.415,
    north: 37.785,
};

const BOUNDS_B = {
    west: -122.59,
    south: 37.81,
    east: -122.51,
    north: 37.89,
};

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/db/rpc", () => ({
    getCityGeojson: vi.fn().mockResolvedValue(null),
    getCountyGeojson: vi.fn().mockResolvedValue(null),
    getMsaBbox: vi.fn().mockResolvedValue(null),
    getMsaGeojson: vi.fn().mockResolvedValue(null),
    getNeighborhoodBbox: vi.fn().mockResolvedValue(null),
    getNeighborhoodGeojson: vi.fn().mockResolvedValue(null),
    getZipBoundary: vi.fn().mockResolvedValue(null),
    searchMsas: vi.fn().mockResolvedValue([]),
    searchNeighborhoods: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/(app)/analytics/map/properties-sidebar", () => ({
    PropertiesSidebar: ({ properties, totalCount, loading }: { properties: Array<{ id: string | number }>; totalCount: number; loading: boolean }) => (
        <div data-testid="sidebar">{loading ? "loading" : `${totalCount}:${properties.map((property) => property.id).join(",")}`}</div>
    ),
}));

vi.mock("@/components/application/map/property-map", () => ({
    PropertyMap: ({ onBoundsChange }: { onBoundsChange?: (bounds: typeof BOUNDS_A) => void }) => (
        <div>
            <button type="button" onClick={() => onBoundsChange?.(BOUNDS_A)}>
                bounds-a
            </button>
            <button type="button" onClick={() => onBoundsChange?.(BOUNDS_A_SMALL_PAN)}>
                bounds-a-small-pan
            </button>
            <button type="button" onClick={() => onBoundsChange?.(BOUNDS_B)}>
                bounds-b
            </button>
        </div>
    ),
}));

function createResponse<T>(data: T): Response {
    return {
        ok: true,
        json: async () => data,
    } as Response;
}

function getZillowListing(id: string, latitude: number, longitude: number) {
    return {
        id,
        address: `${id} Main St`,
        longitude,
        latitude,
        price_label: "$2,500",
        is_reit: false,
        unit_count: 1,
        unit_mix: [],
        img_src: null,
        area: 900,
        scraped_at: "2026-04-09T00:00:00Z",
        total_count: 1,
        building_zpid: null,
    };
}

function getLoopnetListing(id: string, latitude: number, longitude: number) {
    return {
        id,
        headline: `${id} Building`,
        address: `${id} Main St`,
        price: "$1,000,000",
        latitude,
        longitude,
        square_footage: "2000",
        created_at: "2026-04-09T00:00:00Z",
    };
}

async function clickAndFlush(name: string) {
    fireEvent.click(screen.getByRole("button", { name }));
    act(() => {
        vi.advanceTimersByTime(300);
    });
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("MapPage client caching", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();

        Object.defineProperty(window, "location", {
            value: {
                search: "",
            },
            writable: true,
        });

        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: string | URL | Request) => {
                const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

                if (url.startsWith("/api/listings/zillow?")) {
                    if (url.includes("bounds_west=-122.5")) {
                        return createResponse([getZillowListing("zillow-a", 37.75, -122.45)]);
                    }

                    return createResponse([getZillowListing("zillow-b", 37.85, -122.55)]);
                }

                if (url.startsWith("/api/listings/loopnet?")) {
                    if (url.includes("bounds_west=-122.5")) {
                        return createResponse({
                            data: [getLoopnetListing("loopnet-a", 37.75, -122.45)],
                            count: 1,
                        });
                    }

                    return createResponse({
                        data: [getLoopnetListing("loopnet-b", 37.85, -122.55)],
                        count: 1,
                    });
                }

                return createResponse({ features: [] });
            }),
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("reuses cached zillow rows when returning to a previously fetched tile", async () => {
        render(<MapPage />);

        await clickAndFlush("bounds-a");
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("sidebar")).toHaveTextContent("1:zillow-a");

        await clickAndFlush("bounds-b");
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("sidebar")).toHaveTextContent("1:zillow-b");

        await clickAndFlush("bounds-a");
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("sidebar")).toHaveTextContent("1:zillow-a");
    });

    it("keeps loopnet results client-side for small pans within the same snapped tile", async () => {
        render(<MapPage />);

        fireEvent.click(screen.getByRole("button", { name: "Sales" }));

        await clickAndFlush("bounds-a");
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("sidebar")).toHaveTextContent("1:loopnet-a");

        await clickAndFlush("bounds-a-small-pan");
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("sidebar")).toHaveTextContent("1:loopnet-a");
    });
});
