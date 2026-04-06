export interface ZillowScore {
    score: number;
    description: string | null;
}

export interface ZillowRawDetails {
    buildingName: string | null;
    statusText: string | null;
    availabilityCount: number | null;
    description: string | null;
    neighborhood: string | null;
    county: string | null;
    commonUnitAmenities: string[];
    specialOffer: string | null;
    walkScore: ZillowScore | null;
    transitScore: ZillowScore | null;
    bikeScore: ZillowScore | null;
}

export const EMPTY_ZILLOW_RAW_DETAILS: ZillowRawDetails = {
    buildingName: null,
    statusText: null,
    availabilityCount: null,
    description: null,
    neighborhood: null,
    county: null,
    commonUnitAmenities: [],
    specialOffer: null,
    walkScore: null,
    transitScore: null,
    bikeScore: null,
};

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBasicHtmlEntities(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function parseNumberish(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function parseScore(value: unknown, scoreKey: "walkscore" | "transit_score" | "bikescore"): ZillowScore | null {
    if (!isJsonObject(value)) return null;
    const score = parseNumberish(value[scoreKey]);
    if (score == null) return null;
    return {
        score,
        description: typeof value.description === "string" ? value.description : null,
    };
}

export function formatZillowLabel(value: string): string {
    return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatLaundryLabel(value: string | null | undefined): string | null {
    return value ? formatZillowLabel(value) : null;
}

export function formatScoreLabel(score: ZillowScore | null | undefined): string | null {
    if (!score) return null;
    return score.description ? `${score.score} - ${score.description}` : String(score.score);
}

export function extractZillowRawDetails(rawItem: unknown): Partial<ZillowRawDetails> {
    if (!isJsonObject(rawItem)) return {};

    return {
        buildingName: typeof rawItem.buildingName === "string" ? rawItem.buildingName : null,
        statusText: typeof rawItem.statusText === "string" ? rawItem.statusText : null,
        availabilityCount: parseNumberish(rawItem.availabilityCount),
    };
}

export function extractZillowBuildingDetails(rawItem: unknown): Partial<ZillowRawDetails> {
    if (!isJsonObject(rawItem)) return {};

    const specialOffer = Array.isArray(rawItem.specialOffers)
        ? rawItem.specialOffers.find((offer): offer is JsonObject => isJsonObject(offer) && typeof offer.description === "string")
        : null;

    return {
        buildingName: typeof rawItem.buildingName === "string" ? rawItem.buildingName : null,
        description: decodeBasicHtmlEntities(typeof rawItem.description === "string" ? rawItem.description : null),
        neighborhood: typeof rawItem.neighborhood === "string" ? rawItem.neighborhood : null,
        county: typeof rawItem.county === "string" ? rawItem.county : null,
        commonUnitAmenities: Array.isArray(rawItem.commonUnitAmenities)
            ? rawItem.commonUnitAmenities.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : [],
        specialOffer: decodeBasicHtmlEntities(specialOffer?.description as string | undefined),
        walkScore: parseScore(rawItem.walkScore, "walkscore"),
        transitScore: parseScore(rawItem.transitScore, "transit_score"),
        bikeScore: parseScore(rawItem.bikeScore, "bikescore"),
    };
}

export function hasZillowPropertyDetails(details: ZillowRawDetails | null): boolean {
    return Boolean(
        details &&
            (details.buildingName ||
                details.statusText ||
                details.availabilityCount != null ||
                details.description ||
                details.neighborhood ||
                details.county ||
                details.commonUnitAmenities.length > 0 ||
                details.specialOffer ||
                details.walkScore ||
                details.transitScore ||
                details.bikeScore),
    );
}
