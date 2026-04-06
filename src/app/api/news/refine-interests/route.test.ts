import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockMakeGeminiCall, mockFrom } = vi.hoisted(() => ({
    mockMakeGeminiCall: vi.fn(),
    mockFrom: vi.fn(),
}));

vi.mock("@/lib/news/gemini", () => ({
    makeGeminiCall: mockMakeGeminiCall,
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/news/refine-interests", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function geminiReturns(json: unknown) {
    mockMakeGeminiCall.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
    });
}

describe("POST /api/news/refine-interests — validation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 400 when action is missing", async () => {
        const res = await POST(makePost({ interests: "multifamily" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when interests is missing", async () => {
        const res = await POST(makePost({ action: "ask-questions" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 for unknown action", async () => {
        process.env.GEMINI_API_KEY = "test-key";
        const res = await POST(makePost({ action: "unknown", interests: "multifamily" }));
        expect(res.status).toBe(400);
    });

    it("returns 500 when GEMINI_API_KEY is not set", async () => {
        delete process.env.GEMINI_API_KEY;
        const res = await POST(makePost({ action: "ask-questions", interests: "multifamily" }));
        expect(res.status).toBe(500);
    });
});

describe("POST /api/news/refine-interests — ask-questions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = "test-key";
    });

    it("returns questions array", async () => {
        geminiReturns({ questions: ["Q1?", "Q2?", "Q3?"] });

        const res = await POST(makePost({ action: "ask-questions", interests: "multifamily Boston" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.questions).toEqual(["Q1?", "Q2?", "Q3?"]);
    });
});

describe("POST /api/news/refine-interests — enhance-description", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = "test-key";
    });

    it("returns 400 when conversation is missing", async () => {
        const res = await POST(makePost({ action: "enhance-description", interests: "multifamily" }));
        expect(res.status).toBe(400);
    });

    it("returns preferences array", async () => {
        geminiReturns({ preferences: ["Pref 1", "Pref 2"] });

        const res = await POST(
            makePost({
                action: "enhance-description",
                interests: "multifamily",
                conversation: [{ question: "What type?", answer: "Industrial" }],
            }),
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.preferences).toEqual(["Pref 1", "Pref 2"]);
    });
});

describe("POST /api/news/refine-interests — determine-counties", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = "test-key";
    });

    it("returns 400 when conversation is missing", async () => {
        const res = await POST(makePost({ action: "determine-counties", interests: "multifamily", preferences: ["Pref"] }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when preferences is missing", async () => {
        const res = await POST(
            makePost({
                action: "determine-counties",
                interests: "multifamily",
                conversation: [{ question: "Q", answer: "A" }],
            }),
        );
        expect(res.status).toBe(400);
    });

    it("returns counties array", async () => {
        const mockEq = vi.fn().mockResolvedValue({ data: [{ name: "Suffolk" }, { name: "Middlesex" }], error: null });
        const mockOrder = vi.fn().mockReturnValue({ ...vi.fn().mockResolvedValue({ data: [{ name: "Suffolk" }], error: null }) });
        const mockSelectCounties = vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ name: "Suffolk" }, { name: "Middlesex" }], error: null }),
        });
        mockFrom.mockReturnValue({ select: mockSelectCounties });

        geminiReturns({ counties: ["Suffolk"] });

        const res = await POST(
            makePost({
                action: "determine-counties",
                interests: "multifamily",
                conversation: [{ question: "Where?", answer: "Boston area" }],
                preferences: ["Multifamily in Suffolk County"],
            }),
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.counties).toEqual(["Suffolk"]);
    });

    it("returns 500 when county DB fetch fails", async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
        });

        const res = await POST(
            makePost({
                action: "determine-counties",
                interests: "multifamily",
                conversation: [{ question: "Q", answer: "A" }],
                preferences: ["Pref"],
            }),
        );
        expect(res.status).toBe(500);
    });
});
