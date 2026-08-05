/**
 * =====================================================================
 * BAGIAN <head> BERSAMA SELURUH HALAMAN CUSTOMER
 * =====================================================================
 * Sebelumnya konfigurasi Tailwind sepanjang ±110 baris disalin ulang di
 * 16 halaman. Isinya terbukti sama persis (59 token warna, 8 spacing,
 * 15 ukuran huruf), hanya urutan penulisannya yang berbeda. Berkas ini
 * menggantikan seluruh salinan itu.
 *
 * CARA MEMANGGIL — cukup dua baris di setiap halaman:
 *
 *     <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
 *     <script src="../js/head-bersama.js"></script>
 *
 * Urutannya wajib begitu: Tailwind CDN membuat objek window.tailwind,
 * lalu berkas ini mengisi konfigurasinya.
 *
 * CATATAN TEKNIS
 * <head> tidak bisa disatukan dengan fetch + innerHTML seperti navbar
 * dan footer, sebab <script> yang disisipkan lewat innerHTML tidak
 * pernah dijalankan browser. Karena itu penyatuannya memakai <script
 * src> biasa yang berjalan saat <head> dibaca -- sehingga tidak ada
 * kedipan tampilan tanpa gaya (FOUC).
 *
 * Yang tetap ditulis per halaman hanyalah <title>, karena memang
 * berbeda-beda.
 * =====================================================================
 */

(function () {
  "use strict";

  // ===================================================================
  // 1. PALET WARNA
  // -------------------------------------------------------------------
  // Warna utama sistem: #0156D7.
  //
  // Seluruh 59 nama token dipertahankan apa adanya supaya tidak ada
  // satu pun kelas Tailwind di 16 halaman yang menjadi tidak dikenal.
  // Yang disegarkan adalah NILAINYA: rangkaian abu-abu kecoklatan
  // diganti abu-abu kebiruan agar serasi dengan biru utama, dan warna
  // teks abu-abu digelapkan agar memenuhi ambang keterbacaan WCAG AA.
  // ===================================================================
  var BIRU = "#0156D7";          // warna utama
  var BIRU_TUA = "#0142A8";      // untuk keadaan ditekan / hover gelap
  var TINTA = "#0F172A";         // teks utama
  var TINTA_2 = "#334155";       // teks sekunder
  var TINTA_3 = "#64748B";       // teks redup  (kontras 4.8:1 di atas putih)
  var GARIS = "#E2E8F0";         // garis tipis
  var GARIS_TEBAL = "#CBD5E1";   // garis tegas
  var LATAR = "#F8FAFC";         // latar halaman

  var warna = {
    // --- Warna utama ---
    "primary": BIRU,
    "primary-container": BIRU,
    "on-primary": "#ffffff",
    "on-primary-container": "#ffffff",   // dulu #cfd9ff: terlalu tipis di atas biru
    "primary-fixed": "#DBEAFE",
    "primary-fixed-dim": "#BFDBFE",
    "on-primary-fixed": "#0B2E6F",
    "on-primary-fixed-variant": BIRU_TUA,
    "inverse-primary": "#93C5FD",
    "surface-tint": BIRU,

    // --- Teks ---
    "ink-primary": TINTA,
    "ink-secondary": TINTA_2,
    "ink-muted": TINTA_3,
    "on-surface": TINTA,
    "on-surface-variant": "#475569",
    "on-background": TINTA,
    "inverse-on-surface": "#F1F5F9",

    // --- Permukaan ---
    "surface": LATAR,
    "surface-canvas": "#ffffff",
    "surface-soft": LATAR,
    "surface-bright": "#ffffff",
    "surface-dim": "#E2E8F0",
    "surface-variant": GARIS,
    "surface-container-lowest": "#ffffff",
    "surface-container-low": "#F8FAFC",
    "surface-container": "#F1F5F9",
    "surface-container-high": "#F1F5F9",
    "surface-container-highest": GARIS,
    "inverse-surface": "#1E293B",
    "background": LATAR,

    // --- Garis ---
    "border-hairline": GARIS,
    "border-strong": GARIS_TEBAL,
    "outline": "#94A3B8",
    "outline-variant": GARIS_TEBAL,

    // --- Status ---
    "status-available": "#059669",   // digelapkan agar terbaca sebagai teks
    "status-warning": "#D97706",     // digelapkan agar terbaca sebagai teks
    "status-occupied": "#DC2626",
    "error": "#DC2626",
    "error-container": "#FEE2E2",
    "on-error": "#ffffff",
    "on-error-container": "#991B1B",

    // --- Sekunder (hijau) ---
    "secondary": "#047857",
    "secondary-container": "#D1FAE5",
    "on-secondary": "#ffffff",
    "on-secondary-container": "#065F46",
    "secondary-fixed": "#A7F3D0",
    "secondary-fixed-dim": "#6EE7B7",
    "on-secondary-fixed": "#022C22",
    "on-secondary-fixed-variant": "#065F46",

    // --- Tersier (jingga) ---
    "tertiary": "#B45309",
    "tertiary-container": "#FEF3C7",
    "on-tertiary": "#ffffff",
    "on-tertiary-container": "#92400E",
    "tertiary-fixed": "#FDE68A",
    "tertiary-fixed-dim": "#FCD34D",
    "on-tertiary-fixed": "#451A03",
    "on-tertiary-fixed-variant": "#92400E",

    // --- WhatsApp ---
    "whatsapp-green": "#25D366",
    "whatsapp-hover": "#1DA851"
  };

  // ===================================================================
  // 2. UKURAN HURUF
  // -------------------------------------------------------------------
  // Ukurannya dipertahankan supaya tata letak tidak bergeser. Yang
  // ditambahkan hanya rapatan huruf (letterSpacing) pada ukuran besar,
  // yang membuat judul terlihat lebih tegas dan modern.
  // ===================================================================
  function ukuran(px, tinggi, tebal, rapat) {
    var opsi = { lineHeight: tinggi, fontWeight: tebal };
    if (rapat) opsi.letterSpacing = rapat;
    return [px, opsi];
  }

  var huruf = {
    "display-xl":        ukuran("28px", "36px", "700", "-0.02em"),
    "display-lg":        ukuran("22px", "28px", "600", "-0.015em"),
    "display-lg-mobile": ukuran("20px", "26px", "700", "-0.015em"),
    "display-md":        ukuran("20px", "26px", "700", "-0.01em"),
    "stat-display":      ukuran("32px", "36px", "700", "-0.02em"),
    "title-md":          ukuran("16px", "22px", "600"),
    "body-md":           ukuran("15px", "22px", "400"),
    "body-sm":           ukuran("14px", "20px", "400"),
    "label-md":          ukuran("13px", "18px", "500"),
    "button-md":         ukuran("15px", "20px", "600"),
    "badge":             ukuran("11px", "14px", "600"),
    "tag-uppercase":     ukuran("10px", "12px", "700", "0.06em")
  };

  // Nama keluarga huruf: seluruh token memakai Plus Jakarta Sans.
  // Dipertahankan karena kelas font-body-md, font-title-md, dan
  // kawan-kawannya dipakai di ratusan tempat.
  var KELUARGA = ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"];
  var keluarga = {};
  for (var nama in huruf) keluarga[nama] = KELUARGA;
  keluarga["sans"] = KELUARGA;

  // ===================================================================
  // 3. KONFIGURASI TAILWIND
  // ===================================================================
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: warna,
        fontSize: huruf,
        fontFamily: keluarga,

        // Sudut dibulatkan sedikit lebih besar dari sebelumnya --
        // satu perubahan ini menyegarkan seluruh kartu di 16 halaman.
        borderRadius: {
          DEFAULT: "0.5rem",
          lg: "0.75rem",
          xl: "1rem",
          "2xl": "1.25rem",
          "3xl": "1.5rem",
          full: "9999px"
        },

        // Skala jarak khas proyek ini
        spacing: {
          xxs: "2px",
          xs: "4px",
          sm: "8px",
          md: "12px",
          base: "16px",
          lg: "24px",
          xl: "32px",
          section: "64px"
        },

        // Bayangan lembut berlapis. Sebelumnya kelas "shadow-subtle"
        // dipakai di beberapa halaman padahal tidak pernah
        // didefinisikan, sehingga tidak menghasilkan apa pun.
        boxShadow: {
          subtle: "0 1px 2px 0 rgb(15 23 42 / 0.04)",
          sm: "0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
          DEFAULT: "0 1px 3px 0 rgb(15 23 42 / 0.07), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
          md: "0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05)",
          lg: "0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.05)",
          xl: "0 20px 25px -5px rgb(15 23 42 / 0.09), 0 8px 10px -6px rgb(15 23 42 / 0.05)",
          naik: "0 12px 20px -8px rgb(1 86 215 / 0.22)"
        },

        transitionTimingFunction: {
          halus: "cubic-bezier(0.4, 0, 0.2, 1)"
        },

        keyframes: {
          munculNaik: {
            "0%": { opacity: "0", transform: "translateY(8px)" },
            "100%": { opacity: "1", transform: "translateY(0)" }
          }
        },
        animation: {
          munculNaik: "munculNaik 0.35s cubic-bezier(0.4, 0, 0.2, 1) both"
        }
      }
    }
  };

  // ===================================================================
  // 4. UNSUR <head> LAIN
  // ===================================================================
  var kepala = document.head;

  function tambah(tag, sifat) {
    var el = document.createElement(tag);
    for (var k in sifat) el.setAttribute(k, sifat[k]);
    kepala.appendChild(el);
    return el;
  }

  // --- Huruf ---
  tambah("link", { rel: "preconnect", href: "https://fonts.googleapis.com" });
  tambah("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" });
  tambah("link", {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
  });
  tambah("link", {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
  });

  // --- Keterangan halaman & warna bilah peramban ---
  tambah("meta", {
    name: "description",
    content: "Pilar Pandawa - manajemen kos yang rapi: cari kamar, pesan, bayar, dan perpanjang sewa dalam satu tempat."
  });
  tambah("meta", { name: "theme-color", content: BIRU });

  // --- Ikon tab peramban ---
  // Digambar langsung sebagai SVG supaya tidak perlu berkas terpisah
  // dan tidak pernah gagal dimuat.
  var ikon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="14" fill="' + BIRU + '"/>' +
      '<path d="M22 46V18h13a10 10 0 0 1 0 20h-6v8z" fill="#ffffff"/>' +
    '</svg>';
  tambah("link", {
    rel: "icon",
    type: "image/svg+xml",
    href: "data:image/svg+xml," + encodeURIComponent(ikon)
  });

  // ===================================================================
  // 5. GAYA DASAR
  // -------------------------------------------------------------------
  // Hanya menyentuh hal yang tidak bisa diungkapkan lewat kelas
  // Tailwind: penghalusan huruf, cincin fokus untuk aksesibilitas,
  // dan perilaku bilah gulir.
  // ===================================================================
  var gaya = document.createElement("style");
  gaya.textContent = [
    ":root { --biru: " + BIRU + "; --garis: " + GARIS + "; }",

    "html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }",

    "body {",
    "  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;",
    "  -webkit-font-smoothing: antialiased;",
    "  -moz-osx-font-smoothing: grayscale;",
    "  text-rendering: optimizeLegibility;",
    "}",

    // Cincin fokus hanya muncul saat berpindah dengan papan ketik,
    // sehingga tidak mengganggu pengguna tetikus.
    "a:focus-visible, button:focus-visible, input:focus-visible,",
    "select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {",
    "  outline: 2px solid " + BIRU + ";",
    "  outline-offset: 2px;",
    "  border-radius: 6px;",
    "}",

    // -----------------------------------------------------------------
    // IKON MATERIAL
    // -----------------------------------------------------------------
    // Aturan di bawah dulu ditulis ulang di sembilan halaman. Saat
    // <head> disatukan, salinannya ikut terhapus -- termasuk kelas
    // pembantu ".fill" yang dipakai ikon centang pada halaman bukti
    // pemesanan (order/step-4) dan bukti perpanjangan (extend/step-3).
    // Karena itu keduanya dikembalikan di sini, satu kali untuk semua.
    // -----------------------------------------------------------------
    ".material-symbols-outlined {",
    "  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;",
    "  line-height: 1;",
    "  vertical-align: middle;",
    "}",
    ".material-symbols-outlined.fill,",
    ".material-symbols-outlined.filled,",
    ".material-symbols-outlined[data-weight='fill'] {",
    "  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;",
    "}",

    // Judul besar di beranda. Kelas ini dipakai index.html, tetapi
    // definisinya dulu berada di dalam <head> room-detail.html --
    // berkas yang berbeda, sehingga aturannya tidak pernah benar-benar
    // berlaku. Diletakkan di sini agar akhirnya berfungsi.
    ".hero-title {",
    "  font-size: clamp(2.25rem, 7vw, 6rem);",
    "  line-height: 1.08;",
    "  letter-spacing: -0.02em;",
    "}",

    // Blok lebar (tabel, kode) menggulir di dalam kotaknya sendiri,
    // supaya halaman tidak pernah menggulir ke samping di layar kecil.
    ".gulir-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }",

    // -----------------------------------------------------------------
    // LAPISAN KOMPONEN
    // -----------------------------------------------------------------
    // Aturan di bawah menyeragamkan tampilan pola yang berulang di 16
    // halaman -- kolom isian, tombol, tabel, gambar -- tanpa perlu
    // menyunting markup tiap halaman satu per satu. Seluruhnya murni
    // tampilan; tidak ada yang mengubah perilaku atau tata letak.
    // -----------------------------------------------------------------

    // Kolom isian: tinggi, sudut, dan cincin fokus yang seragam
    "input[type='text'], input[type='email'], input[type='password'],",
    "input[type='tel'], input[type='number'], input[type='search'],",
    "input[type='date'], input[type='time'], select, textarea {",
    "  border-radius: 0.625rem;",
    "  border-color: " + GARIS_TEBAL + ";",
    "  background-color: #fff;",
    "  transition: border-color .18s ease, box-shadow .18s ease;",
    "}",

    "input:not([type='checkbox']):not([type='radio']):focus,",
    "select:focus, textarea:focus {",
    "  border-color: " + BIRU + ";",
    "  box-shadow: 0 0 0 3px rgb(1 86 215 / 0.14);",
    "  outline: none;",
    "}",

    "input::placeholder, textarea::placeholder { color: " + TINTA_3 + "; opacity: 1; }",

    "input:disabled, select:disabled, textarea:disabled {",
    "  background-color: " + LATAR + ";",
    "  color: " + TINTA_3 + ";",
    "  cursor: not-allowed;",
    "}",

    // Kotak centang & pilihan bulat memakai warna utama
    "input[type='checkbox'], input[type='radio'] {",
    "  color: " + BIRU + ";",
    "  border-color: " + GARIS_TEBAL + ";",
    "  cursor: pointer;",
    "}",
    "input[type='checkbox']:focus, input[type='radio']:focus {",
    "  box-shadow: 0 0 0 3px rgb(1 86 215 / 0.14);",
    "}",

    // Umpan balik tekan yang seragam untuk seluruh tombol & tautan tombol
    "button:not(:disabled), a[href] {",
    "  transition: background-color .18s ease, color .18s ease,",
    "              box-shadow .18s ease, transform .12s ease, filter .18s ease;",
    "}",
    "button:not(:disabled):active { transform: scale(.985); }",
    "button:disabled { cursor: not-allowed; opacity: .55; }",

    // Tautan yang berperan sebagai tombol tidak perlu garis bawah
    "a.no-underline, a.no-underline:hover { text-decoration: none; }",

    // Tabel: garis pemisah lembut
    "table { border-collapse: separate; border-spacing: 0; }",
    "tbody tr { transition: background-color .15s ease; }",

    // Gambar tidak pernah meluber dari kotaknya
    "img, svg, video, canvas { max-width: 100%; height: auto; }",

    // Garis pemisah mengikuti warna garis sistem
    "hr { border-color: " + GARIS + "; }",

    // Isi utama muncul dengan halus saat halaman dibuka.
    // Kerangka animasinya ditulis di sini, bukan mengandalkan yang di
    // konfigurasi Tailwind, karena Tailwind hanya membuatkannya bila
    // kelas animate-munculNaik benar-benar dipakai di markup.
    "@keyframes munculNaik {",
    "  from { opacity: 0; transform: translateY(8px); }",
    "  to   { opacity: 1; transform: none; }",
    "}",
    "main { animation: munculNaik .35s cubic-bezier(.4,0,.2,1) both; }",

    // Tombol yang belum punya halaman tujuan
    ".belum-tersedia {",
    "  opacity: .45;",
    "  cursor: not-allowed;",
    "  pointer-events: none;",
    "}",

    // Sorotan sentuhan pada peranti layar sentuh
    ".tap-highlight-none { -webkit-tap-highlight-color: transparent; }",

    // Bilah gulir tipis di peramban berbasis WebKit
    "@media (min-width: 1024px) {",
    "  ::-webkit-scrollbar { width: 10px; height: 10px; }",
    "  ::-webkit-scrollbar-track { background: " + LATAR + "; }",
    "  ::-webkit-scrollbar-thumb { background: " + GARIS_TEBAL + "; border-radius: 9999px; }",
    "  ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }",
    "}",

    // Teks yang disorot pengguna
    "::selection { background: " + BIRU + "; color: #fff; }",

    // Menghormati pengguna yang mematikan animasi di sistemnya
    "@media (prefers-reduced-motion: reduce) {",
    "  html { scroll-behavior: auto; }",
    "  *, *::before, *::after {",
    "    animation-duration: .01ms !important;",
    "    transition-duration: .01ms !important;",
    "  }",
    "}"
  ].join("\n");
  kepala.appendChild(gaya);
})();
