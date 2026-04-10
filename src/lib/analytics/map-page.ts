export type MapListingSource = "loopnet" | "zillow";
export type AreaType = "zip" | "neighborhood" | "city" | "county" | "msa" | "address";

export interface SerializableMapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export interface AreaFilter {
    type: AreaType;
    label: string;
    zipCode?: string;
    cityName?: string;
    cityState?: string;
    neighborhoodId?: number;
    countyName?: string;
    countyState?: string;
    msaGeoid?: string;
    addressQuery?: string;
    bbox?: SerializableMapBounds;
}

export interface Filters {
    priceMin: string;
    priceMax: string;
    capRateMin: string;
    capRateMax: string;
    sqftMin: string;
    sqftMax: string;
    beds: number[];
    bathsMin: number | null;
    propertyType: "both" | "reit" | "mid";
}

interface SearchParamSource {
    get(key: string): string | null;
}

export const BED_OPTIONS = [
    { label: "Studio", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4+", value: 4 },
];

export const BATH_OPTIONS = [
    { label: "1+", value: 1 },
    { label: "1.5+", value: 1.5 },
    { label: "2+", value: 2 },
    { label: "3+", value: 3 },
    { label: "4+", value: 4 },
];

export const AREA_TYPE_LABELS: Record<AreaType, string> = {
    zip: "ZIP",
    neighborhood: "Neighborhood",
    city: "City",
    county: "County",
    msa: "MSA",
    address: "Address",
};

export const AREA_TYPE_PLACEHOLDERS: Record<AreaType, string> = {
    zip: "Enter zip code...",
    neighborhood: "Search neighborhood...",
    city: "Search city...",
    county: "Search county...",
    msa: "Search metro area...",
    address: "Search address, building name...",
};

export function createDefaultMapFilters(): Filters {
    return {
        priceMin: "",
        priceMax: "",
        capRateMin: "",
        capRateMax: "",
        sqftMin: "",
        sqftMax: "",
        beds: [],
        bathsMin: null,
        propertyType: "both",
    };
}

export function parseMapFilters(searchParams: SearchParamSource): Filters {
    const beds = searchParams.get("beds");
    const bathsMin = searchParams.get("bathsMin");
    const propertyType = searchParams.get("propertyType");

    return {
        priceMin: searchParams.get("priceMin") ?? "",
        priceMax: searchParams.get("priceMax") ?? "",
        capRateMin: searchParams.get("capRateMin") ?? "",
        capRateMax: searchParams.get("capRateMax") ?? "",
        sqftMin: searchParams.get("sqftMin") ?? "",
        sqftMax: searchParams.get("sqftMax") ?? "",
        beds: beds
            ? beds
                  .split(",")
                  .map(Number)
                  .filter((value) => !Number.isNaN(value))
            : [],
        bathsMin: bathsMin !== null ? parseFloat(bathsMin) || null : null,
        propertyType: (["both", "reit", "mid"] as const).find((value) => value === propertyType) ?? "both",
    };
}

export function parseMapListingSource(searchParams: SearchParamSource): MapListingSource {
    return searchParams.get("source") === "loopnet" ? "loopnet" : "zillow";
}

export function parseShowLatestOnly(searchParams: SearchParamSource): boolean {
    return searchParams.get("latest") !== "false";
}

/** Mobile/small screens: full-area map vs list (`view=list` in URL; default is map). */
export function parseListingsViewMode(searchParams: SearchParamSource): "map" | "list" {
    return searchParams.get("view") === "list" ? "list" : "map";
}

export function parseAreaType(searchParams: SearchParamSource): AreaType {
    const areaType = searchParams.get("areaType");
    return (["zip", "neighborhood", "city", "county", "msa", "address"] as const).find((value) => value === areaType) ?? "zip";
}

function parseOptionalBounds(searchParams: SearchParamSource): SerializableMapBounds | undefined {
    const bboxWest = parseFloat(searchParams.get("areaBboxW") ?? "");
    const bboxSouth = parseFloat(searchParams.get("areaBboxS") ?? "");
    const bboxEast = parseFloat(searchParams.get("areaBboxE") ?? "");
    const bboxNorth = parseFloat(searchParams.get("areaBboxN") ?? "");

    if ([bboxWest, bboxSouth, bboxEast, bboxNorth].every((value) => !Number.isNaN(value))) {
        return {
            west: bboxWest,
            south: bboxSouth,
            east: bboxEast,
            north: bboxNorth,
        };
    }

    return undefined;
}

export function parseAreaFilter(searchParams: SearchParamSource): AreaFilter | null {
    const type = searchParams.get("areaType") as AreaType | null;
    const label = searchParams.get("area");

    if (!type || !label) {
        return null;
    }

    const base = { type, label, bbox: parseOptionalBounds(searchParams) };

    if (type === "zip") {
        return { ...base, zipCode: searchParams.get("areaZip") ?? label };
    }

    if (type === "city") {
        return { ...base, cityName: searchParams.get("areaCity") ?? "", cityState: searchParams.get("areaCityState") ?? "" };
    }

    if (type === "county") {
        return { ...base, countyName: searchParams.get("areaCounty") ?? "", countyState: searchParams.get("areaCountyState") ?? "" };
    }

    if (type === "neighborhood") {
        return { ...base, neighborhoodId: parseInt(searchParams.get("areaNeighborhoodId") ?? "") || undefined };
    }

    if (type === "msa") {
        return { ...base, msaGeoid: searchParams.get("areaMsaGeoid") ?? "" };
    }

    if (type === "address") {
        const rawAddressQuery = searchParams.get("areaAddress");
        return { ...base, addressQuery: rawAddressQuery ?? undefined };
    }

    return null;
}

export function countActiveMapFilters(filters: Filters, source: MapListingSource, showLatestOnly = true): number {
    let count = 0;

    if (source !== "zillow") count++;
    if (!showLatestOnly) count++;

    if (filters.priceMin || filters.priceMax) count++;
    if (source === "loopnet" && (filters.capRateMin || filters.capRateMax)) count++;
    if (filters.sqftMin || filters.sqftMax) count++;
    if (source === "zillow" && filters.beds.length > 0) count++;
    if (source === "zillow" && filters.bathsMin !== null) count++;
    if (source === "zillow" && filters.propertyType !== "both") count++;

    return count;
}

export function buildMapSearchParams({
    baseParams,
    filters,
    mapListingSource,
    showLatestOnly,
    areaType,
    areaFilter,
    listingsViewMode,
}: {
    baseParams?: URLSearchParams;
    filters: Filters;
    mapListingSource: MapListingSource;
    showLatestOnly: boolean;
    areaType: AreaType;
    areaFilter: AreaFilter | null;
    listingsViewMode?: "map" | "list";
}): URLSearchParams {
    const params = new URLSearchParams(baseParams?.toString() ?? "");

    if (listingsViewMode !== undefined) {
        if (listingsViewMode === "list") params.set("view", "list");
        else params.delete("view");
    }

    if (mapListingSource !== "zillow") params.set("source", mapListingSource);
    else params.delete("source");
    if (!showLatestOnly) params.set("latest", "false");
    else params.delete("latest");

    params.set("areaType", areaType);

    if (areaFilter) {
        params.set("area", areaFilter.label);
        if (areaFilter.zipCode) params.set("areaZip", areaFilter.zipCode);
        else params.delete("areaZip");
        if (areaFilter.cityName) params.set("areaCity", areaFilter.cityName);
        else params.delete("areaCity");
        if (areaFilter.cityState) params.set("areaCityState", areaFilter.cityState);
        else params.delete("areaCityState");
        if (areaFilter.neighborhoodId != null) params.set("areaNeighborhoodId", String(areaFilter.neighborhoodId));
        else params.delete("areaNeighborhoodId");
        if (areaFilter.countyName) params.set("areaCounty", areaFilter.countyName);
        else params.delete("areaCounty");
        if (areaFilter.countyState) params.set("areaCountyState", areaFilter.countyState);
        else params.delete("areaCountyState");
        if (areaFilter.msaGeoid) params.set("areaMsaGeoid", areaFilter.msaGeoid);
        else params.delete("areaMsaGeoid");
        if (areaFilter.addressQuery) params.set("areaAddress", areaFilter.addressQuery);
        else params.delete("areaAddress");
        if (areaFilter.bbox) {
            params.set("areaBboxW", String(areaFilter.bbox.west));
            params.set("areaBboxS", String(areaFilter.bbox.south));
            params.set("areaBboxE", String(areaFilter.bbox.east));
            params.set("areaBboxN", String(areaFilter.bbox.north));
        } else {
            ["areaBboxW", "areaBboxS", "areaBboxE", "areaBboxN"].forEach((key) => params.delete(key));
        }
    } else {
        [
            "area",
            "areaZip",
            "areaCity",
            "areaCityState",
            "areaNeighborhoodId",
            "areaCounty",
            "areaCountyState",
            "areaMsaGeoid",
            "areaAddress",
            "areaBboxW",
            "areaBboxS",
            "areaBboxE",
            "areaBboxN",
        ].forEach((key) => params.delete(key));
    }

    if (filters.priceMin) params.set("priceMin", filters.priceMin);
    else params.delete("priceMin");
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
    else params.delete("priceMax");
    if (filters.capRateMin) params.set("capRateMin", filters.capRateMin);
    else params.delete("capRateMin");
    if (filters.capRateMax) params.set("capRateMax", filters.capRateMax);
    else params.delete("capRateMax");
    if (filters.sqftMin) params.set("sqftMin", filters.sqftMin);
    else params.delete("sqftMin");
    if (filters.sqftMax) params.set("sqftMax", filters.sqftMax);
    else params.delete("sqftMax");
    if (filters.beds.length > 0) params.set("beds", filters.beds.join(","));
    else params.delete("beds");
    if (filters.bathsMin !== null) params.set("bathsMin", String(filters.bathsMin));
    else params.delete("bathsMin");
    if (filters.propertyType !== "both") params.set("propertyType", filters.propertyType);
    else params.delete("propertyType");

    return params;
}
