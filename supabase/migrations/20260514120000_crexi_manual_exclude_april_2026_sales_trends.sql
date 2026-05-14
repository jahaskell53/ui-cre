-- One-time: exclude April 2026 Crexi sales comps from sales-trend RPCs.
--
-- April 2026 recorder/Crexi ingestion was incomplete for product charts; this
-- flips the existing soft-exclusion column used by all get_crexi_sales_trends*
-- and map bucket paths (`NOT exclude_from_sales_trends`). No silver deletes.

SET statement_timeout = 0;

UPDATE public.crexi_api_comps
SET exclude_from_sales_trends = true,
    sales_trends_exclusion_reason = coalesce(
        sales_trends_exclusion_reason,
        'crexi_manual_exclude_april_2026_sales_trends'
    )
WHERE is_sales_comp IS TRUE
  AND sale_transaction_date IS NOT NULL
  AND sale_transaction_date::date >= DATE '2026-04-01'
  AND sale_transaction_date::date < DATE '2026-05-01'
  AND exclude_from_sales_trends = false;
