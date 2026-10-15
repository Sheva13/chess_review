# Architecture

## 1. Gambaran

```
Browser (satu halaman Next.js)
   │  HTTP + SSE
   ▼
Next.js route handlers (runtime Node.js)
   ├── Importer      : validasi PGN/FEN (chess.js)
   ├── Review Runner : antrean, progres, batal
   │      └── Engine Manager ──(UCI/stdio)──► Stockfish 19 (proses terpisah)
   ├── Classifier    : fungsi murni (evaluasi → label, akurasi)
   └── Repository    : SQLite (better-sqlite3)
```

Tiga pekerjaan yang dipisahkan sengaja:

| Pekerjaan | Pemilik |
|---|---|
| Mencari langkah terbaik, mengevaluasi | Stockfish |
| Legalitas langkah, FEN/PGN, status posisi | chess.js |
| Orkestrasi, klasifikasi, UI, penyimpanan | TypeScript |

## 2. Batas modul

| Modul | Boleh bergantung pada | Tidak boleh |
|---|---|---|
| `lib/engine` | Node `child_process`, `types` | chess.js, classifier, DB |
| `lib/analysis` | `types`, chess.js | engine, DB, HTTP |
| `lib/chess` | chess.js | engine, DB |
| `lib/db` | better-sqlite3, `types` | engine, classifier |
| `lib/review` (runner) | engine, analysis, db, chess | UI |
| `app/api/*` | lib/* | logika klasifikasi sendiri |

Alasan: definisi Brilliant akan berubah-ubah; perubahan itu tidak boleh menyentuh kode engine, dan harus bisa dihitung ulang dari evaluasi mentah yang tersimpan.

## 3. Aliran Game Review

1. Pengguna menempel PGN → `POST /api/games` → validasi → simpan game.
2. `POST /api/games/:id/review` → runner membuat daftar posisi (posisi awal + posisi setelah tiap langkah). Posisi terminal (skakmat, stalemat, remis) tidak dicari; nilainya tetap.
3. Untuk tiap posisi: kirim `position fen` + `go movetime N` dengan MultiPV 2; baca `info` terakhir per `multipv` dan `bestmove`.
4. Setiap hasil posisi langsung disimpan (`position_evals`) dan progres dikirim lewat SSE.
5. Setelah semua posisi selesai, classifier membaca evaluasi mentah dan menulis `move_classes` + ringkasan akurasi.
6. Jika dibatalkan: kirim `stop`, simpan hasil parsial, status `cancelled`.

Satu pencarian per posisi sudah cukup: evaluasi langkah yang dimainkan adalah evaluasi posisi berikutnya (dibalik sudut pandang). Untuk N langkah dibutuhkan N+1 pencarian.

## 4. Konkurensi

- Hanya satu proses Stockfish, satu pencarian aktif.
- Permintaan analisis posisi tunggal (FEN) dan review penuh masuk antrean yang sama. Review penuh sedang jalan → analisis FEN menunggu atau ditolak dengan pesan "engine sibuk" (pilih saat implementasi, catat di TECHNICAL_SPEC).
- Hanya satu review aktif sekaligus.

## 5. Akses jaringan (tanpa login)

| Skenario | Pengaturan |
|---|---|
| Hanya di laptop sendiri | `HOST=127.0.0.1` (default) |
| Teman di jaringan yang sama | Bind ke IP LAN hanya jika jaringan dipercaya |
| Teman dari luar | Jaringan privat (mis. Tailscale), **bukan** port publik |

Tanpa login, siapa pun yang dapat menjangkau server bisa memakai CPU dan menghapus riwayat. Karena itu server tidak pernah dibuka ke internet publik. Jika kelak butuh proteksi, cukup tambah satu password bersama di tingkat reverse proxy; itu keputusan baru dan perlu ADR.

## 6. Penyimpanan

SQLite satu file. Evaluasi mentah (`position_evals`) dipisah dari label (`move_classes`) sehingga klasifikasi bisa dihitung ulang tanpa menjalankan engine. Lihat `DATABASE_SCHEMA.md`.

## 7. Struktur folder

```
chess-review/
├── README.md  AGENTS.md  CHANGELOG.md
├── docs/ ...
├── tests/
│   ├── fixtures/          # PGN, FEN, evaluasi contoh
│   └── cases/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx       # satu-satunya halaman
│   │   ├── globals.css    # token tema
│   │   └── api/
│   │       ├── games/...
│   │       ├── analyze/route.ts
│   │       └── health/route.ts
│   ├── components/        # Board, EvalBar, EvalGraph, MoveList, ...
│   ├── lib/
│   │   ├── chess/         # PGN, FEN, helper posisi
│   │   ├── engine/        # UCI + Engine Manager
│   │   ├── analysis/      # EP, akurasi, klasifikasi
│   │   ├── review/        # runner, antrean, SSE
│   │   └── db/            # skema, repository
│   └── types/
└── package.json
```

Folder dibuat saat dibutuhkan, tidak sekaligus di hari pertama. Binary Stockfish disimpan di luar repo (`STOCKFISH_PATH`).
