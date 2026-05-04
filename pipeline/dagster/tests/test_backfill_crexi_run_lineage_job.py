"""backfill_crexi_run_lineage_job must allow long runs (Dagster+ run monitoring)."""

from zillow_pipeline.jobs.backfill_crexi_run_lineage import backfill_crexi_run_lineage_job


def test_backfill_crexi_run_lineage_job_has_extended_max_runtime_tag():
    tags = backfill_crexi_run_lineage_job.tags
    raw = tags.get("dagster/max_runtime")
    assert raw is not None
    assert int(raw) == 4 * 60 * 60
