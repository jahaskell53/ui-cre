# Comps Algorithm

The comps feature finds comparable rental listings near a subject property, ranked by similarity. It runs as a PostgreSQL function (`get_comps`) using PostGIS for spatial filtering.

---

## Inputs

| Parameter | Type | Default | Description |
|---|---|---|---|
| `subject_lng` | float | required | Subject property longitude |
| `subject_lat` | float | required | Subject property latitude |
| `radius_m` | float | 3218m (~2 mi) | Search radius in meters |
| `subject_price` | int | null | Monthly rent of subject property |
| `subject_beds` | int | null | Bedroom count |
| `subject_baths` | numeric | null | Bathroom count |
| `subject_area` | int | null | Square footage |
| `p_limit` | int | 10 | Max results to return |

---

## Step 1 — Candidate Selection

The function first identifies the latest scrape run (by `scraped_at`) and filters `cleaned_listings` to candidates that:

- Belong to that run
- Are single-family rentals (`is_sfr = true`)
- Have a valid geometry and a non-null price
- Fall within `radius_m` of the subject, using PostGIS `ST_DWithin` on geography (great-circle distance)

This spatial filter uses a PostGIS spatial index and is the main performance optimization — only a small local subset of the ~12k listings is evaluated.

---

## Step 2 — Individual Component Scores

Each candidate is scored on up to five dimensions. All scores are in the range **[0, 1]**, where 1 is a perfect match.

### Distance score

```
dist_score = 1 / (1 + distance_m / 1000)
```

Smooth decay: a property 0m away scores 1.0, at 1km scores 0.5, at 2km scores 0.33. Always computed (distance is always known).

### Price score

```
price_score = 1 / (1 + |ln(subject_price / candidate_price)|)
```

Uses the log-ratio so that proportional differences are treated symmetrically — a candidate at 2× the rent is penalized the same as one at 0.5×. Only computed when `subject_price` is provided.

### Beds score

```
beds_score = max(0.25, 1.0 - 0.25 × |subject_beds - candidate_beds|)
```

Steps down 0.25 per bedroom difference with a floor of 0.25. A 0-bed difference scores 1.0, a 1-bed difference scores 0.75, a 3+ bed difference scores 0.25. Only computed when both `subject_beds` and `candidate.beds` are non-null.

### Baths score

```
|diff| < 0.5  →  1.00
|diff| < 1.5  →  0.50
otherwise     →  0.25
```

Step function with three tiers. Only computed when both `subject_baths` and `candidate.baths` are non-null.

### Area score

```
area_score = 1 / (1 + |subject_area - candidate_area| / subject_area)
```

Relative difference normalized by the subject area, so a 200 sqft difference matters more for a 600 sqft unit than a 2000 sqft unit. Only computed when both `subject_area` and `candidate.area` are non-null.

---

## Step 3 — Composite Score

Nominal weights (all attributes provided):

| Component | Weight |
|---|---|
| Distance | 10% |
| Price | 50% |
| Beds | 20% |
| Baths | 15% |
| Area | 5% |

Effective weights when **price is omitted** (common case — address + beds/baths/area only):

| Component | Weight |
|---|---|
| Distance | 20% |
| Beds | 40% |
| Baths | 30% |
| Area | 10% |

Weights are **normalized by the sum of active weights** — only components where the subject attribute was provided (and the candidate has a value) are included. This means unused weights are redistributed rather than wasted.

```
composite_score = Σ(w_i × score_i) / Σ(w_i)   [for active components only]
```

**Example — address only (no subject attributes):** Falls back to pure distance ranking (`composite_score = dist_score`).

**Example — price + beds provided, baths/area omitted:**
Active weights are distance (10%), price (50%), beds (20%) → sum = 80%.
Each weight is divided by 0.80, so effective weights are 12.5% / 62.5% / 25%.

---

## Output

Results are returned sorted by `composite_score` descending, limited to `p_limit` rows. The `distance_m` column is always included so the UI can display distance regardless of how it factored into scoring.
