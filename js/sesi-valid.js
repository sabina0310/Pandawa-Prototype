/**
 * =====================================================================
 * PEMERIKSAAN KEABSAHAN SESI PENYEWA
 * =====================================================================
 * Sesi login disimpan di localStorage peramban, sedangkan akunnya ada
 * di Firestore. Keduanya bisa tidak sinkron:
 *
 *   - collection "user" dihapus / dibuat ulang saat seeding
 *   - akun dihapus admin lewat Firebase Console
 *   - basis data ditukar ke proyek Firebase lain
 *
 * Dalam keadaan itu peramban masih merasa "sudah masuk" padahal
 * akunnya tidak ada. Halaman penyewa terbuka untuk akun hantu, dan
 * pengguna tidak bisa masuk maupun keluar dengan wajar.
 *
 * Berkas ini memeriksa sekali tiap halaman dibuka: bila akun pada
 * sesi tidak ditemukan di Firestore, seluruh jejak sesi dibersihkan.
 *
 * ---------------------------------------------------------------------
 * ATURAN PENTING
 * ---------------------------------------------------------------------
 * Sesi HANYA dihapus bila Firestore benar-benar menjawab "tidak ada".
 * Bila pemeriksaan gagal karena jaringan mati atau Security Rules
 * menolak, sesi DIBIARKAN. Menghapusnya dalam keadaan itu berarti
 * mengeluarkan pengguna yang sebenarnya sah -- kesalahan yang jauh
 * lebih mengganggu daripada membiarkan sesi hantu sebentar.
 *
 * Biayanya satu pembacaan Firestore tiap halaman dibuka, dan hanya
 * dijalankan bila memang ada sesi tersimpan.
 * =====================================================================
 */

import { cariPengguna, ambilSesi, KUNCI_SESI } from "./customer-auth.js";

/** Kunci localStorage yang ikut dibersihkan bersama sesi. */
const KUNCI_JEJAK = [
  KUNCI_SESI,
  "bookingData",
  "identityData",
  "extensionData",
  "dataPembayaran",
  "dataPembayaranPerpanjangan"
];

const PENANDA_URL = "sesi";
const ALASAN = "tidak-ditemukan";

/** Menghapus seluruh jejak sesi dari peramban. */
function bersihkanSesi() {
  KUNCI_JEJAK.forEach(function (k) { localStorage.removeItem(k); });
}

/** Alamat halaman masuk, menyesuaikan kedalaman folder halaman. */
function alamatMasuk() {
  const jalur = window.location.pathname.replace(/\\/g, "/");
  const posisi = jalur.indexOf("/customer/");
  if (posisi === -1) return "customer/login-customer.html";

  const sisa = jalur.slice(posisi + "/customer/".length);
  const tingkat = sisa.split("/").length - 1;
  return "../".repeat(tingkat) + "login-customer.html";
}

/**
 * Mengubah tampilan top nav menjadi keadaan "belum masuk".
 * Dipakai pada halaman umum, supaya ikon profil tidak tertinggal
 * padahal sesinya baru saja dibersihkan.
 */
function tampilkanBelumMasuk() {
  const ikonProfil = document.getElementById("profileNavBtn");
  const tombolMasuk = document.getElementById("loginNavBtn");

  if (ikonProfil) {
    ikonProfil.classList.add("hidden");
    ikonProfil.style.display = "none";
  }
  if (tombolMasuk) tombolMasuk.style.display = "";
}

/**
 * Memeriksa apakah akun pada sesi masih ada di Firestore.
 *
 * @param {Object}  opsi
 * @param {boolean} opsi.wajibLogin - true pada halaman yang memang
 *        hanya boleh dibuka setelah masuk. Bila akun tidak ditemukan,
 *        pengunjung diarahkan ke halaman masuk. Pada halaman umum
 *        (katalog, detail cabang) sesi cukup dibersihkan diam-diam.
 * @returns {Promise<"sah"|"tidak-ada-sesi"|"dibersihkan"|"gagal-periksa">}
 */
export async function periksaSesi(opsi) {
  const sesi = ambilSesi();

  // Tidak ada sesi: tidak ada yang perlu diperiksa, dan tidak ada
  // pembacaan Firestore yang terbuang.
  if (!sesi || !sesi.username) return "tidak-ada-sesi";

  let pengguna;
  try {
    pengguna = await cariPengguna(sesi.username);
  } catch (err) {
    // Jaringan mati atau akses ditolak. Sesi SENGAJA dibiarkan.
    console.warn("[Sesi] Tidak dapat memeriksa akun ke Firestore:", err.message);
    return "gagal-periksa";
  }

  if (pengguna) return "sah";

  // Firestore menjawab dengan pasti: akun ini sudah tidak ada.
  console.warn('[Sesi] Akun "' + sesi.username +
               '" tidak ditemukan di Firestore. Sesi dibersihkan.');
  bersihkanSesi();

  if (opsi && opsi.wajibLogin) {
    window.location.replace(alamatMasuk() + "?" + PENANDA_URL + "=" + ALASAN);
  } else {
    tampilkanBelumMasuk();
  }

  return "dibersihkan";
}

// =====================================================================
// KETERANGAN DI HALAMAN MASUK
// ---------------------------------------------------------------------
// Halaman masuk memuat berkas ini juga. Bagian di bawah menjelaskan
// kepada pengguna mengapa ia tiba-tiba diminta masuk lagi, memakai
// kotak pesan #authAlert yang sudah ada di halaman itu.
// =====================================================================
(function catatanDiHalamanMasuk() {
  const parameter = new URLSearchParams(window.location.search);
  if (parameter.get(PENANDA_URL) !== ALASAN) return;

  const kotak = document.getElementById("authAlert");
  if (!kotak) return;

  kotak.className =
    "flex items-start gap-sm bg-status-warning/10 border border-status-warning/30 " +
    "rounded-lg p-md mb-base";
  kotak.innerHTML =
    '<span class="material-symbols-outlined text-status-warning text-[20px]">info</span>' +
    '<span class="font-body-sm text-body-sm text-ink-secondary">Sesi Anda berakhir karena ' +
    'akun tidak lagi ditemukan di database. Silakan masuk kembali, atau daftar ulang ' +
    'bila akun Anda memang sudah dihapus.</span>';

  // Penanda dibersihkan dari alamat agar pesan tidak muncul lagi
  // ketika halaman dimuat ulang.
  window.history.replaceState({}, "", window.location.pathname);
})();
