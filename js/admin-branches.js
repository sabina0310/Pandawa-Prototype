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

// Seluruh aksi tulis (tambah/ubah/hapus) berada di file terpisah
import {
  pasangTombolSimpan,
  siapkanTambahCabang,
  isiFormCabang,
  isiFormKamar,
  mintaHapusCabang,
  mintaHapusKamar
} from "./admin-branches-crud.js";

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

// --- Hak ubah -------------------------------------------------------
// Berkas ini dipakai bersama oleh portal Super Admin dan portal Admin.
// Di portal Admin, data cabang & kamar hanya boleh DILIHAT: menambah,
// mengubah, dan menghapusnya adalah wewenang Super Admin.
//
// Pembedanya ditulis di HTML (atribut data-tanpa-ubah pada <body>),
// bukan ditebak dari alamat halaman, supaya niatnya terbaca jelas saat
// membuka berkas HTML-nya dan mudah dipindah bila strukturnya berubah.
const bolehUbah = !document.body.hasAttribute("data-tanpa-ubah");

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

  // Walau belum ada cabang sama sekali, tombol tambah tetap harus
  // tampil -- kalau tidak, cabang pertama mustahil dibuat.
  const pesanKosong = daftarId.length === 0
    ? '<p class="font-body-sm text-body-sm text-ink-muted px-sm py-md text-center">Belum ada cabang.</p>'
    : '';

  elDaftarCabang.innerHTML = pesanKosong + daftarId.map(function (id) {
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
  }).join("")
  // Tombol tambah cabang ikut digambar di sini karena daftar cabang
  // seluruhnya dibuat ulang setiap kali data berubah.
  + (bolehUbah
    ? '<button id="openAddBranchBtn" ' +
      'class="flex items-center justify-center gap-xs p-base border-2 border-dashed border-outline-variant ' +
      'text-ink-muted rounded-xl hover:border-primary hover:text-primary hover:bg-primary-container/10 transition-all mt-sm">' +
      '<span class="material-symbols-outlined">add_circle</span>' +
      '<span class="font-button-md">Tambah Cabang</span>' +
      '</button>'
    : '');

  elDaftarCabang.querySelectorAll(".branch-select-btn").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      cabangTerpilih = tombol.dataset.cabangId;
      gambarSemua();
    });
  });

  const tombolTambahCabang = document.getElementById("openAddBranchBtn");
  if (tombolTambahCabang) {
    tombolTambahCabang.addEventListener("click", function () {
      siapkanTambahCabang();
      bukaHalaman(elHalamanCabang);
    });
  }
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
    '<div class="flex items-center gap-xs">' +
    '<span class="text-xs text-ink-muted mr-xs">' + amankanTeks(kamar.id) + '</span>' +
    (bolehUbah
      ? '<button data-edit-kamar="' + amankanTeks(kamar.id) + '" title="Edit kamar" ' +
        'class="text-ink-muted hover:text-primary hover:bg-surface-soft p-1 rounded-full transition-colors">' +
        '<span class="material-symbols-outlined text-[20px]">edit</span></button>' +
        '<button data-hapus-kamar="' + amankanTeks(kamar.id) + '" title="Hapus kamar" ' +
        'class="text-ink-muted hover:text-error hover:bg-error-container p-1 rounded-full transition-colors">' +
        '<span class="material-symbols-outlined text-[20px]">delete</span></button>'
      : '') +
    '</div>' +
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

  if (!cabang) {
    elNamaCabang.textContent = "Belum ada cabang";
    elAlamatCabang.textContent = "Tambahkan cabang terlebih dahulu lewat tombol di sebelah kiri.";
    pesanKotak(elGridKamar, "Belum ada cabang yang dapat ditampilkan.");
    return;
  }

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

  // Tombol pada kartu dibuat ulang tiap kali grid digambar,
  // jadi pemasangan aksinya juga harus diulang di sini.
  elGridKamar.querySelectorAll("[data-edit-kamar]").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      const kamar = daftarKamar.find(function (k) { return k.id === tombol.dataset.editKamar; });
      if (!kamar) return;

      isiFormKamar(kamar, cabang.nama_cabang);
      bukaHalaman(elHalamanEditKamar);
    });
  });

  elGridKamar.querySelectorAll("[data-hapus-kamar]").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      const kamar = daftarKamar.find(function (k) { return k.id === tombol.dataset.hapusKamar; });
      if (kamar) mintaHapusKamar(kamar);
    });
  });
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
// PERPINDAHAN ANTAR HALAMAN FORM
// ---------------------------------------------------------------------
// Halaman daftar dan ketiga halaman form berada di berkas HTML yang
// sama; yang berpindah hanyalah mana yang ditampilkan.
// =====================================================================
const elTampilanDaftar = document.getElementById("branchesListView");
const elHalamanKamar = document.getElementById("addRoomPage");
const elHalamanCabang = document.getElementById("addBranchPage");
const elHalamanEditKamar = document.getElementById("editRoomPage");

const semuaHalamanForm = [elHalamanKamar, elHalamanCabang, elHalamanEditKamar];

function bukaHalaman(halaman) {
  if (!halaman || !elTampilanDaftar) return;

  elTampilanDaftar.classList.add("hidden");

  semuaHalamanForm.forEach(function (h) {
    if (!h) return;
    const aktif = h === halaman;
    h.classList.toggle("hidden", !aktif);
    h.classList.toggle("flex", aktif);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function tutupHalaman(form) {
  if (!elTampilanDaftar) return;

  semuaHalamanForm.forEach(function (h) {
    if (!h) return;
    h.classList.add("hidden");
    h.classList.remove("flex");
  });

  elTampilanDaftar.classList.remove("hidden");
  if (form) form.reset();
}

/** Memasang tombol Tutup (X) dan Batal pada ketiga halaman form. */
function pasangTombolTutup() {
  const pasangan = [
    { tombol: "closeAddRoomBtn", form: "addRoomForm" },
    { tombol: "cancelAddRoomBtn", form: "addRoomForm" },
    { tombol: "closeAddBranchBtn", form: "addBranchForm" },
    { tombol: "cancelAddBranchBtn", form: "addBranchForm" },
    { tombol: "closeEditRoomBtn", form: "editRoomForm" },
    { tombol: "cancelEditRoomBtn", form: "editRoomForm" }
  ];

  pasangan.forEach(function (p) {
    const tombol = document.getElementById(p.tombol);
    if (!tombol) return;

    tombol.addEventListener("click", function (e) {
      e.preventDefault();
      tutupHalaman(document.getElementById(p.form));
    });
  });
}

/** Memasang tombol Edit Info Cabang, Tambah Kamar, dan Hapus Cabang. */
function pasangTombolAksiCabang() {
  const tombolEditCabang = document.getElementById("editBranchInfoBtn");
  const tombolTambahKamar = document.getElementById("openAddRoomBtn");
  const tombolHapusCabang = document.getElementById("hapusCabangBtn");

  if (tombolEditCabang) {
    tombolEditCabang.addEventListener("click", function () {
      if (!cabangTerpilih) return;
      isiFormCabang(cabangTerpilih, petaCabang[cabangTerpilih]);
      bukaHalaman(elHalamanCabang);
    });
  }

  if (tombolTambahKamar) {
    tombolTambahKamar.addEventListener("click", function () {
      // Cabang yang sedang dibuka otomatis terpilih pada form
      if (elPilihCabangForm && cabangTerpilih) {
        elPilihCabangForm.value = cabangTerpilih;
      }
      bukaHalaman(elHalamanKamar);
    });
  }

  if (tombolHapusCabang) {
    tombolHapusCabang.addEventListener("click", function () {
      if (!cabangTerpilih) return;

      const kamarCabang = daftarKamar.filter(function (k) {
        return k.cabang_id === cabangTerpilih;
      });

      mintaHapusCabang(cabangTerpilih, petaCabang[cabangTerpilih], kamarCabang, async function () {
        // Cabang terhapus -> ambil ulang daftarnya, pilihan otomatis
        // berpindah ke cabang lain yang masih ada
        cabangTerpilih = null;
        await muatUlangCabang();
      });
    });
  }
}

// =====================================================================
// FORM TAMBAH KAMAR
// =====================================================================
// Pilihan cabang pada form diisi dari Firestore supaya tidak lagi
// ditulis manual di HTML.
function isiPilihanCabangForm() {
  if (!elPilihCabangForm) return;

  elPilihCabangForm.innerHTML = Object.keys(petaCabang).map(function (id) {
    return '<option value="' + amankanTeks(id) + '">' +
           amankanTeks(petaCabang[id].nama_cabang) + "</option>";
  }).join("");
}

/**
 * Mengambil ulang daftar cabang dari Firestore lalu menggambar ulang
 * halaman. Dipanggil setiap selesai menambah, mengubah, atau menghapus
 * cabang -- data kamar sudah real-time lewat onSnapshot, tetapi data
 * cabang sengaja diambil sekali saja karena jarang berubah.
 */
async function muatUlangCabang() {
  petaCabang = await ambilPeta(COL_CABANG);
  isiPilihanCabangForm();

  // Bila cabang yang sedang dibuka ternyata sudah terhapus,
  // pindahkan pilihan ke cabang mana pun yang tersisa.
  if (!cabangTerpilih || !petaCabang[cabangTerpilih]) {
    cabangTerpilih = Object.keys(petaCabang)[0] || null;
  }

  gambarSemua();
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  pesanKotak(elGridKamar, "Memuat data kamar...");
  pesanKotak(elDaftarCabang, "Memuat...");

  elCariKamar.addEventListener("input", gambarDetailCabang);
  elFilterStatus.addEventListener("change", gambarDetailCabang);

  pasangTombolTutup();
  pasangTombolAksiCabang();

  // Setelah penyimpanan berhasil: muat ulang data, lalu tutup formnya
  pasangTombolSimpan(async function (form) {
    await muatUlangCabang();
    tutupHalaman(form);
  });

  try {
    petaCabang = await ambilPeta(COL_CABANG);
    isiPilihanCabangForm();

    // Cabang pertama dipilih otomatis saat halaman dibuka
    cabangTerpilih = Object.keys(petaCabang)[0] || null;

    // Halaman tetap digambar walau belum ada cabang sama sekali,
    // supaya tombol "Tambah Cabang" tetap bisa dipakai.
    gambarSemua();

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
