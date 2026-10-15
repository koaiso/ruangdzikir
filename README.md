# Ruang Dzikir

[Ruang Dzikir](https://ruangdzikir.com/) adalah situs ibadah digital sederhana untuk membaca Al-Quran, berdzikir, dan melihat jadwal sholat dalam satu tempat. Situs dapat digunakan langsung lewat browser tanpa akun.

## Fitur

- Jadwal sholat harian dan hitung mundur menuju waktu sholat berikutnya.
- Al-Quran: daftar surah dan bacaan ayat. Posisi ayat terakhir otomatis tersimpan di browser; tombol **Lanjutkan bacaan** muncul di daftar surah.
- Dzikir pagi dan petang dengan teks Arab, latin, makna ringkas, sumber, dan penghitung bacaan.
- Bacaan setelah sholat: pilihan ringkas susunan NU Online. Subuh/Maghrib memuat tambahan; Zuhur/Asar/Isya lebih singkat. Ini bukan wirid lengkap atau satu-satunya amalan di Indonesia.
- Pengenalan huruf hijaiyah, Asmaul Husna, arah kiblat, dan tasbih digital.
- Masjid terdekat: kartu di beranda membuka pencarian masjid di Google Maps beserta pilihan petunjuk arah.

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
| `styles.css` | Penyesuaian tampilan |
| `tailwind.generated.css` | CSS utilitas yang dipakai halaman |
| `robots.txt` dan `sitemap.xml` | Petunjuk perayapan dan daftar URL untuk mesin pencari |

## Sumber data dan privasi

Data Al-Quran diambil dari [EQuran.id](https://equran.id/) dan jadwal sholat dari [AlAdhan](https://aladhan.com/). Sumber dzikir dicantumkan pada masing-masing bacaan di dalam aplikasi.

Situs tidak memerlukan akun. Izin lokasi perangkat baru diminta saat pengunjung memilih fitur yang memerlukannya; lokasi juga dapat dipilih lewat kota. Beberapa preferensi dan posisi terakhir membaca Al-Quran disimpan di browser melalui `localStorage` (hanya di perangkat/browser tersebut). Fitur yang mengambil data dari API memerlukan koneksi internet.

## Masjid terdekat

Klik kartu **Masjid Terdekat** di beranda untuk membuka pencarian di Google Maps pada tab baru atau aplikasi Maps, sesuai perangkat. Fitur memakai Maps URL tanpa API key dan tanpa permintaan lokasi dari ruangdzikir. Lokasi, hasil pencarian, dan petunjuk arah ditangani Google Maps. Pengguna dapat mengizinkan lokasi atau mengubah area pencarian di Google Maps.

## Kontribusi

Jika menemukan kesalahan bacaan, terjemahan, rujukan, atau masalah pada fitur, silakan buat [issue](https://github.com/koaiso/ruangdzikir/issues). Sertakan bagian yang bermasalah dan sumber rujukan jika mengusulkan koreksi bacaan.


### Rujukan bacaan setelah sholat

Susunan ringkas diadaptasi dari NU Online: [Subuh dan Maghrib](https://islam.nu.or.id/shalat/ini-susunan-dzikir-dan-wirid-sesudah-shalat-maghrib-dan-subuh-6YhCe), serta [Zuhur, Asar, dan Isya](https://www.nu.or.id/syariah/ini-susunan-dzikir-dan-wirid-setelah-shalat-zuhur-ashar-dan-isya-hm3oo). Sebagian ayat, pengantar, penghubung, dan doa pada rujukan lengkap tidak ditampilkan. Makna berupa ringkasan, bukan terjemahan resmi. Urutan ini tidak diwajibkan; ikuti bimbingan imam/ustaz setempat. Versi penghitung diperbarui agar hitungan susunan lama tidak dipakai pada bacaan yang berubah.
