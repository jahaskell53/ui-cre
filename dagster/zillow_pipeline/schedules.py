from dagster import AssetSelection, ScheduleDefinition, define_asset_job

from zillow_pipeline.assets.cleaned_listings import cleaned_listings
from zillow_pipeline.assets.zip_codes import ba_zip_codes
from zillow_pipeline.assets.zillow_scrape import raw_zillow_scrapes

zillow_scrape_job = define_asset_job(
    name="zillow_weekly_scrape_job",
    selection=AssetSelection.assets(ba_zip_codes, raw_zillow_scrapes),
)

weekly_scrape_schedule = ScheduleDefinition(
    name="weekly_zillow_scrape",
    job=zillow_scrape_job,
    cron_schedule="0 6 * * 1",  # Every Monday at 6am UTC
)

zillow_cleaning_job = define_asset_job(
    name="zillow_cleaning_job",
    selection=AssetSelection.assets(cleaned_listings),
)
