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
- **Drizzle schema source of truth**: `src/db/schema.ts` is the canonical definition for table structures in application code.
- **Drizzle migration workflow**: After schema changes, run `drizzle-kit generate` to create SQL, then apply it with `supabase db push`.

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
