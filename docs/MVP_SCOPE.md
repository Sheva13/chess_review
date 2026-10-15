# MVP Scope

## Masuk MVP

| Area | Isi |
|---|---|
| Import | Paste PGN, upload/drag-drop `.pgn`, input FEN |
| Papan | Navigasi langkah, flip papan, tema neon |
| Engine | Stockfish 19 via UCI, MultiPV 2, antrean satu pencarian |
| Review | Analisis penuh, progres (SSE), batal, hasil parsial |
| Label | Best, Excellent, Good, Inaccuracy, Mistake, Blunder, **lalu** Great, Miss, Brilliant |
| Akurasi | Per pemain (rumus perkiraan, lihat spec) |
| UI | Evaluation bar, grafik evaluasi, daftar langkah dengan ikon label, panel best move + variasi |
| Simpan | SQLite: game, evaluasi mentah, klasifikasi; drawer riwayat |

## Ditunda

- Import dari username/URL platform
- Book move / nama pembukaan
- Re-check mendalam otomatis
- Cache posisi lintas game
- Latihan dari kesalahan
- Tablebase, statistik kebiasaan
- Ekspor PDF/gambar

## Dibuang (bukan tujuan proyek)

- Main catur di situs, jam, room, multiplayer
- Login dan akun
- Rust/C++/Go, Docker, Redis, WebSocket

## Urutan prioritas dalam MVP

1. Import PGN + papan + daftar langkah
2. Engine + evaluasi posisi
3. Review penuh + grafik + simpan
4. Label dasar + akurasi
5. Great, Miss, Brilliant
6. Kalibrasi dan polish

Titik "sudah berguna": akhir langkah 4.
