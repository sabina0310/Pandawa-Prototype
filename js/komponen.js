/**
 * =====================================================================
 * PEMUAT KOMPONEN BERSAMA HALAMAN CUSTOMER
 * =====================================================================
 * Proyek ini HTML statis tanpa proses build, jadi tidak ada mekanisme
 * include bawaan seperti pada PHP. Penyatuan komponen dikerjakan di
 * sisi peramban: berkas partial diambil dengan fetch lalu disisipkan
 * ke elemen penampung yang sudah disediakan halaman.
 *
 * Komponen yang dilayani:
 *   #footer-placeholder          -> partials/footer.html
 *   #sidebar-placeholder         -> partials/sidebar.html
 *   #bottom-nav-placeholder      -> partials/bottom-nav.html
 *   #top-bar-mobile-placeholder  -> partials/top-bar-mobile.html
 *
 * Top nav (#top-nav-placeholder) TIDAK diurus di sini; berkas itu
 * sudah punya pengurus sendiri di js/customer-topnav.js karena perlu
 * menyesuaikan tautan dengan keadaan login.
 *
 * ---------------------------------------------------------------------
 * MENANDAI HALAMAN YANG SEDANG DIBUKA
 * ---------------------------------------------------------------------
 * Sidebar dan bilah bawah dipakai empat halaman yang berbeda. Halaman
 * pemanggil cukup menuliskan penanda pada <body>:
 *
 *     <body data-halaman="riwayat">
 *
 * Nilai yang dikenali: beranda, profil, riwayat, perpanjang.
 *
 * ---------------------------------------------------------------------
 * CATATAN PENTING
 * ---------------------------------------------------------------------
 * <script> yang disisipkan lewat innerHTML TIDAK dijalankan peramban,
 * jadi seluruh perilaku komponen (tombol menu, laci sidebar) dipasang
 * dari berkas ini SETELAH penyisipan selesai -- bukan dari dalam
 * berkas partial-nya.
 * =====================================================================
 */

// Kelas untuk tautan navigasi yang sedang aktif dan yang tidak.
const AKTIF_SIDEBAR = ["bg-primary-container", "text-on-primary", "shadow-sm"];
const DIAM_SIDEBAR = ["text-on-surface-variant", "hover:bg-surface-container-high"];
const AKTIF_BAWAH = ["text-primary-container", "font-bold"];
const DIAM_BAWAH = ["text-on-surface-variant"];

/**
 * Menentukan awalan jalur menuju folder partials, sesuai kedalaman
 * halaman pemanggil:
 *
 *   index.html                  -> customer/partials/
 *   customer/catalogue.html     -> partials/
 *   customer/order/step-1.html  -> ../partials/
 */
function awalanJalur() {
  const jalur = window.location.pathname.replace(/\\/g, "/");
  const posisi = jalur.indexOf("/customer/");

  if (posisi === -1) return "customer/partials/";

  // Menghitung berapa tingkat folder di bawah customer/
  const sisa = jalur.slice(posisi + "/customer/".length);
  const tingkat = sisa.split("/").length - 1;

  return tingkat > 0 ? "../".repeat(tingkat) + "partials/" : "partials/";
}

/** Menyisipkan satu berkas partial ke penampungnya. */
async function sisipkan(idPenampung, namaBerkas) {
  const wadah = document.getElementById(idPenampung);
  if (!wadah) return false;

  try {
    const tanggapan = await fetch(awalanJalur() + namaBerkas);
    if (!tanggapan.ok) throw new Error("HTTP " + tanggapan.status);

    wadah.innerHTML = await tanggapan.text();
    return true;

  } catch (err) {
    console.error("Gagal memuat komponen " + namaBerkas + ":", err);
    // Komponen gagal dimuat bukan alasan menghentikan halaman;
    // isi utamanya tetap dapat dipakai.
    return false;
  }
}

// =====================================================================
// MENANDAI TAUTAN HALAMAN AKTIF
// =====================================================================
function tandaiAktif() {
  const halaman = document.body.getAttribute("data-halaman");

  document.querySelectorAll(".nav-sidebar").forEach(function (tautan) {
    const ini = tautan.getAttribute("data-nav") === halaman;
    tautan.classList.add.apply(tautan.classList, ini ? AKTIF_SIDEBAR : DIAM_SIDEBAR);

    // Ikon halaman aktif ditampilkan dalam bentuk terisi
    const ikon = tautan.querySelector(".material-symbols-outlined");
    if (ikon && ini) ikon.style.fontVariationSettings = "'FILL' 1";
    if (ini) tautan.setAttribute("aria-current", "page");
  });

  document.querySelectorAll(".nav-bawah").forEach(function (tautan) {
    const ini = tautan.getAttribute("data-nav") === halaman;
    tautan.classList.add.apply(tautan.classList, ini ? AKTIF_BAWAH : DIAM_BAWAH);

    const ikon = tautan.querySelector(".material-symbols-outlined");
    if (ikon && ini) ikon.style.fontVariationSettings = "'FILL' 1";
    if (ini) tautan.setAttribute("aria-current", "page");
  });
}

// =====================================================================
// LACI SIDEBAR DI LAYAR KECIL
// ---------------------------------------------------------------------
// Sidebar memakai kelas "hidden lg:flex", jadi di ponsel ia memang
// tidak tampil. Tombol menu pada bilah atas menggesernya masuk sebagai
// laci, lengkap dengan latar gelap yang bisa ditekan untuk menutup.
// =====================================================================
function siapkanLaci() {
  const tombol = document.getElementById("sidebarToggle");
  const wadah = document.getElementById("sidebar-placeholder");
  if (!tombol || !wadah) return;

  const sidebar = wadah.querySelector("aside");
  if (!sidebar) return;

  // Latar gelap dibuat sekali, dipakai berulang
  const tirai = document.createElement("div");
  tirai.className =
    "fixed inset-0 z-40 bg-ink-primary/50 backdrop-blur-sm opacity-0 pointer-events-none " +
    "transition-opacity duration-300 lg:hidden";
  document.body.appendChild(tirai);

  // Di layar kecil sidebar digeser ke luar layar, siap didorong masuk
  sidebar.classList.remove("hidden");
  sidebar.classList.add("flex", "max-lg:-translate-x-full", "transition-transform",
                        "duration-300", "ease-halus", "max-lg:shadow-xl");

  let terbuka = false;

  function atur(buka) {
    terbuka = buka;
    sidebar.classList.toggle("max-lg:-translate-x-full", !buka);
    tirai.classList.toggle("opacity-0", !buka);
    tirai.classList.toggle("pointer-events-none", !buka);
    tombol.setAttribute("aria-expanded", String(buka));
    document.body.style.overflow = buka ? "hidden" : "";
  }

  tombol.addEventListener("click", function () { atur(!terbuka); });
  tirai.addEventListener("click", function () { atur(false); });

  // Menutup laci dengan tombol Esc
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && terbuka) atur(false);
  });

  // Bila layar dilebarkan sampai sidebar tampil tetap, laci ditutup
  window.addEventListener("resize", function () {
    if (window.innerWidth >= 1024 && terbuka) atur(false);
  });
}

// =====================================================================
// MENU TOP NAV DI LAYAR KECIL
// ---------------------------------------------------------------------
// Dipasang di sini, bukan di js/customer-topnav.js, agar berkas itu
// tidak perlu diubah. Pemasangannya menunggu sampai nav benar-benar
// tersisip, karena tombolnya belum ada sebelum itu.
// =====================================================================
function siapkanMenuTopNav() {
  const tombol = document.getElementById("navMenuToggle");
  const menu = document.getElementById("navMenu");
  if (!tombol || !menu) return false;

  let terbuka = false;

  function atur(buka) {
    terbuka = buka;
    menu.classList.toggle("hidden", !buka);
    menu.classList.toggle("flex", buka);
    tombol.setAttribute("aria-expanded", String(buka));
    const ikon = tombol.querySelector(".material-symbols-outlined");
    if (ikon) ikon.textContent = buka ? "close" : "menu";
  }

  tombol.addEventListener("click", function (e) {
    e.stopPropagation();
    atur(!terbuka);
  });

  // Menutup menu saat menekan di luar area nav
  document.addEventListener("click", function (e) {
    if (terbuka && !menu.contains(e.target)) atur(false);
  });

  // Menutup menu saat layar dilebarkan
  window.addEventListener("resize", function () {
    if (window.innerWidth >= 768 && terbuka) atur(false);
  });

  return true;
}

/** Menunggu top nav tersisip, lalu memasang perilaku menunya. */
function tungguTopNav() {
  if (!document.getElementById("top-nav-placeholder")) return;
  if (siapkanMenuTopNav()) return;

  // js/customer-topnav.js menyisipkan nav secara tak serentak,
  // jadi kemunculannya diamati sebentar.
  const pengamat = new MutationObserver(function () {
    if (siapkanMenuTopNav()) pengamat.disconnect();
  });
  pengamat.observe(document.getElementById("top-nav-placeholder"),
                   { childList: true, subtree: true });

  setTimeout(function () { pengamat.disconnect(); }, 8000);
}

// =====================================================================
// PROSES UTAMA
// =====================================================================
export async function muatKomponen() {
  await Promise.all([
    sisipkan("top-bar-mobile-placeholder", "top-bar-mobile.html"),
    sisipkan("sidebar-placeholder", "sidebar.html"),
    sisipkan("bottom-nav-placeholder", "bottom-nav.html"),
    sisipkan("footer-placeholder", "footer.html")
  ]);

  tandaiAktif();
  siapkanLaci();
  tungguTopNav();
}

muatKomponen();
