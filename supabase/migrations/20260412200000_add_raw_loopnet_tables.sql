CREATE TABLE "raw_loopnet_search_scrapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"scraped_at" timestamp with time zone NOT NULL,
	"search_url" text NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "raw_loopnet_detail_scrapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"scraped_at" timestamp with time zone NOT NULL,
	"listing_url" text NOT NULL,
	"raw_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
