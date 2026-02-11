To scale **OpenMidmarket** effectively, the architecture must transition from a "Listing-based" mindset to a "Legal Entity" mindset. By anchoring everything to the **Parcel ID (APN)** while allowing for a "Building" layer above it, you'll solve the fragmentation you saw in Redwood City.

This is the next step after getting the property data From Realie and Zillow. This is the normalize step. 
---

## 🏗️ Pipeline Architecture Summary

The pipeline follows a **Normalize → Link → Resolve** flow to ensure that messy external data is reconciled into a single source of truth.

1. **Ingestion Layer:** Pulls raw data from Zillow (listings), County Records (Realie), and later, Ownership feeds.
2. **Standardization Layer:** * **Address Normalization:** Uses a tool like `libpostal` to turn "297 Gaff St" and "297-301 Gaff Street" into a standardized format.
* **Spatial Pointing:** Geocodes every record to a specific Latitude/Longitude.


3. **Linking Layer (The Core):**
* Maps the standardized address to a **Parcel ID (APN)**.
* If an APN is not found, it uses a **Spatial Join** (finding which parcel boundary the coordinates fall into).


4. **Entity Resolution (The "Master" Building):**
* Groups multiple APNs that share a single building footprint or common owner into one **Building UUID**.
* Aggregates all rent and sales history from different "aliases" (like 297 and 301) under this one UUID.



---

## 🚩 Edge Case Summary & Mitigation

| Edge Case | The "Symptom" | Mitigation Strategy |
| --- | --- | --- |
| **Address Aliases** | Zillow shows "301 Gaff," County shows "297 Gaff." | **Situs Anchor:** Use the County Situs address as the primary label; store Zillow addresses as "aliases" linked to the same APN. |
| **Multi-Parcel Assets** | A 50-unit building spans 3 different APNs. | **Spatial Aggregation:** Use GIS data to find adjacent parcels owned by the same entity. Link all 3 APNs to one "Building UUID." |
| **Address Ranges** | Listing is "299 Gaff," but the legal record is "297-301 Gaff." | **Regex Parsing:** Build a "Range Matcher" in Python. If a single number falls within a known Situs range, it’s an automatic match. |
| **The LLC Veil** | Properties owned by "Gaff Street LLC" and "Redwood Partners LLC." | **Tax Billing Match:** Link properties by "Owner Mailing Address." If the tax bill goes to the same office, they are the same partner. |
| **Unpermitted Units** | City says 4 units; Zillow shows 6 units. | **Delta Flagging:** Create a `unit_count_discrepancy` flag. This identifies "hidden" value-add or zoning risk for your partner. |

---

## 🛠️ Data Schema Concept

```sql
-- The "Source of Truth" Hierarchy
CREATE TABLE building_entities (
    id UUID PRIMARY KEY, -- Your internal ID
    master_situs_address TEXT, 
    total_units_recorded INT,
    geometry POLYGON -- The physical footprint
);

CREATE TABLE parcels (
    apn TEXT PRIMARY KEY,
    building_id UUID REFERENCES building_entities(id),
    situs_address TEXT
);

CREATE TABLE addresses_aliases (
    standardized_address TEXT PRIMARY KEY,
    building_id UUID REFERENCES building_entities(id),
    source_type TEXT -- 'Zillow', 'County', 'MLS'
);

```

By structuring the data this way, your pipeline won't "turn off" the IDs but rather "roll them up." When you query the building on Gaff Street, your system will automatically pull the sales history from APN A and the rent history from Address B because they both point to the same **Building UUID**.