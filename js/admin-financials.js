/**
 * =====================================================================
 * HALAMAN LAPORAN TRANSAKSI & KEUANGAN (super admin)
 * =====================================================================
 * Menampilkan seluruh transaksi beserta ringkasan pendapatan, lengkap
 * dengan penyaring cabang, tipe sewa, status, dan kotak pencarian.
 *
 * Tombol "Export Excel (CSV)" mengunduh persis baris yang sedang
 * tampil di layar, jadi hasil unduhan selalu mengikuti penyaring
 * yang sedang aktif.
 * =====================================================================
 */

import {
  ambilPeta,
  pantauTransaksi,
  mendekatiJatuhTempo,
  COL_CABANG,
  COL_KAMAR
} from "./admin-data.js";

import {
  formatTanggal,
  formatTanggalJam,
  formatRupiah,
  labelMetodeBayar,
  labelStatusBayar,
  labelDurasi,
  keDate,
  statusLunas,
  statusGagal,
  amankanTeks,
  pesanTabel,
  tampilkanError
} from "./admin-util.js";

const JUMLAH_KOLOM = 9;

// --- Elemen halaman -------------------------------------------------
const elTabel = document.getElementById("transactionsTableBody");
const elFilterCabang = document.getElementById("filterCabang");
const elFilterTipe = document.getElementById("filterTipeSewa");
const elFilterStatus = document.getElementById("filterStatus");
const elFilterPeriodeMulai = document.getElementById("filterPeriodeMulai");
const elFilterPeriodeSelesai = document.getElementById("filterPeriodeSelesai");
const elCari = document.getElementById("searchTransaksi");
const elTombolExport = document.getElementById("exportExcelBtn");

const elTotalPendapatan = document.getElementById("statTotalPendapatan");
const elPerubahanBulan = document.getElementById("statPerubahanBulan");
const elTransaksiLunas = document.getElementById("statTransaksiLunas");
const elMenungguBayar = document.getElementById("statMenungguBayar");
const elJumlahPending = document.getElementById("statJumlahPending");
const elNilaiJatuhTempo = document.getElementById("statNilaiJatuhTempo");
const elJumlahJatuhTempo = document.getElementById("statJumlahJatuhTempo");

// --- Penyimpanan data terakhir --------------------------------------
let petaCabang = {};
let daftarTransaksi = [];

// =====================================================================
// PENYARINGAN
// =====================================================================

/** true bila tanggal check-in transaksi berada di rentang "Periode" yang dipilih. */
function dalamPeriode(t) {
  const dari = elFilterPeriodeMulai.value;
  const sampai = elFilterPeriodeSelesai.value;
  if (!dari && !sampai) return true;

  const checkin = keDate(t.tanggal_checkin);
  if (!checkin) return false;

  if (dari && checkin < new Date(dari + "T00:00:00")) return false;
  if (sampai && checkin > new Date(sampai + "T23:59:59")) return false;

  return true;
}

function transaksiTampil() {
  const kataCari = elCari.value.trim().toLowerCase();

  return daftarTransaksi.filter(function (t) {
    if (elFilterCabang.value !== "semua" && t.cabang_id !== elFilterCabang.value) return false;
    if (elFilterTipe.value !== "semua" && t.tipe_sewa !== elFilterTipe.value) return false;

    if (elFilterStatus.value === "lunas" && !statusLunas(t.transaction_status)) return false;
    if (elFilterStatus.value === "pending" && t.transaction_status !== "pending") return false;
    if (elFilterStatus.value === "gagal" && !statusGagal(t.transaction_status)) return false;

    if (!dalamPeriode(t)) return false;

    if (kataCari) {
      const gabungan = (t.order_id + " " + t.nama_penyewa + " " + t.kontak_penyewa).toLowerCase();
      if (gabungan.indexOf(kataCari) === -1) return false;
    }

    return true;
  });
}

// =====================================================================
// KARTU RINGKASAN
// =====================================================================
function gambarKartuRingkasan() {
  const daftar = transaksiTampil();

  const lunas = daftar.filter(function (t) { return statusLunas(t.transaction_status); });
  const pending = daftar.filter(function (t) { return t.transaction_status === "pending"; });
  const jatuhTempo = daftar.filter(mendekatiJatuhTempo);

  function jumlahkan(kumpulan) {
    return kumpulan.reduce(function (total, t) { return total + Number(t.order_amount || 0); }, 0);
  }

  elTotalPendapatan.textContent = formatRupiah(jumlahkan(lunas));
  elTransaksiLunas.textContent = lunas.length;
  elMenungguBayar.textContent = formatRupiah(jumlahkan(pending));
  elJumlahPending.textContent = pending.length + " Transaksi Pending";

  elNilaiJatuhTempo.textContent = formatRupiah(jumlahkan(jatuhTempo));
  elJumlahJatuhTempo.textContent = jatuhTempo.length + " Penghuni Perlu Perpanjangan";

  gambarPerubahanBulan(lunas);
}

/**
 * Membandingkan pendapatan bulan ini dengan bulan sebelumnya.
 * Perbandingan memakai settlement_time, yaitu saat uang benar-benar
 * diterima, bukan saat pesanan dibuat.
 */
function gambarPerubahanBulan(daftarLunas) {
  const sekarang = new Date();
  const bulanIni = sekarang.getMonth();
  const tahunIni = sekarang.getFullYear();

  const bulanLalu = bulanIni === 0 ? 11 : bulanIni - 1;
  const tahunBulanLalu = bulanIni === 0 ? tahunIni - 1 : tahunIni;

  let totalBulanIni = 0;
  let totalBulanLalu = 0;

  daftarLunas.forEach(function (t) {
    const waktu = keDate(t.settlement_time);
    if (!waktu) return;

    if (waktu.getMonth() === bulanIni && waktu.getFullYear() === tahunIni) {
      totalBulanIni += Number(t.order_amount || 0);
    } else if (waktu.getMonth() === bulanLalu && waktu.getFullYear() === tahunBulanLalu) {
      totalBulanLalu += Number(t.order_amount || 0);
    }
  });

  if (totalBulanLalu === 0) {
    elPerubahanBulan.textContent = "Belum ada pembanding bulan lalu";
    elPerubahanBulan.className = "text-ink-muted text-xs mt-sm";
    return;
  }

  const persen = Math.round(((totalBulanIni - totalBulanLalu) / totalBulanLalu) * 100);
  const naik = persen >= 0;

  elPerubahanBulan.innerHTML =
    '<span class="material-symbols-outlined text-[16px]">' +
    (naik ? "trending_up" : "trending_down") + "</span>" +
    (naik ? "+" : "") + persen + "% dari bulan lalu";

  elPerubahanBulan.className = naik
    ? "text-status-available text-xs font-bold flex items-center gap-xxs mt-sm"
    : "text-error text-xs font-bold flex items-center gap-xxs mt-sm";
}

// =====================================================================
// SATU BARIS TABEL
// =====================================================================
function kelasBadgeStatus(kode) {
  if (statusLunas(kode)) return "bg-[#ECFDF3] text-status-available";
  if (kode === "pending") return "bg-[#FEF0C7] text-status-warning";
  return "bg-error-container text-error";
}

function barisHtml(t) {
  const kelasKategori = t.tipe_sewa === "bulanan"
    ? "bg-[#EFF4FF] text-primary"
    : "bg-surface-variant text-ink-secondary";

  const unit = t.nomor_kamar ? "Kamar " + t.nomor_kamar : "Belum dialokasikan";

  return '' +
    '<tr class="hover:bg-surface-soft transition-colors">' +
    '<td class="px-base py-lg">' +
    '<div class="font-title-md text-ink-primary">' + amankanTeks(t.order_id) + '</div>' +
    '<div class="text-xs text-ink-muted">' + formatTanggalJam(t.transaction_time) + '</div>' +
    '</td>' +
    '<td class="px-base py-lg">' +
    '<div class="font-title-md text-ink-primary">' + amankanTeks(t.nama_penyewa) + '</div>' +
    '<div class="text-xs text-ink-muted">' + amankanTeks(t.kontak_penyewa) + '</div>' +
    '</td>' +
    '<td class="px-base py-lg">' +
    '<div class="text-body-sm text-ink-primary">' + amankanTeks(t.nama_cabang) + '</div>' +
    '<div class="text-xs text-ink-muted">' + amankanTeks(unit) + '</div>' +
    '</td>' +
    '<td class="px-base py-lg"><span class="text-[11px] font-bold ' + kelasKategori + ' px-3 py-1 rounded-full tracking-wide">' +
    amankanTeks(String(t.tipe_sewa || "").toUpperCase()) + '</span></td>' +
    '<td class="px-base py-lg text-body-sm text-ink-secondary">' +
    formatTanggal(t.tanggal_checkin) + " - " + formatTanggal(t.tanggal_checkout) +
    '<div class="text-xs text-ink-muted">' + labelDurasi(t) + '</div>' +
    '</td>' +
    '<td class="px-base py-lg text-body-sm text-ink-secondary">' + amankanTeks(labelMetodeBayar(t.payment_type)) + '</td>' +
    '<td class="px-base py-lg font-bold text-ink-primary">' + formatRupiah(t.order_amount) + '</td>' +
    '<td class="px-base py-lg"><span class="text-[11px] font-bold ' + kelasBadgeStatus(t.transaction_status) + ' px-3 py-1 rounded-full">' +
    amankanTeks(labelStatusBayar(t.transaction_status)) + '</span></td>' +
    '<td class="px-base py-lg text-right">' +
    '<a href="detail-booking.html?id=' + encodeURIComponent(t.order_id) + '" aria-label="Lihat detail" ' +
    'class="text-ink-muted hover:text-primary inline-flex"><span class="material-symbols-outlined">visibility</span></a>' +
    '</td>' +
    '</tr>';
}

// =====================================================================
// MENGGAMBAR TABEL
// =====================================================================
function gambarTabel() {
  const daftar = transaksiTampil();

  if (daftar.length === 0) {
    pesanTabel(elTabel, "Tidak ada transaksi yang cocok dengan penyaring ini.", JUMLAH_KOLOM);
    return;
  }

  elTabel.innerHTML = daftar.map(barisHtml).join("");
}

function gambarSemua() {
  gambarKartuRingkasan();
  gambarTabel();
}

// =====================================================================
// EXPORT CSV
// =====================================================================
function amankanCsv(nilai) {
  const teks = String(nilai === null || nilai === undefined ? "" : nilai);
  if (teks.indexOf(",") !== -1 || teks.indexOf('"') !== -1 || teks.indexOf("\n") !== -1) {
    return '"' + teks.replace(/"/g, '""') + '"';
  }
  return teks;
}

function exportCsv() {
  const daftar = transaksiTampil();

  if (daftar.length === 0) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  const judul = ["ID Transaksi", "Waktu", "Penyewa", "Kontak", "Cabang", "Kamar",
                 "Kategori", "Check-in", "Check-out", "Durasi", "Metode", "Total", "Status"];

  const baris = daftar.map(function (t) {
    return [
      t.order_id,
      formatTanggalJam(t.transaction_time),
      t.nama_penyewa,
      t.kontak_penyewa,
      t.nama_cabang,
      t.nomor_kamar || "-",
      String(t.tipe_sewa || "").toUpperCase(),
      formatTanggal(t.tanggal_checkin),
      formatTanggal(t.tanggal_checkout),
      labelDurasi(t),
      labelMetodeBayar(t.payment_type),
      formatRupiah(t.order_amount),
      labelStatusBayar(t.transaction_status)
    ];
  });

  const isiCsv = [judul].concat(baris).map(function (kolom) {
    return kolom.map(amankanCsv).join(",");
  }).join("\r\n");

  // Tanda "﻿" di depan agar Excel membaca huruf beraksen dengan benar
  const blob = new Blob(["﻿" + isiCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = "Laporan-Transaksi-Pilar-Pandawa.csv";
  document.body.appendChild(tautan);
  tautan.click();
  document.body.removeChild(tautan);
  URL.revokeObjectURL(url);
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  pesanTabel(elTabel, "Memuat data...", JUMLAH_KOLOM);

  [elFilterCabang, elFilterTipe, elFilterStatus, elFilterPeriodeMulai, elFilterPeriodeSelesai].forEach(function (el) {
    el.addEventListener("change", gambarSemua);
  });
  elCari.addEventListener("input", gambarSemua);
  elTombolExport.addEventListener("click", exportCsv);

  try {
    petaCabang = await ambilPeta(COL_CABANG);
    const petaKamar = await ambilPeta(COL_KAMAR);

    elFilterCabang.innerHTML =
      '<option value="semua">Semua</option>' +
      Object.keys(petaCabang).map(function (id) {
        return '<option value="' + amankanTeks(id) + '">' +
               amankanTeks(petaCabang[id].nama_cabang) + "</option>";
      }).join("");

    pantauTransaksi(petaCabang, petaKamar, function (daftar) {
      daftarTransaksi = daftar;
      gambarSemua();
    }, gagalMuat);
  } catch (err) {
    gagalMuat(err);
  }
}

function gagalMuat(err) {
  tampilkanError(err, function (pesan) {
    pesanTabel(elTabel, pesan, JUMLAH_KOLOM, "error");
  });
}

mulai();
