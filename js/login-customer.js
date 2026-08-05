/**
 * =====================================================================
 * HALAMAN LOGIN (customer/login-customer.html)
 * =====================================================================
 * Sebelumnya halaman ini menerima username dan kata sandi apa pun,
 * lalu menyimpannya begitu saja ke localStorage. Sekarang keduanya
 * diperiksa terlebih dahulu ke collection "customers".
 *
 * Alur setelah berhasil tetap sama seperti sebelumnya: sesi disimpan
 * pada kunci "customerSession", lalu pengguna diarahkan ke halaman
 * berikutnya. Halaman lain yang membaca kunci itu tidak perlu diubah.
 * =====================================================================
 */

import {
  masukkanPengguna,
  simpanSesi,
  tampilkanPesan,
  sembunyikanPesan,
  tandaiSalah,
  kunciTombol,
  KUNCI_TUJUAN
} from "./customer-auth.js";

const form = document.getElementById("loginForm");
const tombol = document.getElementById("loginBtn");

/**
 * Menentukan halaman tujuan setelah login berhasil. Ada dua kemungkinan:
 *
 *   1. Pengunjung tiba di sini karena menekan "Pesan Sekarang" pada
 *      halaman detail cabang tanpa sesi login. Halaman itu menitipkan
 *      alamat tujuannya lewat localStorage, sehingga ia dikembalikan
 *      ke cabang yang sedang dilihatnya.
 *
 *   2. Pengunjung membuka halaman login sendiri. Ia diarahkan ke
 *      beranda.
 *
 * Titipan tujuan dihapus setelah dipakai supaya tidak terbawa pada
 * login berikutnya.
 */
function halamanTujuan() {
  const titipan = localStorage.getItem(KUNCI_TUJUAN);

  if (titipan) {
    localStorage.removeItem(KUNCI_TUJUAN);
    return titipan;
  }

  return "../index.html";
}

/**
 * Menyiapkan halaman saat pertama dibuka.
 * Bila pengunjung baru saja mendaftar, kolom username diisikan
 * otomatis dan diberi ucapan agar alurnya terasa menyambung.
 */
function siapkanHalaman() {
  const parameter = new URLSearchParams(window.location.search);

  if (parameter.get("daftar") === "berhasil") {
    const username = parameter.get("username");

    if (username) {
      document.getElementById("username").value = username;
      document.getElementById("password").focus();
    }

    tampilkanPesan("sukses",
      "Akun Anda berhasil dibuat. Silakan masuk memakai kata sandi yang tadi Anda daftarkan.");
  }
}

siapkanHalaman();

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  sembunyikanPesan();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username) {
    tandaiSalah("username");
    tampilkanPesan("gagal", "Username wajib diisi.");
    return;
  }
  if (!password) {
    tandaiSalah("password");
    tampilkanPesan("gagal", "Kata sandi wajib diisi.");
    return;
  }

  kunciTombol(tombol, true, "Memeriksa...", "Masuk");

  try {
    const pengguna = await masukkanPengguna(username, password);

    simpanSesi(pengguna);

    tampilkanPesan("sukses", "Login berhasil. Selamat datang kembali, " + pengguna.fullName + "!");

    setTimeout(function () {
      window.location.href = halamanTujuan();
    }, 900);

  } catch (err) {
    console.error("Gagal login:", err);

    // Tandai isian yang paling mungkin keliru
    if (String(err.message).indexOf("Username") !== -1) {
      tandaiSalah("username");
    } else if (String(err.message).indexOf("Kata sandi") !== -1) {
      tandaiSalah("password");
    }

    tampilkanPesan("gagal",
      String(err.code || "").indexOf("permission-denied") !== -1
        ? "Akses ke database ditolak. Periksa Firestore Security Rules."
        : err.message);

    kunciTombol(tombol, false, "", "Masuk");
  }
});
