# LETUP!

Game web satu ketukan: ketuk sekali, gelembung meletup berantai, dan setiap letupan memainkan nada sehingga rantai panjang terdengar seperti melodi.

Main: https://lavaruz.github.io/letup/

## Cara main
- Setiap level kamu hanya punya **1 ketukan**. Ledakan memecahkan gelembung yang tersentuh, dan gelembung itu ikut meledak.
- Capai target (garis putih di bar atas). Bintang 2 dan 3 untuk letupan yang lebih banyak.
- Rantai 15+ memicu **FEVER**: semua ledakan lebih besar.
- Gelembung spesial: Bom (ledakan besar), Pembelah (4 ledakan kecil), Es (semua melambat), Koin (+3 koin), Baja (butuh 2 kali kena).
- Tantangan Harian: board yang sama untuk semua pemain, kejar skor, jaga hari beruntun.

## Struktur
| File | Isi |
| --- | --- |
| `js/engine.js` | Simulasi murni (tanpa DOM), dunia tetap 360x640 sehingga sama di semua layar |
| `js/levels-data.js` | Target level 1-100, dihasilkan `scripts/gen-levels.js` |
| `js/render.js` | Canvas: glow, partikel, gelombang kejut, teks, getar layar |
| `js/audio.js` | Suara sintetis Web Audio, tiap tema punya tangga nada sendiri |
| `js/meta.js` | Profil, koin, tema, misi harian, tantangan harian, `LP.track` |
| `js/ads.js` | Lapisan iklan (mock di web). Aplikasi native cukup mengisi `LP.nativeAdProvider` |
| `js/main.js` | Alur game dan UI |

Tanpa build step: HTML/CSS/JS biasa. Deploy otomatis: setiap push ke `main` disalin ke branch `gh-pages` oleh `.github/workflows/pages.yml`.

## Iklan (siap untuk APK/AdMob)
Placement rewarded: `extra_tap` (+1 ketukan saat gagal), `double_coins`, `super_blast`, `daily_try`, `mission_double`, `free_coins`.
Interstitial hanya `level_end`, dibatasi: tidak di 6 hasil pertama, maksimal tiap 3 hasil level, jeda minimal 90 detik.

## Skrip
```
node scripts/gen-levels.js 300   # hitung ulang target level lewat simulasi ketukan
node scripts/balance.js 1 40     # cek peluang menang tiap level
python3 -m http.server 8123 & node scripts/smoke.js   # tes Playwright + screenshot ke shots/
node scripts/icons.js            # render icon.svg ke PNG
```
