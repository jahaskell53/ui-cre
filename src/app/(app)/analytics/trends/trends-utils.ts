export interface SalesTrendRow {
    month_start: string;
    median_price: number;
    avg_cap_rate: number | null;
    listing_count: number;
}

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
    { beds: 1, key: "1bd" as const, label: "1BR", color: "#3b82f6" },
    { beds: 2, key: "2bd" as const, label: "2BR", color: "#8b5cf6" },
    { beds: 3, key: "3bd+" as const, label: "3BR+", color: "#f97316" },
];

// Line dash per bed type: 1BR is solid (primary), others get distinct dashes
export const BED_DASH: Record<number, string> = {
    0: "2 4", // Studio: dots
    1: "", // 1BR: solid
    2: "7 3", // 2BR: dashed
    3: "2 7", // 3BR+: long dots
};

export interface SeriesInfo {
    key: string;
    label: string;
    color: string;
    dash: string;
}

export function getRentSeriesList(areas: AreaSelection[], selectedBeds: number[]): SeriesInfo[] {
    const multibed = selectedBeds.length > 1;
    const series: SeriesInfo[] = [];
    for (const area of areas) {
        for (const beds of selectedBeds) {
            const bedEntry = BED_KEYS.find((b) => b.beds === beds)!;
            series.push({
                key: multibed ? `${area.id}:${beds}` : area.id,
                label: multibed ? `${area.label} · ${bedEntry.label}` : area.label,
                color: area.color,
                dash: multibed ? (BED_DASH[beds] ?? "") : "",
            });
        }
    }
    return series;
}

export function getActivitySeriesList(areas: AreaSelection[], selectedBeds: number[]): SeriesInfo[] {
    const multibed = selectedBeds.length > 1;
    const series: SeriesInfo[] = [];
    for (const area of areas) {
        for (const beds of selectedBeds) {
            const bedEntry = BED_KEYS.find((b) => b.beds === beds)!;
            series.push({
                key: multibed ? `${area.id}:${beds}` : area.id,
                label: multibed ? `${area.label} · ${bedEntry.label}` : area.label,
                color: area.color,
                dash: multibed ? (BED_DASH[beds] ?? "") : "",
            });
        }
    }
    return series;
}

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
        const bedEntry = BED_KEYS.find((b) => b.beds === row.beds);
        if (bedEntry) byWeek[w][bedEntry.key] = Math.round(row.median_rent);
    }
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week));
}

export function buildActivityChartData(rows: ActivityRow[], metric: "new_listings" | "accumulated_listings" | "closed_listings"): ActivityChartPoint[] {
    const byWeek: Record<string, ActivityChartPoint> = {};
    for (const row of rows) {
        const w = row.week_start;
        if (!byWeek[w]) byWeek[w] = { week: w, weekLabel: formatWeekLabel(w) };
        const bedEntry = BED_KEYS.find((b) => b.beds === row.beds);
        if (bedEntry) byWeek[w][bedEntry.key] = row[metric];
    }
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week));
}

export function pctChange(first: number | undefined, last: number | undefined): number | null {
    if (first == null || last == null || first === 0) return null;
    return ((last - first) / first) * 100;
}

export const AREA_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ef4444"];

// ── Granularity ──────────────────────────────────────────────────────────────

export type Granularity = "wow" | "mom" | "qoq" | "yoy";

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "wow", label: "WoW" },
    { value: "mom", label: "MoM" },
    { value: "qoq", label: "QoQ" },
    { value: "yoy", label: "YoY" },
];

function medianOf(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function toBucketStart(dateStr: string, granularity: Granularity): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-11
    if (granularity === "mom") {
        return `${year}-${String(month + 1).padStart(2, "0")}-01`;
    } else if (granularity === "qoq") {
        const qMonth = Math.floor(month / 3) * 3 + 1;
        return `${year}-${String(qMonth).padStart(2, "0")}-01`;
    } else {
        return `${year}-01-01`;
    }
}

/** Aggregate weekly TrendRows into monthly/quarterly/yearly buckets (median rent). */
export function aggregateTrendRows(rows: TrendRow[], granularity: Granularity): TrendRow[] {
    if (granularity === "wow") return rows;
    const groups: Record<string, TrendRow[]> = {};
    for (const row of rows) {
        const key = `${row.beds}::${toBucketStart(row.week_start, granularity)}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }
    return Object.entries(groups)
        .map(([key, groupRows]) => {
            const bucketStart = key.split("::")[1];
            return {
                week_start: bucketStart,
                beds: groupRows[0].beds,
                median_rent: medianOf(groupRows.map((r) => r.median_rent)),
                listing_count: Math.round(groupRows.reduce((s, r) => s + r.listing_count, 0) / groupRows.length),
            };
        })
        .sort((a, b) => a.week_start.localeCompare(b.week_start) || a.beds - b.beds);
}

/** Format a bucket date string for display on the chart x-axis. */
export function formatPeriodLabel(dateStr: string, granularity: Granularity): string {
    if (granularity === "wow") return formatWeekLabel(dateStr);
    const d = new Date(dateStr + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const shortYear = String(year).slice(2);
    if (granularity === "mom") {
        const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        return `${month} '${shortYear}`;
    }
    if (granularity === "qoq") {
        const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
        return `Q${quarter} '${shortYear}`;
    }
    return String(year);
}

/**
 * Return which granularity options are unlocked based on the data span.
 * WoW – always; MoM – >4 weeks; QoQ – >3 months; YoY – >12 months.
 */
export function getAvailableGranularities(areaResults: Record<string, TrendRow[]>): Granularity[] {
    const allDates = Object.values(areaResults)
        .flat()
        .map((r) => r.week_start)
        .sort();
    if (allDates.length < 2) return ["wow"];
    const first = new Date(allDates[0] + "T00:00:00Z");
    const last = new Date(allDates[allDates.length - 1] + "T00:00:00Z");
    const diffDays = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
    const available: Granularity[] = ["wow"];
    if (diffDays > 28) available.push("mom");
    if (diffDays > 91) available.push("qoq");
    if (diffDays > 365) available.push("yoy");
    return available;
}

export interface AreaSelection {
    id: string; // zip, "nh:<neighborhoodId>", or "city:<name>:<state>"
    label: string;
    color: string;
    neighborhoodId?: number;
    cityName?: string;
    cityState?: string;
    countyName?: string;
    countyState?: string;
    msaGeoid?: string;
}

export function buildMultiAreaRentData(
    areaResults: Record<string, TrendRow[]>,
    areas: AreaSelection[],
    selectedBeds: number[],
    granularity: Granularity = "wow",
): Array<Record<string, string | number>> {
    // Aggregate each area's rows to the requested granularity first
    const aggregated: Record<string, TrendRow[]> = {};
    for (const area of areas) {
        aggregated[area.id] = aggregateTrendRows(areaResults[area.id] ?? [], granularity);
    }

    const multibed = selectedBeds.length > 1;
    const allWeeks = new Set<string>();
    for (const area of areas) {
        for (const beds of selectedBeds) {
            (aggregated[area.id] ?? []).filter((r) => r.beds === beds).forEach((r) => allWeeks.add(r.week_start));
        }
    }
    return Array.from(allWeeks)
        .sort()
        .map((w) => {
            const point: Record<string, string | number> = { week: w, weekLabel: formatPeriodLabel(w, granularity) };
            for (const area of areas) {
                for (const beds of selectedBeds) {
                    const key = multibed ? `${area.id}:${beds}` : area.id;
                    const row = (aggregated[area.id] ?? []).find((r) => r.beds === beds && r.week_start === w);
                    if (row) point[key] = Math.round(row.median_rent);
                }
            }
            return point;
        });
}

export type SalesGranularity = "month" | "quarter" | "half_year" | "year";

export const SALES_GRANULARITY_VALUES: SalesGranularity[] = ["month", "quarter", "half_year", "year"];

export function isSalesGranularity(v: string): v is SalesGranularity {
    return (SALES_GRANULARITY_VALUES as string[]).includes(v);
}

export function formatMonthLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function formatMillions(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function medianFromSorted(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function rollupSalesTrendGroup(group: SalesTrendRow[], bucketMonthStart: string): SalesTrendRow {
    const prices = group.map((r) => r.median_price).filter((p) => p != null) as number[];
    const capRates = group.map((r) => r.avg_cap_rate).filter((v) => v != null) as number[];
    const totalCount = group.reduce((s, r) => s + r.listing_count, 0);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const avgCapRate = capRates.length > 0 ? capRates.reduce((s, v) => s + v, 0) / capRates.length : null;
    return {
        month_start: bucketMonthStart,
        median_price: medianFromSorted(sortedPrices),
        avg_cap_rate: avgCapRate,
        listing_count: totalCount,
    };
}

/** First calendar month of the quarter containing `monthStart` (YYYY-MM-DD). */
export function salesMonthStartToQuarterBucket(monthStart: string): string {
    const year = monthStart.slice(0, 4);
    const month = Number(monthStart.slice(5, 7));
    const quarterIndex = Math.floor((month - 1) / 3);
    const startMonth = quarterIndex * 3 + 1;
    return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}

/** Jan–Jun → YYYY-01-01; Jul–Dec → YYYY-07-01. */
export function salesMonthStartToHalfYearBucket(monthStart: string): string {
    const year = monthStart.slice(0, 4);
    const month = Number(monthStart.slice(5, 7));
    return month <= 6 ? `${year}-01-01` : `${year}-07-01`;
}

/** Aggregate monthly SalesTrendRows by calendar quarter (median of monthly medians, sum counts, mean cap rates). */
export function aggregateSalesTrendRowsToQuarter(rows: SalesTrendRow[]): SalesTrendRow[] {
    const groups: Record<string, SalesTrendRow[]> = {};
    for (const row of rows) {
        const key = salesMonthStartToQuarterBucket(row.month_start);
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }
    return Object.keys(groups)
        .sort()
        .map((key) => rollupSalesTrendGroup(groups[key], key));
}

/** Aggregate monthly SalesTrendRows into 6-month buckets (H1 / H2). */
export function aggregateSalesTrendRowsToHalfYear(rows: SalesTrendRow[]): SalesTrendRow[] {
    const groups: Record<string, SalesTrendRow[]> = {};
    for (const row of rows) {
        const key = salesMonthStartToHalfYearBucket(row.month_start);
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }
    return Object.keys(groups)
        .sort()
        .map((key) => rollupSalesTrendGroup(groups[key], key));
}

/** Aggregate monthly SalesTrendRows into yearly buckets. */
export function aggregateSalesTrendRowsToYear(rows: SalesTrendRow[]): SalesTrendRow[] {
    const byYear: Record<string, SalesTrendRow[]> = {};
    for (const row of rows) {
        const year = row.month_start.slice(0, 4);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(row);
    }
    return Object.entries(byYear)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, group]) => rollupSalesTrendGroup(group, `${year}-01-01`));
}

/** Aggregate raw monthly rows to the requested sales chart granularity. */
export function aggregateSalesTrendRows(rows: SalesTrendRow[], granularity: SalesGranularity): SalesTrendRow[] {
    const sorted = [...rows].sort((a, b) => a.month_start.localeCompare(b.month_start));
    if (granularity === "month") return sorted;
    if (granularity === "quarter") return aggregateSalesTrendRowsToQuarter(sorted);
    if (granularity === "half_year") return aggregateSalesTrendRowsToHalfYear(sorted);
    return aggregateSalesTrendRowsToYear(sorted);
}

/** X-axis label for a bucket `month_start` at the given granularity. */
export function formatSalesPeriodLabel(dateStr: string, granularity: SalesGranularity): string {
    if (granularity === "month") return formatMonthLabel(dateStr);
    if (granularity === "year") return dateStr.slice(0, 4);
    const d = new Date(dateStr + "T00:00:00Z");
    const shortYear = String(d.getUTCFullYear()).slice(2);
    if (granularity === "quarter") {
        const q = Math.floor(d.getUTCMonth() / 3) + 1;
        return `Q${q} '${shortYear}`;
    }
    const half = d.getUTCMonth() < 6 ? 1 : 2;
    return `H${half} '${shortYear}`;
}

export function buildMultiAreaSalesData(
    areaResults: Record<string, SalesTrendRow[]>,
    areas: AreaSelection[],
    metric: "median_price" | "avg_cap_rate" | "listing_count",
    granularity: SalesGranularity = "year",
): Array<Record<string, string | number>> {
    const aggregated: Record<string, SalesTrendRow[]> = {};
    for (const area of areas) {
        const rows = areaResults[area.id] ?? [];
        aggregated[area.id] = aggregateSalesTrendRows(rows, granularity);
    }

    const allBuckets = new Set<string>();
    for (const area of areas) {
        (aggregated[area.id] ?? []).forEach((r) => allBuckets.add(r.month_start));
    }

    const formatLabel = (dateStr: string) => formatSalesPeriodLabel(dateStr, granularity);

    return Array.from(allBuckets)
        .sort()
        .map((bucket) => {
            const point: Record<string, string | number> = { month: bucket, monthLabel: formatLabel(bucket) };
            for (const area of areas) {
                const row = (aggregated[area.id] ?? []).find((r) => r.month_start === bucket);
                if (row) {
                    const val = row[metric];
                    if (val != null) point[area.id] = typeof val === "number" ? val : Number(val);
                }
            }
            return point;
        });
}

export function buildActivityComboData(
    areaResults: Record<string, ActivityRow[]>,
    areas: AreaSelection[],
    selectedBeds: number[],
): Array<Record<string, string | number>> {
    const multibed = selectedBeds.length > 1;
    const allWeeks = new Set<string>();
    for (const area of areas) {
        for (const beds of selectedBeds) {
            (areaResults[area.id] ?? []).filter((r) => r.beds === beds).forEach((r) => allWeeks.add(r.week_start));
        }
    }
    return Array.from(allWeeks)
        .sort()
        .map((w) => {
            const point: Record<string, string | number> = { week: w, weekLabel: formatWeekLabel(w) };
            for (const area of areas) {
                for (const beds of selectedBeds) {
                    const prefix = multibed ? `${area.id}:${beds}` : area.id;
                    const row = (areaResults[area.id] ?? []).find((r) => r.beds === beds && r.week_start === w);
                    if (row) {
                        point[`${prefix}_new`] = row.new_listings;
                        point[`${prefix}_closed`] = row.closed_listings;
                        point[`${prefix}_acc`] = row.accumulated_listings;
                    }
                }
            }
            return point;
        });
}
