# pipeline/

Dagster pipeline that scrapes Zillow rental listings via Apify, transforms them, and loads into Supabase (`cleaned_listings`).

```
pipeline/
└── dagster/
    ├── zillow_pipeline/    # Dagster assets, resources, sensors
    ├── Dockerfile          # Production image (layers on base image)
    ├── Dockerfile.base     # Base image with libpostal (slow build, rarely changes)
    ├── dagster_cloud.yaml  # Code location config for Dagster Cloud
    └── .env.example        # Template for local dev env vars
```

---

## Running locally

```bash
cd pipeline/dagster
cp .env.example .env
# Fill in .env (see "Environment variables" below)
uv run dagster dev
```

---

## Environment variables

### Local dev (`.env` file, never committed)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `APIFY_API_TOKEN` | Apify API token |
| `APIFY_ACTOR_ID` | Zillow ZIP search actor ID |
| `APIFY_DETAIL_ACTOR_ID` | Zillow building detail actor ID |
| `SENDGRID_API_KEY` | SendGrid key (for failure alert emails) |
| `ALERT_EMAIL` | Email address to receive pipeline failure alerts |
| `SMTP_FROM` | From address for alert emails |
| `DATABASE_URL` | Postgres connection string (used by seed scripts) |

### Dagster Cloud (stored in Dagster Cloud UI, not GitHub)

The production pipeline reads secrets from Dagster Cloud's environment variable store, not from GitHub. To configure:

1. Go to [Dagster Cloud](https://dagster.cloud) → your org (`openmidmarket`) → Settings → Environment Variables
2. Add the same variables listed above

GitHub Actions only needs `DAGSTER_CLOUD_API_TOKEN` (stored as a GitHub repo secret) to authenticate with Dagster Cloud and trigger deploys. All runtime secrets stay in Dagster Cloud.

---

## CI / deployment

Deploys are handled by two GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `dagster-cloud-deploy.yml` | Push to `main` (path: `pipeline/**`) | Builds Docker image, deploys to Dagster Cloud prod |
| `dagster-cloud-deploy.yml` | PR opened/updated (path: `pipeline/**`) | Deploys to a Dagster Cloud branch deployment for preview |
| `build-base-image.yml` | Push to `main` changing `Dockerfile.base` | Rebuilds the libpostal base image and pushes to `ghcr.io` |

The base image (`Dockerfile.base`) contains the libpostal build, which takes ~10 minutes. It only needs to be rebuilt when `Dockerfile.base` changes. The main `Dockerfile` layers the pipeline code on top and builds in ~1 minute.

### First-time setup in a new repo

If you move this pipeline to a new GitHub repo, the base image won't exist yet in that repo's container registry. Trigger `build-base-image.yml` manually via workflow_dispatch before the first deploy.

---

## Secrets to rotate if compromised

If any of the following are exposed, rotate them immediately:

- **Supabase service key** — Supabase dashboard → Project Settings → API
- **Apify API token** — Apify console → Settings → Integrations
- **SendGrid API key** — SendGrid dashboard → Settings → API Keys
- **Dagster Cloud API token** — Dagster Cloud → Settings → API Tokens
- **Supabase database password** — Supabase dashboard → Project Settings → Database → Reset password
