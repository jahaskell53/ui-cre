from dagster import asset
from zillow_pipeline.resources.supabase import SupabaseResource


@asset
def ba_zip_codes(supabase: SupabaseResource) -> list[str]:
    client = supabase.get_client()
    result = client.table("zip_codes").select("zip").eq("active", True).execute()
    return [row["zip"] for row in result.data]
