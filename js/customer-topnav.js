/**
 * =====================================================================
 * TOP NAV HALAMAN CUSTOMER
 * =====================================================================
 * Memuat customer/partials/top-nav.html ke dalam #top-nav-placeholder, lalu
 * menyesuaikan isinya dengan keadaan pengunjung:
 *
 *   Belum login -> tombol "Masuk / Log in" tampil
 *   Sudah login -> tombol Masuk disembunyikan, diganti ikon profil
 *                  yang mengarah ke halaman profil penyewa
 *
 * ---------------------------------------------------------------------
 * KENAPA PENYESUAIAN TAUTAN DIKERJAKAN DI SINI
 * ---------------------------------------------------------------------
 * Satu berkas top-nav.html dipakai dua tingkat folder yang berbeda:
 *
 *   index.html                -> perlu "customer/login-customer.html"
 *   customer/catalogue.html   -> perlu "login-customer.html"
 *
 * Karena itu tautannya tidak boleh ditulis tetap di dalam berkas nav.
 * Modul ini mengenali posisi halaman lalu mengisi tautannya sendiri.
 *
 * ---------------------------------------------------------------------
 * KENAPA MEMAKAI style.display, BUKAN class "hidden"
 * ---------------------------------------------------------------------
 * Tombol Masuk memakai kelas "hidden md:flex" agar hanya tampil di
 * layar lebar. Menambahkan "hidden" untuk menyembunyikannya tidak
 * berpengaruh, sebab "md:flex" tetap menang pada layar lebar.
 * Mengatur style.display secara langsung selalu menang atas keduanya.
 * =====================================================================
 */

const KUNCI_SESI = "customerSession";

/**
 * Menentukan posisi halaman pemanggil.
 * true bila halaman berada di dalam folder customer/.
 */
function diDalamFolderCustomer() {
  return window.location.pathname.replace(/\\/g, "/").indexOf("/customer/") !== -1;
}

/** Kumpulan alamat yang menyesuaikan posisi halaman. */
function alamat() {
  const diDalam = diDalamFolderCustomer();

  return {
    navHtml: diDalam ? "partials/top-nav.html" : "customer/partials/top-nav.html",
    login: diDalam ? "login-customer.html" : "customer/login-customer.html",
    profil: diDalam ? "cust-profile.html" : "customer/cust-profile.html",
    beranda: diDalam ? "../index.html" : "index.html",
    katalog: diDalam ? "catalogue.html" : "customer/catalogue.html"
  };
}

/** Membaca sesi login. null bila belum masuk atau datanya rusak. */
function ambilSesi() {
  const mentah = localStorage.getItem(KUNCI_SESI);
  if (!mentah) return null;

  try {
    const sesi = JSON.parse(mentah);
    return sesi && sesi.username ? sesi : null;
  } catch (err) {
    return null;
  }
}

/**
 * Mengisi tautan dan mengatur tampilan tombol sesuai keadaan login.
 * Dipanggil setelah nav benar-benar tersisip ke halaman.
 */
function siapkanIsiNav() {
  const jalur = alamat();
  const sesi = ambilSesi();

  const tombolMasuk = document.getElementById("loginNavBtn");
  const ikonProfil = document.getElementById("profileNavBtn");

  // --- Tautan yang menyesuaikan posisi halaman ---
  const tautanBeranda = document.getElementById("navBeranda");
  const tautanLogo = document.getElementById("navLogo");

  if (tautanBeranda) tautanBeranda.href = jalur.beranda;
  if (tautanLogo) tautanLogo.href = jalur.beranda;
  if (tombolMasuk) tombolMasuk.href = jalur.login;
  if (ikonProfil) ikonProfil.href = jalur.profil;

  // --- Tampilan tombol ---
  if (sesi) {
    // Sudah login: tombol Masuk hilang, ikon profil muncul
    if (tombolMasuk) tombolMasuk.style.display = "none";

    if (ikonProfil) {
      ikonProfil.classList.remove("hidden");
      ikonProfil.style.display = "flex";
      ikonProfil.title = "Profil " + (sesi.fullName || sesi.username);
      ikonProfil.setAttribute("aria-label", "Buka halaman profil");
    }
  } else {
    // Belum login: ikon profil disembunyikan
    if (ikonProfil) {
      ikonProfil.classList.add("hidden");
      ikonProfil.style.display = "none";
    }

    // Tombol Masuk dikembalikan ke perilaku kelasnya
    // ("hidden md:flex": tersembunyi di ponsel, tampil di layar lebar)
    if (tombolMasuk) tombolMasuk.style.display = "";
  }
}

/**
 * Memuat berkas nav lalu menyisipkannya ke halaman.
 * Penyesuaian isi baru dikerjakan SETELAH penyisipan selesai, karena
 * sebelum itu elemen tombolnya memang belum ada di halaman.
 */
export async function muatTopNav() {
  const wadah = document.getElementById("top-nav-placeholder");
  if (!wadah) return;

  try {
    const tanggapan = await fetch(alamat().navHtml);
    if (!tanggapan.ok) throw new Error("HTTP " + tanggapan.status);

    wadah.innerHTML = await tanggapan.text();
    siapkanIsiNav();

  } catch (err) {
    console.error("Gagal memuat top nav:", err);
    // Nav gagal dimuat bukan alasan menghentikan halaman;
    // isi utama halaman tetap dapat dipakai.
  }
}

muatTopNav();
