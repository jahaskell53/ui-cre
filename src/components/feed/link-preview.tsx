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
            <div className="border border-secondary rounded-xl p-4 bg-secondary/20 animate-pulse">
                <div className="h-4 bg-secondary rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-secondary rounded w-1/2"></div>
            </div>
        );
    }

    if (preview) {
        return (
            <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-secondary rounded-xl overflow-hidden hover:border-tertiary transition-colors group"
            >
                {preview.image && (
                    <div className="w-full bg-secondary relative overflow-hidden p-4">
                        <img
                            src={preview.image}
                            alt={preview.title}
                            className="w-full max-h-60 object-contain mx-auto"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    </div>
                )}
                <div className="p-4">
                    {preview.siteName && (
                        <div className="text-xs text-tertiary uppercase tracking-wide mb-1">
                            {preview.siteName}
                        </div>
                    )}
                    <h4 className="text-lg font-semibold text-primary mb-2 group-hover:text-brand-solid transition-colors">
                        {preview.title || preview.url}
                    </h4>
                    {preview.description && (
                        <p className="text-sm text-secondary line-clamp-2 mb-2">
                            {preview.description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-tertiary">
                        <ArrowUpRight className="w-3 h-3" />
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
                className="block border border-secondary rounded-xl p-4 hover:border-tertiary transition-colors group"
            >
                <div className="flex items-center gap-2 text-primary group-hover:text-brand-solid transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="truncate">{fallbackUrl}</span>
                </div>
            </a>
        );
    }

    return null;
};
