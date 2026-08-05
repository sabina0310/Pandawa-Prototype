/**
 * =====================================================================
 * PERPANJANGAN SEWA - LANGKAH 2 (customer/extend/step-2.html)
 * =====================================================================
 * Halaman pembayaran perpanjangan. Seluruh tampilan dan pengecekan
 * statusnya dikerjakan js/pembayaran.js, berkas yang sama dipakai
 * Form Order -- sehingga kedua form benar-benar sama, termasuk kode
 * QRIS, nomor Virtual Account, tombol salin, dan tautan simulator.
 *
 * Yang khusus untuk perpanjangan hanyalah apa yang dikerjakan setelah
 * pembayaran lunas:
 *   1. Dokumen transaksi BARU berisi periode sewa lanjutan
 *   2. Transaksi lama ditandai status_perpanjangan = "perpanjang",
 *      sehingga cron notifikasi berhenti mengingatkannya
 * =====================================================================
 */

import {
  doc, setDoc, updateDoc, getDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_TRANSAKSI } from "../js/firebase-init.js";
import { mulaiPembayaran } from "../js/pembayaran.js";

// =====================================================================
// MENYIMPAN PERPANJANGAN KE FIRESTORE
// ---------------------------------------------------------------------
// Perpanjangan dicatat sebagai transaksi BARU, bukan menimpa yang lama.
// Dengan begitu riwayat pembayaran tetap utuh dan perpanjangannya
// muncul sebagai entri tersendiri di halaman Riwayat Pesanan.
// =====================================================================
async function simpanPerpanjangan(dataPembayaran) {
  function tulisStatus(pesan, jenis) {
    const penanda = document.getElementById("statusSimpanDatabase");
    if (!penanda) return;
    penanda.textContent = pesan;
    penanda.className = jenis === "error"
      ? "font-body-sm text-[12px] text-error text-center"
      : "font-body-sm text-[12px] text-ink-muted text-center";
  }

  const dataPerpanjangan = JSON.parse(localStorage.getItem("extensionData") || "null");

  if (!dataPerpanjangan || !dataPerpanjangan.orderIdLama) {
    tulisStatus("Perpanjangan tidak dapat dicatat: data perpanjangan tidak lengkap.", "error");
    return;
  }

  try {
    const orderId = dataPembayaran.order_id;

    // Bila halaman dimuat ulang setelah lunas, jangan buat dua kali
    if ((await getDoc(doc(db, COL_TRANSAKSI, orderId))).exists()) {
      tulisStatus("Perpanjangan ini sudah tercatat sebelumnya.");
      return;
    }

    tulisStatus("Menyimpan perpanjangan ke database...");

    const sesi = JSON.parse(localStorage.getItem("customerSession") || "null");
    const sekarang = new Date();

    const dokumen = {
      order_id: orderId,
      customer_username: sesi && sesi.username ? sesi.username : null,
      order_amount: Number(dataPembayaran.gross_amount || dataPerpanjangan.total || 0),
      payment_type: dataPembayaran.payment_type || "qris",
      transaction_status: dataPembayaran.transaction_status || "settlement",
      transaction_time: Timestamp.fromDate(sekarang),
      settlement_time: Timestamp.fromDate(sekarang),

      cabang_id: dataPerpanjangan.cabangId,
      // Kamar dibiarkan kosong: admin yang menentukan apakah penghuni
      // tetap di kamar lama atau dipindahkan.
      kamar_id: null,
      tipe_sewa: "bulanan",

      nama_penyewa: dataPerpanjangan.namaPenyewa || "-",
      nik_penyewa: dataPerpanjangan.nikPenyewa || "-",
      kontak_penyewa: dataPerpanjangan.kontakPenyewa || "",

      tanggal_checkin: Timestamp.fromDate(new Date(dataPerpanjangan.checkin + "T14:00:00")),
      tanggal_checkout: Timestamp.fromDate(new Date(dataPerpanjangan.checkout + "T12:00:00")),

      status_checkin: "belum_checkin",
      tanggal_aktual_checkin: null,
      tanggal_aktual_checkout: null,

      status_perpanjangan: "belum",
      penghuni_tambahan: [],

      // Penanda bahwa ini kelanjutan dari sewa sebelumnya
      perpanjangan_dari: dataPerpanjangan.orderIdLama,
      catatan_perpanjangan: dataPerpanjangan.catatan || ""
    };

    await setDoc(doc(db, COL_TRANSAKSI, orderId), dokumen);

    // Tandai sewa lama sudah diperpanjang -> cron berhenti mengingatkan
    await updateDoc(doc(db, COL_TRANSAKSI, dataPerpanjangan.orderIdLama), {
      status_perpanjangan: "perpanjang"
    });

    console.log("[Perpanjangan] Tersimpan:", orderId,
                "| lanjutan dari", dataPerpanjangan.orderIdLama);

    tulisStatus("Perpanjangan berhasil dicatat. Admin akan menentukan kamar Anda.");

  } catch (err) {
    console.error("[Perpanjangan] Gagal menyimpan:", err);
    tulisStatus(
      "Pembayaran berhasil, tetapi perpanjangan gagal dicatat otomatis. " +
      "Silakan tunjukkan bukti pembayaran ini kepada admin.", "error");
  }
}

// =====================================================================
// MENJALANKAN HALAMAN PEMBAYARAN
// =====================================================================
mulaiPembayaran({
  kunciData: "dataPembayaranPerpanjangan",
  idKartu: "kartuPembayaran",
  idCara: "caraPembayaran",
  idModal: "paymentSuccessModal",
  pesanKembali: "Data pembayaran tidak ditemukan. Silakan ulangi perpanjangan dari halaman beranda penyewa.",

  saatLunas: function (dataPembayaran) {
    simpanPerpanjangan(dataPembayaran);
  }
});

// Tombol pada modal "Pembayaran Berhasil"
const tombolLanjut = document.getElementById("goToStep3Btn");
if (tombolLanjut) {
  tombolLanjut.addEventListener("click", function () {
    window.location.href = "step-3.html";
  });
}
