# Requirements

Kode: **FR** fungsional, **NFR** nonfungsional. Prioritas: M = must (MVP), S = should, C = could.

## Fungsional

| ID | Kebutuhan | P |
|---|---|---|
| FR-01 | Pengguna dapat menempel teks PGN dan memuat game | M |
| FR-02 | Pengguna dapat mengunggah atau drag-drop file `.pgn` | M |
| FR-03 | PGN divalidasi; kesalahan ditampilkan dengan pesan jelas, UI tidak rusak | M |
| FR-04 | Jika file berisi banyak game, pengguna memilih satu game | S |
| FR-05 | Pengguna dapat memasukkan FEN untuk analisis satu posisi | M |
| FR-06 | Papan menampilkan posisi dan bisa dinavigasi (awal, mundur, maju, akhir, panah keyboard) | M |
| FR-07 | Papan bisa di-flip | M |
| FR-08 | Pengguna memulai Game Review untuk game yang dimuat | M |
| FR-09 | Review menampilkan progres (posisi ke-n dari N) dan dapat dibatalkan | M |
| FR-10 | Hasil parsial tetap tersimpan jika review dibatalkan atau gagal | S |
| FR-11 | Tiap langkah dilabeli sesuai `GAME_REVIEW_SPEC.md` | M |
| FR-12 | Tiap label menyimpan alasan dan angka pendukung | M |
| FR-13 | Ringkasan: akurasi White/Black dan jumlah tiap label | M |
| FR-14 | Grafik evaluasi sepanjang game; klik titik untuk loncat ke langkah | M |
| FR-15 | Evaluation bar mengikuti posisi aktif | M |
| FR-16 | Panel menampilkan langkah yang dimainkan, best move, dan variasi utama (PV) | M |
| FR-17 | Pengguna dapat menelusuri PV pada papan lalu kembali ke game | S |
| FR-18 | Game dan review tersimpan; riwayat dapat dibuka dan dihapus | M |
| FR-19 | Membuka game yang sudah direview tidak memicu analisis ulang | M |
| FR-20 | Pengguna dapat menghitung ulang klasifikasi tanpa menjalankan ulang engine (ganti `classifier_version`) | S |
| FR-21 | Ekspor PGN game yang dimuat | S |
| FR-22 | Import dari username/URL Chess.com / Lichess lewat API resmi | C |
| FR-23 | Deteksi pembukaan / book move | C |

## Nonfungsional

| ID | Kebutuhan | P |
|---|---|---|
| NFR-01 | Seluruh aplikasi satu halaman, tanpa login | M |
| NFR-02 | Server bind ke `127.0.0.1` secara default | M |
| NFR-03 | Engine: Stockfish 19 NNUE penuh, satu proses, satu pencarian sekaligus | M |
| NFR-04 | Default engine: Threads 2, Hash 256 MB, MultiPV 2, 1000 ms/posisi (dapat diubah via env) | M |
| NFR-05 | UI tidak membeku selama review (analisis di server, progres via stream) | M |
| NFR-06 | Hasil dapat direproduksi: simpan versi engine, konfigurasi, versi classifier | M |
| NFR-07 | Input dibatasi: PGN ≤ 200 KB; FEN valid; tidak ada argumen proses dari pengguna | M |
| NFR-08 | Tema hitam murni + hijau neon; kontras teks memenuhi keterbacaan | M |
| NFR-09 | Layout responsif dasar (desktop utama, layar sempit masih bisa dipakai) | S |
| NFR-10 | Binary Stockfish dan database tidak masuk git | M |
| NFR-11 | Klasifikasi berupa fungsi murni yang bisa diuji tanpa engine | M |
| NFR-12 | Engine crash atau timeout ditangani: job gagal dengan pesan, proses di-restart | M |
