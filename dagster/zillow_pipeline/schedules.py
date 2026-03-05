from dagster import AssetSelection, DagsterRunStatus, RunRequest, ScheduleDefinition, RunStatusSensorContext, define_asset_job, run_status_sensor

from zillow_pipeline.assets.cleaned_listings import cleaned_listings
from zillow_pipeline.assets.zip_codes import ba_zip_codes
from zillow_pipeline.assets.zillow_scrape import raw_zillow_scrapes
from zillow_pipeline.assets.zillow_building_scrape import raw_building_scrapes
from zillow_pipeline.assets.cleaned_building_units import cleaned_building_units

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

zillow_building_job = define_asset_job(
    name="zillow_building_job",
    selection=AssetSelection.assets(raw_building_scrapes, cleaned_building_units),
)


@run_status_sensor(
    run_status=DagsterRunStatus.SUCCESS,
    monitored_jobs=[zillow_cleaning_job],
    request_job=zillow_building_job,
)
def trigger_building_job_after_cleaning(context: RunStatusSensorContext):
    return RunRequest()
