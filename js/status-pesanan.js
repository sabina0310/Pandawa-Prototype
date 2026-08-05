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
