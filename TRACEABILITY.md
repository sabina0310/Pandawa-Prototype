# TRACEABILITY.md — Pemetaan Kebutuhan Fungsional (PRD §6) ke Implementasi

Dokumen ini memetakan setiap kebutuhan fungsional pada `pandawaprd.md` §6
(SADM-1..8, ADM-1..8, CUST-1..6, SYS-1..7) ke halaman dan berkas JavaScript
yang benar-benar mengimplementasikannya di repositori ini per 2026-08-26.

**Metodologi:** setiap berkas yang dirujuk dibaca isinya secara langsung
(bukan disimpulkan dari nama berkas) untuk memverifikasi bahwa perilaku yang
disyaratkan PRD benar-benar ada dalam kode: fungsi yang dipanggil, baris
`setDoc`/`updateDoc`/`deleteDoc` yang nyata, atau ketiadaannya.

**Status:**
- **Terpenuhi** — perilaku yang diminta PRD ada dan berfungsi, walau mungkin ada catatan minor.
- **Sebagian** — sebagian perilaku ada (biasanya Read), tetapi ada bagian eksplisit dari kebutuhan yang tidak berfungsi atau tidak ada sama sekali.
- **Belum** — tidak ditemukan implementasi yang dapat dijangkau untuk kebutuhan ini.

Temuan lintas-kebutuhan yang penting untuk konteks: **tidak ada berkas
`firestore.rules`, `firebase.json`, atau `.firebaserc` di repositori ini**,
dan halaman `admin/*.html` serta `super-admin/*.html` **tidak melakukan
pengecekan sesi/peran apa pun sebelum merender data** — hanya halaman
login yang memvalidasi peran (lihat SYS-7). Ini memengaruhi status semua
kebutuhan yang menyebut kontrol akses.

---

## 6.1 Super Admin (Pemilik) — SADM-1..8

| ID | Kebutuhan (ringkas) | Halaman | Berkas JS | Status |
|---|---|---|---|---|
| SADM-1 | CRUD akun Admin | `super-admin/user-management.html` | `js/user-management.js`, `js/user-crud.js` | **Terpenuhi** |
| SADM-2 | CRUD kamar di 4 cabang | `super-admin/branches.html` | `js/admin-branches.js`, `js/admin-branches-crud.js` | **Terpenuhi** |
| SADM-3 | RUD akun pelanggan/user | `super-admin/user-management.html` | `js/user-management.js`, `js/user-crud.js` | **Terpenuhi** |
| SADM-4 | RUD data penghuni | `super-admin/tenants.html` | `js/tenants.js`, `js/tenants-crud.js` | **Sebagian** |
| SADM-5 | RUD penyewaan + update status transaksi | `super-admin/bookings.html`, `super-admin/detail-booking.html` | `js/admin-bookings.js`, `js/admin-detail-booking.js`, `js/admin-data.js` | **Sebagian** |
| SADM-6 | Read riwayat transaksi & masa sewa | `super-admin/financials.html`, `super-admin/tenants.html` | `js/admin-financials.js`, `js/tenants-crud.js` | **Terpenuhi** |
| SADM-7 | Dashboard real-time hunian & transaksi | `super-admin/dashboard-super-admin.html` | `js/admin-dashboard.js` | **Terpenuhi** |
| SADM-8 | Read + Print laporan keuangan per bulan/cabang | `super-admin/financials.html` | `js/admin-financials.js` | **Sebagian** |

**Catatan kekurangan:**

- **SADM-4** — Read dan Update lengkap (`tenants-crud.js:816-869`). Namun aksi "Hapus"
  (`tenants-crud.js:372-392`, `ubahArsip()`) tidak pernah memanggil `deleteDoc` — ia hanya
  menandai `penghuni_diarsipkan: true` (soft-archive yang bisa dipulihkan). Tidak ada satu pun
  `deleteDoc` terhadap koleksi transaksi/penghuni di seluruh repo. Ini keputusan desain yang
  disengaja (menjaga riwayat pembayaran), tetapi secara literal tidak memenuhi "menghapus" pada PRD.
- **SADM-5** — Read lengkap dan real-time. Tetapi tidak ada jalur kode mana pun di
  `bookings.html`/`detail-booking.html` yang mengizinkan Super Admin mengubah `transaction_status`
  secara manual (mis. memaksa "lunas" atau membatalkan pembayaran), dan tidak ada `deleteDoc`
  terhadap `transaksi_pemesanan`. Tab status "Dibatalkan/Kadaluarsa" ada di markup tapi
  dikomentari (`bookings.html:73-78`). Update yang benar-benar ada hanya alokasi kamar dan check-in
  (fungsi sempit, bukan update umum atas pemesanan).
- **SADM-8** — Total pendapatan (Read) benar dan live. Tombol "Cetak Laporan (PDF)" ada di markup
  tetapi dikomentari (`financials.html:46-49`) — satu-satunya ekspor yang berfungsi adalah CSV
  (`exportCsv()`, `admin-financials.js:230-274`), bukan cetak/PDF. Input filter "Periode" tidak
  punya `id` dan tidak pernah dibaca oleh `admin-financials.js` — sekadar teks statis. Grafik
  perbandingan per-cabang dan tren per-bulan juga dikomentari/hardcode (`financials.html:199-248`),
  sehingga breakdown "per bulan dan per cabang" secara simultan tidak tersedia — hanya perbandingan
  bulan-ini-vs-bulan-lalu dan filter satu-cabang-per-waktu.

---

## 6.2 Admin (Petugas) — ADM-1..8

| ID | Kebutuhan (ringkas) | Halaman | Berkas JS | Status |
|---|---|---|---|---|
| ADM-1 | RUD akun pelanggan/user | — | — | **Belum** |
| ADM-2 | RUD data penghuni di lokasinya | `admin/check-ins.html` | `js/admin-checkins.js`, `js/admin-data.js` | **Sebagian** |
| ADM-3 | RUD penyewaan + update status transaksi | `admin/bookings.html`, `admin/detail-booking.html` | `js/admin-bookings.js`, `js/admin-detail-booking.js` | **Sebagian** |
| ADM-4 | Read data transaksi & masa sewa | `admin/bookings.html`, `admin/detail-booking.html` | `js/admin-bookings.js`, `js/admin-detail-booking.js` | **Terpenuhi** |
| ADM-5 | Dashboard monitoring status hunian | `admin/dashboard-admin.html` | `js/admin-dashboard.js` | **Terpenuhi** |
| ADM-6 | Read + Print laporan operasional | `admin/detail-booking.html` | `js/admin-detail-booking.js` | **Sebagian** |
| ADM-7 | Read-only data cabang & kamar | `admin/branches.html` | `js/admin-branches.js` | **Terpenuhi** |
| ADM-8 | Alokasi kamar untuk pemesanan lunas | `admin/alokasi-kamar.html` | `js/admin-alokasi-kamar.js`, `js/admin-data.js` | **Terpenuhi** |

**Catatan kekurangan:**

- **ADM-1** — Tidak ada `admin/user-management.html` atau setara. `js/user-management.js` dan
  `js/user-crud.js` (yang mengimplementasikan CRUD akun) hanya diimpor oleh
  `super-admin/user-management.html`; tidak dirujuk oleh satu pun berkas di `admin/`.
  `admin/top-nav.html` juga tidak punya tautan navigasi ke halaman semacam ini. PRD §14.2
  (Inventaris Halaman Portal Admin) sendiri tidak mencantumkan halaman untuk ADM-1 — kekosongan
  ini sudah tersirat di PRD, dikonfirmasi oleh ketiadaan berkasnya.
- **ADM-2** — Satu-satunya tulisan yang dapat dijangkau dari portal Admin terhadap data penghuni
  adalah `simpanCheckin()` (`admin-data.js:192-203`), yang hanya mengubah `status_checkin` dan
  `tanggal_aktual_checkin` pada dokumen transaksi. Tidak ada edit nama/NIK/kontak penghuni, tidak
  ada arsip/pulihkan, dan tidak ada halaman "Data Penghuni" tersendiri untuk Admin — kapabilitas
  penuh (`js/tenants.js` + `js/tenants-crud.js`) hanya dipakai oleh `super-admin/tenants.html`.
- **ADM-3** — `admin/bookings.html` dan `admin/detail-booking.html` murni tampilan baca (tidak ada
  kontrol edit/hapus pada baris tabel maupun halaman detail). Satu-satunya tulisan yang tersedia
  dari portal Admin adalah alokasi kamar (`kamar_id`) dan check-in (`status_checkin`) — bukan
  pembaruan umum `transaction_status`, dan tidak ada `deleteDoc` terhadap pemesanan.
- **ADM-6** — Tombol "Unduh PDF/Cetak" (`admin/detail-booking.html:52-57`, via `html2canvas` +
  `jsPDF`) hanya menghasilkan kuitansi **satu transaksi**, bukan laporan operasional agregat.
  `admin/bookings.html` (tampilan daftar yang paling mendekati "laporan") tidak punya tombol
  cetak/ekspor sama sekali, dan tidak ada padanan `admin-financials.js` untuk portal Admin.

---

## 6.3 Customer (Calon/Penyewa) — CUST-1..6

| ID | Kebutuhan (ringkas) | Halaman | Berkas JS | Status |
|---|---|---|---|---|
| CUST-1 | Read info kos, ketersediaan, tarif | `index.html`, `customer/catalogue.html`, `customer/room-detail.html` | `js/index-katalog.js`, `js/catalogue.js`, `js/room-detail.js`, `js/customer-data.js` | **Terpenuhi** |
| CUST-2 | Konsultasi via tautan WhatsApp | `index.html`, `customer/room-detail.html`, dan lainnya | — (tautan `<a href="wa.me/...">` statis) | **Terpenuhi** |
| CUST-3 | Create + Read pemesanan kamar | `customer/order/step-1..4.html` | `js/order-step1.js` .. `js/order-step4.js`, `js/order-step3-simpan.js`, `js/customer-data.js`, `api/create-transaction.js` | **Terpenuhi** |
| CUST-4 | Create + Read perpanjangan sewa | `customer/cust-profile.html`, `customer/extend/step-1..3.html` | `js/cust-profile.js`, `js/extend-step1.js` .. `js/extend-step3.js` | **Terpenuhi** |
| CUST-5 | Read tagihan & status pembayaran | `customer/history-order.html`, `customer/detail-pesanan.html` | `js/history-order.js`, `js/detail-pesanan.js`, `js/status-pesanan.js` | **Terpenuhi** |
| CUST-6 | Terima notifikasi jatuh tempo via WhatsApp | — (proses backend) | `api/cron.js`, `api/_notifikasi-lib.js` | **Terpenuhi** |

**Catatan minor (tidak menurunkan status):**

- **CUST-2** — Tautan `wa.me` nyata dan berfungsi, tetapi tidak membawa parameter pesan
  (`?text=`) dan nomor yang dipakai tidak konsisten antar halaman (`6281234567890` di
  index/login/register vs `6281112345678` di room-detail/order/sidebar). Kosmetik, bukan cacat
  fungsional terhadap redaksi kebutuhan.
- **CUST-6** — Jalur produksi (`api/cron.js`, dijadwalkan oleh `vercel.json` setiap `0 2 * * *`)
  benar-benar mengirim WhatsApp via Fonnte dan berfungsi untuk pengingat H-7 (bulanan) dan
  jatuh-tempo-hari-ini (harian). Namun ada berkas kembar `api/cron-notifikasi-tenggat.js` dengan
  desain milestone H-7/H-3/H-1 yang **tidak terdaftar di `vercel.json`** dan query-nya rusak
  (`where('status_perpanjangan', '==', false)` padahal nilai field yang sebenarnya adalah string
  `"belum"`, bukan boolean `false`) — berkas ini efektif mati/tidak pernah tereksekusi otomatis,
  dan komentar headernya yang menyatakan "1x sehari (lihat vercel.json)" sudah usang. Ini risiko
  pemeliharaan (kode membingungkan), bukan kegagalan fitur CUST-6 itu sendiri.

---

## 6.4 Sistem — Aturan Bisnis & Integrasi — SYS-1..7

| ID | Kebutuhan (ringkas) | Berkas Utama | Status |
|---|---|---|---|
| SYS-1 | Validasi sewa harian (pria, Rp100.000/hari) | `js/order-step1.js`, `js/customer-data.js`, `js/admin-branches-crud.js` | **Sebagian** |
| SYS-2 | Validasi sewa bulanan (keluarga/suami-istri sah, Rp500.000/bulan) | `js/order-step1.js`, `js/customer-data.js`, `js/admin-branches-crud.js` | **Sebagian** |
| SYS-3 | Catat setiap notifikasi + status pengiriman ke `log_notifikasi` | `api/cron.js`, `api/_notifikasi-lib.js` | **Sebagian** |
| SYS-4 | Otomatis mencatat pemesanan & transaksi | `js/customer-data.js`, `js/order-step3-simpan.js`, `api/create-transaction.js` | **Sebagian** |
| SYS-5 | Integrasi Midtrans Core API (Sandbox), UI pembayaran built-in | `api/create-transaction.js`, `api/check-status.js`, `js/pembayaran.js` | **Terpenuhi** |
| SYS-6 | Integrasi WhatsApp Gateway Fonnte | `api/_notifikasi-lib.js`, `api/cron.js` | **Terpenuhi** |
| SYS-7 | RBAC pada antarmuka maupun aturan keamanan Firestore | `js/customer-auth.js`, `js/login-pengelola.js`, `js/sesi-valid.js`, `js/sandi.js` | **Sebagian** |

**Catatan kekurangan:**

- **SYS-1** — Tidak ada field jenis kelamin di mana pun pada form pemesanan (`periksaForm()`,
  `order-step1.js`) — aturan "khusus tamu laki-laki" hanya berupa teks peringatan statis
  (`customer/order/step-1.html:98-107`) yang menyatakan petugas akan memeriksa manual saat
  check-in; sistem sendiri tidak memvalidasinya. Tarif Rp100.000/hari juga bukan konstanta yang
  ditegakkan sistem — nilainya adalah field `cabang.harga_harian` yang bebas diubah admin
  (`admin-branches-crud.js`, validasi hanya `> 0`); Rp100.000 hanyalah nilai awal seeding.
- **SYS-2** — Dropdown hubungan keluarga dibatasi ke `suami`/`istri`/`anak`
  (`order-step1.js:170-173`), tetapi ini murni input yang dipercaya begitu saja tanpa verifikasi
  status pernikahan apa pun. Tarif Rp500.000/bulan juga bukan konstanta tegak — `seed-data.js`
  sendiri men-seed rentang Rp500.000–800.000 berbeda per cabang, dan admin bebas mengubahnya.
- **SYS-3** — Pengiriman notifikasi yang **gagal** sengaja tidak pernah ditulis ke
  `log_notifikasi` (`api/cron.js:226-233`, dikomentari eksplisit dalam kode: agar bisa dicoba
  ulang) — akibatnya field `status` pada koleksi ini selalu `'berhasil'` dan koleksi tidak pernah
  dapat mencerminkan kegagalan pengiriman nyata, bertentangan dengan "beserta status
  pengirimannya". Berkas `api/cron-notifikasi-tenggat.js` bahkan tidak pernah menulis ke
  `log_notifikasi` sama sekali (lihat catatan CUST-6).
- **SYS-4** — Pencatatan otomatis benar terjadi (`simpanPesananKeFirestore()`,
  `customer-data.js:177-247`), tetapi dipicu sepenuhnya dari sisi klien setelah polling status
  Midtrans mendeteksi `settlement` — tidak ada Midtrans webhook/notification handler di sisi
  server. Jika tab peramban ditutup tepat setelah pembayaran sukses namun sebelum panggilan ini
  sempat berjalan, pembayaran tercatat di Midtrans tetapi **tidak ada dokumen pemesanan yang
  pernah dibuat** — risiko kehilangan data untuk kebutuhan yang eksplisit menuntut "otomatis".
- **SYS-7** — Tidak ditemukan berkas `firestore.rules`/`firebase.json`/`.firebaserc` di
  repositori (dikonfirmasi lewat pencarian menyeluruh) — separuh kebutuhan ("aturan keamanan
  Firestore") sama sekali tidak dapat diverifikasi/tidak ada. Komentar kode sendiri mengakui ini
  (`js/sandi.js:31`: "Firestore Rules masih terbuka"). Pada sisi antarmuka, pengecekan peran
  hanya terjadi di formulir login (`masukkanPenggunaBerperan()`, `customer-auth.js:259-271`) —
  setelah itu, **tidak ada halaman `admin/*.html` atau `super-admin/*.html` yang memvalidasi
  ulang sesi/peran sebelum merender data**. Siapa pun yang mengetik URL halaman admin/super-admin
  secara langsung akan melihat seluruh data Firestore dimuat tanpa login sama sekali.

---

## Ringkasan

| Status | Jumlah | Persentase |
|---|---:|---:|
| Terpenuhi | 17 | 58.6% |
| Sebagian | 11 | 37.9% |
| Belum | 1 | 3.4% |
| **Total** | **29** | **100%** |

**Per bagian PRD:**

| Bagian | Terpenuhi | Sebagian | Belum | Total |
|---|---:|---:|---:|---:|
| 6.1 Super Admin (SADM) | 5 | 3 | 0 | 8 |
| 6.2 Admin (ADM) | 4 | 3 | 1 | 8 |
| 6.3 Customer (CUST) | 6 | 0 | 0 | 6 |
| 6.4 Sistem (SYS) | 2 | 5 | 0 | 7 |

**Tiga temuan lintas-kebutuhan yang paling berdampak** (memengaruhi lebih dari satu ID di atas):

1. **Tidak ada Firestore Security Rules di repo** (SYS-7) — meniadakan separuh dari setiap
   klaim RBAC, dan berarti setiap batasan "hanya boleh diubah sistem/admin" (mis. `SYS-4`
   status pembayaran) hanya ditegakkan oleh konvensi kode klien, bukan oleh server.
2. **Halaman admin/super-admin tidak memvalidasi sesi setelah login** (SYS-7) — URL-nya dapat
   diakses langsung tanpa otentikasi, membuat pemisahan Admin vs Super Admin di seluruh §6.1/6.2
   bersifat kosmetik pada level UI meskipun data-nya sendiri sudah benar ketika ditampilkan.
3. **Portal Admin tidak memiliki halaman manajemen akun maupun manajemen penghuni sendiri**
   (ADM-1, ADM-2) — kapabilitas ini hanya ada di Portal Super Admin; jika pemisahan peran ini
   disengaja, PRD §6.2 perlu direvisi agar tidak menjanjikan RUD penuh untuk Admin.
