"use client";

import { useState, useEffect } from "react";
import { Newspaper, ExternalLink, Calendar, MapPin, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-8 p-6">
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
            <Link href="/news/settings">
              <Button variant="outline">
                <Settings className="size-4" />
                Preferences
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading articles...</div>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Newspaper className="size-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No articles yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
              Configure your newsletter preferences to see personalized CRE news for your markets.
            </p>
            <Link href="/news/settings">
              <Button>
                <Settings className="size-4" />
                Set Up Preferences
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {articles.map((article) => (
              <a
                key={article.id}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="flex gap-4">
                  {article.image_url && (
                    <div className="shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <img
                        src={article.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
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
                      <span className="font-medium">{article.source_name}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(article.date)}
                      </span>
                      {article.counties.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {article.counties.slice(0, 2).join(", ")}
                          {article.counties.length > 2 && ` +${article.counties.length - 2}`}
                        </span>
                      )}
                    </div>
                    {article.tags.length > 0 && (
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
    </div>
  );
}
