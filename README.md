# Ruang Dzikir

[Ruang Dzikir](https://ruangdzikir.com/) adalah situs ibadah digital sederhana untuk membaca Al-Quran, berdzikir, dan melihat jadwal sholat dalam satu tempat. Situs dapat digunakan langsung lewat browser tanpa akun.

## Fitur

- Jadwal sholat harian dan hitung mundur menuju waktu sholat berikutnya.
- Al-Quran: daftar surah dan bacaan ayat.
- Dzikir pagi dan petang dengan teks Arab, latin, makna ringkas, sumber, dan penghitung bacaan.
- Bacaan setelah sholat berdasarkan Subuh, Zuhur, Asar, Maghrib, dan Isya.
- Pengenalan huruf hijaiyah, Asmaul Husna, arah kiblat, dan tasbih digital.
- Masjid terdekat: masjid/musala terpetakan dalam radius 1, 3, atau 5 km, urutan jarak, dan petunjuk arah. Buka kartu Masjid Terdekat di beranda.

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
| `mosques.js` dan `mosques.css` | Pencarian masjid terdekat dan tampilan khusus fitur |
| `tailwind.generated.css` | CSS utilitas yang dipakai halaman |
| `robots.txt` dan `sitemap.xml` | Petunjuk perayapan dan daftar URL untuk mesin pencari |

## Sumber data dan privasi

Data Al-Quran diambil dari [EQuran.id](https://equran.id/) dan jadwal sholat dari [AlAdhan](https://aladhan.com/). Sumber dzikir dicantumkan pada masing-masing bacaan di dalam aplikasi.

Situs tidak memerlukan akun. Izin lokasi perangkat baru diminta saat pengunjung memilih fitur yang memerlukannya; lokasi juga dapat dipilih lewat kota. Beberapa preferensi penggunaan disimpan di browser melalui `localStorage`. Fitur yang mengambil data dari API memerlukan koneksi internet.

## Masjid terdekat

Tekan **Cari masjid terdekat** untuk meminta izin lokasi. Fitur membutuhkan HTTPS atau localhost. Koordinat dikirim ke [Overpass API](https://overpass-api.de/) untuk mencari `amenity=place_of_worship` dengan `religion=muslim` pada data © [kontributor OpenStreetMap](https://www.openstreetmap.org/copyright). Hasil digunakan ulang dari memori hingga lima menit untuk mengurangi permintaan berulang; koordinat tidak disimpan ke localStorage atau server aplikasi.

Jarak dihitung sebagai garis lurus. Kelengkapan masjid/musala mengikuti data komunitas, bukan daftar semua tempat di wilayah itu. Tombol petunjuk arah membuka Google Maps. Jika lokasi ditolak atau layanan peta gagal, tautan pencarian Google Maps tetap tersedia.

Layanan Overpass publik dapat sibuk dan memiliki batas penggunaan bersama. Pantau penggunaan saat trafik meningkat; gunakan penyedia khusus atau proxy dengan cache jika diperlukan. Ubah juga `connect-src` di `index.html` jika mengganti host API.

## Kontribusi

Jika menemukan kesalahan bacaan, terjemahan, rujukan, atau masalah pada fitur, silakan buat [issue](https://github.com/koaiso/ruangdzikir/issues). Sertakan bagian yang bermasalah dan sumber rujukan jika mengusulkan koreksi bacaan.

