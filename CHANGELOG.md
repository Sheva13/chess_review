# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/). Versi mengikuti fase di `docs/ROADMAP.md`.

## [Unreleased]

### Added
- Paket dokumen perancangan awal (PRD, arsitektur, spesifikasi Game Review, rencana uji, roadmap, ADR).
- Scaffold Next.js 16 + TypeScript (strict) dengan chess.js, react-chessboard, better-sqlite3.
- Binary Stockfish 19 (universal binary) terpasang di luar repo, `STOCKFISH_PATH` dikonfigurasi di `.env.local`.
- Skrip uji Stockfish (`scripts/test-stockfish.ts`): spawn, UCI handshake, cetak `id name`.
- Token tema di `globals.css` (hitam `#000000` + hijau neon `#39FF14`, warna label, `prefers-reduced-motion`).
- Halaman kosong hitam murni dengan wordmark "CHESS REVIEW".
- Modul `src/lib/chess` (parsePgn, validateFenString, getFenAtPly, detectMultipleGames) dengan fallback parser untuk bug castling Black di chess.js v1.4.0.
- Tipe bersama di `src/types/index.ts` (ParsedGame, MoveRecord, GameHeaders, PgnError).
- Endpoint `POST /api/games` untuk validasi PGN/FEN (sesuai API_SPEC.md).
- Komponen `Board` (react-chessboard v5, tema neon, highlight langkah terakhir, flip).
- Komponen `ImportPanel` (paste PGN, drag-drop file, input FEN, pesan error).
- Komponen `MoveList` (daftar langkah SAN, klik untuk loncat, auto-scroll, highlight aktif).
- Halaman utama terintegrasi: layout dua kolom, navigasi tombol + keyboard (panah, `f` untuk flip).
- Unit tests (12 tes, `node:test` + `tsx`): PGN parsing, FEN validation, getFenAtPly, castling, custom FEN, error cases.

### Changed
- Engine ditingkatkan dari Stockfish 18 ke Stockfish 19 (+44 Elo, universal binary, NNUE SFNNv16). Seluruh dokumen diupdate.
- Node.js versi 22.23.3 (LTS Jod) menggantikan v24.15.0 yang crash (SIGBUS) dengan Next.js 16.
- `tsconfig.json`: `allowImportingTsExtensions` diaktifkan untuk kompatibilitas test runner.
- `page.tsx`: diganti dari scaffold default ke halaman Chess Review yang fungsional.

### Redesigned
- Tema visual diganti total ke gelap ala Chess.com (Tailwind CSS v4 + inline style).
  - Background: `#302E2B` (abu gelap), panel: `#262421`, border: `#3C3833`.
  - Teks: `#EDEDED`, sekunder `#A09A94`, redup `#7A766F`.
  - Aksen hijau Chess.com: `#81B64C`.
  - Papan: terang `#EEEED2` + gelap `#769656`, highlight langkah kuning `#CDD23C`.
- Layout analisis: board besar rata tengah + sidebar gelap 380px.
  - Sidebar: header Analisis + tombol tutup, tab Langkah/Info (underline hijau).
  - Strip engine: Stockfish 19 + posisi langkah berjalan + ikon pengaturan.
  - Daftar langkah: baris selang-seling, hover, langkah aktif kuning, auto-scroll.
  - CTA Ulasan Permainan (nonaktif jujur sampai Fase 4, tanpa data palsu).
  - Navigasi bawah sidebar: awal, mundur, putar/jeda otomatis, maju, akhir.
  - Bar utilitas: salin PGN, permainan baru, balik papan, kembali ke awal.
- Board controls: flip di bawah papan; petunjuk keyboard (panah, spasi, F).
- Player bar: kotak inisial + nama, mengikuti orientasi papan.
- ImportPanel gelap: tab Paste/Upload/FEN, dropzone, tombol hijau.
- Icons: lucide-react (ChevronsLeft/Right, Play/Pause, FlipHorizontal2, Share2, Plus, RotateCcw, Settings, X, Upload, ClipboardPaste, Hash).
- `globals.css`: token gelap + `@theme` Tailwind v4, `color-scheme: dark`, `prefers-reduced-motion`, `:focus-visible`.

### Fixed
- Hapus reset global `* { margin: 0; padding: 0; }` dari `globals.css` karena menimpa seluruh utility spacing Tailwind v4 (aturan cascade layers: style tak ber-layer mengalahkan style ber-layer). Dampaknya: semua `px-*`/`py-*` terhitung 0px dan `mx-auto` mati sehingga konten mentok kiri. Sekarang padding terverifikasi via DOM (24px) dan grup board+sidebar simetris tengah.
- Verifikasi visual via screenshot headless Chrome (import + analisis) dan metrik DOM.

### Added (Fase 2: Engine)
- `src/lib/engine/uci.ts`: parser UCI murni (buffer per baris, parse `info`/`bestmove`/`uciok`/`readyok`/`id name`, `toWhitePerspective` satu-satunya tempat konversi sudut pandang).
- `src/lib/engine/manager.ts`: Engine Manager (satu proses, satu pencarian; handshake, setoption, timeout+restart, `cancel()` resolve parsial termasuk saat startup, guard sinkron anti-tabrakan).
- `POST /api/analyze` (validasi FEN, clamp movetime ≤ 10000 / multipv ≤ 5, 409 saat sibuk) dan `GET /api/health` (`db:false` jujur sampai Fase 3).
- UI: evaluasi posisi aktif (+cp/Mate, best move + PV, depth, debounce + stale-guard), `EvalBar` vertikal (fill = kurva EP, putih di bawah), helper `uciToSanLine`.
- Tes: 14 unit parser + 6 integrasi engine (start, eval, mate-in-1 Ra8#, cancel, ENGINE_BUSY, tanpa STOCKFISH_PATH); script `npm test`.
- `docs/TEST_PLAN.md`: laptop target dikoreksi ke i7-1165G7 / ±10 GB; `docs/TECHNICAL_SPEC.md` §4: keputusan tolak-saat-sibuk dicatat.
- Badge klasifikasi langkah: tipe `MoveLabel` (10 label = string `move_classes.label`), `LABEL_META` + `MoveBadge`, `MoveList` terima `labels` opsional (tint tipis + SAN berwarna, aktif tetap prioritas). Tanpa data = tampilan polos, tanpa badge palsu. Data asli menyusul di Fase 4 (wadah UI sudah siap, terverifikasi via screenshot).
- Ikon badge ala Chess.com (lucide, tanpa dependensi baru): bintang = Best, jempol = Excellent, ceklis = Good, buku = Book, target = Miss; glyph klasik `!! ! ?! ? ??` untuk Brilliant/Great/Inaccuracy/Mistake/Blunder. Tanpa legenda (sesuai permintaan).
- Panah di papan (react-chessboard `arrows`, tanpa dependensi baru): kuning = langkah terakhir (dari→ke), hijau = best move engine (disembunyikan bila sama dengan yang dimainkan), merah = ancaman skak mengarah ke raja (teratas). Helper murni `getCheckArrow` + `buildMoveArrows` di `lib/chess` + unit test (terverifikasi via screenshot: Ba4 kuning + Nf6 hijau; Bxf7+ kuning + Kxf7 hijau + merah f7→e8).
- Perbaikan logika best move: panah hijau + teks "Best" dihitung dari posisi SEBELUM langkah dimainkan (alternatif si pelangkah, mis. d4 pengganti Bxf7+), bukan balasan lawan di posisi sesudahnya. Evaluasi angka + EvalBar tetap dari posisi kini. Cache FEN di memori supaya navigasi maju-mundur jarang memukul engine.

### Added (Fase 3: Review penuh)
- `src/lib/db`: SQLite (`better-sqlite3`, WAL, migrasi berversi inline agar jalan di dev maupun build) + repository (games, position_evals, move_classes disiapkan untuk Fase 4).
- `POST /api/games` menyimpan (dedup `pgn_hash`, pilih game ke-N via `index`); `GET /api/games`, `GET /api/games/:id` (metadata + moves + evals), `DELETE` (cascade). `GET /api/health` sekarang lapor `db:true`.
- `src/lib/review/runner`: N+1 posisi via replay (deteksi remis repetisi ikut jalan), terminal tidak dikirim ke engine, simpan tiap hasil langsung, retry singkat saat engine sibuk, batal → status `cancelled` + parsial tersimpan. Satu review aktif; request lain 409.
- Endpoint review: `POST` mulai (202/200/409), `GET .../review/stream` SSE (`progress`, `position`, `done`, `cancelled`, `error`; reconnect dapat snapshot status), `DELETE` batal (202).
- UI: tombol Mulai Review + progress bar + Batal, evaluasi tersimpan diutamakan atas live (grafik, EvalBar, Best, panah), drawer Riwayat (buka/hapus, buka ulang tanpa analisis ulang), grafik evaluasi SVG klik-untuk-loncat, picker multi-game di ImportPanel.
- Tes: 6 DB, 4 parsePgnGame/hash, 5 EP, 4 review (terminal, full run, cancel parsial); total 63/63 hijau. Terverifikasi via API + screenshot (progres, selesai, grafik, drawer).

### Added (Fase 4a: Label dasar dan akurasi)
- `src/lib/analysis/classifier.ts` (fungsi murni, tanpa engine/DB): EP sudut pandang pelangkah, `ep_loss`, ambang Best (≤0.005) → Excellent (≤0.02) → Good (≤0.05) → Inaccuracy (≤0.10) → Mistake (≤0.20) → Blunder, akurasi per pemain (CAPS-style, clamp 0..100), alasan faktual berbahasa Indonesia, skakmat penutup selalu Best, `CLASSIFIER_VERSION = "1"`.
- Runner otomatis mengklasifikasi tiap review selesai (eval tersimpan dulu, classifier gagal tidak menggagalkan review); `POST /api/games/:id/reclassify` hitung ulang tanpa engine (409 bila review belum selesai).
- UI: badge label hidup di daftar langkah, kartu "langkah ini" (SAN + badge + alasan), ringkasan akurasi + hitungan label di tab Info.
- Tes: 13 ambang batas (tepat di batas + kiri-kanan), mate masuk/keluar, perspektif Hitam, stalemate, akurasi clamp, ringkasan; total 88/88 hijau. Terverifikasi end-to-end + screenshot (badge, MoveCard, Info).

### Added (Fase 4b: Great, Miss, Brilliant)
- `src/lib/analysis/special.ts` (murni): `detectSacrifice` (susur PV maks 4 ply sampai tenang, material BERSIH turun ≥ 2 agar tukar seimbang tidak lolos, nama bidak untuk alasan), `isGreatCandidate` (selisih multipv 2 ≥ 0.15, belum menang telak), `applySpecial` (prioritas brilliant → great → miss).
- Miss masuk `classifyMove` (tanpa engine, ikut `reclassify`); `summarize()` diekstrak untuk hitung ulang ringkasan.
- Re-check mendalam di runner: kandidat Brilliant/Great + semua Blunder dicari ulang 3000 ms (posisi sebelum DAN sesudah), label dikonfirmasi/diubah, cap `meta.rechecked`; batal dihormati antar pencarian; ringkasan dihitung ulang dari baris final.
- Tes: 13 kasus (sacrifice nyata vs tukar seimbang vs menang material, batas 0.15/0.95/0.02/0.45/0.90, prioritas brilliant>great, miss) + integrasi review game custom (Bxf7+ → blunder + cap recheck). Terverifikasi via screenshot (MoveCard blunder + badge `!`/`?`/`⊕` hidup dari data asli).
- Perampingan sidebar: strip engine + status review digabung satu baris (counter + aksi Review/Ulangi/Batal kontekstual, progress jadi garis tipis), tombol + caption "Ulasan Permainan" dihapus, blok evaluasi + MoveCard dikecilkan. Daftar langkah muat 10/10 baris game uji (sebelumnya ~5).
- Baris langkah dipadatkan ke ~24px (sebelumnya 32px) tanpa mengubah font.
- Anotasi label di papan: kotak tujuan langkah aktif di-tint warna labelnya (mis. merah untuk Blunder) + badge simbol di sudut kanan atas kotak (pakai `squareRenderer` bawaan library, tanpa dependensi baru). Terverifikasi via screenshot (kotak f7 merah + badge `??`).
- Fungsi `tint` sekarang terima alpha parameter (default tetap 14%).
- Mode eksplorasi (FR-17): bidak bisa diseret dari posisi mana pun untuk mencoba variasi ("gimana kalo kesini"); evaluasi, best move + PV, panah, dan EvalBar mengikuti garis eksplorasi; chip kembali ke game; navigasi mana pun menutup variasi. Termasuk dialog pilihan promosi (Menteri/Benteng/Gajah/Kuda) dan bunyi langkah eksplorasi. Tanpa dependensi baru.
- Perbaikan dua bug drag beruntun (terbukti via instrumentasi): (1) `handleDragEnd` react-chessboard di-memo tanpa `onPieceDrop` di deps sehingga callback basi selamanya — diatasi pola latest-ref di `Board.tsx`; (2) `commitExplore` menerapkan garis dua kali di atas FEN yang sudah maju — sekarang hanya langkah baru.
- Klik-untuk-gerak (FR-17): klik bidak sendiri menampilkan titik tujuan legal (hitung via chess.js, jadi kotak terhalang bidak sendiri otomatis tidak ada titik; titik di bawah bidak lawan tertutup bidak sesuai permintaan); klik titik mengeksekusi langkah (termasuk dialog promosi); klik bidak lawan/kotak lain membatalkan pilihan. Navigasi mana pun membersihkan pilihan. Terverifikasi via klik beneran (2 titik di e2, 0 di bidak lawan, eksekusi e4 jalan).
- Suara disintesis via Web Audio API (`src/lib/sound.ts`, tanpa file/dependensi): pindah, makan, rokade, skak, jingle akhir game. Bunyi tiap navigasi langkah (skak > makan > rokade > biasa), tombol mute di nav (persisten localStorage, tahan klik cepat).
- Tint latar label dihapus: SAN + badge hanya berwarna teks (seleksi kuning + hover tetap). Fungsi `tint` tetap ada + teruji untuk pemakaian nanti.
