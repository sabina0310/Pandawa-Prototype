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
// PENGALIH NOMOR UJI (PENGAMAN)
// ---------------------------------------------------------------------
// Data hasil seeding memakai nomor telepon ACAK yang formatnya valid.
// Nomor seperti itu sangat mungkin milik orang lain yang tidak ada
// hubungannya dengan aplikasi ini.
//
// Selama environment variable FONNTE_NOMOR_UJI diisi, SELURUH pesan
// dialihkan ke nomor tersebut. Nomor tujuan aslinya tetap dicatat di
// isi pesan dan di log, sehingga bukti pengujian tetap sah.
//
// CARA MEMATIKAN PENGALIHAN (agar pesan benar-benar ke penyewa):
// hapus / kosongkan variabel FONNTE_NOMOR_UJI di Vercel maupun di .env,
// lalu deploy ulang. Tidak ada kode yang perlu diubah.
// =====================================================================
function tentukanTujuan(nomorAsli) {
  const nomorUji = normalisasiNomor(process.env.FONNTE_NOMOR_UJI);
  const nomorPenyewa = normalisasiNomor(nomorAsli);

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
