/**
 * =====================================================================
 * HALAMAN BOOKINGS (admin & super admin)
 * =====================================================================
 * Menampilkan seluruh transaksi pemesanan dari Firestore dalam satu
 * tabel, dengan tiga tab penyaring:
 *
 *   - Semua Pesanan       : seluruh transaksi
 *   - Menunggu Alokasi    : sudah lunas tapi kamarnya belum ditentukan
 *   - Jatuh Tempo         : penghuni aktif yang masa sewanya habis
 *                           dalam 7 hari ke depan
 *
 * Tabel dibagi menjadi beberapa halaman, 15 baris tiap halaman.
 * =====================================================================
 */

import {
  ambilPeta,
  pantauTransaksi,
  perluAlokasi,
  mendekatiJatuhTempo,
  COL_CABANG,
  COL_KAMAR
} from "./admin-data.js";

import {
  formatTanggal,
  formatRupiah,
  labelStatusBayar,
  kelasStatusBayar,
  labelSisaHari,
  sisaHari,
  inisial,
  amankanTeks,
  tautanWa,
  pesanTabel,
  tampilkanError
} from "./admin-util.js";

const BARIS_PER_HALAMAN = 15;
const JUMLAH_KOLOM = 5;

// --- Elemen halaman -------------------------------------------------
const elTabel = document.getElementById("bookingsTableBody");
const elInfoHalaman = document.getElementById("paginationInfo");
const elTombolHalaman = document.getElementById("paginationButtons");
const elFilterCabang = document.getElementById("filterCabang");
const elBadgeJatuhTempo = document.getElementById("badgeJatuhTempo");
const elBadgeMenungguAlokasi = document.getElementById("badgeMenungguAlokasi");

const elStatTerisi = document.getElementById("statTerisi");
const elStatKosong = document.getElementById("statKosong");
const elStatPemesananBaru = document.getElementById("statPemesananBaru");
const elStatJatuhTempo = document.getElementById("statJatuhTempo");

const tombolTab = document.querySelectorAll(".status-tab");

// --- Penyimpanan data terakhir --------------------------------------
let petaCabang = {};
let daftarKamar = [];
let daftarTransaksi = [];
let tabAktif = "semua";
let halamanAktif = 1;
let cabangTerpilih = "semua";

// =====================================================================
// PENYARINGAN
// =====================================================================

/**
 * Jatuh tempo yang PERLU TINDAKAN di halaman ini: penyewa bulanan yang
 * sudah menjawab "Tidak Lanjut" (status_perpanjangan) SENGAJA dikecualikan
 * -- kepastian mereka akan keluar sudah cukup ditangani di tab "Jadwal
 * Check-out" pada halaman Manajemen Check-in, jadi tidak perlu dobel
 * tampil di sini sebagai sesuatu yang masih perlu dikejar admin.
 */
function jatuhTempoPerluTindakan(t) {
  return mendekatiJatuhTempo(t) && t.status_perpanjangan !== "tidak_lanjut";
}

/** Mengambil transaksi sesuai tab dan filter cabang yang sedang aktif. */
function transaksiTampil() {
  return daftarTransaksi.filter(function (t) {
    if (cabangTerpilih !== "semua" && t.cabang_id !== cabangTerpilih) return false;

    if (tabAktif === "menunggu-alokasi") return perluAlokasi(t);
    if (tabAktif === "jatuh-tempo") return jatuhTempoPerluTindakan(t);
    return true; // tab "semua"
  });
}

// =====================================================================
// KARTU RINGKASAN DI ATAS TABEL
// =====================================================================
function gambarKartuRingkasan() {
  const kamarTampil = daftarKamar.filter(function (k) {
    return cabangTerpilih === "semua" || k.cabang_id === cabangTerpilih;
  });

  const transaksiCabang = daftarTransaksi.filter(function (t) {
    return cabangTerpilih === "semua" || t.cabang_id === cabangTerpilih;
  });

  elStatTerisi.textContent = kamarTampil.filter(function (k) { return k.tersedia === false; }).length;
  elStatKosong.textContent = kamarTampil.filter(function (k) { return k.tersedia !== false; }).length;

  const jumlahMenungguAlokasi = transaksiCabang.filter(perluAlokasi).length;
  elStatPemesananBaru.textContent = jumlahMenungguAlokasi;
  elBadgeMenungguAlokasi.textContent = jumlahMenungguAlokasi;
  elBadgeMenungguAlokasi.classList.toggle("hidden", jumlahMenungguAlokasi === 0);

  const jumlahJatuhTempo = transaksiCabang.filter(jatuhTempoPerluTindakan).length;
  elStatJatuhTempo.textContent = jumlahJatuhTempo;
  elBadgeJatuhTempo.textContent = jumlahJatuhTempo;
}

// =====================================================================
// SATU BARIS TABEL
// =====================================================================
function tombolAksiHtml(t) {
  let html = "";

  // Tombol alokasi hanya muncul bila kamarnya memang belum ditentukan
  if (perluAlokasi(t)) {
    html += '<a href="alokasi-kamar.html?id=' + encodeURIComponent(t.order_id) + '" ' +
            'class="bg-primary text-white px-4 py-2 rounded-xl font-semibold text-[13px] hover:opacity-90 transition-colors shadow-sm">' +
            'Alokasikan Kamar</a>';
  }

  html += '<a href="' + tautanWa(t.kontak_penyewa) + '" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" ' +
          'class="bg-whatsapp-green/10 text-whatsapp-green p-2 rounded-full hover:bg-whatsapp-green hover:text-white transition-colors flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-[18px]">chat</span></a>';

  html += '<a href="detail-booking.html?id=' + encodeURIComponent(t.order_id) + '" ' +
          'class="border border-border-strong text-ink-primary px-3 py-2 rounded-xl font-semibold text-[13px] hover:bg-surface-soft transition-colors flex items-center gap-1">Detail</a>';

  return '<div class="flex items-center justify-end gap-2">' + html + "</div>";
}

function barisHtml(t) {
  // Penghuni yang mendekati jatuh tempo diberi badge tambahan
  // berisi sisa harinya, agar admin langsung melihat urgensinya.
  let badgeTambahan = "";
  if (jatuhTempoPerluTindakan(t)) {
    const mendesak = sisaHari(t.tanggal_checkout) <= 3;
    const kelas = mendesak ? "bg-error/10 text-error" : "bg-status-warning/10 text-status-warning";
    badgeTambahan =
      '<span class="' + kelas + ' px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">' +
      "Jatuh Tempo " + amankanTeks(labelSisaHari(t.tanggal_checkout)) + "</span>";
  }

  const lokasiKamar = t.nomor_kamar
    ? amankanTeks(t.nama_cabang) + " &bull; Kamar " + amankanTeks(t.nomor_kamar)
    : amankanTeks(t.nama_cabang);

  return '' +
    '<tr class="hover:bg-surface-soft transition-colors">' +
    '<td class="px-lg py-4">' +
    '<div class="flex items-center gap-3">' +
    '<div class="w-10 h-10 rounded-full bg-primary-fixed text-primary-container flex items-center justify-center font-bold text-[14px] shrink-0">' +
    amankanTeks(inisial(t.nama_penyewa)) + '</div>' +
    '<div>' +
    '<div class="font-semibold text-[14px] text-ink-primary">' + amankanTeks(t.nama_penyewa) + '</div>' +
    '<div class="text-[12px] text-ink-secondary">' + amankanTeks(t.kontak_penyewa) + '</div>' +
    '<div class="text-[12px] text-ink-secondary mt-0.5">' + amankanTeks(t.order_id) + '</div>' +
    '</div>' +
    '</div>' +
    '</td>' +
    '<td class="px-lg py-4">' +
    '<div class="flex flex-col items-start gap-1">' +
    '<span class="text-[13px] text-ink-secondary font-medium">' + lokasiKamar + '</span>' +
    '<span class="bg-surface-variant text-ink-secondary px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">' +
    amankanTeks(String(t.tipe_sewa || "").toUpperCase()) + '</span>' +
    '</div>' +
    '</td>' +
    '<td class="px-lg py-4">' +
    '<div class="flex flex-col gap-1 text-[13px] text-ink-secondary font-medium">' +
    '<div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-ink-muted">flight_land</span> ' +
    formatTanggal(t.tanggal_checkin) + '</div>' +
    '<div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-ink-muted">flight_takeoff</span> ' +
    formatTanggal(t.tanggal_checkout) + '</div>' +
    '</div>' +
    '</td>' +
    '<td class="px-lg py-4">' +
    '<div class="flex flex-col items-start gap-1.5">' +
    '<span class="font-semibold text-[14px] text-ink-primary">' + formatRupiah(t.order_amount) + '</span>' +
    '<span class="' + kelasStatusBayar(t.transaction_status) + ' px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">' +
    amankanTeks(labelStatusBayar(t.transaction_status)) + '</span>' +
    badgeTambahan +
    '</div>' +
    '</td>' +
    '<td class="px-lg py-4 text-right">' + tombolAksiHtml(t) + '</td>' +
    '</tr>';
}

// =====================================================================
// PEMBAGIAN HALAMAN (15 baris per halaman)
// =====================================================================
function gambarTombolHalaman(jumlahHalaman) {
  if (jumlahHalaman <= 1) {
    elTombolHalaman.innerHTML = "";
    return;
  }

  let html = '<button data-aksi="mundur" class="tombol-halaman p-1.5 rounded-md text-ink-muted hover:bg-surface-soft border border-transparent hover:border-border-hairline transition-all">' +
             '<span class="material-symbols-outlined text-sm">chevron_left</span></button>';

  for (let i = 1; i <= jumlahHalaman; i++) {
    const aktif = i === halamanAktif;
    const kelas = aktif
      ? "w-8 h-8 rounded-md bg-primary-container text-on-primary font-label-md text-label-md flex items-center justify-center"
      : "w-8 h-8 rounded-md text-ink-primary hover:bg-surface-soft font-label-md text-label-md flex items-center justify-center transition-colors";
    html += '<button data-halaman="' + i + '" class="tombol-halaman ' + kelas + '">' + i + "</button>";
  }

  html += '<button data-aksi="maju" class="tombol-halaman p-1.5 rounded-md text-ink-muted hover:bg-surface-soft border border-transparent hover:border-border-hairline transition-all">' +
          '<span class="material-symbols-outlined text-sm">chevron_right</span></button>';

  elTombolHalaman.innerHTML = html;

  elTombolHalaman.querySelectorAll(".tombol-halaman").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      if (tombol.dataset.aksi === "mundur") {
        halamanAktif = Math.max(1, halamanAktif - 1);
      } else if (tombol.dataset.aksi === "maju") {
        halamanAktif = Math.min(jumlahHalaman, halamanAktif + 1);
      } else {
        halamanAktif = Number(tombol.dataset.halaman);
      }
      gambarTabel();
    });
  });
}

// =====================================================================
// MENGGAMBAR TABEL
// =====================================================================
function gambarTabel() {
  const semua = transaksiTampil();

  if (semua.length === 0) {
    pesanTabel(elTabel, "Tidak ada data pada kategori ini.", JUMLAH_KOLOM);
    elInfoHalaman.textContent = "Tidak ada data";
    elTombolHalaman.innerHTML = "";
    return;
  }

  const jumlahHalaman = Math.ceil(semua.length / BARIS_PER_HALAMAN);
  if (halamanAktif > jumlahHalaman) halamanAktif = jumlahHalaman;

  const mulai = (halamanAktif - 1) * BARIS_PER_HALAMAN;
  const potongan = semua.slice(mulai, mulai + BARIS_PER_HALAMAN);

  elTabel.innerHTML = potongan.map(barisHtml).join("");
  elInfoHalaman.textContent =
    "Menampilkan " + (mulai + 1) + "-" + (mulai + potongan.length) +
    " dari " + semua.length + " data";

  gambarTombolHalaman(jumlahHalaman);
}

function gambarSemua() {
  gambarKartuRingkasan();
  gambarTabel();
}

// =====================================================================
// TAB
// =====================================================================
function pilihTab(tombol) {
  tabAktif = tombol.dataset.tab;
  halamanAktif = 1;

  tombolTab.forEach(function (btn) {
    const aktif = btn === tombol;
    btn.classList.toggle("border-primary", aktif);
    btn.classList.toggle("text-primary", aktif);
    btn.classList.toggle("font-bold", aktif);
    btn.classList.toggle("border-transparent", !aktif);
    btn.classList.toggle("text-ink-muted", !aktif);
  });

  gambarTabel();
}

// =====================================================================
// FILTER CABANG
// =====================================================================
function isiPilihanCabang() {
  elFilterCabang.innerHTML =
    '<option value="semua">Semua Cabang</option>' +
    Object.keys(petaCabang).map(function (id) {
      return '<option value="' + amankanTeks(id) + '">' +
             amankanTeks(petaCabang[id].nama_cabang) + '</option>';
    }).join("");

  elFilterCabang.addEventListener("change", function () {
    cabangTerpilih = elFilterCabang.value;
    halamanAktif = 1;
    gambarSemua();
  });
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  pesanTabel(elTabel, "Memuat data...", JUMLAH_KOLOM);

  try {
    petaCabang = await ambilPeta(COL_CABANG);
    const petaKamar = await ambilPeta(COL_KAMAR);
    daftarKamar = Object.keys(petaKamar).map(function (id) { return petaKamar[id]; });

    isiPilihanCabang();

    tombolTab.forEach(function (tombol) {
      tombol.addEventListener("click", function () { pilihTab(tombol); });
    });

    // Tab awal bisa ditentukan lewat alamat, contoh: bookings.html?tab=jatuh-tempo
    // Dipakai oleh tautan "Lihat Semua Tagihan" di halaman dashboard.
    const tabDiminta = new URLSearchParams(window.location.search).get("tab");
    const tombolAwal = Array.prototype.find.call(tombolTab, function (btn) {
      return btn.dataset.tab === tabDiminta;
    });
    if (tombolAwal) pilihTab(tombolAwal);

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
    elInfoHalaman.textContent = "Gagal memuat data";
  });
}

mulai();
