from unittest.mock import MagicMock, patch

from zillow_pipeline.resources.apify import ApifyResource


def test_zillow_property_lookup_uses_address_input():
    dataset = MagicMock()
    dataset.iterate_items.return_value = [{"zpid": 19543462, "homeType": "SINGLE_FAMILY"}]
    actor = MagicMock()
    actor.call.return_value = {"id": "apify-run-1", "defaultDatasetId": "dataset-1"}
    client = MagicMock()
    client.actor.return_value = actor
    client.dataset.return_value = dataset

    resource = ApifyResource(
        api_token="token",
        actor_id="zip-actor",
        detail_actor_id="detail-actor",
        loopnet_search_actor_id="loopnet-search",
        loopnet_detail_actor_id="loopnet-detail",
    )

    log_fn = MagicMock()

    with patch("zillow_pipeline.resources.apify.ApifyClient", return_value=client):
        items = resource.run_zillow_property_lookup("354 Morse Ave, Sunnyvale, CA, 94085", log_fn=log_fn)

    client.actor.assert_called_once_with("detail-actor")
    actor.call.assert_called_once_with(
        run_input={
            "addresses": ["354 Morse Ave, Sunnyvale, CA, 94085"],
            "propertyStatus": "RECENTLY_SOLD",
        }
    )
    client.dataset.assert_called_once_with("dataset-1")
    assert items == [{"zpid": 19543462, "homeType": "SINGLE_FAMILY"}]
    log_fn.assert_called_once_with("Apify Zillow property lookup run apify-run-1 for 354 Morse Ave, Sunnyvale, CA, 94085")
