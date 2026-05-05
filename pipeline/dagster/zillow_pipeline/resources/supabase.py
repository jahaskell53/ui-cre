from dagster import ConfigurableResource
from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions

# Crexi bronze lineage backfill sends ~500-row upserts; PostgREST can exceed the
# default ~120s read timeout under load (see Dagster run ReadTimeout failures).
_POSTGREST_CLIENT_TIMEOUT_SEC = 600


class SupabaseResource(ConfigurableResource):
    url: str
    service_key: str

    def get_client(self) -> Client:
        return create_client(
            self.url,
            self.service_key,
            options=SyncClientOptions(
                postgrest_client_timeout=_POSTGREST_CLIENT_TIMEOUT_SEC
            ),
        )
