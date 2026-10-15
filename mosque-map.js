/* Pencarian masjid lewat Google Maps; GPS hanya diminta saat tombol lokasi ditekan. */
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

  function locationUrls(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    const point = latitude.toFixed(6) + ',' + longitude.toFixed(6);
    return {
      embed: 'https://maps.google.com/maps?q=masjid%20dan%20musala&ll=' +
        encodeURIComponent(point) + '&z=15&output=embed',
      external: 'https://www.google.com/maps/search/masjid+dan+musala/@' + point + ',15z'
    };
  }

  function init() {
    const view = document.getElementById('view-mosques');
    if (!view) return;
    const city = document.getElementById('mosqueCity');
    const area = document.getElementById('mosqueArea');
    const search = document.getElementById('mosqueSearch');
    const locate = document.getElementById('mosqueLocate');
    const frame = document.getElementById('mosqueFrame');
    const external = document.getElementById('mosqueExternal');
    const status = document.getElementById('mosqueStatus');
    let requestId = 0;

    function showResults(urls, description) {
      external.href = urls.external;
      frame.src = urls.embed;
      status.textContent = description + ' Pilih hasil pada peta untuk petunjuk arah.';
    }

    function runSearch() {
      requestId++;
      locate.disabled = false;
      const urls = searchUrls(city.value, area.value.slice(0, 80));
      showResults(urls, 'Menampilkan pencarian untuk ' +
        [area.value.trim(), city.value].filter(Boolean).join(', ') + '.');
    }

    search.addEventListener('click', runSearch);
    area.addEventListener('keydown', event => {
      if (event.key === 'Enter') runSearch();
    });
    city.addEventListener('change', () => {
      status.textContent = 'Tekan “Cari manual” untuk memuat hasil di ' + city.value + '.';
    });

    locate.addEventListener('click', () => {
      if (!window.isSecureContext || !navigator.geolocation) {
        status.textContent = 'Lokasi perangkat tidak tersedia di browser ini. Pilih kota dan cari manual.';
        return;
      }
      const currentRequest = ++requestId;
      locate.disabled = true;
      status.textContent = 'Menentukan lokasi perangkat. Izinkan akses lokasi di browser jika diminta…';
      try {
        navigator.geolocation.getCurrentPosition(
          position => {
            if (currentRequest !== requestId) return;
            locate.disabled = false;
            const { latitude, longitude, accuracy } = position.coords;
            const urls = locationUrls(latitude, longitude);
            if (!urls) {
              status.textContent = 'Koordinat tidak valid. Coba pilih kota dan cari manual.';
              return;
            }
            const precision = Number.isFinite(accuracy) ? ' (perkiraan akurasi ±' + Math.round(accuracy) + ' m)' : '';
            showResults(urls, 'Menampilkan masjid dan musala di sekitar lokasimu' + precision + '.');
          },
          error => {
            if (currentRequest !== requestId) return;
            locate.disabled = false;
            status.textContent = error.code === 1
              ? 'Izin lokasi ditolak. Kamu tetap bisa memilih kota dan cari manual.'
              : 'Lokasi belum bisa ditentukan. Coba lagi atau cari manual dengan kota dan area.';
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      } catch (_) {
        locate.disabled = false;
        status.textContent = 'Lokasi perangkat tidak tersedia. Pilih kota dan cari manual.';
      }
    });
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  if (typeof module !== 'undefined') module.exports = { searchUrls, locationUrls };
})();
