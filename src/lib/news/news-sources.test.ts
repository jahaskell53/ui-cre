import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterArticlesBeforeLastWeek, filterArticlesByDate, sanitizeImageUrl } from "./news-sources";

// ─── sanitizeImageUrl ────────────────────────────────────────────────────────

describe("sanitizeImageUrl", () => {
    it("returns empty string for undefined", () => {
        expect(sanitizeImageUrl(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
        expect(sanitizeImageUrl("")).toBe("");
    });

    it("returns URL unchanged when there is no query string", () => {
        expect(sanitizeImageUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
    });

    it("strips query string from URL", () => {
        expect(sanitizeImageUrl("https://example.com/image.jpg?w=800&h=600")).toBe("https://example.com/image.jpg");
    });

    it("strips everything after the first question mark", () => {
        expect(sanitizeImageUrl("https://example.com/img?token=abc?extra=1")).toBe("https://example.com/img");
    });
});

// ─── filterArticlesByDate ────────────────────────────────────────────────────

describe("filterArticlesByDate", () => {
    const beforeDate = new Date("2024-01-15T00:00:00Z");

    it("returns empty array for empty input", () => {
        expect(filterArticlesByDate([], beforeDate)).toEqual([]);
    });

    it("includes articles published before the cutoff date", () => {
        const articles = [{ date: "2024-01-10T00:00:00Z" }];
        expect(filterArticlesByDate(articles, beforeDate)).toHaveLength(1);
    });

    it("excludes articles published on or after the cutoff date", () => {
        const articles = [
            { date: "2024-01-15T00:00:00Z" }, // exactly at cutoff — excluded
            { date: "2024-01-20T00:00:00Z" }, // after cutoff — excluded
        ];
        expect(filterArticlesByDate(articles, beforeDate)).toHaveLength(0);
    });

    it("filters mixed articles correctly", () => {
        const articles = [
            { date: "2024-01-10T00:00:00Z" }, // before — included
            { date: "2024-01-15T00:00:00Z" }, // at cutoff — excluded
            { date: "2024-01-20T00:00:00Z" }, // after — excluded
        ];
        const result = filterArticlesByDate(articles, beforeDate);
        expect(result).toHaveLength(1);
        expect(result[0].date).toBe("2024-01-10T00:00:00Z");
    });
});

// ─── filterArticlesBeforeLastWeek ────────────────────────────────────────────

describe("filterArticlesBeforeLastWeek", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns empty array for empty input", () => {
        expect(filterArticlesBeforeLastWeek([])).toEqual([]);
    });

    it("includes articles published within the last 7 days", () => {
        const articles = [{ date: "2024-01-10T12:00:00Z" }]; // 5 days ago
        expect(filterArticlesBeforeLastWeek(articles)).toHaveLength(1);
    });

    it("excludes articles older than 7 days", () => {
        const articles = [{ date: "2024-01-07T11:59:59Z" }]; // just over 7 days ago
        expect(filterArticlesBeforeLastWeek(articles)).toHaveLength(0);
    });

    it("excludes articles published in the future", () => {
        const articles = [{ date: "2024-01-16T12:00:00Z" }]; // tomorrow
        expect(filterArticlesBeforeLastWeek(articles)).toHaveLength(0);
    });

    it("includes articles published right now", () => {
        const articles = [{ date: "2024-01-15T12:00:00Z" }]; // exactly now
        expect(filterArticlesBeforeLastWeek(articles)).toHaveLength(1);
    });

    it("filters mixed articles correctly", () => {
        const articles = [
            { date: "2024-01-07T11:59:59Z" }, // too old — excluded
            { date: "2024-01-10T12:00:00Z" }, // 5 days ago — included
            { date: "2024-01-15T12:00:00Z" }, // now — included
            { date: "2024-01-16T12:00:00Z" }, // future — excluded
        ];
        const result = filterArticlesBeforeLastWeek(articles);
        expect(result).toHaveLength(2);
    });
});
