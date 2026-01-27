"use client";

import { useState, useEffect } from "react";
import { usePageTour } from "@/hooks/use-page-tour";
import { Newspaper, ExternalLink, Calendar, MapPin, Settings, Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";

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
          dateRange: selectedDateRange
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
    <div className="relative flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-8 p-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              CRE News
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Commercial real estate news personalized for your markets
            </p>
          </div>
          <div className="flex gap-3">
            {isRegistered === null ? null : isRegistered ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                <Check className="size-4 text-green-600 dark:text-green-400" />
                <span>Subscribed</span>
              </div>
            ) : (
              <Link href="/news/register">
                <Button data-tour="news-register" className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
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
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="flex-1 pl-10 pr-40 py-2.5 border border-gray-200 dark:border-gray-800 rounded-l-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />

            {/* Time Period Dropdown */}
            <div className="relative">
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="absolute inset-y-0 right-0 w-28 pr-2 py-2 border border-gray-200 dark:border-gray-800 border-l-0 rounded-r-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm text-right focus:outline-none appearance-none cursor-pointer"
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
                className="absolute inset-y-0 right-32 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isCurrentlyLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className="text-gray-500 dark:text-gray-400">{isSearching ? "Searching with AI..." : "Loading articles..."}</div>
          </div>
        ) : displayArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Newspaper className="size-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {isSearchMode ? "No search results" : "No articles yet"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
              {isSearchMode
                ? "Try adjusting your search terms or date range."
                : "Configure your newsletter preferences to see personalized CRE news for your markets."}
            </p>
            {!isSearchMode && (
              <Link href="/news/settings">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                  <Settings className="size-4" />
                  Set Up Preferences
                </Button>
              </Link>
            )}
            {isSearchMode && (
              <Button variant="outline" onClick={() => {
                setSearchQuery("");
                setIsSearchMode(false);
                setSearchResults([]);
              }}>
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {isSearchMode && (
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Search Results for "{searchQuery}"
                </h2>
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearchQuery("");
                  setIsSearchMode(false);
                  setSearchResults([]);
                }}>
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
                className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-sm overflow-hidden"
              >
                <div className="flex gap-4 min-w-0">
                  <div className="shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                      src={article.image_url && article.image_url !== "null" && article.image_url !== "undefined" ? article.image_url : "/placeholder.jpg"}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/placeholder.jpg";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 min-w-0 flex-1">
                        {article.title}
                      </h3>
                      <ExternalLink className="size-4 shrink-0 text-gray-400" />
                    </div>
                    {article.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {article.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
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
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {article.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full"
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
