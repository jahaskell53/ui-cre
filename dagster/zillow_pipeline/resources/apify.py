from dagster import ConfigurableResource
from apify_client import ApifyClient


class ApifyResource(ConfigurableResource):
    api_token: str
    # Set APIFY_ACTOR_ID to the actor you want to use
    actor_id: str

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
                "priceMin": 0,
                "priceMax": None,
            }
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())
