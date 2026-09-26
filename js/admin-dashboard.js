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
 * "Grafik Pendapatan" menjumlahkan order_amount transaksi LUNAS per
 * bulan (berdasarkan settlement_time, sama seperti js/admin-financials.js),
 * dibatasi rentang "Dari bulan - Sampai bulan" yang bisa diatur pengguna
 * (bawaan: 6 bulan terakhir), dan ikut tersaring oleh filter cabang yang
 * sama dengan seluruh kartu lain di halaman ini.
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
  formatRupiah,
  statusLunas,
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

const elGrafikPendapatan = document.getElementById("grafikPendapatan");
const elGrafikBulanMulai = document.getElementById("grafikBulanMulai");
const elGrafikBulanSelesai = document.getElementById("grafikBulanSelesai");

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

/**
 * Jatuh tempo yang PERLU TINDAKAN di dashboard: penyewa bulanan yang
 * sudah menjawab "Tidak Lanjut" (status_perpanjangan) SENGAJA
 * dikecualikan -- kepastian mereka akan keluar sudah cukup ditangani
 * di tab "Jadwal Check-out" pada halaman Manajemen Check-in & Check-out,
 * jadi tidak perlu dobel tampil di sini sebagai sesuatu yang masih
 * perlu dikejar admin. Sama persis dengan js/admin-bookings.js.
 */
function jatuhTempoPerluTindakan(t) {
  return mendekatiJatuhTempo(t) && t.status_perpanjangan !== "tidak_lanjut";
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
  const jatuhTempo = transaksiTampil.filter(jatuhTempoPerluTindakan).length;

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
    .filter(function (t) { return sesuaiFilter(t.cabang_id) && jatuhTempoPerluTindakan(t); })
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
  const akanCheckout = transaksiHuni && jatuhTempoPerluTindakan(transaksiHuni);

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
// BAGIAN 4B - GRAFIK PENDAPATAN (per bulan, transaksi lunas)
// ---------------------------------------------------------------------
// Sinkron dengan filter cabang lewat sesuaiFilter() yang sama dipakai
// kartu-kartu lain, dan ikut digambar ulang oleh gambarSemua() setiap
// kali data transaksi berubah atau filter cabang berpindah.
// =====================================================================
const NAMA_BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

// Batas rentang terpanjang yang boleh ditampilkan sekaligus, supaya
// grafik tidak meluber bila pengguna memilih rentang bertahun-tahun.
const MAKS_BULAN_GRAFIK = 36;

/** Date -> "2026-09", format yang dipakai <input type="month">. */
function bulanKeNilaiInput(tanggal) {
  return tanggal.getFullYear() + "-" + String(tanggal.getMonth() + 1).padStart(2, "0");
}

/** "2026-09" -> { tahun: 2026, bulan: 8 } (bulan 0-indeks). */
function uraiNilaiBulan(nilai) {
  const bagian = nilai.split("-");
  return { tahun: Number(bagian[0]), bulan: Number(bagian[1]) - 1 };
}

// Rentang bawaan saat halaman baru dibuka (belum diubah pengguna)
const JUMLAH_BULAN_BAWAAN = 6;

/** Mengisi kolom "Dari" & "Sampai" dengan JUMLAH_BULAN_BAWAAN bulan terakhir. */
function aturRentangGrafikBawaan() {
  const sekarang = new Date();
  const bulanLalu = new Date(sekarang.getFullYear(), sekarang.getMonth() - (JUMLAH_BULAN_BAWAAN - 1), 1);

  elGrafikBulanMulai.value = bulanKeNilaiInput(bulanLalu);
  elGrafikBulanSelesai.value = bulanKeNilaiInput(sekarang);
}

/**
 * Daftar { tahun, bulan } berurutan maju dari "mulai" sampai "selesai".
 * Urutan dua kolom yang tertukar tetap ditampilkan maju (bukan error),
 * dan rentangnya dipotong maksimal MAKS_BULAN_GRAFIK bulan.
 */
function daftarBulanRentang(nilaiMulai, nilaiSelesai) {
  const mulai = uraiNilaiBulan(nilaiMulai);
  const selesai = uraiNilaiBulan(nilaiSelesai);

  let idxMulai = mulai.tahun * 12 + mulai.bulan;
  let idxSelesai = selesai.tahun * 12 + selesai.bulan;

  if (idxSelesai < idxMulai) {
    const tukar = idxMulai;
    idxMulai = idxSelesai;
    idxSelesai = tukar;
  }
  idxMulai = Math.max(idxMulai, idxSelesai - (MAKS_BULAN_GRAFIK - 1));

  const daftar = [];
  for (let idx = idxMulai; idx <= idxSelesai; idx++) {
    daftar.push({ tahun: Math.floor(idx / 12), bulan: ((idx % 12) + 12) % 12 });
  }
  return daftar;
}

function gambarGrafikPendapatan() {
  if (!elGrafikPendapatan) return;

  if (!elGrafikBulanMulai.value || !elGrafikBulanSelesai.value) {
    aturRentangGrafikBawaan();
  }

  const bulanList = daftarBulanRentang(elGrafikBulanMulai.value, elGrafikBulanSelesai.value);

  // Hanya transaksi LUNAS pada cabang yang sedang difilter -- sama
  // dengan syarat kartu ringkasan keuangan pada js/admin-financials.js.
  const transaksiLunas = daftarTransaksi.filter(function (t) {
    return sesuaiFilter(t.cabang_id) && statusLunas(t.transaction_status) && t.settlement_time;
  });

  const totalPerBulan = bulanList.map(function (bl) {
    const total = transaksiLunas.reduce(function (jumlah, t) {
      const waktu = t.settlement_time.toDate();
      if (waktu.getFullYear() === bl.tahun && waktu.getMonth() === bl.bulan) {
        return jumlah + Number(t.order_amount || 0);
      }
      return jumlah;
    }, 0);

    return { tahun: bl.tahun, bulan: bl.bulan, total: total };
  });

  const nilaiMaksimum = totalPerBulan.reduce(function (m, b) { return Math.max(m, b.total); }, 0);

  if (nilaiMaksimum === 0) {
    elGrafikPendapatan.innerHTML =
      '<div class="h-56 flex items-center justify-center text-ink-muted text-body-sm text-center px-base">' +
      'Belum ada transaksi lunas pada periode ini.</div>';
    return;
  }

  // Lebar minimum per batang supaya label bulan tidak berdesakan --
  // di layar sempit, pembungkus ".gulir-x" pada HTML yang menggulirkan
  // grafik ini secara mendatar (lihat komentar di admin/dashboard-admin.html).
  const lebarMinimum = Math.max(560, totalPerBulan.length * 48);

  elGrafikPendapatan.innerHTML =
    '<div class="flex items-end gap-2 sm:gap-3 h-56 border-b border-border-hairline pb-2" style="min-width:' + lebarMinimum + 'px">' +
    totalPerBulan.map(function (b) {
      const tinggiPersen = Math.max(4, Math.round((b.total / nilaiMaksimum) * 100));
      const label = NAMA_BULAN_SINGKAT[b.bulan] + " " + b.tahun;
      const nilaiTeks = formatRupiah(b.total);
      const judul = amankanTeks(label + ": " + nilaiTeks);

      return '' +
        '<div class="flex-1 flex flex-col items-center gap-2 h-full min-w-[32px]">' +
        '<div class="w-full flex-1 flex items-end">' +
        '<div class="w-full bg-primary-fixed rounded-t-lg hover:bg-primary transition-colors relative group cursor-default" ' +
        'style="height:' + tinggiPersen + '%" title="' + judul + '">' +
        '<div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink-primary text-white text-xs px-2 py-1 rounded ' +
        'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">' +
        amankanTeks(nilaiTeks) + '</div>' +
        '</div>' +
        '</div>' +
        '<span class="text-badge font-semibold text-ink-muted whitespace-nowrap">' + amankanTeks(label) + '</span>' +
        '</div>';
    }).join("") +
    '</div>';
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
  gambarGrafikPendapatan();
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

    // Grafik pendapatan: bawaan 6 bulan terakhir, bisa diubah manual
    aturRentangGrafikBawaan();
    elGrafikBulanMulai.addEventListener("change", gambarGrafikPendapatan);
    elGrafikBulanSelesai.addEventListener("change", gambarGrafikPendapatan);

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
