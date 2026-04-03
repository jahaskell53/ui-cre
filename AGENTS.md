# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

This is a single Next.js 16 application (not a monorepo) for commercial real estate CRM. The only required service for local dev is the **Next.js dev server** connecting to a **remote Supabase** project.

### Running the app

- **Package manager**: Bun (`bun.lockb` is the lockfile). Install deps with `bun install`.
- **Dev server**: `bun dev` (runs `next dev --turbopack` on port 3000).
- Environment variables are injected automatically in Cloud Agent VMs. For local development, copy `.env.example` to `.env.local` and fill in values.

### Testing

- **Unit/integration tests**: `bun run test` (Vitest + jsdom, 63 test files / 539 tests). No external services needed — all deps are mocked.
- **Formatting**: `npx prettier --check "src/**/*.{ts,tsx}"`. No ESLint config exists in the repo.

### Known caveats

- **`bun run build` fails in Cloud VMs** due to Google Fonts fetch being blocked by the sandboxed network. This is an environment limitation. The dev server (`bun dev`) works fine.
- **No local Supabase**: The app connects to a remote Supabase instance. There is no `supabase/config.toml` or Docker-based local DB setup.
- The `.env.local` file is gitignored and must be created per-environment. All secret names are listed in `.env.example`.
- There is no ESLint configuration — Prettier is the only code style tool.
