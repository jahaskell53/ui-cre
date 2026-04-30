ALTER TABLE "crexi_api_comps" ADD COLUMN "tax_amount" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "tax_parcel_value" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "tax_land_value" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "tax_improvement_value" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "buildings_count" integer;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "footprint_sqft" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "sale_buyer" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "sale_seller" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "loan_term" integer;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "mortgage_recording_date" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "gross_rent_annual" double precision;