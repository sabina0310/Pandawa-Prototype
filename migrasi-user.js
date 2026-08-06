/**
 * =====================================================================
 * MIGRASI COLLECTION "customers" -> "user"
 * Proyek: Pilar Pandawa (Prototipe Skripsi)
 * =====================================================================
 *
 * FUNGSI : Memindahkan akun penyewa lama ke collection "user" yang baru.
 * SIFAT  : ALAT BANTU SEKALI PAKAI, bukan bagian dari sistem final.
 * PAKAI  : buka seed.html di browser, klik tombol "Jalankan Migrasi".
 *
 * ---------------------------------------------------------------------
 * MENGAPA PERLU MIGRASI
 * ---------------------------------------------------------------------
 * Firestore tidak mengenal perintah "ganti nama collection". Nama
 * collection hanya bisa diubah dengan cara MENYALIN seluruh dokumennya
 * ke nama baru, lalu menghapus yang lama.
 *
 * Sebelumnya akun penyewa disimpan di "customers". Karena kini admin
 * dan super admin juga perlu disimpan, collection-nya menjadi "user"
 * dengan field "role" sebagai pembeda.
 *
 * ---------------------------------------------------------------------
 * CARA KERJA YANG AMAN
 * ---------------------------------------------------------------------
 * Migrasi dipecah menjadi DUA langkah yang dijalankan terpisah:
 *
 *   Langkah 1 (salin)  : "customers" disalin ke "user".
 *                        Collection lama DIBIARKAN UTUH.
 *   Langkah 2 (hapus)  : "customers" dihapus, dijalankan hanya setelah
 *                        Anda memastikan semuanya sudah benar.
 *
 * Di antara keduanya, kedua collection ada bersamaan. Bila ternyata ada
 * yang salah, cukup kembalikan COL_USER di js/firebase-init.js menjadi
 * "customers" -- data lama masih berada di tempatnya.
 *
 * Document ID tidak berubah (tetap username), sehingga field
 * "customer_username" pada transaksi_pemesanan tetap cocok dan tidak
 * ada satu pun riwayat pesanan yang terputus.
 * =====================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig, "migrasi");
const db = getFirestore(app);

const COL_LAMA = "customers";
const COL_BARU = "user";

// Firestore membatasi satu batch maksimal 500 operasi
const MAKS_BATCH = 400;

// =====================================================================
// FUNGSI BANTU
// =====================================================================

/** Mengambil seluruh dokumen sebuah collection apa adanya. */
async function ambilSemua(namaCollection) {
  const hasil = await getDocs(collection(db, namaCollection));
  const daftar = [];
  hasil.forEach(function (dokumen) {
    daftar.push({ id: dokumen.id, data: dokumen.data() });
  });
  return daftar;
}

/** Menulis daftar dokumen secara bertahap agar tidak melewati batas batch. */
async function tulisBertahap(namaCollection, daftar) {
  for (let i = 0; i < daftar.length; i += MAKS_BATCH) {
    const potongan = daftar.slice(i, i + MAKS_BATCH);
    const batch = writeBatch(db);

    potongan.forEach(function (item) {
      batch.set(doc(db, namaCollection, item.id), item.data);
    });

    await batch.commit();
  }
}

/** Menghapus seluruh dokumen sebuah collection secara bertahap. */
async function hapusBertahap(namaCollection, daftarId) {
  for (let i = 0; i < daftarId.length; i += MAKS_BATCH) {
    const potongan = daftarId.slice(i, i + MAKS_BATCH);
    const batch = writeBatch(db);

    potongan.forEach(function (id) {
      batch.delete(doc(db, namaCollection, id));
    });

    await batch.commit();
  }
}

/**
 * Melengkapi dokumen lama dengan field yang baru dikenal.
 * Dokumen lama sudah punya "role", tetapi ada kemungkinan dokumen yang
 * dibuat paling awal belum memilikinya, jadi tetap diberi nilai baku.
 */
function lengkapiDokumen(data) {
  const salinan = Object.assign({}, data);

  if (!salinan.role) salinan.role = "customer";

  // Penyewa TIDAK menyimpan field cabang -- cabangnya dihitung dari
  // transaksi aktif terkini setiap kali ditampilkan. Bila dokumen lama
  // sempat memilikinya, field itu dibuang di sini agar tidak ada dua
  // sumber kebenaran.
  if (salinan.role === "customer") delete salinan.cabang;

  // Dokumen paling awal mungkin belum punya createdAt
  if (!salinan.createdAt) salinan.createdAt = Timestamp.fromDate(new Date());

  return salinan;
}

// =====================================================================
// LANGKAH 1 - MENYALIN
// =====================================================================

/**
 * Menyalin "customers" ke "user" tanpa menghapus apa pun.
 * @param {Function} tulisLog - menampilkan pesan ke halaman seed.html
 */
export async function salinKeUser(tulisLog) {
  tulisLog("Menghubungi Firestore...");

  const lama = await ambilSemua(COL_LAMA);
  const baru = await ambilSemua(COL_BARU);

  tulisLog('Isi collection "' + COL_LAMA + '" : ' + lama.length + " dokumen");
  tulisLog('Isi collection "' + COL_BARU + '"      : ' + baru.length + " dokumen");

  if (lama.length === 0) {
    tulisLog("");
    tulisLog('Tidak ada yang perlu disalin: collection "' + COL_LAMA + '" kosong.');
    tulisLog("Bila akun penyewa Anda memang belum pernah dibuat, lewati saja");
    tulisLog("langkah ini dan langsung jalankan Seeding.");
    return { berhasil: true, disalin: 0, dilewati: 0 };
  }

  // Dokumen yang sudah ada di "user" tidak ditimpa. Ini melindungi akun
  // admin hasil seeding agar tidak tertimpa dokumen penyewa lama yang
  // kebetulan ber-username sama.
  const sudahAda = {};
  baru.forEach(function (item) { sudahAda[item.id] = true; });

  const akanDisalin = [];
  const dilewati = [];

  lama.forEach(function (item) {
    if (sudahAda[item.id]) {
      dilewati.push(item.id);
      return;
    }
    akanDisalin.push({ id: item.id, data: lengkapiDokumen(item.data) });
  });

  if (dilewati.length > 0) {
    tulisLog("");
    tulisLog("Dilewati karena username-nya sudah ada di collection tujuan:");
    dilewati.forEach(function (id) { tulisLog("  - " + id); });
  }

  if (akanDisalin.length === 0) {
    tulisLog("");
    tulisLog("Semua dokumen sudah pernah disalin. Tidak ada perubahan.");
    return { berhasil: true, disalin: 0, dilewati: dilewati.length };
  }

  tulisLog("");
  tulisLog("Menyalin " + akanDisalin.length + " dokumen...");
  await tulisBertahap(COL_BARU, akanDisalin);

  // --- Pemeriksaan ulang: dibaca kembali dari Firestore, bukan sekadar
  //     percaya bahwa penulisan berhasil ---
  const sesudah = await ambilSemua(COL_BARU);

  tulisLog("");
  tulisLog("=====================================");
  tulisLog("SALIN SELESAI");
  tulisLog("=====================================");
  akanDisalin.forEach(function (item) {
    tulisLog("  + " + item.id + "  (role: " + item.data.role + ")");
  });
  tulisLog("");
  tulisLog('Jumlah dokumen "' + COL_BARU + '" sekarang: ' + sesudah.length);
  tulisLog('Collection "' + COL_LAMA + '" SENGAJA dibiarkan utuh sebagai cadangan.');
  tulisLog("");
  tulisLog("Langkah berikutnya:");
  tulisLog("  1. Coba masuk sebagai penyewa untuk memastikan akun masih bisa dipakai");
  tulisLog('  2. Bila sudah yakin, jalankan "Hapus Collection Lama" di bawah');

  return { berhasil: true, disalin: akanDisalin.length, dilewati: dilewati.length };
}

// =====================================================================
// LANGKAH 2 - MENGHAPUS COLLECTION LAMA
// =====================================================================

/**
 * Menghapus collection "customers".
 * Menolak berjalan bila hasil salinannya belum lengkap, supaya tidak
 * ada akun yang hilang tanpa cadangan.
 */
export async function hapusCollectionLama(tulisLog) {
  tulisLog("Memeriksa kelengkapan salinan sebelum menghapus...");

  const lama = await ambilSemua(COL_LAMA);
  const baru = await ambilSemua(COL_BARU);

  if (lama.length === 0) {
    tulisLog('Collection "' + COL_LAMA + '" sudah kosong. Tidak ada yang dihapus.');
    return { berhasil: true, dihapus: 0 };
  }

  const adaDiBaru = {};
  baru.forEach(function (item) { adaDiBaru[item.id] = true; });

  const belumTersalin = lama
    .map(function (item) { return item.id; })
    .filter(function (id) { return !adaDiBaru[id]; });

  if (belumTersalin.length > 0) {
    tulisLog("");
    tulisLog("DIBATALKAN: masih ada " + belumTersalin.length + " akun yang belum tersalin.");
    belumTersalin.forEach(function (id) { tulisLog("  - " + id); });
    tulisLog("");
    tulisLog('Jalankan "Salin ke Collection user" terlebih dahulu.');
    return { berhasil: false, alasan: "belum-lengkap" };
  }

  tulisLog("Seluruh " + lama.length + " akun sudah ada di collection tujuan.");
  tulisLog("Menghapus collection lama...");

  await hapusBertahap(COL_LAMA, lama.map(function (item) { return item.id; }));

  tulisLog("");
  tulisLog("=====================================");
  tulisLog("MIGRASI TUNTAS");
  tulisLog("=====================================");
  tulisLog('Collection "' + COL_LAMA + '" berhasil dihapus (' + lama.length + " dokumen).");
  tulisLog('Seluruh akun kini berada di collection "' + COL_BARU + '".');

  return { berhasil: true, dihapus: lama.length };
}
