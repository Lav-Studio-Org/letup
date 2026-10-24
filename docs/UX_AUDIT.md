# Audit UI/UX LETUP! (v1.0 -> v1.1)

Sudut pandang: senior UI/UX designer, fokus HP (390x844) dan pemain baru di menit pertama.

## Kesan pertama
Logo pelangi dan gelembung neon langsung terasa "game", ledakan berantai sangat memuaskan. Peluang terbesar: kejelasan di detik-detik pertama (apa targetnya, di mana mengetuk) dan rasa hadiah setelah menang.

## Temuan & perbaikan
| Temuan | Tingkat | Perbaikan v1.1 |
| --- | --- | --- |
| Petunjuk tutorial level 1 terpotong di layar 390px | Kritis | Petunjuk dibungkus 2 baris, dipindah ke bawah agar tidak menutupi gelembung |
| Garis putih di bar target tidak dijelaskan | Tinggi | Penanda diganti ikon bendera + label "TARGET"; berubah hijau dan "TARGET TERCAPAI" saat lolos |
| Pemain baru tidak tahu harus mengetuk di mana | Tinggi | Level 1 menampilkan cincin berdenyut di kumpulan gelembung yang bagus |
| Demo di beranda menabrak logo, logo sulit dibaca | Sedang | Demo diredupkan 40% dan logo diberi bayangan gelap lembut |
| Streak "0" dengan ikon api di beranda terasa negatif untuk pemain baru | Sedang | Streak hanya tampil bila > 0; diganti pill total bintang (progres yang selalu naik) |
| Tombol ikon tanpa label (menu/ulang) di layar menang | Sedang | Semua tombol sekunder diberi label teks |
| "Hampir!" muncul walau baru 20% target | Sedang | Teks sesuai jarak: "Tipis banget!", "Hampir!", atau "Ayo, sekali lagi!" |
| Statistik harian "0 / 0" sebelum main | Rendah | Ditampilkan "-" dan "Mulai streak hari ini" |
| Legenda gelembung spesial 2 kolom, teks 13px sempit | Rendah | Jadi daftar 1 kolom, ikon 32px, teks 15px |
| Hadiah koin hanya angka statis | Rendah | Animasi hitung naik (+0 -> +N) di layar menang dan saat 2x koin |

## Yang sudah bagus (dipertahankan)
- Tidak ada emoji: semua ikon SVG sendiri, aturan warna konsisten (hijau + ikon video = iklan berhadiah, emas = koin, pink = aksi utama).
- Tombol utama besar (>= 52px), target sentuh pause 44px.
- Kontras teks redup (putih 62% di ungu gelap) sekitar 6:1, lolos WCAG AA.
- Umpan balik berlapis: nada, partikel, getar layar, slow-motion, getaran HP.
