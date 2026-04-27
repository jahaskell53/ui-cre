import { type Property } from "@/components/application/map/property-map";

/** Row shape from GET /api/listings/crexi-comps */
export type CrexiCompsApiRow = {
    id: number;
    property_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    sold_price: number | null;
    closing_cap_rate: number | null;
    asking_cap_rate: number | null;
    building_sqft: number | null;
    property_link: string | null;
    latitude: number;
    longitude: number;
};

/** Row shape from GET /api/listings/crexi-active */
export type CrexiActiveApiRow = {
    id: number;
    property_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    asking_price: number | null;
    cap_rate: number | null;
    sqft: number | null;
    property_link: string | null;
    latitude: number;
    longitude: number;
};

function formatUsd(n: number | null | undefined): string {
    if (n == null || Number.isNaN(n)) return "—";
    return `$${Math.round(n).toLocaleString()}`;
}

function formatCapPct(n: number | null | undefined): string | null {
    if (n == null || Number.isNaN(n)) return null;
    return `${n.toFixed(2)}% cap`;
}

export function mapCrexiCompsRow(row: CrexiCompsApiRow): Property & { _createdAt?: string } {
    const line1 = [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(", ") || "Address not listed";
    const cap = row.closing_cap_rate ?? row.asking_cap_rate;
    const capStr = formatCapPct(cap);
    return {
        id: `crexi-comp-${row.id}`,
        name: (row.property_name?.trim() || row.address || "Property") as string,
        address: line1,
        price: formatUsd(row.sold_price),
        coordinates: [row.longitude, row.latitude],
        listingSource: "crexi_comps",
        capRate: capStr,
        squareFootage: row.building_sqft != null ? `${Math.round(row.building_sqft).toLocaleString()} sq ft` : undefined,
        detailHref: row.property_link?.trim() || null,
        _createdAt: "",
    };
}

/** Row shape from GET /api/listings/crexi-api-comps (map list payload) */
export type CrexiApiCompsApiRow = {
    id: number;
    crexi_id: string | null;
    property_name: string | null;
    address_full: string | null;
    address_street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    building_sqft: number | null;
    property_type: string | null;
    property_price_total: number | null;
    property_price_per_sqft: number | null;
    property_price_per_acre: number | null;
    sale_transaction_date: string | null;
    latitude: number;
    longitude: number;
};

function formatUsdCompact(n: number | null | undefined): string | null {
    if (n == null || Number.isNaN(n)) return null;
    return `$${Math.round(n).toLocaleString()}`;
}

function formatMoneyPer(n: number | null | undefined, suffix: string): string | null {
    if (n == null || Number.isNaN(n)) return null;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}/${suffix}`;
}

export function mapCrexiApiCompsRow(row: CrexiApiCompsApiRow): Property & { _createdAt?: string } {
    const line1 = row.address_full?.trim() || [row.address_street, row.city, row.state, row.zip].filter(Boolean).join(", ") || "" || "Address not listed";
    const typeLabel = row.property_type?.trim();
    const priceLabel = formatUsdCompact(row.property_price_total) ?? "Crexi API";
    const capParts: string[] = [];
    if (typeLabel) capParts.push(typeLabel);
    const ppsf = formatMoneyPer(row.property_price_per_sqft, "sq ft");
    if (ppsf) capParts.push(ppsf);
    const ppa = formatMoneyPer(row.property_price_per_acre, "acre");
    if (ppa) capParts.push(ppa);
    return {
        id: `crexi-api-comp-${row.id}`,
        name: (row.property_name?.trim() || row.address_street || row.address_full || "Comp") as string,
        address: line1,
        price: priceLabel,
        coordinates: [row.longitude, row.latitude],
        listingSource: "crexi_api_comps",
        capRate: capParts.length > 0 ? capParts.join(" · ") : null,
        squareFootage: row.building_sqft != null ? `${row.building_sqft.toLocaleString()} sq ft` : undefined,
        detailHref: `/analytics/listing/crexi-api-comp/${row.id}`,
        _createdAt: "",
    };
}

export function mapCrexiActiveRow(row: CrexiActiveApiRow): Property & { _createdAt?: string } {
    const line1 = [row.address, row.city, row.state, row.zip].filter(Boolean).join(", ") || "Address not listed";
    const capStr = formatCapPct(row.cap_rate);
    return {
        id: `crexi-active-${row.id}`,
        name: (row.property_name?.trim() || row.address || "Listing") as string,
        address: line1,
        price: formatUsd(row.asking_price),
        coordinates: [row.longitude, row.latitude],
        listingSource: "crexi_active",
        capRate: capStr,
        squareFootage: row.sqft != null ? `${Math.round(row.sqft).toLocaleString()} sq ft` : undefined,
        detailHref: row.property_link?.trim() || null,
        _createdAt: "",
    };
}

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
