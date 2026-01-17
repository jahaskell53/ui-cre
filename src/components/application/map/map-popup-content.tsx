"use client";

import { Badge } from "@/components/ui/badge";

interface MapPopupContentProps {
  personName: string;
  category?: string | null;
  label: "Home" | "Owned";
  address: string;
}

export function MapPopupContent({ personName, category, label, address }: MapPopupContentProps) {
  return (
    <div className="p-3 w-[240px] bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2 leading-tight">
        {personName}
      </div>
      {category && (
        <div className="mb-2">
          <Badge
            variant="secondary"
            className="text-xs font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
          >
            {category}
          </Badge>
        </div>
      )}
      <div className="mb-2">
        <Badge
          variant="secondary"
          className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
        >
          {label}
        </Badge>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
        {address}
      </div>
    </div>
  );
}

