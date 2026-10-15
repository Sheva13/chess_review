# UI Design

Satu halaman. Modern, minimal, hitam pekat dengan aksen hijau neon.

## 1. Prinsip

- Latar **`#000000` murni**, bukan abu gelap. Pemisahan panel memakai **garis tipis hijau neon berintensitas rendah**, bukan isian abu.
- Hijau neon dipakai hemat: aksen, fokus, tombol utama, langkah aktif. Teks panjang tetap putih.
- Angka (evaluasi, akurasi) memakai font monospace.

## 2. Token warna

Definisikan sebagai CSS variables di `globals.css`; komponen hanya memakai token.

| Token | Nilai | Pemakaian |
|---|---|---|
| `--bg` | `#000000` | Latar halaman dan panel |
| `--neon` | `#39FF14` | Aksen utama, kotak gelap papan |
| `--neon-dim` | `rgba(57,255,20,0.25)` | Garis/border panel |
| `--neon-glow` | `rgba(57,255,20,0.45)` | Glow tombol/fokus |
| `--text` | `#FFFFFF` | Teks utama |
| `--text-muted` | `rgba(255,255,255,0.6)` | Teks sekunder |
| `--sq-light` | `#FFFFFF` | Kotak terang papan |
| `--sq-dark` | `#39FF14` | Kotak gelap papan |
| `--sq-highlight` | `rgba(0,0,0,0.28)` | Sorotan langkah terakhir (overlay hitam transparan agar terbaca di hijau dan putih) |

Nilai neon boleh disesuaikan sedikit bila terlalu menyilaukan di kotak papan, selama tetap hijau neon.

## 3. Warna label langkah

Harus mudah dibedakan di atas hitam dan tidak menyaingi aksen neon.

| Label | Warna |
|---|---|
| Brilliant | `#1BFFE4` |
| Great | `#4DA3FF` |
| Best | `#39FF14` |
| Excellent | `#8CFF66` |
| Good | `#B7E4A0` |
| Book | `#D2B48C` |
| Inaccuracy | `#FFE600` |
| Mistake | `#FF9500` |
| Miss | `#FF5FA2` |
| Blunder | `#FF2D2D` |

Label tidak boleh hanya dibedakan lewat warna: selalu sertakan ikon/simbol (mis. `!!`, `!`, `?!`, `?`, `??`) dan teks.

## 4. Papan

- Kotak terang `--sq-light` putih, kotak gelap `--sq-dark` hijau neon.
- Gunakan set bidak **berkontur** (outline jelas) supaya bidak putih terlihat di kotak putih dan bidak hitam terlihat di hijau neon. Uji kontras ini sejak awal.
- Sorotan langkah terakhir dan panah best move memakai overlay yang terbaca di kedua warna kotak.
- Gaya kotak diatur lewat prop react-chessboard (nama prop berbeda antar versi mayor; cek dokumentasi versi yang dipasang).

## 5. Evaluation bar

Vertikal di sisi papan. Bagian White putih, bagian Black hitam, dengan **border 1 px neon** agar bar tetap terlihat di latar hitam. Angka evaluasi (mis. `+1.4`, `M3`) di ujung bar, monospace.

## 6. Layout satu halaman

```
┌────────────────────────────────────────────────────────────────┐
│ CHESS REVIEW (wordmark neon)                    [Riwayat ▸]    │
├───────────────────────────────┬────────────────────────────────┤
│ [eval]   Papan catur          │ Tab: Import | Review | Posisi  │
│ [bar ]   (kotak neon + putih) │                                │
│          nama pemain atas     │ Import: textarea PGN, drop     │
│          nama pemain bawah    │ zone .pgn, input FEN           │
│          ◀◀ ◀ ▶ ▶▶  ⟳ flip    │                                │
│                               │ Review: akurasi, hitungan      │
│ Grafik evaluasi (lebar penuh) │ label, daftar langkah + ikon,  │
│                               │ kartu "langkah ini": label,    │
│                               │ best move, PV, alasan          │
└───────────────────────────────┴────────────────────────────────┘
```

- **Riwayat** adalah drawer dari kanan, bukan halaman terpisah.
- Panel kanan memakai tab, bukan navigasi halaman.
- Mobile: panel pindah di bawah papan; grafik tetap lebar penuh.

## 7. Komponen

`Board`, `EvalBar`, `EvalGraph`, `MoveList`, `MoveCard`, `ReviewSummary`, `ImportPanel`, `HistoryDrawer`, `ProgressBar`.

## 8. Tipografi dan gerak

- Teks: sans-serif modern (mis. Inter); angka: monospace (mis. JetBrains Mono).
- Transisi pendek (120–180 ms). Glow neon hanya pada elemen fokus/aktif, bukan di mana-mana.
- Hormati `prefers-reduced-motion`.

## 9. Keterbacaan

- Teks putih di atas hitam; jangan menaruh teks neon kecil di atas kotak putih.
- Fokus keyboard terlihat jelas (outline neon).
