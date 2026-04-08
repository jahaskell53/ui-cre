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
- **ORM convention**: Server-side data access uses `db` from `src/db/index.ts` (Drizzle ORM). The `supabase` server client (`createClient` from `src/utils/supabase/server.ts`) is for auth (`getUser`), realtime, and storage only. On the client side, the Supabase browser client (`@/utils/supabase`) is used for auth operations only (`signOut`, `getSession`, `onAuthStateChange`). The one current exception is `src/app/(app)/users/page.tsx`, which still queries `profiles` directly via `supabase.from()` (tracked in OPE-3e).

### Schema change workflow

1. Edit `src/db/schema.ts` — this is the single source of truth for all table definitions.
2. Run `drizzle-kit generate` to produce a SQL migration file under `supabase/migrations/`.
3. Review the generated SQL to confirm it is correct and additive (see backward compatibility rule below).
4. Commit both the schema change and the migration file in the same PR.
5. On PR open/update, CI runs `supabase db push --dry-run` and posts the SQL as a PR comment so reviewers can see exactly what will run in production.
6. On merge to main, CI runs `supabase db push` to apply the migration before the Vercel deployment completes.

**Do not apply schema changes via the Supabase MCP or the Supabase dashboard SQL editor.** All schema changes must go through the Drizzle → migration file → CI pipeline path described above so they remain version-controlled and reproducible.

### Backward compatibility rule

Migrations must be **additive only** (new columns with defaults or nullable, new tables). Destructive changes (dropping a column or table) must be split across two separate PRs:

1. **PR 1**: Deploy updated application code that no longer reads or writes the old column/table.
2. **PR 2** (after PR 1 is merged and deployed): Drop the column/table.

### CI/CD: Database migrations

Two GitHub Actions workflows manage schema changes automatically:

- **`db-migration-dry-run.yml`** — triggers on every PR targeting `main`. Runs `supabase db push --dry-run` and posts the pending SQL as a comment on the PR so reviewers can inspect what will run against production. Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` as GitHub Actions secrets.
- **`db-migration-apply.yml`** — triggers on every push to `main`. Runs `supabase db push` to apply pending migrations to production before the Vercel deployment completes. Same secrets required.

This ordering guarantees that the database schema is always ahead of the application code.

### Testing

- **Development approach**: Adopt test-driven development for code changes: add or update the smallest relevant failing test first, implement the minimal change to make it pass, then run the relevant tests again.
- **Unit/integration tests**: `bun run test` (Vitest + jsdom, 65 test files / 565 tests). No external services needed — all deps are mocked.
- **Formatting**: `npx prettier --check "src/**/*.{ts,tsx}"`. No ESLint config exists in the repo.

### Known caveats

- **`bun run build` fails in Cloud VMs** due to Google Fonts fetch being blocked by the sandboxed network. This is an environment limitation. The dev server (`bun dev`) works fine.
- **Local Supabase**: `supabase/config.toml` and migrations live under `supabase/`. Use `bun run supabase:start` when you want a local stack instead of the hosted project.
- The `.env.local` file is gitignored and must be created per-environment. All secret names are listed in `.env.example`.
- There is no ESLint configuration — Prettier is the only code style tool.

### Dagster pipeline (pipeline/dagster/)

- **Runtime**: Python 3.12 + uv. Both `uv` and a uv-managed Python are installed via the update script; `~/.local/bin` and the uv Python bin directory are on PATH.
- **Install deps**: `cd pipeline/dagster && uv pip install dagster dagster-webserver dagster-cloud supabase apify-client python-dotenv pytest && uv pip install --no-deps -e .` — the `postal` C extension is excluded because libpostal is not available in Cloud VMs. Tests mock `normalize_address` so they pass without it.
- **Run tests**: `cd pipeline/dagster && .venv/bin/pytest` (56 tests, all mocked, no external services needed).
- **Run dev server**: `cd pipeline/dagster && uv run dagster dev` (requires Supabase + Apify env vars; see `pipeline/dagster/.env.example`).
