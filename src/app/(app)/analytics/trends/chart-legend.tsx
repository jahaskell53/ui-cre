"use client";

interface LegendPayloadItem {
    dataKey?: string;
    value: string;
    color: string;
}

interface Props {
    payload?: LegendPayloadItem[];
    dashMap: Record<string, string>;
}

export function ChartLegend({ payload, dashMap }: Props) {
    if (!payload?.length) return null;
    return (
        <div
            className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2"
            style={{ fontSize: 12 }}
        >
            {payload.map((entry, i) => {
                const dash = dashMap[entry.dataKey ?? ""] ?? "";
                return (
                    <div key={i} className="flex items-center gap-1.5">
                        <svg width={28} height={12} style={{ flexShrink: 0 }}>
                            <line
                                x1={1}
                                y1={6}
                                x2={27}
                                y2={6}
                                stroke={entry.color}
                                strokeWidth={2}
                                strokeDasharray={dash || undefined}
                            />
                        </svg>
                        <span className="text-gray-600 dark:text-gray-400">{entry.value}</span>
                    </div>
                );
            })}
        </div>
    );
}
