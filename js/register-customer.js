/**
 * =====================================================================
 * HALAMAN REGISTRASI (customer/register-customer.html)
 * =====================================================================
 * Alur:
 *   1. Periksa seluruh isian di sisi browser
 *   2. Pastikan username belum dipakai (query ke Firestore)
 *   3. Acak kata sandi, lalu simpan ke collection "user"
 *   4. Arahkan ke halaman login
 *
 * Pengguna TIDAK langsung dilogin-kan. Setelah mendaftar ia diminta
 * masuk sekali memakai akun barunya, sehingga kata sandi yang baru
 * dibuat langsung teruji dan alurnya jelas.
 * =====================================================================
 */

import {
  periksaFormRegistrasi,
  daftarkanPengguna,
  tampilkanPesan,
  sembunyikanPesan,
  tandaiSalah,
  kunciTombol
} from "./customer-auth.js";

const form = document.getElementById("registerForm");
const tombol = document.getElementById("registerBtn");

/** Membaca seluruh isian form. */
function bacaForm() {
  return {
    fullName: document.getElementById("fullName").value.trim(),
    username: document.getElementById("username").value.trim(),
    password: document.getElementById("password").value,
    confirmPassword: document.getElementById("confirmPassword").value
  };
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  sembunyikanPesan();

  const data = bacaForm();

  // --- 1. Pemeriksaan isian ---
  const masalah = periksaFormRegistrasi(data);

  if (masalah.length > 0) {
    // Semua isian bermasalah ditandai, tetapi yang ditampilkan
    // pesan pertamanya saja agar tidak membingungkan.
    masalah.forEach(function (m) { tandaiSalah(m.field); });
    tampilkanPesan("gagal", masalah[0].pesan);
    document.getElementById(masalah[0].field).focus();
    return;
  }

  kunciTombol(tombol, true, "Memproses...", "Daftar Sekarang");

  try {
    // --- 2 & 3. Pemeriksaan username + penyimpanan ---
    // Pemeriksaan username sudah dikerjakan di dalam daftarkanPengguna,
    // sehingga jeda antara memeriksa dan menyimpan sekecil mungkin.
    // Hasilnya tidak dipakai -- yang penting fungsi ini selesai tanpa
    // melempar galat, artinya akunnya sudah tersimpan.
    await daftarkanPengguna(data);

    // --- 4. Arahkan ke halaman login ---
    // Yang dibawa hanya penanda "daftar=berhasil", sekadar untuk
    // memunculkan ucapan di halaman login. Username SENGAJA tidak ikut
    // dibawa: halaman login harus dimulai dengan isian yang bersih,
    // dan username tidak perlu tertulis di bilah alamat.
    tampilkanPesan("sukses",
      "Pendaftaran berhasil. Silakan masuk memakai akun baru Anda...");

    setTimeout(function () {
      window.location.href = "login-customer.html?daftar=berhasil";
    }, 1200);

  } catch (err) {
    console.error("Gagal mendaftar:", err);

    if (String(err.message).indexOf("sudah dipakai") !== -1) {
      tandaiSalah("username");
      document.getElementById("username").focus();
    }

    tampilkanPesan("gagal",
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : err.message);

    kunciTombol(tombol, false, "", "Daftar Sekarang");
  }
});
