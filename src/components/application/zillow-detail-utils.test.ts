import { describe, expect, it } from "vitest";
import {
    EMPTY_ZILLOW_RAW_DETAILS,
    extractZillowBuildingDetails,
    extractZillowRawDetails,
    formatLaundryLabel,
    formatScoreLabel,
    hasZillowPropertyDetails,
} from "@/components/application/zillow-detail-utils";

describe("zillow-detail-utils", () => {
    it("extracts raw listing details from the Zillow list scrape", () => {
        expect(
            extractZillowRawDetails({
                buildingName: "Strada 1200",
                statusText: "Available now",
                availabilityCount: "10",
            }),
        ).toEqual({
            buildingName: "Strada 1200",
            statusText: "Available now",
            availabilityCount: 10,
        });
    });

    it("extracts building details from the Zillow building scrape", () => {
        expect(
            extractZillowBuildingDetails({
                buildingName: "1739 Pine Street",
                description: "Water &amp; garbage included",
                neighborhood: "Cathedral Hill",
                county: "San Francisco County",
                commonUnitAmenities: ["Elevator", "Dishwasher"],
                specialOffers: [{ description: "No Application Fee &amp; More" }],
                walkScore: { walkscore: 99, description: "Walker's Paradise" },
                transitScore: { transit_score: 86, description: "Excellent Transit" },
                bikeScore: { bikescore: 79, description: "Very Bikeable" },
            }),
        ).toEqual({
            buildingName: "1739 Pine Street",
            description: "Water & garbage included",
            neighborhood: "Cathedral Hill",
            county: "San Francisco County",
            commonUnitAmenities: ["Elevator", "Dishwasher"],
            specialOffer: "No Application Fee & More",
            walkScore: { score: 99, description: "Walker's Paradise" },
            transitScore: { score: 86, description: "Excellent Transit" },
            bikeScore: { score: 79, description: "Very Bikeable" },
        });
    });

    it("formats display labels for Zillow-specific fields", () => {
        expect(formatLaundryLabel("in_unit")).toBe("In Unit");
        expect(formatScoreLabel({ score: 99, description: "Walker's Paradise" })).toBe("99 - Walker's Paradise");
    });

    it("detects when there are no Zillow property details", () => {
        expect(hasZillowPropertyDetails(EMPTY_ZILLOW_RAW_DETAILS)).toBe(false);
    });
});
