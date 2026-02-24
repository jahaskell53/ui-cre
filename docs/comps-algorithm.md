# Comps Algorithm

The comps feature finds comparable rental listings near a subject property, ranked by similarity. It has two parts: a PostgreSQL function (`get_comps`) for spatial filtering and scoring, and a client-side rent estimator that runs on the returned results.

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
- Are more than 10m from the subject coordinates (excludes exact location matches)

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
| Distance | 5% |
| Price | 55% |
| Beds | 20% |
| Baths | 15% |
| Area | 5% |

Effective weights when **price is omitted** (common case — address + beds/baths/area only):

| Component | Weight |
|---|---|
| Distance | 11% |
| Beds | 44% |
| Baths | 33% |
| Area | 11% |

Weights are **normalized by the sum of active weights** — only components where the subject attribute was provided (and the candidate has a value) are included. This means unused weights are redistributed rather than wasted.

```
composite_score = Σ(w_i × score_i) / Σ(w_i)   [for active components only]
```

**Example — address only (no subject attributes):** Falls back to pure distance ranking (`composite_score = dist_score`).

**Example — price + beds provided, baths/area omitted:**
Active weights are distance (5%), price (55%), beds (20%) → sum = 80%.
Each weight is divided by 0.80, so effective weights are ~6% / 69% / 25%.

---

## Step 4 — Rent Estimate (client-side)

After comps are returned, the UI estimates rent for the subject property using its square footage. This step accounts for the fact that $/sqft is not linear — larger units command less per sqft than smaller ones.

### Method: log-linear regression

When **3 or more** comps have both price and area, a log-linear model is fit across all of them:

```
ln(price) = a + b × ln(area)
```

Coefficients `a` and `b` are solved via OLS. The exponent `b` is the **size elasticity** — typically between 0.4 and 0.8 for residential rentals (less than 1 = diminishing returns per sqft). The estimated rent is then:

```
est_rent = exp(a + b × ln(subject_area))
```

The fitted elasticity is shown in the UI so you can see how strongly size is driving rent in the local market.

### Fallback: power law

When fewer than 3 comps have usable data, the model falls back to scaling from the top comp using a fixed elasticity of 0.6:

```
est_rent = top_comp_price × (subject_area / top_comp_area) ^ 0.6
```

### Rounding

The final estimate is rounded to 2 significant figures (e.g. $3,247 → $3,200) to avoid false precision.

---

## Output

Results are returned sorted by `composite_score` descending, limited to `p_limit` rows. The UI additionally shows `$/sqft` per comp and a rent estimate banner above the table when square footage is provided.
