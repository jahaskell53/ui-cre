import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "@/hooks/use-user";
import FeedPage from "./page";

// Mock dependencies
vi.mock("@/hooks/use-user");
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
    usePathname: () => "/",
}));
vi.mock("next/dynamic", () => ({
    default: () => () => <div>PDF Viewer</div>,
}));

const mockUser = {
    id: "user-123",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
} as any;

const mockProfile = {
    id: "user-123",
    full_name: "Test User",
    avatar_url: null,
    website: null,
    roles: null,
    is_admin: null,
    theme_preference: null,
    updated_at: null,
    tour_visited_pages: null,
};

describe("FeedPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useUser).mockReturnValue({
            user: mockUser,
            profile: mockProfile,
            loading: false,
            refreshProfile: vi.fn(),
        });
    });

    it("should load posts on mount", async () => {
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("/api/posts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([]),
                });
            }
            if (url.includes("/api/notifications")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([]),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }) as any;

        render(<FeedPage />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/posts"), expect.anything());
        });
    });

    it("should handle loading state", () => {
        vi.mocked(useUser).mockReturnValue({
            user: mockUser,
            profile: mockProfile,
            loading: true,
            refreshProfile: vi.fn(),
        });

        global.fetch = vi.fn() as any;

        render(<FeedPage />);
        // Component should handle loading state - fetch should not be called while loading
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
