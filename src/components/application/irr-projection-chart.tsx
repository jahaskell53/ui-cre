"use client";

export interface IrrProjectionPoint {
    year: number;
    irr: number;
}

interface IrrProjectionChartProps {
    /** Current/base IRR % (used to generate projection) */
    currentIrr: number;
    /** Number of years to project (default 5) */
    years?: number;
    className?: string;
    /** Chart height in pixels */
    height?: number;
}

/** Generates mock IRR projection over time (slight upward trend from current) */
function buildProjection(currentIrr: number, years: number): IrrProjectionPoint[] {
    return Array.from({ length: years }, (_, i) => ({
        year: i + 1,
        irr: Math.round((currentIrr + i * 0.4 + (i > 0 ? 0.2 : 0)) * 10) / 10,
    }));
}

const PAD = { top: 8, right: 8, bottom: 24, left: 36 };

export function IrrProjectionChart({
    currentIrr,
    years = 5,
    className = "",
    height = 160,
}: IrrProjectionChartProps) {
    const data = buildProjection(currentIrr, years);
    const width = 280;
    const innerWidth = width - PAD.left - PAD.right;
    const innerHeight = height - PAD.top - PAD.bottom;

    const irrMin = Math.min(...data.map((d) => d.irr));
    const irrMax = Math.max(...data.map((d) => d.irr));
    const yPadding = (irrMax - irrMin) * 0.15 || 1;
    const yMin = Math.floor(irrMin - yPadding);
    const yMax = Math.ceil(irrMax + yPadding);

    const xScale = (year: number) => PAD.left + ((year - 1) / (years - 1 || 1)) * innerWidth;
    const yScale = (irr: number) => PAD.top + innerHeight - ((irr - yMin) / (yMax - yMin)) * innerHeight;

    const pathD = data
        .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.year)} ${yScale(d.irr)}`)
        .join(" ");

    return (
        <div className={className}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">IRR projection</p>
            <svg
                width={width}
                height={height}
                className="overflow-visible"
                aria-label="IRR over time"
            >
                {/* Y axis labels */}
                {[yMin, (yMin + yMax) / 2, yMax].map((v) => (
                    <text
                        key={v}
                        x={PAD.left - 6}
                        y={yScale(v)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="fill-gray-500 dark:fill-gray-400 text-[10px]"
                    >
                        {v}%
                    </text>
                ))}
                {/* X axis labels */}
                {data.map((d) => (
                    <text
                        key={d.year}
                        x={xScale(d.year)}
                        y={height - 6}
                        textAnchor="middle"
                        className="fill-gray-500 dark:fill-gray-400 text-[10px]"
                    >
                        Y{d.year}
                    </text>
                ))}
                {/* Line */}
                <path
                    d={pathD}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-500 dark:text-blue-400"
                />
                {/* Dots at data points */}
                {data.map((d) => (
                    <circle
                        key={d.year}
                        cx={xScale(d.year)}
                        cy={yScale(d.irr)}
                        r={3}
                        className="fill-blue-500 dark:fill-blue-400"
                    />
                ))}
            </svg>
        </div>
    );
}
