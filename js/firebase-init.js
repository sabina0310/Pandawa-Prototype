/**
 * =====================================================================
 * INISIALISASI FIREBASE (dipakai bersama oleh semua halaman)
 * =====================================================================
 * File ini hanya bertugas menghubungkan aplikasi ke Firestore.
 * Halaman lain cukup melakukan: import { db } from './firebase-init.js'
 *
 * Memakai Firebase SDK modular v9+ (import per fungsi) dari CDN gstatic,
 * konsisten dengan setup yang dipakai pada seed-data.js.
 *
 * Catatan keamanan: konfigurasi di bawah memang dirancang untuk terlihat
 * publik. Yang melindungi data adalah Firestore Security Rules,
 * berbeda dengan Server Key Midtrans yang wajib disembunyikan.
 * =====================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

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

// Objek database yang dipakai seluruh halaman
export const db = getFirestore(app);

// Nama collection ditulis satu kali di sini agar tidak salah ketik
export const COL_CABANG = "cabang";
export const COL_KAMAR = "kamar";
export const COL_TRANSAKSI = "transaksi_pemesanan";
export const COL_CUSTOMERS = "customers";
