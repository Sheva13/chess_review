# Roadmap

Kerjakan berurutan; satu task kecil per sesi. Estimasi adalah target perencanaan untuk satu pengembang, bukan janji.

**Titik "sudah berguna" = akhir Fase 4a** (review penuh dengan label dasar + akurasi): kira-kira **1–2 minggu**. Sisanya fitur tambahan dan kalibrasi.

## Fase 0: Setup (0,5 hari)

- [ ] Buat proyek Next.js + TypeScript (`strict`), pasang chess.js, react-chessboard, better-sqlite3
- [ ] Unduh Stockfish 19 resmi (universal binary), simpan di luar repo, atur `STOCKFISH_PATH`
- [ ] Skrip uji kecil: spawn Stockfish, kirim `uci`, terima `uciok`, cetak `id name`
- [ ] Token tema di `globals.css`; halaman kosong hitam `#000000`

**Selesai bila**: skrip menampilkan "Stockfish 19"; halaman hitam murni tampil.

## Fase 1: Import dan papan (1–2 hari)

- [ ] Panel Import: paste PGN, upload/drag-drop `.pgn`, input FEN
- [ ] Validasi (`POST /api/games`), pesan error jelas, batas 200 KB
- [ ] Papan dengan kotak hijau neon + putih; daftar langkah; navigasi tombol + panah keyboard; flip
- [ ] Cek kontras bidak di kedua warna kotak (ganti set bidak bila perlu)

**Selesai bila**: PGN valid termuat, bisa dinavigasi dan diekspor kembali tanpa kehilangan urutan langkah.

## Fase 2: Engine (1–2 hari)

- [ ] Engine Manager: init UCI, `isready`, parser baris ter-buffer, `stop`
- [ ] Konversi sudut pandang ke White di satu fungsi + tes unit
- [ ] `POST /api/analyze` (FEN) dan `GET /api/health`
- [ ] UI: evaluasi, best move, PV, evaluation bar untuk posisi aktif

**Selesai bila**: posisi biasa dan posisi mate-in-N menghasilkan evaluasi benar; dua permintaan bersamaan tidak bertabrakan.

## Fase 3: Review penuh (2–3 hari)

- [ ] Review Runner: N+1 posisi, posisi terminal ditangani, simpan tiap hasil
- [ ] SSE progres, tombol batal, hasil parsial
- [ ] Skema SQLite + repository; drawer Riwayat; buka ulang tanpa analisis ulang
- [ ] Grafik evaluasi (klik untuk loncat ke langkah)

**Selesai bila**: satu game dianalisis awal sampai akhir tanpa UI membeku, ditutup, dibuka ulang, dan hasilnya sama.

## Fase 4a: Label dasar dan akurasi (2–3 hari)

- [ ] EP, `ep_loss`, label Best sampai Blunder (fungsi murni + tes ambang)
- [ ] Akurasi per pemain, ringkasan hitungan label
- [ ] Ikon label di daftar langkah; kartu "langkah ini" dengan alasan
- [ ] `reclassify` tanpa engine

**Selesai bila**: tes unit classifier lulus dan label muncul di UI dengan alasan.

## Fase 4b: Great, Miss, Brilliant (2–4 hari)

- [ ] Great (selisih multipv 2), Miss
- [ ] Deteksi sacrifice lewat PV + material (tes: sacrifice nyata vs pertukaran seimbang)
- [ ] Re-check mendalam kandidat Brilliant/Great dan blunder besar
- [ ] Brilliant tampil dengan alasan

**Selesai bila**: aturan terdokumentasi, tes lulus, dan kandidat Brilliant dikonfirmasi re-check.

## Fase 5: Kalibrasi dan polish (2–4 hari)

- [ ] Kumpulkan 20 game dan label referensi Chess.com (lihat TEST_PLAN)
- [ ] Putaran kalibrasi: ubah ambang, naikkan `CLASSIFIER_VERSION`, ulangi
- [ ] Ukur performa dan suhu; sesuaikan default engine
- [ ] Polish tema, responsivitas, kontras, README akhir

**Selesai bila**: tabel kalibrasi terisi, performa nyaman, dokumen sesuai kode.

## Sesudah MVP (opsional)

- Import username/URL Chess.com & Lichess lewat API resmi
- Book move / nama pembukaan (ECO)
- Latihan dari kesalahan sendiri
- Cache posisi lintas game
- Ekspor review

## Total kasar

~10–17 hari kerja sampai Fase 5. Kalibrasi mendekati Chess.com bisa memakan lebih lama karena butuh banyak putaran uji.

## Backlog bebas urutan

- [ ] Opsi mengganti `REVIEW_MOVETIME_MS` dari UI
- [ ] Tampilkan kedalaman pencarian per posisi
- [ ] Shortcut keyboard bantuan (`?`)
- [ ] Ekspor PGN beranotasi
