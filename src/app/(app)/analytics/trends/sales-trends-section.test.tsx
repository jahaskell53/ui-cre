import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalesTrendsSection } from "./sales-trends-section";

describe("SalesTrendsSection", () => {
    it("uses a select for time granularity and notifies on change", async () => {
        const user = userEvent.setup();
        const onGranularityChange = vi.fn();
        render(
            <SalesTrendsSection
                areas={[{ id: "94107", label: "94107", color: "#3b82f6" }]}
                areaResults={{}}
                granularity="year"
                onGranularityChange={onGranularityChange}
            />,
        );
        const select = screen.getByRole("combobox", { name: "Time granularity" });
        expect(select).toHaveValue("year");
        await user.selectOptions(select, "month");
        expect(onGranularityChange).toHaveBeenCalledWith("month");
    });
});
