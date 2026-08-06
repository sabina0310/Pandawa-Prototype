/**
 * =====================================================================
 * PENERJEMAH STATUS PESANAN UNTUK PENYEWA
 * =====================================================================
 * Satu pesanan punya dua status yang tersimpan terpisah di Firestore:
 *   transaction_status -> hasil pembayaran dari Midtrans
 *   status_checkin     -> tahap hunian yang dicatat admin
 *
 * Penyewa tidak perlu tahu istilah teknis keduanya, jadi di sini
 * keduanya digabung menjadi SATU keterangan berbahasa Indonesia.
 *
 * Dipisah ke berkas sendiri supaya halaman Riwayat Pesanan dan halaman
 * Detail Pesanan memberi keterangan yang persis sama.
 * =====================================================================
 */

import { statusLunas, statusGagal, sisaHari, labelSisaHari } from "./admin-util.js";

export function tentukanStatus(t) {
  if (statusGagal(t.transaction_status)) {
    const teks = { deny: "Ditolak", expire: "Kadaluarsa", cancel: "Dibatalkan" };
    return {
      label: teks[t.transaction_status] || "Dibatalkan",
      kelas: "bg-surface-container-high text-on-surface-variant",
      ikon: "cancel"
    };
  }

  if (!statusLunas(t.transaction_status)) {
    return {
      label: "Menunggu Pembayaran",
      kelas: "bg-status-warning/10 text-status-warning border border-status-warning/20",
      ikon: "schedule"
    };
  }

  if (t.status_checkin === "checked_out") {
    return {
      label: "Selesai",
      kelas: "bg-surface-container-high text-on-surface-variant",
      ikon: "task_alt"
    };
  }

  if (t.status_checkin === "checked_in") {
    // Sewa yang tenggatnya sudah dekat ditandai khusus agar penyewa
    // tahu perlu segera memperpanjang.
    const sisa = sisaHari(t.tanggal_checkout);

    if (sisa !== null && sisa >= 0 && sisa <= 7) {
      return {
        label: "Jatuh Tempo " + labelSisaHari(t.tanggal_checkout),
        kelas: "bg-status-warning/10 text-status-warning border border-status-warning/20",
        ikon: "timer"
      };
    }

    return {
      label: "Sedang Berjalan",
      kelas: "bg-[#ECFDF3] text-status-available border border-status-available/20",
      ikon: "home"
    };
  }

  // Sudah lunas tetapi kamar belum ditentukan admin
  return {
    label: "Menunggu Konfirmasi",
    kelas: "bg-primary-container/10 text-primary-container border border-primary-container/20",
    ikon: "hourglass_top"
  };
}

// ---------------------------------------------------------------------
// STATUS PERPANJANGAN (khusus sewa bulanan)
// ---------------------------------------------------------------------

const LABEL_PERPANJANGAN = {
  belum: "Belum ditentukan",
  perpanjang: "Akan diperpanjang",
  tidak_lanjut: "Tidak dilanjutkan"
};

/** Mengubah nilai status_perpanjangan menjadi teks yang dibaca penyewa. */
export function labelPerpanjangan(nilai) {
  return LABEL_PERPANJANGAN[nilai] || "Belum ditentukan";
}

/** Menandakan penyewa sudah menyatakan berhenti menyewa. */
export function tidakDilanjutkan(transaksi) {
  return transaksi && transaksi.status_perpanjangan === "tidak_lanjut";
}

// ---------------------------------------------------------------------
// PESANAN HASIL PENGUJIAN (UAT)
// ---------------------------------------------------------------------
// api/uat-dummy-booking.js membuat salinan pesanan bertenggat H-7
// dengan order_id berawalan "UAT-", semata-mata agar notifikasi
// WhatsApp bisa diuji tanpa menunggu tanggal jatuh temponya tiba.
//
// Penanda di bawah dipakai dua halaman dengan cara berbeda:
//
//   Dashboard        -> pesanan uji TETAP ditampilkan, karena justru
//                       sewa itulah yang bertenggat H-7. Diberi
//                       keterangan lewat keteranganPesananUji().
//   Riwayat Pesanan  -> pesanan uji DISARING KELUAR, karena penyewa
//                       tidak pernah benar-benar membuatnya.
//
// Awalannya ditulis di sini agar sisi penyewa tidak perlu mengimpor
// berkas di folder api/ -- berkas itu memakai CommonJS dan hanya
// berjalan di server.
// ---------------------------------------------------------------------

/** Awalan order_id yang dibuat api/uat-dummy-booking.js. */
export const AWALAN_ORDER_UJI = "UAT-";

/** true bila pesanan ini data uji hasil generate otomatis. */
export function pesananUji(transaksi) {
  const orderId = transaksi && transaksi.order_id ? transaksi.order_id : "";
  return String(orderId).indexOf(AWALAN_ORDER_UJI) === 0;
}

/**
 * Keterangan yang ditempelkan pada kartu pesanan uji.
 *
 * @param {string} bentuk - "kartu" untuk Riwayat Pesanan (lebar penuh),
 *                          "ringkas" untuk Dashboard (ruangnya sempit)
 */
export function keteranganPesananUji(bentuk) {
  const pesan = bentuk === "ringkas"
    ? "Data pengujian: dibuat otomatis untuk menguji notifikasi WhatsApp " +
      "tenggat pemesanan H-7."
    : "Pesanan ini <strong>dibuat otomatis oleh sistem</strong> untuk menguji " +
      "pengiriman notifikasi WhatsApp tenggat pemesanan <strong>H-7</strong>. ";

  return '<div class="flex items-start gap-sm bg-surface-container-high ' +
    'border border-border-hairline rounded-lg px-base py-sm">' +
    '<span class="material-symbols-outlined text-[18px] text-ink-muted shrink-0 mt-xxs">' +
    "science</span>" +
    '<p class="font-body-sm text-body-sm text-ink-secondary">' + pesan + "</p>" +
    "</div>";
}
