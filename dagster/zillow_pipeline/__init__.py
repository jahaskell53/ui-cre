from dagster import Definitions, EnvVar, load_assets_from_modules

from zillow_pipeline.assets import cleaned_listings, zip_codes, zillow_scrape, zillow_building_scrape, cleaned_building_units
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource
from zillow_pipeline.schedules import weekly_scrape_schedule, zillow_cleaning_job, zillow_scrape_job, zillow_building_job, trigger_cleaning_job_after_scrape, trigger_building_job_after_cleaning, alert_on_pipeline_failure, alert_on_pipeline_success

all_assets = load_assets_from_modules([zip_codes, zillow_scrape, cleaned_listings, zillow_building_scrape, cleaned_building_units])

defs = Definitions(
    assets=all_assets,
    jobs=[zillow_scrape_job, zillow_cleaning_job, zillow_building_job],
    schedules=[weekly_scrape_schedule],
    sensors=[trigger_cleaning_job_after_scrape, trigger_building_job_after_cleaning, alert_on_pipeline_failure, alert_on_pipeline_success],
    resources={
        "supabase": SupabaseResource(
            url=EnvVar("SUPABASE_URL"),
            service_key=EnvVar("SUPABASE_SERVICE_KEY"),
        ),
        "apify": ApifyResource(
            api_token=EnvVar("APIFY_API_TOKEN"),
            actor_id=EnvVar("APIFY_ACTOR_ID"),
            detail_actor_id=EnvVar("APIFY_DETAIL_ACTOR_ID"),
        ),
    },
)
