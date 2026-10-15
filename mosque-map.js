/* Peta masjid berbasis OpenStreetMap; permintaan area pilihan hanya saat tombol cari ditekan. */
(() => {
  'use strict';

  const API = 'https://overpass-api.de/api/interpreter';
  const CITIES = {
    Balikpapan: [-1.2379, 116.8529], Jakarta: [-6.2088, 106.8456],
    Samarinda: [-0.5022, 117.1536], Surabaya: [-7.2575, 112.7521],
    Bandung: [-6.9175, 107.6191], Yogyakarta: [-7.7956, 110.3695],
    Semarang: [-6.9667, 110.4167], Medan: [3.5952, 98.6722],
    Makassar: [-5.1477, 119.4327], Palembang: [-2.9761, 104.7754],
    Banjarmasin: [-3.3186, 114.5944], Denpasar: [-8.6500, 115.2167]
  };
  const RADII = [1000, 2000, 3000, 5000];
  const valid = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  function distance(a, b, c, d) {
    const radians = Math.PI / 180, lat = (c - a) * radians, lon = (d - b) * radians;
    const h = Math.sin(lat / 2) ** 2 + Math.cos(a * radians) * Math.cos(c * radians) * Math.sin(lon / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function places(elements, lat, lon, radius) {
    const rows = [];
    for (const element of elements) {
      if (!['node', 'way', 'relation'].includes(element?.type) || !Number.isSafeInteger(element.id) ||
          element.id <= 0 || element.tags?.amenity !== 'place_of_worship' || element.tags?.religion !== 'muslim') continue;
      const point = element.type === 'node' ? element : element.center;
      if (!point || !valid(point.lat, point.lon)) continue;
      const meters = distance(lat, lon, point.lat, point.lon);
      if (meters > radius) continue;
      const tags = element.tags;
      const rawName = tags['name:id'] || tags.name;
      const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Masjid / musala tanpa nama';
      const label = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
        .filter(value => typeof value === 'string' && value.trim()).join(', ');
      const category = /mushol|musholl|musala|mushala|langgar|surau/i.test(
        String(tags['building'] || '') + ' ' + String(tags.name || '') + ' ' + String(tags['name:id'] || '')
      ) ? 'musala' : 'masjid';
      rows.push({ id: `${element.type}/${element.id}`, name, label, category, meters, lat: point.lat, lon: point.lon });
    }
    rows.sort((a, b) => a.meters - b.meters);
    return rows.filter((row, index) => !rows.slice(0, index).some(other =>
      row.name !== 'Masjid / musala tanpa nama' && row.name.toLowerCase() === other.name.toLowerCase() &&
      distance(row.lat, row.lon, other.lat, other.lon) < 35));
  }
  const distanceLabel = meters => meters < 1000 ? `${Math.round(meters)} m` :
    `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;

  function init() {
    const view = document.getElementById('view-mosques');
    if (!view) return;
    const mapElement = document.getElementById('mosqueMap');
    const list = document.getElementById('mosqueList');
    const status = document.getElementById('mosqueStatus');
    const city = document.getElementById('mosqueCity');
    const radius = document.getElementById('mosqueRadius');
    const filter = document.getElementById('mosqueFilter');
    const search = document.getElementById('mosqueSearch');
    let map, markers, centerMarker, all = [], busy = false, cooldown = 0, controller = null;
    let last = null;

    function message(value, type = '') { status.textContent = value; status.dataset.state = type; }
    function ensureMap() {
      if (map || !window.L) return;
      map = L.map(mapElement, { scrollWheelZoom: false }).setView(CITIES[city.value] || CITIES.Balikpapan, 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      markers = L.layerGroup().addTo(map);
    }
    function reveal() {
      ensureMap();
      if (!map) message('Peta belum tersedia. Coba muat ulang halaman atau buka Google Maps.', 'error');
      else requestAnimationFrame(() => map.invalidateSize());
    }
    function clear() {
      all = []; list.replaceChildren();
      if (markers) markers.clearLayers();
      if (centerMarker) { map.removeLayer(centerMarker); centerMarker = null; }
    }
    function direction(place) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lon}`)}`;
    }
    function render() {
      list.replaceChildren();
      if (markers) markers.clearLayers();
      const shown = all.filter(place => filter.value === 'semua' || place.category === filter.value).slice(0, 30);
      for (const place of shown) {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        const meta = document.createElement('span');
        const address = document.createElement('small');
        const actions = document.createElement('div');
        const show = document.createElement('button');
        const route = document.createElement('a');
        item.className = 'mosque-place';
        title.textContent = place.name;
        meta.textContent = `${distanceLabel(place.meters)} · garis lurus · ${place.category === 'musala' ? 'Musala' : 'Masjid'}`;
        address.textContent = place.label || 'Alamat belum tersedia di OpenStreetMap';
        actions.className = 'mosque-place-actions';
        show.type = 'button'; show.textContent = 'Lihat di peta';
        show.addEventListener('click', () => {
          map.setView([place.lat, place.lon], Math.max(map.getZoom(), 16));
          const marker = markers.getLayers().find(layer => layer.options.placeId === place.id);
          if (marker) marker.openPopup();
          mapElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        route.href = direction(place); route.textContent = 'Petunjuk arah';
        route.target = '_blank'; route.rel = 'noopener noreferrer';
        actions.append(show, route); item.append(title, meta, address, actions); list.append(item);
        if (map) {
          const marker = L.circleMarker([place.lat, place.lon], {
            placeId: place.id, radius: 8, color: '#064e3b', weight: 2, fillColor: '#34d399', fillOpacity: 0.95
          }).addTo(markers);
          const popup = document.createElement('div');
          const name = document.createElement('strong');
          const link = document.createElement('a');
          name.textContent = place.name; link.href = direction(place); link.textContent = 'Petunjuk arah ↗';
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          popup.append(name, document.createElement('br'), link);
          marker.bindPopup(popup);
        }
      }
      if (all.length && !shown.length) message('Tidak ada hasil pada kategori ini. Coba pilih Semua.', 'empty');
      else if (shown.length) message(`Menampilkan ${shown.length}${all.length > 30 && filter.value === 'semua' ? ` dari ${all.length}` : ''} tempat dalam radius ${Number(radius.value) / 1000} km.`, 'success');
    }
    function setCenter(lat, lon, label) {
      ensureMap();
      if (!map) return;
      if (centerMarker) map.removeLayer(centerMarker);
      map.setView([lat, lon], 14);
      centerMarker = L.circleMarker([lat, lon], { radius: 7, color: '#fafafa', weight: 2, fillColor: '#10b981', fillOpacity: 1 })
        .addTo(map).bindTooltip(label);
    }
    async function query(lat, lon) {
      if (!valid(lat, lon) || busy) return;
      if (Date.now() < cooldown) { message('Layanan peta sedang sibuk. Coba lagi setelah 30 detik atau buka Google Maps.', 'error'); return; }
      const meters = Number(radius.value);
      if (!RADII.includes(meters)) return;
      const key = `${lat.toFixed(5)},${lon.toFixed(5)},${meters}`;
      clear(); setCenter(lat, lon, 'Pusat pencarian');
      busy = true; search.disabled = true; city.disabled = true; radius.disabled = true;
      message('Mencari masjid dan musala terpetakan…', 'loading');
      try {
        if (last?.key === key && Date.now() - last.time < 600000) {
          all = last.rows;
        } else {
          const q = `[out:json][timeout:20];nwr(around:${meters},${lat.toFixed(5)},${lon.toFixed(5)})["amenity"="place_of_worship"]["religion"="muslim"];out center tags;`;
          controller = new AbortController();
          const timeout = setTimeout(() => controller?.abort(), 25000);
          try {
            const response = await fetch(API, { method: 'POST', body: new URLSearchParams({ data: q }), credentials: 'omit', signal: controller.signal });
            if ([406, 429].includes(response.status)) { cooldown = Date.now() + 30000; throw new Error('rate'); }
            if (!response.ok) throw new Error('service');
            const data = await response.json();
            if (!Array.isArray(data.elements) || data.remark) throw new Error('service');
            all = places(data.elements, lat, lon, meters);
            last = { key, rows: all, time: Date.now() };
          } finally { clearTimeout(timeout); controller = null; }
        }
        render();
        if (!all.length) message('Belum ada masjid terpetakan di area ini. Coba radius lebih luas atau cari di Google Maps.', 'empty');
      } catch (error) {
        message(error.message === 'rate' ? 'Layanan peta sedang sibuk. Tunggu 30 detik atau buka Google Maps.' :
          'Data masjid belum bisa dimuat. Coba lagi nanti atau cari di Google Maps.', 'error');
      } finally {
        busy = false; search.disabled = false; city.disabled = false; radius.disabled = false;
      }
    }

    document.querySelectorAll('[data-view-target="mosques"]').forEach(button => button.addEventListener('click', reveal));
    city.addEventListener('change', () => {
      clear();
      const point = CITIES[city.value] || CITIES.Balikpapan;
      setCenter(point[0], point[1], city.value);
      message('Peta dipusatkan ke ' + city.value + '. Tekan “Cari di area peta” untuk memuat masjid.');
    });
    search.addEventListener('click', () => {
      ensureMap();
      if (!map) { message('Peta belum tersedia. Gunakan Google Maps untuk sementara.', 'error'); return; }
      const point = map.getCenter();
      query(point.lat, point.lng);
    });
    filter.addEventListener('change', render);
    window.addEventListener('pagehide', () => controller?.abort());
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  if (typeof module !== 'undefined') module.exports = { places, distance };
})();
