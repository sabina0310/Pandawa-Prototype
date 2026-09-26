/**
 * =====================================================================
 * HALAMAN CHECK-IN & CHECK-OUT (admin & super admin)
 * =====================================================================
 * Menampilkan jadwal kedatangan DAN kepulangan penghuni, keduanya
 * dibatasi jendela 7 hari ke depan (HARI_JATUH_TEMPO) dan diurutkan
 * dari tanggal yang paling dekat.
 *
 * Dua tab yang tersedia:
 *   - Jadwal Check-in  : pemesanan yang KAMARNYA SUDAH DIALOKASIKAN
 *                        dan dijadwalkan check-in dalam 7 hari ke depan.
 *   - Jadwal Check-out : penghuni yang sedang menempati kamar dan akan
 *                        keluar dalam 7 hari ke depan --
 *                          * seluruh penyewa HARIAN yang mendekati
 *                            tanggal check-out, DAN
 *                          * penyewa BULANAN yang sudah menjawab
 *                            "Tidak Lanjut" (status_perpanjangan).
 *                        Penyewa bulanan yang BELUM menjawab tidak
 *                        muncul di sini -- mereka cukup diingatkan
 *                        lewat WhatsApp otomatis (lihat api/cron.js),
 *                        belum perlu diproses check-out-nya.
 *
 * Saat check-in dikonfirmasi : status_checkin -> "checked_in",
 *                              kamar.tersedia -> false.
 * Saat check-out dikonfirmasi: status_checkin -> "checked_out",
 *                              kamar.tersedia -> true.
 * =====================================================================
 */

import {
  ambilPeta,
  pantauTransaksi,
  simpanCheckin,
  simpanCheckout,
  mendekatiJatuhTempo,
  sedangMenghuni,
  COL_CABANG,
  COL_KAMAR
} from "./admin-data.js";

import {
  formatTanggal,
  formatJam,
  formatTanggalJam,
  awalHari,
  HARI_JATUH_TEMPO,
  labelSisaHari,
  sisaHari,
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
const elThTanggal = document.getElementById("thTanggalJadwal");
const elFilterCabang = document.getElementById("filterCabang");
const elStatCheckin = document.getElementById("statCheckinMingguIni");
const elStatCheckout = document.getElementById("statCheckoutMingguIni");
const elStatPenghuniAktif = document.getElementById("statPenghuniAktif");
const tombolTab = document.querySelectorAll(".checkin-tab");

// --- Modal Check-in ---------------------------------------------------
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

// --- Modal Check-out ---------------------------------------------------
const modalOut = document.getElementById("checkoutModal");
const modalOutInitials = document.getElementById("checkoutModalInitials");
const modalOutName = document.getElementById("checkoutModalName");
const modalOutBookingId = document.getElementById("checkoutModalBookingId");
const modalOutRoom = document.getElementById("checkoutModalRoom");
const modalOutClose = document.getElementById("checkoutModalClose");
const modalOutCancel = document.getElementById("checkoutModalCancel");
const modalOutConfirm = document.getElementById("checkoutModalConfirm");

const successOutModal = document.getElementById("checkoutSuccessModal");
const successOutName = document.getElementById("checkoutSuccessName");
const successOutBookingId = document.getElementById("checkoutSuccessBookingId");
const successOutRoom = document.getElementById("checkoutSuccessRoom");
const successOutBranch = document.getElementById("checkoutSuccessBranch");
const successOutTime = document.getElementById("checkoutSuccessTime");
const successOutDone = document.getElementById("checkoutSuccessDone");

// --- Penyimpanan data terakhir --------------------------------------
let petaCabang = {};
let daftarTransaksi = [];
let tabAktif = "checkin";
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

/** true bila sebuah tanggal jatuh di antara hari ini dan +7 hari. */
function dalamTujuhHari(tanggal) {
  const target = awalHari(tanggal);
  if (!target) return false;

  const sekarang = awalHari(new Date());
  const batas = awalHari(new Date());
  batas.setDate(batas.getDate() + HARI_JATUH_TEMPO);

  return target >= sekarang && target <= batas;
}

/**
 * Penghuni yang siap diproses check-out dalam 7 hari ke depan:
 *   - harian  -> mendekati tanggal check-out, tanpa syarat tambahan
 *   - bulanan -> HANYA yang sudah menjawab "Tidak Lanjut"
 */
function siapCheckout(t) {
  if (!mendekatiJatuhTempo(t)) return false; // sudah mencakup status_checkin === "checked_in"
  if (t.tipe_sewa === "harian") return true;
  return t.tipe_sewa === "bulanan" && t.status_perpanjangan === "tidak_lanjut";
}

function transaksiTampil() {
  return daftarTransaksi.filter(function (t) {
    if (cabangTerpilih !== "semua" && t.cabang_id !== cabangTerpilih) return false;

    if (tabAktif === "checkout") return siapCheckout(t);
    return siapCheckin(t) && dalamTujuhHari(t.tanggal_checkin);
  });
}

// =====================================================================
// KARTU RINGKASAN
// =====================================================================
function gambarKartuRingkasan() {
  const transaksiCabang = daftarTransaksi.filter(function (t) {
    return cabangTerpilih === "semua" || t.cabang_id === cabangTerpilih;
  });

  elStatCheckin.textContent = transaksiCabang.filter(function (t) {
    return siapCheckin(t) && dalamTujuhHari(t.tanggal_checkin);
  }).length;

  elStatCheckout.textContent = transaksiCabang.filter(siapCheckout).length;

  elStatPenghuniAktif.textContent = transaksiCabang.filter(sedangMenghuni).length;
}

// =====================================================================
// SATU BARIS TABEL
// =====================================================================
function badgeHtml(t) {
  if (tabAktif === "checkout") {
    const mendesak = sisaHari(t.tanggal_checkout) <= 3;
    const kelas = mendesak
      ? "bg-error/10 text-error border-error/20"
      : "bg-status-warning/10 text-status-warning border-status-warning/20";
    const alasan = t.tipe_sewa === "bulanan" ? "Tidak Diperpanjang" : "Sewa Harian";

    return '<span class="inline-flex items-center ' + kelas +
           ' font-badge text-badge px-sm py-xxs rounded-full border gap-xxs">' +
           amankanTeks(labelSisaHari(t.tanggal_checkout)) + " &bull; " + alasan + "</span>";
  }

  return '<span class="inline-flex items-center bg-primary-container/10 text-primary-container font-badge text-badge px-sm py-xxs rounded-full border border-primary-container/20">' +
         "Siap Check-in</span>";
}

function tombolAksiHtml(t) {
  if (tabAktif === "checkout") {
    return '<button class="checkout-trigger bg-error text-white font-button-md text-button-md px-md py-sm rounded-lg hover:opacity-90 transition-colors text-sm" ' +
           'data-order-id="' + amankanTeks(t.order_id) + '">Proses Check-out</button>';
  }

  return '<button class="checkin-trigger bg-primary-container text-white font-button-md text-button-md px-md py-sm rounded-lg hover:bg-surface-tint transition-colors text-sm" ' +
         'data-order-id="' + amankanTeks(t.order_id) + '">Proses Check-in</button>';
}

function barisHtml(t) {
  // Kolom tanggal mengikuti tab aktif: jadwal check-in atau check-out.
  const waktu = tabAktif === "checkout" ? t.tanggal_checkout : t.tanggal_checkin;

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
    '<td class="py-md px-base">' + badgeHtml(t) + '</td>' +
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
  "checkin": "Tidak ada jadwal check-in dalam 7 hari ke depan. Pemesanan baru perlu dialokasikan kamarnya dulu lewat halaman Alokasi Kamar.",
  "checkout": "Tidak ada penghuni yang akan check-out dalam 7 hari ke depan."
};

function gambarTabel() {
  const daftar = transaksiTampil().sort(function (a, b) {
    const waktuA = tabAktif === "checkout" ? a.tanggal_checkout : a.tanggal_checkin;
    const waktuB = tabAktif === "checkout" ? b.tanggal_checkout : b.tanggal_checkin;
    return awalHari(waktuA) - awalHari(waktuB); // tanggal terdekat lebih dulu
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
  elTabel.querySelectorAll(".checkout-trigger").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      bukaModalCheckout(tombol.dataset.orderId);
    });
  });
}

function gambarSemua() {
  gambarKartuRingkasan();
  gambarTabel();
}

// =====================================================================
// MODAL VERIFIKASI & KONFIRMASI CHECK-IN
// =====================================================================

/**
 * Tombol "Konfirmasi Check-in" hanya boleh ditekan setelah KEEMPAT item
 * checklist verifikasi dicentang.
 */
function perbaruiTombolKonfirmasi() {
  const kotakCentang = modal.querySelectorAll('input[type="checkbox"]');
  const semuaDicentang = Array.prototype.every.call(kotakCentang, function (kotak) {
    return kotak.checked;
  });
  modalConfirm.disabled = !semuaDicentang;
}

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
  perbaruiTombolKonfirmasi(); // checklist baru dikosongkan -> tombol terkunci lagi

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
// MODAL KONFIRMASI & SUKSES CHECK-OUT
// =====================================================================
function bukaModalCheckout(orderId) {
  const transaksi = daftarTransaksi.find(function (t) { return t.order_id === orderId; });
  if (!transaksi) return;

  transaksiDiproses = transaksi;

  modalOutInitials.textContent = inisial(transaksi.nama_penyewa);
  modalOutName.textContent = transaksi.nama_penyewa;
  modalOutBookingId.textContent = "ID: " + transaksi.order_id;
  modalOutRoom.textContent = "Kamar " + (transaksi.nomor_kamar || "-") + " (" + transaksi.nama_cabang + ")";

  modalOut.classList.remove("hidden");
  modalOut.classList.add("flex");
}

function tutupModalCheckout() {
  modalOut.classList.add("hidden");
  modalOut.classList.remove("flex");
}

function bukaModalSuksesCheckout(waktuCheckout) {
  if (!transaksiDiproses) return;

  successOutName.textContent = transaksiDiproses.nama_penyewa;
  successOutBookingId.textContent = transaksiDiproses.order_id;
  successOutRoom.textContent = "Kamar " + (transaksiDiproses.nomor_kamar || "-");
  successOutBranch.textContent = transaksiDiproses.nama_cabang;
  successOutTime.textContent = formatTanggalJam(waktuCheckout);

  successOutModal.classList.remove("hidden");
  successOutModal.classList.add("flex");
}

function tutupModalSuksesCheckout() {
  successOutModal.classList.add("hidden");
  successOutModal.classList.remove("flex");
}

async function konfirmasiCheckout() {
  if (!transaksiDiproses) return;

  const teksAsli = modalOutConfirm.textContent;
  modalOutConfirm.disabled = true;
  modalOutConfirm.textContent = "Menyimpan...";

  try {
    const waktuCheckout = new Date();
    await simpanCheckout(transaksiDiproses.order_id, transaksiDiproses.kamar_id);

    tutupModalCheckout();
    bukaModalSuksesCheckout(waktuCheckout);
  } catch (err) {
    console.error("Gagal menyimpan check-out:", err);
    alert("Gagal menyimpan check-out. Silakan coba lagi.\n\n" + (err && err.message ? err.message : ""));
  } finally {
    modalOutConfirm.disabled = false;
    modalOutConfirm.textContent = teksAsli;
  }
}

// =====================================================================
// TAB & FILTER
// =====================================================================
const LABEL_KOLOM_TANGGAL = {
  checkin: "Waktu Check-in",
  checkout: "Waktu Check-out"
};

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

  if (elThTanggal) elThTanggal.textContent = LABEL_KOLOM_TANGGAL[tabAktif] || "Tanggal";

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

  // Tombol konfirmasi check-in terkunci sampai keempat checklist dicentang
  modal.querySelectorAll('input[type="checkbox"]').forEach(function (kotak) {
    kotak.addEventListener("change", perbaruiTombolKonfirmasi);
  });

  successDone.addEventListener("click", tutupModalSukses);
  successModal.addEventListener("click", function (e) {
    if (e.target === successModal) tutupModalSukses();
  });

  modalOutClose.addEventListener("click", tutupModalCheckout);
  modalOutCancel.addEventListener("click", tutupModalCheckout);
  modalOut.addEventListener("click", function (e) {
    if (e.target === modalOut) tutupModalCheckout();
  });
  modalOutConfirm.addEventListener("click", konfirmasiCheckout);

  successOutDone.addEventListener("click", tutupModalSuksesCheckout);
  successOutModal.addEventListener("click", function (e) {
    if (e.target === successOutModal) tutupModalSuksesCheckout();
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
