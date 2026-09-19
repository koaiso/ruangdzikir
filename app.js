(() => {
  'use strict';

  const API = {
    quran: 'https://equran.id/api/v2',
    prayer: 'https://api.aladhan.com/v1'
  };

  const DEFAULT_CITY = 'Jakarta';
  const DEFAULT_COUNTRY = 'Indonesia';
  const PRAYER_METHOD = 20; // Kementerian Agama Republik Indonesia (AlAdhan)
  const SURAH_CACHE_KEY = 'ruangdzikir:surahs:v2';
  const SETTINGS_KEY = 'ruangdzikir:settings:v1';
  const TASBIH_KEY = 'ruangdzikir:tasbih:v1';
  const KAABA = { latitude: 21.422487, longitude: 39.826206 };
  const CITY_COORDS = {
    Balikpapan: [-1.2379, 116.8529],
    Jakarta: [-6.2088, 106.8456],
    Samarinda: [-0.5022, 117.1536],
    Surabaya: [-7.2575, 112.7521],
    Bandung: [-6.9175, 107.6191],
    Yogyakarta: [-7.7956, 110.3695],
    Semarang: [-6.9667, 110.4167],
    Medan: [3.5952, 98.6722],
    Makassar: [-5.1477, 119.4327],
    Palembang: [-2.9761, 104.7754],
    Banjarmasin: [-3.3186, 114.5944],
    Denpasar: [-8.6500, 115.2167]
  };

  const state = {
    currentView: 'home',
    surahs: [],
    filteredSurahs: [],
    prayer: null,
    prayerTimer: null,
    prayerRequestId: 0,
    location: null,
    qibla: {
      latitude: null,
      longitude: null,
      bearing: null,
      heading: null,
      sensorActive: false,
      sensorHandler: null,
      hasAbsoluteHeading: false
    },
    settings: normalizeSettings(getStoredObject(SETTINGS_KEY, {})),
    tasbih: normalizeTasbih(getStoredObject(TASBIH_KEY, {
      count: 0,
      dhikr: 'Subhanallah',
      target: 33,
      vibration: true
    }))
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  document.addEventListener('DOMContentLoaded', init);

  // Permanent dark theme. No OS/browser theme detection is used.
  const enforcePermanentDark = () => {
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'only dark';
    document.documentElement.style.backgroundColor = '#09090b';
    if (document.body) {
      document.body.style.backgroundColor = '#09090b';
      document.body.style.color = '#f4f4f5';
    }
  };
  enforcePermanentDark();

  function init() {
    initNavigation();
    initMobileMenu();
    initLocationModal();
    initQuran();
    initIqro();
    initAsmaulHusna();
    initQibla();
    initTasbih();

    $('#footerYear').textContent = new Date().getFullYear();
    refreshIcons();
    requestPrayerTimes();
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function initNavigation() {
    $$('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.viewTarget));
    });
  }

  function switchView(view) {
    if (!['home', 'quran', 'iqro', 'asmaul', 'qibla', 'tasbih'].includes(view)) return;
    state.currentView = view;

    $$('.app-view').forEach(section => {
      const active = section.dataset.view === view;
      section.classList.toggle('hidden', !active);
      if (active) {
        section.classList.remove('view-enter');
        void section.offsetWidth;
        section.classList.add('view-enter');
      }
    });

    $$('.nav-link, .mobile-nav-link').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.viewTarget === view);
    });

    $('#mobileMenu').classList.add('hidden');
    $('#mobileMenuButton').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'quran' && !state.surahs.length) loadSurahs();
    if (view === 'qibla') renderQibla();
  }

  function initMobileMenu() {
    $('#mobileMenuButton').addEventListener('click', () => {
      const menu = $('#mobileMenu');
      const willOpen = menu.classList.contains('hidden');
      menu.classList.toggle('hidden');
      $('#mobileMenuButton').setAttribute('aria-expanded', String(willOpen));
    });
  }

  // -------------------------
  // Prayer times
  // -------------------------

  function initLocationModal() {
    const modal = $('#locationModal');
    const open = () => {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    };

    $('#openLocationModal').addEventListener('click', open);
    $('#closeLocationModal').addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });

    $('#useDeviceLocation').addEventListener('click', () => {
      close();
      requestPrayerTimes({ forceDevice: true });
    });

    $('#applyManualCity').addEventListener('click', () => {
      const city = $('#manualCity').value;
      state.settings.prayerMode = 'city';
      state.settings.city = city;
      saveJSON(SETTINGS_KEY, state.settings);
      close();
      requestPrayerTimes();
    });

    $('#refreshPrayer').addEventListener('click', () => requestPrayerTimes({ refresh: true }));
  }

  async function requestPrayerTimes({ forceDevice = false } = {}) {
    const requestId = ++state.prayerRequestId;
    setPrayerUI('loading');

    if (!forceDevice && state.settings.prayerMode === 'city' && state.settings.city) {
      $('#manualCity').value = state.settings.city;
      await fetchPrayerByCity(state.settings.city, requestId);
      return;
    }

    if (!navigator.geolocation) {
      await fallbackToDefaultCity('Geolocation tidak tersedia di browser ini.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        if (requestId !== state.prayerRequestId) return;
        const { latitude, longitude } = pos.coords;
        state.settings.prayerMode = 'device';
        saveJSON(SETTINGS_KEY, state.settings);
        await fetchPrayerByCoordinates(latitude, longitude, requestId);
      },
      async () => {
        if (requestId !== state.prayerRequestId) return;
        await fallbackToDefaultCity('Izin lokasi tidak diberikan. Jadwal dialihkan ke Jakarta.', requestId);
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30 * 60 * 1000 }
    );
  }

  async function fallbackToDefaultCity(message, requestId = state.prayerRequestId) {
    if (requestId !== state.prayerRequestId) return;
    state.settings.prayerMode = 'city';
    state.settings.city = state.settings.city || DEFAULT_CITY;
    saveJSON(SETTINGS_KEY, state.settings);
    showToast(message);
    await fetchPrayerByCity(state.settings.city, requestId);
  }

  async function fetchPrayerByCoordinates(latitude, longitude, requestId = state.prayerRequestId) {
    try {
      const date = formatApiDate(new Date());
      const url = `${API.prayer}/timings/${date}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&method=${PRAYER_METHOD}`;
      const res = await fetchJSON(url, 12000);
      if (requestId !== state.prayerRequestId) return;
      if (res.code !== 200 || !res.data?.timings) throw new Error('Respons jadwal tidak valid.');

      state.location = { type: 'device', latitude, longitude };
      updateQiblaLocation(latitude, longitude, 'Lokasi perangkat');
      $('#locationLabel').textContent = `Lokasi perangkat · ${res.data.meta?.timezone || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`}`;
      applyPrayerData(res.data);
    } catch (err) {
      if (requestId !== state.prayerRequestId) return;
      await fallbackToDefaultCity('Lokasi ditemukan, tetapi jadwal gagal dimuat. Menggunakan kota manual.', requestId);
    }
  }

  async function fetchPrayerByCity(city, requestId = state.prayerRequestId) {
    if (requestId !== state.prayerRequestId) return;
    const safeCity = sanitizeText(city, DEFAULT_CITY);
    setPrayerUI('loading');
    $('#locationLabel').textContent = `${safeCity}, Indonesia`;
    try {
      const date = formatApiDate(new Date());
      const url = `${API.prayer}/timingsByCity/${date}?city=${encodeURIComponent(safeCity)}&country=${encodeURIComponent(DEFAULT_COUNTRY)}&method=${PRAYER_METHOD}`;
      const res = await fetchJSON(url, 12000);
      if (requestId !== state.prayerRequestId) return;
      if (res.code !== 200 || !res.data?.timings) throw new Error('Respons jadwal tidak valid.');

      state.location = { type: 'city', city };
      applyPrayerData(res.data);
    } catch (err) {
      if (requestId !== state.prayerRequestId) return;
      setPrayerUI('error', err.message || 'Gagal menghubungi layanan jadwal sholat.');
    }
  }

  function applyPrayerData(data) {
    state.prayer = data;
    const timings = data.timings;
    const display = [
      ['Subuh', timings.Fajr, 'sunrise'],
      ['Terbit', timings.Sunrise, 'sun'],
      ['Dzuhur', timings.Dhuhr, 'cloud-sun'],
      ['Ashar', timings.Asr, 'sun-medium'],
      ['Maghrib', timings.Maghrib, 'sunset'],
      ['Isya', timings.Isha, 'moon']
    ];

    $('#prayerDate').textContent = formatIndonesianDate(data.date?.gregorian?.date || null);
    const hijri = data.date?.hijri;
    $('#hijriDate').textContent = hijri ? formatHijriIndonesian(hijri) : 'Tanggal Hijriah';
    $('#prayerMethod').textContent = `Perhitungan: ${data.meta?.method?.name || 'Kementerian Agama Republik Indonesia'} · ${data.meta?.timezone || 'zona waktu setempat'}.`;

    const grid = $('#prayerGrid');
    grid.innerHTML = display.map(([name, time, icon]) => `
      <div class="prayer-item" data-prayer-card="${name}">
        <i data-lucide="${icon}" class="mx-auto h-4 w-4 text-zinc-400"></i>
        <div class="mt-2 text-[11px] font-medium text-zinc-500 !text-zinc-400">${escapeHTML(name)}</div>
        <div class="mt-1 text-sm font-semibold tabular-nums text-zinc-900 !text-zinc-100">${escapeHTML(cleanTime(time))}</div>
      </div>
    `).join('');

    setPrayerUI('content');
    refreshIcons();
    startPrayerCountdown();
  }

  function startPrayerCountdown() {
    clearInterval(state.prayerTimer);
    updatePrayerCountdown();
    state.prayerTimer = setInterval(updatePrayerCountdown, 1000);
  }

  function updatePrayerCountdown() {
    if (!state.prayer?.timings) return;
    const t = state.prayer.timings;
    const timezone = state.prayer.meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = getTimePartsInZone(timezone);
    const nowSeconds = now.hour * 3600 + now.minute * 60 + now.second;
    const prayers = [
      { name: 'Subuh', time: cleanTime(t.Fajr) },
      { name: 'Dzuhur', time: cleanTime(t.Dhuhr) },
      { name: 'Ashar', time: cleanTime(t.Asr) },
      { name: 'Maghrib', time: cleanTime(t.Maghrib) },
      { name: 'Isya', time: cleanTime(t.Isha) }
    ];

    let next = null;
    for (const p of prayers) {
      const sec = hhmmToSeconds(p.time);
      if (sec > nowSeconds) { next = { ...p, diff: sec - nowSeconds }; break; }
    }
    if (!next) {
      const fajr = hhmmToSeconds(prayers[0].time);
      next = { ...prayers[0], diff: (86400 - nowSeconds) + fajr };
    }

    $('#nextPrayerName').textContent = next.name;
    $('#nextPrayerTime').textContent = `Pukul ${next.time}`;
    $('#prayerCountdown').textContent = secondsToClock(next.diff);
    $$('[data-prayer-card]').forEach(card => card.classList.toggle('is-next', card.dataset.prayerCard === next.name));
  }

  function setPrayerUI(mode, message = '') {
    $('#prayerLoading').classList.toggle('hidden', mode !== 'loading');
    $('#prayerContent').classList.toggle('hidden', mode !== 'content');
    $('#prayerError').classList.toggle('hidden', mode !== 'error');
    if (mode === 'error') $('#prayerErrorText').textContent = message;
  }

  // -------------------------
  // Quran
  // -------------------------

  function initQuran() {
    $('#surahSearch').addEventListener('input', e => filterSurahs(e.target.value));
    $('#reloadSurahs').addEventListener('click', () => loadSurahs(true));
    $('#backToSurahs').addEventListener('click', closeSurahReader);
    $('#scrollTopReader').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  async function loadSurahs(force = false) {
    if (state.surahs.length && !force) return;
    $('#surahLoading').classList.remove('hidden');
    $('#surahList').classList.add('hidden');
    $('#reloadSurahs').classList.add('hidden');
    $('#surahCount').textContent = 'Memuat daftar surah...';

    if (!force) {
      const cached = loadJSON(SURAH_CACHE_KEY, null);
      if (cached?.data?.length === 114 && Date.now() - cached.savedAt < 24 * 60 * 60 * 1000) {
        state.surahs = cached.data;
        state.filteredSurahs = cached.data;
        renderSurahs();
        return;
      }
    }

    try {
      const res = await fetchJSON(`${API.quran}/surat`, 15000);
      const list = Array.isArray(res.data) ? res.data : [];
      if (!list.length) throw new Error('Daftar surah kosong.');
      state.surahs = list;
      state.filteredSurahs = list;
      saveJSON(SURAH_CACHE_KEY, { savedAt: Date.now(), data: list });
      renderSurahs();
    } catch (err) {
      $('#surahLoading').classList.add('hidden');
      $('#surahCount').textContent = 'Daftar surah gagal dimuat.';
      $('#reloadSurahs').classList.remove('hidden');
      showToast('Gagal mengambil data Al-Quran. Periksa koneksi internet.');
    }
  }

  function filterSurahs(query) {
    const queryVariants = makeSearchVariants(query);
    state.filteredSurahs = queryVariants.length === 0 ? state.surahs : state.surahs.filter(s => {
      const fields = [s.nomor, s.namaLatin, s.nama, s.arti, s.tempatTurun];
      const fieldVariants = fields.flatMap(makeSearchVariants);
      return queryVariants.some(q => fieldVariants.some(value => value.includes(q)));
    });
    renderSurahs();
  }

  function renderSurahs() {
    const list = $('#surahList');
    $('#surahLoading').classList.add('hidden');
    list.classList.remove('hidden');
    $('#surahCount').textContent = `${state.filteredSurahs.length} dari ${state.surahs.length || 114} surah`;
    $('#surahEmpty').classList.toggle('hidden', state.filteredSurahs.length !== 0);

    list.innerHTML = state.filteredSurahs.map(s => `
      <button class="surah-card" data-surah="${Number(s.nomor)}">
        <span class="surah-number">${Number(s.nomor)}</span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold tracking-[-0.015em] text-zinc-900 !text-zinc-100">${escapeHTML(s.namaLatin)}</span>
          <span class="mt-1 block truncate text-xs text-zinc-500 !text-zinc-400">${escapeHTML(s.arti)} · ${escapeHTML(s.tempatTurun)} · ${Number(s.jumlahAyat)} ayat</span>
        </span>
        <span class="font-arabic text-xl text-zinc-700 !text-zinc-200" dir="rtl">${escapeHTML(s.nama)}</span>
      </button>
    `).join('');

    $$('[data-surah]', list).forEach(btn => btn.addEventListener('click', () => openSurah(Number(btn.dataset.surah))));
  }

  async function openSurah(number) {
    $('#surahDirectory').classList.add('hidden');
    $('#surahReader').classList.remove('hidden');
    $('#readerLoading').classList.remove('hidden');
    $('#ayatList').classList.add('hidden');
    $('#readerError').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const basic = state.surahs.find(s => Number(s.nomor) === number);
    $('#readerTitle').textContent = sanitizeText(basic?.namaLatin || `Surah ${number}`, `Surah ${number}`);
    $('#readerMeta').textContent = sanitizeText(basic ? `${basic.tempatTurun} · ${basic.jumlahAyat} ayat` : 'Memuat...', 'Memuat...');

    const cacheKey = `ruangdzikir:surah:${number}:v2`;
    const cached = loadJSON(cacheKey, null);
    if (cached?.data?.ayat?.length && Date.now() - cached.savedAt < 6 * 60 * 60 * 1000) {
      renderSurahDetail(cached.data);
      return;
    }

    try {
      const res = await fetchJSON(`${API.quran}/surat/${number}`, 18000);
      if (!res.data?.ayat?.length) throw new Error('Ayat tidak tersedia.');
      try { saveJSON(cacheKey, { savedAt: Date.now(), data: res.data }); } catch (_) {}
      renderSurahDetail(res.data);
    } catch (err) {
      $('#readerLoading').classList.add('hidden');
      const readerError = $('#readerError');
      readerError.classList.remove('hidden');
      readerError.innerHTML = '';
      const title = document.createElement('strong');
      title.textContent = 'Surah belum dapat dimuat.';
      const message = document.createElement('p');
      message.className = 'mt-1 opacity-80';
      message.textContent = sanitizeText(err.message || 'Silakan kembali dan coba lagi.', 'Silakan kembali dan coba lagi.');
      readerError.appendChild(title);
      readerError.appendChild(message);
    }
  }

  function renderSurahDetail(surah) {
    const safeSurah = {
      nomor: Number(surah?.nomor) || 1,
      namaLatin: sanitizeText(surah?.namaLatin, 'Surah'),
      tempatTurun: sanitizeText(surah?.tempatTurun, 'Tempat turun'),
      jumlahAyat: Number(surah?.jumlahAyat) || 0,
      arti: sanitizeText(surah?.arti, 'Terjemahan'),
      ayat: Array.isArray(surah?.ayat) ? surah.ayat : []
    };

    $('#readerTitle').textContent = `${safeSurah.nomor}. ${safeSurah.namaLatin}`;
    $('#readerMeta').textContent = `${safeSurah.tempatTurun} · ${safeSurah.jumlahAyat} ayat · ${safeSurah.arti}`;

    const ayatList = $('#ayatList');
    ayatList.innerHTML = safeSurah.ayat.map(a => `
      <section class="ayah-card" id="ayat-${Number(a.nomorAyat)}">
        <div class="mb-4 flex items-center justify-between gap-4">
          <span class="inline-grid h-8 min-w-8 place-items-center rounded-xl bg-zinc-100 px-2 text-[11px] font-bold text-zinc-600 !bg-zinc-800 !text-zinc-300">${Number(a.nomorAyat)}</span>
          <span class="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">${escapeHTML(safeSurah.namaLatin)} · ${Number(a.nomorAyat)}</span>
        </div>
        <p class="arabic-text">${escapeHTML(sanitizeText(a.teksArab, ''))}</p>
        <div class="mt-6 border-t border-zinc-100 pt-5 !border-zinc-800/80">
          <p class="latin-text">${escapeHTML(sanitizeText(a.teksLatin, ''))}</p>
          <p class="translation-text mt-3">${escapeHTML(sanitizeText(a.teksIndonesia, ''))}</p>
        </div>
      </section>
    `).join('');

    $('#readerLoading').classList.add('hidden');
    ayatList.classList.remove('hidden');
  }

  function closeSurahReader() {
    $('#surahReader').classList.add('hidden');
    $('#surahDirectory').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // -------------------------
  // Huruf Hijaiyah
  // -------------------------

  function initIqro() {
    const letters = [
      {char:'ا', name:'Alif', sound:'a', example:'اَ', read:'a', hint:'Alif adalah huruf pertama. Bentuk dasarnya tegak dan sederhana.'},
      {char:'ب', name:'Ba', sound:'ba', example:'بَ', read:'ba', hint:'Ba memiliki satu titik di bawah. Bedakan dari Ta dan Tsa.'},
      {char:'ت', name:'Ta', sound:'ta', example:'تَ', read:'ta', hint:'Ta memiliki dua titik di atas.'},
      {char:'ث', name:'Tsa', sound:'tsa', example:'ثَ', read:'tsa', hint:'Tsa memiliki tiga titik di atas.'},
      {char:'ج', name:'Jim', sound:'ja', example:'جَ', read:'ja', hint:'Jim memiliki satu titik di bawah bagian lengkung.'},
      {char:'ح', name:'Ha', sound:'ha', example:'حَ', read:'ha', hint:'Ha ini tidak memiliki titik. Bunyi keluar dari tenggorokan dengan lembut.'},
      {char:'خ', name:'Kha', sound:'kha', example:'خَ', read:'kha', hint:'Kha bentuknya mirip Ha, tetapi memiliki satu titik di atas.'},
      {char:'د', name:'Dal', sound:'da', example:'دَ', read:'da', hint:'Dal berbentuk sederhana dan tidak memiliki titik.'},
      {char:'ذ', name:'Dzal', sound:'dza', example:'ذَ', read:'dza', hint:'Dzal mirip Dal dengan satu titik di atas.'},
      {char:'ر', name:'Ra', sound:'ra', example:'رَ', read:'ra', hint:'Ra memiliki bentuk melengkung ke bawah dan tidak bertitik.'},
      {char:'ز', name:'Zai', sound:'za', example:'زَ', read:'za', hint:'Zai mirip Ra dengan satu titik di atas.'},
      {char:'س', name:'Sin', sound:'sa', example:'سَ', read:'sa', hint:'Sin memiliki tiga gerigi kecil dan tidak bertitik.'},
      {char:'ش', name:'Syin', sound:'sya', example:'شَ', read:'sya', hint:'Syin mirip Sin dengan tiga titik di atas.'},
      {char:'ص', name:'Shad', sound:'sha', example:'صَ', read:'sha', hint:'Shad dibaca lebih tebal daripada Sin.'},
      {char:'ض', name:'Dhad', sound:'dha', example:'ضَ', read:'dha', hint:'Dhad mirip Shad dengan satu titik di atas.'},
      {char:'ط', name:'Tha', sound:'tha', example:'طَ', read:'tha', hint:'Tha dibaca tebal. Bentuknya tegak dengan lengkungan di bagian bawah.'},
      {char:'ظ', name:'Zha', sound:'zha', example:'ظَ', read:'zha', hint:'Zha mirip Tha dengan satu titik di atas.'},
      {char:'ع', name:'Ain', sound:"'a", example:'عَ', read:"'a", hint:'Ain memiliki bentuk khas dan bunyinya keluar dari tengah tenggorokan.'},
      {char:'غ', name:'Ghain', sound:'gha', example:'غَ', read:'gha', hint:'Ghain mirip Ain dengan satu titik di atas.'},
      {char:'ف', name:'Fa', sound:'fa', example:'فَ', read:'fa', hint:'Fa memiliki satu titik di atas.'},
      {char:'ق', name:'Qaf', sound:'qa', example:'قَ', read:'qa', hint:'Qaf memiliki dua titik di atas dan bunyinya lebih dalam daripada Kaf.'},
      {char:'ك', name:'Kaf', sound:'ka', example:'كَ', read:'ka', hint:'Kaf memiliki bentuk khas dengan bagian kecil di tengah.'},
      {char:'ل', name:'Lam', sound:'la', example:'لَ', read:'la', hint:'Lam berbentuk tinggi dan melengkung di bawah.'},
      {char:'م', name:'Mim', sound:'ma', example:'مَ', read:'ma', hint:'Mim dibaca dengan kedua bibir bertemu.'},
      {char:'ن', name:'Nun', sound:'na', example:'نَ', read:'na', hint:'Nun memiliki satu titik di atas.'},
      {char:'ه', name:'Ha', sound:'ha', example:'هَ', read:'ha', hint:'Ha ini berbeda dari ح. Bentuk dan tempat keluarnya bunyi juga berbeda.'},
      {char:'و', name:'Wau', sound:'wa', example:'وَ', read:'wa', hint:'Wau berbentuk kecil melengkung. Dapat menjadi huruf mad pada kondisi tertentu.'},
      {char:'ي', name:'Ya', sound:'ya', example:'يَ', read:'ya', hint:'Ya memiliki dua titik di bawah pada bentuk dasarnya.'}
    ];

    const grid = $('#hijaiyahGrid');
    let active = 0;

    grid.innerHTML = letters.map((item, i) => `
      <button class="hijaiyah-char ${i === 0 ? 'is-active' : ''}" type="button" data-hijaiyah="${i}" aria-label="${escapeHTML(item.name)}">${escapeHTML(item.char)}</button>
    `).join('');

    const renderLetter = (index) => {
      active = index;
      const item = letters[index];
      $('#hijaiyahIndex').textContent = `Huruf ${String(index + 1).padStart(2,'0')}`;
      $('#hijaiyahName').textContent = item.name;
      $('#hijaiyahLetter').textContent = item.char;
      $('#hijaiyahLatin').textContent = item.name;
      $('#hijaiyahSound').textContent = item.sound;
      $('#hijaiyahExample').textContent = item.example;
      $('#hijaiyahExampleRead').textContent = `dibaca: ${item.read}`;
      $('#hijaiyahHint').textContent = item.hint;
      $$('.hijaiyah-char').forEach((btn, i) => btn.classList.toggle('is-active', i === index));
    };

    $$('[data-hijaiyah]').forEach(btn => {
      btn.addEventListener('click', () => renderLetter(Number(btn.dataset.hijaiyah)));
    });

    $('#nextHijaiyah').addEventListener('click', () => {
      const next = (active + 1) % letters.length;
      renderLetter(next);
      document.querySelector(`[data-hijaiyah="${next}"]`)?.scrollIntoView({behavior:'smooth', block:'nearest', inline:'nearest'});
    });

    renderLetter(0);
    refreshIcons();
  }


  // -------------------------
  // Asmaul Husna
  // -------------------------

  function initAsmaulHusna() {
    const names = [
      ['الرَّحْمَنُ','Ar-Rahman','Yang Maha Pengasih'],
      ['الرَّحِيمُ','Ar-Rahim','Yang Maha Penyayang'],
      ['الْمَلِكُ','Al-Malik','Yang Maha Merajai'],
      ['الْقُدُّوسُ','Al-Quddus','Yang Maha Suci'],
      ['السَّلَامُ','As-Salam','Yang Maha Memberi Kesejahteraan'],
      ['الْمُؤْمِنُ','Al-Mu’min','Yang Maha Memberi Keamanan'],
      ['الْمُهَيْمِنُ','Al-Muhaimin','Yang Maha Memelihara'],
      ['الْعَزِيزُ','Al-‘Aziz','Yang Maha Perkasa'],
      ['الْجَبَّارُ','Al-Jabbar','Yang Maha Kuasa'],
      ['الْمُتَكَبِّرُ','Al-Mutakabbir','Yang Maha Megah'],
      ['الْخَالِقُ','Al-Khaliq','Yang Maha Pencipta'],
      ['الْبَارِئُ','Al-Bari’','Yang Maha Mengadakan'],
      ['الْمُصَوِّرُ','Al-Musawwir','Yang Maha Membentuk Rupa'],
      ['الْغَفَّارُ','Al-Ghaffar','Yang Maha Pengampun'],
      ['الْقَهَّارُ','Al-Qahhar','Yang Maha Menundukkan'],
      ['الْوَهَّابُ','Al-Wahhab','Yang Maha Pemberi Karunia'],
      ['الرَّزَّاقُ','Ar-Razzaq','Yang Maha Pemberi Rezeki'],
      ['الْفَتَّاحُ','Al-Fattah','Yang Maha Pembuka'],
      ['اَلْعَلِيْمُ','Al-‘Alim','Yang Maha Mengetahui'],
      ['الْقَابِضُ','Al-Qabid','Yang Maha Menyempitkan'],
      ['الْبَاسِطُ','Al-Basit','Yang Maha Melapangkan'],
      ['الْخَافِضُ','Al-Khafid','Yang Maha Merendahkan'],
      ['الرَّافِعُ','Ar-Rafi’','Yang Maha Meninggikan'],
      ['الْمُعِزُّ','Al-Mu‘izz','Yang Maha Memuliakan'],
      ['المُذِلُّ','Al-Muzill','Yang Maha Menghinakan'],
      ['السَّمِيعُ','As-Sami’','Yang Maha Mendengar'],
      ['الْبَصِيرُ','Al-Basir','Yang Maha Melihat'],
      ['الْحَكَمُ','Al-Hakam','Yang Maha Menetapkan'],
      ['الْعَدْلُ','Al-‘Adl','Yang Maha Adil'],
      ['اللَّطِيفُ','Al-Latif','Yang Maha Lembut'],
      ['الْخَبِيرُ','Al-Khabir','Yang Maha Mengetahui Rahasia'],
      ['الْحَلِيمُ','Al-Halim','Yang Maha Penyantun'],
      ['الْعَظِيمُ','Al-‘Azim','Yang Maha Agung'],
      ['الْغَفُورُ','Al-Ghafur','Yang Maha Pengampun'],
      ['الشَّكُورُ','Asy-Syakur','Yang Maha Membalas Kebaikan'],
      ['الْعَلِيُّ','Al-‘Aliyy','Yang Maha Tinggi'],
      ['الْكَبِيرُ','Al-Kabir','Yang Maha Besar'],
      ['الْحَفِيظُ','Al-Hafiz','Yang Maha Memelihara'],
      ['المُقِيت','Al-Muqit','Yang Maha Pemberi Kecukupan'],
      ['الْحسِيبُ','Al-Hasib','Yang Maha Membuat Perhitungan'],
      ['الْجَلِيلُ','Al-Jalil','Yang Maha Luhur'],
      ['الْكَرِيمُ','Al-Karim','Yang Maha Pemurah'],
      ['الرَّقِيبُ','Ar-Raqib','Yang Maha Mengawasi'],
      ['الْمُجِيبُ','Al-Mujib','Yang Maha Mengabulkan'],
      ['الْوَاسِعُ','Al-Wasi’','Yang Maha Luas'],
      ['الْحَكِيمُ','Al-Hakim','Yang Maha Bijaksana'],
      ['الْوَدُودُ','Al-Wadud','Yang Maha Mengasihi'],
      ['الْمَجِيدُ','Al-Majid','Yang Maha Mulia'],
      ['الْبَاعِثُ','Al-Ba’its','Yang Maha Membangkitkan'],
      ['الشَّهِيدُ','Asy-Syahid','Yang Maha Menyaksikan'],
      ['الْحَقُّ','Al-Haqq','Yang Maha Benar'],
      ['الْوَكِيلُ','Al-Wakil','Yang Maha Memelihara'],
      ['الْقَوِيُّ','Al-Qawiyy','Yang Maha Kuat'],
      ['الْمَتِينُ','Al-Matin','Yang Maha Kokoh'],
      ['الْوَلِيُّ','Al-Waliyy','Yang Maha Melindungi'],
      ['الْحَمِيدُ','Al-Hamid','Yang Maha Terpuji'],
      ['الْمُحْصِي','Al-Muhsi','Yang Maha Menghitung'],
      ['الْمُبْدِئُ','Al-Mubdi’','Yang Maha Memulai'],
      ['الْمُعِيدُ','Al-Mu’id','Yang Maha Mengembalikan Kehidupan'],
      ['الْمُحْيِي','Al-Muhyi','Yang Maha Menghidupkan'],
      ['اَلْمُمِيتُ','Al-Mumit','Yang Maha Mematikan'],
      ['الْحَيُّ','Al-Hayy','Yang Maha Hidup'],
      ['الْقَيُّومُ','Al-Qayyum','Yang Maha Mandiri'],
      ['الْوَاجِدُ','Al-Wajid','Yang Maha Menemukan'],
      ['الْمَاجِدُ','Al-Maajid','Yang Maha Mulia'],
      ['الْواحِدُ','Al-Wahid','Yang Maha Tunggal'],
      ['اَلاَحَدُ','Al-Ahad','Yang Maha Esa'],
      ['الصَّمَدُ','As-Samad','Yang Maha Dibutuhkan'],
      ['الْقَادِرُ','Al-Qadir','Yang Maha Menentukan'],
      ['الْمُقْتَدِرُ','Al-Muqtadir','Yang Maha Berkuasa'],
      ['الْمُقَدِّمُ','Al-Muqaddim','Yang Maha Mendahulukan'],
      ['الْمُؤَخِّرُ','Al-Mu’akhkhir','Yang Maha Mengakhirkan'],
      ['الأوَّلُ','Al-Awwal','Yang Maha Awal'],
      ['الآخِرُ','Al-Akhir','Yang Maha Akhir'],
      ['الظَّاهِرُ','Az-Zahir','Yang Maha Nyata'],
      ['الْبَاطِنُ','Al-Batin','Yang Maha Ghaib'],
      ['الْوَالِي','Al-Wali','Yang Maha Memerintah'],
      ['الْمُتَعَالِي','Al-Muta’ali','Yang Maha Tinggi'],
      ['الْبَرُّ','Al-Barr','Yang Maha Penderma'],
      ['التَّوَابُ','At-Tawwab','Yang Maha Penerima Tobat'],
      ['الْمُنْتَقِمُ','Al-Muntaqim','Yang Maha Pemberi Balasan'],
      ['العَفُوُّ','Al-‘Afuww','Yang Maha Pemaaf'],
      ['الرَّؤُوفُ','Ar-Ra’uf','Yang Maha Belas Kasih'],
      ['مَالِكُ الْمُلْكِ','Malikul-Mulk','Yang Maha Penguasa Kerajaan'],
      ['ذُوالْجَلَالِ وَالإكْرَامِ','Dzul-Jalali wal-Ikram','Yang Memiliki Kebesaran dan Kemuliaan'],
      ['الْمُقْسِطُ','Al-Muqsit','Yang Maha Adil'],
      ['الْجَامِعُ','Al-Jami’','Yang Maha Mengumpulkan'],
      ['الْغَنِيُّ','Al-Ghaniyy','Yang Maha Kaya'],
      ['الْمُغْنِي','Al-Mughni','Yang Maha Memberi Kekayaan'],
      ['اَلْمَانِعُ','Al-Mani’','Yang Maha Mencegah'],
      ['الضَّارَّ','Ad-Darr','Yang Maha Menimpakan Kemudaratan'],
      ['النَّافِعُ','An-Nafi’','Yang Maha Memberi Manfaat'],
      ['النُّورُ','An-Nur','Yang Maha Bercahaya'],
      ['الْهَادِي','Al-Hadi','Yang Maha Pemberi Petunjuk'],
      ['الْبَدِيعُ','Al-Badi’','Yang Maha Pencipta Tanpa Contoh'],
      ['اَلْبَاقِي','Al-Baqi','Yang Maha Kekal'],
      ['الْوَارِثُ','Al-Warits','Yang Maha Pewaris'],
      ['الرَّشِيدُ','Ar-Rasyid','Yang Maha Membimbing'],
      ['الصَّبُورُ','As-Sabur','Yang Maha Sabar']
    ];

    const grid = $('#asmaulGrid');
    const search = $('#asmaulSearch');
    const count = $('#asmaulCount');
    const empty = $('#asmaulEmpty');
    const clear = $('#clearAsmaulSearch');

    const render = (query = '') => {
      const queryVariants = makeSearchVariants(query);
      const filtered = names.filter(([arabic, latin, meaning]) => {
        if (queryVariants.length === 0) return true;
        const fieldVariants = [arabic, latin, meaning].flatMap(makeSearchVariants);
        return queryVariants.some(q => fieldVariants.some(value => value.includes(q)));
      });

      grid.innerHTML = filtered.map((item) => {
        const originalIndex = names.indexOf(item) + 1;
        const [arabic, latin, meaning] = item;
        return `
          <article class="asmaul-card">
            <div class="asmaul-card-head">
              <span class="asmaul-number">${String(originalIndex).padStart(2, '0')}</span>
              <span class="asmaul-translit">${escapeHTML(latin)}</span>
            </div>
            <div class="asmaul-arabic" dir="rtl">${escapeHTML(arabic)}</div>
            <h3 class="asmaul-name">${escapeHTML(latin)}</h3>
            <p class="asmaul-meaning">${escapeHTML(meaning)}</p>
          </article>`;
      }).join('');

      count.textContent = queryVariants.length ? `${filtered.length} dari 99 nama` : '99 nama';
      empty.classList.toggle('hidden', filtered.length > 0);
      grid.classList.toggle('hidden', filtered.length === 0);
      clear.classList.toggle('hidden', queryVariants.length === 0);
    };

    search.addEventListener('input', e => render(e.target.value));
    clear.addEventListener('click', () => {
      search.value = '';
      render();
      search.focus();
    });

    render();
  }

  // -------------------------
  // Qibla compass
  // -------------------------

  function initQibla() {
    $('#qiblaUseLocation')?.addEventListener('click', requestQiblaLocation);
    $('#qiblaEnableCompass')?.addEventListener('click', enableCompassSensor);
    $('#qiblaUseCity')?.addEventListener('click', () => {
      const city = $('#qiblaCity').value;
      const coords = CITY_COORDS[city];
      if (!coords) return;
      updateQiblaLocation(coords[0], coords[1], `${city}, Indonesia`);
      showToast(`Arah kiblat dihitung dari ${city}.`);
    });

    const preferredCity = state.settings.city && CITY_COORDS[state.settings.city] ? state.settings.city : DEFAULT_CITY;
    if ($('#qiblaCity')) $('#qiblaCity').value = preferredCity;
    const coords = CITY_COORDS[preferredCity];
    if (coords) updateQiblaLocation(coords[0], coords[1], `${preferredCity}, Indonesia`, false);
  }

  function requestQiblaLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation tidak tersedia. Pilih kota secara manual.');
      return;
    }

    const btn = $('#qiblaUseLocation');
    const previous = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="qibla-spinner"></span>Mencari lokasi...';

    navigator.geolocation.getCurrentPosition(
      pos => {
        btn.disabled = false;
        btn.innerHTML = previous;
        updateQiblaLocation(pos.coords.latitude, pos.coords.longitude, 'Lokasi perangkat');
        refreshIcons();
        showToast('Lokasi ditemukan. Arah kiblat diperbarui.');
      },
      () => {
        btn.disabled = false;
        btn.innerHTML = previous;
        refreshIcons();
        showToast('Izin lokasi tidak diberikan. Gunakan pilihan kota.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function updateQiblaLocation(latitude, longitude, label = 'Lokasi perangkat', announce = true) {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return;
    state.qibla.latitude = Number(latitude);
    state.qibla.longitude = Number(longitude);
    state.qibla.bearing = calculateBearing(latitude, longitude, KAABA.latitude, KAABA.longitude);
    state.qibla.distance = calculateDistance(latitude, longitude, KAABA.latitude, KAABA.longitude);
    state.qibla.locationLabel = label;
    renderQibla();
    if (announce && state.currentView === 'qibla') refreshIcons();
  }

  function renderQibla() {
    if (!$('#qiblaArrow')) return;
    const q = state.qibla;
    $('#qiblaLocationLabel').textContent = q.locationLabel || 'Belum ditentukan';
    $('#qiblaBearing').textContent = Number.isFinite(q.bearing) ? `${q.bearing.toFixed(1)}°` : '—';
    $('#qiblaDistance').textContent = Number.isFinite(q.distance) ? `${Math.round(q.distance).toLocaleString('id-ID')} km` : '—';
    $('#deviceHeading').textContent = Number.isFinite(q.heading) ? `${Math.round(q.heading)}°` : '—';

    if (!Number.isFinite(q.bearing)) {
      $('#qiblaArrow').style.transform = 'rotate(0deg)';
      $('#qiblaLiveStatus').textContent = 'Aktifkan lokasi untuk menghitung arah kiblat.';
      $('#qiblaCompassWrap').classList.remove('is-aligned');
      return;
    }

    const relative = Number.isFinite(q.heading) ? normalizeDegrees(q.bearing - q.heading) : q.bearing;
    $('#qiblaArrow').style.transform = `rotate(${relative}deg)`;

    if (Number.isFinite(q.heading)) {
      const signed = normalizeSignedDegrees(relative);
      const aligned = Math.abs(signed) <= 5;
      $('#qiblaCompassWrap').classList.toggle('is-aligned', aligned);
      $('#qiblaLiveStatus').textContent = aligned
        ? 'Arah ponsel sudah menghadap kiblat.'
        : signed > 0
          ? `Putar sekitar ${Math.round(Math.abs(signed))}° ke kanan.`
          : `Putar sekitar ${Math.round(Math.abs(signed))}° ke kiri.`;
    } else {
      $('#qiblaCompassWrap').classList.remove('is-aligned');
      $('#qiblaLiveStatus').textContent = `Kiblat berada pada azimut ${q.bearing.toFixed(1)}° dari utara. Aktifkan kompas untuk panduan langsung.`;
    }
  }

  async function enableCompassSensor() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      showToast('Sensor kompas tidak tersedia di perangkat ini.');
      $('#qiblaLiveStatus').textContent = 'Sensor kompas tidak tersedia. Gunakan nilai azimut sebagai panduan.';
      return;
    }

    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Izin sensor tidak diberikan.');
      }

      const handler = event => {
        const heading = getDeviceHeading(event);
        if (!Number.isFinite(heading)) return;

        if (state.qibla.hasAbsoluteHeading && !event.absolute && !('webkitCompassHeading' in event)) return;
        if (event.absolute) state.qibla.hasAbsoluteHeading = true;

        state.qibla.heading = smoothHeading(state.qibla.heading, heading);
        if (!state.qibla.sensorActive) {
          state.qibla.sensorActive = true;
          setCompassButtonState('Kompas aktif');
        }
        renderQibla();
      };

      if (state.qibla.sensorHandler) {
        window.removeEventListener('deviceorientationabsolute', state.qibla.sensorHandler, true);
        window.removeEventListener('deviceorientation', state.qibla.sensorHandler, true);
      }
      state.qibla.sensorHandler = handler;
      window.addEventListener('deviceorientationabsolute', handler, true);
      window.addEventListener('deviceorientation', handler, true);
      state.qibla.sensorActive = false;
      state.qibla.heading = null;
      state.qibla.hasAbsoluteHeading = false;
      setCompassButtonState('Menunggu sensor...');
      showToast('Kompas aktif. Letakkan ponsel mendatar.');
    } catch (err) {
      showToast(err.message || 'Kompas tidak dapat diaktifkan.');
    }
  }

  function setCompassButtonState(label) {
    const button = $('#qiblaEnableCompass');
    if (!button) return;
    button.textContent = '';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'compass');
    icon.className = 'h-4 w-4';
    const text = document.createElement('span');
    text.textContent = sanitizeText(label, 'Kompas');
    button.appendChild(icon);
    button.appendChild(text);
    refreshIcons();
  }

  function getDeviceHeading(event) {
    if (typeof event.webkitCompassHeading === 'number') {
      return normalizeDegrees(event.webkitCompassHeading);
    }

    if (typeof event.alpha !== 'number') return null;

    const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
    return normalizeDegrees(360 - event.alpha + Number(screenAngle));
  }

  function smoothHeading(previous, next) {
    if (!Number.isFinite(previous)) return next;
    const delta = normalizeSignedDegrees(next - previous);
    return normalizeDegrees(previous + delta * 0.18);
  }

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(Number(lat1));
    const φ2 = toRad(Number(lat2));
    const Δλ = toRad(Number(lon2) - Number(lon1));
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return normalizeDegrees(toDeg(Math.atan2(y, x)));
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadiusKm = 6371.0088;
    const φ1 = toRad(Number(lat1));
    const φ2 = toRad(Number(lat2));
    const Δφ = toRad(Number(lat2) - Number(lat1));
    const Δλ = toRad(Number(lon2) - Number(lon1));
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function normalizeDegrees(value) {
    return (Number(value) % 360 + 360) % 360;
  }

  function normalizeSignedDegrees(value) {
    const degrees = normalizeDegrees(value);
    return degrees > 180 ? degrees - 360 : degrees;
  }

  function toRad(value) {
    return Number(value) * Math.PI / 180;
  }

  function toDeg(value) {
    return Number(value) * 180 / Math.PI;
  }

  // -------------------------
  // Tasbih
  // -------------------------

  function initTasbih() {
    const tasbih = state.tasbih;
    $('#dhikrSelect').value = ['Subhanallah', 'Alhamdulillah', 'Allahu Akbar', 'Astaghfirullah'].includes(tasbih.dhikr) ? tasbih.dhikr : 'custom';
    if ($('#dhikrSelect').value === 'custom') {
      $('#customDhikrWrap').classList.remove('hidden');
      $('#customDhikr').value = tasbih.dhikr || '';
    }
    $('#targetSelect').value = String([33, 99, 100, 0].includes(Number(tasbih.target)) ? tasbih.target : 33);
    tasbih.target = Number($('#targetSelect').value);
    tasbih.count = Number(tasbih.count) || 0;
    tasbih.vibration = tasbih.vibration !== false;

    $('#dhikrSelect').addEventListener('change', e => {
      const custom = e.target.value === 'custom';
      $('#customDhikrWrap').classList.toggle('hidden', !custom);
      tasbih.dhikr = custom ? ($('#customDhikr').value.trim() || 'Dzikir') : e.target.value;
      tasbih.count = 0;
      persistTasbih();
      renderTasbih();
      if (custom) $('#customDhikr').focus();
    });

    $('#customDhikr').addEventListener('input', e => {
      tasbih.dhikr = e.target.value.trim() || 'Dzikir';
      persistTasbih();
      renderTasbih();
    });

    $('#targetSelect').addEventListener('change', e => {
      tasbih.target = Number(e.target.value);
      tasbih.count = 0;
      persistTasbih();
      renderTasbih();
    });

    $('#tasbihButton').addEventListener('click', incrementTasbih);
    $('#resetTasbih').addEventListener('click', () => {
      tasbih.count = 0;
      persistTasbih();
      renderTasbih();
      showToast('Hitungan direset.');
    });

    $('#vibrationToggle').addEventListener('click', () => {
      tasbih.vibration = !tasbih.vibration;
      persistTasbih();
      renderTasbih();
    });

    renderTasbih();
  }

  function incrementTasbih() {
    const t = state.tasbih;
    t.count += 1;

    if (t.vibration && navigator.vibrate) navigator.vibrate(18);

    if (t.target > 0 && t.count >= t.target) {
      renderTasbih();
      if (t.vibration && navigator.vibrate) setTimeout(() => navigator.vibrate([35, 45, 35]), 40);
      showToast(`Target ${t.target} tercapai. Hitungan dimulai kembali.`);
      setTimeout(() => {
        t.count = 0;
        persistTasbih();
        renderTasbih();
      }, 650);
    } else {
      persistTasbih();
      renderTasbih();
    }
  }

  function renderTasbih() {
    const t = state.tasbih;
    $('#tasbihCount').textContent = t.count;
    $('#dhikrName').textContent = t.dhikr || 'Dzikir';
    $('#targetProgress').textContent = t.target > 0 ? `${t.count} dari ${t.target}` : `${t.count} hitungan · tanpa target`;
    $('#vibrationLabel').textContent = t.vibration ? 'Getar aktif' : 'Getar mati';
    $('#vibrationToggle').setAttribute('aria-pressed', String(t.vibration));

    const progress = t.target > 0 ? Math.min(100, (t.count / t.target) * 100) : 0;
    $('#progressRing').style.strokeDashoffset = String(100 - progress);
  }

  function persistTasbih() {
    saveJSON(TASBIH_KEY, state.tasbih);
  }

  // -------------------------
  // Helpers
  // -------------------------

  async function fetchJSON(url, timeout = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`Layanan merespons ${res.status}.`);
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Permintaan terlalu lama. Silakan coba lagi.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function formatApiDate(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${date.getFullYear()}`;
  }

  function formatHijriIndonesian(hijri) {
    const months = {
      1: 'Muharram', 2: 'Safar', 3: 'Rabiul Awal', 4: 'Rabiul Akhir',
      5: 'Jumadil Awal', 6: 'Jumadil Akhir', 7: 'Rajab', 8: 'Syakban',
      9: 'Ramadan', 10: 'Syawal', 11: 'Zulkaidah', 12: 'Zulhijah'
    };
    const monthNumber = Number(hijri?.month?.number);
    const monthName = months[monthNumber] || hijri?.month?.en || '';
    return `${hijri?.day || ''} ${monthName} ${hijri?.year || ''} H`.replace(/\s+/g, ' ').trim();
  }

  function formatIndonesianDate(apiDate) {
    if (!apiDate) return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const [d, m, y] = apiDate.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function getTimePartsInZone(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).formatToParts(new Date());
      const map = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
      return { hour: map.hour === 24 ? 0 : map.hour, minute: map.minute, second: map.second };
    } catch (_) {
      const d = new Date();
      return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
    }
  }

  function cleanTime(value = '') {
    return String(value).match(/\d{1,2}:\d{2}/)?.[0]?.padStart(5, '0') || '--:--';
  }

  function hhmmToSeconds(hhmm) {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return hours * 3600 + minutes * 60;
  }
  function secondsToClock(total) {
    total = Math.max(0, Math.floor(total));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }

  function normalizeText(value = '') {
    return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function makeSearchVariants(value = '') {
    const base = normalizeText(value);
    if (!base) return [];

    // Buat pencarian toleran terhadap spasi, tanda hubung, apostrof,
    // dan beberapa variasi transliterasi yang umum dipakai di Indonesia.
    const compact = base
      .replace(/[’'`´-]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9\u0600-\u06ff]/g, '');

    const phonetic = compact
      .replace(/sy/g, 's')
      .replace(/sh/g, 's')
      .replace(/ts/g, 's')
      .replace(/dz/g, 'z')
      .replace(/dh/g, 'd')
      .replace(/th/g, 't')
      .replace(/kh/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/aa/g, 'a')
      .replace(/ii/g, 'i')
      .replace(/uu/g, 'u');

    return [...new Set([compact, phonetic].filter(Boolean))];
  }

  function sanitizeText(value, fallback = '') {
    const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
    return text ? text.slice(0, 500) : fallback;
  }

  function normalizeSettings(raw = {}) {
    const safe = { prayerMode: 'device', city: DEFAULT_CITY };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return safe;
    if (raw.prayerMode === 'city' || raw.prayerMode === 'device') safe.prayerMode = raw.prayerMode;
    const nextCity = sanitizeText(raw.city, DEFAULT_CITY);
    safe.city = nextCity || DEFAULT_CITY;
    return safe;
  }

  function normalizeTasbih(raw = {}) {
    const safe = { count: 0, dhikr: 'Subhanallah', target: 33, vibration: true };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return safe;
    safe.count = clampNumber(Number(raw.count) || 0, 0, 999999);
    safe.dhikr = sanitizeText(raw.dhikr, 'Subhanallah').slice(0, 80) || 'Subhanallah';
    safe.target = [0, 33, 99, 100].includes(Number(raw.target)) ? Number(raw.target) : 33;
    safe.vibration = raw.vibration !== false;
    return safe;
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function setSafeText(node, value, fallback = '') {
    if (!node) return;
    node.textContent = sanitizeText(value, fallback);
  }

  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function getStoredObject(key, fallback) {
    const value = loadJSON(key, fallback);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = sanitizeText(message, '');
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }
})();
