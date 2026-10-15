# Technical Spec

## 1. Konfigurasi (env)

| Variabel | Default | Keterangan |
|---|---|---|
| `STOCKFISH_PATH` | (wajib) | Path executable Stockfish 19 |
| `DB_PATH` | `./data/chess-review.sqlite` | File SQLite |
| `HOST` | `127.0.0.1` | Alamat bind |
| `ENGINE_THREADS` | `2` | UCI `Threads` |
| `ENGINE_HASH_MB` | `256` | UCI `Hash` |
| `ENGINE_MULTIPV` | `2` | UCI `MultiPV` untuk review |
| `REVIEW_MOVETIME_MS` | `1000` | Waktu per posisi |
| `RECHECK_MOVETIME_MS` | `3000` | Waktu re-check (Fase 4+) |
| `MAX_PGN_BYTES` | `200000` | Batas input PGN |

Nilai awal adalah titik uji, bukan standar kualitas. Ukur dulu sebelum menaikkan.

## 2. Stockfish

- Pakai rilis resmi Stockfish 19. Rilis ini menggunakan universal binary yang otomatis memilih instruksi CPU terbaik (AVX2, BMI2, AVX-512, dll). Jalankan perintah `bench` untuk verifikasi kecepatan dan stabilitas.
- Pastikan jaringan NNUE tersedia sesuai paket distribusi yang diunduh (jangan asumsikan build apa pun sudah lengkap). Jangan pakai build tanpa NNUE.
- Saat start, baca `id name` dan simpan sebagai `engine_version`. `GET /api/health` melaporkannya.

## 3. Engine Manager (`lib/engine`)

Tanggung jawab: satu proses, protokol UCI, satu pencarian aktif.

**Inisialisasi**
```
spawn(STOCKFISH_PATH)            # tanpa shell, tanpa argumen pengguna
send "uci"        → tunggu "uciok"
send setoption Threads/Hash/MultiPV
send "isready"    → tunggu "readyok"
```

**Satu pencarian**
```
send "position fen <fen>"
send "go movetime <ms>"
kumpulkan "info ... multipv k ... score cp|mate ... pv ..."   (ambil yang terakhir per k)
selesai saat "bestmove ..."
```

**Batal**: kirim `stop`, tunggu `bestmove`, buang hasil bila perlu.

**Aturan parser**
- Buffer stdout per baris; potongan data tidak selalu berakhir di `\n`.
- `score cp X` / `score mate Y` dari sudut pandang **side to move**. Konversi ke sudut pandang White di satu fungsi (`toWhitePerspective`).
- `mate` disimpan terpisah dari `cp` (jangan diubah jadi angka besar saat menyimpan; konversi ke EP dilakukan classifier).
- Jika posisi tanpa langkah legal, jangan dikirim ke engine.

**Kegagalan**
- Timeout (movetime + margin) → job gagal, proses engine di-restart.
- Proses mati tiba-tiba → job gagal dengan pesan, restart otomatis pada permintaan berikutnya.

## 4. Antrean

Satu `Mutex`/antrean promise cukup. Operasi: `analyzePosition(fen, opts)`, `cancelCurrent()`. Tidak ada pool engine di versi pertama.

Keputusan implementasi (Fase 2): permintaan yang datang saat pencarian aktif **ditolak** dengan `ENGINE_BUSY` (HTTP 409), bukan menunggu. Alasan: perilaku eksplisit di sisi klien (UI me-retry/debounce sendiri) dan sesuai kode error yang sudah ada di `API_SPEC.md`. Guard bersifat sinkron agar dua request bersamaan tidak bisa lolos bersama. `cancel()` saat handshake startup masih berjalan dicatat lewat flag dan dieksekusi begitu pencarian dimulai, sehingga hasil parsial tetap resolve.

## 5. Review Runner (`lib/review`)

```
runReview(gameId):
  positions = buildPositions(game)             # N+1 FEN, tandai terminal
  for each position:
      if cancelled: break
      eval = terminal ? fixedEval : engine.analyze(fen)
      repo.savePositionEval(gameId, ply, eval)
      emit progress
  if completed:
      classes, summary = classify(game, evals)  # fungsi murni
      repo.saveClasses(...)
```

Progres dikirim lewat SSE; runner tidak peduli UI.

## 6. Classifier (`lib/analysis`)

Fungsi murni. Input: daftar langkah (SAN/UCI, FEN sebelum/sesudah), evaluasi mentah tiap posisi. Output: label, `ep_loss`, alasan, ringkasan. Detail rumus: `GAME_REVIEW_SPEC.md`. Tidak boleh mengimpor engine atau DB.

## 7. Import

- PGN: chess.js memuat dan memvalidasi; tolak jika ukuran > batas atau tidak ada langkah. Tangani header `SetUp`/`FEN` (game dari posisi khusus) dan varian non-standar dengan pesan jelas (tidak didukung).
- FEN: validasi chess.js; kirim ke `/api/analyze`.
- Import URL/akun (setelah MVP): hanya lewat API resmi Chess.com / Lichess; tidak ada scraping.

## 8. Streaming progres

Server-Sent Events (`text/event-stream`) dari `GET /api/games/:id/review/stream`. Dipilih daripada WebSocket karena arahnya satu arah dan tidak ada multiplayer. Event: `progress`, `position`, `done`, `error`, `cancelled`.

## 9. Frontend

- Satu `page.tsx`; state lokal (game aktif, ply aktif, hasil review). Tidak perlu state manager eksternal pada awalnya.
- `chess.js` dipakai di klien untuk navigasi/PGN; sumber kebenaran evaluasi tetap dari server.
- Papan, eval bar, dan grafik membaca ply aktif yang sama.

## 10. Performa dan sumber daya

| Hal | Batas awal |
|---|---|
| Threads | 2 (laptop 4 core / 8 thread logis) |
| Hash | 256 MB |
| Review | 1 detik/posisi, MultiPV 2 |
| Review serentak | 1 |

Pantau CPU, suhu, dan thermal throttling saat review panjang. Catat hasil ukur di `TEST_PLAN.md`.
