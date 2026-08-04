/**
 * =====================================================================
 * HALAMAN CHECK-IN (admin & super admin)
 * =====================================================================
 * Menampilkan jadwal kedatangan penghuni dan memproses check-in.
 *
 * Tiga tab yang tersedia:
 *   - Jadwal Hari Ini      : check-in dijadwalkan hari ini
 *   - Check-in Mendatang   : check-in dijadwalkan setelah hari ini
 *   - Riwayat Serah Terima : yang sudah check-in atau sudah check-out
 *
 * Catatan penting soal alur:
 * Dua tab pertama hanya menampilkan transaksi yang KAMARNYA SUDAH
 * DIALOKASIKAN. Penghuni tanpa kamar belum bisa di-check-in karena
 * tidak ada kunci yang bisa diserahkan. Jadi bila kedua tab tampak
 * kosong, artinya semua pemesanan baru memang belum diberi kamar --
 * silakan alokasikan dulu lewat halaman Alokasi Kamar.
 *
 * Saat check-in dikonfirmasi, transaksi diperbarui memakai updateDoc:
 * status_checkin menjadi "checked_in" dan waktu kedatangan dicatat.
 * =====================================================================
 */

import {
  ambilPeta,
  pantauTransaksi,
  simpanCheckin,
  sedangMenghuni,
  COL_CABANG,
  COL_KAMAR
} from "./admin-data.js";

import {
  formatTanggal,
  formatJam,
  formatTanggalJam,
  tanggalHariIni,
  awalHari,
  statusLunas,
  inisial,
  amankanTeks,
  tautanWa,
  pesanTabel,
  tampilkanError
} from "./admin-util.js";

const JUMLAH_KOLOM = 5;

// --- Elemen halaman -------------------------------------------------
const elTabel = document.getElementById("checkinsTableBody");
const elFilterCabang = document.getElementById("filterCabang");
const elStatHariIni = document.getElementById("statCheckinHariIni");
const elStatPenghuniAktif = document.getElementById("statPenghuniAktif");
const tombolTab = document.querySelectorAll(".checkin-tab");

// --- Modal ----------------------------------------------------------
const modal = document.getElementById("checkinModal");
const modalInitials = document.getElementById("checkinModalInitials");
const modalName = document.getElementById("checkinModalName");
const modalBookingId = document.getElementById("checkinModalBookingId");
const modalRoom = document.getElementById("checkinModalRoom");
const modalClose = document.getElementById("checkinModalClose");
const modalCancel = document.getElementById("checkinModalCancel");
const modalConfirm = document.getElementById("checkinModalConfirm");

const successModal = document.getElementById("checkinSuccessModal");
const successName = document.getElementById("checkinSuccessName");
const successBookingId = document.getElementById("checkinSuccessBookingId");
const successRoom = document.getElementById("checkinSuccessRoom");
const successBranch = document.getElementById("checkinSuccessBranch");
const successTime = document.getElementById("checkinSuccessTime");
const successDone = document.getElementById("checkinSuccessDone");

// --- Penyimpanan data terakhir --------------------------------------
let petaCabang = {};
let daftarTransaksi = [];
let tabAktif = "hari-ini";
let cabangTerpilih = "semua";
let transaksiDiproses = null;

// =====================================================================
// PENYARINGAN
// =====================================================================

/** Transaksi yang siap di-check-in: sudah lunas, sudah punya kamar. */
function siapCheckin(t) {
  return statusLunas(t.transaction_status) &&
         t.kamar_id &&
         t.status_checkin === "belum_checkin";
}

function transaksiTampil() {
  return daftarTransaksi.filter(function (t) {
    if (cabangTerpilih !== "semua" && t.cabang_id !== cabangTerpilih) return false;

    if (tabAktif === "hari-ini") {
      return siapCheckin(t) && tanggalHariIni(t.tanggal_checkin);
    }

    if (tabAktif === "mendatang") {
      const jadwal = awalHari(t.tanggal_checkin);
      return siapCheckin(t) && jadwal && jadwal > awalHari(new Date());
    }

    // Riwayat serah terima
    return t.status_checkin === "checked_in" || t.status_checkin === "checked_out";
  });
}

// =====================================================================
// KARTU RINGKASAN
// =====================================================================
function gambarKartuRingkasan() {
  const transaksiCabang = daftarTransaksi.filter(function (t) {
    return cabangTerpilih === "semua" || t.cabang_id === cabangTerpilih;
  });

  elStatHariIni.textContent = transaksiCabang.filter(function (t) {
    return siapCheckin(t) && tanggalHariIni(t.tanggal_checkin);
  }).length;

  elStatPenghuniAktif.textContent = transaksiCabang.filter(sedangMenghuni).length;
}

// =====================================================================
// SATU BARIS TABEL
// =====================================================================
function badgeStatusHtml(t) {
  if (t.status_checkin === "checked_in") {
    return '<span class="inline-flex items-center bg-status-available/10 text-status-available font-badge text-badge px-sm py-xxs rounded-full border border-status-available/20">' +
           "Sudah Check-in / Kunci Diserahkan</span>";
  }
  if (t.status_checkin === "checked_out") {
    return '<span class="inline-flex items-center bg-surface-variant text-ink-secondary font-badge text-badge px-sm py-xxs rounded-full border border-border-strong">' +
           "Sudah Check-out</span>";
  }
  return '<span class="inline-flex items-center bg-primary-container/10 text-primary-container font-badge text-badge px-sm py-xxs rounded-full border border-primary-container/20">' +
         "Siap Check-in</span>";
}

function tombolAksiHtml(t) {
  if (t.status_checkin === "belum_checkin") {
    return '<button class="checkin-trigger bg-primary-container text-white font-button-md text-button-md px-md py-sm rounded-lg hover:bg-surface-tint transition-colors text-sm" ' +
           'data-order-id="' + amankanTeks(t.order_id) + '">Proses Check-in</button>';
  }

  const teks = t.status_checkin === "checked_in" ? "Sudah Check-in" : "Selesai";
  return '<button disabled class="text-ink-secondary font-button-md text-button-md px-md py-sm rounded-lg bg-surface-variant text-sm border border-transparent cursor-default">' +
         teks + "</button>";
}

function barisHtml(t) {
  // Waktu yang ditampilkan: kalau sudah check-in pakai waktu kedatangan
  // sebenarnya, kalau belum pakai jadwal yang direncanakan.
  const waktu = t.tanggal_aktual_checkin || t.tanggal_checkin;

  return '' +
    '<tr class="hover:bg-surface-soft/50 transition-colors">' +
    '<td class="py-md px-base">' +
    '<div class="flex items-center gap-md">' +
    '<div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-title-md text-title-md text-primary-container shrink-0">' +
    amankanTeks(inisial(t.nama_penyewa)) + '</div>' +
    '<div>' +
    '<div class="font-title-md text-title-md text-ink-primary">' + amankanTeks(t.nama_penyewa) + '</div>' +
    '<div class="flex items-center gap-xs mt-xs">' +
    '<span class="font-body-sm text-body-sm text-ink-muted">ID: ' + amankanTeks(t.order_id) + '</span>' +
    '<span class="w-1 h-1 rounded-full bg-border-strong"></span>' +
    '<span class="font-body-sm text-body-sm text-ink-muted">NIK: ' + amankanTeks(t.nik_penyewa || "-") + '</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</td>' +
    '<td class="py-md px-base">' +
    '<div class="font-title-md text-title-md text-ink-primary">Kamar ' + amankanTeks(t.nomor_kamar || "-") + '</div>' +
    '<div class="flex items-center gap-xs mt-xs">' +
    '<span class="font-body-sm text-body-sm text-ink-muted">' + amankanTeks(t.nama_cabang) + '</span>' +
    '<span class="bg-surface-variant text-ink-secondary font-tag-uppercase text-tag-uppercase px-sm py-xxs rounded">' +
    amankanTeks(String(t.tipe_sewa || "").toUpperCase()) + '</span>' +
    '</div>' +
    '</td>' +
    '<td class="py-md px-base">' +
    '<div class="font-body-md text-body-md text-ink-primary">' + formatTanggal(waktu) + '</div>' +
    '<div class="font-body-sm text-body-sm text-ink-muted">' + formatJam(waktu) + '</div>' +
    '</td>' +
    '<td class="py-md px-base">' + badgeStatusHtml(t) + '</td>' +
    '<td class="py-md px-base text-right">' +
    '<div class="flex items-center justify-end gap-sm">' +
    tombolAksiHtml(t) +
    '<a href="' + tautanWa(t.kontak_penyewa) + '" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" ' +
    'class="w-8 h-8 rounded-full border border-border-strong flex items-center justify-center text-whatsapp-green hover:bg-whatsapp-green/10 transition-colors">' +
    '<span class="material-symbols-outlined text-[18px]">chat</span></a>' +
    '<a href="detail-booking.html?id=' + encodeURIComponent(t.order_id) + '" aria-label="Detail" ' +
    'class="w-8 h-8 rounded-full border border-border-strong flex items-center justify-center text-ink-secondary hover:bg-surface-variant transition-colors">' +
    '<span class="material-symbols-outlined text-[18px]">more_horiz</span></a>' +
    '</div>' +
    '</td>' +
    '</tr>';
}

// =====================================================================
// MENGGAMBAR TABEL
// =====================================================================
const PESAN_KOSONG = {
  "hari-ini": "Tidak ada jadwal check-in hari ini. Pemesanan baru perlu dialokasikan kamarnya dulu lewat halaman Alokasi Kamar.",
  "mendatang": "Belum ada check-in terjadwal yang kamarnya sudah dialokasikan.",
  "riwayat": "Belum ada riwayat serah terima."
};

function gambarTabel() {
  const daftar = transaksiTampil().sort(function (a, b) {
    const waktuA = a.tanggal_aktual_checkin || a.tanggal_checkin;
    const waktuB = b.tanggal_aktual_checkin || b.tanggal_checkin;
    return awalHari(waktuB) - awalHari(waktuA);
  });

  if (daftar.length === 0) {
    pesanTabel(elTabel, PESAN_KOSONG[tabAktif], JUMLAH_KOLOM);
    return;
  }

  elTabel.innerHTML = daftar.map(barisHtml).join("");

  // Tombol dibuat ulang setiap kali tabel digambar, jadi pemasangan
  // event-nya juga harus diulang di sini.
  elTabel.querySelectorAll(".checkin-trigger").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      bukaModal(tombol.dataset.orderId);
    });
  });
}

function gambarSemua() {
  gambarKartuRingkasan();
  gambarTabel();
}

// =====================================================================
// MODAL VERIFIKASI & KONFIRMASI
// =====================================================================
function bukaModal(orderId) {
  const transaksi = daftarTransaksi.find(function (t) { return t.order_id === orderId; });
  if (!transaksi) return;

  transaksiDiproses = transaksi;

  modalInitials.textContent = inisial(transaksi.nama_penyewa);
  modalName.textContent = transaksi.nama_penyewa;
  modalBookingId.textContent = "ID: " + transaksi.order_id;
  modalRoom.textContent = "Kamar " + (transaksi.nomor_kamar || "-") + " (" + transaksi.nama_cabang + ")";

  modal.querySelectorAll('input[type="checkbox"]').forEach(function (kotak) {
    kotak.checked = false;
  });

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function tutupModal() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function bukaModalSukses(waktuCheckin) {
  if (!transaksiDiproses) return;

  successName.textContent = transaksiDiproses.nama_penyewa;
  successBookingId.textContent = transaksiDiproses.order_id;
  successRoom.textContent = "Kamar " + (transaksiDiproses.nomor_kamar || "-");
  successBranch.textContent = transaksiDiproses.nama_cabang;
  successTime.textContent = formatTanggalJam(waktuCheckin);

  successModal.classList.remove("hidden");
  successModal.classList.add("flex");
}

function tutupModalSukses() {
  successModal.classList.add("hidden");
  successModal.classList.remove("flex");
}

async function konfirmasiCheckin() {
  if (!transaksiDiproses) return;

  const teksAsli = modalConfirm.textContent;
  modalConfirm.disabled = true;
  modalConfirm.textContent = "Menyimpan...";

  try {
    const waktuCheckin = new Date();
    await simpanCheckin(transaksiDiproses.order_id, transaksiDiproses.kamar_id);

    tutupModal();
    bukaModalSukses(waktuCheckin);
    // Tabel tidak perlu digambar ulang manual: onSnapshot akan
    // menerima perubahannya dan memanggil gambarSemua() sendiri.
  } catch (err) {
    console.error("Gagal menyimpan check-in:", err);
    alert("Gagal menyimpan check-in. Silakan coba lagi.\n\n" + (err && err.message ? err.message : ""));
  } finally {
    modalConfirm.disabled = false;
    modalConfirm.textContent = teksAsli;
  }
}

// =====================================================================
// TAB & FILTER
// =====================================================================
function pilihTab(tombol) {
  tabAktif = tombol.dataset.tab;

  tombolTab.forEach(function (btn) {
    const aktif = btn === tombol;
    btn.classList.toggle("text-primary", aktif);
    btn.classList.toggle("font-bold", aktif);
    btn.classList.toggle("border-b-2", aktif);
    btn.classList.toggle("border-primary", aktif);
    btn.classList.toggle("text-ink-muted", !aktif);
  });

  gambarTabel();
}

function isiPilihanCabang() {
  elFilterCabang.innerHTML =
    '<option value="semua">Semua Cabang</option>' +
    Object.keys(petaCabang).map(function (id) {
      return '<option value="' + amankanTeks(id) + '">' +
             amankanTeks(petaCabang[id].nama_cabang) + '</option>';
    }).join("");

  elFilterCabang.addEventListener("change", function () {
    cabangTerpilih = elFilterCabang.value;
    gambarSemua();
  });
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  pesanTabel(elTabel, "Memuat data...", JUMLAH_KOLOM);

  // Pemasangan event modal cukup sekali karena elemennya tetap
  modalClose.addEventListener("click", tutupModal);
  modalCancel.addEventListener("click", tutupModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) tutupModal();
  });
  modalConfirm.addEventListener("click", konfirmasiCheckin);

  successDone.addEventListener("click", tutupModalSukses);
  successModal.addEventListener("click", function (e) {
    if (e.target === successModal) tutupModalSukses();
  });

  tombolTab.forEach(function (tombol) {
    tombol.addEventListener("click", function () { pilihTab(tombol); });
  });

  try {
    petaCabang = await ambilPeta(COL_CABANG);
    const petaKamar = await ambilPeta(COL_KAMAR);
    isiPilihanCabang();

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
