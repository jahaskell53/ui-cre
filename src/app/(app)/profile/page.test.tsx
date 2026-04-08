import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "@/hooks/use-user";
import ProfilePage from "./page";

// Mock dependencies
vi.mock("@/hooks/use-user");
vi.mock("@/utils/supabase", () => ({
    supabase: {
        auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
    },
}));
const mockPush = vi.fn();

// Mock next/navigation with useSearchParams
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
        back: vi.fn(),
        pathname: "/",
    }),
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/",
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
    website: "https://example.com",
    avatar_url: "https://example.com/avatar.jpg",
    roles: ["Property Owner"],
    is_admin: null,
    theme_preference: null,
    updated_at: null,
    tour_visited_pages: null,
};

describe("ProfilePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
        } as Response);
        vi.mocked(useUser).mockReturnValue({
            user: mockUser,
            profile: mockProfile,
            loading: false,
            refreshProfile: vi.fn(),
        });
    });

    it("should display user email", () => {
        render(<ProfilePage />);
        expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    });

    it("should load profile data into form", () => {
        render(<ProfilePage />);
        expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
        expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    });

    it("should update profile when save is clicked", async () => {
        const user = userEvent.setup();
        const refreshProfile = vi.fn().mockResolvedValue(undefined);
        vi.mocked(useUser).mockReturnValue({
            user: mockUser,
            profile: mockProfile,
            loading: false,
            refreshProfile,
        });

        render(<ProfilePage />);

        const fullNameInput = screen.getByDisplayValue("Test User");
        await user.clear(fullNameInput);
        await user.type(fullNameInput, "Updated Name");

        const saveButton = screen.getByRole("button", { name: /save changes/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/profile",
                expect.objectContaining({
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                }),
            );
        });

        const fetchCall = vi.mocked(global.fetch).mock.calls.find((c) => c[0] === "/api/profile");
        expect(fetchCall).toBeDefined();
        const init = fetchCall![1] as RequestInit;
        expect(JSON.parse(init.body as string)).toMatchObject({
            full_name: "Updated Name",
            website: "https://example.com",
            avatar_url: "https://example.com/avatar.jpg",
            roles: ["Property Owner"],
        });
        expect(refreshProfile).toHaveBeenCalled();
    });

    it("should toggle roles when checkbox is clicked", async () => {
        const user = userEvent.setup();
        render(<ProfilePage />);

        // Find a role checkbox that's not selected
        const brokerCheckbox = screen.getByRole("checkbox", { name: "Broker" });
        expect(brokerCheckbox).not.toBeChecked();

        await user.click(brokerCheckbox);
        expect(brokerCheckbox).toBeChecked();

        await user.click(brokerCheckbox);
        expect(brokerCheckbox).not.toBeChecked();
    });

    it("should show selected roles from profile", () => {
        render(<ProfilePage />);
        const propertyOwnerCheckbox = screen.getByRole("checkbox", { name: "Property Owner" });
        expect(propertyOwnerCheckbox).toBeChecked();
    });

    it("should redirect to login when user is not authenticated", async () => {
        vi.mocked(useUser).mockReturnValue({
            user: null,
            profile: null,
            loading: false,
            refreshProfile: vi.fn(),
        });

        render(<ProfilePage />);

        // Wait for useEffect to run
        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith("/login");
        });
    });
});
