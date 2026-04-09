(async (startIndex = 0) => {
  const BB = '37mtyq5j5O1j6ikg9D';
  const TOTAL_PAGES = 13;
  const STORAGE_KEY = 'loopnet_scrape';

  // ── Resume from localStorage if available ────────────────────────────────
  const saved = localStorage.getItem(STORAGE_KEY);
  const allListings = saved ? JSON.parse(saved) : [];

  if (allListings.length > 0) {
    console.log(`[Resume] Loaded ${allListings.length} listings from localStorage.`);
    // Derive startIndex from how many have been detail-fetched already
    if (startIndex === 0) {
      startIndex = allListings.filter(l => 'num_units' in l).length;
      console.log(`[Resume] Auto-resuming Phase 2 from index ${startIndex}.`);
    }
  }

  // ── Phase 1: Scrape search result pages (skip if already loaded) ─────────
  if (allListings.length === 0) {
    for (let page = 1; page <= TOTAL_PAGES; page++) {
      console.log(`[Phase 1] Scraping search page ${page}/${TOTAL_PAGES}...`);
      const url = `https://www.loopnet.com/search/apartment-buildings/for-sale/${page}/?bb=${BB}&view=map`;

      try {
        const res = await fetch(url, { credentials: 'include' });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const cards = doc.querySelectorAll('article.placard');
        cards.forEach(card => {
          const liItems = Array.from(card.querySelectorAll('li'))
            .map(li => li.textContent.trim()).filter(Boolean);
          const getAttr = (sel, attr) => { const el = card.querySelector(sel); return el ? el.getAttribute(attr) : ''; };
          const get = (sel) => { const el = card.querySelector(sel); return el ? el.textContent.trim() : ''; };
          allListings.push({
            url: getAttr('a.placard-carousel-pseudo', 'ng-href') || getAttr('div.placard-pseudo > a', 'ng-href'),
            address: get('h4 a') || get('h4'),
            location: get('a.subtitle-beta'),
            price: liItems[0] || '',
            detail1: liItems[1] || '',
            detail2: liItems[2] || '',
            page,
          });
        });

        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.error(`Page ${page} failed:`, e);
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allListings));
    console.log(`[Phase 1] Done. ${allListings.length} listings saved to localStorage.`);
  } else {
    console.log(`[Phase 1] Skipped — using ${allListings.length} listings from localStorage.`);
  }

  // ── Phase 2: Fetch detail pages and extract JSON-LD ──────────────────────
  function extractJsonLd(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.additionalProperty) return data;
      } catch (_) {}
    }
    return null;
  }

  function getProp(data, name) {
    const prop = data.additionalProperty.find(p => p.name === name);
    return prop ? (prop.value[0] || '') : '';
  }

  if (startIndex > 0) console.log(`[Phase 2] Resuming from index ${startIndex}...`);
  for (let i = startIndex; i < allListings.length; i++) {
    const listing = allListings[i];
    if (!listing.url) continue;

    console.log(`[Phase 2] ${i + 1}/${allListings.length} ${listing.url}`);

    try {
      const res = await fetch(listing.url, { credentials: 'include' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const data = extractJsonLd(doc);

      if (data) {
        listing.description      = data.description || '';
        listing.date_modified    = data.dateModified || '';
        listing.price_per_unit   = getProp(data, 'Price Per Unit');
        listing.grm              = getProp(data, 'Gross Rent Multiplier');
        listing.num_units        = getProp(data, 'No. Units');
        listing.property_subtype = getProp(data, 'Property Subtype');
        listing.apartment_style  = getProp(data, 'Apartment Style');
        listing.building_class   = getProp(data, 'Building Class');
        listing.lot_size         = getProp(data, 'Lot Size');
        listing.building_size    = getProp(data, 'Building Size');
        listing.num_stories      = getProp(data, 'No. Stories');
        listing.year_built       = getProp(data, 'Year Built');
        listing.zoning           = getProp(data, 'Zoning');
      }
    } catch (e) {
      console.error(`Detail fetch failed for ${listing.url}:`, e);
    }

    // Save progress to localStorage after every listing
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allListings));

    // Pause every 25 requests to reset sliding-window rate limits
    if ((i + 1) % 25 === 0) {
      console.log(`[Phase 2] Pausing 45s after ${i + 1} requests...`);
      await new Promise(r => setTimeout(r, 45000));
    } else {
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));
    }
  }

  console.log('[Phase 2] Done. Building CSV...');

  // ── Download CSV ──────────────────────────────────────────────────────────
  const headers = [
    'url', 'address', 'location', 'price', 'detail1', 'detail2', 'page',
    'description', 'date_modified', 'price_per_unit', 'grm', 'num_units',
    'property_subtype', 'apartment_style', 'building_class',
    'lot_size', 'building_size', 'num_stories', 'year_built', 'zoning',
  ];

  const csv = [
    headers.join(','),
    ...allListings.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.download = `${ts}-loopnet-bay-area-multifamily.csv`;
  a.click();
  console.log('CSV downloaded!');

  // Clear localStorage on successful completion
  localStorage.removeItem(STORAGE_KEY);
  console.log('[Done] localStorage cleared.');
})();
