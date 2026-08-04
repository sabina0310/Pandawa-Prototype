/**
 * =====================================================================
 * HALAMAN DASHBOARD (admin & super admin)
 * =====================================================================
 * Menampilkan ringkasan operasional dari Firestore:
 *   - jumlah kamar terisi & kosong
 *   - pemesanan lunas yang kamarnya belum dialokasikan
 *   - penghuni yang masa sewanya akan habis dalam 7 hari
 *   - status tiap kamar per cabang
 *
 * Data transaksi dipantau dengan onSnapshot, jadi angka di layar ikut
 * berubah begitu ada perubahan di Firestore tanpa perlu refresh.
 *
 * Catatan: "Grafik Pendapatan" sengaja dibiarkan memakai angka contoh
 * (hardcode) karena data seeding hanya mencakup sekitar 4 bulan,
 * tidak cukup untuk mengisi grafik 6 bulan.
 * =====================================================================
 */

import {
  ambilPeta,
  pantauTransaksi,
  pantauKamar,
  perluAlokasi,
  mendekatiJatuhTempo,
  sedangMenghuni,
  COL_CABANG
} from "./admin-data.js";

import {
  formatTanggal,
  labelSisaHari,
  sisaHari,
  inisial,
  amankanTeks,
  tautanWa,
  pesanTabel,
  pesanKotak,
  tampilkanError
} from "./admin-util.js";

// --- Elemen halaman -------------------------------------------------
const elStatTerisi = document.getElementById("statTerisi");
const elStatKosong = document.getElementById("statKosong");
const elStatPemesananBaru = document.getElementById("statPemesananBaru");
const elStatJatuhTempo = document.getElementById("statJatuhTempo");

const elFilterCabang = document.getElementById("filterCabang");
const elListJatuhTempo = document.getElementById("listJatuhTempo");
const elTabelAlokasi = document.getElementById("tabelAlokasi");
const elFilterStatusKamar = document.getElementById("filterStatusKamar");
const elGridStatusKamar = document.getElementById("gridStatusKamar");

// --- Penyimpanan data terakhir --------------------------------------
let petaCabang = {};
let petaKamar = {};
let daftarKamar = [];
let daftarTransaksi = [];
let cabangTerpilih = "semua"; // "semua" atau id cabang

// =====================================================================
// PENYARINGAN
// =====================================================================
function sesuaiFilter(cabangId) {
  return cabangTerpilih === "semua" || cabangId === cabangTerpilih;
}

// =====================================================================
// BAGIAN 1 - KARTU RINGKASAN
// =====================================================================
function gambarKartuRingkasan() {
  const kamarTampil = daftarKamar.filter(function (k) {
    return sesuaiFilter(k.cabang_id);
  });

  const terisi = kamarTampil.filter(function (k) { return k.tersedia === false; }).length;
  const kosong = kamarTampil.filter(function (k) { return k.tersedia !== false; }).length;

  const transaksiTampil = daftarTransaksi.filter(function (t) {
    return sesuaiFilter(t.cabang_id);
  });

  const pemesananBaru = transaksiTampil.filter(perluAlokasi).length;
  const jatuhTempo = transaksiTampil.filter(mendekatiJatuhTempo).length;

  elStatTerisi.textContent = terisi;
  elStatKosong.textContent = kosong;
  elStatPemesananBaru.textContent = pemesananBaru;
  elStatJatuhTempo.textContent = jatuhTempo;
}

// =====================================================================
// BAGIAN 2 - DAFTAR PENGHUNI JATUH TEMPO
// =====================================================================
function kartuJatuhTempoHtml(t) {
  // Sisa 3 hari atau kurang ditandai merah, selebihnya kuning
  const mendesak = sisaHari(t.tanggal_checkout) <= 3;
  const kelasBadge = mendesak
    ? "bg-error-container text-error"
    : "bg-[#FEF3F2] text-status-warning";

  const lokasi = (t.nomor_kamar ? "Kamar " + t.nomor_kamar : "Belum ada kamar") +
                 " • " + t.nama_cabang;

  return '' +
    '<div class="flex items-center justify-between gap-3">' +
    '<div class="flex items-center gap-3 flex-1">' +
    '<div class="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-ink-secondary font-bold text-sm flex-shrink-0">' +
    amankanTeks(inisial(t.nama_penyewa)) + '</div>' +
    '<div class="min-w-0">' +
    '<div class="font-semibold text-[14px] text-ink-primary truncate">' + amankanTeks(t.nama_penyewa) + '</div>' +
    '<div class="text-[12px] text-ink-muted truncate">' + amankanTeks(lokasi) + '</div>' +
    '</div>' +
    '</div>' +
    '<div class="flex items-center gap-3">' +
    '<span class="text-[11px] font-bold ' + kelasBadge + ' px-2 py-1 rounded-md uppercase tracking-wide">' +
    amankanTeks(labelSisaHari(t.tanggal_checkout)) + '</span>' +
    '<a href="' + tautanWa(t.kontak_penyewa) + '" target="_blank" rel="noopener noreferrer" ' +
    'class="w-8 h-8 rounded-full bg-whatsapp-green/10 text-whatsapp-green flex items-center justify-center hover:bg-whatsapp-green hover:text-white transition-colors group relative" ' +
    'title="Kirim Pengingat WA">' +
    '<span class="material-symbols-outlined text-[18px]">chat</span>' +
    '</a>' +
    '</div>' +
    '</div>';
}

function gambarJatuhTempo() {
  const daftar = daftarTransaksi
    .filter(function (t) { return sesuaiFilter(t.cabang_id) && mendekatiJatuhTempo(t); })
    .sort(function (a, b) { return sisaHari(a.tanggal_checkout) - sisaHari(b.tanggal_checkout); })
    .slice(0, 5); // dashboard hanya menampilkan 5 teratas

  if (daftar.length === 0) {
    pesanKotak(elListJatuhTempo, "Tidak ada penghuni yang jatuh tempo dalam 7 hari ke depan.");
    return;
  }

  elListJatuhTempo.innerHTML = daftar.map(kartuJatuhTempoHtml).join("");
}

// =====================================================================
// BAGIAN 3 - TABEL MENUNGGU ALOKASI KAMAR
// =====================================================================
function barisAlokasiHtml(t) {
  return '' +
    '<tr class="hover:bg-surface-soft transition-colors border-b border-border-hairline last:border-0">' +
    '<td class="px-4 py-4">' +
    '<div class="flex items-center gap-3">' +
    '<div class="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-ink-secondary font-bold text-sm">' +
    amankanTeks(inisial(t.nama_penyewa)) + '</div>' +
    '<div>' +
    '<div class="font-semibold text-[14px] text-ink-primary">' + amankanTeks(t.nama_penyewa) + '</div>' +
    '<div class="text-[12px] text-ink-muted">' + amankanTeks(t.order_id) + '</div>' +
    '</div>' +
    '</div>' +
    '</td>' +
    '<td class="px-4 py-4 text-[13px] text-ink-secondary font-medium">' + amankanTeks(t.nama_cabang) + '</td>' +
    '<td class="px-4 py-4"><span class="text-[11px] font-bold bg-surface-variant px-2.5 py-1 rounded-md text-ink-secondary tracking-wide">' +
    amankanTeks(String(t.tipe_sewa || "").toUpperCase()) + '</span></td>' +
    '<td class="px-4 py-4 text-[13px] text-ink-secondary font-medium">' + formatTanggal(t.tanggal_checkin) + '</td>' +
    '<td class="px-4 py-4 text-right">' +
    '<a href="alokasi-kamar.html?id=' + encodeURIComponent(t.order_id) + '" class="relative inline-block text-left">' +
    '<button class="appearance-none bg-primary text-white font-semibold text-[13px] rounded-xl px-4 py-2 pr-8 focus:outline-none cursor-pointer shadow-sm">' +
    'Alokasikan Kamar</button>' +
    '</a>' +
    '</td>' +
    '</tr>';
}

function gambarTabelAlokasi() {
  const daftar = daftarTransaksi
    .filter(function (t) { return sesuaiFilter(t.cabang_id) && perluAlokasi(t); })
    .sort(function (a, b) { return sisaHari(a.tanggal_checkin) - sisaHari(b.tanggal_checkin); });

  if (daftar.length === 0) {
    pesanTabel(elTabelAlokasi, "Semua pemesanan sudah mendapat kamar.", 5);
    return;
  }

  elTabelAlokasi.innerHTML = daftar.map(barisAlokasiHtml).join("");
}

// =====================================================================
// BAGIAN 4 - GRID STATUS KAMAR
// =====================================================================
function kartuKamarHtml(kamar, transaksiHuni) {
  // Kamar terisi yang penghuninya akan check-out dalam 7 hari
  // ditandai khusus agar admin bisa bersiap.
  const akanCheckout = transaksiHuni && mendekatiJatuhTempo(transaksiHuni);

  if (kamar.tersedia === false) {
    const warnaGaris = akanCheckout ? "bg-status-warning" : "bg-status-occupied";
    const teksBadge = akanCheckout ? "Akan<br>Check-out" : "Terisi";
    const kelasBadge = akanCheckout
      ? "bg-[#FFFAEB] text-status-warning"
      : "bg-[#FEF3F2] text-status-occupied";

    return '' +
      '<div class="bg-surface-canvas border border-border-hairline rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden" ' +
      'title="' + amankanTeks(transaksiHuni ? transaksiHuni.nama_penyewa : "Terisi") + '">' +
      '<div class="absolute top-0 left-0 w-full h-1 ' + warnaGaris + '"></div>' +
      '<span class="font-display-md text-[20px] font-bold text-ink-primary mb-2">' + amankanTeks(kamar.nomor_kamar) + '</span>' +
      '<span class="text-[11px] font-bold ' + kelasBadge + ' px-2.5 py-1 rounded-md text-center leading-tight">' + teksBadge + '</span>' +
      '</div>';
  }

  return '' +
    '<div class="bg-surface-canvas border border-border-hairline rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow">' +
    '<span class="font-display-md text-[20px] font-bold text-ink-primary mb-2">' + amankanTeks(kamar.nomor_kamar) + '</span>' +
    '<span class="text-[11px] font-bold bg-[#ECFDF3] text-status-available px-2.5 py-1 rounded-md">Tersedia</span>' +
    '</div>';
}

function gambarStatusKamar() {
  // Cari penghuni aktif tiap kamar supaya bisa tahu mana yang akan check-out
  const penghuniKamar = {};
  daftarTransaksi.filter(sedangMenghuni).forEach(function (t) {
    if (t.kamar_id) penghuniKamar[t.kamar_id] = t;
  });

  const idCabangTampil = Object.keys(petaCabang).filter(function (id) {
    return sesuaiFilter(id);
  });

  if (daftarKamar.length === 0) {
    pesanKotak(elGridStatusKamar, "Belum ada data kamar.");
    return;
  }

  const potongan = idCabangTampil.map(function (idCabang) {
    const kamarCabang = daftarKamar.filter(function (k) { return k.cabang_id === idCabang; });
    if (kamarCabang.length === 0) return "";

    return '' +
      '<div class="mb-lg last:mb-0">' +
      '<h3 class="font-semibold text-[14px] text-ink-muted mb-4 uppercase tracking-wider">' +
      amankanTeks(petaCabang[idCabang].nama_cabang) + '</h3>' +
      '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">' +
      kamarCabang.map(function (k) { return kartuKamarHtml(k, penghuniKamar[k.id]); }).join("") +
      '</div>' +
      '</div>';
  });

  elGridStatusKamar.innerHTML = potongan.join("");
}

// =====================================================================
// BAGIAN 5 - FILTER CABANG
// =====================================================================
function isiPilihanCabang() {
  const daftarId = Object.keys(petaCabang);

  // Dropdown di bagian atas halaman
  elFilterCabang.innerHTML =
    '<option value="semua">Semua Cabang</option>' +
    daftarId.map(function (id) {
      return '<option value="' + amankanTeks(id) + '">' +
             amankanTeks(petaCabang[id].nama_cabang) + '</option>';
    }).join("");

  // Tombol filter di atas grid Status Kamar
  elFilterStatusKamar.innerHTML =
    '<button data-cabang="semua" class="tombol-filter-kamar px-4 py-1.5 rounded-lg bg-white shadow-sm text-ink-primary font-semibold text-[13px] transition-colors">Semua</button>' +
    daftarId.map(function (id) {
      return '<button data-cabang="' + amankanTeks(id) + '" ' +
             'class="tombol-filter-kamar px-4 py-1.5 rounded-lg text-ink-muted font-semibold text-[13px] hover:text-ink-primary transition-colors">' +
             amankanTeks(petaCabang[id].nama_cabang) + '</button>';
    }).join("");

  elFilterStatusKamar.querySelectorAll(".tombol-filter-kamar").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      pilihCabang(tombol.dataset.cabang);
    });
  });
}

function pilihCabang(idCabang) {
  cabangTerpilih = idCabang;
  elFilterCabang.value = idCabang;

  // Sorot tombol yang sedang aktif
  elFilterStatusKamar.querySelectorAll(".tombol-filter-kamar").forEach(function (tombol) {
    const aktif = tombol.dataset.cabang === idCabang;
    tombol.classList.toggle("bg-white", aktif);
    tombol.classList.toggle("shadow-sm", aktif);
    tombol.classList.toggle("text-ink-primary", aktif);
    tombol.classList.toggle("text-ink-muted", !aktif);
  });

  gambarSemua();
}

// =====================================================================
// MENGGAMBAR ULANG SELURUH HALAMAN
// =====================================================================
function gambarSemua() {
  // Nomor kamar ditempelkan ulang di sini, bukan sekali saja saat data
  // transaksi datang. Sebabnya data kamar dan data transaksi tiba dari
  // dua pemantauan yang terpisah dan urutannya tidak bisa dipastikan.
  daftarTransaksi.forEach(function (t) {
    const kamar = t.kamar_id ? petaKamar[t.kamar_id] : null;
    t.nomor_kamar = kamar ? kamar.nomor_kamar : null;
  });

  gambarKartuRingkasan();
  gambarJatuhTempo();
  gambarTabelAlokasi();
  gambarStatusKamar();
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  pesanTabel(elTabelAlokasi, "Memuat data...", 5);
  pesanKotak(elListJatuhTempo, "Memuat data...");
  pesanKotak(elGridStatusKamar, "Memuat data...");

  try {
    // Daftar cabang diambil sekali saja karena jarang berubah
    petaCabang = await ambilPeta(COL_CABANG);
    isiPilihanCabang();

    elFilterCabang.addEventListener("change", function () {
      pilihCabang(elFilterCabang.value);
    });

    // Data kamar dipantau real-time agar status Terisi/Tersedia langsung
    // berubah setelah admin melakukan alokasi atau check-in.
    pantauKamar(function (daftar) {
      daftarKamar = daftar;

      petaKamar = {};
      daftar.forEach(function (k) { petaKamar[k.id] = k; });

      gambarSemua();
    }, gagalMuat);

    // Data transaksi juga dipantau real-time
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
    pesanTabel(elTabelAlokasi, pesan, 5, "error");
    pesanKotak(elListJatuhTempo, pesan, "error");
    pesanKotak(elGridStatusKamar, pesan, "error");
  });
}

mulai();
