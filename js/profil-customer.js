/**
 * =====================================================================
 * HALAMAN PROFIL SAYA (customer/profil-customer.html)
 * =====================================================================
 * Menampilkan data diri hasil registrasi langsung sebagai kolom isian.
 * Tidak ada form terpisah maupun modal: pengguna cukup mengubah isinya
 * lalu menekan "Simpan Perubahan", dan datanya langsung diperbarui di
 * Firestore.
 *
 * Username tidak dapat diubah karena dipakai sebagai Document ID
 * sekaligus penanda pemilik pada setiap transaksi.
 * =====================================================================
 */

import {
  cariPengguna,
  perbaruiProfil,
  simpanSesi,
  ambilSesi,
  tampilkanPesan,
  sembunyikanPesan,
  kunciTombol,
  PANJANG_MINIMAL_SANDI
} from "./customer-auth.js";

import { siapkanSidebar } from "./customer-sidebar.js";
import { formatTanggal } from "./admin-util.js";

const elNama = document.getElementById("profilFullName");
const elUsername = document.getElementById("profilUsername");
const elDibuat = document.getElementById("profilDibuat");
const elSandi = document.getElementById("profilPassword");
const elKonfirmasi = document.getElementById("profilConfirmPassword");
const tombol = document.getElementById("simpanProfilBtn");

// Halaman ini wajib login; siapkanSidebar mengalihkan bila belum
const sesi = siapkanSidebar(true);

// =====================================================================
// 1. MEMUAT DATA
// =====================================================================
async function muatProfil() {
  if (!sesi) return;

  // Isi sementara dari sesi agar kolom tidak kosong saat menunggu
  elNama.value = sesi.fullName || "";
  elUsername.value = sesi.username || "";

  try {
    const pengguna = await cariPengguna(sesi.username);

    if (!pengguna) {
      tampilkanPesan("gagal", "Data akun tidak ditemukan di database. Silakan masuk ulang.");
      return;
    }

    elNama.value = pengguna.fullName || "";
    elUsername.value = pengguna.username || "";
    elDibuat.value = pengguna.createdAt ? formatTanggal(pengguna.createdAt) : "-";

  } catch (err) {
    console.error("Gagal memuat profil:", err);
    tampilkanPesan("gagal",
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : "Gagal memuat data profil. Periksa koneksi internet Anda.");
  }
}

// =====================================================================
// 2. MENYIMPAN PERUBAHAN
// =====================================================================
async function simpanProfil() {
  sembunyikanPesan();

  const nama = elNama.value.trim();
  const sandiBaru = elSandi.value;
  const konfirmasi = elKonfirmasi.value;

  // --- Pemeriksaan isian ---
  if (!nama) {
    tampilkanPesan("gagal", "Nama lengkap wajib diisi.");
    elNama.focus();
    return;
  }
  if (nama.length < 3) {
    tampilkanPesan("gagal", "Nama lengkap terlalu pendek.");
    elNama.focus();
    return;
  }

  // Kata sandi hanya diperiksa bila salah satu kolomnya diisi
  if (sandiBaru || konfirmasi) {
    if (sandiBaru.length < PANJANG_MINIMAL_SANDI) {
      tampilkanPesan("gagal", "Kata sandi baru minimal " + PANJANG_MINIMAL_SANDI + " karakter.");
      elSandi.focus();
      return;
    }
    if (sandiBaru !== konfirmasi) {
      tampilkanPesan("gagal", "Konfirmasi kata sandi tidak sama dengan kata sandi baru.");
      elKonfirmasi.focus();
      return;
    }
  }

  kunciTombol(tombol, true, "Menyimpan...", "Simpan Perubahan");

  try {
    const pengguna = await perbaruiProfil(sesi.username, {
      fullName: nama,
      kataSandiBaru: sandiBaru || null
    });

    // Sesi ikut diperbarui supaya sapaan di sidebar langsung berubah
    simpanSesi(pengguna);

    const elSapaan = document.getElementById("sidebarWelcome");
    if (elSapaan) {
      elSapaan.textContent = "Welcome, " + String(pengguna.fullName).trim().split(/\s+/)[0];
    }

    elSandi.value = "";
    elKonfirmasi.value = "";

    tampilkanPesan("sukses", sandiBaru
      ? "Data diri dan kata sandi berhasil diperbarui."
      : "Data diri berhasil diperbarui.");

  } catch (err) {
    console.error("Gagal menyimpan profil:", err);
    tampilkanPesan("gagal",
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : err.message);

  } finally {
    kunciTombol(tombol, false, "", "Simpan Perubahan");
  }
}

if (tombol) {
  tombol.addEventListener("click", function (e) {
    e.preventDefault();
    simpanProfil();
  });
}

muatProfil();
