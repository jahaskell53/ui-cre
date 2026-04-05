import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionDivider } from "./section-divider";

describe("SectionDivider", () => {
    it("renders without crashing", () => {
        const { container } = render(<SectionDivider />);
        expect(container.firstChild).toBeTruthy();
    });

    it("accepts and applies className", () => {
        const { container } = render(<SectionDivider className="my-custom-class" />);
        expect((container.firstChild as HTMLElement).className).toContain("my-custom-class");
    });
});
