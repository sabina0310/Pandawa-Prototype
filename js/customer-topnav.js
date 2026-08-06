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

// Kedua kunci ini ditulis ulang di sini, TIDAK diimpor dari
// customer-auth.js, karena berkas itu ikut memuat Firebase. Top nav
// tampil di setiap halaman termasuk beranda, jadi memuat Firebase hanya
// untuk membaca dua nama kunci akan memperlambat halaman tanpa guna.
// Nilainya harus sama persis dengan yang ada di js/customer-auth.js.
const KUNCI_SESI = "customerSession";
const KUNCI_TUJUAN = "tujuanSetelahLogin";

/**
 * Menentukan posisi halaman pemanggil.
 * true bila halaman berada di dalam folder customer/.
 */
function diDalamFolderCustomer() {
  return window.location.pathname.replace(/\\/g, "/").indexOf("/customer/") !== -1;
}

/**
 * Alamat halaman yang sedang dibuka, DILIHAT DARI halaman login.
 *
 * Halaman login berada di customer/, sehingga:
 *
 *   customer/catalogue.html?tipe=bulanan  -> "catalogue.html?tipe=bulanan"
 *   customer/room-detail.html?cabang=x    -> "room-detail.html?cabang=x"
 *   index.html                            -> "../index.html"
 *
 * Query string ikut dibawa apa adanya. Itu yang membuat pengunjung
 * kembali ke cabang dan tipe sewa yang sedang dilihatnya, bukan sekadar
 * ke halaman katalog kosong.
 *
 * @returns {string|null} null bila halaman ini tidak layak dijadikan
 *          tujuan kembali (halaman login/registrasi itu sendiri).
 */
export function alamatKembali() {
  const jalur = window.location.pathname.replace(/\\/g, "/");
  const berkas = jalur.slice(jalur.lastIndexOf("/") + 1) || "index.html";
  const cari = window.location.search || "";

  // Kembali ke halaman login/registrasi setelah berhasil login jelas
  // tidak masuk akal, jadi keduanya tidak pernah dititipkan.
  if (berkas === "login-customer.html" || berkas === "register-customer.html") {
    return null;
  }

  if (!diDalamFolderCustomer()) {
    // Halaman di akar proyek, contohnya index.html
    return "../" + berkas + cari;
  }

  // Halaman di dalam customer/. Sub-folder seperti order/ dan extend/
  // tidak ikut, karena halaman itu memang hanya bisa dibuka setelah
  // login -- penanganannya sudah ada di js/sesi-valid.js.
  const sisa = jalur.slice(jalur.indexOf("/customer/") + "/customer/".length);
  if (sisa.indexOf("/") !== -1) return null;

  return berkas + cari;
}

/**
 * Menitipkan halaman yang sedang dibuka sebagai tujuan setelah login.
 * Dibaca kembali oleh js/login-customer.js lewat kunci yang sama.
 */
function titipkanTujuan() {
  const tujuan = alamatKembali();
  if (tujuan) localStorage.setItem(KUNCI_TUJUAN, tujuan);
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

  // Halaman yang sedang dibuka dititipkan tepat sebelum berpindah ke
  // halaman login, supaya pengunjung dikembalikan ke sini setelah
  // berhasil masuk -- lengkap dengan parameter cabang & tipe sewanya.
  //
  // Dititipkan saat DIKLIK, bukan saat halaman dimuat, agar tujuan yang
  // sudah dititipkan tombol "Pesan Sekarang" di halaman detail tidak
  // tertimpa hanya karena pengunjung membuka halaman lain.
  if (tombolMasuk) tombolMasuk.addEventListener("click", titipkanTujuan);

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
