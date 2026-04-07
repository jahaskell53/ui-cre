import { describe, expect, it } from "vitest";
import { EMPTY_ZILLOW_RAW_DETAILS } from "@/components/application/zillow-detail-utils";
import {
    buildUnitTypeSummary,
    getHeroImageUrls,
    getListingDisplayAddress,
    getPropertyTypeLabel,
    shouldShowZillowPropertySection,
    type Listing,
} from "./listing-detail";

describe("listing-detail helpers", () => {
    it("groups unit summaries by bed and bath count", () => {
        expect(
            buildUnitTypeSummary([
                { id: "1", zpid: null, price: 2000, beds: 1, baths: 1, area: 700 },
                { id: "2", zpid: null, price: 2400, beds: 1, baths: 1, area: 800 },
                { id: "3", zpid: null, price: 3200, beds: 2, baths: 2, area: 1100 },
            ]),
        ).toEqual([
            { beds: 1, baths: 1, count: 2, avgPrice: 2200, avgArea: 750, minPrice: 2000, maxPrice: 2400 },
            { beds: 2, baths: 2, count: 1, avgPrice: 3200, avgArea: 1100, minPrice: 3200, maxPrice: 3200 },
        ]);
    });

    it("formats listing addresses by source", () => {
        const zillowListing: Listing = {
            source: "zillow",
            id: "z1",
            zpid: null,
            raw_scrape_id: null,
            img_src: null,
            detail_url: null,
            address_raw: null,
            address_street: "123 Main St",
            address_city: "Oakland",
            address_state: "CA",
            address_zip: "94612",
            price: null,
            beds: null,
            baths: null,
            area: null,
            availability_date: null,
            scraped_at: null,
            latitude: null,
            longitude: null,
            is_building: null,
            building_zpid: null,
            home_type: null,
            laundry: null,
        };
        const loopnetListing: Listing = {
            source: "loopnet",
            id: "l1",
            address: null,
            headline: "Downtown Asset",
            location: null,
            price: null,
            cap_rate: null,
            building_category: null,
            square_footage: null,
            thumbnail_url: null,
            listing_url: null,
            created_at: null,
        };

        expect(getListingDisplayAddress(zillowListing)).toBe("123 Main St, Oakland, CA, 94612");
        expect(getListingDisplayAddress(loopnetListing)).toBe("Downtown Asset");
    });

    it("extracts hero image urls from Zillow scrape payloads", () => {
        expect(
            getHeroImageUrls(
                [
                    {
                        zpid: "123",
                        carouselPhotosComposable: {
                            baseUrl: "https://photos.test/{photoKey}.jpg",
                            photoData: [{ photoKey: "a" }, { photoKey: "b" }],
                        },
                    },
                ],
                "123",
            ),
        ).toEqual(["https://photos.test/a.jpg", "https://photos.test/b.jpg"]);

        expect(getHeroImageUrls([{ zpid: "123", imgSrc: "https://photos.test/fallback.jpg" }], "123")).toEqual(["https://photos.test/fallback.jpg"]);
    });

    it("derives property section and property type visibility", () => {
        expect(shouldShowZillowPropertySection(EMPTY_ZILLOW_RAW_DETAILS)).toBe(false);
        expect(shouldShowZillowPropertySection({ ...EMPTY_ZILLOW_RAW_DETAILS, neighborhood: "Mission" })).toBe(true);
        expect(getPropertyTypeLabel(true, null)).toBe("Whole Building");
        expect(getPropertyTypeLabel(false, "bld-1")).toBe("Unit in Building");
        expect(getPropertyTypeLabel(false, null)).toBe("Single Unit");
        expect(getPropertyTypeLabel(null, null)).toBeNull();
    });
});
