# Database

All database changes must be version controlled here. Do not make schema or function changes directly in the Supabase dashboard without also committing the corresponding SQL here.

## Structure

```
supabase/
├── migrations/   # Ordered history of all schema + function changes
└── functions/    # Current definition of every custom Postgres function
```

## Making a schema change

1. Create a new file in `migrations/` with the next number: `012_<description>.sql`
2. Write your DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, etc.) using `IF NOT EXISTS` / `IF EXISTS` where possible so it's safe to re-run
3. Apply it to the **target database**: Supabase Dashboard **SQL Editor**, `supabase db push`, or (for Cursor agents with Supabase MCP) **`apply_migration`** on the hosted project that matches the app’s `NEXT_PUBLIC_SUPABASE_URL`. See **Hosted Supabase migrations** in the root `AGENTS.md`.
4. Commit the migration file

## Making a function change

1. Edit the relevant file in `functions/<function_name>.sql`
2. Create a new migration in `migrations/` with the same `CREATE OR REPLACE FUNCTION` — this is what actually runs against the DB
3. Apply the migration to the hosted project (Dashboard, `supabase db push`, or Supabase MCP `apply_migration` — same as step 3 under *Making a schema change*; see `AGENTS.md`)
4. Commit both files together

The `functions/` files are the readable source of truth for what each function currently does. The `migrations/` files are the authoritative change history.

## Applying migrations to a fresh DB

Run the migration files in order (001 → latest) against the target database.

## Local Supabase (CLI + Docker)

1. Install [Docker](https://docs.docker.com/get-docker/) and ensure the daemon is running.
2. From the repo root: `bun install` then `bun run supabase:start` (first run pulls images and can take several minutes).
3. Copy the API URL, `anon` key, and `service_role` key from `bun run supabase:status` into `.env.local` (see root `.env.example` commented block).
4. Open Supabase Studio at [http://127.0.0.1:54323](http://127.0.0.1:54323). Auth is configured for `http://127.0.0.1:3000` in `supabase/config.toml`.
5. `bun run supabase:reset` reapplies all files in `migrations/` from scratch (destructive to local data).

Migrations are applied automatically on start/reset. Use `bun run supabase:stop` when finished.
