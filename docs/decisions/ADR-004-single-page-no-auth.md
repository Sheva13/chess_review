# ADR-004: Satu halaman, tanpa login, analisis setelah game

- Status: Diterima
- Tanggal: 2026-10-13

## Konteks
Aplikasi hanya untuk pemilik dan satu teman. Pemilik tidak butuh akun dan hanya ingin review setelah game selesai.

## Keputusan
1. Satu halaman; navigasi lewat tab dan drawer, tanpa routing antar halaman.
2. Tidak ada login/akun.
3. Analisis hanya setelah game selesai (batch dengan progres), bukan live saat bermain.
4. Server bind ke `127.0.0.1` secara default; akses jarak jauh hanya lewat jaringan privat.
5. Progres lewat SSE, bukan WebSocket.

## Alasan
- Mengurangi kompleksitas: tanpa sesi, tanpa tabel pengguna, tanpa multiplayer.
- Analisis batch menjaga beban CPU laptop terkendali.
- SSE cukup untuk aliran satu arah.

## Konsekuensi
- Tanpa login, server **tidak boleh** dibuka ke internet publik.
- Tidak ada pemisahan data per pengguna; riwayat bersama.
- Bila nanti butuh proteksi, tambahkan satu password bersama di reverse proxy dan catat dengan ADR baru.
- Main catur di situs, jam, dan room adalah non-goal.
