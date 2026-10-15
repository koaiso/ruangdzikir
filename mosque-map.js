/* Pencarian masjid lewat Google Maps; tanpa permintaan GPS perangkat. */
(() => {
  'use strict';

  function searchUrls(city, area) {
    const place = [String(area || '').trim(), String(city || '').trim()].filter(Boolean).join(', ');
    const query = 'masjid dan musala ' + place;
    const encoded = encodeURIComponent(query);
    return {
      embed: 'https://maps.google.com/maps?q=' + encoded + '&output=embed',
      external: 'https://www.google.com/maps/search/?api=1&query=' + encoded
    };
  }

  function init() {
    const view = document.getElementById('view-mosques');
    if (!view) return;
    const city = document.getElementById('mosqueCity');
    const area = document.getElementById('mosqueArea');
    const search = document.getElementById('mosqueSearch');
    const frame = document.getElementById('mosqueFrame');
    const external = document.getElementById('mosqueExternal');
    const status = document.getElementById('mosqueStatus');

    function runSearch() {
      const urls = searchUrls(city.value, area.value.slice(0, 80));
      external.href = urls.external;
      frame.src = urls.embed;
      status.textContent = 'Menampilkan pencarian untuk ' + [area.value.trim(), city.value].filter(Boolean).join(', ') + '. Pilih hasil pada peta untuk petunjuk arah.';
    }

    search.addEventListener('click', runSearch);
    area.addEventListener('keydown', event => {
      if (event.key === 'Enter') runSearch();
    });
    city.addEventListener('change', () => {
      status.textContent = 'Tekan “Cari masjid” untuk memuat hasil di ' + city.value + '.';
    });
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  if (typeof module !== 'undefined') module.exports = { searchUrls };
})();
