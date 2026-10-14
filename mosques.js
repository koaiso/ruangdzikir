/* Nearby places of worship. Coordinates and results stay in memory only. */
(() => {
  'use strict';
  const ENDPOINT = 'https://overpass-api.de/api/interpreter';
  const RADII = [1000, 3000, 5000];

  function validPoint(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  function distanceMeters(aLat, aLon, bLat, bLon) {
    const rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad;
    const dLon = (bLon - aLon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  }

  function nearbyPlaces(elements, lat, lon, radius) {
    if (!validPoint(lat, lon) || !RADII.includes(radius)) return [];
    const places = [];
    const seenIds = new Set();
    for (const item of elements) {
      if (!item || !['node', 'way', 'relation'].includes(item.type) || !Number.isSafeInteger(item.id) || item.id <= 0) continue;
      const tags = item.tags || {};
      if (tags.religion !== 'muslim' || tags.amenity !== 'place_of_worship') continue;
      const point = item.type === 'node' ? item : item.center;
      if (!point || !validPoint(point.lat, point.lon)) continue;
      const distance = distanceMeters(lat, lon, point.lat, point.lon);
      const id = `${item.type}/${item.id}`;
      if (distance > radius || seenIds.has(id)) continue;
      seenIds.add(id);
      const name = [tags['name:id'], tags.name].find(value => typeof value === 'string' && value.trim());
      const address = ['addr:street', 'addr:housenumber', 'addr:suburb', 'addr:city']
        .map(key => tags[key]).filter(value => typeof value === 'string' && value.trim()).join(', ');
      places.push({ id, name: name ? name.trim() : 'Masjid / musala tanpa nama', named: Boolean(name),
        address, lat: point.lat, lon: point.lon, distance });
    }
    places.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    // OSM sometimes represents the same named mosque as both a node and a way.
    return places.filter((place, index) => !place.named || !places.slice(0, index).some(other =>
      other.named && other.name.toLowerCase() === place.name.toLowerCase() &&
      distanceMeters(place.lat, place.lon, other.lat, other.lon) < 35));
  }

  function distanceLabel(distance) {
    return distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
  }

  function init() {
    const section = document.getElementById('view-mosques');
    if (!section) return;
    const button = document.getElementById('mosqueSearch');
    const radiusSelect = document.getElementById('mosqueRadius');
    const status = document.getElementById('mosqueStatus');
    const results = document.getElementById('mosqueResults');
    const accuracy = document.getElementById('mosqueAccuracy');
    let busy = false;
    let cache = null;
    let retryAfter = 0;
    let activeController = null;

    function message(text, state = 'idle') {
      status.textContent = text;
      status.dataset.state = state;
    }

    function render(places) {
      results.replaceChildren();
      for (const place of places.slice(0, 20)) {
        const card = document.createElement('li');
        card.className = 'mosque-result';
        const heading = document.createElement('h2');
        heading.textContent = place.name;
        const distance = document.createElement('span');
        distance.className = 'mosque-distance';
        distance.textContent = `${distanceLabel(place.distance)} · garis lurus`;
        const address = document.createElement('p');
        address.textContent = place.address || 'Alamat belum tercantum di peta.';
        const actions = document.createElement('div');
        actions.className = 'mosque-result-actions';
        const directions = document.createElement('a');
        directions.className = 'secondary-btn';
        directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lon}`)}`;
        directions.textContent = 'Petunjuk arah';
        directions.setAttribute('aria-label', `Petunjuk arah ke ${place.name} (Google Maps, tab baru)`);
        const detail = document.createElement('a');
        detail.href = `https://www.openstreetmap.org/${place.id}`;
        detail.textContent = 'Lihat di peta';
        detail.setAttribute('aria-label', `Lihat ${place.name} di OpenStreetMap (tab baru)`);
        for (const link of [directions, detail]) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          actions.append(link);
        }
        card.append(distance, heading, address, actions);
        results.append(card);
      }
    }

    async function search() {
      if (busy) return;
      if (Date.now() < retryAfter) {
        message('Layanan peta sedang sibuk. Tunggu sekitar 30 detik lalu coba lagi, atau buka Google Maps.', 'error');
        return;
      }
      results.replaceChildren();
      accuracy.textContent = '';
      if (!window.isSecureContext || !navigator.geolocation) {
        message('Lokasi memerlukan browser yang mendukungnya dan koneksi HTTPS. Kamu juga bisa mencari lewat Google Maps.', 'error');
        return;
      }
      const radius = Number(radiusSelect.value);
      if (!RADII.includes(radius)) return;
      busy = true;
      button.disabled = true;
      radiusSelect.disabled = true;
      results.setAttribute('aria-busy', 'true');
      button.textContent = 'Mencari…';
      message('Menentukan lokasimu. Izinkan akses lokasi pada browser.', 'loading');
      try {
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));
        const { latitude, longitude } = position.coords;
        if (!validPoint(latitude, longitude)) throw new Error('invalid-location');
        const lat = Number(latitude.toFixed(5));
        const lon = Number(longitude.toFixed(5));
        const key = `${lat},${lon},${radius}`;
        const precision = position.coords.accuracy;
        if (Number.isFinite(precision)) {
          accuracy.textContent = `Perkiraan akurasi lokasi: ±${distanceLabel(precision)}.${precision > 500 ? ' Lokasi masih kurang akurat; coba dari ponsel dengan GPS aktif.' : ''}`;
        }
        message(`Mencari masjid dan musala dalam radius ${radius / 1000} km…`, 'loading');
        let places;
        if (cache && cache.key === key && Date.now() - cache.time < 300000) {
          places = cache.places;
        } else {
          const query = `[out:json][timeout:20];nwr(around:${radius},${lat},${lon})["amenity"="place_of_worship"]["religion"="muslim"];out center tags;`;
          activeController = new AbortController();
          const timer = setTimeout(() => activeController?.abort(), 25000);
          try {
            const response = await fetch(ENDPOINT, {
              method: 'POST', body: new URLSearchParams({ data: query }),
              credentials: 'omit', signal: activeController.signal
            });
            if (response.status === 429 || response.status === 406) {
              retryAfter = Date.now() + 30000;
              throw new Error('rate-limit');
            }
            if (!response.ok) throw new Error('service');
            const data = await response.json();
            // Overpass can report timeout/partial data in a successful HTTP response.
            if (!Array.isArray(data.elements) || data.remark) throw new Error('service');
            places = nearbyPlaces(data.elements, lat, lon, radius);
            cache = { key, time: Date.now(), places };
          } finally {
            clearTimeout(timer);
            activeController = null;
          }
        }
        render(places);
        message(places.length
          ? `${places.length > 20 ? `Menampilkan 20 dari ${places.length}` : `${places.length}`} masjid / musala terpetakan dalam radius ${radius / 1000} km. Diurutkan dari yang terdekat.`
          : `Belum ada masjid atau musala terpetakan dalam radius ${radius / 1000} km. Coba radius lebih luas atau cari melalui Google Maps.`, places.length ? 'success' : 'empty');
      } catch (error) {
        const errors = {
          1: 'Izin lokasi belum diberikan. Izinkan lokasi lewat pengaturan situs di browser, lalu coba lagi.',
          2: 'Lokasi perangkat belum tersedia. Aktifkan layanan lokasi lalu coba lagi.',
          3: 'Penentuan lokasi terlalu lama. Coba kembali di tempat dengan sinyal GPS lebih baik.'
        };
        message(errors[error.code] || (error.message === 'rate-limit'
          ? 'Layanan peta sedang sibuk. Tunggu 30 detik lalu coba lagi, atau gunakan Google Maps.'
          : 'Data masjid belum bisa dimuat. Periksa koneksi lalu coba lagi, atau gunakan Google Maps.'), 'error');
      } finally {
        busy = false;
        button.disabled = false;
        radiusSelect.disabled = false;
        button.textContent = 'Cari masjid terdekat';
        results.setAttribute('aria-busy', 'false');
      }
    }

    button.addEventListener('click', search);
    radiusSelect.addEventListener('change', () => {
      results.replaceChildren();
      accuracy.textContent = '';
      message('Radius diubah. Tekan “Cari masjid terdekat” untuk mencari kembali.');
    });
    window.addEventListener('pagehide', () => activeController?.abort());
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { distanceMeters, nearbyPlaces, validPoint };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
})();
