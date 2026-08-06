/**
 * =====================================================================
 * PENGACAKAN KATA SANDI (SHA-256 + garam)
 * =====================================================================
 * Berkas ini SENGAJA tidak mengimpor Firebase apa pun, sehingga bisa
 * dipakai bersama oleh:
 *
 *   js/customer-auth.js  -- registrasi & login
 *   seed-data.js         -- membuat akun admin awal
 *   migrasi-user.js      -- memindahkan akun lama
 *
 * Ketiganya WAJIB memakai cara pengacakan yang sama persis. Bila
 * fungsinya disalin ke masing-masing berkas, satu perubahan kecil saja
 * akan membuat kata sandi yang dibuat di satu tempat tidak dapat
 * dicocokkan di tempat lain.
 *
 * ---------------------------------------------------------------------
 * CATATAN KEAMANAN
 * ---------------------------------------------------------------------
 * Kata sandi TIDAK disimpan apa adanya. Sebelum disimpan, kata sandi
 * diacak memakai SHA-256 bawaan browser (Web Crypto API) yang
 * dikombinasikan dengan "garam" (salt) acak berbeda untuk tiap
 * pengguna, sehingga dua orang berkata sandi sama tetap menghasilkan
 * simpanan yang berbeda.
 *
 * bcrypt tidak dipakai karena bcrypt adalah pustaka Node.js yang
 * memerlukan proses di sisi server, sedangkan aplikasi ini seluruhnya
 * berjalan di browser tanpa server autentikasi.
 *
 * Perlu disadari (dan sebaiknya ditulis sebagai keterbatasan pada
 * laporan): karena proses pemeriksaan terjadi di browser dan Firestore
 * Rules masih terbuka, cara ini BELUM setara dengan autentikasi
 * sungguhan. Pengamanan yang semestinya adalah Firebase Authentication,
 * di mana verifikasi dikerjakan server Google.
 *
 * Web Crypto (crypto.subtle) hanya tersedia pada "secure context",
 * yaitu https atau localhost. Membuka berkas lewat klik ganda
 * (file:///) akan membuat fungsi di bawah gagal.
 * =====================================================================
 */

/** Panjang minimal kata sandi yang diterima seluruh form. */
export const PANJANG_MINIMAL_SANDI = 8;

/** Mengubah ArrayBuffer menjadi teks heksadesimal. */
function keHeks(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(function (b) { return b.toString(16).padStart(2, "0"); })
    .join("");
}

/** Membuat garam acak sepanjang 16 karakter heksadesimal. */
function buatGaram() {
  const acak = new Uint8Array(8);
  crypto.getRandomValues(acak);
  return keHeks(acak.buffer);
}

/** Menghitung SHA-256 dari gabungan garam dan kata sandi. */
async function hitungHash(garam, kataSandi) {
  const data = new TextEncoder().encode(garam + ":" + kataSandi);
  const hasil = await crypto.subtle.digest("SHA-256", data);
  return keHeks(hasil);
}

/**
 * Mengacak kata sandi untuk disimpan.
 * Hasilnya berbentuk "sha256$<garam>$<hash>" sehingga cara pengacakan
 * ikut tercatat -- berguna bila suatu saat metodenya diganti.
 */
export async function acakKataSandi(kataSandi) {
  const garam = buatGaram();
  const hash = await hitungHash(garam, kataSandi);
  return "sha256$" + garam + "$" + hash;
}

/** Memeriksa apakah kata sandi cocok dengan yang tersimpan. */
export async function cocokkanKataSandi(kataSandi, tersimpan) {
  const bagian = String(tersimpan || "").split("$");

  if (bagian.length !== 3 || bagian[0] !== "sha256") {
    return false; // format tidak dikenali
  }

  const hash = await hitungHash(bagian[1], kataSandi);
  return hash === bagian[2];
}
