import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "@/hooks/use-user";
import UserProfilePage from "./page";

// Mock dependencies
vi.mock("@/hooks/use-user");
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        back: vi.fn(),
    }),
    useParams: () => ({
        id: "user-123",
    }),
}));

const mockCurrentUser = {
    id: "current-user",
    email: "current@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
} as any;

const mockProfile = {
    id: "user-123",
    full_name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    website: "https://example.com",
    roles: ["Property Owner", "Broker"],
};

function setupFetchMock(profile: typeof mockProfile | null, posts: any[] = []) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/users")) {
            if (profile === null) {
                return Promise.resolve({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({ error: "Not found" }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(profile),
            });
        }
        if (url.includes("/api/posts")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(posts),
            });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as any;
}

describe("UserProfilePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useUser).mockReturnValue({
            user: mockCurrentUser,
            profile: null,
            loading: false,
            refreshProfile: vi.fn(),
        });
    });

    it("should load and display user profile", async () => {
        setupFetchMock(mockProfile);

        render(<UserProfilePage />);

        await waitFor(() => {
            expect(screen.getByText("Test User")).toBeInTheDocument();
        });

        expect(screen.getByText("Property Owner")).toBeInTheDocument();
        expect(screen.getByText("Broker")).toBeInTheDocument();
    });

    it("should display posts count", async () => {
        const posts = Array.from({ length: 10 }, (_, i) => ({
            id: `post-${i}`,
            type: "post",
            content: `Post ${i}`,
            file_url: null,
            created_at: new Date().toISOString(),
            likes: [],
            comments_count: 0,
        }));

        setupFetchMock(mockProfile, posts);

        render(<UserProfilePage />);

        await waitFor(() => {
            expect(screen.getByText("10")).toBeInTheDocument();
        });
    });

    it("should show edit profile button for own profile", async () => {
        vi.mocked(useUser).mockReturnValue({
            user: { ...mockCurrentUser, id: "user-123" } as any, // Same ID as profile
            profile: null,
            loading: false,
            refreshProfile: vi.fn(),
        });

        setupFetchMock(mockProfile);

        render(<UserProfilePage />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument();
        });
    });

    it("should show user not found when profile does not exist", async () => {
        setupFetchMock(null);

        render(<UserProfilePage />);

        await waitFor(() => {
            expect(screen.getByText(/user not found/i)).toBeInTheDocument();
        });
    });
});
