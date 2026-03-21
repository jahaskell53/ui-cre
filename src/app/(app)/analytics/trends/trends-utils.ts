export interface TrendRow {
    week_start: string;
    beds: number;
    median_rent: number;
    listing_count: number;
}

export interface ActivityRow {
    week_start: string;
    beds: number;
    new_listings: number;
    accumulated_listings: number;
    closed_listings: number;
}

export interface ChartPoint {
    week: string;
    weekLabel: string;
    studio?: number;
    "1bd"?: number;
    "2bd"?: number;
    "3bd+"?: number;
}

export interface ActivityChartPoint {
    week: string;
    weekLabel: string;
    studio?: number;
    "1bd"?: number;
    "2bd"?: number;
    "3bd+"?: number;
}

export const BED_KEYS = [
    { beds: 0, key: "studio" as const, label: "Studio", color: "#6b7280" },
    { beds: 1, key: "1bd" as const, label: "1 bed", color: "#3b82f6" },
    { beds: 2, key: "2bd" as const, label: "2 bed", color: "#8b5cf6" },
    { beds: 3, key: "3bd+" as const, label: "3+ bed", color: "#f97316" },
];

export function formatWeekLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDollars(n: number): string {
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function buildChartData(rows: TrendRow[]): ChartPoint[] {
    const byWeek: Record<string, ChartPoint> = {};
    for (const row of rows) {
        const w = row.week_start;
        if (!byWeek[w]) byWeek[w] = { week: w, weekLabel: formatWeekLabel(w) };
        const bedEntry = BED_KEYS.find(b => b.beds === row.beds);
        if (bedEntry) byWeek[w][bedEntry.key] = Math.round(row.median_rent);
    }
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week));
}

export function buildActivityChartData(
    rows: ActivityRow[],
    metric: 'new_listings' | 'accumulated_listings' | 'closed_listings'
): ActivityChartPoint[] {
    const byWeek: Record<string, ActivityChartPoint> = {};
    for (const row of rows) {
        const w = row.week_start;
        if (!byWeek[w]) byWeek[w] = { week: w, weekLabel: formatWeekLabel(w) };
        const bedEntry = BED_KEYS.find(b => b.beds === row.beds);
        if (bedEntry) byWeek[w][bedEntry.key] = row[metric];
    }
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week));
}

export function pctChange(first: number | undefined, last: number | undefined): number | null {
    if (first == null || last == null || first === 0) return null;
    return ((last - first) / first) * 100;
}

export const AREA_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ef4444"];

export interface AreaSelection {
    id: string;          // zip, "nh:<neighborhoodId>", or "city:<name>:<state>"
    label: string;
    color: string;
    neighborhoodId?: number;
    cityName?: string;
    cityState?: string;
}

export function buildMultiAreaRentData(
    areaResults: Record<string, TrendRow[]>,
    areas: AreaSelection[],
    selectedBeds: number
): Array<Record<string, string | number>> {
    const allWeeks = new Set<string>();
    for (const area of areas) {
        (areaResults[area.id] ?? [])
            .filter(r => r.beds === selectedBeds)
            .forEach(r => allWeeks.add(r.week_start));
    }
    return Array.from(allWeeks).sort().map(w => {
        const point: Record<string, string | number> = { week: w, weekLabel: formatWeekLabel(w) };
        for (const area of areas) {
            const row = (areaResults[area.id] ?? []).find(r => r.beds === selectedBeds && r.week_start === w);
            if (row) point[area.id] = Math.round(row.median_rent);
        }
        return point;
    });
}

export function buildActivityComboData(
    areaResults: Record<string, ActivityRow[]>,
    areas: AreaSelection[],
    selectedBeds: number
): Array<Record<string, string | number>> {
    const allWeeks = new Set<string>();
    for (const area of areas) {
        (areaResults[area.id] ?? [])
            .filter(r => r.beds === selectedBeds)
            .forEach(r => allWeeks.add(r.week_start));
    }
    return Array.from(allWeeks).sort().map(w => {
        const point: Record<string, string | number> = { week: w, weekLabel: formatWeekLabel(w) };
        for (const area of areas) {
            const row = (areaResults[area.id] ?? []).find(r => r.beds === selectedBeds && r.week_start === w);
            if (row) {
                point[`${area.id}_new`] = row.new_listings;
                point[`${area.id}_closed`] = row.closed_listings;
                point[`${area.id}_acc`] = row.accumulated_listings;
            }
        }
        return point;
    });
}
