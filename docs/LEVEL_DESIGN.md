# LETUP! v1.2: audit level & desain ulang

## 1. Audit v1.1 (sebelum)
Diukur dengan simulasi 150 percobaan "ketukan terarah" per level (bot memilih kumpulan gelembung terpadat, mirip pemain yang memperhatikan papan).

| Level | Menang | Bintang 2 | Bintang 3 |
| --- | --- | --- | --- |
| 1-10 | 79% | 11% | **0%** |
| 11-20 | 54% | 24% | 5% |
| 21-30 | 46% | 28% | 6% |
| 61-70 | 52% | 27% | 11% |
| 91-100 | 53% | 24% | 4% |

Masalah utama:
- **Bintang 3 = meletupkan semua gelembung.** Di level awal papannya jarang, jadi rantai hampir tidak pernah menghabiskan semuanya: bintang 3 di level 1-10 praktis mustahil. Di level akhir papannya padat dan rantainya "meledak total", jadi bintang 3 justru lebih mudah. Ini persis yang dirasakan pemain.
- Kesulitan naik turun acak (level 16 lebih mudah dari 14), tanpa ritme.
- Tidak ada tujuan jangka panjang selain "level berikutnya": tidak ada peta, tidak ada alasan mengulang level.

## 2. Prinsip desain v1.2
1. **Bintang diukur dari distribusi, bukan dari "semua".** Untuk tiap level, generator menjalankan 240 percobaan pada papan yang persis sama, lalu memilih ambang sehingga satu percobaan terarah mencapai bintang 1 / 2 / 3 dengan peluang yang direncanakan. Dengan begitu bintang 3 selalu menantang tapi mungkin, di level berapa pun.
2. **Ritme gigi gergaji.** 20 bab × 10 level. Di dalam bab: level 1-4 naik, level 5 bonus (napas), level 6-9 naik lagi, level 10 bos. Bab baru selalu dimulai sedikit lebih mudah dari akhir bab sebelumnya, jadi masuk bab baru terasa seperti hadiah.
3. **Satu mekanik baru per bab di awal**, lalu digabung-gabung: Bom (bab 2), Pembelah (3), Es (4), Baja (5), Hantu (6), Magnet (7), lalu bab bertema formasi papan (gugus, cincin, spiral, garis) dan bab yang menonjolkan satu mekanik lama.
4. **Papan dikurasi.** Dari 4 kandidat papan per level, generator memilih yang rantai tipikalnya paling panjang, jadi tiap level terasa "juicy", lalu ambang bintang menjaga kesulitannya tetap sesuai rencana.

Peluang terencana per percobaan terarah (bintang 1): bab 1 sekitar 95% menurun ke sekitar 45% di bab 20. Bintang 2 = setengahnya, bintang 3 = seperlimanya (bab 1: seperempat).

## 3. Hasil v1.2 (diukur ulang, 100 percobaan per level, seed berbeda)
| Bab | Bintang 1 | Bintang 2 | Bintang 3 |
| --- | --- | --- | --- |
| 1 | 86% | 47% | **30%** |
| 5 | 79% | 40% | 21% |
| 10 | 64% | 40% | 20% |
| 15 | 58% | 31% | 14% |
| 20 | 49% | 31% | 21% |

Kurva turun mulus, dan bintang 3 di bab 1 naik dari 0% ke 30%.

## 4. Fitur baru untuk lama bermain & retensi
| Fitur | Tujuan |
| --- | --- |
| **Peta level 200 level / 20 bab** | Tujuan jangka panjang yang terlihat, bisa pilih level mana pun yang terbuka |
| **Gerbang bintang**: bab N butuh `ceil((N-1) × 30 × 0.55)` bintang (bab 2 = 17, bab 10 = 149) | Memberi alasan mengulang level lama untuk bintang 2-3 (lama bermain naik tanpa konten baru) |
| **Level Bos** tiap level 10: Raja Gelembung ber-HP, tiap ledakan berbeda = 1 HP, pemain dapat 2 ketukan, bonus pertama +100 koin | Klimaks tiap bab, momen "wow" yang bisa dibagikan |
| **Peti Bintang** tiap 15 bintang: koin + Ledakan Super (bisa digandakan iklan) | Hadiah berkala dari progres, menghubungkan bintang dengan ekonomi |
| **Hadiah login 7 hari** (hari 7 hadiah besar, bisa 2x lewat iklan) | Alasan buka game tiap hari (D1/D7) |
| **Stok Ledakan Super** | Power-up yang bisa disimpan, dipakai saat level sulit |
| **Penanda bintang 2 dan 3 di bar** | Pemain melihat langsung berapa lagi untuk bintang berikutnya |
| Mekanik **Hantu** (hanya bisa kena saat terlihat) dan **Magnet** (menarik gelembung) | Variasi agar 200 level tidak terasa sama |
| Formasi papan (gugus, cincin, garis, spiral) | Papan terlihat berbeda dan memberi hadiah pada pemain yang membaca pola |

Placement iklan berhadiah baru: `chest_double`, `login_double`.

## 5. Alat
```
node scripts/gen-levels.js 240             # hitung ulang semua level (sekitar 4 menit)
node scripts/gen-levels.js 240 1 200 --boss # hanya level bos
node scripts/audit-stars.js 100            # ukur ulang peluang bintang per bab
```
Setiap perubahan konstanta di `js/engine.js` atau `levelShape` harus diikuti `gen-levels.js`.
