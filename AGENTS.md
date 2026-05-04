# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

This is a single Next.js 16 application (not a monorepo) for commercial real estate CRM. For local dev you can run the **Next.js dev server** against either a **remote Supabase** project or **local Supabase** (Docker).

### Running the app

- **Package manager**: Bun (`bun.lockb` is the lockfile). Install deps with `bun install`.
- **Dev server**: `bun dev` (runs `next dev --turbopack` on port 3000).
- **Manual login in development**: With `NODE_ENV=development`, `/login` prefills from `TEST_EMAIL` and `TEST_PASSWORD` (see `.env.example`; defaults are `test@example.com` / `Password123`). Those credentials must match a real user in **the same Supabase project** as `NEXT_PUBLIC_SUPABASE_URL`. If login fails with invalid credentials, create that user in Supabase Auth (dashboard or signup) or point env at a project where the user already exists. Local Supabase starts with no users unless you add one.
- **Local Supabase** (optional): [Docker](https://docs.docker.com/get-docker/) required. Run `bun run supabase:start`, then set the Supabase variables in `.env.local` to the values printed by `bun run supabase:status` (see `.env.example`). Stop with `bun run supabase:stop`. Reset DB and re-apply migrations with `bun run supabase:reset`.
- Environment variables are injected automatically in Cursor Cloud Agent VMs. For local development, copy `.env.example` to `.env.local` and fill in values.
- **ORM convention**: Server-side data access uses `db` from `src/db/index.ts` (Drizzle ORM). The `supabase` server client (`createClient` from `src/utils/supabase/server.ts`) is for auth (`getUser`), realtime, and storage only. On the client side, the Supabase browser client (`@/utils/supabase`) is used for auth operations only (`signOut`, `getSession`, `onAuthStateChange`, `signUp`, `signInWithPassword`). All data queries from client components go through Next.js API routes, which use Drizzle on the server side.

### Supabase MCP and CLI point at production

In **Cursor Cloud Agent** VMs, **Supabase MCP** and **Supabase CLI** both target the **production** hosted Supabase project (the live application database), not local Docker and not an isolated scratch database. Queries, `execute_sql`, `apply_migration`, `supabase db push`, and similar operations run against **real production data**.

### Schema change workflow

**Schema changes vs. large data backfills:** Use **hand-written SQL migrations** under `supabase/migrations/` plus the **GitHub Actions database migration workflows** (PR shadow apply and on-merge `supabase db push`) for **DDL and schema evolution**—new tables and columns, indexes, constraints, and small, bounded data fixes that must land with the application code. **Large-scale data backfills** (heavy `INSERT`/`UPDATE`/`DELETE` across many rows, long-running recomputation, chunked or resumable ETL) are a poor fit for that path: migration runs are time-budgeted, harder to monitor, and not designed for retries. Prefer the **Dagster pipeline** in `pipeline/dagster/` for those jobs.

Migrations are **hand-written SQL** in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. CI (`supabase db push`) applies those files to production. Do **not** run `drizzle-kit generate` or `drizzle-kit migrate` — they are not part of this workflow (see `drizzle.config.ts`).

1. Add or edit the migration SQL file under `supabase/migrations/` with a new timestamp prefix. Review that it is correct and additive (see backward compatibility rule below).
2. Manually update `src/db/schema.ts` so Drizzle TypeScript types and table definitions stay aligned with what the migration creates or changes.
3. Commit the migration file and schema changes in the same PR.
4. On PR open/update, CI dumps production schema + migration history into a fresh Postgres container, then runs `supabase db push` (a real apply, not `--dry-run`) against that shadow DB. The pending SQL and apply output are posted as a PR comment, and the full logs are uploaded as a workflow artifact (`db-migration-shadow-logs-<sha>`). Branch protection requires "branches must be up to date before merging" so this check always runs against the post-merge state, not a stale snapshot.
5. On merge to main, CI runs `supabase db push` to apply the migration to production before the Vercel deployment completes. On failure, the workflow uploads the full apply output as an artifact (`db-migration-apply-log-<sha>`) and auto-opens a GitHub issue tagged with the failing commit SHA, the `supabase db push` output, and a link to the workflow run.

**Migration file naming**: The version is the numeric timestamp prefix and is the primary key in `supabase_migrations.schema_migrations`. Two migrations with the same timestamp will cause `db push` to fail with a duplicate key error. Name new files with the real current time: `date +%Y%m%d%H%M%S`. Never use round numbers like `YYYYMMDD000000`. Before adding a migration, run `git pull origin main` to confirm no migration on `main` already has the same or a later timestamp.

**Statement timeout for migrations that still need bulk DML**: The `supabase db push` migrations role has a **2-minute `statement_timeout`**. Large backfills still belong in **Dagster** when possible (see above). If a migration truly must run bulk DML and would otherwise exceed the budget, add `SET statement_timeout = 0;` (session-scoped, **not** `SET LOCAL`) as the **first statement**. `supabase db push` executes each migration's statements in autocommit mode rather than wrapping the file in an explicit transaction, so `SET LOCAL` is silently dropped with a `WARNING (25P01): SET LOCAL can only be used in transaction blocks` and the role timeout stays in effect. Session-level `SET` persists across the autocommit statements on the same connection. Example: `20260503234944_crexi_api_comps_split_json_tables.sql`. If the migration also performs heavy sorting/hashing (large `INSERT … SELECT` of JSONB, big `UPDATE`s with index maintenance), pair it with `SET work_mem = '256MB';` to keep work in memory.

**Pre-merge testing when the PR needs the migration first**: Production and the default CI path only apply migrations after merge to `main`. If you need the new schema applied to a database *before* merge (for example manual QA or integration tests against a hosted project while the PR is open), commit the hand-written SQL under `supabase/migrations/` and apply pending migrations to the target environment with the Supabase CLI (for example `supabase db push` against a linked dev or staging project). That keeps the migration version-controlled; only the timing of *apply* on the test database is ahead of merge.

**Do not apply schema changes via the Supabase MCP or the Supabase dashboard SQL editor.** MCP and CLI in this environment hit **production** (see above). All schema changes must go through version-controlled SQL under `supabase/migrations/` and the CI pipeline described above so they remain reproducible.

### Backward compatibility rule

Migrations must be **additive only** (new columns with defaults or nullable, new tables). Destructive changes (dropping a column or table) must be split across two separate PRs:

1. **PR 1**: Deploy updated application code that no longer reads or writes the old column/table.
2. **PR 2** (after PR 1 is merged and deployed): Drop the column/table.

### CI/CD: Database migrations

These workflows apply **schema migrations** from `supabase/migrations/`; they are not the right place for **large-scale data backfills** (use Dagster; see "Schema change workflow" above).

Two GitHub Actions workflows manage schema changes automatically:

- **`db-migration-dry-run.yml`** — triggers on every PR targeting `main`. Spins up a `supabase/postgres:17.x` service container (which ships with the Supabase-managed schemas `auth`, `storage`, etc. pre-initialized), dumps production schema + the `supabase_migrations` history into it, then runs `supabase db push` against the shadow DB (a real apply, not just `--dry-run`). Posts the pending SQL and apply output as a PR comment and uploads `/tmp/dry-run-output.txt`, `/tmp/apply-output.txt`, and `/tmp/restore-history-schema.log` as a workflow artifact. Requires `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and `SUPABASE_DB_PASSWORD` as GitHub Actions secrets.
- **`db-migration-apply.yml`** — triggers on every push to `main`. Runs `supabase db push` to apply pending migrations to production before the Vercel deployment completes. On failure, uploads the full apply output as an artifact and auto-opens a GitHub issue with the failing commit SHA, the `supabase db push` output, a link to the workflow run, and a remediation checklist. Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`.

This ordering guarantees that the database schema is always ahead of the application code.

**Required branch protection setting**: enable "Require branches to be up to date before merging" on `main` (Settings → Branches → Branch protection rules). Without this, the shadow apply check can pass against a stale base and the on-merge apply can still fail because another PR's migration landed in between.

### Testing

- **Development approach**: Adopt test-driven development for code changes: add or update the smallest relevant failing test first, implement the minimal change to make it pass, then run the relevant tests again.
- **Unit/integration tests**: `bun run test` (Vitest + jsdom, 65 test files / 565 tests). No external services needed — all deps are mocked.
- **Formatting**: `npx prettier --check "src/**/*.{ts,tsx}"`. No ESLint config exists in the repo.
- **After opening or updating a PR**: Confirm CI finished successfully using the [GitHub CLI](https://cli.github.com/) from the PR branch (requires `gh auth login` with repo access). Run `gh pr checks --watch` to wait until all checks complete and fail the session if any check fails; use `gh pr checks` for a one-shot status snapshot. Fix failures, push again, and re-check until green.

### AWS S3 bucket

The app and Dagster pipeline use an AWS S3 bucket (`AWS_S3_BUCKET` env var) for storing OM PDFs and profile pictures. The bucket also contains manual Crexi CSV exports under `Crexi/Comps & Records/` (`Property_Exports_1.csv` through `Property_Exports_18.csv`) and active listing exports under `Crexi/Active Listings/`. These CSVs are a separate dataset from what the API scraper ingests into `crexi_api_comps` — they were exported manually from the Crexi UI.

### Sales trends data source

Sales-trend RPCs read from **`crexi_api_comps`** (Crexi source) or **`loopnet_listings`** (LoopNet source). The `crexi_comps_records` table (manual Crexi CSV import) is **not** used by any sales-trend RPC; it exists only as a separate dataset and is referenced by `src/db/schema.ts`. When adding or modifying sales-trend queries, target `crexi_api_comps` for Crexi data.

### Crexi data layout (bronze / silver, OPE-235)

Crexi storage is split into two layers. **Treat the bronze tables as raw capture and `crexi_api_comps` as a derived projection.**

- **Bronze (raw capture, scraper-only writes):**
  - `crexi_api_comp_raw_json` — universal-search payload, one row per `crexi_id` today (PR B / OPE-238 will switch the PK to `(crexi_id, run_id)` so re-scrapes preserve history).
  - `crexi_api_comp_detail_json` — `GET https://api.crexi.com/properties/{id}` payload. `detail_json` is nullable so 404/410 responses are still recorded with `http_status` set instead of silently dropped.
  - Both tables carry `run_id` (FK to `crexi_scrape_runs`) and `fetched_at`.
- **Silver (curated, app-readable):** `crexi_api_comps`. Every column is either flattened from `raw_json`, derived from `detail_json` (e.g. `num_units`, `detail_enriched_at`), or computed deterministically from those (e.g. `exclude_from_sales_trends`). No JSON payloads live on this table.
- **Run lineage:** `crexi_scrape_runs` has one row per scraper invocation (`source = 'search' | 'detail' | 'legacy-import'`, plus `started_at` / `finished_at` / `status` / `params` / `row_count`). Both `scripts/scrape_crexi.sh` and `scripts/enrich_crexi_units.{py,sh}` insert a run row on start, tag every bronze write with the resulting `run_id`, and PATCH the row to `'completed'`/`'failed'` on exit.
- **`_latest` views:** `crexi_api_comp_raw_json_latest` and `crexi_api_comp_detail_json_latest` expose the freshest payload per `crexi_id` (`distinct on (crexi_id) order by crexi_id, fetched_at desc`). Downstream silver-build code and ad-hoc joins should read from these, not from the underlying tables, so they keep working when bronze becomes append-only in PR B.

ETL contract (rules, in priority order):

1. Only the scrape/enrich scripts write bronze. The app, RPCs, and ad-hoc dashboards never mutate `crexi_api_comp_raw_json` or `crexi_api_comp_detail_json`.
2. Re-scraping must always start a new `crexi_scrape_runs` row and tag inserts with that `run_id`. No fallback path that writes bronze without a `run_id`.
3. Sales-trend RPCs and other hot reads target silver (`crexi_api_comps`), not bronze.
4. Any new column on `crexi_api_comps` must have a documented derivation from `raw_json` and/or `detail_json` (a JSON path, a regex on a string field, a `coalesce`, etc.).

### Known caveats

- **`bun run build` fails in Cloud VMs** due to Google Fonts fetch being blocked by the sandboxed network. This is an environment limitation. The dev server (`bun dev`) works fine.
- **Local Supabase**: `supabase/config.toml` and migrations live under `supabase/`. Use `bun run supabase:start` when you want a local stack instead of the hosted project.
- The `.env.local` file is gitignored and must be created per-environment. All secret names are listed in `.env.example`.
- There is no ESLint configuration — Prettier is the only code style tool.

### Visual documentation

When it would help reviewers or future readers (for example UI changes, flows, or before/after), capture a **screenshot** or **screen recording** if doing so is worthwhile.

### Dagster pipeline (pipeline/dagster/)

- **Large data backfills and ETL**: Prefer Dagster assets/jobs here over migration SQL when work is **high volume, long-running, or needs orchestration** (chunking, retries, schedules). Schema shape still comes from `supabase/migrations/` and CI; Dagster fills or transforms data after the schema exists.
- **Runtime**: Python 3.12 + uv. Both `uv` and a uv-managed Python are installed via the update script; `~/.local/bin` and the uv Python bin directory are on PATH.
- **Dagster CLI**: `dg` should be available in Cloud VMs. If it is missing, run `source "$HOME/.local/bin/env" && uv tool install dagster-dg-cli`.
- **If `uv` is missing**: run `curl -LsSf https://astral.sh/uv/install.sh | sh` and then `source "$HOME/.local/bin/env"`.
- **Install deps**: `cd pipeline/dagster && uv pip install dagster dagster-webserver dagster-cloud supabase apify-client python-dotenv pytest && uv pip install --no-deps -e .` — the `postal` C extension is excluded because libpostal is not available in Cloud VMs. Tests mock `normalize_address` so they pass without it.
- **Run tests**: `cd pipeline/dagster && .venv/bin/pytest` (56 tests, all mocked, no external services needed).
- **Run dev server**: `cd pipeline/dagster && uv run dagster dev` (requires Supabase + Apify env vars; see `pipeline/dagster/.env.example`).
- **Debugging a Dagster Cloud run**: To inspect logs for a specific run, extract the run ID from the Dagster Plus run URL (format: `https://<org>.dagster.plus/<deployment>/runs/<run-id>`) and use `dg`: `dg run inspect <run-id>` (add `--logs` to stream full log output). Requires `DAGSTER_CLOUD_API_TOKEN` and the deployment name (e.g. `prod`) to be configured; see `pipeline/dagster/.env.example`.
