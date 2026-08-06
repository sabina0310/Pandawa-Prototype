/**
 * =====================================================================
 * REGISTRASI & LOGIN (collection "user")
 * =====================================================================
 * Dipakai oleh:
 *   customer/register-customer.html
 *   customer/login-customer.html
 *   admin/login.html
 *   super-admin/login-super-admin.html
 *   super-admin/user-management.html
 *
 * Struktur dokumen pada collection "user":
 *   {
 *     fullName  : string,
 *     username  : string   (unik, disimpan huruf kecil)
 *     password  : string   (hasil hash, BUKAN teks asli)
 *     createdAt : timestamp,
 *     role      : "superadmin" | "admin" | "customer",
 *     cabang    : string[]  -- HANYA untuk role admin
 *   }
 *
 * ---------------------------------------------------------------------
 * CATATAN TENTANG FIELD "cabang"
 * ---------------------------------------------------------------------
 * Field ini hanya ada pada dokumen ber-role admin, berisi daftar id
 * cabang yang ditugaskan kepadanya. Bentuknya array sejak awal supaya
 * satu admin bisa memegang lebih dari satu cabang tanpa perlu mengubah
 * struktur data di kemudian hari.
 *
 * Penyewa TIDAK punya field ini. Cabang seorang penyewa dihitung
 * saat ditampilkan dari transaksi aktif terkininya (lihat
 * js/user-management.js), sehingga selalu mengikuti keadaan terbaru.
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

import { db, COL_USER } from "./firebase-init.js";

import {
  acakKataSandi, cocokkanKataSandi, PANJANG_MINIMAL_SANDI
} from "./sandi.js";

// =====================================================================
// 0. PERAN PENGGUNA
// ---------------------------------------------------------------------
// Ditulis satu kali di sini agar tidak ada salah ketik "super_admin"
// atau "Admin" yang menyebabkan hak akses tidak terbaca.
// =====================================================================
export const ROLE_SUPERADMIN = "superadmin";
export const ROLE_ADMIN = "admin";
export const ROLE_CUSTOMER = "customer";

/** Nama peran dalam bahasa Indonesia, untuk ditampilkan di layar. */
export const LABEL_ROLE = {
  superadmin: "Super Admin",
  admin: "Admin",
  customer: "Pelanggan"
};

/** true bila peran ini memegang penugasan cabang. */
export function pakaiCabang(role) {
  return role === ROLE_ADMIN;
}

// =====================================================================
// 1. PENGACAKAN KATA SANDI
// ---------------------------------------------------------------------
// Cara pengacakannya dipindahkan ke js/sandi.js supaya seed-data.js dan
// migrasi-user.js bisa memakai cara yang persis sama tanpa ikut memuat
// Firebase. Diekspor ulang di sini agar berkas yang sudah mengimpornya
// dari customer-auth.js tetap berjalan seperti sebelumnya.
// =====================================================================
export { acakKataSandi, cocokkanKataSandi, PANJANG_MINIMAL_SANDI };

// =====================================================================
// 2. PEMERIKSAAN ISIAN
// =====================================================================

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
// 3. AKSES COLLECTION "user"
// =====================================================================

/**
 * Mencari satu pengguna berdasarkan username.
 * Username disimpan dalam huruf kecil agar "Budi" dan "budi" dianggap
 * sama dan tidak bisa didaftarkan dua kali.
 */
export async function cariPengguna(username) {
  const kueri = query(
    collection(db, COL_USER),
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
 *
 * Karena admin dan penyewa kini berada di satu collection, pemeriksaan
 * username berlaku menyeluruh: pengunjung tidak bisa mendaftar memakai
 * username "admin" atau "superadmin" yang sudah terpakai.
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
    role: ROLE_CUSTOMER
  };

  await setDoc(doc(db, COL_USER, username), dokumen);

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

  await updateDoc(doc(db, COL_USER, kunci), data);

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

/**
 * Versi masukkanPengguna() untuk portal yang hanya boleh dimasuki peran
 * tertentu. Dipakai halaman login admin dan super admin.
 *
 * Pesan kesalahannya sengaja dibuat sama untuk semua kegagalan
 * ("username salah", "sandi salah", "peran tidak sesuai") supaya
 * pengunjung tidak bisa menebak username mana yang benar-benar ada.
 *
 * @param {string}   username
 * @param {string}   kataSandi
 * @param {string[]} peranDiizinkan - contoh: ["superadmin"]
 */
export async function masukkanPenggunaBerperan(username, kataSandi, peranDiizinkan) {
  const GAGAL = "Username atau kata sandi salah, atau akun ini tidak berhak masuk portal ini.";

  const pengguna = await cariPengguna(username);
  if (!pengguna) throw new Error(GAGAL);

  if (peranDiizinkan.indexOf(pengguna.role) === -1) throw new Error(GAGAL);

  const cocok = await cocokkanKataSandi(kataSandi, pengguna.password);
  if (!cocok) throw new Error(GAGAL);

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

/**
 * Menyusun isi sesi dari sebuah dokumen pengguna.
 * Kata sandi TIDAK ikut, sengaja dibuang di sini supaya tidak ada satu
 * pun pemanggil yang bisa lupa membuangnya.
 */
function bentukSesi(pengguna) {
  const sesi = {
    uid: pengguna.uid,
    username: pengguna.username,
    fullName: pengguna.fullName,
    role: pengguna.role || ROLE_CUSTOMER,
    loginTime: new Date().toISOString()
  };

  // Hanya admin yang membawa daftar cabang. Disimpan di sesi agar
  // halaman admin tidak perlu membaca Firestore ulang hanya untuk
  // mengetahui cabang mana yang boleh dikelolanya.
  if (pakaiCabang(sesi.role)) {
    sesi.cabang = Array.isArray(pengguna.cabang) ? pengguna.cabang : [];
  }

  return sesi;
}

export function simpanSesi(pengguna) {
  localStorage.setItem(KUNCI_SESI, JSON.stringify(bentukSesi(pengguna)));
}

/**
 * Menyimpan sesi untuk portal selain penyewa.
 * Kuncinya berbeda ("adminSession" / "superAdminSession") supaya satu
 * peramban bisa membuka portal admin dan portal penyewa sekaligus tanpa
 * keduanya saling menimpa.
 */
export function simpanSesiPortal(kunci, pengguna) {
  localStorage.setItem(kunci, JSON.stringify(bentukSesi(pengguna)));
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
