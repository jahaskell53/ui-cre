(async () => {
  const BB = '37mtyq5j5O1j6ikg9D';
  const TOTAL_PAGES = 13;
  const allListings = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    console.log(`Scraping page ${page}/${TOTAL_PAGES}...`);
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
          url: getAttr('div.placard-pseudo > a', 'href'),
          address: get('h4 a') || get('h4'),
          location: get('a.subtitle-beta'),
          price: liItems[0] || '',
          detail1: liItems[1] || '',
          detail2: liItems[2] || '',
          page,
        });
      });

      // Small delay to be polite
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.error(`Page ${page} failed:`, e);
    }
  }

  console.log(`Done! ${allListings.length} listings found.`);

  // Build and download CSV
  const headers = ['url', 'address', 'location', 'price', 'detail1', 'detail2', 'page'];
  const csv = [
    headers.join(','),
    ...allListings.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'loopnet-bay-area-multifamily.csv';
  a.click();
  console.log('CSV downloaded!');
})();
