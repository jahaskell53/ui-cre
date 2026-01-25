"use client";

import { Badge } from "@/components/ui/badge";

interface PropertyPopupContentProps {
  name: string;
  address: string;
  price: string;
  units?: number | null;
  capRate?: string | null;
  squareFootage?: string | null;
  thumbnailUrl?: string | null;
}

export function PropertyPopupContent({
  name,
  address,
  price,
  units,
  capRate,
  squareFootage,
  thumbnailUrl
}: PropertyPopupContentProps) {
  return (
    <div className="p-0 w-[220px] bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-lg">
      {thumbnailUrl && (
        <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 overflow-hidden border-b border-gray-100 dark:border-gray-800">
          <img src={thumbnailUrl} className="w-full h-full object-cover" alt={name} />
        </div>
      )}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1 leading-tight line-clamp-2">
          {name}
        </h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 leading-tight truncate">
          {address}
        </p>
        
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
    </div>
  );
}
