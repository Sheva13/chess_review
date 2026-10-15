# ADR-002: Stockfish 19 native via UCI (bukan WebAssembly)

- Status: Diterima
- Tanggal: 2026-10-13

## Konteks
Target: analisis sangat akurat dengan Stockfish 19 NNUE penuh. Opsi: binary native di server, atau Stockfish.js (WebAssembly) di browser.

## Keputusan
Jalankan binary Stockfish 19 resmi sebagai proses terpisah dari Node.js, berkomunikasi lewat UCI (stdin/stdout). Satu proses, satu pencarian sekaligus. Stockfish 19 menggunakan universal binary yang otomatis memilih instruksi CPU terbaik.

## Alasan
- Versi bisa dipastikan Stockfish 19 dan NNUE penuh; build WebAssembly belum tentu sama versinya.
- Universal binary menghapus kebutuhan memilih varian build manual (bmi2, avx2, dll).
- Kontrol penuh atas Threads, Hash, dan MultiPV; performa lebih baik dengan build sesuai CPU.
- Tidak perlu mengunduh engine ke tiap browser.

## Konsekuensi
- Aplikasi bergantung pada binary yang dikelola terpisah (`STOCKFISH_PATH`), tidak masuk git.
- Perlu parser UCI yang benar (buffer baris, `uciok`/`readyok`, `stop`, `bestmove`).
- Engine memakai CPU mesin server; akses teman butuh server yang berjalan (lihat ARCHITECTURE).
- Lisensi GPLv3: jangan bundel binary di repo; bila binary didistribusikan, ikuti kewajiban lisensi.
