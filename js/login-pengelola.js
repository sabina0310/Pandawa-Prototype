/**
 * =====================================================================
 * LOGIN PENGELOLA (ADMIN & SUPER ADMIN)
 * =====================================================================
 * Dipakai oleh:
 *   admin/login.html               -> peran "admin"
 *   super-admin/login-super-admin.html -> peran "superadmin"
 *
 * Sebelumnya kedua halaman memeriksa kata sandi memakai nilai yang
 * ditulis langsung di dalam HTML:
 *
 *     const VALID_USERNAME = "admin";
 *     const VALID_PASSWORD = "admin123";
 *
 * Cara itu membuat kata sandi terbaca siapa pun lewat "View Source".
 * Sekarang keduanya diperiksa ke collection "user" di Firestore,
 * memakai hash SHA-256 yang sama dengan portal penyewa.
 *
 * ---------------------------------------------------------------------
 * SATU BERKAS UNTUK DUA HALAMAN
 * ---------------------------------------------------------------------
 * Kedua halaman punya susunan form yang sama, hanya berbeda pada:
 *   - id kolom username ("username" di admin, "email" di super admin)
 *   - ada/tidaknya ikon panah pada tombol
 *   - peran yang boleh masuk, kunci sesi, dan halaman tujuan
 *
 * Perbedaan itu diserahkan ke pemanggil lewat parameter, sehingga
 * perilakunya (tombol, mata sandi, modal gagal) cukup ditulis sekali.
 *
 * ---------------------------------------------------------------------
 * CATATAN KETERBATASAN
 * ---------------------------------------------------------------------
 * Pemeriksaan tetap terjadi di browser, sama seperti portal penyewa.
 * Selama belum memakai Firebase Authentication, Firestore Rules tidak
 * dapat membedakan "permintaan dari super admin" dari permintaan biasa.
 * Perbaikan ini menghilangkan kata sandi dari kode sumber, tetapi belum
 * menjadikannya autentikasi yang sesungguhnya.
 * =====================================================================
 */

import { masukkanPenggunaBerperan, simpanSesiPortal } from "./customer-auth.js";

/**
 * Memasang seluruh perilaku halaman login pengelola.
 *
 * @param {Object}   opsi
 * @param {string[]} opsi.peran     - peran yang boleh masuk, contoh ["admin"]
 * @param {string}   opsi.kunciSesi - kunci localStorage, contoh "adminSession"
 * @param {string}   opsi.tujuan    - halaman yang dibuka setelah berhasil
 */
export function pasangLoginPengelola(opsi) {
  // -------------------------------------------------------------------
  // Mengambil elemen. Kolom username memakai dua kemungkinan id karena
  // kedua halaman menamainya berbeda.
  // -------------------------------------------------------------------
  const form = document.getElementById("loginForm");
  const inputUsername = document.getElementById("username") || document.getElementById("email");
  const inputSandi = document.getElementById("password");

  const tombolMata = document.getElementById("togglePassword");
  const ikonMata = document.getElementById("togglePasswordIcon");

  const tombolMasuk = document.getElementById("loginBtn");
  const teksTombol = document.getElementById("loginBtnText");
  const putaranTombol = document.getElementById("loginBtnSpinner");
  const panahTombol = document.getElementById("loginBtnArrow"); // hanya ada di halaman admin

  const modalGagal = document.getElementById("errorModal");
  const tirai = document.getElementById("errorModalOverlay");
  const tombolTutup = document.getElementById("errorModalClose");

  if (!form || !inputUsername || !inputSandi) return;

  // -------------------------------------------------------------------
  // Tombol mata: menampilkan / menyembunyikan kata sandi
  // -------------------------------------------------------------------
  if (tombolMata) {
    tombolMata.addEventListener("click", function () {
      const sedangTersembunyi = inputSandi.type === "password";
      inputSandi.type = sedangTersembunyi ? "text" : "password";
      if (ikonMata) {
        ikonMata.textContent = sedangTersembunyi ? "visibility_off" : "visibility";
      }
    });
  }

  // -------------------------------------------------------------------
  // Modal "Login Gagal"
  // -------------------------------------------------------------------

  /** Mencari paragraf keterangan di dalam modal, bila ada. */
  const keteranganGagal = modalGagal ? modalGagal.querySelector("p") : null;

  function tampilkanGagal(pesan) {
    // Keterangannya diganti agar pengguna tahu penyebab sebenarnya --
    // "kata sandi salah" dan "koneksi gagal" perlu ditangani berbeda.
    if (keteranganGagal && pesan) keteranganGagal.textContent = pesan;

    if (!modalGagal) {
      alert(pesan);
      return;
    }
    modalGagal.classList.remove("hidden");
    modalGagal.classList.add("flex");
  }

  function sembunyikanGagal() {
    if (!modalGagal) return;
    modalGagal.classList.add("hidden");
    modalGagal.classList.remove("flex");
  }

  if (tirai) tirai.addEventListener("click", sembunyikanGagal);
  if (tombolTutup) tombolTutup.addEventListener("click", sembunyikanGagal);

  // -------------------------------------------------------------------
  // Keadaan tombol selama proses berlangsung
  // -------------------------------------------------------------------
  function setSedangProses(sedangProses) {
    if (tombolMasuk) tombolMasuk.disabled = sedangProses;
    if (putaranTombol) putaranTombol.classList.toggle("hidden", !sedangProses);
    if (panahTombol) panahTombol.classList.toggle("hidden", sedangProses);
    if (teksTombol) teksTombol.textContent = sedangProses ? "Memproses..." : "Masuk";
  }

  // -------------------------------------------------------------------
  // Proses masuk
  // -------------------------------------------------------------------
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = inputUsername.value.trim();
    const kataSandi = inputSandi.value;

    if (!username || !kataSandi) {
      tampilkanGagal("Username dan kata sandi wajib diisi.");
      return;
    }

    setSedangProses(true);

    try {
      const pengguna = await masukkanPenggunaBerperan(username, kataSandi, opsi.peran);

      simpanSesiPortal(opsi.kunciSesi, pengguna);
      window.location.href = opsi.tujuan;

    } catch (err) {
      setSedangProses(false);

      // Kegagalan jaringan dibedakan dari kata sandi salah, supaya
      // pengguna tidak mengira akunnya bermasalah padahal internetnya
      // yang terputus.
      const pesan = /network|fetch|unavailable|offline/i.test(err.message)
        ? "Tidak dapat menghubungi database. Periksa koneksi internet Anda, lalu coba lagi."
        : err.message;

      tampilkanGagal(pesan);
    }
  });
}
