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
 *   3. Transaksi lama DITUTUP (status_checkin = "checked_out"), supaya
 *      satu kamar hanya punya satu sewa berjalan
 *
 * ---------------------------------------------------------------------
 * KAMAR TIDAK LAGI DIKOSONGKAN
 * ---------------------------------------------------------------------
 * Dulu kolom kamar_id sengaja dibiarkan null agar admin memutuskan
 * apakah penghuni tetap di kamar lama atau dipindahkan. Akibatnya
 * ringkasan dan kuitansi menyebut nomor kamar, tetapi Riwayat Pesanan
 * menampilkannya kosong -- dua tampilan yang saling bertentangan untuk
 * pesanan yang sama.
 *
 * Sekarang kamarnya diisi dari sewa yang diperpanjang. Perpanjangan
 * memang kelanjutan di kamar yang sama: penghuninya sudah tinggal di
 * sana dan kamarnya memang belum pernah dilepas.
 *
 * Konsekuensi yang perlu diingat: halaman Alokasi Kamar menolak
 * transaksi yang kamarnya sudah terisi, sehingga PEMINDAHAN KAMAR SAAT
 * PERPANJANGAN TIDAK BISA DILAKUKAN LEWAT ANTARMUKA. Ini pilihan yang
 * diambil sadar; bila suatu saat perlu, halaman itulah yang dilonggarkan.
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

    // Awal periode baru. Nilainya sama dengan tanggal berakhirnya sewa
    // lama -- lihat periodeBaru() di js/cust-profile.js -- sehingga
    // dipakai untuk dua hal sekaligus: awal hunian pada sewa baru, dan
    // saat berakhirnya sewa lama.
    const mulaiPeriode = new Date(dataPerpanjangan.checkin + "T14:00:00");

    const dokumen = {
      order_id: orderId,
      customer_username: sesi && sesi.username ? sesi.username : null,
      order_amount: Number(dataPembayaran.gross_amount || dataPerpanjangan.total || 0),
      payment_type: dataPembayaran.payment_type || "qris",
      transaction_status: dataPembayaran.transaction_status || "settlement",
      transaction_time: Timestamp.fromDate(sekarang),
      settlement_time: Timestamp.fromDate(sekarang),

      cabang_id: dataPerpanjangan.cabangId,
      // Kamar yang sedang ditempati, dibawa dari sewa yang diperpanjang
      kamar_id: dataPerpanjangan.kamarId || null,
      tipe_sewa: "bulanan",

      nama_penyewa: dataPerpanjangan.namaPenyewa || "-",
      nik_penyewa: dataPerpanjangan.nikPenyewa || "-",
      kontak_penyewa: dataPerpanjangan.kontakPenyewa || "",

      tanggal_checkin: Timestamp.fromDate(new Date(dataPerpanjangan.checkin + "T14:00:00")),
      tanggal_checkout: Timestamp.fromDate(new Date(dataPerpanjangan.checkout + "T12:00:00")),

      // Langsung dianggap sudah menempati kamar. Tidak ada check-in yang
      // benar-benar terjadi pada perpanjangan -- penghuninya tidak pergi
      // ke mana-mana. Menunggu admin menekan "check-in" hanya menahan
      // perpanjangan ini muncul di Data Penghuni, dan membuat cron
      // melewatkannya saat periode baru mendekati jatuh tempo (job
      // bulanan mensyaratkan status_checkin == "checked_in").
      status_checkin: "checked_in",
      tanggal_aktual_checkin: Timestamp.fromDate(mulaiPeriode),
      tanggal_aktual_checkout: null,

      status_perpanjangan: "belum",
      penghuni_tambahan: [],

      // Penanda bahwa ini kelanjutan dari sewa sebelumnya
      perpanjangan_dari: dataPerpanjangan.orderIdLama,
      catatan_perpanjangan: dataPerpanjangan.catatan || ""
    };

    await setDoc(doc(db, COL_TRANSAKSI, orderId), dokumen);

    // Menutup sewa lama. Dua hal sekaligus:
    //
    //   status_perpanjangan -> cron berhenti mengingatkan periode lama
    //   status_checkin      -> sewa lama tidak lagi terhitung berjalan
    //
    // Penutupan ini penting karena kamar_id kini terisi di KEDUA
    // dokumen. Tanpa itu, penghuni yang sama akan terhitung dua kali di
    // Data Penghuni dan di kartu statistik Dashboard -- keduanya
    // menghitung dari "lunas dan punya kamar".
    //
    // Kamarnya sengaja TIDAK dikembalikan menjadi tersedia: penghuninya
    // memang tidak ke mana-mana, hanya berpindah ke dokumen sewa baru.
    await updateDoc(doc(db, COL_TRANSAKSI, dataPerpanjangan.orderIdLama), {
      status_perpanjangan: "perpanjang",
      status_checkin: "checked_out",
      tanggal_aktual_checkout: Timestamp.fromDate(mulaiPeriode)
    });

    console.log("[Perpanjangan] Tersimpan:", orderId,
                "| kamar", dokumen.kamar_id || "(belum ada)",
                "| lanjutan dari", dataPerpanjangan.orderIdLama);

    tulisStatus("Perpanjangan berhasil dicatat untuk kamar yang sama.");

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
