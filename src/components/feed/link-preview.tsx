import { ArrowUpRight } from "lucide-react";

export interface LinkPreview {
    title: string;
    description: string;
    image: string;
    siteName: string;
    url: string;
}

interface LinkPreviewProps {
    preview: LinkPreview | null;
    isLoading: boolean;
    fallbackUrl?: string;
}

export const LinkPreviewCard = ({ preview, isLoading, fallbackUrl }: LinkPreviewProps) => {
    if (isLoading) {
        return (
            <div className="animate-pulse rounded-xl border border-gray-200 bg-gray-100 p-4 dark:border-gray-800 dark:bg-gray-800">
                <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
        );
    }

    if (preview) {
        return (
            <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-xl border border-gray-200 transition-all hover:border-gray-900 hover:shadow-sm dark:border-gray-800 dark:hover:border-gray-100"
            >
                {preview.image && (
                    <div className="relative w-full overflow-hidden bg-gray-100 p-4 dark:bg-gray-800">
                        <img
                            src={preview.image}
                            alt={preview.title}
                            className="mx-auto max-h-60 w-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    </div>
                )}
                <div className="p-4">
                    {preview.siteName && <div className="mb-1 text-xs tracking-wide text-gray-500 uppercase dark:text-gray-400">{preview.siteName}</div>}
                    <h4 className="mb-2 text-sm font-semibold text-gray-900 transition-colors group-hover:underline dark:text-gray-100">
                        {preview.title || preview.url}
                    </h4>
                    {preview.description && <p className="mb-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{preview.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <ArrowUpRight className="h-3 w-3" />
                        <span className="truncate">
                            {(() => {
                                try {
                                    return new URL(preview.url).hostname;
                                } catch {
                                    return preview.url;
                                }
                            })()}
                        </span>
                    </div>
                </div>
            </a>
        );
    }

    if (fallbackUrl) {
        return (
            <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-900 hover:shadow-sm dark:border-gray-800 dark:hover:border-gray-100"
            >
                <div className="flex items-center gap-2 text-gray-900 transition-colors group-hover:underline dark:text-gray-100">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="truncate">{fallbackUrl}</span>
                </div>
            </a>
        );
    }

    return null;
};
