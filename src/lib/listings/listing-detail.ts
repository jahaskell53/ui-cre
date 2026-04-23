import type { ZillowRawDetails } from "@/components/application/zillow-detail-utils";

export interface ZillowListing {
    source: "zillow";
    id: string;
    zpid: string | null;
    raw_scrape_id: string | null;
    img_src: string | null;
    detail_url: string | null;
    address_raw: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
    availability_date: string | null;
    scraped_at: string | null;
    latitude: number | null;
    longitude: number | null;
    is_building: boolean | null;
    building_zpid: string | null;
    home_type: string | null;
    laundry: string | null;
}

export interface LoopnetUnitMixRow {
    description: string | null;
    count: string | null;
    rent: string | null;
    sqft: string | null;
}

/** Cached S3 document from a LoopNet listing attachment. */
export interface LoopnetAttachmentUrl {
    source_url: string;
    url: string;
    description?: string | null;
}

export interface LoopnetListing {
    source: "loopnet";
    id: string;
    address: string | null;
    headline: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    price: string | null;
    cap_rate: string | null;
    building_category: string | null;
    square_footage: string | null;
    thumbnail_url: string | null;
    listing_url: string | null;
    om_url: string | null;
    created_at: string | null;
    unit_mix: LoopnetUnitMixRow[] | null;
    /** Cached S3 URLs for all downloaded listing attachments. */
    attachment_urls?: LoopnetAttachmentUrl[] | null;
    /** OM-extracted investment metrics (null when not yet extracted). */
    om_cap_rate?: string | null;
    om_cost_per_door?: string | null;
    om_coc_return?: string | null;
    om_grm?: string | null;
}

export type Listing = ZillowListing | LoopnetListing;

export interface UnitRow {
    id: string;
    zpid: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
}

export interface UnitTypeSummary {
    beds: number;
    baths: number | null;
    count: number;
    avgPrice: number | null;
    avgArea: number | null;
    minPrice: number | null;
    maxPrice: number | null;
}

export function buildUnitTypeSummary(units: UnitRow[]): UnitTypeSummary[] {
    if (units.length === 0) {
        return [];
    }

    const groups = new Map<string, UnitRow[]>();
    for (const unit of units) {
        const key = `${unit.beds ?? 0}|${unit.baths ?? "null"}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(unit);
    }

    return Array.from(groups.values())
        .map((rows) => {
            const prices = rows.filter((row) => row.price != null).map((row) => row.price!);
            const areas = rows.filter((row) => row.area != null).map((row) => row.area!);

            return {
                beds: rows[0].beds ?? 0,
                baths: rows[0].baths,
                count: rows.length,
                avgPrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
                avgArea: areas.length ? areas.reduce((sum, area) => sum + area, 0) / areas.length : null,
                minPrice: prices.length ? Math.min(...prices) : null,
                maxPrice: prices.length ? Math.max(...prices) : null,
            };
        })
        .sort((a, b) => (a.beds ?? 0) - (b.beds ?? 0) || (a.baths ?? 0) - (b.baths ?? 0));
}

export function getListingDisplayAddress(listing: Listing): string {
    if (listing.source === "zillow") {
        return (
            listing.address_raw ||
            [listing.address_street, listing.address_city, listing.address_state, listing.address_zip].filter(Boolean).join(", ") ||
            "Address not listed"
        );
    }

    return listing.address || listing.headline || "Address not listed";
}

export function getHeroImageUrls(raw: unknown, targetZpid: string | null | undefined): string[] {
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const match = items.find((item) => String((item as { zpid?: unknown })?.zpid ?? "") === String(targetZpid ?? ""));

    if (!match) {
        return [];
    }

    const urls: string[] = [];
    const carousel = (match as { carouselPhotosComposable?: { baseUrl?: unknown; photoData?: Array<{ photoKey?: unknown }> } }).carouselPhotosComposable;
    if (carousel && typeof carousel.baseUrl === "string" && Array.isArray(carousel.photoData)) {
        for (const photo of carousel.photoData) {
            if (photo && typeof photo.photoKey === "string") {
                urls.push(carousel.baseUrl.replace("{photoKey}", photo.photoKey));
            }
        }
    }

    if (urls.length === 0 && typeof (match as { imgSrc?: unknown }).imgSrc === "string") {
        urls.push((match as { imgSrc: string }).imgSrc);
    }

    return urls;
}

export function shouldShowZillowPropertySection(details: ZillowRawDetails | null): boolean {
    return Boolean(
        details &&
        (details.neighborhood ||
            details.county ||
            details.walkScore ||
            details.transitScore ||
            details.bikeScore ||
            details.specialOffer ||
            details.commonUnitAmenities.length ||
            details.description),
    );
}

export function getPropertyTypeLabel(isBuilding: boolean | null, buildingZpid: string | null): string | null {
    if (isBuilding === null && !buildingZpid) {
        return null;
    }

    if (isBuilding) {
        return "Whole Building";
    }

    return buildingZpid ? "Unit in Building" : "Single Unit";
}
