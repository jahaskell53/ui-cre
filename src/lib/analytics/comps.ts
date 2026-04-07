export interface CompResultLike {
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
    distance_m: number;
    composite_score: number;
}

export type CompSortColumn = "price" | "beds" | "baths" | "area" | "ppsf" | "distance" | "score";
export type SortDirection = "asc" | "desc";

export interface SubjectCompInputs {
    price: string;
    beds: string;
    baths: string;
    area: string;
}

export interface MarketStats {
    min: number;
    max: number;
    p25: number;
    median: number;
    p75: number;
    n: number;
    subjectPercentile: number | null;
}

export function makeCircle(center: [number, number], radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
    const [lng, lat] = center;
    const deltaLat = radiusM / 111320;
    const deltaLng = deltaLat / Math.cos((lat * Math.PI) / 180);
    const coords: [number, number][] = Array.from({ length: 65 }, (_, index) => {
        const angle = (index / 64) * 2 * Math.PI;
        return [lng + deltaLng * Math.cos(angle), lat + deltaLat * Math.sin(angle)];
    });
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
}

export function getGeomBounds(geojson: object): [[number, number], [number, number]] {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const walkCoords = (coords: unknown): void => {
        if (!Array.isArray(coords)) {
            return;
        }

        if (typeof coords[0] === "number") {
            const [lng, lat] = coords as [number, number];
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
            return;
        }

        coords.forEach(walkCoords);
    };

    const geometry = geojson as { type: string; coordinates?: unknown; features?: Array<{ geometry: { coordinates: unknown } }> };
    if (geometry.type === "FeatureCollection" && geometry.features) {
        geometry.features.forEach((feature) => walkCoords(feature.geometry.coordinates));
    } else if (geometry.coordinates) {
        walkCoords(geometry.coordinates);
    }

    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ];
}

export function titleCaseAddress(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sortCompResults<T extends CompResultLike>(comps: T[], sortCol: CompSortColumn | null, sortDir: SortDirection, subject: SubjectCompInputs): T[] {
    if (!sortCol) {
        return comps;
    }

    const subjectPrice = subject.price ? parseInt(subject.price) : null;
    const subjectBeds = subject.beds ? parseInt(subject.beds) : null;
    const subjectBaths = subject.baths ? parseFloat(subject.baths) : null;
    const subjectArea = subject.area ? parseInt(subject.area) : null;
    const subjectPpsf = subjectPrice && subjectArea ? subjectPrice / subjectArea : null;

    const getValue = (comp: T): number => {
        switch (sortCol) {
            case "price":
                return subjectPrice != null && comp.price != null ? Math.abs(comp.price - subjectPrice) : (comp.price ?? Infinity);
            case "beds":
                return subjectBeds != null && comp.beds != null ? Math.abs(comp.beds - subjectBeds) : (comp.beds ?? Infinity);
            case "baths":
                return subjectBaths != null && comp.baths != null ? Math.abs(Number(comp.baths) - subjectBaths) : Number(comp.baths) || Infinity;
            case "area":
                return subjectArea != null && comp.area != null ? Math.abs(comp.area - subjectArea) : (comp.area ?? Infinity);
            case "ppsf": {
                const compPpsf = comp.price && comp.area ? comp.price / comp.area : null;
                return subjectPpsf != null && compPpsf != null ? Math.abs(compPpsf - subjectPpsf) : (compPpsf ?? Infinity);
            }
            case "distance":
                return comp.distance_m;
            case "score":
                return comp.composite_score;
            default:
                return 0;
        }
    };

    const multiplier = sortDir === "asc" ? 1 : -1;
    return [...comps].sort((left, right) => multiplier * (getValue(left) - getValue(right)));
}

export function buildMarketStats(comps: CompResultLike[], subjectPrice: string): MarketStats | null {
    const prices = comps
        .map((comp) => comp.price)
        .filter((price): price is number => price != null)
        .sort((left, right) => left - right);

    if (prices.length === 0) {
        return null;
    }

    const count = prices.length;
    const percentile = (value: number) => {
        const index = (value / 100) * (count - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        return lower === upper ? prices[lower] : prices[lower] + (prices[upper] - prices[lower]) * (index - lower);
    };

    let subjectPercentile: number | null = null;
    if (subjectPrice) {
        const parsedSubjectPrice = parseInt(subjectPrice);
        if (!Number.isNaN(parsedSubjectPrice)) {
            subjectPercentile = Math.round((prices.filter((price) => price < parsedSubjectPrice).length / count) * 100);
        }
    }

    return {
        min: prices[0],
        max: prices[count - 1],
        p25: percentile(25),
        median: percentile(50),
        p75: percentile(75),
        n: count,
        subjectPercentile,
    };
}

export function metersToMiles(meters: number): string {
    return (meters / 1609.34).toFixed(2);
}

export function getScoreColor(score: number): string {
    if (score >= 0.75) return "text-green-600 dark:text-green-400";
    if (score >= 0.55) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
}
