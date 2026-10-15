# ADR-001: Next.js + TypeScript, satu halaman

- Status: Diterima
- Tanggal: 2026-10-13

## Konteks
Aplikasi pribadi untuk dua orang, butuh UI interaktif dan API yang menjalankan proses Stockfish. Pemilik proyek ingin satu halaman tanpa login.

## Keputusan
Satu proyek Next.js + TypeScript. Frontend satu `page.tsx`; backend berupa route handler (runtime Node.js). Papan: react-chessboard; aturan/PGN/FEN: chess.js.

## Alasan
- Satu codebase untuk UI dan API; mudah dirawat.
- Ekosistem React/TypeScript untuk catur sudah matang.
- Route handler cukup untuk mengelola proses engine dan streaming SSE.

## Konsekuensi
- Route yang memakai `child_process` dan SQLite harus berjalan di runtime Node.js, bukan edge.
- Jika kelak hanya butuh UI statis, React + Vite bisa dipertimbangkan; tidak perlu sekarang.
- Rust/C++/Go tidak dipakai. Dipertimbangkan ulang hanya bila ada komponen konkret yang tidak nyaman dengan TypeScript.
