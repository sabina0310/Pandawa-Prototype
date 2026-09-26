/**
 * =====================================================================
 * PENJAGA HALAMAN PORTAL ADMIN & SUPER ADMIN
 * =====================================================================
 * Sebelum ini, halaman admin/*.html dan super-admin/*.html tidak
 * memeriksa apa pun sebelum menampilkan data -- siapa saja yang
 * mengetik alamatnya langsung bisa membukanya tanpa pernah login.
 *
 * Berkas ini dimuat sebagai <script> BIASA (bukan type="module") di
 * baris PALING ATAS <head>, sebelum elemen lain apa pun. Skrip biasa
 * dijalankan seketika saat dijumpai peramban dan menghentikan
 * penguraian HTML sampai selesai, sehingga isi <body> belum sempat
 * diurai sama sekali ketika pengalihan di bawah ini terjadi -- beda
 * dengan <script type="module"> yang selalu ditunda sampai seluruh
 * dokumen selesai diurai (baru pengalihan terjadi setelah isi halaman
 * sempat berkelebat).
 *
 * Dipasang lewat atribut data- pada tag <script> itu sendiri:
 *
 *   <script src="../js/jaga-portal.js"
 *           data-peran="admin" data-login="login.html"></script>
 *   <script src="../js/jaga-portal.js"
 *           data-peran="superadmin" data-login="login-super-admin.html"></script>
 *
 * Halaman login itu sendiri TIDAK memuat berkas ini -- pintu masuk
 * tidak boleh mengunci dirinya sendiri.
 *
 * Pemeriksaan ini hanya melihat localStorage (client-side), sama
 * seperti seluruh sistem login pengelola lainnya -- lihat catatan
 * keterbatasan pada js/login-pengelola.js.
 * =====================================================================
 */
(function () {
  "use strict";

  var skrip = document.currentScript;
  var peran = skrip.dataset.peran;
  var login = skrip.dataset.login;
  var kunciSesi = peran === "superadmin" ? "superAdminSession" : "adminSession";

  var sesi = null;
  try {
    sesi = JSON.parse(localStorage.getItem(kunciSesi) || "null");
  } catch (err) {
    sesi = null;
  }

  if (!sesi || !sesi.username || sesi.role !== peran) {
    window.location.replace(login);
  }
})();
