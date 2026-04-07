import type { ActivityRow, AreaSelection, TrendRow } from "@/app/(app)/analytics/trends/trends-utils";

export const MAX_TREND_AREAS = 4;
export const REIT_AREA_COLORS = ["#1d4ed8", "#c2410c", "#6d28d9", "#065f46", "#b91c1c"];

export function parseSerializedAreas(param: string | null): AreaSelection[] {
    if (!param) {
        return [];
    }

    try {
        return JSON.parse(atob(param)) as AreaSelection[];
    } catch {
        return [];
    }
}

export function serializeAreasParam(areas: AreaSelection[]): string {
    return btoa(JSON.stringify(areas));
}

export function getTrendsSearchPlaceholder(areaType: string, addressMode: boolean): string {
    if (addressMode) {
        return "Enter address...";
    }

    if (areaType === "ZIP Code") {
        return "Enter zip code...";
    }

    if (areaType === "Neighborhood") {
        return "Search neighborhood name...";
    }

    if (areaType === "City") {
        return "Search city...";
    }

    if (areaType === "County") {
        return "Search county...";
    }

    return "Search metro area...";
}

export function buildDisplayAreas(selectedAreas: AreaSelection[], selectedSegment: "both" | "mid" | "reit"): AreaSelection[] {
    if (selectedSegment !== "both") {
        return selectedAreas;
    }

    return selectedAreas.flatMap((area, index) =>
        (["mid", "reit"] as const).map((source) => ({
            ...area,
            id: `${area.id}:${source}`,
            label: `${area.label} (${source === "reit" ? "REIT" : "Mid-market"})`,
            color: source === "reit" ? REIT_AREA_COLORS[index % REIT_AREA_COLORS.length] : area.color,
        })),
    );
}

export function buildDisplayAreaResults(
    displayAreas: AreaSelection[],
    areaResults: Record<string, { trends: TrendRow[]; activity: ActivityRow[] }>,
): {
    displayRentResults: Record<string, TrendRow[]>;
    displayActivityResults: Record<string, ActivityRow[]>;
} {
    const displayRentResults: Record<string, TrendRow[]> = {};
    const displayActivityResults: Record<string, ActivityRow[]> = {};

    for (const area of displayAreas) {
        if (areaResults[area.id]) {
            displayRentResults[area.id] = areaResults[area.id].trends;
            displayActivityResults[area.id] = areaResults[area.id].activity;
        }
    }

    return { displayRentResults, displayActivityResults };
}
