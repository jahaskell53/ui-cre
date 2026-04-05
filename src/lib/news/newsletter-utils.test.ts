import { describe, expect, it } from "vitest";
import { generateEmailContentFromArticles, splitArticlesIntoNationalAndLocal } from "./newsletter-utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeArticle(
    overrides: {
        isNational?: boolean;
        tags?: string[];
        counties?: string[];
        cities?: string[];
    } = {},
) {
    return {
        isNational: false,
        tags: [],
        counties: [],
        cities: [],
        ...overrides,
    };
}

function makeFullArticle(
    overrides: Partial<{
        title: string;
        link: string;
        description: string;
        date: string;
        source: string;
        imageUrl: string;
        tags: string[];
        counties: string[];
        cities: string[];
        rationale: string;
    }> = {},
) {
    return {
        title: "Test Article",
        link: "https://example.com",
        description: "A test description.",
        date: "2024-01-15T12:00:00Z",
        source: "Test Source",
        ...overrides,
    };
}

// ─── splitArticlesIntoNationalAndLocal ───────────────────────────────────────

describe("splitArticlesIntoNationalAndLocal", () => {
    it("puts an isNational article with national tag into national section", () => {
        const article = makeArticle({ isNational: true, tags: ["national"] });
        const { nationalArticles, localArticles } = splitArticlesIntoNationalAndLocal([article]);
        expect(nationalArticles).toHaveLength(1);
        expect(localArticles).toHaveLength(1); // no locations selected → all local too
    });

    it("puts an isNational article with economy tag into national section", () => {
        const article = makeArticle({ isNational: true, tags: ["economy"] });
        const { nationalArticles } = splitArticlesIntoNationalAndLocal([article]);
        expect(nationalArticles).toHaveLength(1);
    });

    it("excludes isNational article that lacks national/economy tag from national section", () => {
        const article = makeArticle({ isNational: true, tags: ["retail"] });
        const { nationalArticles } = splitArticlesIntoNationalAndLocal([article]);
        expect(nationalArticles).toHaveLength(0);
    });

    it("excludes non-isNational article even if it has national tag", () => {
        const article = makeArticle({ isNational: false, tags: ["national"] });
        const { nationalArticles } = splitArticlesIntoNationalAndLocal([article]);
        expect(nationalArticles).toHaveLength(0);
    });

    it("matches local article by county", () => {
        const article = makeArticle({ counties: ["Providence"] });
        const { localArticles } = splitArticlesIntoNationalAndLocal([article], ["Providence"], []);
        expect(localArticles).toHaveLength(1);
    });

    it("matches local article by city", () => {
        const article = makeArticle({ cities: ["Boston"] });
        const { localArticles } = splitArticlesIntoNationalAndLocal([article], [], ["Boston"]);
        expect(localArticles).toHaveLength(1);
    });

    it("excludes local article that does not match selected county or city", () => {
        const article = makeArticle({ counties: ["Suffolk"], cities: ["Boston"] });
        const { localArticles } = splitArticlesIntoNationalAndLocal([article], ["Providence"], ["Providence"]);
        expect(localArticles).toHaveLength(0);
    });

    it("includes all articles as local when no locations are selected", () => {
        const articles = [makeArticle({ counties: ["Suffolk"] }), makeArticle({ cities: ["Boston"] }), makeArticle()];
        const { localArticles } = splitArticlesIntoNationalAndLocal(articles);
        expect(localArticles).toHaveLength(3);
    });

    it("an article can appear in both national and local sections", () => {
        const article = makeArticle({ isNational: true, tags: ["national"], counties: ["Providence"] });
        const { nationalArticles, localArticles } = splitArticlesIntoNationalAndLocal([article], ["Providence"]);
        expect(nationalArticles).toHaveLength(1);
        expect(localArticles).toHaveLength(1);
        expect(nationalArticles[0]).toBe(localArticles[0]);
    });

    it("returns empty arrays for empty input", () => {
        const { nationalArticles, localArticles } = splitArticlesIntoNationalAndLocal([]);
        expect(nationalArticles).toHaveLength(0);
        expect(localArticles).toHaveLength(0);
    });
});

// ─── generateEmailContentFromArticles ───────────────────────────────────────

describe("generateEmailContentFromArticles", () => {
    it("returns fallback paragraph when both arrays are empty", () => {
        const result = generateEmailContentFromArticles([], []);
        expect(result).toBe("<p>No new articles available.</p>");
    });

    it("includes National section header when national articles are provided", () => {
        const result = generateEmailContentFromArticles([makeFullArticle()], []);
        expect(result).toContain("National");
    });

    it("includes Local section header when local articles are provided", () => {
        const result = generateEmailContentFromArticles([], [makeFullArticle()]);
        expect(result).toContain("Local");
    });

    it("includes both section headers when both are provided", () => {
        const result = generateEmailContentFromArticles([makeFullArticle()], [makeFullArticle()]);
        expect(result).toContain("National");
        expect(result).toContain("Local");
    });

    it("omits National section header when no national articles", () => {
        const result = generateEmailContentFromArticles([], [makeFullArticle()]);
        expect(result).not.toContain("National");
    });

    it("truncates description longer than 400 characters", () => {
        const longDescription = "x".repeat(450);
        const result = generateEmailContentFromArticles([makeFullArticle({ description: longDescription })], []);
        expect(result).toContain("x".repeat(400) + "...");
        expect(result).not.toContain("x".repeat(401));
    });

    it("does not add ellipsis for descriptions at or under 400 characters", () => {
        const shortDescription = "Short description.";
        const result = generateEmailContentFromArticles([makeFullArticle({ description: shortDescription })], []);
        expect(result).toContain("Short description.");
        expect(result).not.toContain("Short description....");
    });

    it("renders tags as styled spans", () => {
        const result = generateEmailContentFromArticles([makeFullArticle({ tags: ["office", "industrial"] })], []);
        expect(result).toContain("office");
        expect(result).toContain("industrial");
    });

    it("renders county geographic tags with County: prefix", () => {
        const result = generateEmailContentFromArticles([makeFullArticle({ counties: ["Providence"] })], []);
        expect(result).toContain("County: Providence");
    });

    it("renders city geographic tags with City: prefix", () => {
        const result = generateEmailContentFromArticles([makeFullArticle({ cities: ["Boston"] })], []);
        expect(result).toContain("City: Boston");
    });

    it("renders rationale when provided", () => {
        const result = generateEmailContentFromArticles([makeFullArticle({ rationale: "Highly relevant to your interests." })], []);
        expect(result).toContain("Highly relevant to your interests.");
        expect(result).toContain("Why this article:");
    });

    it("omits rationale block when not provided", () => {
        const result = generateEmailContentFromArticles([makeFullArticle()], []);
        expect(result).not.toContain("Why this article:");
    });

    it("renders article title as a link", () => {
        const result = generateEmailContentFromArticles([makeFullArticle({ title: "Big CRE Deal", link: "https://example.com/article" })], []);
        expect(result).toContain('<a href="https://example.com/article"');
        expect(result).toContain("Big CRE Deal");
    });
});
