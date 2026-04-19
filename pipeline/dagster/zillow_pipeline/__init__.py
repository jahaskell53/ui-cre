from dagster import Definitions, EnvVar, load_assets_from_modules

from zillow_pipeline.assets import cleaned_listings, zip_codes, zillow_scrape, zillow_building_scrape, cleaned_building_units, refresh_unit_breakdown_views, loopnet_search_scrape, loopnet_detail_scrape, cleaned_loopnet_listings, download_om_pdfs
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.s3 import S3Resource
from zillow_pipeline.resources.supabase import SupabaseResource
from zillow_pipeline.schedules import weekly_scrape_schedule, weekly_loopnet_scrape_schedule, zillow_cleaning_job, zillow_scrape_job, zillow_building_job, loopnet_scrape_job, loopnet_cleaning_job, loopnet_om_job, trigger_cleaning_job_after_scrape, trigger_building_job_after_cleaning, trigger_loopnet_cleaning_after_scrape, trigger_om_download_after_cleaning, alert_on_pipeline_failure, alert_on_pipeline_success

all_assets = load_assets_from_modules([zip_codes, zillow_scrape, cleaned_listings, zillow_building_scrape, cleaned_building_units, refresh_unit_breakdown_views, loopnet_search_scrape, loopnet_detail_scrape, cleaned_loopnet_listings, download_om_pdfs])

defs = Definitions(
    assets=all_assets,
    jobs=[zillow_scrape_job, zillow_cleaning_job, zillow_building_job, loopnet_scrape_job, loopnet_cleaning_job, loopnet_om_job],
    schedules=[weekly_scrape_schedule, weekly_loopnet_scrape_schedule],
    sensors=[
        trigger_cleaning_job_after_scrape,
        trigger_building_job_after_cleaning,
        trigger_loopnet_cleaning_after_scrape,
        trigger_om_download_after_cleaning,
        alert_on_pipeline_failure,
        alert_on_pipeline_success,  # remove this to only alert on failures
    ],
    resources={
        "supabase": SupabaseResource(
            url=EnvVar("SUPABASE_URL"),
            service_key=EnvVar("SUPABASE_SERVICE_ROLE_KEY"),
        ),
        "apify": ApifyResource(
            api_token=EnvVar("APIFY_API_TOKEN"),
            actor_id=EnvVar("APIFY_ACTOR_ID"),
            detail_actor_id=EnvVar("APIFY_DETAIL_ACTOR_ID"),
            loopnet_search_actor_id=EnvVar("APIFY_LOOPNET_SEARCH_ACTOR_ID"),
            loopnet_detail_actor_id=EnvVar("APIFY_LOOPNET_DETAIL_ACTOR_ID"),
        ),
        "s3": S3Resource(
            aws_access_key_id=EnvVar("ACCESS_KEY"),
            aws_secret_access_key=EnvVar("SECRET_ACCESS_KEY"),
            aws_region=EnvVar("AWS_REGION"),
            bucket_name=EnvVar("AWS_S3_BUCKET"),
        ),
    },
)
