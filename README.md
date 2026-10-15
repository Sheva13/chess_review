# Chess Review

Website **satu halaman** untuk review pertandingan catur secara pribadi (pengganti fitur Game Review premium Chess.com). Dipakai berdua, **tanpa login**, berjalan lokal.

> Status: tahap perancangan. Belum ada kode. Mulai dari [`docs/ROADMAP.md`](docs/ROADMAP.md) Fase 0.

## Fitur MVP

- Import game via **paste PGN**, **upload / drag-drop `.pgn`**, dan **input FEN** (analisis satu posisi).
- Analisis **setelah game selesai** memakai Stockfish 19 (NNUE penuh), bukan live.
- Label tiap langkah: Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder.
- Akurasi White/Black, grafik evaluasi, best move + variasi, riwayat game tersimpan.
- Tema hitam pekat + hijau neon; papan hijau neon dan putih.

## Stack

| Bagian | Pilihan |
|---|---|
| App | Next.js + TypeScript (satu halaman, route handler untuk API) |
| Papan & aturan | react-chessboard + chess.js |
| Engine | Stockfish 19 native (universal binary), protokol UCI via `child_process.spawn` |
| Database | SQLite (`better-sqlite3`) |
| Grafik | Recharts (atau SVG manual) |

Tidak ada Rust/C++/Go, login, Docker, Redis, atau WebSocket di versi pertama (lihat ADR).

## Prasyarat

- Node.js LTS
- Binary Stockfish 19 resmi dari GitHub Stockfish (universal binary, auto-detect CPU), simpan di luar git, atur lewat `STOCKFISH_PATH`.

## Dokumen

| File | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Tujuan, pengguna, fitur, non-goals |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | Masuk / ditunda |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Kebutuhan fungsional & nonfungsional |
| [docs/UI_DESIGN.md](docs/UI_DESIGN.md) | Layout satu halaman, warna, papan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Komponen dan aliran data |
| [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md) | UCI, modul, konfigurasi |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tabel SQLite |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Endpoint |
| [docs/GAME_REVIEW_SPEC.md](docs/GAME_REVIEW_SPEC.md) | Rumus dan aturan klasifikasi |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Strategi uji dan kalibrasi |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fase kerja dan backlog |
| [docs/decisions/](docs/decisions/) | ADR keputusan arsitektur |
| [AGENTS.md](AGENTS.md) | Aturan untuk AI coding agent |

## Keamanan singkat

Tanpa login berarti **jangan buka ke internet publik**. Jalankan di `127.0.0.1`. Kalau teman perlu akses dari perangkat lain, pakai jaringan privat (mis. Tailscale/LAN), lihat `ARCHITECTURE.md`.

## Lisensi

Stockfish berlisensi GPLv3. Binary tidak disertakan di repo ini.
# chess_review
