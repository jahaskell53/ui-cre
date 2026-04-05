import { render } from "@testing-library/react";
import { Star } from "lucide-react";
import { describe, expect, it } from "vitest";
import { FeaturedIcon } from "./featured-icon";

describe("FeaturedIcon", () => {
    it("renders without crashing", () => {
        const { container } = render(<FeaturedIcon icon={Star} />);
        expect(container.firstChild).toBeTruthy();
    });

    it("renders all themes", () => {
        for (const theme of ["light", "gradient", "dark", "outline", "modern", "modern-neue"] as const) {
            const { container } = render(<FeaturedIcon icon={Star} theme={theme} />);
            expect(container.firstChild).toBeTruthy();
        }
    });

    it("renders all colors", () => {
        for (const color of ["brand", "gray", "error", "warning", "success"] as const) {
            const { container } = render(<FeaturedIcon icon={Star} color={color} />);
            expect(container.firstChild).toBeTruthy();
        }
    });

    it("renders all sizes", () => {
        for (const size of ["sm", "md", "lg", "xl"] as const) {
            const { container } = render(<FeaturedIcon icon={Star} size={size} />);
            expect(container.firstChild).toBeTruthy();
        }
    });
});
