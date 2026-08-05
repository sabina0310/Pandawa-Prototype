/**
 * =====================================================================
 * SIDEBAR PORTAL PENYEWA
 * =====================================================================
 * Dipakai bersama oleh tiga halaman yang memakai kerangka yang sama:
 *   customer/cust-profile.html
 *   customer/history-order.html
 *   customer/profil-customer.html
 *
 * Tugasnya:
 *   1. Menampilkan sapaan berisi nama pengguna yang sedang login
 *   2. Menangani tombol keluar
 *   3. Mengarahkan pengunjung yang belum login ke halaman masuk
 * =====================================================================
 */

import { ambilSesi, KUNCI_SESI } from "./customer-auth.js";

/** Mengambil kata pertama sebuah nama, agar sapaan tidak terlalu panjang. */
function namaPanggilan(namaLengkap) {
  const bagian = String(namaLengkap || "").trim().split(/\s+/);
  return bagian[0] || "Penyewa";
}

/**
 * Menyiapkan sidebar.
 * @param {boolean} wajibLogin - bila true, pengunjung tanpa sesi
 *                               langsung diarahkan ke halaman masuk
 */
export function siapkanSidebar(wajibLogin) {
  const sesi = ambilSesi();

  if (!sesi && wajibLogin) {
    window.location.href = "login-customer.html";
    return null;
  }

  const elSapaan = document.getElementById("sidebarWelcome");
  if (elSapaan) {
    elSapaan.textContent = sesi
      ? "Welcome, " + namaPanggilan(sesi.fullName)
      : "Welcome";
  }

  const tombolKeluar = document.getElementById("logoutBtn");
  if (tombolKeluar) {
    tombolKeluar.addEventListener("click", function (e) {
      e.preventDefault();

      // Seluruh jejak pemesanan ikut dibersihkan agar pengguna
      // berikutnya tidak mewarisi data pemesanan sebelumnya.
      localStorage.removeItem(KUNCI_SESI);
      localStorage.removeItem("bookingData");
      localStorage.removeItem("identityData");
      localStorage.removeItem("extensionData");
      localStorage.removeItem("dataPembayaran");

      window.location.href = "../index.html";
    });
  }

  return sesi;
}
