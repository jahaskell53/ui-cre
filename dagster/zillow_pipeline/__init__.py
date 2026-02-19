from dagster import Definitions, EnvVar, load_assets_from_modules

from zillow_pipeline.assets import zip_codes, zillow_scrape
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource
from zillow_pipeline.schedules import weekly_scrape_schedule, zillow_scrape_job

all_assets = load_assets_from_modules([zip_codes, zillow_scrape])

defs = Definitions(
    assets=all_assets,
    jobs=[zillow_scrape_job],
    schedules=[weekly_scrape_schedule],
    resources={
        "supabase": SupabaseResource(
            url=EnvVar("SUPABASE_URL"),
            service_key=EnvVar("SUPABASE_SERVICE_KEY"),
        ),
        "apify": ApifyResource(
            api_token=EnvVar("APIFY_API_TOKEN"),
            actor_id=EnvVar("APIFY_ACTOR_ID"),
        ),
    },
)
