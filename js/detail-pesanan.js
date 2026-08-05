/**
 * =====================================================================
 * HALAMAN DETAIL PESANAN (customer/detail-pesanan.html)
 * =====================================================================
 * Menampilkan seluruh isi satu dokumen transaksi_pemesanan, dibuka dari
 * tombol "Detail" pada halaman Riwayat Pesanan:
 *
 *   detail-pesanan.html?order_id=PP-0012
 *
 * Karena yang dibutuhkan hanya satu dokumen, halaman ini memakai getDoc
 * (bukan onSnapshot seperti halaman daftar), sesuai pola yang dipakai
 * halaman detail lain pada sistem ini.
 *
 * Pemeriksaan kepemilikan dikerjakan di sini: pesanan hanya ditampilkan
 * bila customer_username-nya sama dengan pengguna yang sedang login,
 * supaya nomor pesanan orang lain tidak bisa diintip lewat URL.
 * =====================================================================
 */

import { ambilDokumen, COL_TRANSAKSI, COL_CABANG } from "./admin-data.js";
import { ambilSesi } from "./customer-auth.js";
import { siapkanSidebar } from "./customer-sidebar.js";
import { tentukanStatus, labelPerpanjangan } from "./status-pesanan.js";
import { unduhKuitansi } from "./kuitansi.js";
import {
  formatTanggal, formatTanggalJam, formatRupiah, labelDurasi,
  labelMetodeBayar, labelStatusBayar, statusLunas, amankanTeks, tautanWa
} from "./admin-util.js";

// Halaman ini wajib login
siapkanSidebar(true);

const elIsi = document.getElementById("isiDetail");
const elRingkasan = document.getElementById("ringkasanDetail");

let transaksiAktif = null;
let cabangAktif = null;

// =====================================================================
// 1. POTONGAN TAMPILAN YANG DIPAKAI BERULANG
// =====================================================================

/** Satu pasang label kecil di atas dan isinya di bawah. */
function baris(label, nilai) {
  return '<div class="flex flex-col gap-xxs">' +
           '<span class="font-label-md text-label-md text-on-surface-variant">' + amankanTeks(label) + '</span>' +
           '<span class="font-body-md text-body-md text-on-surface">' + amankanTeks(nilai) + '</span>' +
         '</div>';
}

/** Kartu berjudul yang membungkus sekelompok keterangan. */
function kartu(judul, ikon, isi) {
  return '<section class="bg-surface-canvas rounded-lg border border-border-hairline shadow-sm overflow-hidden">' +
           '<div class="px-base py-sm border-b border-border-hairline flex items-center gap-xs">' +
             '<span class="material-symbols-outlined text-[18px] text-primary-container">' + ikon + '</span>' +
             '<h3 class="font-title-md text-title-md text-on-surface">' + amankanTeks(judul) + '</h3>' +
           '</div>' +
           '<div class="p-base">' + isi + '</div>' +
         '</section>';
}

function pesanKosong(ikon, judul, keterangan) {
  elIsi.innerHTML =
    '<div class="bg-surface-canvas rounded-lg border border-border-hairline shadow-sm p-xl flex flex-col items-center text-center gap-sm">' +
      '<span class="material-symbols-outlined text-[48px] text-on-surface-variant">' + ikon + '</span>' +
      '<h3 class="font-title-md text-title-md text-on-surface">' + amankanTeks(judul) + '</h3>' +
      '<p class="font-body-md text-body-md text-on-surface-variant max-w-md">' + amankanTeks(keterangan) + '</p>' +
      '<a href="history-order.html" class="mt-md inline-flex items-center gap-sm bg-primary-container text-on-primary ' +
        'font-button-md text-button-md px-lg py-md rounded-lg hover:brightness-110 transition-all no-underline">' +
        '<span class="material-symbols-outlined text-[20px]">receipt_long</span>Kembali ke Riwayat Pesanan</a>' +
    '</div>';
}

// =====================================================================
// 2. BAGIAN-BAGIAN ISI HALAMAN
// =====================================================================

function bagianKepala(t) {
  const namaCabang = cabangAktif ? cabangAktif.nama_cabang : "Cabang tidak ditemukan";
  const status = tentukanStatus(t);

  const foto = cabangAktif && cabangAktif.gambar_url
    ? '<img src="' + amankanTeks(cabangAktif.gambar_url) + '" alt="' + amankanTeks(namaCabang) + '" ' +
      'class="w-full h-40 md:h-56 object-cover">'
    : "";

  return '<section class="bg-surface-canvas rounded-lg border border-border-hairline shadow-sm overflow-hidden">' +
           foto +
           '<div class="p-base flex flex-wrap justify-between items-start gap-sm">' +
             '<div class="flex flex-col gap-xs">' +
               '<h3 class="font-display-lg text-display-lg text-on-surface">' + amankanTeks(namaCabang) + '</h3>' +
               '<p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-xs">' +
                 '<span class="material-symbols-outlined text-[16px]">location_on</span>' +
                 amankanTeks(cabangAktif ? cabangAktif.alamat : "-") + '</p>' +
               '<p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-xs">' +
                 '<span class="material-symbols-outlined text-[16px]">receipt_long</span>' +
                 amankanTeks(t.order_id) + '</p>' +
               '<p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-xs">' +
                 '<span class="material-symbols-outlined text-[16px]">schedule</span>' +
                 'Dipesan ' + formatTanggalJam(t.transaction_time) + '</p>' +
             '</div>' +
             '<span class="flex items-center gap-xs px-sm py-xs rounded-full font-badge text-badge ' + status.kelas + '">' +
               '<span class="material-symbols-outlined text-[14px]">' + status.ikon + '</span>' + status.label +
             '</span>' +
           '</div>' +
         '</section>';
}

function bagianSewa(t) {
  const bulanan = t.tipe_sewa === "bulanan";

  let isi = '<div class="grid grid-cols-2 md:grid-cols-4 gap-base">' +
    baris("Tipe Sewa", bulanan ? "Bulanan" : "Harian") +
    baris("Durasi", labelDurasi(t)) +
    baris("Check-in", formatTanggal(t.tanggal_checkin)) +
    baris(bulanan ? "Jatuh Tempo" : "Check-out", formatTanggal(t.tanggal_checkout)) +
    baris("Nomor Kamar", t.kamar_id ? t.kamar_id : "Ditentukan admin") +
    baris("Check-in Sebenarnya", t.tanggal_aktual_checkin
      ? formatTanggalJam(t.tanggal_aktual_checkin) : "Belum check-in") +
    baris("Check-out Sebenarnya", t.tanggal_aktual_checkout
      ? formatTanggalJam(t.tanggal_aktual_checkout) : "Belum check-out");

  // Status perpanjangan hanya berlaku pada sewa bulanan
  if (bulanan) isi += baris("Perpanjangan", labelPerpanjangan(t.status_perpanjangan));

  isi += '</div>';

  // Keterangan tambahan bila pesanan ini kelanjutan dari sewa sebelumnya
  if (t.perpanjangan_dari) {
    isi += '<div class="mt-base p-sm rounded-lg bg-primary-container/5 border border-primary-container/20 ' +
             'flex items-start gap-xs">' +
             '<span class="material-symbols-outlined text-[18px] text-primary-container">history</span>' +
             '<p class="font-body-sm text-body-sm text-on-surface-variant">Perpanjangan dari pesanan ' +
               '<a class="text-primary-container no-underline hover:underline" ' +
                  'href="detail-pesanan.html?order_id=' + encodeURIComponent(t.perpanjangan_dari) + '">' +
                  amankanTeks(t.perpanjangan_dari) + '</a>' +
               (t.catatan_perpanjangan
                  ? '. Catatan: ' + amankanTeks(t.catatan_perpanjangan)
                  : '') + '</p>' +
           '</div>';
  }

  return kartu("Informasi Sewa", "calendar_month", isi);
}

function bagianPenyewa(t) {
  const nomor = tautanWa(t.kontak_penyewa);

  let isi = '<div class="grid grid-cols-2 md:grid-cols-3 gap-base">' +
    baris("Nama Penyewa", t.nama_penyewa || "-") +
    baris("NIK", t.nik_penyewa || "-") +
    '<div class="flex flex-col gap-xxs">' +
      '<span class="font-label-md text-label-md text-on-surface-variant">Kontak WhatsApp</span>' +
      (nomor === "#"
        ? '<span class="font-body-md text-body-md text-on-surface">-</span>'
        : '<a class="font-body-md text-body-md text-primary-container no-underline hover:underline" ' +
          'href="' + nomor + '" target="_blank" rel="noopener">' + amankanTeks(t.kontak_penyewa) + '</a>') +
    '</div>' +
  '</div>';

  // Penghuni tambahan hanya diisi pada sewa bulanan
  const penghuni = Array.isArray(t.penghuni_tambahan) ? t.penghuni_tambahan : [];

  if (penghuni.length > 0) {
    isi += '<div class="mt-base pt-base border-t border-border-hairline">' +
             '<p class="font-label-md text-label-md text-on-surface-variant mb-sm">Penghuni Tambahan (' +
               penghuni.length + ' orang)</p>' +
             '<div class="flex flex-col gap-sm">' +
             penghuni.map(function (p, i) {
               return '<div class="p-sm rounded-lg bg-surface-soft border border-border-hairline ' +
                        'grid grid-cols-2 md:grid-cols-4 gap-sm">' +
                        baris("Nama", p.nama || "-") +
                        baris("NIK", p.nik || "-") +
                        baris("Hubungan", p.hubungan || "-") +
                        baris("WhatsApp", p.whatsapp || "-") +
                      '</div>';
             }).join("") +
             '</div>' +
           '</div>';
  }

  return kartu("Data Penyewa", "person", isi);
}

function bagianPembayaran(t) {
  const layanan = cabangAktif ? Number(cabangAktif.biaya_layanan || 0) : 0;
  const total = Number(t.order_amount || 0);
  const sewa = total - layanan;

  let rincian = "";

  // Bila pemecahannya tidak masuk akal (misalnya biaya layanan cabang
  // sudah berubah), cukup tampilkan totalnya saja agar tidak keliru.
  if (layanan > 0 && sewa > 0) {
    rincian =
      '<div class="flex justify-between items-center py-xs">' +
        '<span class="font-body-md text-body-md text-on-surface-variant">Sewa Kamar (' +
          amankanTeks(labelDurasi(t)) + ')</span>' +
        '<span class="font-body-md text-body-md text-on-surface">' + formatRupiah(sewa) + '</span>' +
      '</div>' +
      '<div class="flex justify-between items-center py-xs">' +
        '<span class="font-body-md text-body-md text-on-surface-variant">Biaya Layanan</span>' +
        '<span class="font-body-md text-body-md text-on-surface">' + formatRupiah(layanan) + '</span>' +
      '</div>';
  }

  const isi =
    '<div class="grid grid-cols-2 md:grid-cols-3 gap-base mb-base">' +
      baris("Metode Pembayaran", labelMetodeBayar(t.payment_type)) +
      baris("Status Pembayaran", labelStatusBayar(t.transaction_status)) +
      baris("Waktu Pembayaran", t.settlement_time
        ? formatTanggalJam(t.settlement_time) : "Belum dibayar") +
    '</div>' +
    '<div class="pt-base border-t border-border-hairline">' +
      rincian +
      '<div class="flex justify-between items-center pt-sm mt-sm border-t border-border-hairline border-dashed">' +
        '<span class="font-title-md text-title-md text-on-surface">Total Pembayaran</span>' +
        '<span class="font-stat-display text-stat-display text-primary-container">' +
          formatRupiah(total) + '</span>' +
      '</div>' +
    '</div>';

  return kartu("Rincian Pembayaran", "payments", isi);
}

function bagianTombol(t) {
  // Kuitansi hanyalah bukti pembayaran, jadi baru masuk akal
  // ditawarkan setelah uangnya benar-benar diterima.
  const tombolKuitansi = statusLunas(t.transaction_status)
    ? '<button id="unduhKuitansiBtn" class="flex-1 bg-primary-container text-on-primary font-button-md ' +
      'text-button-md py-md px-lg rounded-lg hover:brightness-110 transition-all shadow-sm ' +
      'flex justify-center items-center gap-xs">' +
      '<span class="material-symbols-outlined text-[18px]">download</span>Unduh Kuitansi</button>'
    : '<p class="flex-1 font-body-sm text-body-sm text-on-surface-variant text-center py-md">' +
      'Kuitansi tersedia setelah pembayaran diterima.</p>';

  return '<div class="flex flex-col sm:flex-row gap-sm">' +
           tombolKuitansi +
           '<a href="history-order.html" class="flex-1 bg-surface-canvas text-on-surface font-button-md ' +
             'text-button-md py-md px-lg rounded-lg border border-border-strong hover:bg-surface-container-high ' +
             'transition-colors flex justify-center items-center gap-xs no-underline">' +
             '<span class="material-symbols-outlined text-[18px]">arrow_back</span>Kembali</a>' +
         '</div>';
}

// =====================================================================
// 3. PROSES UTAMA
// =====================================================================
async function muatDetail() {
  const sesi = ambilSesi();
  if (!sesi) return;   // siapkanSidebar sudah mengarahkan ke halaman masuk

  const orderId = new URLSearchParams(window.location.search).get("order_id");

  if (!orderId) {
    elRingkasan.textContent = "Nomor pesanan tidak disebutkan.";
    pesanKosong("help", "Pesanan tidak disebutkan",
      "Alamat halaman ini harus menyertakan nomor pesanan. Silakan buka kembali lewat tombol Detail pada Riwayat Pesanan.");
    return;
  }

  try {
    const transaksi = await ambilDokumen(COL_TRANSAKSI, orderId);

    if (!transaksi) {
      elRingkasan.textContent = "Pesanan tidak ditemukan.";
      pesanKosong("search_off", "Pesanan tidak ditemukan",
        "Pesanan dengan nomor " + orderId + " tidak ada di database.");
      return;
    }

    // Pesanan milik orang lain tidak boleh terbuka lewat tebak-tebakan URL
    if (transaksi.customer_username !== sesi.username) {
      elRingkasan.textContent = "Pesanan ini bukan milik akun Anda.";
      pesanKosong("lock", "Tidak dapat menampilkan pesanan ini",
        "Nomor pesanan tersebut terdaftar atas akun lain.");
      return;
    }

    cabangAktif = await ambilDokumen(COL_CABANG, transaksi.cabang_id);
    transaksiAktif = transaksi;

    elRingkasan.textContent = "Pesanan " + transaksi.order_id + " atas nama " + sesi.fullName + ".";

    elIsi.innerHTML =
      bagianKepala(transaksi) +
      bagianSewa(transaksi) +
      bagianPenyewa(transaksi) +
      bagianPembayaran(transaksi) +
      bagianTombol(transaksi);

    const tombol = document.getElementById("unduhKuitansiBtn");
    if (tombol) {
      tombol.addEventListener("click", function () {
        unduhKuitansi(transaksiAktif, cabangAktif, tombol);
      });
    }

  } catch (err) {
    console.error("Gagal memuat detail pesanan:", err);

    elRingkasan.textContent = "Gagal memuat data.";
    pesanKosong("cloud_off", "Gagal memuat detail pesanan",
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : "Tidak dapat mengambil data dari server. Periksa koneksi internet Anda, lalu muat ulang halaman.");
  }
}

muatDetail();
