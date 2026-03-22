import os

import requests
from dagster import AssetSelection, DagsterRunStatus, RunFailureSensorContext, RunRequest, ScheduleDefinition, RunStatusSensorContext, define_asset_job, run_failure_sensor, run_status_sensor

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


@run_failure_sensor(
    monitored_jobs=[zillow_scrape_job, zillow_cleaning_job, zillow_building_job],
)
def alert_on_pipeline_failure(context: RunFailureSensorContext):
    api_key = os.environ.get("SENDGRID_API_KEY")
    alert_email = os.environ.get("ALERT_EMAIL")
    from_email = os.environ.get("SMTP_FROM", "hello@openmidmarket.com")

    if not api_key or not alert_email:
        context.log.warning("SENDGRID_API_KEY or ALERT_EMAIL not set — skipping alert")
        return

    job_name = context.dagster_run.job_name
    run_id = context.dagster_run.run_id
    error_msg = str(context.failure_event.message) if context.failure_event else "Unknown error"

    requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "personalizations": [{"to": [{"email": alert_email}]}],
            "from": {"email": from_email, "name": "OpenMidmarket Pipeline"},
            "subject": f"🚨 Zillow pipeline failed: {job_name}",
            "content": [{
                "type": "text/plain",
                "value": (
                    f"Job: {job_name}\n"
                    f"Run ID: {run_id}\n"
                    f"Error: {error_msg}\n\n"
                    f"Check Dagster Cloud for the full logs."
                ),
            }],
        },
        timeout=10,
    )


@run_status_sensor(
    run_status=DagsterRunStatus.SUCCESS,
    monitored_jobs=[zillow_scrape_job],
    request_job=zillow_cleaning_job,
)
def trigger_cleaning_job_after_scrape(context: RunStatusSensorContext):
    return RunRequest()


@run_status_sensor(
    run_status=DagsterRunStatus.SUCCESS,
    monitored_jobs=[zillow_cleaning_job],
    request_job=zillow_building_job,
)
def trigger_building_job_after_cleaning(context: RunStatusSensorContext):
    return RunRequest()
