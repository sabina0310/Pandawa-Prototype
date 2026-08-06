/**
 * =====================================================================
 * HALAMAN RIWAYAT PESANAN (customer/history-order.html)
 * =====================================================================
 * Menampilkan seluruh pemesanan milik pengguna yang sedang login,
 * diurutkan dari yang terbaru.
 *
 * Penyaringnya memakai field "customer_username" pada collection
 * transaksi_pemesanan. Field itu diisi js/customer-data.js saat
 * pesanan dibuat.
 *
 * Pengurutan sengaja dikerjakan di browser (bukan orderBy Firestore)
 * supaya query cukup memakai satu filter kesamaan, sehingga tidak
 * memerlukan composite index. Jumlah pesanan per orang sedikit,
 * jadi tidak berpengaruh pada kecepatan.
 * =====================================================================
 */

import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_TRANSAKSI } from "./firebase-init.js";
import { ambilPeta, COL_CABANG } from "./admin-data.js";
import { ambilSesi } from "./customer-auth.js";
import {
  tentukanStatus, pesananUji, keteranganPesananUji
} from "./status-pesanan.js";
import { unduhKuitansi } from "./kuitansi.js";
import {
  formatTanggal,
  formatTanggalJam,
  formatRupiah,
  labelDurasi,
  labelMetodeBayar,
  statusLunas,
  amankanTeks,
  keDate
} from "./admin-util.js";

const elDaftar = document.getElementById("daftarRiwayat");
const elRingkasan = document.getElementById("ringkasanRiwayat");

// Disimpan agar tombol "Unduh Kuitansi" tidak perlu mengambil ulang
// data dari Firestore -- isinya sudah ada sejak daftar digambar.
const petaTransaksi = {};
let petaCabangAktif = {};

// =====================================================================
// 2. SATU KARTU PESANAN
// =====================================================================
function kartuPesanan(t, petaCabang) {
  const cabang = petaCabang[t.cabang_id];
  const namaCabang = cabang ? cabang.nama_cabang : "Cabang tidak ditemukan";
  const status = tentukanStatus(t);
  const bulanan = t.tipe_sewa === "bulanan";

  // Sewa bulanan menonjolkan tanggal jatuh tempo,
  // sewa harian menonjolkan rentang menginap.
  const labelAkhir = bulanan ? "Jatuh Tempo" : "Check-out";

  const barisKamar = t.kamar_id
    ? '<div class="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">' +
      '<span class="material-symbols-outlined text-[16px]">meeting_room</span>Kamar ' +
      amankanTeks(t.kamar_id) + '</div>'
    : '<div class="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">' +
      '<span class="material-symbols-outlined text-[16px]">meeting_room</span>' +
      'Nomor kamar ditentukan admin</div>';

  // Pesanan hasil generate untuk pengujian notifikasi diberi keterangan
  // di bagian paling atas kartu, sebelum apa pun yang lain, supaya
  // pembacanya tahu lebih dulu bahwa ini bukan pesanan sungguhan.
  const catatanUji = pesananUji(t)
    ? '<div class="p-base pb-0">' + keteranganPesananUji("kartu") + '</div>'
    : '';

  return '' +
    '<section class="bg-surface-canvas rounded-lg border border-border-hairline shadow-sm overflow-hidden">' +

      catatanUji +

      // --- Kepala kartu: nama kos + status ---
      '<div class="p-base border-b border-border-hairline flex flex-wrap justify-between items-start gap-sm">' +
        '<div class="flex flex-col gap-xs">' +
          '<h3 class="font-title-md text-title-md text-on-surface">' + amankanTeks(namaCabang) + '</h3>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant">' +
            'Dipesan ' + formatTanggalJam(t.transaction_time) + '</p>' +
        '</div>' +
        '<span class="flex items-center gap-xs px-sm py-xs rounded-full font-badge text-badge ' + status.kelas + '">' +
          '<span class="material-symbols-outlined text-[14px]">' + status.ikon + '</span>' +
          status.label +
        '</span>' +
      '</div>' +

      // --- Isi kartu: rincian sewa ---
      '<div class="p-base grid grid-cols-2 md:grid-cols-4 gap-base">' +
        '<div class="flex flex-col gap-xxs">' +
          '<span class="font-label-md text-label-md text-on-surface-variant">Tipe Sewa</span>' +
          '<span class="font-body-md text-body-md text-on-surface">' +
            (bulanan ? "Bulanan" : "Harian") + '</span>' +
        '</div>' +
        '<div class="flex flex-col gap-xxs">' +
          '<span class="font-label-md text-label-md text-on-surface-variant">Check-in</span>' +
          '<span class="font-body-md text-body-md text-on-surface">' +
            formatTanggal(t.tanggal_checkin) + '</span>' +
        '</div>' +
        '<div class="flex flex-col gap-xxs">' +
          '<span class="font-label-md text-label-md text-on-surface-variant">' + labelAkhir + '</span>' +
          '<span class="font-body-md text-body-md text-on-surface">' +
            formatTanggal(t.tanggal_checkout) + '</span>' +
        '</div>' +
        '<div class="flex flex-col gap-xxs">' +
          '<span class="font-label-md text-label-md text-on-surface-variant">Durasi</span>' +
          '<span class="font-body-md text-body-md text-on-surface">' + labelDurasi(t) + '</span>' +
        '</div>' +
      '</div>' +

      // --- Kaki kartu: nomor pesanan, kamar, total ---
      '<div class="px-base pb-base pt-sm border-t border-border-hairline flex flex-wrap justify-between items-end gap-sm">' +
        '<div class="flex flex-col gap-xs">' +
          '<div class="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">' +
            '<span class="material-symbols-outlined text-[16px]">receipt_long</span>' +
            amankanTeks(t.order_id) + '</div>' +
          barisKamar +
          '<div class="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">' +
            '<span class="material-symbols-outlined text-[16px]">payments</span>' +
            amankanTeks(labelMetodeBayar(t.payment_type)) + '</div>' +
        '</div>' +
        '<div class="text-right">' +
          '<div class="font-label-md text-label-md text-on-surface-variant">Total Pembayaran</div>' +
          '<div class="font-stat-display text-stat-display text-primary-container">' +
            formatRupiah(t.order_amount) + '</div>' +
        '</div>' +
      '</div>' +

      // --- Tombol tindakan ---
      tombolTindakan(t) +

    '</section>';
}

// =====================================================================
// 3. TOMBOL PADA TIAP KARTU
// ---------------------------------------------------------------------
// "Detail" membuka halaman tersendiri berisi seluruh isi pesanan,
// sedangkan "Unduh Kuitansi" langsung menghasilkan berkas PDF dengan
// bentuk yang sama seperti pada langkah terakhir pemesanan.
//
// Kuitansi baru ditawarkan bila pembayarannya sudah diterima, sebab
// kuitansi memang berfungsi sebagai bukti pembayaran.
// =====================================================================
function tombolTindakan(t) {
  const kuitansi = statusLunas(t.transaction_status)
    ? '<button type="button" data-kuitansi="' + amankanTeks(t.order_id) + '" ' +
        'class="flex-1 sm:flex-none bg-primary-container text-on-primary font-button-md text-button-md ' +
        'py-sm px-base rounded-lg hover:brightness-110 transition-all shadow-sm ' +
        'flex justify-center items-center gap-xs">' +
        '<span class="material-symbols-outlined text-[18px]">download</span>Unduh Kuitansi</button>'
    : "";

  return '<div class="px-base pb-base flex flex-col sm:flex-row sm:justify-end gap-sm">' +
           '<a href="detail-pesanan.html?order_id=' + encodeURIComponent(t.order_id) + '" ' +
             'class="flex-1 sm:flex-none bg-surface-canvas text-on-surface font-button-md text-button-md ' +
             'py-sm px-base rounded-lg border border-border-strong hover:bg-surface-container-high ' +
             'transition-colors flex justify-center items-center gap-xs no-underline">' +
             '<span class="material-symbols-outlined text-[18px]">visibility</span>Detail</a>' +
           kuitansi +
         '</div>';
}

// ---------------------------------------------------------------------
// Satu pendengar untuk seluruh kartu (event delegation), supaya kartu
// yang digambar ulang tidak perlu dipasangi pendengar satu per satu.
// ---------------------------------------------------------------------
elDaftar.addEventListener("click", function (e) {
  const tombol = e.target.closest("[data-kuitansi]");
  if (!tombol) return;

  const transaksi = petaTransaksi[tombol.dataset.kuitansi];
  if (!transaksi) return;

  unduhKuitansi(transaksi, petaCabangAktif[transaksi.cabang_id], tombol);
});

// =====================================================================
// 4. TAMPILAN PESAN
// =====================================================================
function tampilkanPesan(ikon, judul, keterangan, tombol) {
  elDaftar.innerHTML =
    '<div class="bg-surface-canvas rounded-lg border border-border-hairline shadow-sm p-xl flex flex-col items-center text-center gap-sm">' +
      '<span class="material-symbols-outlined text-[48px] text-on-surface-variant">' + ikon + '</span>' +
      '<h3 class="font-title-md text-title-md text-on-surface">' + amankanTeks(judul) + '</h3>' +
      '<p class="font-body-md text-body-md text-on-surface-variant max-w-md">' + amankanTeks(keterangan) + '</p>' +
      (tombol || "") +
    '</div>';
}

function tombolTautan(href, teks) {
  return '<a href="' + href + '" class="mt-md inline-flex items-center gap-sm bg-primary-container text-on-primary ' +
         'font-button-md text-button-md px-lg py-md rounded-lg hover:brightness-110 transition-all no-underline">' +
         '<span class="material-symbols-outlined text-[20px]">grid_view</span>' + teks + '</a>';
}

// =====================================================================
// 5. PROSES UTAMA
// =====================================================================
async function muatRiwayat() {
  const sesi = ambilSesi();

  // --- Belum login ---
  if (!sesi || !sesi.username) {
    elRingkasan.textContent = "Anda belum masuk ke akun.";
    tampilkanPesan("lock", "Silakan login terlebih dahulu",
      "Riwayat pemesanan hanya dapat dilihat setelah Anda masuk ke akun.",
      tombolTautan("login-customer.html", "Masuk ke Akun"));
    return;
  }

  try {
    const petaCabang = await ambilPeta(COL_CABANG);
    petaCabangAktif = petaCabang;

    const cuplikan = await getDocs(query(
      collection(db, COL_TRANSAKSI),
      where("customer_username", "==", sesi.username)
    ));

    const daftar = [];
    cuplikan.forEach(function (dokumen) {
      const data = Object.assign({ id: dokumen.id }, dokumen.data());
      daftar.push(data);

      // Disimpan supaya tombol "Unduh Kuitansi" bisa langsung memakainya
      petaTransaksi[data.order_id] = data;
    });

    // --- Belum pernah memesan ---
    if (daftar.length === 0) {
      elRingkasan.textContent = "Belum ada pemesanan atas nama " + sesi.fullName + ".";
      tampilkanPesan("receipt_long", "Anda belum memiliki riwayat pemesanan",
        "Pesanan yang Anda buat akan muncul di halaman ini, lengkap dengan status dan rincian pembayarannya.",
        tombolTautan("catalogue.html", "Cari Kamar Sekarang"));
      return;
    }

    // Terbaru lebih dulu
    daftar.sort(function (a, b) {
      return keDate(b.transaction_time) - keDate(a.transaction_time);
    });

    elRingkasan.textContent =
      daftar.length + " pemesanan atas nama " + sesi.fullName + ".";

    elDaftar.innerHTML = daftar.map(function (t) {
      return kartuPesanan(t, petaCabang);
    }).join("");

  } catch (err) {
    console.error("Gagal memuat riwayat pesanan:", err);

    elRingkasan.textContent = "Gagal memuat data.";
    tampilkanPesan("cloud_off", "Gagal memuat riwayat",
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : "Tidak dapat mengambil data dari server. Periksa koneksi internet Anda, lalu muat ulang halaman.");
  }
}

// =====================================================================
// 6. TOMBOL LOGOUT PADA SIDEBAR
// ---------------------------------------------------------------------
// Perilakunya dibuat sama persis dengan halaman cust-profile.html.
// =====================================================================
const tombolLogout = document.getElementById("logoutBtn");

if (tombolLogout) {
  tombolLogout.addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("customerSession");
    localStorage.removeItem("bookingData");
    localStorage.removeItem("identityData");
    localStorage.removeItem("extensionData");
    window.location.href = "../index.html";
  });
}

muatRiwayat();
