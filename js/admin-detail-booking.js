/**
 * =====================================================================
 * HALAMAN DETAIL BOOKING (admin & super admin)
 * =====================================================================
 * Menampilkan satu transaksi pemesanan secara lengkap.
 *
 * Berbeda dengan halaman daftar, halaman ini memakai getDoc (bukan
 * onSnapshot) karena hanya membaca SATU dokumen. ID dokumennya diambil
 * dari alamat halaman, contoh:
 *
 *     detail-booking.html?id=PP-1754300000000-07
 *
 * Isi halaman ini juga menjadi sumber data kuitansi PDF, jadi begitu
 * teksnya terisi dari Firestore, kuitansinya ikut benar dengan
 * sendirinya tanpa kode tambahan.
 * =====================================================================
 */

import { ambilDokumen, COL_CABANG, COL_KAMAR, COL_TRANSAKSI } from "./admin-data.js";

import {
  formatTanggal,
  formatTanggalJam,
  formatRupiah,
  labelMetodeBayar,
  labelStatusBayar,
  labelDurasi,
  hitungDurasi,
  statusLunas,
  statusGagal,
  amankanTeks,
  tautanWa,
  tampilkanError
} from "./admin-util.js";

/** Menulis teks ke sebuah elemen bila elemennya memang ada. */
function isi(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

// =====================================================================
// MENAMPILKAN DATA
// =====================================================================
function tampilkanTransaksi(transaksi, cabang, kamar) {
  const namaCabang = cabang ? cabang.nama_cabang : "-";

  // --- Judul halaman ---
  isi("bookingCode", "Detail Pemesanan - " + transaksi.order_id);

  // --- Badge status di kartu paling atas ---
  const elBadgeBayar = document.getElementById("badgeStatusBayar");
  if (elBadgeBayar) {
    elBadgeBayar.textContent = labelStatusBayar(transaksi.transaction_status);
    elBadgeBayar.className = statusLunas(transaksi.transaction_status)
      ? "px-sm py-xs bg-status-available/10 text-status-available font-badge text-badge rounded-full uppercase"
      : statusGagal(transaksi.transaction_status)
        ? "px-sm py-xs bg-error/10 text-error font-badge text-badge rounded-full uppercase"
        : "px-sm py-xs bg-status-warning/10 text-status-warning font-badge text-badge rounded-full uppercase";
  }

  const elBadgeAlokasi = document.getElementById("badgeStatusAlokasi");
  if (elBadgeAlokasi) {
    const teksAlokasi = {
      checked_in: "SEDANG MENGHUNI",
      checked_out: "SUDAH CHECK-OUT"
    }[transaksi.status_checkin] || (kamar ? "DIKONFIRMASI" : "MENUNGGU ALOKASI");
    elBadgeAlokasi.textContent = teksAlokasi;
  }

  // --- Kartu alokasi kamar ---
  if (kamar) {
    isi("allocationBranch", "Teralokasi di " + namaCabang);
    isi("allocationRoom", "Kamar " + kamar.nomor_kamar);
  } else {
    isi("allocationBranch", "Belum dialokasikan");
    isi("allocationRoom", "Kamar belum ditentukan untuk cabang " + namaCabang);
  }

  // --- Informasi penyewa ---
  isi("tenantName", transaksi.nama_penyewa);
  isi("tenantNik", transaksi.nik_penyewa || "-");
  isi("tenantWhatsapp", transaksi.kontak_penyewa);

  const elWa = document.getElementById("waButton");
  if (elWa) elWa.href = tautanWa(transaksi.kontak_penyewa);

  // --- Rincian properti & jadwal ---
  isi("propertyBranch", namaCabang);
  isi("propertyType", "Sewa " + String(transaksi.tipe_sewa || "").toUpperCase());
  isi("rentSchedule", formatTanggal(transaksi.tanggal_checkin) + " - " + formatTanggal(transaksi.tanggal_checkout));
  isi("rentDuration", "Durasi: " + labelDurasi(transaksi));

  // --- Ringkasan tagihan ---
  // Harga satuan diambil dari data cabang, lalu dikalikan lama sewa.
  // Hasilnya seharusnya sama dengan order_amount yang tersimpan.
  const durasi = hitungDurasi(transaksi);
  const hargaSatuan = cabang
    ? (transaksi.tipe_sewa === "bulanan" ? cabang.harga_bulanan : cabang.harga_harian)
    : 0;

  isi("billHargaSewa", formatRupiah(hargaSatuan * durasi));
  isi("billLayanan", formatRupiah(cabang ? cabang.biaya_layanan : 0));
  isi("billTotal", formatRupiah(transaksi.order_amount));

  // --- Informasi pembayaran ---
  isi("paymentMethod", labelMetodeBayar(transaksi.payment_type));
  isi("transactionTime", formatTanggalJam(transaksi.transaction_time));

  if (statusLunas(transaksi.transaction_status)) {
    isi("paymentStatusTitle", "Berhasil / Lunas");
    isi("paymentStatusNote", "Dana telah diterima");
  } else if (statusGagal(transaksi.transaction_status)) {
    isi("paymentStatusTitle", labelStatusBayar(transaksi.transaction_status));
    isi("paymentStatusNote", "Pembayaran tidak diselesaikan");
  } else {
    isi("paymentStatusTitle", "Menunggu Pembayaran");
    isi("paymentStatusNote", "Dana belum diterima");
  }
}

/** Menampilkan pesan bila transaksi tidak ditemukan atau gagal dimuat. */
function tampilkanPesan(judul, keterangan) {
  isi("bookingCode", judul);

  const elKeterangan = document.querySelector("#bookingCode + p");
  if (elKeterangan) elKeterangan.textContent = keterangan;

  const isiHalaman = document.getElementById("detailContent");
  if (isiHalaman) {
    isiHalaman.innerHTML =
      '<div class="bg-surface-canvas rounded-xl p-lg border border-border-hairline text-center text-ink-muted">' +
      amankanTeks(keterangan) + "</div>";
  }
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  const orderId = new URLSearchParams(window.location.search).get("id");

  if (!orderId) {
    tampilkanPesan(
      "Transaksi tidak dipilih",
      "Alamat halaman ini harus menyertakan ID transaksi, contoh: detail-booking.html?id=PP-123456"
    );
    return;
  }

  isi("bookingCode", "Memuat data...");

  try {
    const transaksi = await ambilDokumen(COL_TRANSAKSI, orderId);

    if (!transaksi) {
      tampilkanPesan(
        "Transaksi tidak ditemukan",
        'Tidak ada transaksi dengan ID "' + orderId + '" di database.'
      );
      return;
    }

    // Cabang dan kamar diambil menyusul karena ID-nya baru diketahui
    // setelah dokumen transaksi berhasil dibaca.
    const cabang = transaksi.cabang_id ? await ambilDokumen(COL_CABANG, transaksi.cabang_id) : null;
    const kamar = transaksi.kamar_id ? await ambilDokumen(COL_KAMAR, transaksi.kamar_id) : null;

    tampilkanTransaksi(transaksi, cabang, kamar);
  } catch (err) {
    tampilkanError(err, function (pesan) {
      tampilkanPesan("Gagal memuat transaksi", pesan);
    });
  }
}

mulai();
