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

export function PropertyPopupContent({
  name,
  address,
  price,
  units,
  capRate,
  squareFootage,
  thumbnailUrl,
  isReit,
  unitMix,
  href,
}: PropertyPopupContentProps) {
  const Wrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <a href={href} className="block p-0 w-[240px] bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg hover:border-blue-400 transition-colors cursor-pointer">
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="p-0 w-[240px] bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
          {children}
        </div>
      );
  return (
    <Wrapper>
      {thumbnailUrl && (
        <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 overflow-hidden border-b border-gray-100 dark:border-gray-800">
          <img src={thumbnailUrl} className="w-full h-full object-cover" alt={name} />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 flex-1">
            {name}
          </h3>
          {isReit && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded flex-shrink-0 mt-0.5">
              REIT
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 leading-tight truncate">
          {address}
        </p>

        {unitMix && unitMix.length > 0 ? (
          <div className="mt-1">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-0.5">Type</th>
                  <th className="text-right font-medium pb-0.5">Units</th>
                  <th className="text-right font-medium pb-0.5">Avg Rent</th>
                </tr>
              </thead>
              <tbody>
                {unitMix.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-0.5 text-gray-700">
                      {(row.beds ?? 0)}bd · {row.baths != null ? Number(row.baths).toFixed(1) : '?'}ba
                    </td>
                    <td className="py-0.5 text-right text-gray-600">{row.count}</td>
                    <td className="py-0.5 text-right font-medium text-gray-900">
                      {row.avgPrice ? `$${Math.round(row.avgPrice).toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-2">
            {units && units > 0 ? (
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                {units} Units
              </span>
            ) : <span />}
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {price}
            </span>
          </div>
        )}

        {(capRate || squareFootage) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {capRate && (
              <Badge className="text-[11px] font-semibold px-2 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-0">
                {capRate}
              </Badge>
            )}
            {squareFootage && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                {squareFootage}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Wrapper>
  );
}
