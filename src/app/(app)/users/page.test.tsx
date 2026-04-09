import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "@/hooks/use-user";
import UsersPage from "./page";

vi.mock("@/hooks/use-user");

const mockUser = {
    id: "user-123",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
} as any;

describe("UsersPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useUser).mockReturnValue({
            user: mockUser,
            profile: null,
            loading: false,
            refreshProfile: vi.fn(),
        });
        vi.stubGlobal("fetch", vi.fn());
    });

    it("should render search input", () => {
        render(<UsersPage />);
        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
    });

    it("should search for users when typing", async () => {
        const user = userEvent.setup();
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => [{ id: "user-1", full_name: "John Doe", avatar_url: null, website: null, roles: ["Broker"] }],
        } as Response);

        render(<UsersPage />);

        const searchInput = screen.getByPlaceholderText(/search by name/i);
        await user.type(searchInput, "john");

        await waitFor(
            () => {
                expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/users/search?q=john"));
            },
            { timeout: 1000 },
        );
    });

    it("should display search results", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => [{ id: "user-1", full_name: "John Doe", avatar_url: null, website: null, roles: ["Broker"] }],
        } as Response);

        render(<UsersPage />);

        const searchInput = screen.getByPlaceholderText(/search by name/i);
        await userEvent.type(searchInput, "john");

        await waitFor(
            () => {
                expect(screen.getByText("John Doe")).toBeInTheDocument();
            },
            { timeout: 1000 },
        );
    });

    it("should show empty state when no search query", () => {
        render(<UsersPage />);
        expect(screen.getByText(/enter a name to find people/i)).toBeInTheDocument();
    });

    it("should show no results message when search returns empty", async () => {
        const user = userEvent.setup();
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => [],
        } as Response);

        render(<UsersPage />);

        const searchInput = screen.getByPlaceholderText(/search by name/i);
        await user.type(searchInput, "nonexistent");

        await waitFor(
            () => {
                expect(screen.getByText(/no users found/i)).toBeInTheDocument();
            },
            { timeout: 1000 },
        );
    });
});
