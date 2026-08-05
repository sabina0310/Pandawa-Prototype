/**
 * =====================================================================
 * REGISTRASI & LOGIN PENYEWA (collection "customers")
 * =====================================================================
 * Dipakai oleh:
 *   customer/register-customer.html
 *   customer/login-customer.html
 *
 * Struktur dokumen pada collection "customers":
 *   {
 *     fullName  : string,
 *     username  : string   (unik, disimpan huruf kecil)
 *     password  : string   (hasil hash, BUKAN teks asli)
 *     createdAt : timestamp,
 *     role      : "customer"
 *   }
 *
 * ---------------------------------------------------------------------
 * CATATAN PENTING TENTANG KEAMANAN KATA SANDI
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
 * =====================================================================
 */

import {
  collection, doc, setDoc, updateDoc, getDocs, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_CUSTOMERS } from "./firebase-init.js";

// =====================================================================
// 1. PENGACAKAN KATA SANDI
// =====================================================================

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

// =====================================================================
// 2. PEMERIKSAAN ISIAN
// =====================================================================

export const PANJANG_MINIMAL_SANDI = 8;

/**
 * Memeriksa seluruh isian form registrasi.
 * Mengembalikan daftar kesalahan; kosong berarti semua isian benar.
 */
export function periksaFormRegistrasi(data) {
  const masalah = [];

  if (!data.fullName) {
    masalah.push({ field: "fullName", pesan: "Nama lengkap wajib diisi." });
  } else if (data.fullName.length < 3) {
    masalah.push({ field: "fullName", pesan: "Nama lengkap terlalu pendek." });
  }

  if (!data.username) {
    masalah.push({ field: "username", pesan: "Username wajib diisi." });
  } else if (data.username.length < 4) {
    masalah.push({ field: "username", pesan: "Username minimal 4 karakter." });
  } else if (!/^[a-zA-Z0-9._]+$/.test(data.username)) {
    masalah.push({ field: "username", pesan: "Username hanya boleh huruf, angka, titik, dan garis bawah." });
  }

  if (!data.password) {
    masalah.push({ field: "password", pesan: "Kata sandi wajib diisi." });
  } else if (data.password.length < PANJANG_MINIMAL_SANDI) {
    masalah.push({
      field: "password",
      pesan: "Kata sandi minimal " + PANJANG_MINIMAL_SANDI + " karakter."
    });
  }

  if (!data.confirmPassword) {
    masalah.push({ field: "confirmPassword", pesan: "Konfirmasi kata sandi wajib diisi." });
  } else if (data.password !== data.confirmPassword) {
    masalah.push({ field: "confirmPassword", pesan: "Konfirmasi kata sandi tidak sama dengan kata sandi." });
  }

  return masalah;
}

// =====================================================================
// 3. AKSES COLLECTION "customers"
// =====================================================================

/**
 * Mencari satu pengguna berdasarkan username.
 * Username disimpan dalam huruf kecil agar "Budi" dan "budi" dianggap
 * sama dan tidak bisa didaftarkan dua kali.
 */
export async function cariPengguna(username) {
  const kueri = query(
    collection(db, COL_CUSTOMERS),
    where("username", "==", String(username || "").trim().toLowerCase())
  );

  const cuplikan = await getDocs(kueri);
  if (cuplikan.empty) return null;

  const dokumen = cuplikan.docs[0];
  return Object.assign({ uid: dokumen.id }, dokumen.data());
}

/** true bila username sudah dipakai orang lain. */
export async function usernameSudahDipakai(username) {
  return (await cariPengguna(username)) !== null;
}

/**
 * Mendaftarkan pengguna baru.
 * Document ID memakai username huruf kecil, sehingga Firestore sendiri
 * ikut menjamin tidak ada dua akun dengan username sama.
 */
export async function daftarkanPengguna(data) {
  const username = data.username.trim().toLowerCase();

  if (await usernameSudahDipakai(username)) {
    throw new Error('Username "' + data.username + '" sudah dipakai. Silakan pilih username lain.');
  }

  const dokumen = {
    fullName: data.fullName.trim(),
    username: username,
    password: await acakKataSandi(data.password),
    createdAt: Timestamp.fromDate(new Date()),
    role: "customer"
  };

  await setDoc(doc(db, COL_CUSTOMERS, username), dokumen);

  return Object.assign({ uid: username }, dokumen);
}

/**
 * Memperbarui data diri pengguna.
 *
 * Username TIDAK ikut diubah karena dipakai sebagai Document ID
 * sekaligus penanda pemilik pada setiap transaksi. Mengubahnya berarti
 * memindahkan dokumen dan menyunting seluruh riwayat pesanan.
 *
 * @param {string} username     - pemilik akun (Document ID)
 * @param {Object} perubahan    - { fullName, kataSandiBaru? }
 */
export async function perbaruiProfil(username, perubahan) {
  const kunci = String(username || "").trim().toLowerCase();
  const pengguna = await cariPengguna(kunci);

  if (!pengguna) {
    throw new Error("Akun tidak ditemukan. Silakan masuk ulang.");
  }

  const data = { fullName: perubahan.fullName.trim() };

  // Kata sandi hanya diganti bila memang diisi
  if (perubahan.kataSandiBaru) {
    data.password = await acakKataSandi(perubahan.kataSandiBaru);
  }

  await updateDoc(doc(db, COL_CUSTOMERS, kunci), data);

  return Object.assign({}, pengguna, data);
}

/**
 * Memeriksa username dan kata sandi.
 * Mengembalikan data pengguna bila cocok, atau melempar error dengan
 * pesan yang bisa langsung ditampilkan ke pengguna.
 */
export async function masukkanPengguna(username, kataSandi) {
  const pengguna = await cariPengguna(username);

  if (!pengguna) {
    throw new Error("Username tidak terdaftar. Silakan periksa kembali atau buat akun baru.");
  }

  const cocok = await cocokkanKataSandi(kataSandi, pengguna.password);

  if (!cocok) {
    throw new Error("Kata sandi salah. Silakan coba lagi.");
  }

  return pengguna;
}

// =====================================================================
// 4. SESI PENGGUNA
// ---------------------------------------------------------------------
// Tetap memakai kunci localStorage "customerSession" seperti sebelumnya,
// karena kunci itu sudah dipakai banyak halaman untuk mengetahui apakah
// pengunjung sudah login. Isinya diperluas, bukan diganti.
//
// Kata sandi TIDAK ikut disimpan di sesi.
// =====================================================================

export const KUNCI_SESI = "customerSession";

// Kunci penanda halaman tujuan setelah login berhasil.
// Diisi halaman detail cabang saat pengunjung menekan "Pesan Sekarang"
// tanpa sesi login, lalu dibaca dan dihapus oleh halaman login.
export const KUNCI_TUJUAN = "tujuanSetelahLogin";

// Cabang yang terakhir dibuka pengunjung, dipakai untuk mengembalikannya
// ke halaman yang sama setelah login.
export const KUNCI_CABANG_DIBUKA = "cabangDibuka";

export function simpanSesi(pengguna) {
  localStorage.setItem(KUNCI_SESI, JSON.stringify({
    uid: pengguna.uid,
    username: pengguna.username,
    fullName: pengguna.fullName,
    role: pengguna.role || "customer",
    loginTime: new Date().toISOString()
  }));
}

/** Membaca sesi yang tersimpan. null bila belum login. */
export function ambilSesi() {
  const mentah = localStorage.getItem(KUNCI_SESI);
  if (!mentah) return null;

  try {
    return JSON.parse(mentah);
  } catch (err) {
    return null;
  }
}

// =====================================================================
// 5. PEMBERITAHUAN DI HALAMAN
// ---------------------------------------------------------------------
// Menampilkan pesan pada kotak berid "authAlert" bila tersedia.
// =====================================================================
export function tampilkanPesan(jenis, pesan) {
  const kotak = document.getElementById("authAlert");

  if (!kotak) {
    alert(pesan);
    return;
  }

  const gaya = jenis === "sukses"
    ? { kelas: "bg-[#ECFDF3] border-status-available/40 text-status-available", ikon: "check_circle" }
    : { kelas: "bg-error-container border-error/40 text-error", ikon: "error" };

  kotak.className =
    "flex items-start gap-sm p-md rounded-lg border font-body-sm text-body-sm mb-lg " + gaya.kelas;
  kotak.innerHTML =
    '<span class="material-symbols-outlined text-[20px] shrink-0">' + gaya.ikon + '</span>' +
    '<span></span>';
  kotak.querySelector("span:last-child").textContent = pesan;
  kotak.classList.remove("hidden");
}

export function sembunyikanPesan() {
  const kotak = document.getElementById("authAlert");
  if (kotak) kotak.classList.add("hidden");
}

/** Menandai sebuah isian sebagai salah agar mudah ditemukan pengguna. */
export function tandaiSalah(idInput) {
  const input = document.getElementById(idInput);
  if (!input) return;

  input.classList.add("border-error");
  input.addEventListener("input", function bersihkan() {
    input.classList.remove("border-error");
    input.removeEventListener("input", bersihkan);
  });
}

/** Mengubah tampilan tombol selama proses berlangsung. */
export function kunciTombol(tombol, sedangProses, teksProses, teksAsli) {
  if (!tombol) return;

  tombol.disabled = sedangProses;
  tombol.classList.toggle("opacity-60", sedangProses);
  tombol.classList.toggle("cursor-not-allowed", sedangProses);
  tombol.textContent = sedangProses ? teksProses : teksAsli;
}
