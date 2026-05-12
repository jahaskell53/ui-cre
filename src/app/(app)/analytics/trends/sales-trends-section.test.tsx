import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalesTrendsSection } from "./sales-trends-section";

const TEST_AREA = { id: "94107", label: "94107", color: "#3b82f6" };
const TEST_RESULTS = {
    "94107": [
        { month_start: "2023-01-01", median_price: 1_000_000, avg_cap_rate: 5, listing_count: 10 },
        { month_start: "2024-01-01", median_price: 1_200_000, avg_cap_rate: 6, listing_count: 20 },
    ],
};

describe("SalesTrendsSection", () => {
    it("uses a select for time granularity and notifies on change", async () => {
        const user = userEvent.setup();
        const onGranularityChange = vi.fn();
        render(<SalesTrendsSection areas={[TEST_AREA]} areaResults={{}} granularity="year" onGranularityChange={onGranularityChange} />);
        const select = screen.getByRole("combobox", { name: "Time granularity" });
        expect(select).toHaveValue("year");
        await user.selectOptions(select, "month");
        expect(onGranularityChange).toHaveBeenCalledWith("month");
    });

    it("hides the pct/abs toggle when Volume is selected", async () => {
        const user = userEvent.setup();
        render(<SalesTrendsSection areas={[TEST_AREA]} areaResults={TEST_RESULTS} granularity="year" />);

        // Toggle is visible by default (Median Price/Door)
        expect(screen.getByRole("button", { name: "%" })).toBeInTheDocument();

        // Click Volume
        await user.click(screen.getByRole("button", { name: "Volume" }));

        // Toggle disappears — no pct/abs buttons should remain
        expect(screen.queryByRole("button", { name: "%" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "$" })).not.toBeInTheDocument();
    });

    it("shows the pct/abs toggle for Median Price and Cap Rate", async () => {
        const user = userEvent.setup();
        render(<SalesTrendsSection areas={[TEST_AREA]} areaResults={TEST_RESULTS} granularity="year" />);

        // Median Price: % and $ buttons
        expect(screen.getByRole("button", { name: "%" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "$" })).toBeInTheDocument();

        // Cap Rate: Δ% and % buttons
        await user.click(screen.getByRole("button", { name: "Cap Rate" }));
        expect(screen.getByRole("button", { name: "Δ%" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "%" })).toBeInTheDocument();
    });
});
