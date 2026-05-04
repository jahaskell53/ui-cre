import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for optional tooling against `src/db/schema.ts`.
 *
 * Production migrations are hand-written SQL under `supabase/migrations/` and
 * applied by Supabase CLI / CI (`supabase db push`). Do **not** use:
 * - `drizzle-kit generate` — would conflict with the hand-written migration flow
 * - `drizzle-kit migrate` — not used; migrations are not driven by Drizzle Kit
 *
 * You may still use commands that introspect or inspect the live DB when needed,
 * for example `drizzle-kit introspect` (requires `DATABASE_URL`). Output goes to
 * `.drizzle-generated/` (gitignored), not the removed legacy `drizzle/` folder.
 */
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for drizzle-kit commands that connect to the database");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./.drizzle-generated",
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
});
