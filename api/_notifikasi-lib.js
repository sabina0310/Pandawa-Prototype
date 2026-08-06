/**
 * =====================================================================
 * PUSTAKA BERSAMA UNTUK NOTIFIKASI WHATSAPP (FONNTE)
 * =====================================================================
 * Dipakai oleh dua serverless function:
 *   - api/cron-notifikasi-tenggat.js  (produksi, jalan 1x sehari)
 *   - api/cron-uji-notifikasi.js      (simulasi UAT, jalan tiap 3 menit)
 *
 * Nama file diawali garis bawah "_" supaya Vercel TIDAK menganggapnya
 * sebagai endpoint. File ini hanya bisa dipanggil dari kode lain,
 * tidak bisa dibuka lewat URL.
 * =====================================================================
 */

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

// =====================================================================
// KONFIGURASI FIREBASE
// ---------------------------------------------------------------------
// Sama persis dengan yang dipakai seed-data.js dan js/firebase-init.js.
// Config ini memang dirancang untuk terlihat publik; yang melindungi
// data adalah Firestore Security Rules, bukan kerahasiaan config.
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

const COL_TRANSAKSI = 'transaksi_pemesanan';

/**
 * Menyiapkan koneksi Firestore.
 * Serverless function bisa dipanggil berkali-kali dalam satu proses,
 * jadi aplikasi Firebase hanya dibuat sekali lalu dipakai ulang.
 */
function ambilFirestore() {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

// =====================================================================
// NOMOR TELEPON
// =====================================================================

/**
 * Mengubah nomor apa pun menjadi format yang diminta Fonnte: 62xxxxxxxxx
 *
 * Contoh:
 *   "+62 812-3456-7890" -> "6281234567890"
 *   "0812 3456 7890"    -> "6281234567890"
 *   "81234567890"       -> "6281234567890"
 *
 * Mengembalikan null bila nomornya jelas tidak masuk akal, supaya
 * pengiriman ke nomor rusak bisa dilewati, bukan menggagalkan cron.
 */
function normalisasiNomor(nomor) {
  let angka = String(nomor || '').replace(/[^0-9]/g, '');

  if (!angka) return null;

  if (angka.startsWith('62')) {
    // sudah benar
  } else if (angka.startsWith('0')) {
    angka = '62' + angka.slice(1);
  } else if (angka.startsWith('8')) {
    angka = '62' + angka;
  } else {
    return null;
  }

  // Nomor Indonesia yang wajar: 62 + 9 sampai 13 digit
  if (angka.length < 11 || angka.length > 15) return null;

  return angka;
}

// =====================================================================
// MODE UJI COBA (UAT)
// ---------------------------------------------------------------------
// DUA SAKELAR YANG BERDIRI SENDIRI
//
//   UAT_MODE          -> menentukan TRANSAKSI MANA yang diproses
//   FONNTE_NOMOR_UJI  -> menentukan KE NOMOR MANA pesan dikirim
//
// Keduanya sengaja tidak saling memaksa, karena menjawab pertanyaan
// yang berbeda. Mode uji yang menyala TIDAK dengan sendirinya
// mengalihkan nomor tujuan: pesan tetap dikirim ke nomor penyewa yang
// tercatat pada transaksi itu. Pengalihan hanya terjadi bila
// FONNTE_NOMOR_UJI memang diisi.
//
// Gabungan yang mungkin:
//
//   UAT_MODE   FONNTE_NOMOR_UJI   akibatnya
//   ---------  -----------------  ------------------------------------
//   menyala    kosong             hanya pesanan "UAT-", ke nomor
//                                 penyewa pada pesanan itu
//   menyala    diisi              hanya pesanan "UAT-", seluruhnya
//                                 dialihkan ke nomor penguji
//   mati       kosong             SEMUA pesanan, ke nomor penyewa
//                                 (perilaku produksi)
//   mati       diisi              SEMUA pesanan, dialihkan
//
// ---------------------------------------------------------------------
// NILAI UAT_MODE
// ---------------------------------------------------------------------
//   tidak diisi   -> menyala   (aman)
//   ""            -> menyala   (aman)
//   "true"        -> menyala
//   "false"       -> MATI      (seluruh pesanan ikut diproses)
//
// Hanya kata "false" yang mematikan. Lupa menyalakan berakibat seluruh
// transaksi -- termasuk 50 data seeding bernomor acak -- ikut dikirimi
// pesan; lupa mematikan hanya berakibat pesanan biasa terlewat, dan itu
// langsung terlihat di log. Karena itu kelalaian diarahkan ke sisi yang
// lebih aman.
//
// ---------------------------------------------------------------------
// YANG PERLU DIINGAT SAAT FONNTE_NOMOR_UJI DIKOSONGKAN
// ---------------------------------------------------------------------
// Pesanan UAT dibuat dengan MENYALIN pesanan lain, termasuk nomornya
// (lihat api/uat-dummy-booking.js). Jadi nomor tujuannya adalah nomor
// pesanan asal, bukan nomor penguji. Bila pesanan UAT dibuat dari data
// seeding, nomor itu acak dan bisa jadi milik orang lain.
//
// Aman: buat pesanan UAT dari pesanan yang Anda buat sendiri lewat form
// pemesanan, dengan nomor WhatsApp Anda sendiri.
// =====================================================================

/** Awalan order_id yang dibuat api/uat-dummy-booking.js. */
const AWALAN_ORDER_UAT = 'UAT-';

/** true bila mode uji coba sedang menyala. */
function modeUjiAktif() {
  const nilai = String(process.env.UAT_MODE === undefined ? '' : process.env.UAT_MODE)
    .trim()
    .toLowerCase();

  // Hanya kata "false" yang mematikan. Selain itu -- termasuk kosong,
  // tidak diisi, atau salah ketik -- dianggap menyala.
  return nilai !== 'false';
}

/** true bila order_id ini milik pesanan uji coba. */
function pesananUji(orderId) {
  return String(orderId || '').startsWith(AWALAN_ORDER_UAT);
}

/**
 * Keterangan pengaturan yang sedang berlaku, untuk ditulis ke log.
 * Bukan penolakan -- cron tetap berjalan. Gunanya supaya saat membaca
 * log jelas terlihat pesan akan mendarat ke mana.
 */
function ringkasanPengaturan() {
  const nomorUji = normalisasiNomor(process.env.FONNTE_NOMOR_UJI);

  const cakupan = modeUjiAktif()
    ? 'hanya pesanan berawalan "' + AWALAN_ORDER_UAT + '"'
    : 'SELURUH pesanan yang memenuhi syarat';

  const tujuan = nomorUji
    ? 'dialihkan ke nomor penguji ' + nomorUji
    : 'dikirim ke nomor penyewa pada masing-masing pesanan';

  return {
    modeUji: modeUjiAktif(),
    pengalihanAktif: !!nomorUji,
    keterangan: 'Cakupan: ' + cakupan + '. Tujuan: ' + tujuan + '.'
  };
}

function tentukanTujuan(nomorAsli) {
  const nomorUji = normalisasiNomor(process.env.FONNTE_NOMOR_UJI);
  const nomorPenyewa = normalisasiNomor(nomorAsli);

  // Pengalihan HANYA bergantung pada FONNTE_NOMOR_UJI, tidak pada
  // UAT_MODE. Mode uji mempersempit transaksi mana yang diproses, bukan
  // ke mana pesannya dikirim.
  if (nomorUji) {
    return { tujuan: nomorUji, dialihkan: true, nomorPenyewa: nomorPenyewa };
  }

  return { tujuan: nomorPenyewa, dialihkan: false, nomorPenyewa: nomorPenyewa };
}

// =====================================================================
// PENGIRIMAN PESAN LEWAT FONNTE
// =====================================================================

const FONNTE_URL = 'https://api.fonnte.com/send';

/**
 * Mengirim satu pesan WhatsApp lewat Fonnte.
 *
 * @param {string} nomorTujuan - nomor sudah dalam format 62xxxx
 * @param {string} pesan       - isi pesan
 * @returns {Promise<Object>}  - { berhasil, keterangan }
 */
async function kirimWhatsapp(nomorTujuan, pesan) {
  const token = process.env.FONNTE_TOKEN;

  if (!token) {
    return {
      berhasil: false,
      keterangan: 'FONNTE_TOKEN belum diatur pada environment variable.'
    };
  }

  if (!nomorTujuan) {
    return { berhasil: false, keterangan: 'Nomor tujuan tidak valid.' };
  }

  try {
    const tanggapan = await fetch(FONNTE_URL, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: nomorTujuan,
        message: pesan,
        countryCode: '62'
      })
    });

    const hasil = await tanggapan.json().catch(function () { return {}; });

    // Fonnte membalas dengan status:true bila pesan masuk antrean
    if (!tanggapan.ok || hasil.status === false) {
      return {
        berhasil: false,
        keterangan: hasil.reason || hasil.detail || ('HTTP ' + tanggapan.status)
      };
    }

    return { berhasil: true, keterangan: hasil.detail || 'Pesan masuk antrean Fonnte.' };

  } catch (err) {
    return { berhasil: false, keterangan: 'Gagal menghubungi Fonnte: ' + err.message };
  }
}

// =====================================================================
// FORMAT TANGGAL & WAKTU
// =====================================================================

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Mengubah Timestamp Firestore / Date menjadi objek Date biasa. */
function keDate(nilai) {
  if (!nilai) return null;
  if (typeof nilai.toDate === 'function') return nilai.toDate();
  return new Date(nilai);
}

/** Contoh hasil: "15 Oktober 2025" */
function formatTanggal(nilai) {
  const d = keDate(nilai);
  if (!d || isNaN(d.getTime())) return '-';
  return d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
}

/** Membuang jam/menit agar dua tanggal bisa dibandingkan per hari. */
function awalHari(nilai) {
  const d = keDate(nilai);
  if (!d || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Selisih hari dari hari ini. Positif = masih akan datang. */
function sisaHariMenuju(tanggal) {
  const target = awalHari(tanggal);
  if (!target) return null;

  const hariIni = awalHari(new Date());
  return Math.round((target - hariIni) / (1000 * 60 * 60 * 24));
}

/** true bila tanggal tersebut jatuh pada hari ini. */
function tanggalHariIni(nilai) {
  const target = awalHari(nilai);
  if (!target) return false;
  return target.getTime() === awalHari(new Date()).getTime();
}

// =====================================================================
// PENGAMAN AKSES ENDPOINT
// =====================================================================

/**
 * Memastikan pemanggil endpoint memang berhak.
 *
 * Vercel Cron menyertakan header "Authorization: Bearer <CRON_SECRET>"
 * bila environment variable CRON_SECRET diatur. Bila CRON_SECRET tidak
 * diatur sama sekali, pemeriksaan dilewati supaya pengujian manual
 * lewat browser tetap mudah dilakukan.
 */
function aksesDiizinkan(req) {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia) return true; // mode pengujian terbuka

  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const dariQuery = req.query ? req.query.secret : null;

  return header === 'Bearer ' + rahasia || dariQuery === rahasia;
}

module.exports = {
  ambilFirestore,
  COL_TRANSAKSI,
  AWALAN_ORDER_UAT,
  modeUjiAktif,
  pesananUji,
  ringkasanPengaturan,
  normalisasiNomor,
  tentukanTujuan,
  kirimWhatsapp,
  formatTanggal,
  keDate,
  awalHari,
  sisaHariMenuju,
  tanggalHariIni,
  aksesDiizinkan
};
