# Ruang Dzikir

[Ruang Dzikir](https://ruangdzikir.com/) adalah situs ibadah digital sederhana untuk membaca Al-Quran, berdzikir, dan melihat jadwal sholat dalam satu tempat. Situs dapat digunakan langsung lewat browser tanpa akun.

## Fitur

- Jadwal sholat harian dan hitung mundur menuju waktu sholat berikutnya.
- Al-Quran: daftar surah dan bacaan ayat. Posisi ayat terakhir otomatis tersimpan di browser; tombol **Lanjutkan bacaan** muncul di daftar surah.
- Dzikir pagi dan petang dengan teks Arab, latin, makna ringkas, sumber, dan penghitung bacaan.
- Bacaan setelah sholat: pilihan ringkas susunan NU Online. Subuh/Maghrib memuat tambahan; Zuhur/Asar/Isya lebih singkat. Ini bukan wirid lengkap atau satu-satunya amalan di Indonesia.
- Pengenalan huruf hijaiyah, Asmaul Husna, arah kiblat, dan tasbih digital.
- Masjid terdekat: pencarian kota dan area pada peta Google Maps yang tampil di halaman, lengkap dengan petunjuk arah.

## Jalankan secara lokal

Proyek ini menggunakan HTML, CSS, dan JavaScript biasa. Tidak ada instalasi paket atau langkah build untuk menjalankannya.

```bash
git clone https://github.com/koaiso/ruangdzikir.git
cd ruangdzikir
python3 -m http.server 8000
```

Buka `http://localhost:8000`. Di Windows, jika `python3` tidak tersedia, gunakan `py -m http.server 8000`.

## Struktur berkas

| Berkas | Kegunaan |
| --- | --- |
| `index.html` | Struktur halaman dan metadata situs |
| `app.js` | Navigasi, data bacaan, dan logika fitur |
| `mosque-map.js` dan `mosque-map.css` | Peta dan pencarian masjid/musala |
| `styles.css` | Penyesuaian tampilan |
| `tailwind.generated.css` | CSS utilitas yang dipakai halaman |
| `robots.txt` dan `sitemap.xml` | Petunjuk perayapan dan daftar URL untuk mesin pencari |

## Sumber data dan privasi

Data Al-Quran diambil dari [EQuran.id](https://equran.id/) dan jadwal sholat dari [AlAdhan](https://aladhan.com/). Sumber dzikir dicantumkan pada masing-masing bacaan di dalam aplikasi.

Situs tidak memerlukan akun. Fitur masjid tidak meminta lokasi perangkat; pengunjung memilih kota atau menulis area. Beberapa preferensi dan posisi terakhir membaca Al-Quran disimpan di browser melalui `localStorage` (hanya di perangkat/browser tersebut). Fitur yang mengambil data dari API memerlukan koneksi internet.

## Masjid terdekat

Klik kartu **Masjid Terdekat**, pilih kota, dan bila perlu tulis kecamatan atau kelurahan. Tombol **Cari masjid** membuka hasil masjid dan musala langsung pada peta Google Maps yang disematkan di halaman. Hasil, urutan, serta petunjuk arah disediakan oleh Google Maps. Kata pencarian dikirim hanya setelah tombol ditekan. Tidak ada permintaan lokasi GPS oleh fitur ini. Jika peta tidak dapat dimuat, pengunjung dapat membuka hasil di Google Maps melalui tautan yang disediakan.

Peta sematan ini memakai URL hasil pencarian Google Maps tanpa API key. Ketersediaan dan tampilan peta tetap mengikuti layanan Google. Area spesifik perlu ditulis oleh pengunjung; tidak ada radius atau daftar hasil lokal yang bergantung pada layanan Overpass.

## Kontribusi

Jika menemukan kesalahan bacaan, terjemahan, rujukan, atau masalah pada fitur, silakan buat [issue](https://github.com/koaiso/ruangdzikir/issues). Sertakan bagian yang bermasalah dan sumber rujukan jika mengusulkan koreksi bacaan.


### Rujukan bacaan setelah sholat

Susunan ringkas diadaptasi dari NU Online: [Subuh dan Maghrib](https://islam.nu.or.id/shalat/ini-susunan-dzikir-dan-wirid-sesudah-shalat-maghrib-dan-subuh-6YhCe), serta [Zuhur, Asar, dan Isya](https://www.nu.or.id/syariah/ini-susunan-dzikir-dan-wirid-setelah-shalat-zuhur-ashar-dan-isya-hm3oo). Sebagian ayat, pengantar, penghubung, dan doa pada rujukan lengkap tidak ditampilkan. Makna berupa ringkasan, bukan terjemahan resmi. Urutan ini tidak diwajibkan; ikuti bimbingan imam/ustaz setempat. Versi penghitung diperbarui agar hitungan susunan lama tidak dipakai pada bacaan yang berubah.
