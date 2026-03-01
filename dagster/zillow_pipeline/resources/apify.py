from dagster import ConfigurableResource
from apify_client import ApifyClient


class ApifyResource(ConfigurableResource):
    api_token: str
    # Set APIFY_ACTOR_ID to the actor you want to use
    actor_id: str
    detail_actor_id: str

    def run_zillow_search(self, zip_code: str) -> list[dict]:
        client = ApifyClient(self.api_token)
        run = client.actor(self.actor_id).call(
            run_input={
                "zipCodes": [zip_code],
                "daysOnZillow": "",
                "forRent": True,
                "forSaleByAgent": False,
                "forSaleByOwner": False,
                "sold": False,
            }
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())

    def run_zillow_detail(self, detail_url: str) -> list[dict]:
        client = ApifyClient(self.api_token)
        run = client.actor(self.detail_actor_id).call(
            run_input={"startUrls": [{"url": detail_url}], "type": "FOR_RENT"}
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())
