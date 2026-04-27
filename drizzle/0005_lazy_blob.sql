ALTER TABLE "crexi_api_comps" ADD COLUMN "sale_cap_rate_percent" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "financials_cap_rate_percent" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "financials_noi" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "occupancy_rate_percent" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "year_built" integer;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "lot_size_sqft" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "lot_size_acre" double precision;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "zoning" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "is_opportunity_zone" boolean;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "owner_name" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "is_corporate_owner" boolean;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "is_crexi_source" boolean;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "investment_type" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "stories_count" integer;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "construction_type" text;--> statement-breakpoint
ALTER TABLE "crexi_api_comps" ADD COLUMN "class_type" text;