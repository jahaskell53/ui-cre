import os

import requests
from dagster import AssetSelection, DagsterRunStatus, RunFailureSensorContext, RunRequest, ScheduleDefinition, RunStatusSensorContext, define_asset_job, run_failure_sensor, run_status_sensor


def _send_run_alert(job_name: str, run_id: str, success: bool, error_msg: str | None = None) -> None:
    api_key = os.environ.get("SENDGRID_API_KEY")
    alert_email = os.environ.get("ALERT_EMAIL")
    from_email = os.environ.get("SMTP_FROM", "hello@openmidmarket.com")

    if not api_key or not alert_email:
        return

    if success:
        subject = f"✅ Zillow pipeline succeeded: {job_name}"
        body = f"Job: {job_name}\nRun ID: {run_id}\nStatus: SUCCESS"
    else:
        subject = f"🚨 Zillow pipeline failed: {job_name}"
        body = (
            f"Job: {job_name}\nRun ID: {run_id}\nStatus: FAILED\n"
            f"Error: {error_msg or 'Unknown error'}\n\n"
            f"Check Dagster Cloud for the full logs."
        )

    requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "personalizations": [{"to": [{"email": alert_email}]}],
            "from": {"email": from_email, "name": "OpenMidmarket Pipeline"},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
        },
        timeout=10,
    )

from zillow_pipeline.assets.cleaned_listings import cleaned_listings
from zillow_pipeline.assets.zip_codes import ba_zip_codes
from zillow_pipeline.assets.zillow_scrape import raw_zillow_scrapes
from zillow_pipeline.assets.zillow_building_scrape import raw_building_scrapes
from zillow_pipeline.assets.cleaned_building_units import cleaned_building_units
from zillow_pipeline.assets.loopnet_search_scrape import raw_loopnet_search_scrapes
from zillow_pipeline.assets.loopnet_detail_scrape import raw_loopnet_detail_scrapes
from zillow_pipeline.assets.cleaned_loopnet_listings import cleaned_loopnet_listings

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

loopnet_scrape_job = define_asset_job(
    name="loopnet_weekly_scrape_job",
    selection=AssetSelection.assets(raw_loopnet_search_scrapes, raw_loopnet_detail_scrapes),
)

loopnet_cleaning_job = define_asset_job(
    name="loopnet_cleaning_job",
    selection=AssetSelection.assets(cleaned_loopnet_listings),
)

weekly_loopnet_scrape_schedule = ScheduleDefinition(
    name="weekly_loopnet_scrape",
    job=loopnet_scrape_job,
    cron_schedule="0 7 * * 2",  # Every Tuesday at 7am UTC
)


@run_failure_sensor(
    monitored_jobs=[zillow_scrape_job, zillow_cleaning_job, zillow_building_job, loopnet_scrape_job, loopnet_cleaning_job],
)
def alert_on_pipeline_failure(context: RunFailureSensorContext):
    error_msg = str(context.failure_event.message) if context.failure_event else None
    _send_run_alert(context.dagster_run.job_name, context.dagster_run.run_id, success=False, error_msg=error_msg)


@run_status_sensor(
    run_status=DagsterRunStatus.SUCCESS,
    monitored_jobs=[zillow_scrape_job, zillow_cleaning_job, zillow_building_job, loopnet_scrape_job, loopnet_cleaning_job],
)
def alert_on_pipeline_success(context: RunStatusSensorContext):
    _send_run_alert(context.dagster_run.job_name, context.dagster_run.run_id, success=True)


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


@run_status_sensor(
    run_status=DagsterRunStatus.SUCCESS,
    monitored_jobs=[loopnet_scrape_job],
    request_job=loopnet_cleaning_job,
)
def trigger_loopnet_cleaning_after_scrape(context: RunStatusSensorContext):
    return RunRequest()
