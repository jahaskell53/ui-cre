import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crexiApiComps } from "@/db/schema";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id: raw } = await context.params;
        const id = decodeURIComponent(raw ?? "").trim();
        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }

        const isNumericId = /^\d+$/.test(id);

        const rows = await db
            .select({
                id: crexiApiComps.id,
                crexi_id: crexiApiComps.crexi_id,
                crexi_url: crexiApiComps.crexi_url,
                property_name: crexiApiComps.property_name,
                document_type: crexiApiComps.document_type,
                address_full: crexiApiComps.address_full,
                address_street: crexiApiComps.address_street,
                city: crexiApiComps.city,
                state: crexiApiComps.state,
                zip: crexiApiComps.zip,
                county: crexiApiComps.county,
                latitude: crexiApiComps.latitude,
                longitude: crexiApiComps.longitude,
                property_type: crexiApiComps.property_type,
                property_subtype: crexiApiComps.property_subtype,
                building_sqft: crexiApiComps.building_sqft,
                num_units: crexiApiComps.num_units,
                sale_type: crexiApiComps.sale_type,
                property_price_total: crexiApiComps.property_price_total,
                property_price_per_sqft: crexiApiComps.property_price_per_sqft,
                property_price_per_acre: crexiApiComps.property_price_per_acre,
                sale_transaction_date: crexiApiComps.sale_transaction_date,
                sale_cap_rate_percent: crexiApiComps.sale_cap_rate_percent,
                financials_cap_rate_percent: crexiApiComps.financials_cap_rate_percent,
                financials_noi: crexiApiComps.financials_noi,
                occupancy_rate_percent: crexiApiComps.occupancy_rate_percent,
                gross_rent_annual: crexiApiComps.gross_rent_annual,
                year_built: crexiApiComps.year_built,
                lot_size_sqft: crexiApiComps.lot_size_sqft,
                lot_size_acre: crexiApiComps.lot_size_acre,
                zoning: crexiApiComps.zoning,
                is_opportunity_zone: crexiApiComps.is_opportunity_zone,
                investment_type: crexiApiComps.investment_type,
                stories_count: crexiApiComps.stories_count,
                construction_type: crexiApiComps.construction_type,
                class_type: crexiApiComps.class_type,
                days_on_market: crexiApiComps.days_on_market,
                date_activated: crexiApiComps.date_activated,
                date_updated: crexiApiComps.date_updated,
                description: crexiApiComps.description,
                apn: crexiApiComps.apn,
                lender: crexiApiComps.lender,
                loan_amount: crexiApiComps.loan_amount,
                loan_type: crexiApiComps.loan_type,
                interest_rate: crexiApiComps.interest_rate,
                loan_term: crexiApiComps.loan_term,
                mortgage_maturity_date: crexiApiComps.mortgage_maturity_date,
                mortgage_recording_date: crexiApiComps.mortgage_recording_date,
                title_company: crexiApiComps.title_company,
                tax_amount: crexiApiComps.tax_amount,
                tax_parcel_value: crexiApiComps.tax_parcel_value,
                tax_land_value: crexiApiComps.tax_land_value,
                tax_improvement_value: crexiApiComps.tax_improvement_value,
                buildings_count: crexiApiComps.buildings_count,
                footprint_sqft: crexiApiComps.footprint_sqft,
                sale_buyer: crexiApiComps.sale_buyer,
                sale_seller: crexiApiComps.sale_seller,
                owner_name: crexiApiComps.owner_name,
                is_broker_reported_sales_comp: crexiApiComps.is_broker_reported_sales_comp,
                is_public_sales_comp: crexiApiComps.is_public_sales_comp,
                scraped_at: crexiApiComps.scraped_at,
            })
            .from(crexiApiComps)
            .where(isNumericId ? eq(crexiApiComps.id, parseInt(id, 10)) : eq(crexiApiComps.crexi_id, id))
            .limit(1);

        const row = rows[0];
        if (!row) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(row);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("GET /api/analytics/crexi-comp/[id]:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
