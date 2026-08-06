/**
 * =====================================================================
 * MANAJEMEN PENGGUNA (halaman super-admin/user-management.html)
 * =====================================================================
 * Berkas ini mengurus MENAMPILKAN data:
 *   - dua kartu statistik (jumlah admin & jumlah pelanggan)
 *   - tabel daftar pengguna, lengkap dengan pencarian & saringan peran
 *
 * Aksi yang MENGUBAH data (tambah, edit, hapus) berada di
 * js/user-crud.js, mengikuti pemisahan yang sudah dipakai halaman
 * Cabang (admin-branches.js vs admin-branches-crud.js).
 *
 * ---------------------------------------------------------------------
 * DUA SUMBER KOLOM "CABANG" YANG BERBEDA
 * ---------------------------------------------------------------------
 * Kolom Cabang diisi dari tempat yang berbeda tergantung peran:
 *
 *   ADMIN     -> dibaca dari field "cabang" pada dokumen user.
 *                Berupa array, diisi manual oleh super admin lewat form.
 *
 *   PELANGGAN -> TIDAK disimpan di dokumen user sama sekali.
 *                Dihitung saat ini juga dari transaksi aktif terkini
 *                miliknya. Bila belum pernah memesan, ditampilkan "-".
 *
 * Alasan pelanggan tidak menyimpan cabang: cabang seorang pelanggan
 * berubah setiap kali ia pindah atau menyewa lagi. Bila disalin ke
 * dokumen user, nilainya akan basi begitu ada transaksi baru dan harus
 * diperbarui di dua tempat.
 *
 * ---------------------------------------------------------------------
 * MENGAPA TRANSAKSI DIBACA SEKALIGUS, BUKAN PER PENGGUNA
 * ---------------------------------------------------------------------
 * Cara yang paling mudah dibayangkan adalah: untuk setiap pelanggan,
 * jalankan satu kueri mencari transaksinya. Dengan 100 pelanggan itu
 * berarti 100 kueri, dan masing-masing perlu composite index karena
 * menyaring dua field sekaligus lalu mengurutkannya.
 *
 * Di sini seluruh transaksi dibaca SATU KALI, lalu dikelompokkan per
 * username di memori. Hasilnya sama, tetapi tanpa index tambahan dan
 * jumlah pembacaannya tidak bertambah walau penggunanya bertambah.
 * =====================================================================
 */

import {
  collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_USER, COL_TRANSAKSI, COL_CABANG } from "./firebase-init.js";

import {
  ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_CUSTOMER, LABEL_ROLE, pakaiCabang
} from "./customer-auth.js";

import {
  keDate, formatTanggal, statusLunas, amankanTeks, inisial, pesanTabel
} from "./admin-util.js";

import { siapkanCrud } from "./user-crud.js";

// =====================================================================
// 1. KEADAAN HALAMAN
// ---------------------------------------------------------------------
// Ketiga data di bawah datang dari tiga pemantauan Firestore yang
// terpisah dan bisa tiba dalam urutan apa pun. Karena itu setiap kali
// salah satunya berubah, tabel digambar ulang seluruhnya -- lebih
// sederhana daripada menambal sebagian, dan jumlah datanya kecil.
// =====================================================================
let daftarUser = [];      // seluruh dokumen collection "user"
let petaCabang = {};      // { "pesona-kos": { nama_cabang: "Pesona Kos" } }
let daftarTransaksi = []; // seluruh dokumen transaksi_pemesanan

let siapUser = false;     // pemantauan user sudah pernah menjawab?

// =====================================================================
// 2. ELEMEN HALAMAN
// =====================================================================
const elStatAdmin = document.getElementById("statTotalAdmin");
const elStatPelanggan = document.getElementById("statTotalPelanggan");
const elTubuhTabel = document.getElementById("userTableBody");
const elJumlahTampil = document.getElementById("userInfoJumlah");
const elCari = document.getElementById("searchUser");
const elSaringPeran = document.getElementById("filterPeran");

const JUMLAH_KOLOM = 4;

// =====================================================================
// 3. MENGHITUNG CABANG PELANGGAN DARI TRANSAKSI
// =====================================================================

/**
 * Sebuah transaksi disebut AKTIF bila:
 *   1. pembayarannya sudah lunas (settlement / capture), dan
 *   2. penyewanya belum check-out.
 *
 * Transaksi yang belum dibayar tidak dihitung karena bisa saja
 * kadaluarsa, dan yang sudah check-out tidak dihitung karena
 * penyewanya memang sudah tidak berada di cabang itu lagi.
 *
 * Termasuk di dalamnya transaksi yang sudah lunas tetapi kamarnya belum
 * dialokasikan admin -- pelanggannya memang sudah terikat ke cabang itu
 * walaupun nomor kamarnya belum ditentukan.
 */
export function transaksiAktif(t) {
  return statusLunas(t.transaction_status) && t.status_checkin !== "checked_out";
}

/**
 * Mengelompokkan transaksi aktif per pemiliknya, lalu mengambil yang
 * paling baru untuk masing-masing.
 *
 * @returns {Object} { "budi": { transaksi } }
 */
function petakanTransaksiAktif() {
  const hasil = {};

  daftarTransaksi.forEach(function (t) {
    // Transaksi hasil seeding tidak punya customer_username, jadi tidak
    // dimiliki akun mana pun dan memang tidak boleh dihitung.
    if (!t.customer_username) return;
    if (!transaksiAktif(t)) return;

    const pemilik = t.customer_username;
    const sebelumnya = hasil[pemilik];

    if (!sebelumnya || keDate(t.transaction_time) > keDate(sebelumnya.transaction_time)) {
      hasil[pemilik] = t;
    }
  });

  return hasil;
}

/** Mengubah id cabang menjadi namanya. Id tak dikenal ditampilkan apa adanya. */
function namaCabang(idCabang) {
  const cabang = petaCabang[idCabang];
  return cabang && cabang.nama_cabang ? cabang.nama_cabang : idCabang;
}

/**
 * Menentukan daftar cabang yang ditampilkan pada satu baris tabel.
 * Mengembalikan array nama cabang; kosong berarti ditampilkan "-".
 */
export function cabangUntukBaris(pengguna, petaAktif) {
  // --- ADMIN: dari field "cabang" yang diisi manual ---
  if (pakaiCabang(pengguna.role)) {
    const daftar = Array.isArray(pengguna.cabang) ? pengguna.cabang : [];
    return daftar.map(namaCabang);
  }

  // --- SUPER ADMIN: wewenangnya menyeluruh, tidak didaftar per cabang ---
  if (pengguna.role === ROLE_SUPERADMIN) return [];

  // --- PELANGGAN: dari transaksi aktif terkini ---
  const transaksi = petaAktif[pengguna.username];
  if (!transaksi) return [];

  return [namaCabang(transaksi.cabang_id)];
}

// =====================================================================
// 4. MENGGAMBAR TABEL
// =====================================================================

/** Lencana peran, memakai warna yang sudah dipakai halaman lain. */
function lencanaPeran(role) {
  const gaya = {
    superadmin: "bg-primary-container/10 text-primary-container border border-primary-container/20",
    admin: "bg-status-warning/10 text-status-warning border border-status-warning/20",
    customer: "bg-surface-variant text-ink-secondary border border-border-hairline"
  };

  return '<span class="inline-flex items-center px-sm py-xxs rounded-full font-badge text-badge ' +
    (gaya[role] || gaya.customer) + '">' +
    amankanTeks(LABEL_ROLE[role] || role) + "</span>";
}

/** Kolom cabang: beberapa lencana kecil, atau "-" bila kosong. */
function selCabang(pengguna, daftarNama) {
  if (daftarNama.length === 0) {
    // Super admin bukan "belum punya cabang", melainkan meliputi semua.
    const keterangan = pengguna.role === ROLE_SUPERADMIN ? "Seluruh cabang" : "-";
    return '<span class="font-body-sm text-body-sm text-ink-muted">' + keterangan + "</span>";
  }

  return '<div class="flex flex-wrap gap-xxs">' +
    daftarNama.map(function (nama) {
      return '<span class="inline-flex items-center px-sm py-xxs rounded-full bg-surface-variant ' +
        'text-ink-secondary border border-border-hairline font-badge text-badge">' +
        amankanTeks(nama) + "</span>";
    }).join("") +
    "</div>";
}

/** Tombol aksi pada sebuah baris. */
function tombolAksi(pengguna) {
  const tombol = function (aksi, ikon, judul, warna) {
    return '<button type="button" data-aksi="' + aksi + '" data-username="' +
      amankanTeks(pengguna.username) + '" title="' + judul + '" ' +
      'class="p-sm rounded-lg hover:bg-surface-variant transition-colors ' + warna + '">' +
      '<span class="material-symbols-outlined text-[20px]">' + ikon + "</span></button>";
  };

  return '<div class="flex items-center justify-end gap-xxs">' +
    tombol("detail", "visibility", "Lihat detail", "text-ink-muted") +
    tombol("edit", "edit", "Edit pengguna", "text-primary") +
    tombol("hapus", "delete", "Hapus pengguna", "text-error") +
    "</div>";
}

/** Satu baris tabel. */
function baris(pengguna, petaAktif) {
  const nama = pengguna.fullName || pengguna.username;

  return '<tr class="hover:bg-surface-soft transition-colors">' +

    // --- Nama ---
    '<td class="px-base py-sm">' +
    '<div class="flex items-center gap-sm">' +
    '<div class="w-9 h-9 rounded-full bg-primary-container/10 text-primary-container ' +
    'flex items-center justify-center font-label-md text-label-md shrink-0">' +
    amankanTeks(inisial(nama)) + "</div>" +
    "<div class=\"min-w-0\">" +
    '<p class="font-title-md text-title-md text-ink-primary truncate">' + amankanTeks(nama) + "</p>" +
    '<p class="font-body-sm text-body-sm text-ink-muted truncate">@' +
    amankanTeks(pengguna.username) + "</p>" +
    "</div></div></td>" +

    // --- Peran ---
    '<td class="px-base py-sm">' + lencanaPeran(pengguna.role) + "</td>" +

    // --- Cabang ---
    '<td class="px-base py-sm">' + selCabang(pengguna, cabangUntukBaris(pengguna, petaAktif)) + "</td>" +

    // --- Aksi ---
    '<td class="px-base py-sm text-right">' + tombolAksi(pengguna) + "</td>" +

    "</tr>";
}

/**
 * Menyaring daftar pengguna sesuai kotak pencarian dan saringan peran.
 * Dipisah menjadi fungsi tersendiri supaya bisa diuji tanpa DOM.
 */
export function saringPengguna(daftar, kataKunci, peran) {
  const kunci = String(kataKunci || "").trim().toLowerCase();

  return daftar.filter(function (u) {
    if (peran && peran !== "semua" && u.role !== peran) return false;
    if (!kunci) return true;

    return String(u.fullName || "").toLowerCase().indexOf(kunci) !== -1 ||
           String(u.username || "").toLowerCase().indexOf(kunci) !== -1;
  });
}

/** Menggambar ulang kartu statistik dan tabel. */
function gambar() {
  if (!elTubuhTabel) return;

  // --- Kartu statistik: dihitung dari SELURUH pengguna, bukan hasil
  //     saringan, supaya angkanya tidak ikut berubah saat mencari ---
  const jumlahAdmin = daftarUser.filter(function (u) { return u.role === ROLE_ADMIN; }).length;
  const jumlahPelanggan = daftarUser.filter(function (u) { return u.role === ROLE_CUSTOMER; }).length;

  if (elStatAdmin) elStatAdmin.textContent = jumlahAdmin;
  if (elStatPelanggan) elStatPelanggan.textContent = jumlahPelanggan;

  // --- Tabel ---
  const petaAktif = petakanTransaksiAktif();

  const tampil = saringPengguna(
    daftarUser,
    elCari ? elCari.value : "",
    elSaringPeran ? elSaringPeran.value : "semua"
  );

  if (!siapUser) {
    pesanTabel(elTubuhTabel, "Memuat data pengguna...", JUMLAH_KOLOM, "info");
  } else if (daftarUser.length === 0) {
    pesanTabel(elTubuhTabel, "Belum ada pengguna terdaftar.", JUMLAH_KOLOM, "info");
  } else if (tampil.length === 0) {
    pesanTabel(elTubuhTabel, "Tidak ada pengguna yang cocok dengan pencarian.", JUMLAH_KOLOM, "info");
  } else {
    // Urutan: super admin, admin, lalu pelanggan; masing-masing menurut nama
    const urutanPeran = { superadmin: 0, admin: 1, customer: 2 };

    elTubuhTabel.innerHTML = tampil
      .slice()
      .sort(function (a, b) {
        const selisih = (urutanPeran[a.role] ?? 9) - (urutanPeran[b.role] ?? 9);
        if (selisih !== 0) return selisih;
        return String(a.fullName || a.username).localeCompare(String(b.fullName || b.username));
      })
      .map(function (u) { return baris(u, petaAktif); })
      .join("");
  }

  if (elJumlahTampil) {
    elJumlahTampil.textContent = siapUser
      ? "Menampilkan " + tampil.length + " dari " + daftarUser.length + " pengguna"
      : "Memuat...";
  }
}

// =====================================================================
// 5. DATA YANG DIPAKAI BERSAMA user-crud.js
// =====================================================================

/** Daftar cabang untuk mengisi pilihan multi-select pada form admin. */
function ambilDaftarCabang() {
  return Object.keys(petaCabang)
    .map(function (id) {
      return { id: id, nama: petaCabang[id].nama_cabang || id };
    })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });
}

/** Mencari satu pengguna dari data yang sudah dimuat. */
function cariDiDaftar(username) {
  return daftarUser.filter(function (u) { return u.username === username; })[0] || null;
}

/**
 * Seluruh transaksi milik satu pengguna, terbaru lebih dulu.
 * Dipakai modal Detail untuk menampilkan riwayat cabangnya.
 */
function riwayatTransaksi(username) {
  return daftarTransaksi
    .filter(function (t) { return t.customer_username === username; })
    .sort(function (a, b) { return keDate(b.transaction_time) - keDate(a.transaction_time); })
    .map(function (t) {
      return {
        order_id: t.order_id,
        cabang: namaCabang(t.cabang_id),
        tanggal: formatTanggal(t.transaction_time),
        aktif: transaksiAktif(t)
      };
    });
}

/** Berapa banyak super admin yang tersisa -- dipakai untuk mencegah 0 super admin. */
function jumlahSuperAdmin() {
  return daftarUser.filter(function (u) { return u.role === ROLE_SUPERADMIN; }).length;
}

// =====================================================================
// 6. MEMANTAU FIRESTORE
// ---------------------------------------------------------------------
// Ketiganya memakai onSnapshot, sehingga tabel ikut berubah sendiri
// setiap kali ada penambahan, penyuntingan, atau penghapusan -- baik
// dari halaman ini maupun langsung dari Firebase Console.
// =====================================================================
function saatGagal(err) {
  console.error("Gagal memuat data pengguna:", err);
  siapUser = true;

  if (elTubuhTabel) {
    pesanTabel(elTubuhTabel,
      "Gagal memuat data: " + err.message + ". Periksa koneksi internet dan Firestore Rules.",
      JUMLAH_KOLOM, "error");
  }
  if (elJumlahTampil) elJumlahTampil.textContent = "Gagal memuat data";
}

function mulaiMemantau() {
  onSnapshot(collection(db, COL_CABANG), function (cuplikan) {
    const peta = {};
    cuplikan.forEach(function (d) { peta[d.id] = d.data(); });
    petaCabang = peta;

    // Pilihan cabang pada form ikut diperbarui bila ada cabang baru
    perbaruiPilihanCabang();
    gambar();
  }, saatGagal);

  onSnapshot(collection(db, COL_TRANSAKSI), function (cuplikan) {
    const daftar = [];
    cuplikan.forEach(function (d) {
      daftar.push(Object.assign({ id: d.id }, d.data()));
    });
    daftarTransaksi = daftar;
    gambar();
  }, saatGagal);

  onSnapshot(collection(db, COL_USER), function (cuplikan) {
    const daftar = [];
    cuplikan.forEach(function (d) {
      daftar.push(Object.assign({ uid: d.id }, d.data()));
    });
    daftarUser = daftar;
    siapUser = true;
    gambar();
  }, saatGagal);
}

// =====================================================================
// 7. MENYALAKAN HALAMAN
// =====================================================================
let perbaruiPilihanCabang = function () {};

if (elTubuhTabel) {
  // Pencarian dan saringan bekerja pada data yang sudah ada di memori,
  // jadi tidak ada pembacaan Firestore tambahan saat mengetik.
  if (elCari) elCari.addEventListener("input", gambar);
  if (elSaringPeran) elSaringPeran.addEventListener("change", gambar);

  const crud = siapkanCrud({
    ambilDaftarCabang: ambilDaftarCabang,
    cariPenggunaDiDaftar: cariDiDaftar,
    riwayatTransaksi: riwayatTransaksi,
    jumlahSuperAdmin: jumlahSuperAdmin,
    cabangUntukBaris: function (pengguna) {
      return cabangUntukBaris(pengguna, petakanTransaksiAktif());
    }
  });

  perbaruiPilihanCabang = crud.perbaruiPilihanCabang;

  // Semua tombol pada baris ditangani lewat satu penyimak di <tbody>,
  // supaya baris yang digambar ulang tidak perlu dipasangi ulang.
  elTubuhTabel.addEventListener("click", function (e) {
    const tombol = e.target.closest("[data-aksi]");
    if (!tombol) return;
    crud.jalankanAksi(tombol.dataset.aksi, tombol.dataset.username);
  });

  gambar();
  mulaiMemantau();
}
