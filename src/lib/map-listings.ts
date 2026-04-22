import { type Property } from "@/components/application/map/property-map";

/** A raw row from `loopnet_listing_details` as returned by Supabase. */
export type LoopnetRow = Record<string, unknown>;

/** Property extended with the internal scrape timestamp used for sorting. */
export type PropertyWithDate = Property & { _createdAt?: string };

export function mapLoopnetRow(item: LoopnetRow): PropertyWithDate {
    const displayAddress = (typeof item.address_raw === "string" && item.address_raw.trim()) || (typeof item.address === "string" && item.address.trim()) || "";
    return {
        id: item.id as string | number,
        name: (item.headline || item.address || "Building") as string,
        address: (displayAddress || "Address not listed") as string,
        location: (item.location as string) ?? undefined,
        units: null,
        price: (item.price as string) || "TBD",
        coordinates: [item.longitude as number, item.latitude as number],
        thumbnailUrl: (item.thumbnail_url as string | null) ?? undefined,
        capRate: (item.cap_rate as string | null) ?? undefined,
        squareFootage: (item.square_footage as string) ?? undefined,
        listingSource: "loopnet",
        _createdAt: (item.created_at as string) ?? "",
    };
}

/** A row returned by the get_zillow_map_listings RPC. */
export interface ZillowMapListingRow {
    id: string;
    address: string;
    longitude: number;
    latitude: number;
    price_label: string;
    is_reit: boolean;
    unit_count: number;
    unit_mix: { beds: number | null; baths: number | null; count: number; avg_price: number | null }[];
    img_src: string | null;
    area: number | null;
    scraped_at: string | null;
    total_count: number;
    building_zpid: string | null;
}

/**
 * Maps a single get_zillow_map_listings RPC row to a Property for the map.
 * The RPC has already done all grouping server-side.
 */
export function mapZillowRpcRow(row: ZillowMapListingRow): PropertyWithDate {
    return {
        id: row.id,
        name: row.address,
        address: row.address,
        coordinates: [row.longitude, row.latitude],
        price: row.price_label,
        listingSource: "zillow",
        thumbnailUrl: row.img_src ?? undefined,
        squareFootage: row.area != null ? String(row.area) : undefined,
        isReit: row.is_reit,
        units: row.is_reit ? row.unit_count : null,
        unitMix: row.unit_mix.map((u) => ({
            beds: u.beds,
            baths: u.baths,
            count: u.count,
            avgPrice: u.avg_price,
        })),
        capRate: undefined,
        buildingZpid: row.building_zpid ?? null,
        _createdAt: row.scraped_at ?? "",
    };
}
