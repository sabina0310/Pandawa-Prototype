/**
 * =====================================================================
 * PENGAMBILAN DATA FIRESTORE UNTUK HALAMAN CUSTOMER
 * =====================================================================
 * Halaman beranda, katalog, dan detail cabang membutuhkan hal yang
 * sama: daftar cabang beserta hitungan kamarnya. Perhitungan itu
 * dikumpulkan di sini agar angkanya konsisten di ketiga halaman.
 *
 * Catatan penting soal model data:
 * Customer memesan CABANG, bukan nomor kamar tertentu. Nomor kamar
 * ditentukan admin belakangan lewat halaman Alokasi Kamar. Karena itu
 * transaksi yang dibuat di sini selalu punya kamar_id = null.
 * =====================================================================
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_CABANG, COL_KAMAR, COL_TRANSAKSI } from "./firebase-init.js";

export { COL_CABANG, COL_KAMAR, COL_TRANSAKSI };

// =====================================================================
// 1. MENGHITUNG KETERSEDIAAN KAMAR TIAP CABANG
// =====================================================================

/**
 * Mengambil seluruh dokumen "kamar", lalu mengelompokkannya per cabang.
 * Hasilnya: { "pesona-kos": { total_kamar: 12, kamar_tersedia: 9 }, ... }
 */
export async function hitungKetersediaanPerCabang() {
  const cuplikan = await getDocs(collection(db, COL_KAMAR));
  const hitungan = {};

  cuplikan.forEach(function (dokumen) {
    const kamar = dokumen.data();
    const idCabang = kamar.cabang_id;
    if (!idCabang) return;

    if (!hitungan[idCabang]) {
      hitungan[idCabang] = { total_kamar: 0, kamar_tersedia: 0 };
    }

    hitungan[idCabang].total_kamar++;

    // Kamar dianggap tersedia selama tidak ditandai tersedia = false
    if (kamar.tersedia !== false) {
      hitungan[idCabang].kamar_tersedia++;
    }
  });

  return hitungan;
}

/**
 * Mengambil seluruh cabang, lengkap dengan hitungan kamarnya.
 * Inilah sumber data kartu di beranda dan katalog.
 */
export async function ambilCabangDenganKetersediaan() {
  // Dua permintaan dijalankan bersamaan agar halaman lebih cepat tampil
  const [cuplikanCabang, hitungan] = await Promise.all([
    getDocs(collection(db, COL_CABANG)),
    hitungKetersediaanPerCabang()
  ]);

  const daftar = [];

  cuplikanCabang.forEach(function (dokumen) {
    const angka = hitungan[dokumen.id] || { total_kamar: 0, kamar_tersedia: 0 };

    daftar.push(Object.assign(
      { id: dokumen.id },
      dokumen.data(),
      angka
    ));
  });

  // Cabang yang masih punya kamar kosong ditampilkan lebih dulu,
  // lalu diurutkan berdasarkan nama agar susunannya tetap.
  daftar.sort(function (a, b) {
    const adaA = a.kamar_tersedia > 0 ? 0 : 1;
    const adaB = b.kamar_tersedia > 0 ? 0 : 1;
    if (adaA !== adaB) return adaA - adaB;
    return String(a.nama_cabang).localeCompare(String(b.nama_cabang));
  });

  return daftar;
}

/**
 * Mengambil SATU cabang beserta hitungan kamarnya.
 * Dipakai halaman detail; memakai getDoc supaya tidak perlu
 * mengunduh seluruh collection cabang.
 */
export async function ambilSatuCabang(idCabang) {
  const cuplikan = await getDoc(doc(db, COL_CABANG, idCabang));
  if (!cuplikan.exists()) return null;

  const hitungan = await hitungKetersediaanPerCabang();
  const angka = hitungan[idCabang] || { total_kamar: 0, kamar_tersedia: 0 };

  return Object.assign({ id: cuplikan.id }, cuplikan.data(), angka);
}

// =====================================================================
// 2. PERHITUNGAN HARGA
// =====================================================================

/** Selisih dua tanggal (format "YYYY-MM-DD") dalam satuan hari. */
export function selisihHari(tanggalMulai, tanggalAkhir) {
  if (!tanggalMulai || !tanggalAkhir) return 0;

  const mulai = new Date(tanggalMulai + "T00:00:00");
  const akhir = new Date(tanggalAkhir + "T00:00:00");
  if (isNaN(mulai.getTime()) || isNaN(akhir.getTime())) return 0;

  return Math.round((akhir - mulai) / (1000 * 60 * 60 * 24));
}

/**
 * Menghitung rincian biaya sebuah pemesanan.
 *
 * Sewa HARIAN : harga_harian x jumlah hari
 * Sewa BULANAN: harga_bulanan x jumlah bulan
 *
 * Untuk sewa bulanan, jumlah bulan dihitung dari selisih tanggal
 * dibagi 30 dan dibulatkan, karena tanggal check-out memang
 * dihasilkan otomatis dari tombol durasi 1/3/6 bulan.
 */
export function hitungBiaya(cabang, tipeSewa, tanggalCheckin, tanggalCheckout) {
  const jumlahHari = selisihHari(tanggalCheckin, tanggalCheckout);

  if (jumlahHari <= 0 || !cabang) {
    return { valid: false, durasi: 0, hargaSatuan: 0, hargaSewa: 0, biayaLayanan: 0, total: 0 };
  }

  const bulanan = tipeSewa === "bulanan";
  const durasi = bulanan ? Math.max(1, Math.round(jumlahHari / 30)) : jumlahHari;
  const hargaSatuan = bulanan ? Number(cabang.harga_bulanan || 0) : Number(cabang.harga_harian || 0);

  const hargaSewa = hargaSatuan * durasi;
  const biayaLayanan = Number(cabang.biaya_layanan || 0);

  return {
    valid: true,
    durasi: durasi,
    satuanDurasi: bulanan ? "Bulan" : "Hari",
    hargaSatuan: hargaSatuan,
    hargaSewa: hargaSewa,
    biayaLayanan: biayaLayanan,
    total: hargaSewa + biayaLayanan
  };
}

// =====================================================================
// 3. MENYIMPAN PESANAN KE FIRESTORE
// =====================================================================

/**
 * Membuat satu dokumen baru di collection "transaksi_pemesanan"
 * setelah pembayaran QRIS dinyatakan lunas oleh Midtrans.
 *
 * Bentuk dokumennya sengaja dibuat SAMA PERSIS dengan hasil seeder,
 * supaya pesanan ini langsung terbaca oleh seluruh halaman admin.
 * Nilai kamar_id dibiarkan null agar pesanan muncul di daftar
 * "Menunggu Alokasi Kamar" pada dashboard admin.
 *
 * Document ID memakai order_id dari Midtrans, sama seperti seeder,
 * sehingga pemanggilan ulang fungsi ini tidak membuat data ganda.
 */
export async function simpanPesananKeFirestore(bookingData, identityData, dataPembayaran) {
  const orderId = dataPembayaran.order_id;
  if (!orderId) throw new Error("order_id tidak ditemukan pada data pembayaran.");

  // Bila dokumen dengan order_id ini sudah pernah dibuat, jangan diulang.
  // Ini bisa terjadi bila halaman step-3 dimuat ulang setelah lunas.
  const sudahAda = await getDoc(doc(db, COL_TRANSAKSI, orderId));
  if (sudahAda.exists()) {
    return { dibuat: false, order_id: orderId };
  }

  const waktuTransaksi = new Date();
  const waktuSettlement = dataPembayaran.settlement_time
    ? new Date(String(dataPembayaran.settlement_time).replace(" ", "T") + "+07:00")
    : waktuTransaksi;

  // Nomor WhatsApp disimpan dengan format yang sama seperti data seeder
  const kontak = "+62 " + String(identityData.whatsapp || "").replace(/^0+/, "");

  const dokumen = {
    order_id: orderId,
    order_amount: Number(dataPembayaran.gross_amount || bookingData.total || 0),
    payment_type: dataPembayaran.payment_type || "qris",
    transaction_status: dataPembayaran.transaction_status || "settlement",
    transaction_time: Timestamp.fromDate(waktuTransaksi),
    settlement_time: Timestamp.fromDate(waktuSettlement),

    cabang_id: bookingData.cabangId,
    kamar_id: null, // kamar ditentukan admin lewat halaman Alokasi Kamar
    tipe_sewa: bookingData.tipeSewa,

    nama_penyewa: identityData.nama || "-",
    nik_penyewa: identityData.nik || "-",
    kontak_penyewa: kontak,

    tanggal_checkin: Timestamp.fromDate(new Date(bookingData.checkin + "T14:00:00")),
    tanggal_checkout: Timestamp.fromDate(new Date(bookingData.checkout + "T12:00:00")),

    status_checkin: "belum_checkin",
    tanggal_aktual_checkin: null,
    tanggal_aktual_checkout: null,

    // Penghuni tambahan hanya ada pada sewa bulanan.
    // Field ini tidak dipakai halaman admin mana pun, tapi disimpan
    // agar data yang diisi customer tidak hilang begitu saja.
    penghuni_tambahan: Array.isArray(identityData.tenants) ? identityData.tenants : []
  };

  await setDoc(doc(db, COL_TRANSAKSI, orderId), dokumen);

  return { dibuat: true, order_id: orderId };
}
