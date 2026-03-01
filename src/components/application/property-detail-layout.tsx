"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface PropertyDetailLayoutProps {
    backHref: string;
    title: string;
    subtitle: ReactNode;
    headerBadge: ReactNode;
    hero: ReactNode;
    banner?: ReactNode;
    children: ReactNode;
}

export function PropertyDetailLayout({
    backHref,
    title,
    subtitle,
    headerBadge,
    hero,
    banner,
    children,
}: PropertyDetailLayoutProps) {
    const router = useRouter();

    const handleBackClick = (e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else {
            router.push(backHref);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-auto">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
                <Link
                    href={backHref}
                    onClick={handleBackClick}
                    className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer mb-4"
                >
                    <ChevronLeft className="size-4" />
                    Back
                </Link>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">{subtitle}</p>
                    </div>
                    {headerBadge}
                </div>
            </div>

            {/* Hero */}
            <div className="px-6 max-w-4xl mx-auto w-full">
                {hero}
            </div>

            {/* Optional banner */}
            {banner != null ? (
                <div className="px-6 max-w-4xl mx-auto w-full">
                    {banner}
                </div>
            ) : null}

            {/* Detail sections */}
            <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
