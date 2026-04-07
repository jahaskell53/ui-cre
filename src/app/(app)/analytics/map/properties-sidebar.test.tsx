import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Property } from "@/components/application/map/property-map";
import { PropertiesSidebar } from "./properties-sidebar";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

class MockIntersectionObserver {
    static instances: MockIntersectionObserver[] = [];

    callback: IntersectionObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
    }

    trigger(isIntersecting: boolean) {
        this.callback(
            [
                {
                    isIntersecting,
                } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver,
        );
    }
}

function buildProperty(index: number): Property {
    return {
        id: `property-${index}`,
        name: `Property ${index}`,
        address: `${index} Main St`,
        price: `$${index}`,
        coordinates: [-122.4, 37.7],
    };
}

describe("PropertiesSidebar", () => {
    beforeEach(() => {
        MockIntersectionObserver.instances = [];
        vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    });

    it("renders an initial batch and loads more when the sentinel intersects", async () => {
        const properties = Array.from({ length: 120 }, (_, index) => buildProperty(index + 1));

        render(<PropertiesSidebar properties={properties} selectedId={null} loading={false} totalCount={properties.length} onSelect={vi.fn()} />);

        expect(screen.getByText("120 Results · Showing 50")).toBeTruthy();
        expect(screen.getByText("Property 1")).toBeTruthy();
        expect(screen.getByText("Property 50")).toBeTruthy();
        expect(screen.queryByText("Property 51")).toBeNull();
        expect(screen.getByLabelText("load-more-sentinel")).toBeTruthy();
        expect(MockIntersectionObserver.instances).toHaveLength(1);

        act(() => {
            MockIntersectionObserver.instances[0].trigger(true);
        });

        expect(await screen.findByText("120 Results · Showing 100")).toBeTruthy();
        expect(screen.getByText("Property 100")).toBeTruthy();
        expect(screen.queryByText("Property 101")).toBeNull();
    });
});
