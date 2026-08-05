/**
 * =====================================================================
 * DASHBOARD PENYEWA (customer/cust-profile.html)
 * =====================================================================
 * Menampilkan sewa yang sedang berjalan milik pengguna yang login,
 * beserta formulir pengajuan perpanjangan.
 *
 * Sewa yang ditampilkan adalah transaksi dengan:
 *   customer_username == pengguna yang login
 *   status_checkin    == "checked_in"
 *   tipe_sewa         == "bulanan"   (hanya sewa bulanan yang bisa
 *                                     diperpanjang)
 * Bila ada lebih dari satu, yang dipilih adalah yang tanggal
 * check-out-nya paling dekat -- itulah yang paling perlu ditindak.
 *
 * Harga perpanjangan diambil dari harga_bulanan cabang terkait,
 * bukan angka tetap di HTML, supaya selalu ikut bila harga berubah.
 * =====================================================================
 */

import {
  collection, getDocs, query, where, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_TRANSAKSI, COL_CABANG } from "./firebase-init.js";
import { ambilDokumen } from "./admin-data.js";
import { ambilSesi } from "./customer-auth.js";
import { siapkanSidebar } from "./customer-sidebar.js";
import {
  formatTanggal, formatRupiah, sisaHari, labelSisaHari, keDate, amankanTeks
} from "./admin-util.js";

// Halaman ini wajib login
siapkanSidebar(true);

const el = (id) => document.getElementById(id);

let sewaAktif = null;
let cabangAktif = null;

// =====================================================================
// 1. MENAMPILKAN / MENYEMBUNYIKAN PANEL
// =====================================================================
function tampilkanPanelKosong(pesan) {
  const kosong = el("panelKosong");
  const aktif = el("panelSewaAktif");

  if (kosong) {
    kosong.classList.remove("hidden");
    kosong.classList.add("flex");
    if (pesan) el("panelKosongPesan").textContent = pesan;
  }
  if (aktif) {
    aktif.classList.add("hidden");
    aktif.classList.remove("grid");
  }
}

function tampilkanPanelAktif() {
  const kosong = el("panelKosong");
  const aktif = el("panelSewaAktif");

  if (kosong) {
    kosong.classList.add("hidden");
    kosong.classList.remove("flex");
  }
  if (aktif) {
    aktif.classList.remove("hidden");
    aktif.classList.add("grid");
  }
}

// =====================================================================
// 2. MENGISI DATA SEWA AKTIF
// =====================================================================
function tampilkanSewa(transaksi, cabang) {
  const sisa = sisaHari(transaksi.tanggal_checkout);
  const mendekatiTenggat = sisa !== null && sisa >= 0 && sisa <= 7;

  // --- Foto & identitas cabang ---
  if (cabang && cabang.gambar_url) {
    el("dashFoto").src = cabang.gambar_url;
    el("dashFoto").alt = cabang.nama_cabang;
  }

  el("dashTipeSewa").textContent = String(transaksi.tipe_sewa || "").toUpperCase();
  el("dashNamaCabang").textContent = cabang ? cabang.nama_cabang : "Cabang tidak ditemukan";
  el("dashKamar").textContent = transaksi.kamar_id
    ? "Kamar " + transaksi.kamar_id
    : "Nomor kamar belum ditentukan";

  el("activePeriodValue").textContent =
    formatTanggal(transaksi.tanggal_checkin) + " - " + formatTanggal(transaksi.tanggal_checkout);

  // --- Penanda sewa yang mendekati tenggat ---
  // Inilah tanda yang membuat data bertenggat H-7 mudah dikenali
  // pengguna, termasuk data uji hasil generate.
  const badge = el("dashBadgeTenggat");
  const banner = el("bannerTenggat");

  if (mendekatiTenggat) {
    badge.classList.remove("hidden");
    badge.classList.add("flex");
    el("dashBadgeTenggatTeks").textContent = "Jatuh Tempo " + labelSisaHari(transaksi.tanggal_checkout);

    banner.classList.remove("hidden");
    banner.classList.add("flex");
    el("bannerTenggatPesan").textContent =
      "Masa sewa Anda berakhir " + labelSisaHari(transaksi.tanggal_checkout).toLowerCase() +
      " (" + formatTanggal(transaksi.tanggal_checkout) + "). " +
      "Segera ajukan perpanjangan bila ingin melanjutkan sewa.";
  } else {
    badge.classList.add("hidden");
    badge.classList.remove("flex");
    banner.classList.add("hidden");
    banner.classList.remove("flex");
  }
}

// =====================================================================
// 3. FORMULIR PERPANJANGAN
// =====================================================================

/** Mengisi harga tiap pilihan durasi dari harga bulanan cabang. */
function isiHargaDurasi(hargaBulanan) {
  document.querySelectorAll(".extension-duration").forEach(function (input) {
    const bulan = parseInt(input.dataset.months, 10) || 1;
    input.dataset.price = String(hargaBulanan * bulan);
  });
}

function perbaruiRincian() {
  const dipilih = document.querySelector(".extension-duration:checked");
  if (!dipilih) return;

  const bulan = parseInt(dipilih.dataset.months, 10) || 1;
  const harga = parseInt(dipilih.dataset.price, 10) || 0;
  const biayaLayanan = cabangAktif ? Number(cabangAktif.biaya_layanan || 0) : 0;

  el("sewaKamarLabel").textContent = "Sewa Kamar (" + bulan + " Bulan)";
  el("sewaKamarValue").textContent = formatRupiah(harga);
  el("totalTagihanValue").textContent = formatRupiah(harga + biayaLayanan);
}

/**
 * Menghitung periode sewa baru bila perpanjangan disetujui:
 * dimulai dari tanggal check-out sekarang, ditambah durasi terpilih.
 */
function periodeBaru(bulan) {
  const mulai = keDate(sewaAktif.tanggal_checkout);
  const selesai = new Date(mulai);
  selesai.setMonth(selesai.getMonth() + bulan);
  return { mulai: mulai, selesai: selesai };
}

function keTeksTanggal(tanggal) {
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return tanggal.getFullYear() + "-" + bulan + "-" + hari;
}

function lanjutkanPembayaran() {
  if (!sewaAktif || !cabangAktif) return;

  const dipilih = document.querySelector(".extension-duration:checked");
  const bulan = dipilih ? parseInt(dipilih.dataset.months, 10) : 1;
  const harga = dipilih ? parseInt(dipilih.dataset.price, 10) : 0;
  const biayaLayanan = Number(cabangAktif.biaya_layanan || 0);

  if (!harga || harga <= 0) {
    alert("Harga perpanjangan belum dapat dihitung. Silakan muat ulang halaman.");
    return;
  }

  const periode = periodeBaru(bulan);

  // Data ini dibaca oleh alur perpanjangan di folder extend/
  localStorage.setItem("extensionData", JSON.stringify({
    orderIdLama: sewaAktif.order_id,
    cabangId: sewaAktif.cabang_id,
    namaCabang: cabangAktif.nama_cabang,
    alamatCabang: cabangAktif.alamat,
    gambarCabang: cabangAktif.gambar_url,
    kamarId: sewaAktif.kamar_id,

    tipeSewa: "bulanan",
    durasi: bulan,
    satuanDurasi: "Bulan",
    hargaSatuan: Number(cabangAktif.harga_bulanan || 0),
    hargaSewa: harga,
    biayaLayanan: biayaLayanan,
    total: harga + biayaLayanan,

    checkin: keTeksTanggal(periode.mulai),
    checkout: keTeksTanggal(periode.selesai),

    namaPenyewa: sewaAktif.nama_penyewa,
    nikPenyewa: sewaAktif.nik_penyewa,
    kontakPenyewa: sewaAktif.kontak_penyewa,
    catatan: el("extensionNote") ? el("extensionNote").value.trim() : ""
  }));

  window.location.href = "extend/step-1.html";
}

// =====================================================================
// 4. KEPUTUSAN "TIDAK MEMPERPANJANG"
// ---------------------------------------------------------------------
// Penyewa boleh menyatakan tidak melanjutkan sewa. Pernyataan itu
// disimpan pada field status_perpanjangan dengan nilai "tidak_lanjut",
// nilai ketiga yang sudah disepakati selain "belum" dan "perpanjang".
//
// Selain memberi kepastian kepada admin, pengisian field ini juga
// menghentikan pengingat jatuh tempo: cron hanya mengirim notifikasi
// untuk sewa yang status_perpanjangan-nya masih "belum".
// =====================================================================

/**
 * Menyesuaikan tampilan dengan keputusan yang sudah tercatat.
 * Formulir perpanjangan hanya ditampilkan selama keputusannya "belum".
 */
function terapkanKeputusan() {
  const status = sewaAktif ? sewaAktif.status_perpanjangan : "belum";

  const form = el("formPerpanjangan");
  const kolomTagihan = el("kolomTagihan");
  const kolomKiri = el("kolomKiri");
  const panel = el("panelKeputusan");

  // Selama belum menjawab, tampilan tetap seperti semula
  if (status !== "perpanjang" && status !== "tidak_lanjut") {
    if (form) form.classList.remove("hidden");
    if (kolomTagihan) kolomTagihan.classList.remove("hidden");
    if (panel) {
      panel.classList.add("hidden");
      panel.classList.remove("flex");
    }
    return;
  }

  if (form) form.classList.add("hidden");

  // Kolom tagihan tidak relevan lagi, jadi kolom kiri dilebarkan
  // agar tidak menyisakan ruang kosong di sebelah kanan.
  if (kolomTagihan) kolomTagihan.classList.add("hidden");
  if (kolomKiri) {
    kolomKiri.classList.remove("lg:col-span-8");
    kolomKiri.classList.add("lg:col-span-12");
  }

  if (!panel) return;

  panel.classList.remove("hidden");
  panel.classList.add("flex");

  const ikon = el("panelKeputusanIkon");
  const judul = el("panelKeputusanJudul");
  const pesan = el("panelKeputusanPesan");

  if (status === "perpanjang") {
    if (ikon) {
      ikon.textContent = "event_available";
      ikon.className = "material-symbols-outlined text-[28px] text-status-available";
    }
    if (judul) judul.textContent = "Sewa Anda akan diperpanjang";
    if (pesan) {
      pesan.textContent =
        "Pembayaran perpanjangan sudah kami terima. Admin akan menentukan kamar " +
        "untuk periode berikutnya. Rinciannya dapat dilihat di halaman Riwayat Pesanan.";
    }
    return;
  }

  if (ikon) {
    ikon.textContent = "event_busy";
    ikon.className = "material-symbols-outlined text-[28px] text-error";
  }
  if (judul) judul.textContent = "Anda memilih tidak memperpanjang";
  if (pesan) {
    pesan.textContent =
      "Masa sewa akan berakhir pada " + formatTanggal(sewaAktif.tanggal_checkout) +
      ". Silakan lakukan check-out kepada petugas cabang paling lambat pukul 12:00 WIB " +
      "pada tanggal tersebut. Bila Anda berubah pikiran, hubungi admin.";
  }
}

function bukaModalTidakLanjut() {
  if (!sewaAktif) return;

  const modal = el("modalTidakLanjut");
  const pesan = el("modalTidakLanjutPesan");
  const galat = el("modalTidakLanjutError");

  if (pesan) {
    pesan.textContent =
      "Anda menyatakan tidak melanjutkan sewa " +
      (cabangAktif ? cabangAktif.nama_cabang : "kamar ini") +
      " setelah " + formatTanggal(sewaAktif.tanggal_checkout) + ".";
  }
  if (galat) galat.classList.add("hidden");

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function tutupModalTidakLanjut() {
  const modal = el("modalTidakLanjut");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

async function simpanTidakLanjut() {
  if (!sewaAktif) return;

  const tombol = el("konfirmasiTidakLanjutBtn");
  const galat = el("modalTidakLanjutError");
  const teksAsli = tombol ? tombol.innerHTML : null;

  if (tombol) {
    tombol.disabled = true;
    tombol.classList.add("opacity-60", "cursor-not-allowed");
    tombol.innerHTML =
      '<span class="material-symbols-outlined text-[18px]">hourglass_top</span>Menyimpan...';
  }
  if (galat) galat.classList.add("hidden");

  try {
    await updateDoc(doc(db, COL_TRANSAKSI, sewaAktif.order_id), {
      status_perpanjangan: "tidak_lanjut"
    });

    // Salinan di layar ikut diperbarui supaya tampilannya langsung
    // menyesuaikan tanpa perlu memuat ulang halaman.
    sewaAktif.status_perpanjangan = "tidak_lanjut";

    console.log("[Perpanjangan] " + sewaAktif.order_id + " ditandai tidak_lanjut");

    tutupModalTidakLanjut();
    terapkanKeputusan();

  } catch (err) {
    console.error("Gagal menyimpan keputusan perpanjangan:", err);

    if (galat) {
      galat.textContent =
        String(err.code || "").indexOf("permission-denied") !== -1
          ? "Akses ke database ditolak. Periksa Firestore Security Rules."
          : "Gagal menyimpan keputusan. Periksa koneksi internet Anda, lalu coba lagi.";
      galat.classList.remove("hidden");
    }

  } finally {
    if (tombol) {
      tombol.disabled = false;
      tombol.classList.remove("opacity-60", "cursor-not-allowed");
      tombol.innerHTML = teksAsli;
    }
  }
}

// =====================================================================
// 5. PROSES UTAMA
// =====================================================================
async function muatDashboard() {
  const sesi = ambilSesi();
  if (!sesi) return;

  try {
    const cuplikan = await getDocs(query(
      collection(db, COL_TRANSAKSI),
      where("customer_username", "==", sesi.username),
      where("status_checkin", "==", "checked_in")
    ));

    // Hanya sewa bulanan yang mengenal perpanjangan
    const daftar = [];
    cuplikan.forEach(function (dokumen) {
      const data = Object.assign({ id: dokumen.id }, dokumen.data());
      if (data.tipe_sewa === "bulanan") daftar.push(data);
    });

    if (daftar.length === 0) {
      tampilkanPanelKosong(
        "Anda belum memiliki sewa bulanan yang sedang berjalan. " +
        "Sewa yang sudah dibayar akan muncul di sini setelah admin memproses check-in."
      );
      return;
    }

    // Yang paling dekat tenggatnya didahulukan
    daftar.sort(function (a, b) {
      return keDate(a.tanggal_checkout) - keDate(b.tanggal_checkout);
    });

    sewaAktif = daftar[0];
    cabangAktif = await ambilDokumen(COL_CABANG, sewaAktif.cabang_id);

    tampilkanSewa(sewaAktif, cabangAktif);
    isiHargaDurasi(cabangAktif ? Number(cabangAktif.harga_bulanan || 0) : 0);
    perbaruiRincian();
    terapkanKeputusan();
    tampilkanPanelAktif();

  } catch (err) {
    console.error("Gagal memuat dashboard:", err);
    tampilkanPanelKosong(
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : "Gagal memuat data sewa. Periksa koneksi internet Anda, lalu muat ulang halaman."
    );
  }
}

document.querySelectorAll(".extension-duration").forEach(function (input) {
  input.addEventListener("change", perbaruiRincian);
});

const tombolBayar = el("lanjutkanPembayaranBtn");
if (tombolBayar) {
  tombolBayar.addEventListener("click", function (e) {
    e.preventDefault();
    lanjutkanPembayaran();
  });
}

// --- Tombol & jendela konfirmasi "tidak memperpanjang" ---
const tombolTidakLanjut = el("tidakPerpanjangBtn");
if (tombolTidakLanjut) {
  tombolTidakLanjut.addEventListener("click", function (e) {
    e.preventDefault();
    bukaModalTidakLanjut();
  });
}

const tombolBatal = el("batalTidakLanjutBtn");
if (tombolBatal) {
  tombolBatal.addEventListener("click", tutupModalTidakLanjut);
}

const tombolKonfirmasi = el("konfirmasiTidakLanjutBtn");
if (tombolKonfirmasi) {
  tombolKonfirmasi.addEventListener("click", simpanTidakLanjut);
}

// Menutup jendela bila latar gelapnya yang ditekan
const modalTidakLanjut = el("modalTidakLanjut");
if (modalTidakLanjut) {
  modalTidakLanjut.addEventListener("click", function (e) {
    if (e.target === modalTidakLanjut) tutupModalTidakLanjut();
  });
}

muatDashboard();
