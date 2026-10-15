# Database Schema (SQLite)

Driver: `better-sqlite3`. Aktifkan `PRAGMA foreign_keys = ON` dan `PRAGMA journal_mode = WAL`.

Prinsip: **evaluasi mentah** dan **label** disimpan terpisah agar klasifikasi bisa dihitung ulang tanpa engine. Semua evaluasi dari sudut pandang **White**.

## games

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | INTEGER PK | |
| `pgn` | TEXT | PGN lengkap (sumber kebenaran langkah) |
| `pgn_hash` | TEXT UNIQUE | Hash PGN ternormalisasi, untuk mengenali game yang sama |
| `white` | TEXT | |
| `black` | TEXT | |
| `result` | TEXT | `1-0`, `0-1`, `1/2-1/2`, `*` |
| `event` | TEXT | |
| `played_at` | TEXT | Tanggal dari header, bila ada |
| `source` | TEXT | `paste`, `file`, nanti `chesscom`/`lichess` |
| `start_fen` | TEXT NULL | Jika game bukan dari posisi awal |
| `ply_count` | INTEGER | |
| `review_status` | TEXT | `none`, `running`, `done`, `cancelled`, `failed` |
| `engine_version` | TEXT NULL | Dari `id name` |
| `engine_config` | TEXT NULL | JSON: threads, hash, multipv, movetime |
| `classifier_version` | TEXT NULL | |
| `summary` | TEXT NULL | JSON: akurasi, hitungan label |
| `created_at` | TEXT | ISO 8601 |

## position_evals

Satu baris per posisi (ply 0 = posisi awal, ply k = setelah langkah ke-k).

| Kolom | Tipe | Catatan |
|---|---|---|
| `game_id` | INTEGER FK → games ON DELETE CASCADE | |
| `ply` | INTEGER | |
| `fen` | TEXT | |
| `terminal` | TEXT NULL | `checkmate`, `stalemate`, `draw`, atau NULL |
| `lines` | TEXT | JSON array, maksimal MultiPV baris: `{ multipv, cp?, mate?, depth, pv:[uci...] }` (White perspective) |
| `best_uci` | TEXT NULL | |
| `depth` | INTEGER | Kedalaman tertinggi tercapai |
| PK | (`game_id`, `ply`) | |

## move_classes

Satu baris per langkah (ply 1..N).

| Kolom | Tipe | Catatan |
|---|---|---|
| `game_id` | INTEGER FK → games ON DELETE CASCADE | |
| `ply` | INTEGER | Langkah yang membawa ke posisi `ply` |
| `san` | TEXT | |
| `uci` | TEXT | |
| `label` | TEXT | `brilliant`, `great`, `best`, `excellent`, `good`, `book`, `inaccuracy`, `mistake`, `miss`, `blunder` |
| `ep_loss` | REAL | Kehilangan expected points (0..1) |
| `ep_before` | REAL | Dari sudut pandang pemain yang melangkah |
| `ep_after` | REAL | |
| `best_uci` | TEXT NULL | |
| `reason` | TEXT | Alasan singkat (untuk UI) |
| `meta` | TEXT NULL | JSON metrik pendukung (mis. nilai material sacrifice, selisih langkah kedua) |
| PK | (`game_id`, `ply`) | |

## Indeks

- `games(created_at DESC)` untuk riwayat.
- `games(pgn_hash)` unik.

## Aturan

- Menghapus game menghapus `position_evals` dan `move_classes` (cascade).
- Hitung ulang klasifikasi: hapus `move_classes` game itu, jalankan classifier dari `position_evals`, perbarui `classifier_version` dan `summary`.
- Hitung ulang evaluasi (ganti engine/konfigurasi): hapus `position_evals` + `move_classes`, jalankan review ulang.
- Migrasi: file SQL bernomor di `src/lib/db/migrations/`, versi dicatat di tabel `schema_migrations`.
- Tabel `analysis_jobs` dan `position_cache` **tidak ada** di MVP (satu review aktif, status cukup di `games.review_status`). Tambah bila terbukti perlu.
