/**
 * =====================================================================
 * SCRIPT SEEDING DATA DUMMY - FIRESTORE
 * Proyek: Pilar Pandawa (Prototipe Skripsi)
 * =====================================================================
 *
 * FUNGSI : Mengisi Firestore dengan data contoh untuk keperluan demo.
 * SIFAT  : ALAT BANTU SEKALI PAKAI, bukan bagian dari sistem final.
 * PAKAI  : buka seed.html di browser, klik tombol "Mulai Seeding".
 *
 * MENGISI 4 COLLECTION:
 *   1. cabang              -> 4 dokumen  (induk / master data)
 *   2. kamar               -> 40-60 dokumen (mereferensikan cabang_id)
 *   3. transaksi_pemesanan -> 28 dokumen (mereferensikan cabang & kamar,
 *                             sewa bulanan ikut membawa penghuni tambahan)
 *   4. user                -> 2 dokumen  (akun admin & super admin)
 *
 * CATATAN PENTING TENTANG COLLECTION "user":
 * Seeding HANYA menulis dua dokumen berid "admin" dan "superadmin".
 * Akun penyewa hasil registrasi TIDAK ikut terhapus maupun tertimpa,
 * karena Document ID-nya memakai username masing-masing.
 *
 * ALUR BISNIS YANG DICERMINKAN:
 *   1. Penyewa memesan di level CABANG      -> kamar_id masih null
 *   2. Admin mengalokasikan kamar           -> kamar_id terisi, kamar.tersedia = false
 *   3. Penyewa check-in                     -> status_checkin = "checked_in"
 *   4. Penyewa check-out                    -> status_checkin = "checked_out",
 *                                              kamar.tersedia kembali true
 * =====================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

// Cara pengacakan kata sandi diambil dari berkas yang sama dengan yang
// dipakai halaman login, supaya akun hasil seeding pasti bisa dipakai
// masuk. Berkas itu tidak memuat Firebase, jadi aman diimpor di sini.
import { acakKataSandi } from "./js/sandi.js";

// =====================================================================
// KONFIGURASI FIREBASE
// Config client-side memang aman ditulis langsung. Keamanan data
// diatur lewat Firestore Security Rules.
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAa_XlaBdfnPLpRPdqhOlY0UEpcx5r1HZM",
  authDomain: "pandawa-prototype.firebaseapp.com",
  projectId: "pandawa-prototype",
  storageBucket: "pandawa-prototype.firebasestorage.app",
  messagingSenderId: "803504342634",
  appId: "1:803504342634:web:754173efc7d847a11eec13",
  measurementId: "G-1J5ZZFJNZD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Nama collection ditulis sekali agar tidak salah ketik
const COL_CABANG = "cabang";
const COL_KAMAR = "kamar";
const COL_TRANSAKSI = "transaksi_pemesanan";
const COL_USER = "user";

// =====================================================================
// BAGIAN 1 - KONFIGURASI 4 CABANG
// -----------------------------------------------------------------
// Field fasilitas, foto, dan harga diletakkan di CABANG (bukan di
// kamar) karena nilainya seragam untuk semua kamar dalam satu cabang.
// Dengan begitu dokumen kamar tetap ringkas.
//
// Ketentuan harga:
//   - Bulanan : berbeda tiap cabang, dalam rentang Rp 500.000-800.000
//   - Harian  : flat Rp 100.000 untuk SEMUA cabang
// =====================================================================
const HARGA_HARIAN_SEMUA_CABANG = 100000;

const DAFTAR_CABANG = [
  {
    id: "pesona-kos",
    kode: "PSN",
    nama_cabang: "Pesona Kos",
    alamat: "Jl. Melati No. 45, Jakarta Selatan",
    deskripsi: "Kos dengan desain minimalis dan pencahayaan alami yang baik. Lokasi strategis dekat pusat perkantoran Jakarta Selatan, cocok untuk pekerja maupun mahasiswa.",
    maps_url: "https://maps.google.com/?q=Jl.+Melati+No.+45+Jakarta+Selatan",
    fasilitas_umum: ["WiFi", "Parkir Kendaraan", "CCTV 24 Jam"],
    fasilitas_kamar: ["AC", "Kasur Springbed", "Meja Kerja", "Kamar Mandi Dalam"],
    harga_bulanan: 500000,
    jumlah_kamar: 12
  },
  {
    id: "gangnam-kos",
    kode: "GNM",
    nama_cabang: "Gangnam Kos",
    alamat: "Jl. Kemang Raya No. 12, Jakarta Selatan",
    deskripsi: "Kos bertingkat dengan kamar berukuran luas dan dapur bersama. Tersedia layanan laundry di dalam area kos, cocok untuk penghuni jangka panjang.",
    maps_url: "https://maps.google.com/?q=Jl.+Kemang+Raya+No.+12+Jakarta+Selatan",
    fasilitas_umum: ["WiFi", "CCTV 24 Jam", "Dapur Bersama", "Laundry"],
    fasilitas_kamar: ["AC", "Kasur Springbed", "Kamar Mandi Dalam", "TV", "Kulkas Mini"],
    harga_bulanan: 650000,
    jumlah_kamar: 15
  },
  {
    id: "pelangi-kos",
    kode: "PLG",
    nama_cabang: "Pelangi Kos",
    alamat: "Jl. Pelangi No. 8, Bandung",
    deskripsi: "Kos di kawasan sejuk Bandung dengan water heater di setiap kamar. Dilengkapi penjagaan malam dan area parkir yang luas.",
    maps_url: "https://maps.google.com/?q=Jl.+Pelangi+No.+8+Bandung",
    fasilitas_umum: ["WiFi", "Parkir Kendaraan", "Laundry", "Keamanan Malam"],
    fasilitas_kamar: ["AC", "Kasur Springbed", "Meja Kerja", "Kamar Mandi Dalam", "Water Heater"],
    harga_bulanan: 725000,
    jumlah_kamar: 10
  },
  {
    id: "seleb-kos",
    kode: "SLB",
    nama_cabang: "Seleb Kos",
    alamat: "Jl. Selebriti No. 3, Surabaya",
    deskripsi: "Kos dengan fasilitas kamar terlengkap dan interior modern. Lingkungan tenang di kawasan Surabaya, cocok untuk penghuni yang mengutamakan kenyamanan.",
    maps_url: "https://maps.google.com/?q=Jl.+Selebriti+No.+3+Surabaya",
    fasilitas_umum: ["WiFi", "CCTV 24 Jam", "Parkir Kendaraan"],
    fasilitas_kamar: ["AC", "Kasur Springbed", "Meja Kerja", "Kamar Mandi Dalam", "TV", "Water Heater", "Kulkas Mini"],
    harga_bulanan: 800000,
    jumlah_kamar: 13
  }
];

// =====================================================================
// BAGIAN 2 - DATA PENDUKUNG
// =====================================================================
const NAMA_PENYEWA = [
  "Budi Santoso", "Siti Aminah", "Rudi Hartono", "Maya Sari", "Hendra Gunawan",
  "Joko Susilo", "Rina Marlina", "Agus Salim", "Nadia Putri", "Ani Wijaya",
  "Dedi Kurniawan", "Fitri Handayani", "Wawan Setiawan", "Lestari Ningsih", "Bagus Prakoso",
  "Andi Pratama", "Dewi Anggraini", "Eko Nugroho", "Sri Wahyuni", "Bambang Riyadi",
  "Intan Permata", "Fajar Ramadhan", "Ratna Dewi", "Yusuf Maulana", "Citra Kirana",
  "Doni Firmansyah", "Melati Puspita", "Rizky Ananda", "Kartika Sari", "Iwan Setiawan",
  "Nurul Hidayah", "Teguh Prasetyo", "Ayu Lestari", "Hadi Purnomo", "Vina Oktaviani",
  "Arif Budiman", "Diah Safitri", "Gunawan Wibowo", "Rani Astuti", "Slamet Riyanto",
  "Yuni Rahmawati", "Bayu Segara", "Putri Maharani", "Adit Nugraha", "Wulan Sari",
  "Ferry Setiadi", "Tari Susanti", "Krisna Wijaya", "Lina Marlina", "Oki Saputra"
];

// Metode pembayaran memakai istilah yang sama dengan Midtrans
const PAYMENT_TYPE = ["qris", "bank_transfer", "gopay", "echannel", "credit_card"];

// Status transaksi juga memakai istilah Midtrans
const STATUS_GAGAL = ["deny", "expire", "cancel"];

// =====================================================================
// BAGIAN 3 - FUNGSI BANTU
// =====================================================================
function acakAngka(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function acakDari(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Mengacak urutan isi array (algoritma Fisher-Yates)
function acakUrutan(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const simpan = array[i];
    array[i] = array[j];
    array[j] = simpan;
  }
  return array;
}

// Membuat tanggal dengan pergeseran hari dari hari ini
function geserHari(jumlahHari, jam) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + jumlahHari);
  tanggal.setHours(jam !== undefined ? jam : acakAngka(8, 20), acakAngka(0, 59), 0, 0);
  return tanggal;
}

// Mengurangi tanggal sesuai durasi sewa (untuk menghitung tanggal check-in
// bila yang diketahui adalah tanggal check-out)
function mundurDurasi(tanggalAkhir, tipeSewa, durasi) {
  const hasil = new Date(tanggalAkhir);
  if (tipeSewa === "bulanan") {
    hasil.setMonth(hasil.getMonth() - durasi);
  } else {
    hasil.setDate(hasil.getDate() - durasi);
  }
  hasil.setHours(14, 0, 0, 0); // jam check-in standar
  return hasil;
}

/**
 * Tanggal literal (bukan acak). Dipakai transaksi skenario pengujian
 * jatuh tempo yang HARUS jatuh pada tanggal pasti (lihat BAGIAN 6),
 * supaya tidak bergantung pada aritmetika tanggal yang bisa meleset
 * pada kasus tepi seperti akhir bulan.
 *
 * @param {number} bulan - 1-12 (Januari=1), BUKAN 0-indeks seperti Date bawaan
 */
function tgl(tahun, bulan, hari, jam, menit) {
  return new Date(tahun, bulan - 1, hari, jam !== undefined ? jam : 14, menit || 0, 0, 0);
}

/**
 * Nomor kontak penyewa utama.
 *
 * Bentuknya dibuat sama persis dengan pesanan sungguhan, yaitu
 * "+62 " diikuti angka tanpa pemisah apa pun -- lihat js/customer-data.js
 * pada baris pembentuk "kontak_penyewa". Sebelumnya seeder memakai tanda
 * hubung ("+62 812-3456-7890"), sehingga data hasil seeding berbeda
 * bentuk dari data yang lahir dari form pemesanan.
 *
 * Angkanya memakai buatWaTanpaAwalan() yang sama dengan penghuni
 * tambahan, supaya hanya ada SATU sumber bentuk nomor di berkas ini.
 */
function buatKontakDummy() {
  return "+62 " + buatWaTanpaAwalan();
}

// NIK dummy 16 digit. Dibuat asal-asalan (bukan NIK asli siapa pun),
// hanya agar panjang dan bentuknya menyerupai NIK sungguhan.
function buatNikDummy() {
  let nik = String(acakAngka(11, 94)); // 2 digit kode provinsi
  for (let i = 0; i < 14; i++) {
    nik += String(acakAngka(0, 9));
  }
  return nik;
}

// =====================================================================
// BAGIAN 3B - PENGHUNI TAMBAHAN (KHUSUS SEWA BULANAN)
// ---------------------------------------------------------------------
// Satu unit sewa bulanan boleh dihuni lebih dari satu orang. Penyewa
// utama mengisikan anggota lainnya lewat form order step-1, dan hasilnya
// tersimpan pada field "penghuni_tambahan".
//
// Bentuk tiap anggota HARUS sama persis dengan yang dihasilkan
// bacaPenghuni() di js/order-step1.js:
//
//     { nik: "...", nama: "...", hubungan: "...", whatsapp: "..." }
//
// Dua hal yang ditiru dari form aslinya:
//   1. "hubungan" hanya boleh "suami" | "istri" | "anak" (huruf kecil),
//      persis nilai <option> pada form.
//   2. "whatsapp" disimpan TANPA awalan +62, karena pada form angka
//      "+62" hanyalah hiasan di sebelah kiri kotak isian. Ini berbeda
//      dengan "kontak_penyewa" milik penyewa utama yang memang memakai
//      awalan "+62 ". Selain awalan itu, deret angkanya sama -- keduanya
//      dibuat buatWaTanpaAwalan(), tanpa tanda hubung.
//
// Sewa harian tidak pernah punya penghuni tambahan, tetapi tetap diberi
// array kosong agar bentuk datanya seragam untuk kedua tipe sewa.
// =====================================================================

// Maksimal penghuni tambahan, mengikuti MAKS_PENGHUNI_TAMBAHAN
// pada js/order-step1.js
const MAKS_PENGHUNI_TAMBAHAN = 3;

const NAMA_PASANGAN = [
  "Ratih Kusuma", "Bagas Nugraha", "Wulan Sari", "Adi Nugroho",
  "Yuni Rahmawati", "Panji Saputra", "Mega Utami", "Rizal Fauzi"
];

const NAMA_ANAK = [
  "Aditya Pratama", "Nabila Zahra", "Farel Ardiansyah", "Kayla Aurellia",
  "Bintang Mahesa", "Alika Syifa", "Danish Alfarizi", "Naura Khalisa"
];

// Nomor WhatsApp tanpa awalan +62, sama seperti isian pada form
function buatWaTanpaAwalan() {
  return String(acakAngka(811, 859)) + String(acakAngka(10000000, 99999999));
}

/**
 * Membuat daftar penghuni tambahan yang masuk akal sebagai satu keluarga.
 *
 * Susunannya sengaja tidak diacak sepenuhnya: yang pertama selalu
 * pasangan (suami/istri), sisanya anak. Kalau hubungan diacak bebas,
 * bisa muncul data ganjil seperti dua "istri" dalam satu unit.
 *
 * Sebaran jumlahnya dibuat menyerupai keadaan nyata -- sebagian besar
 * penyewa tinggal sendiri, dan makin banyak anggota makin jarang.
 */
function buatPenghuniTambahan(tipeSewa) {
  if (tipeSewa !== "bulanan") return [];

  // 40% sendiri, 30% berdua, 20% bertiga, 10% berempat
  const undian = Math.random();
  let jumlah = 0;
  if (undian >= 0.4 && undian < 0.7) jumlah = 1;
  else if (undian >= 0.7 && undian < 0.9) jumlah = 2;
  else if (undian >= 0.9) jumlah = 3;

  if (jumlah === 0) return [];

  jumlah = Math.min(jumlah, MAKS_PENGHUNI_TAMBAHAN);

  const hasil = [];
  const anakTerpakai = [];

  for (let i = 0; i < jumlah; i++) {
    if (i === 0) {
      // Anggota pertama selalu pasangan penyewa utama
      hasil.push({
        nik: buatNikDummy(),
        nama: acakDari(NAMA_PASANGAN),
        hubungan: Math.random() < 0.5 ? "istri" : "suami",
        whatsapp: buatWaTanpaAwalan()
      });
      continue;
    }

    // Sisanya anak, dan namanya tidak boleh terulang dalam satu keluarga
    let nama = acakDari(NAMA_ANAK);
    let percobaan = 0;
    while (anakTerpakai.indexOf(nama) !== -1 && percobaan < 10) {
      nama = acakDari(NAMA_ANAK);
      percobaan++;
    }
    anakTerpakai.push(nama);

    hasil.push({
      nik: buatNikDummy(),
      nama: nama,
      hubungan: "anak",
      whatsapp: buatWaTanpaAwalan()
    });
  }

  return hasil;
}

// Menghitung nominal transaksi: harga cabang x lama sewa (tanpa biaya layanan)
function hitungNominal(cabang, tipeSewa, durasi) {
  const hargaSatuan = tipeSewa === "bulanan" ? cabang.harga_bulanan : HARGA_HARIAN_SEMUA_CABANG;
  return hargaSatuan * durasi;
}

// =====================================================================
// BAGIAN 3C - FOTO KOS
// ---------------------------------------------------------------------
// Seluruh foto diambil dari folder img/kos, bukan lagi dari layanan
// gambar acak di internet.
//
//   FOTO_UTAMA_CABANG -> tampak depan tiap cabang, dipasangkan tetap
//                        berdasarkan id cabangnya
//   FOTO_GALERI       -> kolam foto bagian dalam kos. Tiap cabang
//                        mengambil tiga di antaranya secara acak
//
// Alamatnya ROOT-RELATIVE (diawali "/"), bukan relatif biasa. Nilai
// yang sama ini dibaca dari tiga kedalaman folder yang berbeda:
//
//     index.html              -> akar proyek
//     customer/room-detail.html
//     customer/order/step-1.html
//
// Alamat seperti "img/kos/..." atau "../img/kos/..." pasti patah di
// salah satu di antaranya, sedangkan "/img/kos/..." selalu dihitung
// dari akar situs -- benar baik di server lokal maupun di Vercel.
//
// Berkasnya berformat .webp hasil pengecilan dari PNG aslinya (lebar
// 1600px). PNG aslinya tetap ada di folder yang sama tetapi tidak ikut
// di-commit; lihat .gitignore.
// =====================================================================

const FOTO_UTAMA_CABANG = {
  "gangnam-kos": "/img/kos/cabang-1.webp",
  "pelangi-kos": "/img/kos/cabang-2.webp",
  "seleb-kos": "/img/kos/cabang-3.webp",
  "pesona-kos": "/img/kos/cabang-4.webp"
};

// Sengaja TIDAK memuat berkas ber-nama "cabang-...", karena foto itu
// tampak depan bangunan dan sudah dipakai sebagai foto utama.
const FOTO_GALERI = [
  "/img/kos/dapur.webp",
  "/img/kos/kamar-mandi.webp",
  "/img/kos/kamar-tidur-1.webp",
  "/img/kos/kamar-tidur-2.webp",
  "/img/kos/meja-kerja.webp",
  "/img/kos/parkir.webp",
  "/img/kos/ruang-tamu.webp"
];

// Banyaknya foto galeri per cabang. Mengikuti jumlah slot yang tersedia
// di customer/room-detail.html (detailFoto1 sampai detailFoto3).
const JUMLAH_FOTO_GALERI = 3;

/**
 * Memilih beberapa foto galeri secara acak TANPA pengulangan, supaya
 * satu cabang tidak menampilkan foto yang sama dua kali.
 */
function pilihFotoGaleri() {
  return acakUrutan(FOTO_GALERI.slice()).slice(0, JUMLAH_FOTO_GALERI);
}

// =====================================================================
// BAGIAN 4 - MEMBUAT DATA COLLECTION "cabang"
// =====================================================================
function buatDataCabang() {
  return DAFTAR_CABANG.map(function (cabang) {
    return {
      _id: cabang.id, // dipakai sebagai Document ID, tidak ikut disimpan
      nama_cabang: cabang.nama_cabang,
      alamat: cabang.alamat,
      deskripsi: cabang.deskripsi,
      gambar_url: FOTO_UTAMA_CABANG[cabang.id],
      galeri_foto: pilihFotoGaleri(),
      maps_url: cabang.maps_url,
      fasilitas_umum: cabang.fasilitas_umum,
      fasilitas_kamar: cabang.fasilitas_kamar,
      harga_bulanan: cabang.harga_bulanan,
      harga_harian: HARGA_HARIAN_SEMUA_CABANG,
      biaya_layanan: 0
    };
  });
}

// =====================================================================
// BAGIAN 5 - MEMBUAT DATA COLLECTION "kamar"
// -----------------------------------------------------------------
// Total 12 + 15 + 10 + 13 = 50 kamar.
// Semua kamar awalnya tersedia = true. Nanti kamar yang sedang dihuni
// (transaksi checked_in) diubah menjadi false agar data konsisten.
//
// Catatan: kamar TIDAK menyimpan tipe_sewa, karena setiap kamar boleh
// disewa harian maupun bulanan. Tipe sewa hanya milik transaksi.
// =====================================================================
function buatDataKamar() {
  const daftarKamar = [];

  DAFTAR_CABANG.forEach(function (cabang) {
    for (let i = 1; i <= cabang.jumlah_kamar; i++) {
      const nomorKamar = String(100 + i); // 101, 102, 103, ...

      daftarKamar.push({
        _id: cabang.kode + "-" + nomorKamar, // contoh: PSN-101
        nomor_kamar: nomorKamar,
        cabang_id: cabang.id,
        tersedia: true
      });
    }
  });

  return daftarKamar;
}

// =====================================================================
// BAGIAN 6 - MEMBUAT DATA COLLECTION "transaksi_pemesanan"
// -----------------------------------------------------------------
// Dataset ini TIDAK diacak seperti versi sebelumnya. Isinya sengaja
// dibuat sebagai skenario pasti untuk menguji perilaku jatuh tempo &
// notifikasi cron (api/cron.js), ditambah beberapa sampel status lain
// supaya tampilan admin/super admin tidak kosong.
//
// KOMPOSISI (28 transaksi total):
//
//   KELOMPOK A -- 5 sewa BULANAN yang sedang aktif, berakhir
//                 SERENTAK di akhir tahun (31 Des 2026).
//   KELOMPOK B -- 2 sewa bulanan + 3 sewa harian yang BELUM check-in,
//                 mulai aktif BULAN DEPAN (Oktober 2026). Sudah lunas,
//                 tetapi kamar sengaja belum dialokasikan (kamar_id
//                 null) -- meniru alur nyata: admin baru mengalokasikan
//                 kamar mendekati tanggal check-in.
//   KELOMPOK C -- 2 sewa bulanan + 2 sewa harian yang SEDANG aktif dan
//                 jatuh tempo (check-out) TEPAT 1 atau 2 Oktober 2026.
//   KELOMPOK D -- 3 sewa bulanan + 2 sewa harian yang SEDANG aktif dan
//                 jatuh tempo (check-out) TEPAT 8 atau 9 Oktober 2026.
//
//   SAMPEL      -- 3 pending, 3 gagal (deny/expire/cancel), dan
//                 3 riwayat sudah check-out, agar tab-tab lain pada
//                 halaman admin tetap punya isi untuk didemokan.
//
// Kelompok C dan D (9 transaksi) itulah yang dimaksud "akan jatuh
// tempo" -- BAGIAN 6A2 di bawah membuatkan log_notifikasi penahan
// untuk kesembilannya, supaya begitu tanggal pemicunya tiba, cron
// menganggap sudah pernah mengirim dan TIDAK benar-benar mengirim
// WhatsApp ke nomor dummy.
// =====================================================================

const JUMLAH_SAMPEL_PENDING = 3;
const JUMLAH_SAMPEL_GAGAL = 3;
const JUMLAH_SAMPEL_CHECKED_OUT = 3;

function buatDataTransaksi(daftarKamar) {
  const daftarTransaksi = [];
  // Menandai transaksi kelompok C & D, dipakai BAGIAN 6A2 untuk
  // membuat log_notifikasi penahannya.
  const daftarJatuhTempo = [];

  // Peta cabang agar mudah dicari berdasarkan id
  const petaCabang = {};
  DAFTAR_CABANG.forEach(function (c) { petaCabang[c.id] = c; });

  // Setiap kamar boleh disewa harian maupun bulanan, jadi cukup satu
  // kumpulan kamar yang diacak. Kamar diambil satu per satu (pop) agar
  // tidak ada kamar yang terpakai oleh dua transaksi sekaligus.
  const kamarTersisa = acakUrutan(daftarKamar.slice());

  let nomorUrut = 0;

  // Membuat kerangka dasar sebuah transaksi
  function buatTransaksi(opsi) {
    nomorUrut++;

    const waktuTransaksi = opsi.transaction_time;

    const dokumen = {
      // order_id memakai pola yang sama dengan api/create-transaction.js
      // ("PP-" + waktu), ditambah nomor urut agar dijamin unik
      _id: "PP-" + waktuTransaksi.getTime() + "-" + String(nomorUrut).padStart(2, "0"),

      order_id: "PP-" + waktuTransaksi.getTime() + "-" + String(nomorUrut).padStart(2, "0"),
      order_amount: opsi.order_amount,
      payment_type: acakDari(PAYMENT_TYPE),
      transaction_status: opsi.transaction_status,
      transaction_time: Timestamp.fromDate(waktuTransaksi),
      settlement_time: opsi.settlement_time ? Timestamp.fromDate(opsi.settlement_time) : null,

      cabang_id: opsi.cabang_id,
      kamar_id: opsi.kamar_id,
      tipe_sewa: opsi.tipe_sewa,

      nama_penyewa: NAMA_PENYEWA[(nomorUrut - 1) % NAMA_PENYEWA.length],
      nik_penyewa: buatNikDummy(),
      kontak_penyewa: buatKontakDummy(),

      tanggal_checkin: Timestamp.fromDate(opsi.tanggal_checkin),
      tanggal_checkout: Timestamp.fromDate(opsi.tanggal_checkout),

      status_checkin: opsi.status_checkin,
      tanggal_aktual_checkin: opsi.tanggal_aktual_checkin ? Timestamp.fromDate(opsi.tanggal_aktual_checkin) : null,
      tanggal_aktual_checkout: opsi.tanggal_aktual_checkout ? Timestamp.fromDate(opsi.tanggal_aktual_checkout) : null,

      // Anggota lain dalam satu unit sewa. Selalu ditulis -- berisi
      // array kosong untuk sewa harian -- supaya halaman Data Penghuni
      // tidak perlu membedakan "tidak punya anggota" dari "field-nya
      // memang belum pernah dibuat".
      penghuni_tambahan: buatPenghuniTambahan(opsi.tipe_sewa)
    };

    // -----------------------------------------------------------------
    // status_perpanjangan - KHUSUS SEWA BULANAN
    // -----------------------------------------------------------------
    // Menyimpan jawaban penyewa saat ditanya apakah akan lanjut sewa.
    // Memakai teks (bukan boolean) karena keadaannya ada TIGA, sedangkan
    // boolean hanya bisa membedakan dua:
    //
    //   "belum"        -> belum menjawab   -> masih perlu diingatkan
    //   "perpanjang"   -> lanjut sewa      -> tidak perlu diingatkan
    //   "tidak_lanjut" -> berhenti menyewa -> tidak perlu diingatkan
    //
    // Sewa harian tidak memakai field ini karena tidak ada perpanjangan.
    if (opsi.tipe_sewa === "bulanan") {
      dokumen.status_perpanjangan = "belum";
    }

    // Catatan: penanda "sudah dikirimi notifikasi" TIDAK disimpan di
    // sini. Riwayat pengiriman dicatat pada collection terpisah
    // "log_notifikasi" (lihat api/cron.js), sehingga dokumen transaksi
    // tetap berisi data transaksi saja.

    return dokumen;
  }

  // Menghitung tanggal check-out dari tanggal check-in (dipakai
  // kelompok B, yang tanggal pastinya cukup pada sisi check-in).
  function hitungCheckout(tanggalCheckin, tipeSewa, durasi) {
    const hasil = new Date(tanggalCheckin);
    if (tipeSewa === "bulanan") {
      hasil.setMonth(hasil.getMonth() + durasi);
    } else {
      hasil.setDate(hasil.getDate() + durasi);
    }
    hasil.setHours(12, 0, 0, 0); // jam check-out standar
    return hasil;
  }

  /**
   * Menurunkan waktu_transaksi, settlement_time, dan tanggal_aktual_checkin
   * dari sebuah tanggal check-in yang SUDAH TERJADI (kelompok A/C/D).
   * Polanya sama dengan yang dipakai versi seeding sebelumnya: transaksi
   * terjadi beberapa hari sebelum check-in, lunas tidak lama sesudahnya.
   */
  function turunanSudahCheckin(tanggalCheckin) {
    const waktuTransaksi = new Date(tanggalCheckin);
    waktuTransaksi.setDate(waktuTransaksi.getDate() - acakAngka(1, 10));
    waktuTransaksi.setHours(acakAngka(8, 20), acakAngka(0, 59), 0, 0);

    const waktuSettlement = new Date(waktuTransaksi.getTime() + acakAngka(2, 45) * 60000);

    const aktualCheckin = new Date(tanggalCheckin);
    aktualCheckin.setHours(acakAngka(13, 19), acakAngka(0, 59), 0, 0);

    return { waktuTransaksi: waktuTransaksi, waktuSettlement: waktuSettlement, aktualCheckin: aktualCheckin };
  }

  // Mengambil satu kamar acak lalu menandainya terisi (dipakai A/C/D)
  function ambilKamarTerisi() {
    const kamar = kamarTersisa.pop();
    kamar.tersedia = false;
    return kamar;
  }

  // -------------------------------------------------------------
  // KELOMPOK A -- 5 sewa bulanan aktif, berakhir bersama 31 Des 2026
  // -------------------------------------------------------------
  const checkoutAkhirTahun = tgl(2026, 12, 31, 12);
  const KELOMPOK_A = [
    { checkin: tgl(2026, 5, 1), durasi: 7 },
    { checkin: tgl(2026, 6, 1), durasi: 6 },
    { checkin: tgl(2026, 7, 1), durasi: 5 },
    { checkin: tgl(2026, 8, 1), durasi: 4 },
    { checkin: tgl(2026, 9, 1), durasi: 3 }
  ];

  KELOMPOK_A.forEach(function (item) {
    const kamar = ambilKamarTerisi();
    const cabang = petaCabang[kamar.cabang_id];
    const turunan = turunanSudahCheckin(item.checkin);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "settlement",
      transaction_time: turunan.waktuTransaksi,
      settlement_time: turunan.waktuSettlement,
      order_amount: hitungNominal(cabang, "bulanan", item.durasi),
      cabang_id: kamar.cabang_id,
      kamar_id: kamar._id,
      tipe_sewa: "bulanan",
      tanggal_checkin: item.checkin,
      tanggal_checkout: checkoutAkhirTahun,
      status_checkin: "checked_in",
      tanggal_aktual_checkin: turunan.aktualCheckin,
      tanggal_aktual_checkout: null
    }));
  });

  // -------------------------------------------------------------
  // KELOMPOK B -- 2 bulanan + 3 harian, mulai aktif BULAN DEPAN
  // (Oktober 2026). Sudah lunas, belum check-in, kamar BELUM
  // dialokasikan (menunggu tindakan admin mendekati tanggal mulai).
  // -------------------------------------------------------------
  const KELOMPOK_B = [
    { tipeSewa: "bulanan", checkin: tgl(2026, 10, 5), durasi: 2, cabangId: "pesona-kos" },
    { tipeSewa: "bulanan", checkin: tgl(2026, 10, 15), durasi: 3, cabangId: "gangnam-kos" },
    { tipeSewa: "harian", checkin: tgl(2026, 10, 3), durasi: 3, cabangId: "pelangi-kos" },
    { tipeSewa: "harian", checkin: tgl(2026, 10, 10), durasi: 2, cabangId: "seleb-kos" },
    { tipeSewa: "harian", checkin: tgl(2026, 10, 20), durasi: 4, cabangId: "pesona-kos" }
  ];

  KELOMPOK_B.forEach(function (item) {
    const cabang = petaCabang[item.cabangId];

    // Pesanan sudah dibuat & lunas beberapa hari sebelum hari ini,
    // jauh sebelum tanggal check-in-nya sendiri (yang masih di masa
    // depan bulan depan).
    const waktuTransaksi = geserHari(-acakAngka(1, 15));
    const waktuSettlement = new Date(waktuTransaksi.getTime() + acakAngka(2, 45) * 60000);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "settlement",
      transaction_time: waktuTransaksi,
      settlement_time: waktuSettlement,
      order_amount: hitungNominal(cabang, item.tipeSewa, item.durasi),
      cabang_id: item.cabangId,
      kamar_id: null, // belum dialokasikan -- baru aktif bulan depan
      tipe_sewa: item.tipeSewa,
      tanggal_checkin: item.checkin,
      tanggal_checkout: hitungCheckout(item.checkin, item.tipeSewa, item.durasi),
      status_checkin: "belum_checkin",
      tanggal_aktual_checkin: null,
      tanggal_aktual_checkout: null
    }));
  });

  // -------------------------------------------------------------
  // KELOMPOK C -- 2 bulanan + 2 harian, jatuh tempo 1 atau 2 Okt 2026
  // KELOMPOK D -- 3 bulanan + 2 harian, jatuh tempo 8 atau 9 Okt 2026
  // Keduanya SEDANG aktif (checked_in) per hari ini. Setiap anggotanya
  // ditandai sebagai "jatuh tempo" agar BAGIAN 6A2 membuatkan
  // log_notifikasi penahannya.
  // -------------------------------------------------------------
  const KELOMPOK_CD = [
    // --- Kelompok C: jatuh tempo 1-2 Oktober 2026 ---
    { tipeSewa: "bulanan", checkin: tgl(2026, 9, 1), checkout: tgl(2026, 10, 1, 12), durasi: 1 },
    { tipeSewa: "bulanan", checkin: tgl(2026, 8, 2), checkout: tgl(2026, 10, 2, 12), durasi: 2 },
    { tipeSewa: "harian", checkin: tgl(2026, 9, 24), checkout: tgl(2026, 10, 1, 12), durasi: 7 },
    { tipeSewa: "harian", checkin: tgl(2026, 9, 25), checkout: tgl(2026, 10, 2, 12), durasi: 7 },
    // --- Kelompok D: jatuh tempo 8-9 Oktober 2026 ---
    { tipeSewa: "bulanan", checkin: tgl(2026, 9, 8), checkout: tgl(2026, 10, 8, 12), durasi: 1 },
    { tipeSewa: "bulanan", checkin: tgl(2026, 7, 8), checkout: tgl(2026, 10, 8, 12), durasi: 3 },
    { tipeSewa: "bulanan", checkin: tgl(2026, 8, 9), checkout: tgl(2026, 10, 9, 12), durasi: 2 },
    { tipeSewa: "harian", checkin: tgl(2026, 9, 20), checkout: tgl(2026, 10, 8, 12), durasi: 18 },
    { tipeSewa: "harian", checkin: tgl(2026, 9, 21), checkout: tgl(2026, 10, 9, 12), durasi: 18 }
  ];

  KELOMPOK_CD.forEach(function (item) {
    const kamar = ambilKamarTerisi();
    const cabang = petaCabang[kamar.cabang_id];
    const turunan = turunanSudahCheckin(item.checkin);

    const transaksi = buatTransaksi({
      transaction_status: "settlement",
      transaction_time: turunan.waktuTransaksi,
      settlement_time: turunan.waktuSettlement,
      order_amount: hitungNominal(cabang, item.tipeSewa, item.durasi),
      cabang_id: kamar.cabang_id,
      kamar_id: kamar._id,
      tipe_sewa: item.tipeSewa,
      tanggal_checkin: item.checkin,
      tanggal_checkout: item.checkout,
      status_checkin: "checked_in",
      tanggal_aktual_checkin: turunan.aktualCheckin,
      tanggal_aktual_checkout: null
    });

    daftarTransaksi.push(transaksi);
    daftarJatuhTempo.push(transaksi);
  });

  // -------------------------------------------------------------
  // SAMPEL -- PENDING (baru memesan, belum dibayar)
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_SAMPEL_PENDING; i++) {
    const cabang = acakDari(DAFTAR_CABANG);
    const tipeSewa = i % 2 === 0 ? "bulanan" : "harian";
    const durasi = tipeSewa === "bulanan" ? acakAngka(1, 6) : acakAngka(1, 7);

    const waktuTransaksi = geserHari(-acakAngka(0, 10));
    const tanggalCheckin = geserHari(acakAngka(1, 30), 14);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "pending",
      transaction_time: waktuTransaksi,
      settlement_time: null,
      order_amount: hitungNominal(cabang, tipeSewa, durasi),
      cabang_id: cabang.id,
      kamar_id: null,
      tipe_sewa: tipeSewa,
      tanggal_checkin: tanggalCheckin,
      tanggal_checkout: hitungCheckout(tanggalCheckin, tipeSewa, durasi),
      status_checkin: "belum_checkin",
      tanggal_aktual_checkin: null,
      tanggal_aktual_checkout: null
    }));
  }

  // -------------------------------------------------------------
  // SAMPEL -- GAGAL (deny / expire / cancel)
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_SAMPEL_GAGAL; i++) {
    const cabang = acakDari(DAFTAR_CABANG);
    const tipeSewa = i % 2 === 0 ? "bulanan" : "harian";
    const durasi = tipeSewa === "bulanan" ? acakAngka(1, 6) : acakAngka(1, 7);

    const waktuTransaksi = geserHari(-acakAngka(5, 60));
    const tanggalCheckin = geserHari(-acakAngka(0, 40), 14);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: acakDari(STATUS_GAGAL),
      transaction_time: waktuTransaksi,
      settlement_time: null,
      order_amount: hitungNominal(cabang, tipeSewa, durasi),
      cabang_id: cabang.id,
      kamar_id: null,
      tipe_sewa: tipeSewa,
      tanggal_checkin: tanggalCheckin,
      tanggal_checkout: hitungCheckout(tanggalCheckin, tipeSewa, durasi),
      status_checkin: "belum_checkin",
      tanggal_aktual_checkin: null,
      tanggal_aktual_checkout: null
    }));
  }

  // -------------------------------------------------------------
  // SAMPEL -- SUDAH CHECK-OUT (riwayat penyewa yang selesai)
  // Kamar yang dipakai tetap tersedia = true.
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_SAMPEL_CHECKED_OUT; i++) {
    const kamar = kamarTersisa.pop();
    const cabang = petaCabang[kamar.cabang_id];

    const tipeSewa = i % 2 === 0 ? "harian" : "bulanan";
    const durasi = tipeSewa === "bulanan" ? acakAngka(1, 6) : acakAngka(1, 7);

    // Seluruh rangkaian tanggal berada di masa lalu
    const tanggalCheckout = geserHari(-acakAngka(5, 90), 12);
    const tanggalCheckin = mundurDurasi(tanggalCheckout, tipeSewa, durasi);

    const waktuTransaksi = new Date(tanggalCheckin);
    waktuTransaksi.setDate(waktuTransaksi.getDate() - acakAngka(1, 10));
    waktuTransaksi.setHours(acakAngka(8, 20), acakAngka(0, 59), 0, 0);

    const waktuSettlement = new Date(waktuTransaksi.getTime() + acakAngka(2, 45) * 60000);

    const aktualCheckin = new Date(tanggalCheckin);
    aktualCheckin.setHours(acakAngka(13, 19), acakAngka(0, 59), 0, 0);

    const aktualCheckout = new Date(tanggalCheckout);
    aktualCheckout.setHours(acakAngka(8, 12), acakAngka(0, 59), 0, 0);

    // Kamar sudah ditinggalkan -> kembali tersedia
    kamar.tersedia = true;

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "settlement",
      transaction_time: waktuTransaksi,
      settlement_time: waktuSettlement,
      order_amount: hitungNominal(cabang, tipeSewa, durasi),
      cabang_id: kamar.cabang_id,
      kamar_id: kamar._id,
      tipe_sewa: tipeSewa,
      tanggal_checkin: tanggalCheckin,
      tanggal_checkout: tanggalCheckout,
      status_checkin: "checked_out",
      tanggal_aktual_checkin: aktualCheckin,
      tanggal_aktual_checkout: aktualCheckout
    }));
  }

  return { transaksi: daftarTransaksi, jatuhTempo: daftarJatuhTempo };
}

// =====================================================================
// BAGIAN 6A2 - MEMBUAT DATA COLLECTION "log_notifikasi"
// ---------------------------------------------------------------------
// MENGAPA INI PERLU
//
// api/cron.js mencari penyewa yang perlu diingatkan lewat WhatsApp:
//
//   job bulanan -> sewa bulanan yang check-out TEPAT 7 hari lagi
//   job harian  -> sewa harian yang check-out HARI INI
//
// Kelompok C dan D pada BAGIAN 6 (9 transaksi, ditandai lewat
// daftarJatuhTempo) SENGAJA dibuat jatuh tempo pada tanggal pasti di
// awal Oktober 2026. Begitu tanggal itu tiba, cron akan menganggapnya
// kandidat dan benar-benar mengirim WhatsApp ke nomor dummy -- nomor
// yang boleh jadi milik orang lain yang tidak ada hubungannya dengan
// proyek ini.
//
// CARA MENCEGAHNYA
//
// Cron sudah punya pencegah kirim ganda: sebelum mengirim, ia memeriksa
// apakah dokumen ber-ID {order_id}_{jenis}_{tanggal} sudah ada di
// collection "log_notifikasi". Sudah ada -> dilewati.
//
// Beda dengan versi seeder sebelumnya (yang hanya menahan kandidat HARI
// INI), di sini "tanggal" pemicunya dihitung PER TRANSAKSI, karena
// jatuh temponya memang tersebar di beberapa tanggal berbeda:
//
//   bulanan -> tanggal pemicu = tanggal_checkout dikurangi 7 hari
//              (persis saat job bulanan akan menemukannya sebagai H-7)
//   harian  -> tanggal pemicu = tanggal_checkout itu sendiri
//
// Dua dari sembilan (kelompok C, bulanan, jatuh tempo 1-2 Oktober)
// pemicunya jatuh pada 24-25 September -- yaitu SEBELUM tanggal
// seeding ini dijalankan (26 September 2026). Log tetap dibuat untuk
// keduanya agar konsisten, meski secara praktis sudah tidak mungkin
// terpakai (cron tidak pernah "mundur" ke tanggal yang sudah lewat).
//
// Catatan kejujuran data: status dicatat "dilewati", BUKAN "berhasil".
// Tidak ada pesan yang pernah dikirim, jadi log ini tidak boleh mengaku
// sebagai bukti pengiriman. Field "sumber" menandainya sebagai data
// seeding agar mudah dibedakan dari log cron yang sungguhan.
// =====================================================================

const COL_LOG = "log_notifikasi";

// Harus sama dengan HARI_SEBELUM_JATUH_TEMPO pada api/cron.js
const HARI_SEBELUM_JATUH_TEMPO = 7;

// Judul disamakan untuk kedua jenis sewa -- perbedaan bulanan (H-7)
// vs harian (hari-H) sudah cukup terlihat dari isi "ringkasan" masing-masing.
const JUDUL_LOG = {
  bulanan: "Pengingat Masa Sewa",
  harian: "Pengingat Masa Sewa"
};

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/** "5 Agustus 2026" -- sama dengan formatTanggal() di api/_notifikasi-lib.js */
function tanggalPanjang(tanggal) {
  return tanggal.getDate() + " " + NAMA_BULAN[tanggal.getMonth()] + " " + tanggal.getFullYear();
}

/** "2026-08-05" -- sama dengan kunciTanggal() di api/cron.js */
function kunciTanggal(tanggal) {
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return tanggal.getFullYear() + "-" + bulan + "-" + hari;
}

/**
 * Document ID log. Polanya HARUS sama persis dengan idLog() di
 * api/cron.js -- kalau berbeda satu huruf pun, cron tidak akan
 * mengenalinya dan tetap mengirim pesan.
 */
function idLog(orderId, jenis, tanggal) {
  return orderId + "_" + jenis + "_" + kunciTanggal(tanggal);
}

/**
 * Tanggal saat cron akan menemukan transaksi ini sebagai kandidat
 * notifikasi -- lihat penjelasan di atas.
 */
function tanggalPemicu(transaksi) {
  const keluar = transaksi.tanggal_checkout.toDate();

  if (transaksi.tipe_sewa === "bulanan") {
    const pemicu = new Date(keluar);
    pemicu.setDate(pemicu.getDate() - HARI_SEBELUM_JATUH_TEMPO);
    return pemicu;
  }

  return keluar; // harian: pemicunya adalah hari check-out itu sendiri
}

/**
 * Membuat dokumen log penahan untuk setiap transaksi yang tergolong
 * "akan jatuh tempo" (kelompok C & D pada BAGIAN 6).
 *
 * Bentuk dokumennya mengikuti yang ditulis prosesSatu() di api/cron.js,
 * supaya panel notifikasi admin nanti bisa membacanya tanpa perlakuan
 * khusus.
 */
function buatDataLogNotifikasi(daftarJatuhTempo) {
  return daftarJatuhTempo.map(function (transaksi) {
    const pemicu = tanggalPemicu(transaksi);
    const keluar = transaksi.tanggal_checkout.toDate();

    return {
      _id: idLog(transaksi.order_id, transaksi.tipe_sewa, pemicu),

      order_id: transaksi.order_id,
      jenis: transaksi.tipe_sewa,
      judul: JUDUL_LOG[transaksi.tipe_sewa],
      ringkasan: "Sewa " + transaksi.nama_penyewa + " berakhir " + tanggalPanjang(keluar),

      nama_penyewa: transaksi.nama_penyewa,
      cabang_id: transaksi.cabang_id,
      kamar_id: transaksi.kamar_id || null,

      // Tidak ada nomor tujuan karena memang tidak ada yang dikirim
      kontak_tujuan: null,
      dialihkan: false,

      waktu_kirim: Timestamp.fromDate(pemicu),
      status: "dilewati",
      keterangan: "Data seeding: notifikasi ditahan lebih dulu untuk tanggal " +
                  tanggalPanjang(pemicu) + ", agar cron tidak mengirim WhatsApp " +
                  "ke nomor dummy saat tanggal itu tiba.",
      pesan: "(tidak ada pesan yang dikirim)",

      // Sudah dianggap terbaca supaya tidak menumpuk sebagai
      // pemberitahuan baru di panel admin
      dibaca: true,
      sumber: "seed"
    };
  });
}

// =====================================================================
// BAGIAN 6B - MEMBUAT DATA COLLECTION "user"
// ---------------------------------------------------------------------
// Hanya akun pengelola yang dibuat di sini. Akun penyewa TIDAK dibuat
// oleh seeder karena penyewa mendaftar sendiri lewat halaman registrasi.
//
// Kata sandi diacak memakai fungsi yang sama dengan halaman login
// (js/sandi.js), jadi yang tersimpan di Firestore adalah hasil hash,
// bukan "12345678" apa adanya.
// =====================================================================

// Kata sandi awal kedua akun pengelola. Sengaja ditulis di sini karena
// berkas ini memang alat bantu yang tidak ikut di-deploy.
const SANDI_AWAL_PENGELOLA = "12345678";

async function buatDataUser() {
  // Admin ditugaskan ke SELURUH cabang karena untuk saat ini hanya ada
  // satu admin. Bentuknya tetap array supaya penambahan admin kedua
  // nanti tidak perlu mengubah struktur data.
  const semuaCabang = DAFTAR_CABANG.map(function (cabang) { return cabang.id; });

  // Hash dihitung terpisah agar kedua akun punya garam yang berbeda,
  // walaupun kata sandinya kebetulan sama.
  const sandiSuperAdmin = await acakKataSandi(SANDI_AWAL_PENGELOLA);
  const sandiAdmin = await acakKataSandi(SANDI_AWAL_PENGELOLA);

  const sekarang = Timestamp.fromDate(new Date());

  return [
    {
      _id: "superadmin",
      fullName: "Super Admin Pilar Pandawa",
      username: "superadmin",
      password: sandiSuperAdmin,
      createdAt: sekarang,
      role: "superadmin"
      // Super admin TIDAK punya field cabang: wewenangnya mencakup
      // seluruh cabang, jadi tidak perlu didaftar satu per satu.
    },
    {
      _id: "admin",
      fullName: "Admin Pilar Pandawa",
      username: "admin",
      password: sandiAdmin,
      createdAt: sekarang,
      role: "admin",
      cabang: semuaCabang
    }
  ];
}

// =====================================================================
// BAGIAN 7 - PROSES PENULISAN KE FIRESTORE
// =====================================================================

async function hitungDokumen(namaCollection) {
  const hasil = await getDocs(collection(db, namaCollection));
  return hasil.size;
}

// Menulis sekumpulan data ke satu collection memakai writeBatch.
// Field "_id" dipakai sebagai Document ID dan tidak ikut tersimpan.
async function tulisCollection(namaCollection, daftarData) {
  const batch = writeBatch(db);

  daftarData.forEach(function (data) {
    const salinan = Object.assign({}, data);
    const idDokumen = salinan._id;
    delete salinan._id;

    batch.set(doc(db, namaCollection, idDokumen), salinan);
  });

  await batch.commit();
}

/**
 * Menjalankan seeding.
 * @param {Function} tulisLog - menampilkan pesan ke halaman seed.html
 * @param {boolean} paksa - true = tetap isi walau data sudah ada
 */
export async function jalankanSeeding(tulisLog, paksa) {
  tulisLog("Menghubungi Firestore...");

  // --- Langkah 1: cek agar data tidak terisi dua kali ---
  const jumlahCabangLama = await hitungDokumen(COL_CABANG);
  const jumlahKamarLama = await hitungDokumen(COL_KAMAR);
  const jumlahTransaksiLama = await hitungDokumen(COL_TRANSAKSI);
  const jumlahUserLama = await hitungDokumen(COL_USER);

  tulisLog("Data saat ini -> cabang: " + jumlahCabangLama +
           ", kamar: " + jumlahKamarLama +
           ", transaksi_pemesanan: " + jumlahTransaksiLama +
           ", user: " + jumlahUserLama);

  // Collection "user" sengaja TIDAK ikut menentukan pembatalan di bawah.
  // Isinya berisi akun penyewa yang mendaftar sendiri, sehingga
  // keberadaannya bukan tanda bahwa seeding sudah pernah dijalankan.
  const sudahAdaIsi = jumlahCabangLama > 0 || jumlahKamarLama > 0 || jumlahTransaksiLama > 0;

  if (sudahAdaIsi && !paksa) {
    tulisLog("");
    tulisLog("DIBATALKAN: database sudah berisi data.");
    tulisLog("Seeding dihentikan agar data tidak menjadi ganda.");
    tulisLog("Bila memang ingin menambah lagi, centang kotak konfirmasi lalu ulangi.");
    return { berhasil: false, alasan: "sudah-ada" };
  }

  // --- Langkah 2: siapkan data ---
  tulisLog("");
  tulisLog("Menyiapkan data dummy...");

  const dataCabang = buatDataCabang();
  const dataKamar = buatDataKamar();
  // Catatan: buatDataTransaksi() juga MENGUBAH field "tersedia" pada
  // dataKamar agar konsisten dengan transaksi yang dibuat.
  const hasilTransaksi = buatDataTransaksi(dataKamar);
  const dataTransaksi = hasilTransaksi.transaksi;
  const dataUser = await buatDataUser();

  // Penahan agar cron tidak mengirim WhatsApp ke nomor dummy.
  // Harus dibuat SETELAH dataTransaksi, karena isinya diturunkan
  // dari transaksi kelompok C & D (lihat BAGIAN 6A2).
  const dataLog = buatDataLogNotifikasi(hasilTransaksi.jatuhTempo);

  const kamarTerisi = dataKamar.filter(function (k) { return !k.tersedia; }).length;

  tulisLog("  - " + dataCabang.length + " cabang");
  tulisLog("  - " + dataKamar.length + " kamar (" +
           (dataKamar.length - kamarTerisi) + " tersedia, " + kamarTerisi + " terisi)");
  tulisLog("  - " + dataTransaksi.length + " transaksi");

  // Ringkasan penghuni tambahan, supaya mudah dipastikan datanya benar
  // terbentuk tanpa harus membuka Firebase Console satu per satu.
  const denganAnggota = dataTransaksi.filter(function (t) {
    return t.penghuni_tambahan.length > 0;
  });
  const totalAnggota = denganAnggota.reduce(function (jumlah, t) {
    return jumlah + t.penghuni_tambahan.length;
  }, 0);

  tulisLog("      " + denganAnggota.length + " di antaranya punya penghuni tambahan (" +
           totalAnggota + " orang)");
  tulisLog("  - " + dataUser.length + " akun pengelola");
  tulisLog("  - " + dataLog.length + " log notifikasi penahan (agar cron tidak mengirim)");

  // --- Langkah 3: tulis ketiga collection ---
  tulisLog("");
  tulisLog("Menulis collection 'cabang'...");
  await tulisCollection(COL_CABANG, dataCabang);
  tulisLog("  Selesai: " + dataCabang.length + " dokumen.");

  tulisLog("");
  tulisLog("Menulis collection 'kamar'...");
  await tulisCollection(COL_KAMAR, dataKamar);
  tulisLog("  Selesai: " + dataKamar.length + " dokumen.");

  tulisLog("");
  tulisLog("Menulis collection 'transaksi_pemesanan'...");
  await tulisCollection(COL_TRANSAKSI, dataTransaksi);
  tulisLog("  Selesai: " + dataTransaksi.length + " dokumen.");

  tulisLog("");
  tulisLog("Menulis collection 'user'...");
  await tulisCollection(COL_USER, dataUser);
  tulisLog("  Selesai: " + dataUser.length + " dokumen (hanya akun pengelola).");
  tulisLog("  Akun penyewa yang sudah terdaftar tidak tersentuh.");

  tulisLog("");
  tulisLog("Menulis collection 'log_notifikasi'...");

  if (dataLog.length === 0) {
    tulisLog("  Tidak ada transaksi yang akan jatuh tempo perlu ditahan.");
  } else {
    await tulisCollection(COL_LOG, dataLog);
    tulisLog("  Selesai: " + dataLog.length + " dokumen penahan.");
    dataLog.forEach(function (l) {
      tulisLog("    - " + l.order_id + " (" + l.jenis + ") -> " + l.nama_penyewa +
               "  [pemicu " + new Date(l.waktu_kirim.toDate()).toLocaleDateString("id-ID") + "]");
    });
    tulisLog("  Cron akan menganggap penyewa-penyewa ini sudah dikirimi pada");
    tulisLog("  tanggal pemicunya masing-masing, sehingga tidak ada WhatsApp");
    tulisLog("  yang benar-benar terkirim ke nomor dummy.");
  }

  // --- Langkah 4: ringkasan untuk pemeriksaan ---
  const ringkasanStatus = {};
  const ringkasanCheckin = {};
  dataTransaksi.forEach(function (t) {
    ringkasanStatus[t.transaction_status] = (ringkasanStatus[t.transaction_status] || 0) + 1;
    ringkasanCheckin[t.status_checkin] = (ringkasanCheckin[t.status_checkin] || 0) + 1;
  });

  // Menghitung transaksi yang mendekati jatuh tempo (H-1 sampai H-14,
  // supaya kelompok C & D di awal Oktober ikut tercantum)
  const sekarang = new Date();
  const batasHari = new Date();
  batasHari.setDate(batasHari.getDate() + 14);

  const jatuhTempo = dataTransaksi.filter(function (t) {
    const checkout = t.tanggal_checkout.toDate();
    return t.status_checkin === "checked_in" && checkout >= sekarang && checkout <= batasHari;
  });

  tulisLog("");
  tulisLog("=====================================");
  tulisLog("SEEDING BERHASIL");
  tulisLog("=====================================");
  tulisLog("Status transaksi (istilah Midtrans):");
  Object.keys(ringkasanStatus).sort().forEach(function (s) {
    tulisLog("  - " + s + ": " + ringkasanStatus[s]);
  });
  tulisLog("");
  tulisLog("Status check-in:");
  Object.keys(ringkasanCheckin).sort().forEach(function (s) {
    tulisLog("  - " + s + ": " + ringkasanCheckin[s]);
  });
  tulisLog("");
  tulisLog("Mendekati jatuh tempo (checkout <= 14 hari lagi): " + jatuhTempo.length + " transaksi");
  jatuhTempo
    .sort(function (a, b) { return a.tanggal_checkout.toDate() - b.tanggal_checkout.toDate(); })
    .forEach(function (t) {
      const checkout = t.tanggal_checkout.toDate();
      const sisaHari = Math.ceil((checkout - sekarang) / (1000 * 60 * 60 * 24));
      tulisLog("  - " + t.nama_penyewa + " | kamar " + t.kamar_id +
               " | checkout " + checkout.toLocaleDateString("id-ID") +
               " (" + sisaHari + " hari lagi)");
    });

  tulisLog("");
  tulisLog("Akun pengelola yang dibuat:");
  dataUser.forEach(function (u) {
    const cabang = Array.isArray(u.cabang) ? u.cabang.length + " cabang" : "seluruh cabang";
    tulisLog("  - " + u.username + " / " + SANDI_AWAL_PENGELOLA +
             "  (" + u.role + ", " + cabang + ")");
  });
  tulisLog("  Kata sandi tersimpan dalam bentuk hash, bukan teks asli.");
  tulisLog("  Segera ganti kata sandinya sebelum dipakai di luar pengujian.");

  tulisLog("");
  tulisLog("Silakan periksa di Firebase Console > Firestore Database.");

  return {
    berhasil: true,
    jumlahCabang: dataCabang.length,
    jumlahKamar: dataKamar.length,
    jumlahTransaksi: dataTransaksi.length,
    jumlahUser: dataUser.length,
    jumlahLog: dataLog.length
  };
}
