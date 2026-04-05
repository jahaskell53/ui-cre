"use client";

import { useEffect, useState } from "react";
import { Calendar, Check, ExternalLink, MapPin, Newspaper, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { usePageTour } from "@/hooks/use-page-tour";

interface Article {
    id: string;
    title: string;
    link: string;
    description: string | null;
    image_url: string | null;
    date: string;
    source_name: string;
    counties: string[];
    tags: string[];
}

const placeholderQueries = [
    "What's happening with office space in South Bay?",
    "Sea-level rise's impact on real estate in Miami",
    "How is the mortgage rate affecting real estate?",
    "Retail store closures in downtown SF this month",
    "High-rise apartment construction in Brooklyn",
    "Industrial warehouse construction projects in Bay Area",
    "Multifamily development in Aurora IL",
    "Commercial property investment opportunities in Las Vegas",
];

export default function NewsPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

    // Search states
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchResults, setSearchResults] = useState<Article[]>([]);
    const [isSearchMode, setIsSearchMode] = useState<boolean>(false);
    const [selectedDateRange, setSelectedDateRange] = useState<string>("last-week");
    const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
    const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
    const [isTourOpen, setIsTourOpen] = useState(false);

    // Listen for tour trigger from sidebar
    usePageTour(() => setIsTourOpen(true));

    useEffect(() => {
        fetchArticles();
        checkRegistrationStatus();
    }, []);

    const checkRegistrationStatus = async () => {
        try {
            const response = await fetch("/api/news/preferences");
            if (response.ok) {
                const data = await response.json();
                setIsRegistered(data.newsletter_active || false);
            } else {
                setIsRegistered(false);
            }
        } catch (error) {
            console.error("Failed to check registration status:", error);
            setIsRegistered(false);
        }
    };

    // Rotate placeholder queries every 3 seconds, only when input is empty and not focused
    useEffect(() => {
        if (isInputFocused || searchQuery !== "") {
            return;
        }

        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholderQueries.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [isInputFocused, searchQuery]);

    const fetchArticles = async () => {
        try {
            const response = await fetch("/api/news/articles");
            if (response.ok) {
                const data = await response.json();
                setArticles(data);
            }
        } catch (error) {
            console.error("Failed to fetch articles:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setIsSearchMode(false);
            return;
        }

        setIsSearching(true);
        setIsSearchMode(true);

        try {
            const response = await fetch("/api/news/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: searchQuery,
                    dateRange: selectedDateRange,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSearchResults(data.articles);
            } else {
                console.error("Search failed");
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Search error:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const displayArticles = isSearchMode ? searchResults : articles;
    const isCurrentlyLoading = isLoading || isSearching;

    const tourSteps: TourStep[] = [
        {
            id: "news-search",
            target: '[data-tour="news-search"]',
            title: "Search News",
            content: "Search for specific real estate news topics. Use natural language queries like 'office space in South Bay' or 'mortgage rates'.",
            position: "bottom",
        },
        {
            id: "news-articles",
            target: '[data-tour="news-articles"]',
            title: "Browse Articles",
            content: "View personalized news articles based on your preferences. Click any article to read the full story.",
            position: "top",
        },
        {
            id: "news-register",
            target: '[data-tour="news-register"]',
            title: "Newsletter Registration",
            content: "Register for personalized newsletters to receive curated news based on your interests and markets.",
            position: "bottom",
        },
    ];

    return (
        <div className="relative flex h-full flex-col overflow-auto bg-white dark:bg-gray-900">
            <div className="flex max-w-full flex-col gap-8 overflow-x-hidden p-6">
                {/* Header */}
                <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">CRE News</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Commercial real estate news personalized for your markets</p>
                    </div>
                    <div className="flex gap-3">
                        {isRegistered === null ? null : isRegistered ? (
                            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                <Check className="size-4 text-green-600 dark:text-green-400" />
                                <span>Subscribed</span>
                            </div>
                        ) : (
                            <Link href="/news/register">
                                <Button
                                    data-tour="news-register"
                                    className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                                >
                                    Register for Newsletter
                                </Button>
                            </Link>
                        )}
                        {isRegistered === true && (
                            <Link href="/news/settings">
                                <Button variant="outline">
                                    <Settings className="size-4" />
                                    Preferences
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="max-w-2xl">
                    <div data-tour="news-search" className="relative flex">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-5 w-5 text-gray-400" strokeWidth={2} />
                        </div>
                        <input
                            type="text"
                            placeholder={placeholderQueries[placeholderIndex]}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleSearch();
                                }
                            }}
                            className="flex-1 rounded-l-lg border border-gray-200 bg-white py-2.5 pr-40 pl-10 text-gray-900 placeholder-gray-500 transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                        />

                        {/* Time Period Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedDateRange}
                                onChange={(e) => setSelectedDateRange(e.target.value)}
                                className="absolute inset-y-0 right-0 w-28 cursor-pointer appearance-none rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 py-2 pr-2 text-right text-sm text-gray-700 focus:outline-none dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            >
                                <option value="last-week">Last Week</option>
                                <option value="last-month">Last Month</option>
                                <option value="last-3-months">Last 3 Months</option>
                                <option value="last-year">Last Year</option>
                                <option value="all">All Time</option>
                            </select>
                        </div>

                        {(isSearchMode || searchQuery) && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setIsSearchMode(false);
                                    setSearchResults([]);
                                }}
                                className="absolute inset-y-0 right-32 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                                title="Clear search"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {isCurrentlyLoading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                        <div className="text-gray-500 dark:text-gray-400">{isSearching ? "Searching with AI..." : "Loading articles..."}</div>
                    </div>
                ) : displayArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Newspaper className="mb-4 size-12 text-gray-300 dark:text-gray-600" />
                        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">{isSearchMode ? "No search results" : "No articles yet"}</h3>
                        <p className="mb-4 max-w-md text-sm text-gray-500 dark:text-gray-400">
                            {isSearchMode
                                ? "Try adjusting your search terms or date range."
                                : "Configure your newsletter preferences to see personalized CRE news for your markets."}
                        </p>
                        {!isSearchMode && (
                            <Link href="/news/settings">
                                <Button className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                                    <Settings className="size-4" />
                                    Set Up Preferences
                                </Button>
                            </Link>
                        )}
                        {isSearchMode && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearchQuery("");
                                    setIsSearchMode(false);
                                    setSearchResults([]);
                                }}
                            >
                                Clear Search
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {isSearchMode && (
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Search Results for "{searchQuery}"</h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setIsSearchMode(false);
                                        setSearchResults([]);
                                    }}
                                >
                                    Clear Search
                                </Button>
                            </div>
                        )}
                        {displayArticles.map((article, index) => (
                            <a
                                key={article.id}
                                href={article.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-tour={index === 0 ? "news-articles" : undefined}
                                className="block overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                            >
                                <div className="flex min-w-0 gap-4">
                                    <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                                        <img
                                            src={
                                                article.image_url && article.image_url !== "null" && article.image_url !== "undefined"
                                                    ? article.image_url
                                                    : "/placeholder.jpg"
                                            }
                                            alt=""
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = "/placeholder.jpg";
                                            }}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <div className="flex min-w-0 items-start justify-between gap-2">
                                            <h3 className="line-clamp-2 min-w-0 flex-1 font-semibold text-gray-900 dark:text-gray-100">{article.title}</h3>
                                            <ExternalLink className="size-4 shrink-0 text-gray-400" />
                                        </div>
                                        {article.description && (
                                            <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{article.description}</p>
                                        )}
                                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                                            <span className="font-medium text-gray-600 dark:text-gray-300">{article.source_name}</span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="size-3" />
                                                {formatDate(article.date)}
                                            </span>
                                            {article.counties && article.counties.length > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="size-3" />
                                                    {article.counties.slice(0, 2).join(", ")}
                                                    {article.counties.length > 2 && ` +${article.counties.length - 2}`}
                                                </span>
                                            )}
                                        </div>
                                        {article.tags && article.tags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {article.tags.slice(0, 4).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* Guided Tour */}
            <GuidedTour
                steps={tourSteps}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                onComplete={() => {
                    console.log("News tour completed!");
                }}
            />
        </div>
    );
}
