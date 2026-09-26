# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Sistem Manajemen dan Pemesanan Kos Terpadu — Pilar Pandawa

**STATUS: REVISI**

| | |
| --- | --- |
| **Nama Produk** | Pilar Pandawa — Sistem Manajemen & Pemesanan Kos Terpadu (Prototype) |
| **Versi Dokumen** | v0.1 |
| **Disusun oleh** | Pengembang |
| **Untuk** | Klien / Pemilik Kos Pilar Pandawa |
| **Tanggal** | 24 Juli 2026 |
| **Dokumen Terkait** | Notulen Rapat Analisis Bisnis Kos |
---

# 1. Ringkasan Produk (Overview)

Perusahaan pengelola kos **Pilar Pandawa** saat ini menaungi 4 cabang dengan kapasitas percabang 10-15 kamar. Proses operasional saat ini masih bergantung pada metode manual, di mana seluruh komunikasi antara calon penyewa dan petugas lapangan dilakukan via percakapan WhatsApp. Informasi transaksi penyewaan tersebut dicari satu per satu dari riwayat chat lalu disalin manual ke berkas Excel. Hambatan utama yang terjadi meliputi riwayat pesan yang terhapus atau tertumpuk, inkonsistensi data pencatatan, keterlambatan pengingat jatuh tempo yang memicu penyewa *overstay*, hingga kerugian finansial akibat tidak adanya bukti pembayaran terutama pada pembayaran cash yang hanya berdasarkan kuitansi pembayaran yang dibuat oleh petugas kos.

Sebagai solusi, akan dikembangkan **Pilar Pandawa** sebagai Sistem Manajemen dan Pemesanan Kos Terpadu berbasis web terpusat untuk mengintegrasikan seluruh operasional penyewaan. Pada tahap ini, aplikasi dikembangkan menggunakan **metode Prototype** untuk memvalidasi alur sistem, antarmuka (*user interface*), serta kesesuaian fitur bisnis transaksi bagi Super Admin (Pemilik), Admin (Petugas Kos), dan Customer (Calon/Penyewa). Prototype ini berfokus penuh pada siklus transaksi penyewaan—mulai dari penyediaan informasi kos, pemesanan kamar online, pembayaran otomatis via *payment gateway*, pengiriman notifikasi pengingat jatuh tempo kepada penyewa via WhatsApp Gateway, hingga dashboard pemantauan hunian dan laporan keuangan *real-time*.

# 2. Tujuan & Sasaran (Goals)

- Memusatkan seluruh pencatatan data penyewaan dan transaksi otomatis Pilar Pandawa agar tidak lagi bergantung pada riwayat pesan WhatsApp dan berkas Excel manual.
- Memungkinkan perusahaan melakukan pembukuan transaksi penyewaan dengan lebih cepat dan akurat.
- Meminimalisir kerugian finansial akibat potensi *human error* pada pembukuan.
- Menghindari kerugian finansial akibat penyewa yang melewati batas waktu sewa (*overstay*) melalui pengingat tagihan otomatis.
- Meminimalkan beban kerja administratif staf/petugas lapangan dalam mengecek jadwal jatuh tempo secara manual.
- Memberikan transparansi keuangan secara *real-time* kepada pemilik kos untuk memantau pendapatan bulanan per cabang maupun keseluruhan.

# 3. Pengguna & Peran (Users & Roles)

- **Super Admin (Pemilik) :** Memiliki wewenang tertinggi untuk mengelola akun Admin (CRUD), memantau dan memperbarui data pelanggan (RUD), mengelola data penghuni (RUD), mengelola kamar (CRUD), mengelola penyewaan dan status transaksi (RUD), serta mengakses riwayat transaksi, masa sewa, dashboard monitoring, dan mencetak laporan keuangan.
- **Admin (Petugas) :** Staf lapangan yang bertugas mengelola data pelanggan (RUD), mengelola data penghuni di lokasi (RUD), memperbarui status transaksi penyewaan (RUD), mengalokasikan nomor kamar bagi pemesanan baru, memantau riwayat transaksi, masa sewa, dan dashboard hunian, serta mencetak laporan operasional.
- **Customer (Calon / Penyewa) :** Pengguna publik yang dapat membaca informasi kos Pilar Pandawa, berkonsultasi via direct WhatsApp, mengajukan sewa dan perpanjangan sewa (CR), melihat tagihan pembayaran, serta menerima pesan notifikasi via WhatsApp.

# 4. Ruang Lingkup (Scope)

## 4.1 Termasuk (MVP - Prototype Transaksi)

- **Landing Page & Pencatatan Pencarian (Home Customer):** Tampilan halaman utama (*home*) untuk pelanggan yang dilengkapi fitur filter pencarian berdasarkan tanggal sewa dan tipe kos (harian atau bulanan).
- **Katalog Kos & Detail Lokasi:** Halaman khusus katalog kos di mana pelanggan dapat melihat daftar kamar, rincian detail kamar, serta informasi lokasi cabang secara jelas sebelum memesan.
- **Manajemen Cabang & Kamar:** Pengelolaan data 4 cabang kos Pilar Pandawa dengan rentang 10-15 kamar per cabang.
- **Aturan Pemesanan & Tarif:** Penanganan sewa harian (khusus pria, Rp100.000/hari) dan sewa bulanan (keluarga sah/suami istri, boleh membawa anak, Rp500.000/bulan).
- **Form Pemesanan & Syarat Berkas:** Pengisian identitas (NIK, Nama, Nomor WhatsApp, Lama Pemesanan) serta dengan keterangan untuk menyerahkan fotokopi KTP untuk sewa bulanan.
- **Fitur Konsultasi WhatsApp:** Tautan langsung konsultasi WhatsApp ke petugas kos untuk menanyakan rincian kamar sebelum bertransaksi.
- **Persistensi Data pada Cloud Firestore:** Seluruh entitas sistem (pengguna, cabang, kamar, penghuni, pemesanan, transaksi, log notifikasi) disimpan pada basis data Cloud Firestore dan dapat diakses lintas sesi maupun lintas peran.
- **Otomatisasi Pembayaran (Midtrans Core API, Sandbox):** Integrasi *Payment Gateway* Midtrans Core API pada mode Sandbox untuk memproses transaksi sewa dan memperbarui status pembayaran secara otomatis. Antarmuka pembayaran dibangun sendiri di dalam sistem; kode QRIS dan nomor Virtual Account ditampilkan langsung pada halaman pembayaran.
- **Pengingat & Notifikasi WhatsApp (Fonnte):** Integrasi WhatsApp Gateway Fonnte untuk pengiriman pengingat batas waktu sewa dan tagihan otomatis, dijalankan melalui penjadwal (*cron*).
- **Dashboard & Laporan:** Visualisasi dashboard monitoring status hunian dan laporan keuangan *real-time* per bulan/per cabang dengan fungsi cetak.
- **Kontrol Akses Berbasis Peran (RBAC):** Pembatasan akses halaman dan data menurut peran Super Admin, Admin, dan Customer, ditegakkan pada sisi antarmuka maupun pada aturan keamanan Firestore.

## 4.2 Di Luar Lingkup Awal / Fase Lanjutan

- **Import Data Lama (Migrasi Data):** Pemindahan atau *importing* data historis penyewaan dan pembukuan dari berkas Excel lama ke dalam sistem tidak masuk dalam ruang lingkup pengembangan prototype ini.
- **Mode Produksi Payment Gateway:** Transaksi dijalankan pada mode Sandbox Midtrans. Aktivasi akun produksi beserta skema biaya komisi dilakukan setelah prototipe disetujui.
- **Verifikasi Dokumen KTP Secara Digital:** Pencocokan fotokopi KTP tetap dilakukan manual oleh petugas pada hari kedatangan; sistem hanya mencatat statusnya.

# 5. Asumsi & Batasan (Assumptions & Constraints)

- **Fokus Transaksi:** Pengembangan fitur difokuskan penuh pada proses pemesanan, pembayaran, pencatatan transaksi, dan notifikasi jatuh tempo sewa.
- **Metode Pengembangan:** Pengembangan sistem menggunakan **metode Prototype** yang berfokus pada validasi *user interface*, interaksi pengguna, dan pembuktian alur bisnis transaksi utama.
- **Persistensi Data:** Prototipe menggunakan **Cloud Firestore** sebagai basis data. Data awal (4 cabang beserta kamarnya, akun contoh tiap peran) dimasukkan melalui skrip *seeder* dan bersifat data contoh, bukan data operasional nyata milik perusahaan.
- **Data Historis:** Tidak ada proses *import* atau migrasi data riwayat dari berkas Excel lama milik perusahaan ke dalam sistem prototype ini.
- **Platform:** Sistem dirancang sebagai aplikasi berbasis web yang responsif (*mobile-friendly*) agar mudah diakses oleh pemilik, petugas, dan calon penyewa.
- **Tumpukan Teknologi:** Antarmuka dibangun dengan HTML, Tailwind CSS (Play CDN), dan JavaScript *vanilla* tanpa *build tool*. Logika sisi peladen yang memerlukan kunci rahasia dijalankan sebagai *serverless function*.
- **Keamanan Kunci:** Kunci rahasia Midtrans (*Server Key*) dan token Fonnte tidak boleh berada pada kode sisi klien; keduanya disimpan sebagai variabel lingkungan pada *serverless function*.

# 6. Kebutuhan Fungsional (Functional Requirements)

## 6.1 Super Admin (Pemilik) — Kelola Sistem & Pengawasan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **SADM-1** | Super Admin dapat melakukan pembuatan, pembacaan, pembaruan, dan penghapusan (CRUD) data akun Admin (Petugas). | **Wajib** |
| **SADM-2** | Super Admin dapat mengelola (CRUD) data kamar di seluruh 4 cabang kos Pilar Pandawa. | **Wajib** |
| **SADM-3** | Super Admin dapat melihat, memperbarui, dan menghapus (RUD) data akun pelanggan/user login. | **Wajib** |
| **SADM-4** | Super Admin dapat mengelola (RUD) data penghuni kos. | **Wajib** |
| **SADM-5** | Super Admin dapat melihat, memperbarui, dan menghapus (RUD) data penyewaan beserta pembaruan status transaksi. | **Wajib** |
| **SADM-6** | Super Admin dapat melihat (Read) seluruh riwayat transaksi dan informasi masa sewa penyewa. | **Wajib** |
| **SADM-7** | Super Admin dapat melihat (Read) dashboard monitoring status hunian dan transaksi secara *real-time*. | **Wajib** |
| **SADM-8** | Super Admin dapat melihat dan mencetak (Read, Print) laporan keuangan total pendapatan per bulan dan per cabang. | **Wajib** |

## 6.2 Admin (Petugas) — Operasional Kos

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **ADM-1** | Admin dapat melihat (RUD) data penghuni kos di lokasi. | **Wajib** |
| **ADM-2** | Admin dapat melihat, memperbarui, dan menghapus (RUD) data penyewaan serta memperbarui status transaksi. | **Wajib** |
| **ADM-3** | Admin dapat melihat (Read) data transaksi dan data masa sewa penyewa. | **Wajib** |
| **ADM-4** | Admin dapat melihat (Read) dashboard monitoring status hunian. | **Wajib** |
| **ADM-5** | Admin dapat melihat (Read) data cabang beserta daftar kamar dan status ketersediaannya, tanpa wewenang mengubah. | **Wajib** |
| **ADM-6** | Admin dapat mengalokasikan nomor kamar yang tersedia kepada pemesanan yang telah lunas, serta memperbarui status kamar te7kait. | **Wajib** |

## 6.3 Customer (Calon / Penyewa) — Layanan & Pemesanan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **CUST-1** | Customer dapat melihat (Read) informasi kos Pilar Pandawa, ketersediaan kamar, dan rincian tarif. | **Wajib** |
| **CUST-2** | Customer dapat melakukan konsultasi langsung via tautan WhatsApp ke petugas. | **Wajib** |
| **CUST-3** | Customer dapat mengajukan pemesanan kamar (Create, Read) dengan mengisi form pemesanan (Nama, Nomor WhatsApp, dan Lama Pemesanan). | **Wajib** |
| **CUST-4** | Customer dapat mengajukan perpanjangan sewa (Create, Read) melalui sistem. | **Wajib** |
| **CUST-5** | Customer dapat melihat (Read) informasi rincian tagihan dan status pembayaran sewa. | **Wajib** |
| **CUST-6** | Customer dapat menerima notifikasi pesan pengingat jatuh tempo via WhatsApp. | **Wajib** |

## 6.4 Sistem — Aturan Bisnis & Integrasi (Prototype)

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **SYS-1** | Sistem wajib memvalidasi ketentuan sewa harian (khusus tamu laki-laki, tarif Rp100.000/hari). | **Wajib** |
| **SYS-2** | Sistem wajib memvalidasi ketentuan sewa bulanan (khusus keluarga/suami istri sah, boleh membawa anak, tarif Rp500.000/bulan). | **Wajib** |
| **SYS-3** | Sistem wajib mencatat setiap notifikasi yang dikirim ke penyewa beserta status pengirimannya ke dalam koleksi `log_notifikasi`, agar dapat ditelusuri bila terjadi kegagalan kirim. | **Wajib** |
| **SYS-4** | Sistem secara otomatis mencatat pemesanan dan transaksi pembukuan. | **Wajib** |
| **SYS-5** | Sistem mengintegrasikan *Payment Gateway* Midtrans Core API (Sandbox) untuk memproses pembayaran digital dan mengubah status transaksi, dengan antarmuka pembayaran yang dibangun sendiri di dalam sistem. | **Wajib** |
| **SYS-6** | Sistem mengintegrasikan WhatsApp Gateway Fonnte untuk pengiriman notifikasi pengingat jatuh tempo sewa dan tagihan. | **Wajib** |
| **SYS-7** | Sistem wajib menegakkan kontrol akses berbasis peran (RBAC) pada antarmuka maupun pada aturan keamanan Firestore. | **Wajib** |

# 7. Alur Pengguna Utama (Key User Flows)

## 7.1 Pemesanan Kamar Kos Online (Happy Path)

1. Customer mengakses portal sistem Pilar Pandawa dan memasukkan filter tanggal serta tipe sewa (bulanan/harian) pada halaman *home*.
2. Customer memilih cabang kos serta kamar yang tersedia dari katalog.
3. Customer memilih jenis sewa (Harian: khusus pria Rp100rb/hari, atau Bulanan: keluarga sah Rp500rb/bulan).
4. Customer mengisi form pemesanan berupa NIK, Nama, Nomor WhatsApp, Lama Pemesanan, dan identitas penghuni lain yang masuk khusus untuk kos bulanan.
5. Customer mengonfirmasi kewajiban penyerahan fotokopi KTP saat hari kedatangan (H-H).
6. Customer memilih metode pembayaran pada halaman pembayaran sistem, lalu sistem menampilkan kode QRIS atau nomor Virtual Account hasil pemanggilan Midtrans Core API secara langsung di halaman tersebut.
7. Setelah pembayaran berhasil, sistem memperbarui status transaksi menjadi "Lunas", menyimpan data pemesanan ke Firestore, dan memperbarui tampilan dashboard.

## 7.2 Notifikasi Pengingat Jatuh Tempo & Perpanjangan Sewa

1. Penjadwal (*cron*) melakukan pengecekan data masa sewa penyewa secara otomatis setiap hari.
2. Sebelum masa sewa berakhir (H-7, H-3, dan H-1), sistem memicu pengiriman pesan pengingat dan rincian tagihan via Fonnte ke nomor WhatsApp penyewa, lalu mencatatnya pada `log_notifikasi`.
3. Penyewa menerima pesan notifikasi WhatsApp dan dapat langsung mengakses sistem untuk melihat rincian tagihan.
4. Penyewa memilih menu pengajuan perpanjangan sewa dan menyelesaikan pembayaran via Midtrans.
5. Sistem memproses pembayaran, memperbarui batas masa sewa baru, serta memperbarui dashboard monitoring.

## 7.3 Pengelolaan Operasional Lapangan (Admin / Petugas)

1. Admin melakukan *login* ke portal operasional sistem Pilar Pandawa.
2. Saat ada **transaksi/pemesanan baru masuk**, Admin meninjau data pemesanan dan **mengalokasikan/memasukkan nomor kamar** yang tersedia untuk penyewa tersebut ke dalam sistem.
3. Pada hari kedatangan (H-H), Admin mencocokkan data fotokopi KTP dan data diri form pemesanan di website lalu menyerahkan kunci kamar kepada penyewa sesuai dengan nomor kamar yang telah dialokasikan di sistem.
4. Admin memperbarui status transaksi atau status hunian penyewa (misalnya mengubah status menjadi *"Checked-in"* atau *"Aktif"*).
5. Admin mengunduh atau mencetak laporan operasional harian/mingguan untuk diserahkan kepada pemilik.

## 7.4 Pengawasan Sistem & Analisis Keuangan (Super Admin / Pemilik)

1. Super Admin melakukan *login* ke portal manajemen terpusat.
2. Super Admin mengelola akun staf/petugas (menambah, mengubah hak akses, atau menghapus akun Admin).
3. Super Admin menambah, memperbarui, atau merestrukturisasi data kamar dan tarif pada 4 cabang kos Pilar Pandawa.
4. Super Admin mengakses *Dashboard Keuangan* untuk melihat performa pendapatan harian, bulanan, maupun per cabang secara *real-time*.
5. Super Admin mencetak *Laporan Keuangan* akhir bulan untuk keperluan evaluasi bisnis.

# 8. Model Data (Cloud Firestore)

## 8.1 Prinsip Perancangan

- Basis data menggunakan **Cloud Firestore** (NoSQL, berorientasi dokumen).
- Seluruh entitas ditempatkan sebagai **koleksi tingkat atas** (*top-level collection*), bukan sub-koleksi, agar kueri lintas cabang tetap sederhana pada skala prototipe.
- Relasi antar entitas diwakili oleh **field referensi berupa ID dokumen bertipe string** (misalnya `cabang_id`), bukan tipe `DocumentReference`, agar mudah dibaca saat *seeding* dan pengujian.
- Field yang sering ditampilkan bersamaan **didenormalisasi seperlunya** (misalnya `nama_cabang` disalin ke dokumen `kamar`) untuk mengurangi jumlah pembacaan.
- Seluruh field waktu menggunakan tipe **Timestamp** Firestore, kecuali `tanggal_mulai` dan `tanggal_selesai` yang juga disimpan sebagai string `YYYY-MM-DD` untuk kemudahan filter.

## 8.2 Daftar Koleksi

| **Koleksi** | **Fungsi** | **Perkiraan Volume Prototipe** |
| --- | --- | --- |
| `users` | Identitas dan peran seluruh pengguna sistem | ± 20 dokumen |
| `cabang` | Data 4 lokasi cabang kos | 4 dokumen |
| `kamar` | Data kamar pada seluruh cabang | ± 50 dokumen |
| `penghuni` | Detail identitas penghuni per pemesanan | ± 30 dokumen |
| `pemesanan` | Pencatatan transaksi sewa dan perpanjangan | ± 30 dokumen |
| `transaksi` | Pencatatan keuangan hasil payment gateway | ± 30 dokumen |
| `log_notifikasi` | Rekam jejak pengiriman notifikasi WhatsApp | ± 50 dokumen |

## 8.3 Skema Field

### `users`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `nama` | string | Nama lengkap pengguna |
| `username` | string | Digunakan untuk login Super Admin & Admin |
| `email` | string | Digunakan untuk login Customer |
| `password_hash` | string | Kata sandi tersimpan dalam bentuk *hash* |
| `no_whatsapp` | string | Format `62xxxxxxxxxx` |
| `role` | string (enum) | `super_admin` \| `admin` \| `customer` |
| `cabang_id` | string \| null | Diisi hanya untuk `role = admin`, menandai cabang penugasan |
| `status_akun` | string (enum) | `aktif` \| `nonaktif` |
| `created_at` | Timestamp | Waktu pembuatan akun |

### `cabang`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `nama_cabang` | string | Nama cabang kos |
| `alamat` | string | Alamat lengkap |
| `koordinat` | map `{lat, lng}` | Titik lokasi untuk peta |
| `foto_url` | string | Tautan gambar cabang |

### `kamar`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `cabang_id` | string | Referensi ke `cabang` |
| `nama_cabang` | string | Denormalisasi, untuk tampilan katalog |
| `nomor_kamar` | string | Contoh `A02` |
| `lantai` | number | Nomor lantai |
| `tipe_sewa` | string (enum) | `harian` \| `bulanan` |
| `harga` | number | `100000` untuk harian, `500000` untuk bulanan |
| `status_ketersediaan` | string (enum) | `tersedia` \| `terisi` \| `maintenance` \| `akan_checkout` |
| `fasilitas` | array\<string\> | Contoh `["Kamar mandi dalam", "AC", "Wi-Fi"]` |
| `foto_url` | array\<string\> | Tautan gambar kamar |

### `penghuni`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `user_id` | string | Referensi ke `users` (pemesan utama) |
| `pemesanan_id` | string | Referensi ke `pemesanan` |
| `nama` | string | Nama penghuni |
| `nik` | string | 16 digit |
| `jenis_kelamin` | string (enum) | `laki_laki` \| `perempuan` — dasar validasi SYS-1 |
| `status_pernikahan` | string (enum) | `menikah` \| `belum_menikah` — dasar validasi SYS-2 |
| `hubungan` | string (enum) | `pemesan` \| `pasangan` \| `anak` |
| `status_ktp_diterima` | boolean | Ditandai Admin saat check-in |

### `pemesanan`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `user_id` | string | Referensi ke `users` |
| `kamar_id` | string \| null | Diisi Admin saat alokasi kamar (ADM-8) |
| `cabang_id` | string | Referensi ke `cabang` |
| `jenis_sewa` | string (enum) | `harian` \| `bulanan` |
| `lama_pemesanan` | number | Jumlah hari atau bulan |
| `tanggal_mulai` | string `YYYY-MM-DD` | Awal masa sewa |
| `tanggal_selesai` | string `YYYY-MM-DD` | Akhir masa sewa, dihitung sistem |
| `total_tagihan` | number | `harga × lama_pemesanan` |
| `status_pemesanan` | string (enum) | `menunggu_pembayaran` \| `lunas` \| `dialokasikan` \| `checked_in` \| `aktif` \| `selesai` \| `dibatalkan` |
| `is_perpanjangan` | boolean | Menandai pemesanan hasil perpanjangan |
| `pemesanan_induk_id` | string \| null | Referensi ke pemesanan yang diperpanjang |
| `created_at` | Timestamp | Waktu pemesanan dibuat |

### `transaksi`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `pemesanan_id` | string | Referensi ke `pemesanan` |
| `order_id` | string | ID pesanan yang dikirim ke Midtrans |
| `transaction_id` | string | ID transaksi dari respons Midtrans |
| `payment_type` | string (enum) | `qris` \| `bank_transfer` \| `echannel` |
| `bank` | string \| null | Diisi untuk `bank_transfer`, contoh `bca`, `bni`, `bri` |
| `va_number` | string \| null | Nomor Virtual Account bila metode `bank_transfer` |
| `qr_url` | string \| null | Tautan gambar kode QRIS bila metode `qris` |
| `expiry_time` | Timestamp | Batas waktu pembayaran |
| `total_bayar` | number | Nominal tagihan |
| `metode_pembayaran` | string | Diisi dari respons Midtrans, contoh `qris`, `bank_transfer` |
| `status_pembayaran` | string (enum) | `pending` \| `settlement` \| `expire` \| `cancel` \| `deny` |
| `tanggal_bayar` | Timestamp \| null | Waktu pembayaran terverifikasi |
| `created_at` | Timestamp | Waktu transaksi dibuat |

### `log_notifikasi`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string (doc ID) | Identitas dokumen |
| `pemesanan_id` | string | Referensi ke `pemesanan` |
| `no_whatsapp` | string | Nomor tujuan |
| `jenis_notifikasi` | string (enum) | `pengingat_h7` \| `pengingat_h3` \| `pengingat_h1` \| `tagihan` \| `konfirmasi_bayar` |
| `isi_pesan` | string | Teks pesan yang dikirim |
| `status_kirim` | string (enum) | `terkirim` \| `gagal` |
| `pesan_galat` | string \| null | Diisi bila `status_kirim = gagal` |
| `waktu_kirim` | Timestamp | Waktu pengiriman |

## 8.4 Indeks Komposit yang Diperlukan

| Koleksi | Field | Kegunaan |
| --- | --- | --- |
| `kamar` | `cabang_id` + `tipe_sewa` + `status_ketersediaan` | Filter katalog pada halaman *home* dan katalog |
| `pemesanan` | `user_id` + `created_at` (desc) | Riwayat pesanan Customer |
| `pemesanan` | `cabang_id` + `status_pemesanan` | Daftar booking pada portal Admin |
| `pemesanan` | `status_pemesanan` + `tanggal_selesai` | Pengecekan jatuh tempo oleh *cron* |
| `transaksi` | `status_pembayaran` + `tanggal_bayar` | Laporan keuangan Super Admin |
| `log_notifikasi` | `pemesanan_id` + `waktu_kirim` (desc) | Penelusuran riwayat notifikasi |

## 8.5 Aturan Keamanan (Ringkasan RBAC)

| Koleksi | Customer | Admin | Super Admin |
| --- | --- | --- | --- |
| `cabang` | Baca | Baca | Baca, Tulis, Hapus |
| `kamar` | Baca | Baca, Ubah `status_ketersediaan` | Baca, Tulis, Hapus |
| `users` | Baca & ubah dokumen sendiri | Baca & ubah dokumen `role = customer` | Penuh |
| `penghuni` | Baca & tulis milik sendiri | Baca, Ubah, Hapus pada cabangnya | Penuh |
| `pemesanan` | Baca & tulis milik sendiri | Baca, Ubah pada cabangnya | Penuh |
| `transaksi` | Baca milik sendiri | Baca pada cabangnya | Penuh |
| `log_notifikasi` | Tidak ada akses | Baca pada cabangnya | Baca |

Penulisan pada koleksi `transaksi` untuk field `status_pembayaran` hanya boleh dilakukan oleh *serverless function*, tidak oleh klien.

# 9. Kebutuhan Non-Fungsional (Non-Functional Requirements)

- **Responsivitas & Mobile Friendly :** Tampilan sistem dirancang responsif agar nyaman diakses via ponsel pintar (*smartphone*) oleh penyewa di jalan maupun petugas di lapangan. Titik henti (*breakpoint*) mengikuti Tailwind: `sm` 640px, `md` 768px, `lg` 1024px.
- **Keamanan & Hak Akses :** Mengimplementasikan prinsip Role-Based Access Control (RBAC) yang membatasi hak akses data secara ketat antara Super Admin, Admin, dan Customer, ditegakkan pada antarmuka maupun pada Firestore Security Rules.
- **Antarmuka Pembayaran Mandiri :** Halaman pembayaran dirancang dan dibangun di dalam sistem. Kode QRIS ditampilkan sebagai gambar dengan tombol salin, dan nomor Virtual Account ditampilkan sebagai teks dengan tombol salin, tanpa mengalihkan pengguna ke jendela pihak ketiga.
- **Kerahasiaan Kunci :** *Server Key* Midtrans dan token Fonnte hanya berada pada variabel lingkungan *serverless function* dan tidak pernah dikirim ke peramban.
- **Kualitas Interaksi Prototype :** Antarmuka prototype harus mampu memperagakan alur transaksi, pengisian form, dan navigasi dashboard secara mulus dan responsif.
- **Ketersediaan Akses Demo :** Prototype web dapat diakses dengan mudah oleh pemangku kepentingan untuk keperluan pengujian dan evaluasi.

# 10. Integrasi Pihak Ketiga

| **Layanan** | **Vendor** | **Fungsi** | **Mode** |
| --- | --- | --- | --- |
| **Payment Gateway** | Midtrans (Core API) | Memproses transaksi pembayaran sewa secara digital dan memperbarui status transaksi. Instrumen pembayaran ditampilkan di dalam halaman sistem. | Sandbox |
| **WhatsApp Gateway** | Fonnte | Mengirim notifikasi pengingat jatuh tempo sewa dan tagihan pembayaran ke WhatsApp penyewa. | Akun uji |
| **Basis Data** | Cloud Firestore (Firebase) | Menyimpan seluruh entitas sistem secara terpusat. | Proyek uji |

# 11. Fitur Usulan / Fase Lanjutan

- **Aktivasi Mode Produksi.** Peralihan Midtrans dari Sandbox ke Production beserta penetapan skema biaya komisi per transaksi.
- **Import Data Historis (Migrasi Excel).** Pembuatan modul atau skrip khusus untuk mengunggah dan mengonversi berkas Excel transaksi lama ke dalam sistem.

# 12. Pertanyaan Terbuka / TBD

| **Pertanyaan** | **Status** |
| --- | --- |
| Pemilihan vendor *Payment Gateway* | **Selesai** — Midtrans Core API, mode Sandbox untuk prototipe |
| Pemilihan vendor WhatsApp Gateway | **Selesai** — Fonnte untuk prototipe |
| Jadwal evaluasi dan persetujuan antarmuka prototype oleh pemilik kos | Terbuka |

# 13. Glosarium

- **Prototype :** Model atau purwarupa awal dari aplikasi yang dikembangkan untuk menguji konsep, antarmuka, dan alur kerja sebelum pengembangan sistem secara penuh.
- **Overstay :** Kondisi ketika penyewa tetap menempati unit kamar melewati batas tanggal berakhirnya masa sewa tanpa melakukan perpanjangan.
- **Payment Gateway :** Layanan perantara pembayaran digital yang memverifikasi dan memproses transaksi secara otomatis.
- **WhatsApp Gateway :** Layanan pihak ketiga yang memungkinkan pengiriman pesan WhatsApp secara otomatis melalui pemanggilan API.
- **Cloud Firestore :** Basis data NoSQL berorientasi dokumen dari Firebase, menyimpan data dalam bentuk koleksi dan dokumen.
- **Serverless Function :** Potongan kode sisi peladen yang dijalankan sesuai permintaan tanpa mengelola peladen secara langsung, digunakan untuk menyimpan kunci rahasia.
- **Seeder :** Skrip untuk mengisi basis data dengan data awal.
- **RBAC :** *Role-Based Access Control*, pembatasan hak akses berdasarkan peran pengguna.
- **CRUD / RUD :** Singkatan operasi pengelolaan data (*Create, Read, Update, Delete* / *Read, Update, Delete*).

# 14. Inventaris Halaman Sistem

Total **34 halaman**, terbagi atas tiga portal.

## 14.1 Portal Customer (15 halaman)

| Berkas | Fungsi | Kebutuhan Terkait |
| --- | --- | --- |
| `index.html` | Landing page + filter pencarian inline | §4.1, CUST-1 |
| `customer/catalogue.html` | Katalog kamar lengkap dengan filter | §4.1, CUST-1 |
| `customer/room-detail.html` | Rincian satu kamar + tombol pesan & konsultasi | CUST-1, CUST-2 |
| `customer/login-customer.html` | Masuk akun Customer | SYS-7 |
| `customer/register-customer.html` | Daftar akun Customer | SYS-7 |
| `customer/order/step-1.html` | Pilih jenis sewa & durasi | CUST-3, SYS-1, SYS-2 |
| `customer/order/step-2.html` | Isi identitas pemesan & penghuni | CUST-3 |
| `customer/order/step-3.html` | Konfirmasi & pernyataan KTP | CUST-3 |
| `customer/order/step-4.html` | Pilih metode bayar, tampilkan QRIS/VA, kuitansi | SYS-5 |
| `customer/extend/step-1.html` | Pilih pemesanan yang diperpanjang | CUST-4 |
| `customer/extend/step-2.html` | Tentukan durasi perpanjangan | CUST-4 |
| `customer/extend/step-3.html` | Pembayaran perpanjangan | CUST-4, SYS-5 |
| `customer/history-order.html` | Riwayat seluruh pesanan | CUST-5 |
| `customer/detail-pesanan.html` | Rincian satu pesanan & status tagihan | CUST-5 |
| `customer/profil-customer.html` | Lihat & ubah data akun | SADM-3 |

Catatan: Folder `customer/partials/` memuat komponen bersama: `top-nav.html`, `bottom-nav.html`, dan `footer.html`.

## 14.2 Portal Admin (8 halaman)

| Berkas | Fungsi | Kebutuhan Terkait |
| --- | --- | --- |
| `admin/login.html` | Masuk portal Admin | SYS-7 |
| `admin/dashboard-admin.html` | Monitoring hunian cabang | ADM-5 |
| `admin/bookings.html` | Daftar pemesanan pada cabang | ADM-3, ADM-4 |
| `admin/detail-booking.html` | Rincian pemesanan & cetak kuitansi | ADM-3, ADM-6 |
| `admin/check-ins.html` | Proses check-in & verifikasi KTP | ADM-2, ADM-3 |
| `admin/alokasi-kamar.html` | Alokasi nomor kamar | ADM-8 |
| `admin/branches.html` | Lihat cabang & daftar kamar | ADM-7 |
| `admin/top-nav.html` | Komponen navigasi bersama | — |

## 14.3 Portal Super Admin (11 halaman)

| Berkas | Fungsi | Kebutuhan Terkait |
| --- | --- | --- |
| `super-admin/login-super-admin.html` | Masuk portal Super Admin | SYS-7 |
| `super-admin/dashboard-super-admin.html` | Monitoring seluruh cabang | SADM-7 |
| `super-admin/bookings.html` | Daftar pemesanan seluruh cabang | SADM-5, SADM-6 |
| `super-admin/detail-booking.html` | Rincian pemesanan | SADM-5 |
| `super-admin/check-ins.html` | Pengawasan check-in | SADM-5 |
| `super-admin/alokasi-kamar.html` | Alokasi kamar lintas cabang | SADM-5 |
| `super-admin/branches.html` | CRUD cabang & kamar | SADM-2 |
| `super-admin/tenants.html` | Kelola data penghuni | SADM-4 |
| `super-admin/user-management.html` | CRUD akun Admin & Customer | SADM-1, SADM-3 |
| `super-admin/financials.html` | Laporan keuangan & cetak | SADM-8 |
| `super-admin/top-nav.html` | Komponen navigasi bersama | — |

---

# 15. Design & Technical Constraints
Bagian ini mengatur batasan teknis dan panduan desain yang harus dipatuhi tanpa mendikte pemilihan library secara spesifik.

1.  **High-Level Technology:**
    Sistem harus dibangun menggunakan teknologi modern yang mendukung pengembangan cepat (rapid development) dan kemudahan pemeliharaan (maintainability). Pengembang dibebaskan memilih tools yang tepat selama tidak terikat pada stack spesifik secara kaku, namun tetap memprioritaskan performa dan skalabilitas untuk penggunaan skala kecil hingga menengah.

2.  **Typography Rules:**
    Sistem antarmuka (UI) wajib menggunakan konfigurasi font variable sebagai berikut untuk menjaga konsistensi visual:
    -   **Sans:** `Geist Mono, ui-monospace, monospace`
    -   **Serif:** `serif`
    -   **Mono:** `JetBrains Mono, monospace`


*Dokumen ini merupakan revisi atas PRD v0.1 dan dapat berubah seiring pembahasan lebih lanjut dengan klien.*
