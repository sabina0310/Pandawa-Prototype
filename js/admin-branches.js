/**
 * =====================================================================
 * HALAMAN MANAJEMEN KAMAR & CABANG (admin & super admin)
 * =====================================================================
 * Sisi kiri  : daftar cabang beserta jumlah kamar terisi
 * Sisi kanan : detail cabang terpilih dan seluruh kamarnya
 *
 * Data kamar dipantau real-time, jadi begitu admin melakukan alokasi
 * atau check-in di halaman lain, status kamar di sini ikut berubah.
 *
 * Catatan: setiap kamar boleh disewa harian maupun bulanan, sehingga
 * kartu kamar yang kosong menampilkan KEDUA harga sekaligus.
 * =====================================================================
 */

import {
  ambilPeta,
  pantauTransaksi,
  pantauKamar,
  sedangMenghuni,
  COL_CABANG
} from "./admin-data.js";

import {
  formatTanggal,
  formatRupiah,
  amankanTeks,
  pesanKotak,
  tampilkanError
} from "./admin-util.js";

// --- Elemen halaman -------------------------------------------------
const elDaftarCabang = document.getElementById("branchList");
const elNamaCabang = document.getElementById("branchDetailName");
const elAlamatCabang = document.getElementById("branchDetailAddress");
const elGridKamar = document.getElementById("roomGrid");
const elCariKamar = document.getElementById("searchRoom");
const elFilterStatus = document.getElementById("filterStatusKamar");

const elTotalCabang = document.getElementById("statTotalCabang");
const elKamarTersedia = document.getElementById("statKamarTersedia");
const elKamarTerisi = document.getElementById("statKamarTerisi");

const elPilihCabangForm = document.getElementById("addRoomBranchSelect");

// --- Penyimpanan data terakhir --------------------------------------
let petaCabang = {};
let daftarKamar = [];
let penghuniKamar = {}; // { kamar_id: transaksi }
let cabangTerpilih = null;

// =====================================================================
// DAFTAR CABANG (kolom kiri)
// =====================================================================
function gambarDaftarCabang() {
  const daftarId = Object.keys(petaCabang);

  if (daftarId.length === 0) {
    pesanKotak(elDaftarCabang, "Belum ada data cabang.");
    return;
  }

  elDaftarCabang.innerHTML = daftarId.map(function (id) {
    const cabang = petaCabang[id];
    const kamarCabang = daftarKamar.filter(function (k) { return k.cabang_id === id; });
    const terisi = kamarCabang.filter(function (k) { return k.tersedia === false; }).length;
    const aktif = id === cabangTerpilih;

    const kelas = aktif
      ? "branch-select-btn flex flex-col gap-1 p-base bg-primary text-on-primary rounded-xl shadow-sm text-left transition-all"
      : "branch-select-btn flex flex-col gap-1 p-base bg-surface-canvas border border-border-hairline text-ink-primary rounded-xl hover:border-primary/30 hover:bg-primary-container/5 hover:shadow-sm text-left transition-all group";

    const kelasHitungan = aktif ? "text-xs opacity-90" : "text-xs text-ink-muted";
    const kelasNama = aktif ? "font-title-md" : "font-title-md group-hover:text-primary";

    return '<button data-cabang-id="' + amankanTeks(id) + '" class="' + kelas + '">' +
           '<span class="' + kelasNama + '">' + amankanTeks(cabang.nama_cabang) + '</span>' +
           '<span class="' + kelasHitungan + '">' + terisi + "/" + kamarCabang.length + " Kamar Terisi</span>" +
           "</button>";
  }).join("");

  elDaftarCabang.querySelectorAll(".branch-select-btn").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      cabangTerpilih = tombol.dataset.cabangId;
      gambarSemua();
    });
  });
}

// =====================================================================
// RINGKASAN DI BAGIAN ATAS HALAMAN
// =====================================================================
function gambarRingkasan() {
  elTotalCabang.textContent = "Total " + Object.keys(petaCabang).length + " Cabang Aktif";
  elKamarTersedia.textContent =
    daftarKamar.filter(function (k) { return k.tersedia !== false; }).length + " Kamar Tersedia";
  elKamarTerisi.textContent =
    daftarKamar.filter(function (k) { return k.tersedia === false; }).length + " Kamar Terisi";
}

// =====================================================================
// KARTU KAMAR
// =====================================================================
function kartuKamarHtml(kamar, cabang) {
  const terisi = kamar.tersedia === false;
  const penghuni = penghuniKamar[kamar.id];

  const warnaTitik = terisi ? "bg-status-occupied" : "bg-status-available";

  // Label tipe sewa: kalau sedang dihuni tampilkan tipe yang dipakai
  // penghuninya; kalau kosong tampilkan bahwa keduanya tersedia.
  const labelTipe = penghuni
    ? String(penghuni.tipe_sewa || "").toUpperCase()
    : "HARIAN / BULANAN";

  const badgeStatus = terisi
    ? '<span class="px-2 py-0.5 rounded bg-error-container text-error text-[10px] font-bold uppercase">Terisi</span>'
    : '<span class="px-2 py-0.5 rounded bg-[#ECFDF3] text-status-available text-[10px] font-bold uppercase">Tersedia</span>';

  // Bagian bawah kartu: data penghuni bila terisi, harga bila kosong
  let isiBawah;
  if (penghuni) {
    isiBawah =
      '<div class="mt-xs">' +
      '<div class="text-xs text-ink-muted">Penyewa</div>' +
      '<div class="font-medium text-ink-primary">' + amankanTeks(penghuni.nama_penyewa) + '</div>' +
      '</div>' +
      '<div>' +
      '<div class="text-xs text-ink-muted">Checkout</div>' +
      '<div class="font-medium text-ink-primary">' + formatTanggal(penghuni.tanggal_checkout) + '</div>' +
      '</div>';
  } else if (terisi) {
    // Kamar ditandai terisi tapi tidak ada transaksi aktif yang merujuk
    // ke sana. Ditampilkan apa adanya supaya ketidakcocokan data terlihat.
    isiBawah =
      '<div class="mt-xs">' +
      '<div class="text-xs text-ink-muted italic">Terisi</div>' +
      '<div class="font-medium text-ink-primary">Data penyewa tidak ditemukan</div>' +
      '</div>';
  } else {
    isiBawah =
      '<div class="mt-xs">' +
      '<div class="text-xs text-ink-muted italic">Siap huni</div>' +
      '<div class="font-medium text-ink-primary">' + formatRupiah(cabang.harga_harian) + '/hari</div>' +
      '<div class="font-medium text-ink-primary">' + formatRupiah(cabang.harga_bulanan) + '/bulan</div>' +
      '</div>';
  }

  return '' +
    '<div class="bg-surface-canvas rounded-2xl shadow-sm border border-border-hairline overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-1 transition-all">' +
    '<div class="p-base flex justify-between items-center border-b border-border-hairline">' +
    '<div class="flex items-center gap-sm">' +
    '<div class="w-3 h-3 rounded-full ' + warnaTitik + '"></div>' +
    '<h4 class="font-title-md text-ink-primary">Kamar ' + amankanTeks(kamar.nomor_kamar) + '</h4>' +
    '</div>' +
    '<span class="text-xs text-ink-muted">' + amankanTeks(kamar.id) + '</span>' +
    '</div>' +
    '<div class="p-base flex flex-col gap-sm">' +
    '<div class="flex flex-wrap gap-xs">' +
    '<span class="px-2 py-0.5 rounded bg-primary-container/10 text-primary text-[10px] font-bold uppercase">' +
    amankanTeks(labelTipe) + '</span>' +
    badgeStatus +
    '</div>' +
    isiBawah +
    '</div>' +
    '</div>';
}

// =====================================================================
// GRID KAMAR (kolom kanan)
// =====================================================================
function gambarDetailCabang() {
  const cabang = petaCabang[cabangTerpilih];
  if (!cabang) return;

  elNamaCabang.textContent = cabang.nama_cabang;
  elAlamatCabang.textContent = cabang.alamat;

  const kataCari = elCariKamar.value.trim().toLowerCase();
  const status = elFilterStatus.value;

  const kamarTampil = daftarKamar.filter(function (k) {
    if (k.cabang_id !== cabangTerpilih) return false;

    if (kataCari && String(k.nomor_kamar).toLowerCase().indexOf(kataCari) === -1) return false;

    if (status === "tersedia" && k.tersedia === false) return false;
    if (status === "terisi" && k.tersedia !== false) return false;

    return true;
  });

  if (kamarTampil.length === 0) {
    pesanKotak(elGridKamar, "Tidak ada kamar yang cocok dengan pencarian ini.");
    return;
  }

  elGridKamar.innerHTML = kamarTampil.map(function (k) {
    return kartuKamarHtml(k, cabang);
  }).join("");
}

// =====================================================================
// MENGGAMBAR ULANG SELURUH HALAMAN
// =====================================================================
function gambarSemua() {
  gambarRingkasan();
  gambarDaftarCabang();
  gambarDetailCabang();
}

// =====================================================================
// FORM TAMBAH KAMAR
// =====================================================================
// Pilihan cabang pada form diisi dari Firestore supaya tidak lagi
// ditulis manual di HTML. Form ini belum menyimpan ke database.
function isiPilihanCabangForm() {
  if (!elPilihCabangForm) return;

  elPilihCabangForm.innerHTML = Object.keys(petaCabang).map(function (id) {
    return '<option value="' + amankanTeks(id) + '">' +
           amankanTeks(petaCabang[id].nama_cabang) + "</option>";
  }).join("");
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  pesanKotak(elGridKamar, "Memuat data kamar...");
  pesanKotak(elDaftarCabang, "Memuat...");

  elCariKamar.addEventListener("input", gambarDetailCabang);
  elFilterStatus.addEventListener("change", gambarDetailCabang);

  try {
    petaCabang = await ambilPeta(COL_CABANG);
    isiPilihanCabangForm();

    // Cabang pertama dipilih otomatis saat halaman dibuka
    cabangTerpilih = Object.keys(petaCabang)[0] || null;

    if (!cabangTerpilih) {
      pesanKotak(elDaftarCabang, "Belum ada data cabang.");
      pesanKotak(elGridKamar, "Belum ada data cabang.");
      return;
    }

    pantauKamar(function (daftar) {
      daftarKamar = daftar;
      gambarSemua();
    }, gagalMuat);

    // Transaksi dipantau agar nama penyewa tiap kamar selalu terbaru
    pantauTransaksi(petaCabang, {}, function (daftar) {
      penghuniKamar = {};
      daftar.filter(sedangMenghuni).forEach(function (t) {
        if (t.kamar_id) penghuniKamar[t.kamar_id] = t;
      });
      gambarSemua();
    }, gagalMuat);
  } catch (err) {
    gagalMuat(err);
  }
}

function gagalMuat(err) {
  tampilkanError(err, function (pesan) {
    pesanKotak(elGridKamar, pesan, "error");
    pesanKotak(elDaftarCabang, pesan, "error");
  });
}

mulai();
