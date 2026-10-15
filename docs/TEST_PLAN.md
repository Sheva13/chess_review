# Test Plan

Tujuan: memastikan hasil **benar**, bukan sekadar berjalan.

## 1. Tingkat uji

| Tingkat | Cakupan | Butuh Stockfish? |
|---|---|---|
| Unit | PGN/FEN, EP, akurasi, classifier, konversi sudut pandang, parser UCI | Tidak |
| Integrasi | Engine Manager, review runner, API, SQLite | Ya |
| Kalibrasi | Label vs Game Review Chess.com pada game nyata | Ya (manual) |
| Performa | Waktu, RAM, suhu | Ya |
| UI | Alur impor → review → buka ulang | Ya |

## 2. Unit

**Import**
- PGN valid sederhana; PGN dengan komentar/variasi; header `SetUp`/`FEN`.
- Rokade, en passant, promosi (termasuk underpromotion), skakmat, stalemat.
- PGN rusak, kosong, melebihi 200 KB; banyak game dalam satu file.
- FEN: valid, tidak valid, posisi tanpa raja, FEN dengan hak rokade tidak konsisten.

**Parser UCI** (dengan transkrip teks tersimpan)
- Data terpotong di tengah baris; beberapa `info` sebelum `bestmove`.
- `score cp` negatif/positif, `score mate`, `lowerbound/upperbound`.
- Konversi side-to-move → White benar untuk giliran White dan Black.

**Classifier** (tanpa engine, evaluasi buatan)
- Tiap batas ambang: nilai tepat di batas dan di sisi kiri/kanannya.
- Mate masuk/keluar, posisi sudah menang telak, langkah penutup game.
- Great: ada dan tidak ada selisih multipv 2. Miss: kesalahan lawan sebelumnya ada/tidak ada.
- Brilliant: sacrifice nyata, pertukaran seimbang (tidak boleh Brilliant), sacrifice yang membuat kalah (tidak boleh).

**Akurasi**: nilai 0 loss → ~100; loss besar → mendekati 0; tidak pernah di luar 0..100.

## 3. Integrasi

- Engine start: `uciok`, `readyok`, versi terbaca "Stockfish 19".
- Posisi dengan mate-in-1 dan mate-in-2 mengembalikan skor `mate` yang benar.
- Posisi terminal tidak dikirim ke engine.
- Batal di tengah pencarian: `bestmove` diterima, tidak ada pencarian bertumpuk.
- Engine dimatikan paksa saat review → job `failed`, restart sukses pada permintaan berikutnya.
- Review penuh satu game: N+1 baris `position_evals`, N baris `move_classes`.
- Buka ulang game yang sudah direview: tidak ada pemanggilan engine.
- `reclassify` mengubah label tanpa menyentuh `position_evals`.
- Hapus game: cascade bersih.

## 4. Kalibrasi terhadap Chess.com

1. Kumpulkan **20 game sendiri** (variasi: menang/kalah, taktis/posisional, rating/pembukaan beragam).
2. Jalankan Game Review Chess.com secara manual; catat label tiap langkah ke CSV: `game, ply, label_chesscom`.
3. Jalankan review situs ini; ekspor `label_ours`.
4. Hitung kesepakatan dan matriks konfusi per label.
5. Telaah langkah yang berbeda satu per satu; ubah ambang atau aturan, naikkan `CLASSIFIER_VERSION`, ulangi.

Target awal (bukan jaminan): kesepakatan untuk kelompok kasar (baik / ragu / buruk) ≥ 80%; label eksak lebih rendah dapat diterima. Brilliant dan Great dinilai terpisah dengan **presisi** (apakah label kita memang layak) karena jumlahnya kecil. Catat hasil tiap putaran di tabel di bawah.

| Putaran | Classifier | Kesepakatan kasar | Catatan |
|---|---|---|---|
| 1 | (belum) | | |

## 5. Performa dan sumber daya

Ukur di laptop target (Core i7-1165G7, 4 core / 8 thread, RAM ±10 GB):

| Metrik | Cara ukur | Catat |
|---|---|---|
| Waktu review game 40 langkah | stopwatch end-to-end | |
| Waktu review game 80 langkah | idem | |
| Pemakaian CPU rata-rata | monitor sistem | |
| Pemakaian RAM proses engine | monitor sistem | |
| Suhu / throttling pada 3 review berurutan | monitor sistem | |
| Kecepatan `bench` per varian build | perintah `bench` | |

Naikkan Threads/Hash/waktu hanya jika terbukti aman dan terasa memperbaiki label.

## 6. UI (manual)

- Paste PGN → papan tampil → navigasi panah keyboard.
- Mulai review → progres jalan → batal → hasil parsial ada.
- Selesai → grafik, akurasi, label tampil → refresh → hasil tetap ada.
- Kontras: bidak putih terlihat di kotak putih, bidak hitam terlihat di kotak hijau neon.
- Layar sempit: panel pindah ke bawah, tidak ada scroll horizontal.

## 7. Fixture

`tests/fixtures/` berisi: PGN contoh (skakmat, promosi, rokade, en passant), transkrip UCI, evaluasi buatan untuk unit classifier, dan CSV label referensi Chess.com untuk kalibrasi.
