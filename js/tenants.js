/**
 * =====================================================================
 * DATA PENGHUNI (halaman super-admin/tenants.html)
 * =====================================================================
 * Berkas ini mengurus MENAMPILKAN data:
 *   - tiga kartu statistik (aktif, bulanan, harian)
 *   - tabel penghuni, lengkap dengan pencarian dan tiga saringan
 *
 * Aksi yang MENGUBAH data (arsip, pulihkan) dan halaman detail berada
 * di js/tenants-crud.js, mengikuti pemisahan yang sudah dipakai halaman
 * Cabang dan Manajemen Pengguna.
 *
 * ---------------------------------------------------------------------
 * PENGHUNI BUKAN COLLECTION TERSENDIRI
 * ---------------------------------------------------------------------
 * Tidak ada collection "tenants". Seorang penghuni adalah KEADAAN dari
 * sebuah transaksi: transaksi yang sudah lunas dan kamarnya sudah
 * ditentukan admin. Karena itu halaman ini membaca
 * "transaksi_pemesanan" lalu menyaringnya, sama seperti halaman
 * Pemesanan, Check-in, dan Alokasi Kamar.
 *
 * Alasannya: cabang, kamar, tanggal, dan tipe sewa sudah tersimpan di
 * transaksi. Menyalinnya ke collection lain berarti dua sumber
 * kebenaran yang harus disamakan setiap kali admin mengalokasikan
 * kamar, melakukan check-in, atau penyewa memperpanjang -- dan satu
 * jalur yang terlewat membuat datanya melenceng tanpa ketahuan.
 *
 * ---------------------------------------------------------------------
 * PENYEWA UTAMA vs PENGHUNI TAMBAHAN
 * ---------------------------------------------------------------------
 * Satu unit sewa bulanan bisa dihuni lebih dari satu orang. Yang
 * ditampilkan di kolom Nama HANYALAH penyewa utama (nama_penyewa),
 * yaitu penanggung jawab kontraknya. Anggota lain tersimpan pada array
 * "penghuni_tambahan" dan baru muncul di halaman Detail.
 *
 * Sewa harian selalu punya "penghuni_tambahan" berisi array kosong,
 * sehingga bentuk datanya tetap sama untuk kedua tipe sewa.
 *
 * Catatan: transaksi hasil seed-data.js TIDAK memiliki field ini sama
 * sekali (bukan array kosong, melainkan tidak ada), jadi setiap
 * pembacaan wajib memakai Array.isArray().
 * =====================================================================
 */

import {
  collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_TRANSAKSI, COL_CABANG, COL_KAMAR } from "./firebase-init.js";

import {
  keDate, formatTanggal, labelDurasi, labelSisaHari, statusLunas,
  amankanTeks, inisial, tautanWa, pesanTabel
} from "./admin-util.js";

import { tentukanStatus } from "./status-pesanan.js";
import { siapkanCrudPenghuni, diarsipkan } from "./tenants-crud.js";

// =====================================================================
// 1. KEADAAN HALAMAN
// =====================================================================
let daftarTransaksi = [];
let petaCabang = {};
let petaKamar = {};

let siapTransaksi = false;

// =====================================================================
// 2. ELEMEN HALAMAN
// =====================================================================
const elStatAktif = document.getElementById("statPenghuniAktif");
const elStatBulanan = document.getElementById("statPenghuniBulanan");
const elStatHarian = document.getElementById("statPenghuniHarian");

const elTubuhTabel = document.getElementById("tenantsTableBody");
const elJumlahTampil = document.getElementById("tenantsInfoJumlah");

const elCari = document.getElementById("searchTenant");
const elSaringTipe = document.getElementById("filterTipeSewa");
const elSaringCabang = document.getElementById("filterCabangPenghuni");
const elSaringStatus = document.getElementById("filterStatusSewa");

const JUMLAH_KOLOM = 7;

// =====================================================================
// 3. SIAPA YANG DIANGGAP PENGHUNI
// =====================================================================

/**
 * Seseorang masuk daftar penghuni bila transaksinya sudah lunas DAN
 * kamarnya sudah ditentukan admin.
 *
 * Syarat kamar itu penting: transaksi yang sudah dibayar tetapi belum
 * dialokasikan kamar belum bisa disebut penghuni -- kolom Cabang &
 * Kamar-nya akan kosong dan barisnya hanya menambah keriuhan. Mereka
 * sudah punya halamannya sendiri, yaitu Alokasi Kamar.
 */
export function termasukPenghuni(t) {
  return statusLunas(t.transaction_status) && !!t.kamar_id;
}

/**
 * Penghuni yang saat ini benar-benar menempati kamarnya.
 * Definisinya sengaja sama dengan sedangMenghuni() di admin-data.js
 * supaya angka kartu di halaman ini tidak pernah berbeda dengan
 * angka di Dashboard.
 */
export function sedangMenghuni(t) {
  return t.status_checkin === "checked_in";
}

// =====================================================================
// 4. STATISTIK
// ---------------------------------------------------------------------
// Ketiga kartu hanya menghitung yang SEDANG menempati kamar, dan tidak
// menghitung yang sudah diarsipkan. Angkanya juga tidak ikut berubah
// saat admin mengetik di kotak pencarian -- kartu menggambarkan
// keadaan kos, bukan hasil pencarian.
// =====================================================================
export function hitungStatistik(daftar) {
  const aktif = daftar.filter(function (t) {
    return termasukPenghuni(t) && sedangMenghuni(t) && !diarsipkan(t);
  });

  return {
    aktif: aktif.length,
    bulanan: aktif.filter(function (t) { return t.tipe_sewa === "bulanan"; }).length,
    harian: aktif.filter(function (t) { return t.tipe_sewa === "harian"; }).length
  };
}

// =====================================================================
// 5. PENCARIAN & SARINGAN
// =====================================================================

/**
 * Kunci status yang dipakai saringan. Diturunkan dari status_checkin
 * dan penanda arsip, bukan disimpan sebagai field tersendiri.
 */
export function kunciStatus(t) {
  if (diarsipkan(t)) return "diarsipkan";
  if (t.status_checkin === "checked_out") return "selesai";
  if (t.status_checkin === "checked_in") return "menghuni";
  return "akan-masuk";
}

/**
 * Menyaring daftar penghuni.
 * Ditulis sebagai fungsi murni (tanpa menyentuh DOM) supaya tiap
 * aturannya bisa diuji satu per satu.
 *
 * @param {Array}  daftar
 * @param {Object} pilihan - { cari, tipe, cabang, status }
 */
export function saringPenghuni(daftar, pilihan) {
  const kunci = String(pilihan.cari || "").trim().toLowerCase();

  return daftar.filter(function (t) {
    if (!termasukPenghuni(t)) return false;

    // Yang diarsipkan disembunyikan, KECUALI bila saringan status
    // memang sedang meminta yang diarsipkan. Tanpa pengecualian ini,
    // data yang sudah diarsipkan tidak akan pernah bisa dipulihkan.
    if (diarsipkan(t) && pilihan.status !== "diarsipkan") return false;

    if (pilihan.tipe && pilihan.tipe !== "semua" && t.tipe_sewa !== pilihan.tipe) {
      return false;
    }

    if (pilihan.cabang && pilihan.cabang !== "semua" && t.cabang_id !== pilihan.cabang) {
      return false;
    }

    if (pilihan.status && pilihan.status !== "semua" && kunciStatus(t) !== pilihan.status) {
      return false;
    }

    if (!kunci) return true;

    // Pencarian mencakup penghuni tambahan juga: admin yang mencari
    // "Siti" harus tetap menemukan kamarnya walaupun Siti bukan
    // penyewa utamanya.
    const anggota = Array.isArray(t.penghuni_tambahan) ? t.penghuni_tambahan : [];

    const bahan = [
      t.nama_penyewa,
      t.kontak_penyewa,
      t.nomor_kamar,
      t.nama_cabang,
      t.order_id
    ].concat(anggota.map(function (p) { return p.nama; }));

    return bahan.some(function (nilai) {
      return String(nilai || "").toLowerCase().indexOf(kunci) !== -1;
    });
  });
}

// =====================================================================
// 6. MENGGAMBAR TABEL
// =====================================================================

/** Kolom Cabang & Kamar. */
function selCabangKamar(t) {
  return '<div class="flex flex-col">' +
    '<span class="font-body-sm text-body-sm text-ink-primary">' +
    amankanTeks(t.nama_cabang || "-") + "</span>" +
    '<span class="font-body-sm text-body-sm text-ink-muted">Kamar ' +
    amankanTeks(t.nomor_kamar || "-") + "</span>" +
    "</div>";
}

/** Lencana tipe sewa. */
function lencanaTipe(tipe) {
  const bulanan = tipe === "bulanan";
  const gaya = bulanan
    ? "bg-primary-container/10 text-primary-container border border-primary-container/20"
    : "bg-surface-variant text-ink-secondary border border-border-hairline";

  return '<span class="inline-flex items-center px-sm py-xxs rounded-full font-badge text-badge ' +
    gaya + '">' + (bulanan ? "Bulanan" : "Harian") + "</span>";
}

/**
 * Kolom Masa Sewa: rentang tanggal, ditambah sisa waktu bagi yang
 * masih menghuni supaya admin langsung tahu mana yang segera habis.
 */
function selMasaSewa(t) {
  const rentang = formatTanggal(t.tanggal_checkin) + " – " + formatTanggal(t.tanggal_checkout);

  const keterangan = sedangMenghuni(t)
    ? labelSisaHari(t.tanggal_checkout)
    : labelDurasi(t);

  return '<div class="flex flex-col">' +
    '<span class="font-body-sm text-body-sm text-ink-primary whitespace-nowrap">' +
    amankanTeks(rentang) + "</span>" +
    '<span class="font-body-sm text-body-sm text-ink-muted">' +
    amankanTeks(keterangan) + "</span>" +
    "</div>";
}

/** Kolom Status Sewa. */
function selStatus(t) {
  // Yang diarsipkan diberi lencana tersendiri, karena status sewanya
  // tidak berubah -- yang berubah hanyalah keikutsertaannya di daftar.
  if (diarsipkan(t)) {
    return '<span class="inline-flex items-center gap-xxs px-sm py-xxs rounded-full ' +
      'bg-surface-container-high text-on-surface-variant font-badge text-badge">' +
      '<span class="material-symbols-outlined text-[14px]">inventory_2</span>Diarsipkan</span>';
  }

  const status = tentukanStatus(t);

  return '<span class="inline-flex items-center gap-xxs px-sm py-xxs rounded-full ' +
    'font-badge text-badge ' + status.kelas + '">' +
    '<span class="material-symbols-outlined text-[14px]">' + status.ikon + "</span>" +
    amankanTeks(status.label) + "</span>";
}

/** Kolom Nama: HANYA penyewa utama, sesuai aturan halaman ini. */
function selNama(t) {
  const anggota = Array.isArray(t.penghuni_tambahan) ? t.penghuni_tambahan : [];
  const nama = t.nama_penyewa || "-";

  // Jumlah anggota lain ditunjukkan sebagai angka saja, bukan namanya.
  // Namanya baru terbaca di halaman Detail.
  const catatan = anggota.length > 0
    ? '<span class="font-body-sm text-body-sm text-ink-muted">+' + anggota.length +
      " penghuni lain</span>"
    : '<span class="font-body-sm text-body-sm text-ink-muted">' +
      amankanTeks(t.order_id || "-") + "</span>";

  return '<div class="flex items-center gap-sm">' +
    '<div class="w-9 h-9 rounded-full bg-primary-container/10 text-primary-container ' +
    'flex items-center justify-center font-label-md text-label-md shrink-0">' +
    amankanTeks(inisial(nama)) + "</div>" +
    '<div class="min-w-0">' +
    '<p class="font-title-md text-title-md text-ink-primary truncate">' +
    amankanTeks(nama) + "</p>" + catatan +
    "</div></div>";
}

/** Kolom No. WhatsApp. */
function selWhatsapp(t) {
  const nomor = t.kontak_penyewa;
  if (!nomor) return '<span class="font-body-sm text-body-sm text-ink-muted">-</span>';

  return '<a class="font-body-sm text-body-sm text-primary hover:underline whitespace-nowrap" ' +
    'href="' + tautanWa(nomor) + '" target="_blank" rel="noopener">' +
    amankanTeks(nomor) + "</a>";
}

/** Tombol aksi pada sebuah baris. */
function tombolAksi(t) {
  const tombol = function (aksi, ikon, judul, warna) {
    return '<button type="button" data-aksi="' + aksi + '" data-order="' +
      amankanTeks(t.order_id) + '" title="' + judul + '" ' +
      'class="p-sm rounded-lg hover:bg-surface-variant transition-colors ' + warna + '">' +
      '<span class="material-symbols-outlined text-[20px]">' + ikon + "</span></button>";
  };

  // Yang sudah diarsipkan menampilkan tombol Pulihkan, bukan Arsipkan.
  // Tanpa itu, data yang diarsipkan tidak akan pernah bisa kembali.
  const terakhir = diarsipkan(t)
    ? tombol("pulihkan", "restore_from_trash", "Pulihkan penghuni", "text-status-available")
    : tombol("arsip", "delete", "Arsipkan penghuni", "text-error");

  return '<div class="flex items-center justify-end gap-xxs">' +
    tombol("detail", "visibility", "Lihat detail", "text-ink-muted") +
    tombol("edit", "edit", "Edit data diri", "text-primary") +
    terakhir +
    "</div>";
}

function baris(t) {
  return '<tr class="hover:bg-surface-soft transition-colors">' +
    '<td class="px-base py-sm">' + selNama(t) + "</td>" +
    '<td class="px-base py-sm">' + selWhatsapp(t) + "</td>" +
    '<td class="px-base py-sm">' + selCabangKamar(t) + "</td>" +
    '<td class="px-base py-sm">' + lencanaTipe(t.tipe_sewa) + "</td>" +
    '<td class="px-base py-sm">' + selMasaSewa(t) + "</td>" +
    '<td class="px-base py-sm">' + selStatus(t) + "</td>" +
    '<td class="px-base py-sm text-right">' + tombolAksi(t) + "</td>" +
    "</tr>";
}

// =====================================================================
// 7. MENGGAMBAR SELURUH HALAMAN
// =====================================================================

/** Mengisi pilihan cabang pada saringan, sesuai isi Firestore. */
function isiPilihanCabang() {
  if (!elSaringCabang) return;

  const terpilih = elSaringCabang.value;

  const pilihan = Object.keys(petaCabang)
    .map(function (id) {
      return { id: id, nama: petaCabang[id].nama_cabang || id };
    })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  elSaringCabang.innerHTML =
    '<option value="semua">Semua Cabang</option>' +
    pilihan.map(function (c) {
      return '<option value="' + amankanTeks(c.id) + '">' + amankanTeks(c.nama) + "</option>";
    }).join("");

  // Pilihan yang sedang dipakai dikembalikan, supaya saringan admin
  // tidak ter-reset setiap kali data cabang berubah.
  if (terpilih) elSaringCabang.value = terpilih;
}

/** Menempelkan nama cabang dan nomor kamar ke setiap transaksi. */
function lengkapi(t) {
  const cabang = petaCabang[t.cabang_id];
  const kamar = t.kamar_id ? petaKamar[t.kamar_id] : null;

  t.nama_cabang = cabang ? cabang.nama_cabang : "-";
  t.nomor_kamar = kamar ? kamar.nomor_kamar : null;
  return t;
}

function gambar() {
  if (!elTubuhTabel) return;

  const lengkap = daftarTransaksi.map(lengkapi);

  // --- Kartu statistik ---
  const angka = hitungStatistik(lengkap);
  if (elStatAktif) elStatAktif.textContent = angka.aktif;
  if (elStatBulanan) elStatBulanan.textContent = angka.bulanan;
  if (elStatHarian) elStatHarian.textContent = angka.harian;

  // --- Tabel ---
  const tampil = saringPenghuni(lengkap, {
    cari: elCari ? elCari.value : "",
    tipe: elSaringTipe ? elSaringTipe.value : "semua",
    cabang: elSaringCabang ? elSaringCabang.value : "semua",
    status: elSaringStatus ? elSaringStatus.value : "semua"
  });

  const semuaPenghuni = lengkap.filter(termasukPenghuni);

  if (!siapTransaksi) {
    pesanTabel(elTubuhTabel, "Memuat data penghuni...", JUMLAH_KOLOM, "info");
  } else if (semuaPenghuni.length === 0) {
    pesanTabel(elTubuhTabel,
      "Belum ada penghuni. Penghuni muncul setelah pemesanan lunas dan kamarnya " +
      "dialokasikan lewat halaman Alokasi Kamar.", JUMLAH_KOLOM, "info");
  } else if (tampil.length === 0) {
    pesanTabel(elTubuhTabel,
      "Tidak ada penghuni yang cocok dengan pencarian dan saringan ini.",
      JUMLAH_KOLOM, "info");
  } else {
    // Yang masih menghuni ditaruh di atas, lalu diurutkan menurut
    // tanggal berakhirnya sewa -- yang paling dekat habis lebih dulu.
    elTubuhTabel.innerHTML = tampil
      .slice()
      .sort(function (a, b) {
        const selisih = (sedangMenghuni(b) ? 1 : 0) - (sedangMenghuni(a) ? 1 : 0);
        if (selisih !== 0) return selisih;
        return keDate(a.tanggal_checkout) - keDate(b.tanggal_checkout);
      })
      .map(baris)
      .join("");
  }

  if (elJumlahTampil) {
    elJumlahTampil.textContent = siapTransaksi
      ? "Menampilkan " + tampil.length + " dari " + semuaPenghuni.length + " penghuni"
      : "Memuat...";
  }
}

// =====================================================================
// 8. MEMANTAU FIRESTORE
// ---------------------------------------------------------------------
// Ketiganya memakai onSnapshot, sehingga tabel ikut berubah sendiri
// setiap kali ada perubahan -- termasuk sesudah admin mengarsipkan
// atau memulihkan penghuni dari halaman ini.
// =====================================================================
function saatGagal(err) {
  console.error("Gagal memuat data penghuni:", err);
  siapTransaksi = true;

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

    isiPilihanCabang();
    gambar();
  }, saatGagal);

  onSnapshot(collection(db, COL_KAMAR), function (cuplikan) {
    const peta = {};
    cuplikan.forEach(function (d) { peta[d.id] = d.data(); });
    petaKamar = peta;
    gambar();
  }, saatGagal);

  onSnapshot(collection(db, COL_TRANSAKSI), function (cuplikan) {
    const daftar = [];
    cuplikan.forEach(function (d) {
      daftar.push(Object.assign({ id: d.id }, d.data()));
    });
    daftarTransaksi = daftar;
    siapTransaksi = true;
    gambar();
  }, saatGagal);
}

// =====================================================================
// 9. MENYALAKAN HALAMAN
// =====================================================================
if (elTubuhTabel) {
  // Pencarian dan saringan bekerja pada data yang sudah ada di memori,
  // jadi tidak ada pembacaan Firestore tambahan saat mengetik.
  if (elCari) elCari.addEventListener("input", gambar);
  [elSaringTipe, elSaringCabang, elSaringStatus].forEach(function (el) {
    if (el) el.addEventListener("change", gambar);
  });

  const crud = siapkanCrudPenghuni({
    cariTransaksi: function (orderId) {
      return daftarTransaksi.map(lengkapi).filter(function (t) {
        return t.order_id === orderId;
      })[0] || null;
    },

    /**
     * Seluruh sewa milik penyewa yang sama, terbaru lebih dulu.
     * Dipakai halaman Detail untuk menampilkan riwayat sewa dan
     * perpanjangannya.
     *
     * Penyewa dikenali dari customer_username bila ada. Transaksi
     * hasil seeding tidak memilikinya, jadi dicocokkan dengan nama dan
     * nomor kontak sebagai cadangan.
     */
    riwayatSewa: function (transaksi) {
      return daftarTransaksi
        .map(lengkapi)
        .filter(function (t) {
          if (transaksi.customer_username) {
            return t.customer_username === transaksi.customer_username;
          }
          return t.nama_penyewa === transaksi.nama_penyewa &&
                 t.kontak_penyewa === transaksi.kontak_penyewa;
        })
        .sort(function (a, b) {
          return keDate(b.transaction_time) - keDate(a.transaction_time);
        });
    }
  });

  // Semua tombol pada baris ditangani lewat satu penyimak di <tbody>,
  // supaya baris yang digambar ulang tidak perlu dipasangi ulang.
  elTubuhTabel.addEventListener("click", function (e) {
    const tombol = e.target.closest("[data-aksi]");
    if (!tombol) return;
    crud.jalankanAksi(tombol.dataset.aksi, tombol.dataset.order);
  });

  gambar();
  mulaiMemantau();
}
