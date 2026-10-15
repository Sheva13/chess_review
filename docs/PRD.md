# PRD: Chess Review

## 1. Latar belakang

Premium Chess.com mahal. Stockfish 19 gratis dan open source, jadi analisis kelas atas bisa dibuat sendiri. Yang perlu dibangun adalah antarmuka dan logika yang mengubah output engine menjadi review yang mudah dipahami.

## 2. Tujuan

1. Mengimpor game, menganalisisnya dengan Stockfish 19 NNUE penuh, dan menampilkan kualitas tiap langkah.
2. Pengalaman Game Review yang **mendekati** Chess.com (label, akurasi, grafik, best move), dengan aturan yang transparan dan bisa diuji.
3. Berjalan lokal di laptop biasa tanpa membuatnya kepanasan.

## 3. Pengguna

Dua orang: pemilik proyek dan satu teman. Tidak ada publik, tidak ada akun, tidak ada pembayaran.

## 4. Keputusan produk

| Keputusan | Pilihan |
|---|---|
| Bentuk | **Satu halaman**, tanpa routing antar halaman |
| Autentikasi | **Tidak ada** (akses dibatasi lewat jaringan, lihat ARCHITECTURE) |
| Waktu analisis | **Setelah game selesai**, bukan live |
| Tampilan | Hitam pekat `#000000` + hijau neon; papan hijau neon + putih |
| Sumber import | PGN (paste/upload), FEN, lalu URL/username platform |

## 5. Fitur

**Wajib (MVP)**
- Import PGN (paste, upload, drag-drop) dan FEN.
- Papan interaktif dengan navigasi langkah (tombol, panah keyboard).
- Game Review penuh dengan progres, tombol batal, dan hasil parsial.
- Klasifikasi langkah dan akurasi per pemain.
- Grafik evaluasi, evaluation bar, best move dan variasi utama.
- Riwayat game dan hasil review tersimpan; membuka ulang tidak menganalisis ulang.

**Setelah MVP**
- Import dari username/URL Chess.com dan Lichess lewat API resmi.
- Deteksi pembukaan (book move).
- Re-check mendalam untuk kandidat Brilliant/Great.
- Latihan dari kesalahan sendiri.

## 6. Non-goals

- Bermain catur di dalam situs (lawan teman atau bot), jam catur, room, multiplayer.
- Login, akun, profil, pembayaran.
- Menulis engine sendiri; Rust/C++/Go.
- Hasil identik 100% dengan Chess.com (algoritma internal mereka tidak dipublikasikan penuh).
- Akses publik di internet.

## 7. Kriteria keberhasilan

- Game 40 langkah selesai direview dalam waktu yang nyaman di laptop target (tolok ukur awal: kurang dari 2 menit pada 1 detik/posisi, diukur di Fase 3).
- Label dasar (Best sampai Blunder) sesuai dengan Game Review Chess.com pada mayoritas langkah di set uji sendiri (target kalibrasi di `TEST_PLAN.md`).
- Setiap label dapat dijelaskan: ada alasan dan angka pendukung yang tersimpan.
- Brilliant tidak dijadikan tolok ukur utama; ia fitur terakhir yang dikalibrasi.

## 8. Risiko

| Risiko | Mitigasi |
|---|---|
| Label Brilliant/Great meleset | Aturan eksplisit, re-check mendalam, kalibrasi terhadap game nyata |
| Laptop panas saat review | 2 thread, hash 256 MB, waktu per posisi tetap, ukur sebelum naikkan |
| Binary Stockfish salah build | Pilih build sesuai CPU, jalankan `bench`, cek versi di `/api/health` |
| Tanpa login tapi terekspos | Bind `127.0.0.1`; akses jarak jauh hanya lewat jaringan privat |
| Lisensi GPLv3 | Jangan bundel binary; link ke sumber resmi |
