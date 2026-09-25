# Ruang Dzikir

[Ruang Dzikir](https://ruangdzikir.com/) adalah situs ibadah digital sederhana untuk membaca Al-Quran, berdzikir, dan melihat jadwal sholat dalam satu tempat. Situs dapat digunakan langsung lewat browser tanpa akun.

## Fitur

- Jadwal sholat harian dan hitung mundur menuju waktu sholat berikutnya.
- Al-Quran: daftar surah dan bacaan ayat.
- Dzikir pagi dan petang dengan teks Arab, latin, makna ringkas, sumber, dan penghitung bacaan.
- Bacaan setelah sholat berdasarkan Subuh, Zuhur, Asar, Maghrib, dan Isya.
- Pengenalan huruf hijaiyah, Asmaul Husna, arah kiblat, dan tasbih digital.

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

Situs tidak memerlukan akun. Izin lokasi perangkat baru diminta saat pengunjung memilih fitur yang memerlukannya; lokasi juga dapat dipilih lewat kota. Beberapa preferensi penggunaan disimpan di browser melalui `localStorage`. Fitur yang mengambil data dari API memerlukan koneksi internet.

## Kontribusi

Jika menemukan kesalahan bacaan, terjemahan, rujukan, atau masalah pada fitur, silakan buat [issue](https://github.com/koaiso/ruangdzikir/issues). Sertakan bagian yang bermasalah dan sumber rujukan jika mengusulkan koreksi bacaan.
