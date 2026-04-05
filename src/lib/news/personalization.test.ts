import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterArticlesByInterests, filterLocalArticlesByInterests, filterNationalArticlesByInterests } from "./personalization";

const { mockMakeGeminiCall } = vi.hoisted(() => ({
    mockMakeGeminiCall: vi.fn(),
}));

vi.mock("@/lib/news/gemini", () => ({
    makeGeminiCall: mockMakeGeminiCall,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeArticle(i: number) {
    return {
        title: `Article ${i}`,
        link: `https://example.com/${i}`,
        source: "Test Source",
        date: "2024-01-15",
        description: `Description ${i}`,
        tags: ["office"],
        counties: ["Suffolk"],
        cities: ["Boston"],
    };
}

const articles = [makeArticle(0), makeArticle(1), makeArticle(2)];

function geminiResponse(items: Array<{ index: number; rationale: string }>) {
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] };
}

// ─── filterArticlesByInterests ────────────────────────────────────────────────

describe("filterArticlesByInterests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.GEMINI_API_KEY;
    });

    it("returns articles unchanged when interests is empty string", async () => {
        const result = await filterArticlesByInterests(articles, "", 5, "filter-national-articles");
        expect(result).toBe(articles);
        expect(mockMakeGeminiCall).not.toHaveBeenCalled();
    });

    it("returns articles unchanged when interests is whitespace only", async () => {
        const result = await filterArticlesByInterests(articles, "   ", 5, "filter-national-articles");
        expect(result).toBe(articles);
        expect(mockMakeGeminiCall).not.toHaveBeenCalled();
    });

    it("returns articles unchanged when GEMINI_API_KEY is not set", async () => {
        const result = await filterArticlesByInterests(articles, "multifamily", 5, "filter-national-articles");
        expect(result).toBe(articles);
        expect(mockMakeGeminiCall).not.toHaveBeenCalled();
    });

    it("returns selected articles with rationales attached", async () => {
        process.env.GEMINI_API_KEY = "key";
        mockMakeGeminiCall.mockResolvedValue(
            geminiResponse([
                { index: 0, rationale: "Relevant to office interests" },
                { index: 2, rationale: "Covers multifamily trends" },
            ]),
        );
        const result = await filterArticlesByInterests(articles, "office", 5, "filter-national-articles");
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ title: "Article 0", rationale: "Relevant to office interests" });
        expect(result[1]).toMatchObject({ title: "Article 2", rationale: "Covers multifamily trends" });
    });

    it("filters out out-of-bounds indices", async () => {
        process.env.GEMINI_API_KEY = "key";
        mockMakeGeminiCall.mockResolvedValue(
            geminiResponse([
                { index: 0, rationale: "Good" },
                { index: 99, rationale: "Bad index" },
                { index: -1, rationale: "Negative index" },
            ]),
        );
        const result = await filterArticlesByInterests(articles, "office", 5, "filter-national-articles");
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Article 0");
    });

    it("caps results at maxArticles", async () => {
        process.env.GEMINI_API_KEY = "key";
        mockMakeGeminiCall.mockResolvedValue(
            geminiResponse([
                { index: 0, rationale: "A" },
                { index: 1, rationale: "B" },
                { index: 2, rationale: "C" },
            ]),
        );
        const result = await filterArticlesByInterests(articles, "office", 2, "filter-national-articles");
        expect(result).toHaveLength(2);
    });

    it("falls back to first maxArticles articles when Gemini throws", async () => {
        process.env.GEMINI_API_KEY = "key";
        mockMakeGeminiCall.mockRejectedValue(new Error("API error"));
        const result = await filterArticlesByInterests(articles, "office", 2, "filter-national-articles");
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe("Article 0");
        expect(result[1].title).toBe("Article 1");
    });

    it("preserves all original article fields alongside the rationale", async () => {
        process.env.GEMINI_API_KEY = "key";
        mockMakeGeminiCall.mockResolvedValue(geminiResponse([{ index: 1, rationale: "Good match" }]));
        const result = await filterArticlesByInterests(articles, "office", 5, "filter-national-articles");
        expect(result[0]).toMatchObject({
            ...articles[1],
            rationale: "Good match",
        });
    });
});

// ─── filterNationalArticlesByInterests ────────────────────────────────────────

describe("filterNationalArticlesByInterests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = "key";
    });

    it("uses the national prompt (no LOCAL keyword, correct operation)", async () => {
        mockMakeGeminiCall.mockResolvedValue(geminiResponse([{ index: 0, rationale: "Good" }]));
        await filterNationalArticlesByInterests(articles, "office", 5);
        expect(mockMakeGeminiCall).toHaveBeenCalledWith(
            expect.any(String),
            expect.not.stringContaining("LOCAL"),
            expect.objectContaining({ operation: "filter-national-articles" }),
        );
    });

    it("passes maxArticles to the prompt", async () => {
        mockMakeGeminiCall.mockResolvedValue(geminiResponse([{ index: 0, rationale: "Good" }]));
        await filterNationalArticlesByInterests(articles, "office", 3);
        expect(mockMakeGeminiCall).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("3"), expect.anything());
    });
});

// ─── filterLocalArticlesByInterests ──────────────────────────────────────────

describe("filterLocalArticlesByInterests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = "key";
    });

    it("uses the local prompt", async () => {
        mockMakeGeminiCall.mockResolvedValue(geminiResponse([{ index: 0, rationale: "Good" }]));
        await filterLocalArticlesByInterests(articles, "office", 5);
        expect(mockMakeGeminiCall).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining("LOCAL"),
            expect.objectContaining({ operation: "filter-local-articles" }),
        );
    });

    it("includes county and city preferences in the prompt", async () => {
        mockMakeGeminiCall.mockResolvedValue(geminiResponse([{ index: 0, rationale: "Good" }]));
        await filterLocalArticlesByInterests(articles, "office", 5, undefined, ["Suffolk"], ["Boston"]);
        expect(mockMakeGeminiCall).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("Suffolk"), expect.anything());
        expect(mockMakeGeminiCall).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("Boston"), expect.anything());
    });
});
