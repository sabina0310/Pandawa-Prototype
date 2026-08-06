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
 *   3. transaksi_pemesanan -> 50 dokumen (mereferensikan cabang & kamar,
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

function buatKontakDummy() {
  return "+62 " + acakAngka(811, 859) + "-" + acakAngka(1000, 9999) + "-" + acakAngka(1000, 9999);
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
//      awalan "+62 ".
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
// BAGIAN 4 - MEMBUAT DATA COLLECTION "cabang"
// =====================================================================
function buatDataCabang() {
  return DAFTAR_CABANG.map(function (cabang) {
    return {
      _id: cabang.id, // dipakai sebagai Document ID, tidak ikut disimpan
      nama_cabang: cabang.nama_cabang,
      alamat: cabang.alamat,
      deskripsi: cabang.deskripsi,
      gambar_url: "https://picsum.photos/seed/" + cabang.id + "/800/600",
      galeri_foto: [
        "https://picsum.photos/seed/" + cabang.id + "-1/600/450",
        "https://picsum.photos/seed/" + cabang.id + "-2/600/450",
        "https://picsum.photos/seed/" + cabang.id + "-3/600/450"
      ],
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
// Komposisi 50 transaksi (sesuai ketentuan a-f):
//   (a)  8 pending, belum dialokasikan
//   (b)  8 settlement, belum dialokasikan  -> perlu tindakan admin
//   (c) 15 settlement bulanan, sudah check-in -> 6 di antaranya jatuh tempo dekat
//   (g)  2 settlement harian, sudah check-in, CHECK-OUT HARI INI
//   (e)  8 sudah check-out                 -> riwayat
//   (f)  9 gagal (deny/expire/cancel)
// =====================================================================
const JUMLAH_PENDING = 8;
const JUMLAH_BELUM_ALOKASI = 8;
const JUMLAH_CHECKED_IN = 15;
const JUMLAH_JATUH_TEMPO = 6; // bagian dari JUMLAH_CHECKED_IN
const JUMLAH_CHECKED_OUT = 8;
const JUMLAH_GAGAL = 9;

// ---------------------------------------------------------------------
// DATA TERJAMIN UNTUK PENGUJIAN NOTIFIKASI (api/cron.js)
// ---------------------------------------------------------------------
// Tanpa ini, kedua job notifikasi bisa saja menemukan nol kandidat
// karena tanggalnya diacak. Angka di bawah menjamin selalu ada bahan
// uji begitu seeding selesai:
//
//   JUMLAH_TEPAT_H7  -> sewa bulanan yang check-out TEPAT 7 hari lagi
//                       (bahan uji job bulanan)
//   JUMLAH_HARIAN_HARI_INI -> sewa harian yang check-out HARI INI
//                       (bahan uji job harian)
//
// Keduanya berstatus checked_in, karena notifikasi hanya masuk akal
// untuk penyewa yang memang sedang menempati kamar.
const JUMLAH_TEPAT_H7 = 2;          // bagian dari JUMLAH_JATUH_TEMPO
const JUMLAH_HARIAN_HARI_INI = 2;   // blok tersendiri

function buatDataTransaksi(daftarKamar) {
  const daftarTransaksi = [];

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

  // Menentukan lama sewa sesuai tipe
  function acakDurasi(tipeSewa) {
    return tipeSewa === "bulanan" ? acakAngka(1, 6) : acakAngka(1, 7);
  }

  // Menghitung tanggal check-out dari tanggal check-in
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

  // -------------------------------------------------------------
  // (a) PENDING - baru memesan, belum dibayar, belum dialokasikan
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_PENDING; i++) {
    const cabang = acakDari(DAFTAR_CABANG);
    const tipeSewa = Math.random() < 0.6 ? "bulanan" : "harian";
    const durasi = acakDurasi(tipeSewa);

    const waktuTransaksi = geserHari(-acakAngka(0, 14));
    const tanggalCheckin = geserHari(acakAngka(1, 30), 14);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "pending",
      transaction_time: waktuTransaksi,
      settlement_time: null,
      order_amount: hitungNominal(cabang, tipeSewa, durasi),
      cabang_id: cabang.id,
      kamar_id: null,                  // belum dialokasikan
      tipe_sewa: tipeSewa,
      tanggal_checkin: tanggalCheckin,
      tanggal_checkout: hitungCheckout(tanggalCheckin, tipeSewa, durasi),
      status_checkin: "belum_checkin",
      tanggal_aktual_checkin: null,
      tanggal_aktual_checkout: null
    }));
  }

  // -------------------------------------------------------------
  // (b) SETTLEMENT tapi BELUM DIALOKASIKAN - menunggu tindakan admin
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_BELUM_ALOKASI; i++) {
    const cabang = acakDari(DAFTAR_CABANG);
    const tipeSewa = Math.random() < 0.6 ? "bulanan" : "harian";
    const durasi = acakDurasi(tipeSewa);

    const waktuTransaksi = geserHari(-acakAngka(1, 20));
    const waktuSettlement = new Date(waktuTransaksi.getTime() + acakAngka(2, 45) * 60000);
    const tanggalCheckin = geserHari(acakAngka(0, 21), 14);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "settlement",
      transaction_time: waktuTransaksi,
      settlement_time: waktuSettlement,
      order_amount: hitungNominal(cabang, tipeSewa, durasi),
      cabang_id: cabang.id,
      kamar_id: null,                  // sudah bayar, kamar belum ditentukan
      tipe_sewa: tipeSewa,
      tanggal_checkin: tanggalCheckin,
      tanggal_checkout: hitungCheckout(tanggalCheckin, tipeSewa, durasi),
      status_checkin: "belum_checkin",
      tanggal_aktual_checkin: null,
      tanggal_aktual_checkout: null
    }));
  }

  // -------------------------------------------------------------
  // (c) & (d) SEDANG MENGHUNI (checked_in)
  //     6 di antaranya sengaja dibuat mendekati jatuh tempo (H-1..H-7)
  //     Kamar yang dipakai di sini diubah menjadi tersedia = false
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_CHECKED_IN; i++) {
    const kamar = kamarTersisa.pop();
    const cabang = petaCabang[kamar.cabang_id];

    // Penghuni aktif sengaja dibuat sewa BULANAN. Alasannya: sewa harian
    // paling lama 7 hari, sehingga penghuninya pasti selalu terhitung
    // "mendekati jatuh tempo" dan jumlahnya jadi tidak terkendali.
    const tipeSewa = "bulanan";
    const durasi = acakDurasi(tipeSewa); // 1-6 bulan

    // Sisa hari menuju check-out.
    // 6 transaksi pertama -> 1 sampai 7 hari lagi (mendekati jatuh tempo).
    // Sisanya -> lebih lama, tapi tidak boleh melebihi masa sewanya sendiri
    // supaya tanggal check-in tetap jatuh di masa lalu.
    // Beberapa transaksi pertama sengaja dibuat TEPAT 7 hari lagi agar
    // job notifikasi bulanan selalu punya kandidat saat diuji.
    const batasAman = Math.min(60, durasi * 28 - 2);
    let hariMenujuCheckout;

    if (i < JUMLAH_TEPAT_H7) {
      hariMenujuCheckout = 7;
    } else if (i < JUMLAH_JATUH_TEMPO) {
      hariMenujuCheckout = acakAngka(1, 7);
    } else {
      hariMenujuCheckout = acakAngka(8, batasAman);
    }

    const tanggalCheckout = geserHari(hariMenujuCheckout, 12);
    const tanggalCheckin = mundurDurasi(tanggalCheckout, tipeSewa, durasi);

    // Transaksi terjadi beberapa hari sebelum check-in
    const waktuTransaksi = new Date(tanggalCheckin);
    waktuTransaksi.setDate(waktuTransaksi.getDate() - acakAngka(1, 10));
    waktuTransaksi.setHours(acakAngka(8, 20), acakAngka(0, 59), 0, 0);

    const waktuSettlement = new Date(waktuTransaksi.getTime() + acakAngka(2, 45) * 60000);

    // Check-in sebenarnya terjadi pada hari yang sama, jam bisa berbeda
    const aktualCheckin = new Date(tanggalCheckin);
    aktualCheckin.setHours(acakAngka(13, 19), acakAngka(0, 59), 0, 0);

    // Kamar sedang dihuni -> tidak tersedia
    kamar.tersedia = false;

    daftarTransaksi.push(buatTransaksi({
      transaction_status: "settlement",
      transaction_time: waktuTransaksi,
      settlement_time: waktuSettlement,
      order_amount: hitungNominal(cabang, tipeSewa, durasi),
      cabang_id: kamar.cabang_id,
      kamar_id: kamar._id,             // sudah dialokasikan admin
      tipe_sewa: tipeSewa,
      tanggal_checkin: tanggalCheckin,
      tanggal_checkout: tanggalCheckout,
      status_checkin: "checked_in",
      tanggal_aktual_checkin: aktualCheckin,
      tanggal_aktual_checkout: null
    }));
  }

  // -------------------------------------------------------------
  // (g) SEWA HARIAN YANG CHECK-OUT HARI INI
  //     Bahan uji untuk job notifikasi harian pada api/cron.js.
  //     Penyewa sedang menempati kamar dan harus keluar hari ini.
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_HARIAN_HARI_INI; i++) {
    const kamar = kamarTersisa.pop();
    const cabang = petaCabang[kamar.cabang_id];

    const tipeSewa = "harian";
    const durasi = acakAngka(1, 5); // menginap 1-5 malam

    // Check-out hari ini pukul 12 siang, check-in beberapa hari lalu
    const tanggalCheckout = geserHari(0, 12);
    const tanggalCheckin = mundurDurasi(tanggalCheckout, tipeSewa, durasi);

    const waktuTransaksi = new Date(tanggalCheckin);
    waktuTransaksi.setDate(waktuTransaksi.getDate() - acakAngka(1, 5));
    waktuTransaksi.setHours(acakAngka(8, 20), acakAngka(0, 59), 0, 0);

    const waktuSettlement = new Date(waktuTransaksi.getTime() + acakAngka(2, 45) * 60000);

    const aktualCheckin = new Date(tanggalCheckin);
    aktualCheckin.setHours(acakAngka(13, 19), acakAngka(0, 59), 0, 0);

    // Masih dihuni sampai siang ini
    kamar.tersedia = false;

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
      status_checkin: "checked_in",
      tanggal_aktual_checkin: aktualCheckin,
      tanggal_aktual_checkout: null
    }));
  }

  // -------------------------------------------------------------
  // (e) SUDAH CHECK-OUT - riwayat penyewa yang selesai
  //     Kamar yang dipakai tetap tersedia = true
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_CHECKED_OUT; i++) {
    const kamar = kamarTersisa.pop();
    const cabang = petaCabang[kamar.cabang_id];

    // Riwayat memakai campuran harian dan bulanan agar datanya bervariasi.
    // Semua tanggalnya di masa lalu, jadi tipe apa pun aman.
    const tipeSewa = i % 2 === 0 ? "harian" : "bulanan";
    const durasi = acakDurasi(tipeSewa);

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

  // -------------------------------------------------------------
  // (f) TRANSAKSI GAGAL - deny / expire / cancel
  // -------------------------------------------------------------
  for (let i = 0; i < JUMLAH_GAGAL; i++) {
    const cabang = acakDari(DAFTAR_CABANG);
    const tipeSewa = Math.random() < 0.6 ? "bulanan" : "harian";
    const durasi = acakDurasi(tipeSewa);

    const waktuTransaksi = geserHari(-acakAngka(5, 120));
    const tanggalCheckin = geserHari(-acakAngka(0, 100), 14);

    daftarTransaksi.push(buatTransaksi({
      transaction_status: acakDari(STATUS_GAGAL),
      transaction_time: waktuTransaksi,
      settlement_time: null,           // tidak pernah lunas
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

  return daftarTransaksi;
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
  const dataTransaksi = buatDataTransaksi(dataKamar);
  const dataUser = await buatDataUser();

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

  // --- Langkah 4: ringkasan untuk pemeriksaan ---
  const ringkasanStatus = {};
  const ringkasanCheckin = {};
  dataTransaksi.forEach(function (t) {
    ringkasanStatus[t.transaction_status] = (ringkasanStatus[t.transaction_status] || 0) + 1;
    ringkasanCheckin[t.status_checkin] = (ringkasanCheckin[t.status_checkin] || 0) + 1;
  });

  // Menghitung transaksi yang mendekati jatuh tempo (H-1 sampai H-7)
  const sekarang = new Date();
  const batas7Hari = new Date();
  batas7Hari.setDate(batas7Hari.getDate() + 7);

  const jatuhTempo = dataTransaksi.filter(function (t) {
    const checkout = t.tanggal_checkout.toDate();
    return t.status_checkin === "checked_in" && checkout >= sekarang && checkout <= batas7Hari;
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
  tulisLog("Mendekati jatuh tempo (checkout <= 7 hari lagi): " + jatuhTempo.length + " transaksi");
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
    jumlahUser: dataUser.length
  };
}
