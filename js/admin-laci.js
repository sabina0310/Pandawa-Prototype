/**
 * =====================================================================
 * LACI SIDEBAR HALAMAN ADMIN & SUPER-ADMIN
 * =====================================================================
 * Sidebar pada top-nav.html memakai kelas "hidden md:flex", sehingga
 * hilang sama sekali di layar di bawah 768px. Tombol menu di pojok
 * kiri atas sudah ada sejak awal, tetapi tidak pernah dipasangi
 * penanganan apa pun -- akibatnya halaman admin TIDAK BISA dinavigasi
 * dari ponsel.
 *
 * Berkas ini menghidupkan tombol tersebut: sidebar digeser masuk
 * sebagai laci, lengkap dengan latar gelap yang bisa ditekan untuk
 * menutup, tombol Esc, dan penutupan otomatis saat layar dilebarkan.
 *
 * ---------------------------------------------------------------------
 * URUTAN LAPISAN
 * ---------------------------------------------------------------------
 * Latar gelap memakai backdrop-blur, yang mengaburkan apa pun DI
 * BELAKANGNYA. Karena itu sidebar wajib berada di lapisan yang lebih
 * tinggi daripada latar; bila sejajar, sidebar ikut kabur dan seluruh
 * layar tampak buram.
 *
 *     latar gelap   z-40   (menutupi header yang juga z-40)
 *     sidebar       z-50   (khusus layar kecil, lewat max-md:z-50)
 *
 * ---------------------------------------------------------------------
 * CARA DIMUAT
 * ---------------------------------------------------------------------
 * Berkas ini dipanggil dari dalam top-nav.html. Skrip pemuat di tiap
 * halaman menyusun ulang setiap <script> yang ikut tersisip agar
 * benar-benar dijalankan peramban, jadi cukup satu pemanggilan di
 * top-nav.html untuk seluruh halaman.
 * =====================================================================
 */

(function () {
  "use strict";

  var LEBAR_MD = 768;   // titik henti "md" Tailwind

  function siapkan() {
    var tombol = document.getElementById("sidebarToggle");
    var sidebar = document.getElementById("sideNav");
    if (!tombol || !sidebar) return false;
    if (tombol.dataset.laciSiap === "1") return true;   // jangan dipasang dua kali
    tombol.dataset.laciSiap = "1";

    // --- Latar gelap ---
    var tirai = document.createElement("div");
    tirai.className =
      "fixed inset-0 z-40 bg-ink-primary/50 backdrop-blur-sm opacity-0 " +
      "pointer-events-none transition-opacity duration-300 md:hidden";
    document.body.appendChild(tirai);

    // --- Sidebar disiapkan sebagai laci di layar kecil ---
    // "hidden" dilepas supaya elemennya ada, lalu digeser ke luar layar.
    // Di layar >= md kelas max-md: tidak berlaku, jadi sidebar tetap
    // menempel seperti semula.
    sidebar.classList.remove("hidden");
    sidebar.classList.add("flex", "max-md:z-50", "max-md:-translate-x-full",
                          "max-md:shadow-xl", "transition-transform",
                          "duration-300", "ease-halus");

    var terbuka = false;

    function atur(buka) {
      terbuka = buka;
      sidebar.classList.toggle("max-md:-translate-x-full", !buka);
      tirai.classList.toggle("opacity-0", !buka);
      tirai.classList.toggle("pointer-events-none", !buka);
      tombol.setAttribute("aria-expanded", String(buka));
      document.body.style.overflow = buka ? "hidden" : "";
    }

    tombol.addEventListener("click", function (e) {
      e.stopPropagation();
      atur(!terbuka);
    });

    tirai.addEventListener("click", function () { atur(false); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && terbuka) atur(false);
    });

    // Menekan salah satu tautan menu langsung menutup laci
    sidebar.querySelectorAll("a[href]").forEach(function (tautan) {
      tautan.addEventListener("click", function () {
        if (terbuka) atur(false);
      });
    });

    // Bila layar dilebarkan sampai sidebar tampil tetap, laci ditutup
    window.addEventListener("resize", function () {
      if (window.innerWidth >= LEBAR_MD && terbuka) atur(false);
    });

    return true;
  }

  // Top nav disisipkan secara tak serentak oleh skrip pemuat di tiap
  // halaman, jadi kemunculan elemennya diamati sebentar.
  if (siapkan()) return;

  var pengamat = new MutationObserver(function () {
    if (siapkan()) pengamat.disconnect();
  });
  pengamat.observe(document.body, { childList: true, subtree: true });

  setTimeout(function () { pengamat.disconnect(); }, 8000);
})();
