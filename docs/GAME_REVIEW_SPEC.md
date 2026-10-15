# Game Review Spec

Dokumen ini menentukan cara mengubah evaluasi Stockfish menjadi label dan akurasi. Ini **perkiraan buatan sendiri** terinspirasi pendekatan Expected Points. Ia tidak identik dengan Game Review Chess.com (algoritma internal mereka tidak dipublikasikan penuh) dan angka akurasinya bukan CAPS2.

Semua ambang di bawah adalah **nilai awal** yang dikalibrasi di Fase 5 (lihat `TEST_PLAN.md`). Setiap perubahan aturan menaikkan `CLASSIFIER_VERSION`.

## 1. Input dan output

**Input**: untuk tiap langkah ke-k (ply k): FEN sebelum dan sesudah, langkah yang dimainkan (SAN/UCI), evaluasi mentah posisi k-1 dan k (MultiPV 2, sudut pandang White).

**Output**: `label`, `ep_loss`, `ep_before`, `ep_after`, `best_uci`, `reason`, `meta`; plus ringkasan (akurasi per pemain, hitungan label).

## 2. Expected Points (EP)

Ubah evaluasi ke peluang menang dari sudut pandang **pemain yang baru melangkah**.

```
EP(cp)   = 1 / (1 + exp(-0.00368208 * cp))     # cp dari sudut pandang pemain itu
EP(mate) = 1 jika mate untuk pemain itu, 0 jika mate untuk lawan
```

Sudut pandang: bila pemain Black, balik tanda `cp` dari evaluasi White. Skor mate tidak diubah jadi cp besar; langsung EP 1 atau 0. Posisi terminal: skakmat → EP pemenang 1; stalemat/remis → 0.5.

Konstanta di atas adalah kurva win-probability yang umum dipakai; boleh dikalibrasi.

## 3. Kehilangan EP

```
ep_best   = EP dari baris terbaik (multipv 1) di posisi sebelum langkah
ep_played = EP posisi sesudah langkah, dari sudut pandang pemain yang sama
ep_loss   = max(0, ep_best - ep_played)
```

`ep_played` diambil dari evaluasi posisi berikutnya (baris multipv 1 di sana, dibalik sudut pandang). Jika langkah yang dimainkan sama dengan `best_uci`, `ep_loss = 0`.

## 4. Label dasar (urut dari atas, ambil yang pertama cocok)

| Label | Syarat `ep_loss` |
|---|---|
| Best | langkah = `best_uci`, atau `ep_loss ≤ 0.005` |
| Excellent | `≤ 0.02` |
| Good | `≤ 0.05` |
| Inaccuracy | `≤ 0.10` |
| Mistake | `≤ 0.20` |
| Blunder | `> 0.20` |

## 5. Label khusus

Label khusus dievaluasi **setelah** label dasar dan dapat menimpanya.

### Great
Langkah "satu-satunya" yang menahan posisi.
- Label dasar = Best.
- Ada baris multipv 2 dan `EP(best) - EP(multipv2) ≥ 0.15` (langkah terbaik jauh lebih baik dari alternatif).
- `ep_before ≤ 0.95` (posisi belum menang telak).

### Miss
Gagal memanfaatkan kesalahan lawan.
- Langkah lawan sebelumnya punya `ep_loss ≥ 0.10`.
- Label dasar langkah ini Inaccuracy atau Mistake (Blunder tetap Blunder).
- Terdapat langkah yang dapat mengambil kembali sebagian besar keuntungan tersebut (`ep_best` jauh di atas `ep_played`).

### Brilliant
Pengorbanan bidak yang baik dan tetap kuat.
- Label dasar = Best atau Excellent (`ep_loss ≤ 0.02`).
- **Sacrifice**: setelah langkah, ikuti PV engine sampai posisi tenang (maksimal 4 ply atau sampai tidak ada penangkapan). Jika material bersih pemain (P=1, N=B=3, R=5, Q=9) turun ≥ 2 dibanding sebelum langkah, dihitung sacrifice. Bukan sekadar menukar bidak yang seimbang.
- Bukan sacrifice sia-sia: `ep_after ≥ 0.45` (tidak berakhir dalam posisi kalah).
- Posisi sebelumnya belum menang telak: `ep_before ≤ 0.90`.
- Bukan langkah yang hanya satu-satunya cara menghindari kekalahan yang jelas (opsional; cek di kalibrasi).
- Kandidat Brilliant **harus dikonfirmasi** dengan re-check lebih dalam (lihat §7) sebelum label diberikan.

### Book
Fase setelah MVP: langkah yang cocok dengan basis data pembukaan (mis. ECO) hingga batas ply tertentu → `book`, tanpa dihitung `ep_loss`.

## 6. Akurasi

Per langkah, dari penurunan peluang menang dalam persen (0..100) untuk pemain yang melangkah:

```
winLoss = max(0, 100 * (EP_before - EP_after))     # EP_before = ep_best
move_accuracy = 103.1668 * exp(-0.04354 * winLoss) - 3.1669
move_accuracy = clamp(move_accuracy, 0, 100)
```

Akurasi pemain = rata-rata `move_accuracy` seluruh langkahnya (opsional: campur dengan rata-rata harmonik agar satu blunder lebih terasa). Ini perkiraan; jangan dibandingkan langsung dengan angka CAPS2 Chess.com.

## 7. Re-check mendalam (Fase 4+)

Untuk langkah kandidat Brilliant/Great dan langkah dengan `ep_loss > 0.20`:
- Cari ulang posisi terkait dengan `RECHECK_MOVETIME_MS` (default 3000 ms).
- Hitung ulang `ep_loss` dengan evaluasi baru; jika label berubah, pakai hasil re-check dan simpan di `meta`.
- Simpan `meta.rechecked = true`.

Tujuannya agar label langka tidak bergantung pada pencarian 1 detik yang bisa melewatkan taktik.

## 8. Alasan (`reason`)

Teks singkat untuk UI, dibuat dari angka, bukan karangan:
- Blunder/Mistake: "Kehilangan X% peluang menang. Lebih baik: <SAN>."
- Great: "Satu-satunya langkah yang menjaga posisi."
- Brilliant: "Mengorbankan <bidak> dan tetap unggul/seimbang."
- Miss: "Lawan melakukan kesalahan, tetapi peluang tidak dimanfaatkan."

## 9. Kasus tepi

- Mate: jangan hitung `ep_loss` dari angka cp; gunakan EP 1/0. Langkah yang membuang mate-in-N menjadi posisi biasa = Blunder atau Miss sesuai besar kehilangan.
- Posisi sudah kalah/menang telak (EP > 0.95 atau < 0.05): selisih kecil tidak bermakna; ambang boleh diperlonggar (kalibrasi).
- Langkah terakhir yang mengakhiri game (skakmat): Best.
- Game dari FEN awal khusus: ply 0 mengikuti `start_fen`.
- Remis karena repetisi/50 langkah: EP 0.5 pada posisi terminal.

## 10. Versi

`CLASSIFIER_VERSION` disimpan di `games.classifier_version`. Ubah setiap kali ambang atau aturan berubah, lalu jalankan `reclassify` pada game lama bila ingin konsisten.
