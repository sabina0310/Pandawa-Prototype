/**
 * =====================================================================
 * HALAMAN ALOKASI KAMAR (admin & super admin)
 * =====================================================================
 * Halaman ini dipakai admin untuk menentukan kamar fisik bagi sebuah
 * transaksi yang sudah lunas tapi belum punya kamar (kamar_id masih
 * kosong). ID transaksi diambil dari alamat halaman:
 *
 *     alokasi-kamar.html?id=PP-1754300000000-07
 *
 * Kamar yang ditampilkan adalah SELURUH kamar di cabang tersebut,
 * karena setiap kamar boleh disewa harian maupun bulanan.
 *
 * Saat tombol simpan ditekan, dua dokumen diperbarui:
 *   1. transaksi_pemesanan -> kamar_id diisi
 *   2. kamar               -> tersedia menjadi false
 * Keduanya memakai updateDoc, jadi field lain tidak ikut berubah.
 * =====================================================================
 */

import {
  ambilDokumen,
  ambilPeta,
  simpanAlokasiKamar,
  mendekatiJatuhTempo,
  sedangMenghuni,
  COL_CABANG,
  COL_KAMAR,
  COL_TRANSAKSI
} from "./admin-data.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db } from "./firebase-init.js";

import {
  formatTanggal,
  labelStatusBayar,
  statusLunas,
  inisial,
  amankanTeks,
  pesanKotak,
  tampilkanError
} from "./admin-util.js";

// --- Kelas tampilan kartu kamar (disalin dari HTML asli) -------------
const KELAS_TERSEDIA = "aspect-square rounded-[12px] border border-border-hairline bg-surface-canvas flex flex-col items-center justify-center cursor-pointer hover:border-border-strong transition-all group";
const KELAS_DIPILIH = "relative aspect-square rounded-[12px] border-[2px] border-primary bg-primary-fixed/20 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm";
const KELAS_TERPAKAI = "aspect-square rounded-[12px] border border-border-hairline bg-surface-soft flex flex-col items-center justify-center cursor-not-allowed";

// --- Elemen halaman -------------------------------------------------
const elJudul = document.getElementById("pageTitle");
const elGrid = document.getElementById("roomGrid");
const elJudulGrid = document.getElementById("roomGridTitle");
const elInputKamar = document.getElementById("selectedRoomInput");
const elTombolSimpan = document.getElementById("confirmSaveBtn");
const elTombolBatal = document.getElementById("cancelBtn");

let transaksiAktif = null;
let kamarTerpilih = null;

// =====================================================================
// RINGKASAN TRANSAKSI DI BAGIAN ATAS
// =====================================================================
function tampilkanRingkasan(transaksi, cabang) {
  elJudul.textContent = "Alokasi Kamar - " + transaksi.order_id;

  document.getElementById("summaryInitials").textContent = inisial(transaksi.nama_penyewa);
  document.getElementById("summaryName").textContent = transaksi.nama_penyewa;
  document.getElementById("summaryContact").textContent = transaksi.kontak_penyewa;
  document.getElementById("summaryBranch").textContent = cabang ? cabang.nama_cabang : "-";
  document.getElementById("summaryType").textContent = String(transaksi.tipe_sewa || "").toUpperCase();
  document.getElementById("summaryPeriod").textContent =
    formatTanggal(transaksi.tanggal_checkin) + " - " + formatTanggal(transaksi.tanggal_checkout);

  const elBadge = document.getElementById("summaryStatus");
  elBadge.textContent = labelStatusBayar(transaksi.transaction_status);
  if (!statusLunas(transaksi.transaction_status)) {
    elBadge.className = "bg-[#FFFAEB] text-status-warning px-[10px] py-[2px] rounded-full font-badge text-[10px] uppercase font-bold border border-status-warning/20";
  }

  elJudulGrid.textContent = "Pilih Kamar di " + (cabang ? cabang.nama_cabang : "cabang ini");
}

// =====================================================================
// KARTU KAMAR
// =====================================================================
function gambarKartuTersedia(tombol, kamar) {
  tombol.className = KELAS_TERSEDIA;
  tombol.innerHTML =
    '<span class="font-display-md text-[20px] text-ink-primary font-bold">' + amankanTeks(kamar.nomor_kamar) + '</span>' +
    '<div class="w-[6px] h-[6px] rounded-full bg-status-available mt-sm"></div>';
}

function gambarKartuDipilih(tombol, kamar) {
  tombol.className = KELAS_DIPILIH;
  tombol.innerHTML =
    '<span class="font-display-md text-[20px] text-primary font-bold">' + amankanTeks(kamar.nomor_kamar) + '</span>' +
    '<span class="font-tag-uppercase text-[11px] font-semibold text-primary mt-xs">Dipilih</span>' +
    '<div class="absolute top-sm right-sm bg-white rounded-full w-4 h-4 flex items-center justify-center">' +
    '<span class="material-symbols-outlined text-primary text-[14px]" style="font-variation-settings: \'FILL\' 1;">check_circle</span>' +
    '</div>';
}

function gambarKartuTerpakai(tombol, kamar, akanCheckout) {
  tombol.className = KELAS_TERPAKAI;
  const warna = akanCheckout ? "text-status-warning" : "text-status-occupied";
  const teks = akanCheckout ? "Checkout" : "Terisi";
  tombol.innerHTML =
    '<span class="font-display-md text-[20px] text-border-strong font-bold">' + amankanTeks(kamar.nomor_kamar) + '</span>' +
    '<span class="font-tag-uppercase text-[11px] font-semibold ' + warna + ' mt-xs">' + teks + '</span>';
}

// =====================================================================
// PEMILIHAN KAMAR
// =====================================================================
function pilihKamar(kamar) {
  kamarTerpilih = kamar;

  // Gambar ulang semua kartu agar hanya satu yang bertanda "Dipilih"
  elGrid.querySelectorAll("[data-kamar-id]").forEach(function (tombol) {
    if (tombol.dataset.tersedia !== "ya") return;

    const data = { nomor_kamar: tombol.dataset.nomor };
    if (tombol.dataset.kamarId === kamar.id) {
      gambarKartuDipilih(tombol, data);
    } else {
      gambarKartuTersedia(tombol, data);
    }
  });

  elInputKamar.value = "Kamar " + kamar.nomor_kamar;
  elTombolSimpan.disabled = false;
}

// =====================================================================
// MENGGAMBAR GRID KAMAR
// =====================================================================
function gambarGrid(daftarKamar, penghuniKamar) {
  if (daftarKamar.length === 0) {
    pesanKotak(elGrid, "Belum ada kamar terdaftar di cabang ini.");
    return;
  }

  elGrid.innerHTML = "";

  daftarKamar.forEach(function (kamar) {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.dataset.kamarId = kamar.id;
    tombol.dataset.nomor = kamar.nomor_kamar;

    if (kamar.tersedia === false) {
      tombol.dataset.tersedia = "tidak";
      const penghuni = penghuniKamar[kamar.id];
      gambarKartuTerpakai(tombol, kamar, penghuni && mendekatiJatuhTempo(penghuni));
    } else {
      tombol.dataset.tersedia = "ya";
      gambarKartuTersedia(tombol, kamar);
      tombol.addEventListener("click", function () { pilihKamar(kamar); });
    }

    elGrid.appendChild(tombol);
  });
}

// =====================================================================
// MENYIMPAN HASIL ALOKASI
// =====================================================================
async function simpan() {
  if (!kamarTerpilih || !transaksiAktif) {
    alert("Silakan pilih salah satu kamar yang tersedia terlebih dahulu.");
    return;
  }

  const teksAsli = elTombolSimpan.innerHTML;
  elTombolSimpan.disabled = true;
  elTombolSimpan.innerHTML = "Menyimpan...";

  try {
    await simpanAlokasiKamar(transaksiAktif.order_id, kamarTerpilih.id);
    window.location.href = "bookings.html";
  } catch (err) {
    console.error("Gagal menyimpan alokasi:", err);
    alert("Gagal menyimpan alokasi kamar. Silakan coba lagi.\n\n" + (err && err.message ? err.message : ""));
    elTombolSimpan.disabled = false;
    elTombolSimpan.innerHTML = teksAsli;
  }
}

// =====================================================================
// TITIK MASUK
// =====================================================================
async function mulai() {
  elTombolSimpan.disabled = true;

  const orderId = new URLSearchParams(window.location.search).get("id");

  if (!orderId) {
    elJudul.textContent = "Transaksi tidak dipilih";
    pesanKotak(elGrid, "Alamat halaman harus menyertakan ID transaksi, contoh: alokasi-kamar.html?id=PP-123456", "error");
    return;
  }

  elJudul.textContent = "Memuat data...";
  pesanKotak(elGrid, "Memuat daftar kamar...");

  try {
    const transaksi = await ambilDokumen(COL_TRANSAKSI, orderId);

    if (!transaksi) {
      elJudul.textContent = "Transaksi tidak ditemukan";
      pesanKotak(elGrid, 'Tidak ada transaksi dengan ID "' + orderId + '" di database.', "error");
      return;
    }

    transaksiAktif = transaksi;

    const cabang = transaksi.cabang_id ? await ambilDokumen(COL_CABANG, transaksi.cabang_id) : null;
    tampilkanRingkasan(transaksi, cabang);

    // Bila kamarnya sudah pernah dialokasikan, halaman ini tidak
    // seharusnya dipakai lagi. Beri tahu admin, jangan biarkan bingung.
    if (transaksi.kamar_id) {
      const kamarLama = await ambilDokumen(COL_KAMAR, transaksi.kamar_id);
      elInputKamar.value = "Kamar " + (kamarLama ? kamarLama.nomor_kamar : transaksi.kamar_id);
      pesanKotak(elGrid, "Transaksi ini sudah mendapat kamar. Tidak perlu dialokasikan ulang.");
      return;
    }

    // Ambil seluruh kamar, lalu saring yang cabangnya sama
    const petaKamar = await ambilPeta(COL_KAMAR);
    const kamarCabang = Object.keys(petaKamar)
      .map(function (id) { return petaKamar[id]; })
      .filter(function (k) { return k.cabang_id === transaksi.cabang_id; })
      .sort(function (a, b) { return String(a.nomor_kamar).localeCompare(String(b.nomor_kamar)); });

    // Cari siapa penghuni tiap kamar yang sedang terisi, supaya kamar
    // yang penghuninya akan segera check-out bisa ditandai berbeda.
    const penghuniKamar = {};
    const semuaTransaksi = await getDocs(collection(db, COL_TRANSAKSI));
    semuaTransaksi.forEach(function (dokumen) {
      const data = dokumen.data();
      if (sedangMenghuni(data) && data.kamar_id) {
        penghuniKamar[data.kamar_id] = data;
      }
    });

    gambarGrid(kamarCabang, penghuniKamar);

    elInputKamar.value = "";
    elTombolSimpan.addEventListener("click", function (e) {
      e.preventDefault();
      simpan();
    });

    if (elTombolBatal) {
      elTombolBatal.addEventListener("click", function (e) {
        e.preventDefault();
        window.history.back();
      });
    }
  } catch (err) {
    tampilkanError(err, function (pesan) {
      elJudul.textContent = "Gagal memuat data";
      pesanKotak(elGrid, pesan, "error");
    });
  }
}

mulai();
