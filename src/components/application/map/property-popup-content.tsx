"use client";

import { Badge } from "@/components/ui/badge";
import type { UnitMixRow } from "./property-map";

interface PropertyPopupContentProps {
    name: string;
    address: string;
    price: string;
    units?: number | null;
    capRate?: string | null;
    squareFootage?: string | null;
    thumbnailUrl?: string | null;
    isReit?: boolean;
    unitMix?: UnitMixRow[];
    href?: string;
}

export function PropertyPopupContent({ name, address, price, units, capRate, squareFootage, thumbnailUrl, isReit, unitMix, href }: PropertyPopupContentProps) {
    const Wrapper = href
        ? ({ children }: { children: React.ReactNode }) => (
              <a
                  href={href}
                  className="block w-[240px] cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-0 shadow-lg transition-colors hover:border-blue-400 dark:border-gray-800 dark:bg-gray-900"
              >
                  {children}
              </a>
          )
        : ({ children }: { children: React.ReactNode }) => (
              <div className="w-[240px] overflow-hidden rounded-lg border border-gray-200 bg-white p-0 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  {children}
              </div>
          );
    return (
        <Wrapper>
            {thumbnailUrl && (
                <div className="h-24 w-full overflow-hidden border-b border-gray-100 bg-gray-100 dark:border-gray-800 dark:bg-gray-800">
                    <img src={thumbnailUrl} className="h-full w-full object-cover" alt={name} />
                </div>
            )}
            <div className="p-3">
                <div className="mb-1 flex items-start justify-between gap-1.5">
                    <h3 className="line-clamp-2 flex-1 text-sm leading-tight font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
                    {isReit && <span className="mt-0.5 flex-shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">REIT</span>}
                </div>
                <p className="mb-2 truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400">{address}</p>

                {unitMix && unitMix.length > 0 ? (
                    <div className="mt-1">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-400">
                                    <th className="pb-0.5 text-left font-medium">Type</th>
                                    <th className="pb-0.5 text-right font-medium">Units</th>
                                    <th className="pb-0.5 text-right font-medium">Avg Rent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unitMix.map((row, i) => (
                                    <tr key={i} className="border-b border-gray-50 last:border-0">
                                        <td className="py-0.5 text-gray-700">
                                            {row.beds ?? 0}bd · {row.baths != null ? Number(row.baths).toFixed(1) : "?"}ba
                                        </td>
                                        <td className="py-0.5 text-right text-gray-600">{row.count}</td>
                                        <td className="py-0.5 text-right font-medium text-gray-900">
                                            {row.avgPrice ? `$${Math.round(row.avgPrice).toLocaleString()}` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mb-2 flex items-center justify-between">
                        {units && units > 0 ? <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{units} Units</span> : <span />}
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{price}</span>
                    </div>
                )}

                {(capRate || squareFootage) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {capRate && (
                            <Badge className="border-0 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-gray-900">
                                {capRate}
                            </Badge>
                        )}
                        {squareFootage && (
                            <Badge
                                variant="outline"
                                className="border-gray-200 bg-gray-50 px-1.5 py-0 text-[9px] text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            >
                                {squareFootage}
                            </Badge>
                        )}
                    </div>
                )}
            </div>
        </Wrapper>
    );
}
