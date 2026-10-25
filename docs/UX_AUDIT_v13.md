# Design Critique: LETUP! v1.2 → v1.3 (semua layar)

Ditinjau: 17 layar × 3 ukuran (HP kecil 360×640, HP besar 390×844, desktop 1280×800). Tahap: polish sebelum rilis Play Store. Fokus: kejelasan tujuan, retensi, tata letak.

## Kesan pertama
Identitas visualnya kuat (logo neon, gelembung bercahaya, warna aksi konsisten). Peluang terbesar ada di **peta dan layar hasil**: keduanya belum memberi tahu pemain "apa yang harus dikejar berikutnya", padahal v1.2 sudah punya bintang, gerbang bab, dan bos.

## Usability
| Temuan | Tingkat | Perbaikan v1.3 |
| --- | --- | --- |
| Peta menampilkan 20 bab penuh; bab yang masih jauh berupa 10 gembok × 18 bab, scroll panjang tanpa info | 🔴 Kritis | Bab yang ≥2 langkah di depan diringkas jadi satu baris berisi syarat bintang. Peta 3x lebih pendek |
| Tidak ada cara cepat lanjut dari peta | 🟡 Sedang | Tombol tetap "Main Level N" di bawah peta |
| Ketuk level di peta langsung main tanpa tahu syarat bintang | 🟡 Sedang | **Preview level baru**: bintang yang sudah didapat, syarat bintang 1/2/3, gelembung spesial di level itu |
| Kalah total menampilkan "Kurang 39 · rantai terbaik x0", terasa menghukum dan tidak membantu | 🟡 Sedang | Judul "Meleset!", teks "Tidak ada rantai", plus kotak tip yang berubah sesuai situasi (meleset, <50%, hampir, bos) |
| Jeda tidak mengingatkan target, toggle Getar hilang | 🟡 Sedang | Kartu target (bintang 1/2/3 + jumlah meletup sekarang) dan toggle Getar |
| Kartu intro tipe baru menutupi atas papan; di level 57 yang muncul "Gelembung Koin", bukan mekanik bab (Hantu) | 🟡 Sedang | Intro memprioritaskan mekanik bab, kartu lebih ringkas dan transparan (blur), disembunyikan saat jeda |
| Intro bos dan petunjuk sama-sama bilang "2 ketukan" | 🟢 Minor | Intro menjelaskan HP, petunjuk menjelaskan ketukan |
| Tema: tombol iklan koin gratis di atas daftar mengalahkan isi sheet; harga yang belum terjangkau tampak sama dengan yang terjangkau | 🟡 Sedang | Dompet + iklan dipindah ke bawah, harga yang belum terjangkau diredupkan |
| Misi: hadiah dan progres bercampur dalam satu baris kecil ("60 · 1/3") | 🟢 Minor | Hadiah jadi chip di kanan, progres di samping bar, tombol klaim menampilkan jumlah koin (dan 2x) |
| Toast menimpa teks "TARGET TERCAPAI" di HUD | 🟢 Minor | Toast diturunkan di bawah HUD |
| "TARGET!" dan "Mantap!" bertumpuk di tengah layar | 🟢 Minor | "TARGET!" dipindah lebih bawah |

## Hierarki visual
- **Yang pertama dilihat**: logo, lalu tombol MAIN. Benar untuk home.
- **Baris statistik home** sebelumnya angka seumur hidup (total letupan). Sekarang satu baris tujuan berikutnya: "Bab 4 butuh 50 ★ · kurang 3", atau "Bos Bab N menunggu", atau progres bintang bab.
- **Layar menang**: slot bintang kosong sekarang terlihat sejak awal, jadi 1 bintang terbaca "1 dari 3", bukan "selesai".
- **Peta**: bab yang sedang dimainkan diberi latar lebih terang dan bar progres bintang per bab.

## Konsistensi
| Elemen | Masalah | Perbaikan |
| --- | --- | --- |
| HUD & header peta di desktop | Menempel ke tepi jendela, papan di tengah | Dibatasi ke kolom 520px di tengah |
| Node terkunci | Menampilkan bintang abu-abu yang tidak punya arti | Bintang hanya di node terbuka |
| Warna tombol | Sudah konsisten: pink = aksi utama, hijau + ikon video = iklan berhadiah, emas = koin | Dipertahankan |

## Aksesibilitas
- **Kontras**: teks utama putih di ungu tua lolos AA. Teks abu (`--muted`) di kartu kecil batas bawah AA; dipakai hanya untuk info sekunder.
- **Target sentuh**: semua tombol ≥42px, node peta ±52px. Lolos.
- **Label**: node terkunci kini punya aria-label "terkunci".

## Yang sudah bagus
- Bahasa visual konsisten dan berkarakter, ikon SVG sendiri di semua layar.
- Alur 1 ketukan sangat cepat dipahami; tutorial di level 1 jelas.
- Hadiah harian dan peti bintang terbaca jelas dengan hadiah besar di hari 7.

## Prioritas yang dikerjakan
1. **Peta yang fokus ke tujuan berikutnya** (ringkas bab jauh, progres bab, tombol lanjut, preview level).
2. **Layar kalah yang mengajari**, bukan menghukum.
3. **Target terlihat di mana-mana**: jeda, preview, slot bintang di layar menang, baris tujuan di home.
