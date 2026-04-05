"use client";

import { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PropertyDetailLayoutProps {
    backHref?: string;
    title: string;
    subtitle: ReactNode;
    headerBadge: ReactNode;
    hero: ReactNode;
    banner?: ReactNode;
    children: ReactNode;
}

export function PropertyDetailLayout({ backHref, title, subtitle, headerBadge, hero, banner, children }: PropertyDetailLayoutProps) {
    const router = useRouter();

    const handleBackClick = (e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else if (backHref) {
            router.push(backHref);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                {backHref && (
                    <Link
                        href={backHref}
                        onClick={handleBackClick}
                        className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <ChevronLeft className="size-4" />
                        Back
                    </Link>
                )}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">{subtitle}</p>
                    </div>
                    {headerBadge}
                </div>
            </div>

            {/* Hero */}
            <div className="mx-auto w-full max-w-4xl px-6">{hero}</div>

            {/* Optional banner */}
            {banner != null ? <div className="mx-auto w-full max-w-4xl px-6">{banner}</div> : null}

            {/* Detail sections */}
            <div className="mx-auto w-full max-w-4xl flex-1 p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>
            </div>
        </div>
    );
}
