# Dagster Plan: Steps 1, 2, and 4

## Overview

Dagster project under `pipeline/dagster/` with the following structure:

```
dagster/
├── pyproject.toml
├── zillow_pipeline/
│   ├── __init__.py
│   ├── assets/
│   │   ├── __init__.py
│   │   ├── zip_codes.py     # Step 1: BA zip codes from Supabase
│   │   └── zillow_scrape.py # Steps 2a/2b + Step 4
│   ├── resources/
│   │   ├── __init__.py
│   │   ├── supabase.py      # Supabase client resource
│   │   └── apify.py         # Apify client resource
│   └── schedules.py         # Step 4: weekly cron schedule
```

---

## Step 1 — `ba_zip_codes` asset

- **Source:** Supabase `zip_codes` table (columns: `zip` text, `active` bool).
- **Asset:** `ba_zip_codes` — queries Supabase, returns a `list[str]` of active BA zip codes.
- **Materialization:** Read-only — source of truth is managed in the DB.

```python
# assets/zip_codes.py
@asset
def ba_zip_codes(supabase: SupabaseResource) -> list[str]:
    rows = supabase.client.table("zip_codes").select("zip").eq("active", True).execute()
    return [r["zip"] for r in rows.data]
```

---

## Step 2 — `raw_zillow_scrapes` asset

- **Depends on:** `ba_zip_codes`
- **Action:** For each zip, call Apify's Zillow Search Scraper actor and collect the raw JSON response.
- **Storage:** Insert each response into Supabase `raw_zillow_scrapes` table:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (pk) | `gen_random_uuid()` |
| `zip_code` | text | |
| `scraped_at` | timestamptz | Set once per run |
| `run_id` | text | Dagster run ID for traceability |
| `raw_json` | jsonb | Full Apify response |

```python
# assets/zillow_scrape.py
@asset(deps=[ba_zip_codes])
def raw_zillow_scrapes(context, ba_zip_codes, apify: ApifyResource, supabase: SupabaseResource):
    scraped_at = datetime.utcnow().isoformat()
    rows = []
    for zip_code in ba_zip_codes:
        data = apify.run_zillow_search(zip_code)
        rows.append({
            "zip_code": zip_code,
            "scraped_at": scraped_at,
            "run_id": context.run_id,
            "raw_json": data,
        })
    supabase.client.table("raw_zillow_scrapes").insert(rows).execute()
    return Output(value=len(rows), metadata={"zip_count": len(ba_zip_codes)})
```

---

## Step 4 — Weekly schedule

- **Schedule:** `ScheduleDefinition` with `cron_schedule="0 6 * * 1"` (every Monday 6am UTC).
- **Job:** Materializes `ba_zip_codes` → `raw_zillow_scrapes` in sequence.
- Each run inserts with a fresh `scraped_at` and `run_id`, so historical data is preserved automatically.

```python
# schedules.py
weekly_scrape_schedule = ScheduleDefinition(
    job=zillow_scrape_job,
    cron_schedule="0 6 * * 1",
)
```

---

## Resources

Two `@ConfigurableResource` classes configured via environment variables:

| Resource | Env vars |
|---|---|
| `SupabaseResource` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `ApifyResource` | `APIFY_API_TOKEN`, `APIFY_ACTOR_ID` |

---

## Supabase Table DDL

Run once to set up the tables:

```sql
-- Step 1 source
create table zip_codes (
  zip text primary key,
  active boolean default true
);

-- Step 2b storage
create table raw_zillow_scrapes (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null,
  scraped_at timestamptz not null,
  run_id text not null,
  raw_json jsonb not null
);

create index on raw_zillow_scrapes (zip_code, scraped_at desc);
```

---

## Out of scope

- Step 3 (SFR filtering, cleaning, normalization) — separate asset chain
- Step 5 (diffs, trends, comps) — downstream assets
