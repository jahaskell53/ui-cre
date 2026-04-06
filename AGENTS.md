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

### Hosted Supabase migrations (agents)

Adding a file under `supabase/migrations/` only records the change in git. The **remote** database still runs the old schema until that SQL is executed against the hosted project.

- **Cursor Cloud Agents with Supabase MCP**: After you add or edit a migration, **apply it to the hosted project** using the Supabase MCP migration tool (`apply_migration`) for the same project ref as `NEXT_PUBLIC_SUPABASE_URL` in this environment, unless the task says otherwise. Committing the migration file is not enough for the live app to pick up RPC or DDL changes.
- **Multiple projects**: MCP may only list certain orgs or projects. If the app’s Supabase URL points at a project you cannot reach via MCP, apply the same migration using the Supabase Dashboard **SQL Editor** or `supabase db push` linked to that project (see `supabase/README.md`).
- **Local Supabase (Docker)**: Migrations load from `supabase/migrations/` on `supabase:start` / `supabase:reset`; MCP apply is for **hosted** databases, not the local stack.

### Testing

- **Unit/integration tests**: `bun run test` (Vitest + jsdom, 63 test files / 539 tests). No external services needed — all deps are mocked.
- **Formatting**: `npx prettier --check "src/**/*.{ts,tsx}"`. No ESLint config exists in the repo.

### Known caveats

- **`bun run build` fails in Cloud VMs** due to Google Fonts fetch being blocked by the sandboxed network. This is an environment limitation. The dev server (`bun dev`) works fine.
- **Local Supabase**: `supabase/config.toml` and migrations live under `supabase/`. Use `bun run supabase:start` when you want a local stack instead of the hosted project.
- The `.env.local` file is gitignored and must be created per-environment. All secret names are listed in `.env.example`.
- There is no ESLint configuration — Prettier is the only code style tool.
