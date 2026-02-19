from dagster import ConfigurableResource
from supabase import create_client, Client


class SupabaseResource(ConfigurableResource):
    url: str
    service_key: str

    def get_client(self) -> Client:
        return create_client(self.url, self.service_key)
