/**
 * =====================================================================
 * PENGAMBILAN DATA FIRESTORE UNTUK HALAMAN ADMIN & SUPER ADMIN
 * =====================================================================
 * Semua halaman admin membutuhkan pola yang sama:
 *   1. ambil daftar cabang dan kamar (jarang berubah)
 *   2. pantau transaksi_pemesanan secara real-time
 *   3. gabungkan ketiganya supaya satu transaksi langsung membawa
 *      nama cabang dan nomor kamarnya
 *
 * Ketiga langkah itu dikumpulkan di file ini agar tidak ditulis ulang
 * di tujuh halaman yang berbeda.
 * =====================================================================
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_CABANG, COL_KAMAR, COL_TRANSAKSI } from "./firebase-init.js";
import { HARI_JATUH_TEMPO, awalHari, keDate, statusLunas, statusGagal } from "./admin-util.js";

export { COL_CABANG, COL_KAMAR, COL_TRANSAKSI, Timestamp };

// ---------------------------------------------------------------------
// MEMBACA DATA
// ---------------------------------------------------------------------

/**
 * Mengambil seluruh isi sebuah collection sebagai objek berbentuk
 * { "id-dokumen": { ...isi dokumen, id: "id-dokumen" } }.
 * Bentuk ini memudahkan pencarian tanpa perlu perulangan.
 */
export async function ambilPeta(namaCollection) {
  const hasil = await getDocs(collection(db, namaCollection));
  const peta = {};
  hasil.forEach(function (dokumen) {
    peta[dokumen.id] = Object.assign({ id: dokumen.id }, dokumen.data());
  });
  return peta;
}

/** Mengambil satu dokumen berdasarkan ID. Mengembalikan null bila tidak ada. */
export async function ambilDokumen(namaCollection, id) {
  const cuplikan = await getDoc(doc(db, namaCollection, id));
  if (!cuplikan.exists()) return null;
  return Object.assign({ id: cuplikan.id }, cuplikan.data());
}

/**
 * Memantau collection transaksi_pemesanan secara real-time.
 * Setiap kali ada perubahan di Firestore, fungsi "saatBerubah"
 * dipanggil ulang dengan daftar transaksi yang sudah digabung.
 *
 * @param {Object} petaCabang - hasil ambilPeta("cabang")
 * @param {Object} petaKamar  - hasil ambilPeta("kamar")
 * @param {Function} saatBerubah - menerima array transaksi
 * @param {Function} saatGagal   - menerima objek error
 * @returns {Function} fungsi untuk berhenti memantau
 */
export function pantauTransaksi(petaCabang, petaKamar, saatBerubah, saatGagal) {
  return onSnapshot(
    collection(db, COL_TRANSAKSI),
    function (cuplikan) {
      const daftar = [];
      cuplikan.forEach(function (dokumen) {
        daftar.push(gabungTransaksi(
          Object.assign({ id: dokumen.id }, dokumen.data()),
          petaCabang,
          petaKamar
        ));
      });

      // Urutkan dari transaksi terbaru
      daftar.sort(function (a, b) {
        return keDate(b.transaction_time) - keDate(a.transaction_time);
      });

      saatBerubah(daftar);
    },
    saatGagal
  );
}

/** Versi real-time untuk collection kamar (dipakai halaman branches). */
export function pantauKamar(saatBerubah, saatGagal) {
  return onSnapshot(
    collection(db, COL_KAMAR),
    function (cuplikan) {
      const daftar = [];
      cuplikan.forEach(function (dokumen) {
        daftar.push(Object.assign({ id: dokumen.id }, dokumen.data()));
      });

      // Urutkan berdasarkan nomor kamar agar tampilannya rapi
      daftar.sort(function (a, b) {
        return String(a.id).localeCompare(String(b.id));
      });

      saatBerubah(daftar);
    },
    saatGagal
  );
}

/**
 * Menempelkan nama cabang dan nomor kamar ke sebuah transaksi,
 * supaya halaman tidak perlu melakukan pencarian berulang kali.
 */
export function gabungTransaksi(transaksi, petaCabang, petaKamar) {
  const cabang = petaCabang[transaksi.cabang_id];
  const kamar = transaksi.kamar_id ? petaKamar[transaksi.kamar_id] : null;

  transaksi.nama_cabang = cabang ? cabang.nama_cabang : "-";
  transaksi.nomor_kamar = kamar ? kamar.nomor_kamar : null;
  return transaksi;
}

// ---------------------------------------------------------------------
// PENYARINGAN YANG DIPAKAI BERSAMA
// ---------------------------------------------------------------------

/**
 * Transaksi yang sudah lunas tapi kamarnya belum ditentukan admin.
 * Inilah yang muncul di daftar "Menunggu Alokasi Kamar".
 */
export function perluAlokasi(transaksi) {
  return statusLunas(transaksi.transaction_status) && !transaksi.kamar_id;
}

/**
 * Penghuni yang sedang menempati kamar dan masa sewanya akan habis
 * dalam 7 hari ke depan (termasuk hari ini).
 *
 * Definisi ini dipakai oleh dashboard, bookings, alokasi-kamar, dan
 * financials, sehingga angkanya tidak pernah berbeda antar halaman.
 */
export function mendekatiJatuhTempo(transaksi) {
  if (transaksi.status_checkin !== "checked_in") return false;

  const batas = awalHari(new Date());
  batas.setDate(batas.getDate() + HARI_JATUH_TEMPO);

  const checkout = awalHari(transaksi.tanggal_checkout);
  return checkout !== null && checkout >= awalHari(new Date()) && checkout <= batas;
}

/** Penghuni yang saat ini benar-benar menempati kamar. */
export function sedangMenghuni(transaksi) {
  return transaksi.status_checkin === "checked_in";
}

/** Transaksi yang batal / gagal dibayar. */
export function transaksiGagal(transaksi) {
  return statusGagal(transaksi.transaction_status);
}

// ---------------------------------------------------------------------
// MENULIS PERUBAHAN
// ---------------------------------------------------------------------
// Semua penulisan memakai updateDoc, bukan setDoc.
// Artinya hanya field yang disebut yang berubah; field lain hasil
// seeding tetap utuh dan tidak ada dokumen yang terhapus.
// ---------------------------------------------------------------------

/**
 * Menyimpan hasil alokasi kamar oleh admin.
 * Dua dokumen ikut berubah: transaksi mendapat kamar_id, dan kamar
 * yang dipilih ditandai tidak tersedia lagi.
 */
export async function simpanAlokasiKamar(orderId, kamarId) {
  await updateDoc(doc(db, COL_TRANSAKSI, orderId), {
    kamar_id: kamarId
  });

  await updateDoc(doc(db, COL_KAMAR, kamarId), {
    tersedia: false
  });
}

/**
 * Menyimpan hasil proses check-in.
 * Status check-in transaksi berubah menjadi "checked_in" dan waktu
 * kedatangan sebenarnya dicatat memakai jam saat tombol ditekan.
 */
export async function simpanCheckin(orderId, kamarId) {
  await updateDoc(doc(db, COL_TRANSAKSI, orderId), {
    status_checkin: "checked_in",
    tanggal_aktual_checkin: Timestamp.fromDate(new Date())
  });

  if (kamarId) {
    await updateDoc(doc(db, COL_KAMAR, kamarId), {
      tersedia: false
    });
  }
}

/**
 * Menyimpan hasil proses check-out.
 * Status check-in transaksi berubah menjadi "checked_out" dan waktu
 * kepulangan sebenarnya dicatat; kamar yang ditinggalkan dikembalikan
 * menjadi tersedia.
 */
export async function simpanCheckout(orderId, kamarId) {
  await updateDoc(doc(db, COL_TRANSAKSI, orderId), {
    status_checkin: "checked_out",
    tanggal_aktual_checkout: Timestamp.fromDate(new Date())
  });

  if (kamarId) {
    await updateDoc(doc(db, COL_KAMAR, kamarId), {
      tersedia: true
    });
  }
}
