# API Spec

Semua endpoint di bawah `/api`, JSON, tanpa autentikasi (lihat ARCHITECTURE soal akses). Runtime: Node.js (bukan edge).

Format error seragam:
```json
{ "error": { "code": "INVALID_PGN", "message": "Pesan yang bisa ditampilkan ke pengguna" } }
```

Kode umum: `INVALID_PGN`, `INVALID_FEN`, `PAYLOAD_TOO_LARGE`, `NOT_FOUND`, `ENGINE_BUSY`, `ENGINE_FAILED`, `UNSUPPORTED_VARIANT`.

## Game

### `POST /api/games`
Body: `{ "pgn": "..." , "source": "paste" | "file" }`
- 201: `{ "id": 12, "duplicate": false, "game": { ...ringkas } }`
- Jika PGN sama sudah ada: 200 dengan `"duplicate": true` dan `id` yang ada.
- Berisi banyak game: 200 `{ "games": [ { "index": 0, "white": "...", "black": "...", "result": "..." } ] }`, lalu klien mengirim ulang dengan `"index"`.
- 400 `INVALID_PGN`, 413 `PAYLOAD_TOO_LARGE`.

### `GET /api/games`
Riwayat, terbaru dulu: `[ { id, white, black, result, played_at, review_status, summary } ]`

### `GET /api/games/:id`
Game lengkap: metadata, `pgn`, `review_status`, `summary`, dan jika ada `moves` (gabungan `position_evals` + `move_classes`) untuk dirender.

### `DELETE /api/games/:id`
204. Cascade ke evaluasi dan label.

## Review

### `POST /api/games/:id/review`
Mulai review. Body opsional: `{ "movetimeMs": 1000, "force": false }`.
- 202: `{ "status": "running" }`
- 200 `{ "status": "done" }` bila sudah ada hasil dan `force` false.
- 409 `ENGINE_BUSY` bila ada pencarian/review lain.

### `GET /api/games/:id/review/stream`
SSE. Event:

| Event | Data |
|---|---|
| `progress` | `{ "done": 12, "total": 41 }` |
| `position` | `{ "ply": 12, "lines": [...], "bestUci": "..." }` |
| `done` | `{ "summary": {...} }` |
| `cancelled` | `{ "done": 12 }` |
| `error` | `{ "code": "ENGINE_FAILED", "message": "..." }` |

Klien yang tersambung ulang menerima status saat ini terlebih dahulu.

### `DELETE /api/games/:id/review`
Batalkan review yang berjalan. 202; hasil parsial tetap tersimpan.

### `POST /api/games/:id/reclassify`
Hitung ulang label dari evaluasi mentah (tanpa engine). 200 `{ "summary": {...} }`. 409 jika review belum selesai.

## Posisi tunggal

### `POST /api/analyze`
Body: `{ "fen": "...", "movetimeMs": 2000, "multipv": 3 }`
- 200: `{ "fen": "...", "lines": [ { "multipv": 1, "cp": 34, "depth": 22, "pv": ["e2e4", ...] } ], "bestUci": "e2e4" }` (evaluasi dari sudut pandang White)
- 400 `INVALID_FEN`, 409 `ENGINE_BUSY`.
- Batas: `movetimeMs` ≤ 10000, `multipv` ≤ 5.

## Sistem

### `GET /api/health`
`{ "ok": true, "engine": { "name": "Stockfish 19", "ready": true }, "db": true }`
