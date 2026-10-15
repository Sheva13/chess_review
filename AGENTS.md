# AGENTS.md

Aturan kerja untuk AI coding agent di repo ini. Baca ini dulu, lalu dokumen di `docs/` yang relevan dengan task.

## Konteks singkat

Aplikasi **satu halaman**, **tanpa login**, untuk review game catur pribadi. Next.js + TypeScript, Stockfish 19 native lewat UCI, SQLite. Analisis hanya **setelah game selesai**.

## Sumber kebenaran

1. `docs/GAME_REVIEW_SPEC.md` untuk rumus dan label.
2. `docs/ARCHITECTURE.md` + `docs/TECHNICAL_SPEC.md` untuk struktur dan modul.
3. `docs/API_SPEC.md` dan `docs/DATABASE_SCHEMA.md` untuk kontrak.
4. `docs/UI_DESIGN.md` untuk tampilan.

Kalau kode dan dokumen bertentangan, **berhenti dan tanyakan**, jangan diam-diam memilih salah satu. Kalau keputusan berubah, perbarui dokumennya dalam perubahan yang sama.

## Cara kerja

- Kerjakan **satu task kecil** dari `docs/ROADMAP.md` per sesi. Jangan membangun fitur di luar task.
- Setiap task punya acceptance criteria. Selesai berarti kriteria terpenuhi **dan** tes lulus.
- Jalankan tes sebelum menyatakan selesai. Jangan klaim "sudah jalan" tanpa menjalankannya.
- Jangan menambah dependency besar atau service baru (Docker, Redis, ORM berat, WebSocket) tanpa persetujuan.
- Jangan menambah login, akun, atau multi-halaman. Aplikasi ini sengaja satu halaman.

## Aturan teknis wajib

- **Pisahkan** lapisan: `lib/engine` (UCI) tidak boleh berisi logika klasifikasi; `lib/analysis` tidak boleh memanggil proses engine langsung.
- Klasifikasi harus **fungsi murni** (input: evaluasi + posisi, output: label + alasan) agar bisa diuji tanpa Stockfish.
- Semua evaluasi disimpan dari **sudut pandang White**. Konversi dari sudut pandang side-to-move (output UCI) dilakukan di satu tempat saja.
- Parser UCI harus buffer per baris (data stdout bisa terpotong), tunggu `uciok` / `readyok`, dan tangani `stop` + `bestmove`.
- Satu proses Stockfish, satu pencarian pada satu waktu. Antrean sederhana, bukan pool.
- `spawn` hanya dengan path tetap dari konfigurasi, tanpa argumen dari input pengguna, tanpa shell.
- Batasi input: PGN maksimal 200 KB, FEN divalidasi chess.js.
- Server bind ke `127.0.0.1` secara default.
- Jangan commit binary Stockfish, file `.nnue`, atau database `.sqlite`.
- Simpan `engine_version`, `engine_config`, dan `classifier_version` bersama hasil agar bisa dihitung ulang.
- Tema: hitam murni `#000000` (bukan abu gelap) dan hijau neon. Ikuti token di `UI_DESIGN.md`, jangan hardcode warna di komponen.

## Gaya kode

- TypeScript `strict`. Tidak ada `any` tanpa komentar alasan.
- Nama identifier dan komentar kode dalam bahasa Inggris; dokumen dan teks UI boleh bahasa Indonesia.
- Fungsi kecil, satu tanggung jawab. Tes diletakkan di `tests/`, fixture di `tests/fixtures/`.

## Definition of Done (per task)

- [ ] Acceptance criteria di ROADMAP terpenuhi
- [ ] Tes unit/integrasi terkait ditambah dan lulus
- [ ] Tidak ada error TypeScript / lint
- [ ] Dokumen terkait diperbarui bila ada perubahan keputusan
- [ ] `CHANGELOG.md` diperbarui untuk perubahan yang terlihat pengguna

## Hal yang sering salah (hindari)

- FEN contoh yang tidak valid; selalu pakai posisi awal `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`.
- Menganggap `score cp` dari UCI selalu dari sudut pandang White (itu sudut pandang pemain yang jalan).
- Menganggap langkah terbaik engine otomatis "Brilliant". Ikuti aturan di `GAME_REVIEW_SPEC.md`.
- Menjalankan dua pencarian bersamaan pada satu proses engine.
