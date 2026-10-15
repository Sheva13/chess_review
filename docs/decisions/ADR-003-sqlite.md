# ADR-003: SQLite dengan evaluasi mentah terpisah dari label

- Status: Diterima
- Tanggal: 2026-10-13

## Konteks
Perlu menyimpan game, hasil analisis, dan label untuk dua pengguna. Aturan klasifikasi akan sering berubah selama kalibrasi.

## Keputusan
SQLite satu file lewat `better-sqlite3` (tanpa ORM berat). Simpan evaluasi mentah (`position_evals`) terpisah dari label (`move_classes`).

## Alasan
- Tanpa server database; cukup satu file untuk penggunaan pribadi.
- Memisahkan data mentah dari label membuat klasifikasi bisa dihitung ulang tanpa menjalankan engine lagi (hemat waktu dan panas laptop).
- Menyimpan versi engine, konfigurasi, dan versi classifier membuat hasil dapat direproduksi.

## Konsekuensi
- Migrasi lewat file SQL bernomor.
- `analysis_jobs` dan `position_cache` ditunda; status cukup di `games.review_status`.
- File database tidak masuk git.
