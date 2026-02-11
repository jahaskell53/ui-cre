Edge Case,"The ""Real-World"" Problem",Pipeline Solution
"The ""Alias"" Address","Zillow shows ""301 Gaff,"" Realie shows ""297-301 Gaff.""","Range Parsing: Before matching, strip the numbers. If ""301"" exists within the ""297-301"" range, treat it as a match."
Multi-Parcel Asset,Your 50-unit building sits on 3 adjacent parcels.,"Spatial Grouping: If 3 APNs share an owner and are touching on a map, group them under one Building_UUID."
APN Format Mismatch,Realie: 052-331-040 vs. Zillow: 052331040.,Sanitization: Strip all hyphens and leading zeros from every APN before comparing them in your database.
"The ""Phantom"" Unit","County says 4 legal units, but Zillow shows a 6-unit listing.","Discrepancy Flag: Create a flag has_unpermitted_units. This is a massive ""value-add"" signal for your partner."
Nominal Sales,Realie shows a $0 sale (likely an LLC transfer).,"Transfer Filter: Ignore any transferPrice < $10,000 when calculating market-rate sales comps."