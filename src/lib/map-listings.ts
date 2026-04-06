import { type Property, type UnitMixRow } from "@/components/application/map/property-map";

/** A raw row from `loopnet_listings` as returned by Supabase. */
export type LoopnetRow = Record<string, unknown>;

/** A raw row from `cleaned_listings` as returned by Supabase. */
export type CleanedListingRow = Record<string, unknown>;

/** Property extended with the internal scrape timestamp used for sorting. */
export type PropertyWithDate = Property & { _createdAt?: string };

export function mapLoopnetRow(item: LoopnetRow): PropertyWithDate {
    return {
        id: item.id as string | number,
        name: (item.headline || item.address || "Building") as string,
        address: (item.address || "Address not listed") as string,
        location: (item.location as string) ?? undefined,
        units: item.square_footage ? Math.floor(parseInt(String(item.square_footage).replace(/[^0-9]/g, "") || "0") / 500) || null : null,
        price: (item.price as string) || "TBD",
        coordinates: [item.longitude as number, item.latitude as number],
        thumbnailUrl: (item.thumbnail_url as string | null) ?? undefined,
        capRate: (item.cap_rate as string | null) ?? undefined,
        squareFootage: (item.square_footage as string) ?? undefined,
        listingSource: "loopnet",
        _createdAt: (item.created_at as string) ?? "",
    };
}

export function mapCleanedListingRow(item: CleanedListingRow): PropertyWithDate {
    const city = (item.address_city as string) || "";
    const fullAddress =
        (item.address_raw as string) ||
        [item.address_street, city, item.address_state, item.address_zip].filter(Boolean).join(", ") ||
        "Address not listed";
    const priceVal = item.price as number | null;
    return {
        id: `zillow-${item.id as string}`,
        name: fullAddress,
        address: fullAddress,
        location: city || undefined,
        units: null,
        price: priceVal ? `$${priceVal.toLocaleString()}` : "TBD",
        coordinates: [item.longitude as number, item.latitude as number],
        thumbnailUrl: (item.img_src as string | null) ?? undefined,
        capRate: undefined,
        squareFootage: item.area ? String(item.area) : undefined,
        listingSource: "zillow",
        _createdAt: (item.scraped_at as string) ?? "",
    };
}

export function groupReitRows(reitRows: CleanedListingRow[]): PropertyWithDate[] {
    const byBuilding: Record<string, CleanedListingRow[]> = {};
    for (const row of reitRows) {
        const bz = row.building_zpid as string;
        if (!byBuilding[bz]) byBuilding[bz] = [];
        byBuilding[bz].push(row);
    }
    return Object.entries(byBuilding).map(([, units]) => {
        const first = units[0];
        const city = (first.address_city as string) || "";
        const fullAddress =
            (first.address_raw as string) ||
            [first.address_street, city, first.address_state, first.address_zip].filter(Boolean).join(", ") ||
            "Address not listed";

        const mixMap: Record<string, { beds: number | null; baths: number | null; count: number; totalPrice: number; validPriceCount: number }> = {};
        for (const unit of units) {
            const key = `${unit.beds ?? 0}-${unit.baths ?? "null"}`;
            if (!mixMap[key]) {
                mixMap[key] = { beds: (unit.beds as number | null) ?? 0, baths: unit.baths as number | null, count: 0, totalPrice: 0, validPriceCount: 0 };
            }
            mixMap[key].count++;
            if (unit.price) {
                mixMap[key].totalPrice += unit.price as number;
                mixMap[key].validPriceCount++;
            }
        }

        const unitMix: UnitMixRow[] = Object.values(mixMap)
            .sort((a, b) => (a.beds ?? 0) - (b.beds ?? 0) || (a.baths ?? 0) - (b.baths ?? 0))
            .map(({ beds, baths, count, totalPrice, validPriceCount }) => ({
                beds,
                baths,
                count,
                avgPrice: validPriceCount > 0 ? Math.round(totalPrice / validPriceCount) : null,
            }));

        const prices = units.map((u) => u.price as number | null).filter((p): p is number => p != null);
        const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

        return {
            id: `zillow-${first.id as string}`,
            name: fullAddress,
            address: fullAddress,
            location: city || undefined,
            units: units.length,
            price: avgPrice ? `$${avgPrice.toLocaleString()} avg` : "TBD",
            coordinates: [first.longitude as number, first.latitude as number],
            thumbnailUrl: (first.img_src as string | null) ?? undefined,
            capRate: undefined,
            squareFootage: undefined,
            listingSource: "zillow" as const,
            isReit: true,
            unitMix,
            _createdAt: (first.scraped_at as string) ?? "",
        };
    });
}

/**
 * Splits raw cleaned_listings rows into individual listings (non-REIT) and
 * grouped buildings (REIT units sharing a building_zpid), returning one
 * Property per pin to display on the map.
 */
export function processZillowRows(rows: CleanedListingRow[]): PropertyWithDate[] {
    const nonReit = rows.filter((r) => !r.building_zpid && !r.is_building);
    const reitUnits = rows.filter((r) => r.building_zpid != null);
    return [...nonReit.map(mapCleanedListingRow), ...groupReitRows(reitUnits)];
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
        _createdAt: row.scraped_at ?? "",
    };
}
