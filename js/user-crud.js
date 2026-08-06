/**
 * =====================================================================
 * CRUD PENGGUNA (halaman super-admin/user-management.html)
 * =====================================================================
 * Berisi seluruh aksi yang MENGUBAH data pengguna: tambah, edit, hapus,
 * beserta halaman detail. Pemisahannya mengikuti halaman Cabang, di mana
 * admin-branches.js menampilkan dan admin-branches-crud.js mengubah.
 *
 * ---------------------------------------------------------------------
 * BENTUK TAMPILAN
 * ---------------------------------------------------------------------
 * Form tambah/edit dan detail berupa HALAMAN, bukan kotak melayang:
 * tampilan daftar disembunyikan dan halamannya ditampilkan di tempatnya,
 * persis seperti halaman Cabang & Kamar.
 *
 * Yang tetap berupa modal hanyalah konfirmasi hapus, karena isinya satu
 * pertanyaan singkat -- memindahkan pengguna ke halaman lain hanya untuk
 * menjawab "ya/batal" justru membuatnya kehilangan konteks tabel.
 *
 * ---------------------------------------------------------------------
 * ATURAN YANG DITEGAKKAN DI SINI
 * ---------------------------------------------------------------------
 * 1. Akun yang dibuat di sini HANYA berisi data masuk.
 *    Baik admin maupun pelanggan. Untuk pelanggan, membuat akun TIDAK
 *    membuat pesanan dan TIDAK memberi kamar: kamar adalah field milik
 *    transaksi, bukan milik akun. Kolom Cabang pelanggan baru terisi
 *    setelah ia memesan dan kamarnya dialokasikan admin.
 *
 *    Perlu dicatat sebagai keterbatasan: karena kata sandi awal diisi
 *    super admin, ia ikut mengetahuinya. Pelanggan yang mendaftar
 *    sendiri lewat halaman registrasi tidak punya masalah ini.
 *
 * 2. Peran tidak dapat diubah setelah akun dibuat.
 *    Menaikkan pelanggan menjadi admin akan membuat dokumennya perlu
 *    field cabang, sementara riwayat transaksinya tetap menempel pada
 *    username yang sama -- dua hal yang saling bertentangan.
 *
 * 3. Cabang hanya ada pada form admin.
 *    Pada pelanggan, kolom cabang berasal dari transaksi, jadi tidak
 *    ada yang bisa disunting.
 *
 * 4. Super admin terakhir tidak dapat dihapus.
 *    Tanpa penjagaan ini, satu kali salah klik membuat portal super
 *    admin tidak bisa dimasuki siapa pun lagi.
 * =====================================================================
 */

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_USER } from "./firebase-init.js";

import {
  ROLE_SUPERADMIN, ROLE_ADMIN, LABEL_ROLE,
  acakKataSandi, PANJANG_MINIMAL_SANDI
} from "./customer-auth.js";

import { amankanTeks, formatTanggal } from "./admin-util.js";

// =====================================================================
// 1. NOTIFIKASI HASIL AKSI
// ---------------------------------------------------------------------
// Bentuknya disamakan dengan admin-branches-crud.js agar pemberitahuan
// di seluruh portal super admin terlihat sama.
// =====================================================================
const elNotifikasi = document.getElementById("notifikasiAksi");

function beriTahu(jenis, pesan) {
  if (!elNotifikasi) {
    alert(pesan);
    return;
  }

  const gaya = {
    sukses: { kelas: "bg-[#ECFDF3] border-status-available text-status-available", ikon: "check_circle" },
    gagal: { kelas: "bg-error-container border-error text-error", ikon: "error" },
    info: { kelas: "bg-surface-canvas border-border-strong text-ink-primary", ikon: "info" }
  }[jenis] || { kelas: "bg-surface-canvas border-border-strong text-ink-primary", ikon: "info" };

  const kotak = document.createElement("div");
  kotak.className =
    "flex items-start gap-sm max-w-sm px-base py-md rounded-xl border shadow-lg " +
    "font-body-sm text-body-sm transition-opacity duration-300 " + gaya.kelas;
  kotak.innerHTML =
    '<span class="material-symbols-outlined text-[20px] shrink-0">' + gaya.ikon + "</span>" +
    "<span>" + amankanTeks(pesan) + "</span>";

  elNotifikasi.appendChild(kotak);

  // Pesan gagal dibiarkan lebih lama karena biasanya perlu dibaca
  const lama = jenis === "gagal" ? 6000 : 3500;
  setTimeout(function () {
    kotak.classList.add("opacity-0");
    setTimeout(function () { kotak.remove(); }, 300);
  }, lama);
}

// =====================================================================
// 2. FUNGSI BANTU TAMPILAN
// =====================================================================

function buka(elemen) {
  if (!elemen) return;
  elemen.classList.remove("hidden");
  elemen.classList.add("flex");
}

function tutup(elemen) {
  if (!elemen) return;
  elemen.classList.add("hidden");
  elemen.classList.remove("flex");
}

/**
 * Berpindah antara tampilan daftar dan salah satu halaman isian.
 * Semuanya berada di berkas HTML yang sama; yang berpindah hanyalah
 * mana yang ditampilkan -- sama seperti halaman Cabang & Kamar.
 *
 * @param {Element}   daftar  - tampilan daftar (tabel pengguna)
 * @param {Element[]} semua   - seluruh halaman yang bisa dibuka
 * @param {Element}   tujuan  - halaman yang ditampilkan; null = kembali
 *                              ke tampilan daftar
 */
function tampilkanHalaman(daftar, semua, tujuan) {
  if (!daftar) return;

  daftar.classList.toggle("hidden", tujuan !== null);

  semua.forEach(function (h) {
    if (!h) return;
    const aktif = h === tujuan;
    h.classList.toggle("hidden", !aktif);
    h.classList.toggle("flex", aktif);
  });

  // Halaman bisa lebih panjang dari layar. Tanpa ini, pengguna yang
  // menekan Edit dari baris paling bawah akan mendarat di tengah
  // halaman dan mengira judulnya hilang.
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Menandai sebuah isian sebagai salah, lalu memberi tahu penggunanya. */
function tandaiSalah(elemen, pesan) {
  if (elemen) {
    elemen.classList.add("border-error");
    elemen.focus();
    setTimeout(function () { elemen.classList.remove("border-error"); }, 3000);
  }
  beriTahu("gagal", pesan);
}

/** Mengubah teks tombol selama proses penyimpanan berlangsung. */
function kunciTombol(tombol, sedangProses, teksProses) {
  if (!tombol) return null;

  if (sedangProses) {
    const asli = tombol.textContent;
    tombol.disabled = true;
    tombol.classList.add("opacity-60", "cursor-not-allowed");
    tombol.textContent = teksProses;
    return asli;
  }

  tombol.disabled = false;
  tombol.classList.remove("opacity-60", "cursor-not-allowed");
  return null;
}

// =====================================================================
// 3. PEMERIKSAAN ISIAN FORM
// ---------------------------------------------------------------------
// Ditulis sebagai fungsi murni (tanpa menyentuh DOM) supaya aturannya
// bisa diuji satu per satu.
// =====================================================================

/**
 * @param {Object}  data           - { fullName, username, password, konfirmasi, cabang }
 * @param {boolean} data.modeUbah  - true bila sedang menyunting akun yang ada
 * @returns {Array} daftar { field, pesan }; kosong berarti semua benar
 */
export function periksaFormUser(data) {
  const masalah = [];

  const nama = String(data.fullName || "").trim();
  if (!nama) {
    masalah.push({ field: "fullName", pesan: "Nama lengkap wajib diisi." });
  } else if (nama.length < 3) {
    masalah.push({ field: "fullName", pesan: "Nama lengkap terlalu pendek." });
  }

  // Username tidak diperiksa saat mengubah, karena dipakai sebagai
  // Document ID sekaligus penanda pemilik transaksi -- sama seperti
  // aturan pada perbaruiProfil() di customer-auth.js.
  if (!data.modeUbah) {
    const username = String(data.username || "").trim();

    if (!username) {
      masalah.push({ field: "username", pesan: "Username wajib diisi." });
    } else if (username.length < 4) {
      masalah.push({ field: "username", pesan: "Username minimal 4 karakter." });
    } else if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      masalah.push({
        field: "username",
        pesan: "Username hanya boleh huruf, angka, titik, dan garis bawah."
      });
    }
  }

  // Saat mengubah, kata sandi boleh dikosongkan (berarti tidak diganti)
  const wajibSandi = !data.modeUbah;
  const sandi = String(data.password || "");

  if (wajibSandi && !sandi) {
    masalah.push({ field: "password", pesan: "Kata sandi wajib diisi." });
  } else if (sandi && sandi.length < PANJANG_MINIMAL_SANDI) {
    masalah.push({
      field: "password",
      pesan: "Kata sandi minimal " + PANJANG_MINIMAL_SANDI + " karakter."
    });
  }

  if (sandi && sandi !== String(data.konfirmasi || "")) {
    masalah.push({
      field: "konfirmasi",
      pesan: "Konfirmasi kata sandi tidak sama dengan kata sandi."
    });
  }

  // Cabang hanya wajib bagi admin
  if (data.role === ROLE_ADMIN) {
    const cabang = Array.isArray(data.cabang) ? data.cabang : [];
    if (cabang.length === 0) {
      masalah.push({ field: "cabang", pesan: "Pilih minimal satu cabang untuk admin ini." });
    }
  }

  return masalah;
}

// =====================================================================
// 4. PENYIAPAN HALAMAN
// ---------------------------------------------------------------------
// Seluruh isi di bawah dibungkus satu fungsi agar user-management.js
// dapat menyerahkan data yang dibutuhkan (daftar cabang, pencarian
// pengguna, riwayat transaksi) tanpa kedua berkas saling mengimpor.
// =====================================================================
export function siapkanCrud(sumber) {
  // --- Elemen form tambah/edit ---
  // Form berupa HALAMAN, bukan modal: mengikuti pola halaman Cabang &
  // Kamar, di mana tampilan daftar disembunyikan dan halaman form
  // ditampilkan di tempatnya. Isian cabang bisa panjang, sehingga lebih
  // lega dibaca pada halaman penuh daripada di dalam kotak melayang.
  const tampilanDaftar = document.getElementById("userListView");
  const halamanForm = document.getElementById("userFormPage");
  const judulForm = document.getElementById("userFormJudul");
  const keteranganForm = document.getElementById("userFormKeterangan");
  const tombolTutupForm = document.getElementById("userFormTutup");
  const tombolBatalForm = document.getElementById("userFormBatal");
  const tombolSimpan = document.getElementById("userFormSimpan");

  const inputNama = document.getElementById("userFormNama");
  const inputUsername = document.getElementById("userFormUsername");
  const inputSandi = document.getElementById("userFormSandi");
  const inputKonfirmasi = document.getElementById("userFormKonfirmasi");
  const labelSandi = document.getElementById("userFormLabelSandi");
  const kelompokCabang = document.getElementById("userFormCabang");
  const barisCabang = document.getElementById("userFormBarisCabang");
  const barisUsername = document.getElementById("userFormBarisUsername");
  const formIsian = document.getElementById("userForm");

  const pilihanRole = document.getElementById("userFormRole");
  const catatanRole = document.getElementById("userFormCatatanRole");
  const barisRole = document.getElementById("userFormBarisRole");

  // --- Elemen halaman detail ---
  const halamanDetail = document.getElementById("userDetailPage");
  const isiDetail = document.getElementById("userDetailIsi");
  const tombolTutupDetail = document.getElementById("userDetailTutup");
  const tombolTutupDetail2 = document.getElementById("userDetailTutup2");

  // Seluruh halaman yang menggantikan tampilan daftar. Konfirmasi hapus
  // TIDAK ikut di sini karena tetap berupa modal.
  const semuaHalaman = [halamanForm, halamanDetail];

  // --- Elemen modal konfirmasi hapus ---
  const modalKonfirmasi = document.getElementById("konfirmasiModal");
  const judulKonfirmasi = document.getElementById("konfirmasiJudul");
  const pesanKonfirmasi = document.getElementById("konfirmasiPesan");
  const tombolBatalHapus = document.getElementById("konfirmasiBatal");
  const tombolHapus = document.getElementById("konfirmasiHapus");

  // --- Tombol tambah admin ---
  const tombolTambah = document.getElementById("tambahAdminBtn");

  // null = sedang menambah, berisi username = sedang menyunting
  let usernameDiubah = null;
  let aksiSetelahKonfirmasi = null;

  // -------------------------------------------------------------------
  // 4a. Daftar cabang pada form (multi-select berupa checkbox)
  // -------------------------------------------------------------------

  /**
   * Menggambar ulang pilihan cabang.
   * Dipanggil juga dari user-management.js setiap kali collection
   * cabang berubah, supaya cabang yang baru ditambahkan langsung
   * tersedia tanpa perlu memuat ulang halaman.
   */
  function perbaruiPilihanCabang() {
    if (!kelompokCabang) return;

    // Pilihan yang sedang tercentang dipertahankan, supaya form yang
    // sedang diisi tidak terhapus ketika daftar cabang diperbarui.
    const tercentang = bacaCabangTerpilih();
    const daftar = sumber.ambilDaftarCabang();

    if (daftar.length === 0) {
      kelompokCabang.innerHTML =
        '<p class="font-body-sm text-body-sm text-ink-muted">' +
        "Belum ada cabang. Tambahkan cabang terlebih dahulu di menu Manajemen Kamar &amp; Cabang." +
        "</p>";
      return;
    }

    kelompokCabang.innerHTML = daftar.map(function (cabang) {
      const dipilih = tercentang.indexOf(cabang.id) !== -1 ? " checked" : "";
      return '<label class="flex items-center gap-sm">' +
        '<input class="text-primary focus:ring-primary rounded" type="checkbox" data-cabang="' +
        amankanTeks(cabang.id) + '"' + dipilih + ">" +
        '<span class="font-body-sm text-body-sm">' + amankanTeks(cabang.nama) + "</span>" +
        "</label>";
    }).join("");
  }

  /** Membaca id cabang yang tercentang. */
  function bacaCabangTerpilih() {
    if (!kelompokCabang) return [];

    const hasil = [];
    kelompokCabang.querySelectorAll("[data-cabang]").forEach(function (kotak) {
      if (kotak.checked) hasil.push(kotak.dataset.cabang);
    });
    return hasil;
  }

  /** Mencentang cabang sesuai daftar yang sudah tersimpan. */
  function isiCabangTerpilih(daftar) {
    if (!kelompokCabang) return;

    const dipilih = Array.isArray(daftar) ? daftar : [];
    kelompokCabang.querySelectorAll("[data-cabang]").forEach(function (kotak) {
      kotak.checked = dipilih.indexOf(kotak.dataset.cabang) !== -1;
    });
  }

  // -------------------------------------------------------------------
  // 4b. Membuka form
  // -------------------------------------------------------------------

  /** Menampilkan halaman form, menyembunyikan tampilan daftar. */
  function bukaHalamanForm() {
    tampilkanHalaman(tampilanDaftar, semuaHalaman, halamanForm);
  }

  /** Menampilkan halaman detail. */
  function bukaHalamanDetail() {
    tampilkanHalaman(tampilanDaftar, semuaHalaman, halamanDetail);
  }

  /** Kembali ke tampilan daftar dan mengosongkan isian. */
  function tutupHalamanForm() {
    tampilkanHalaman(tampilanDaftar, semuaHalaman, null);
    bersihkanForm();
    usernameDiubah = null;
  }

  /** Kembali ke tampilan daftar dari halaman detail. */
  function tutupHalamanDetail() {
    tampilkanHalaman(tampilanDaftar, semuaHalaman, null);
  }

  /** Mengosongkan seluruh isian. */
  function bersihkanForm() {
    if (inputNama) inputNama.value = "";
    if (inputUsername) inputUsername.value = "";
    if (inputSandi) inputSandi.value = "";
    if (inputKonfirmasi) inputKonfirmasi.value = "";
    isiCabangTerpilih([]);
  }

  /** Peran yang sedang dipilih pada form. */
  function roleDipilih() {
    return pilihanRole ? pilihanRole.value : ROLE_ADMIN;
  }

  /**
   * Menyesuaikan form mengikuti peran yang dipilih.
   *
   * Bagian cabang HANYA muncul untuk admin. Pada pelanggan, cabang
   * tidak pernah disimpan di dokumen user -- nilainya dihitung dari
   * transaksi aktif terkini setiap kali ditampilkan.
   */
  function sesuaikanFormDenganRole() {
    const admin = roleDipilih() === ROLE_ADMIN;

    if (barisCabang) barisCabang.classList.toggle("hidden", !admin);
    if (tombolSimpan) {
      tombolSimpan.textContent = admin ? "Simpan Admin" : "Simpan Pelanggan";
    }

    if (catatanRole) {
      catatanRole.textContent = admin
        ? "Admin ditugaskan ke cabang tertentu. Peran tidak dapat diubah setelah akun dibuat."
        : "Akun pelanggan yang dibuat di sini hanya berisi data masuk. Cabang dan kamar " +
          "belum terisi sampai pelanggan melakukan pemesanan dan kamarnya dialokasikan " +
          "lewat halaman Alokasi Kamar.";
    }
  }

  /** Membuka form dalam mode TAMBAH pengguna baru. */
  function bukaFormTambah() {
    usernameDiubah = null;
    perbaruiPilihanCabang();
    bersihkanForm();

    if (pilihanRole) {
      pilihanRole.value = ROLE_ADMIN;
      pilihanRole.disabled = false;
    }

    if (judulForm) judulForm.textContent = "Tambah User Baru";
    if (keteranganForm) {
      keteranganForm.textContent =
        "Pilih peran terlebih dahulu, lalu isi data akunnya.";
    }
    if (labelSandi) labelSandi.textContent = "Kata Sandi";
    if (barisUsername) barisUsername.classList.remove("hidden");
    if (barisRole) barisRole.classList.remove("hidden");
    if (inputUsername) inputUsername.disabled = false;

    sesuaikanFormDenganRole();

    bukaHalamanForm();
    // preventScroll: fokus tidak boleh menarik layar kembali dan
    // membatalkan gulir halus ke atas yang baru saja dijalankan
    if (inputNama) inputNama.focus({ preventScroll: true });
  }

  /** Membuka form dalam mode UBAH. */
  function bukaFormUbah(pengguna) {
    usernameDiubah = pengguna.username;
    perbaruiPilihanCabang();
    bersihkanForm();

    if (inputNama) inputNama.value = pengguna.fullName || "";
    if (inputUsername) {
      inputUsername.value = pengguna.username;
      inputUsername.disabled = true; // Document ID tidak boleh berubah
    }

    const admin = pengguna.role === ROLE_ADMIN;
    if (admin) isiCabangTerpilih(pengguna.cabang);

    // Peran ditampilkan tetapi dikunci: mengubahnya berarti dokumennya
    // perlu / tidak lagi perlu field cabang, sementara riwayat
    // transaksinya tetap menempel pada username yang sama.
    if (pilihanRole) {
      pilihanRole.value = pengguna.role;
      pilihanRole.disabled = true;
    }
    if (catatanRole) {
      catatanRole.textContent = "Peran tidak dapat diubah setelah akun dibuat.";
    }

    // Super admin tidak punya pilihan peran yang sepadan pada daftar,
    // jadi barisnya disembunyikan saja daripada menampilkan pilihan
    // yang isinya tidak cocok.
    if (barisRole) {
      barisRole.classList.toggle("hidden", pengguna.role === ROLE_SUPERADMIN);
    }

    if (judulForm) {
      judulForm.textContent = "Edit " + (LABEL_ROLE[pengguna.role] || "Pengguna");
    }
    if (keteranganForm) {
      keteranganForm.textContent = admin
        ? "Ubah nama atau penugasan cabang. Kosongkan kata sandi bila tidak ingin menggantinya."
        : "Kolom cabang tidak ditampilkan karena cabang pelanggan berasal dari transaksi " +
          "aktif terkininya, bukan dari data akun.";
    }
    if (labelSandi) labelSandi.textContent = "Kata Sandi Baru (opsional)";
    if (barisUsername) barisUsername.classList.remove("hidden");

    // Inilah aturan "cabang read-only untuk pelanggan": barisnya tidak
    // ditampilkan sama sekali pada form edit pelanggan.
    if (barisCabang) barisCabang.classList.toggle("hidden", !admin);

    if (tombolSimpan) tombolSimpan.textContent = "Simpan Perubahan";

    bukaHalamanForm();
    // preventScroll: fokus tidak boleh menarik layar kembali dan
    // membatalkan gulir halus ke atas yang baru saja dijalankan
    if (inputNama) inputNama.focus({ preventScroll: true });
  }

  // -------------------------------------------------------------------
  // 4c. Menyimpan
  // -------------------------------------------------------------------
  async function simpan() {
    const sedangUbah = usernameDiubah !== null;

    // Akun baru memakai peran yang dipilih di form. Akun lama SELALU
    // mempertahankan perannya, apa pun isi kotak pilihan -- kotaknya
    // memang dikunci saat mengubah, tetapi nilainya tidak dipercaya
    // begitu saja di sini.
    const penggunaLama = sedangUbah ? sumber.cariPenggunaDiDaftar(usernameDiubah) : null;
    const role = sedangUbah
      ? (penggunaLama ? penggunaLama.role : ROLE_ADMIN)
      : roleDipilih();

    const isian = {
      modeUbah: sedangUbah,
      role: role,
      fullName: inputNama ? inputNama.value : "",
      username: inputUsername ? inputUsername.value : "",
      password: inputSandi ? inputSandi.value : "",
      konfirmasi: inputKonfirmasi ? inputKonfirmasi.value : "",
      cabang: bacaCabangTerpilih()
    };

    const masalah = periksaFormUser(isian);

    if (masalah.length > 0) {
      const kotak = {
        fullName: inputNama,
        username: inputUsername,
        password: inputSandi,
        konfirmasi: inputKonfirmasi,
        cabang: null
      }[masalah[0].field];

      tandaiSalah(kotak, masalah[0].pesan);
      return;
    }

    const teksAsli = kunciTombol(tombolSimpan, true, "Menyimpan...");

    try {
      if (sedangUbah) {
        // --- MODE UBAH ---
        const perubahan = { fullName: isian.fullName.trim() };

        if (role === ROLE_ADMIN) perubahan.cabang = isian.cabang;
        if (isian.password) perubahan.password = await acakKataSandi(isian.password);

        await updateDoc(doc(db, COL_USER, usernameDiubah), perubahan);
        beriTahu("sukses", 'Data "' + isian.fullName.trim() + '" berhasil diperbarui.');

      } else {
        // --- MODE TAMBAH ---
        const username = isian.username.trim().toLowerCase();

        // Diperiksa langsung ke Firestore, bukan ke daftar di memori,
        // supaya akun yang baru dibuat orang lain tetap terdeteksi.
        const sudahAda = await getDoc(doc(db, COL_USER, username));

        if (sudahAda.exists()) {
          kunciTombol(tombolSimpan, false);
          if (tombolSimpan && teksAsli) tombolSimpan.textContent = teksAsli;
          tandaiSalah(inputUsername,
            'Username "' + username + '" sudah dipakai. Silakan pilih username lain.');
          return;
        }

        const dokumen = {
          fullName: isian.fullName.trim(),
          username: username,
          password: await acakKataSandi(isian.password),
          createdAt: Timestamp.fromDate(new Date()),
          role: role
        };

        // Field "cabang" HANYA ditulis untuk admin. Dokumen pelanggan
        // sengaja tidak memilikinya sama sekali, supaya tidak ada dua
        // sumber kebenaran dengan cabang yang dihitung dari transaksi.
        if (role === ROLE_ADMIN) dokumen.cabang = isian.cabang;

        await setDoc(doc(db, COL_USER, username), dokumen);

        beriTahu("sukses", role === ROLE_ADMIN
          ? 'Admin "' + isian.fullName.trim() + '" berhasil ditambahkan dengan ' +
            isian.cabang.length + " cabang."
          : 'Akun pelanggan "' + isian.fullName.trim() + '" berhasil dibuat. Cabang dan ' +
            "kamar akan terisi sendiri setelah pelanggan melakukan pemesanan.");
      }

      // Tabel tidak perlu digambar ulang di sini: onSnapshot pada
      // collection "user" akan memberitahu perubahannya sendiri.
      // tutupHalamanForm() sekaligus mengosongkan isian.
      tutupHalamanForm();

    } catch (err) {
      console.error("Gagal menyimpan pengguna:", err);
      beriTahu("gagal", "Gagal menyimpan: " + err.message);

    } finally {
      kunciTombol(tombolSimpan, false);
      if (tombolSimpan && teksAsli) tombolSimpan.textContent = teksAsli;
    }
  }

  // -------------------------------------------------------------------
  // 4d. Halaman detail
  // ---------------------------------------------------------------------
  // Susunan kartunya mengikuti halaman Detail Booking: judul section
  // bergaris bawah, pasangan label-nilai bertumpuk (label di atas
  // nilai), dan grid 12 kolom dengan pembagian 8/4.
  // -------------------------------------------------------------------

  /** Satu pasangan label-nilai, label di atas nilainya. */
  function barisDetail(label, nilai) {
    return "<div>" +
      '<div class="font-label-md text-label-md text-ink-muted mb-xxs">' +
      amankanTeks(label) + "</div>" +
      '<div class="font-body-md text-body-md text-ink-primary">' + nilai + "</div>" +
      "</div>";
  }

  /** Kartu bersudul, sama seperti kartu pada halaman Detail Booking. */
  function kartuDetail(judul, isi) {
    return '<div class="bg-surface-canvas rounded-xl p-base border border-border-hairline shadow-sm">' +
      '<h2 class="font-title-md text-title-md text-ink-primary ' +
      'border-b border-border-hairline pb-sm mb-md">' + amankanTeks(judul) + "</h2>" +
      isi + "</div>";
  }

  function bukaDetail(pengguna) {
    if (!isiDetail) return;

    const pelanggan = pengguna.role !== ROLE_SUPERADMIN && pengguna.role !== ROLE_ADMIN;

    // --- Kartu: Data Profil ---
    const kartuProfil = kartuDetail("Data Profil",
      '<div class="space-y-md">' +
      barisDetail("Nama Lengkap", amankanTeks(pengguna.fullName || "-")) +
      "</div>");

    // --- Kartu: Data Akun / Login ---
    const kartuAkun = kartuDetail("Data Akun / Login",
      '<div class="space-y-md">' +
      barisDetail("Username", "@" + amankanTeks(pengguna.username)) +
      barisDetail("Terdaftar Sejak",
        amankanTeks(pengguna.createdAt ? formatTanggal(pengguna.createdAt) : "-")) +
      "</div>");

    // --- Kartu: Role & Akses ---
    const cabang = sumber.cabangUntukBaris(pengguna);
    let barisCabangDetail;

    if (pengguna.role === ROLE_SUPERADMIN) {
      barisCabangDetail = barisDetail("Cakupan Cabang", "Seluruh cabang");

    } else if (pengguna.role === ROLE_ADMIN) {
      barisCabangDetail = barisDetail("Cabang Ditugaskan",
        cabang.length > 0
          ? cabang.map(amankanTeks).join(", ")
          : '<span class="text-ink-muted">Belum ada cabang</span>');

    } else {
      barisCabangDetail = barisDetail("Cabang Aktif",
        cabang.length > 0
          ? amankanTeks(cabang[0])
          : '<span class="text-ink-muted">- (belum pernah memesan)</span>');
    }

    const kartuAkses = kartuDetail("Role & Akses",
      '<div class="space-y-md">' +
      barisDetail("Peran", amankanTeks(LABEL_ROLE[pengguna.role] || pengguna.role)) +
      barisCabangDetail +
      "</div>");

    // --- Kartu: Riwayat Pemesanan, hanya bermakna bagi pelanggan ---
    let kartuRiwayat = "";

    if (pelanggan) {
      const riwayat = sumber.riwayatTransaksi(pengguna.username);

      kartuRiwayat = kartuDetail("Riwayat Pemesanan (" + riwayat.length + ")",
        riwayat.length === 0
          ? '<p class="font-body-sm text-body-sm text-ink-muted">Belum pernah melakukan pemesanan.</p>'
          : '<div class="flex flex-col gap-xs">' +
            riwayat.map(function (r) {
              const tanda = r.aktif
                ? '<span class="inline-flex items-center px-sm py-xxs rounded-full ' +
                  'bg-[#ECFDF3] text-status-available border border-status-available/20 ' +
                  'font-badge text-badge">Aktif</span>'
                : '<span class="inline-flex items-center px-sm py-xxs rounded-full ' +
                  'bg-surface-variant text-ink-secondary border border-border-hairline ' +
                  'font-badge text-badge">Selesai</span>';

              return '<div class="flex items-center justify-between gap-sm bg-surface-soft ' +
                'rounded-lg px-base py-sm">' +
                "<div class=\"min-w-0\">" +
                '<p class="font-body-sm text-body-sm text-ink-primary truncate">' +
                amankanTeks(r.cabang) + "</p>" +
                '<p class="font-body-sm text-body-sm text-ink-muted truncate">' +
                amankanTeks(r.order_id) + " &middot; " + amankanTeks(r.tanggal) + "</p>" +
                "</div>" + tanda + "</div>";
            }).join("") +
            "</div>");
    }

    isiDetail.innerHTML =
      '<div class="lg:col-span-8 flex flex-col gap-lg">' +
      kartuProfil + kartuAkun + kartuRiwayat +
      "</div>" +
      '<div class="lg:col-span-4 flex flex-col gap-lg">' +
      kartuAkses +
      "</div>";

    bukaHalamanDetail();
  }

  // -------------------------------------------------------------------
  // 4e. Menghapus
  // -------------------------------------------------------------------
  function bukaKonfirmasi(judul, pesan, saatDisetujui) {
    if (!modalKonfirmasi) {
      if (confirm(judul + "\n\n" + pesan)) saatDisetujui();
      return;
    }

    if (judulKonfirmasi) judulKonfirmasi.textContent = judul;
    if (pesanKonfirmasi) pesanKonfirmasi.textContent = pesan;
    aksiSetelahKonfirmasi = saatDisetujui;

    buka(modalKonfirmasi);
  }

  function tutupKonfirmasi() {
    tutup(modalKonfirmasi);
    aksiSetelahKonfirmasi = null;
  }

  function mintaHapus(pengguna) {
    // --- Penjagaan: super admin terakhir tidak boleh hilang ---
    if (pengguna.role === ROLE_SUPERADMIN && sumber.jumlahSuperAdmin() <= 1) {
      beriTahu("gagal",
        "Akun ini adalah satu-satunya super admin. Menghapusnya akan membuat portal " +
        "super admin tidak dapat dimasuki siapa pun. Buat super admin lain terlebih dahulu.");
      return;
    }

    // --- Penjagaan: tidak menghapus akun yang sedang dipakai ---
    if (pengguna.username === usernameSedangMasuk()) {
      beriTahu("gagal", "Anda tidak dapat menghapus akun yang sedang Anda pakai untuk masuk.");
      return;
    }

    const nama = pengguna.fullName || pengguna.username;

    // Keterangan dibuat berbeda untuk pelanggan, karena akibatnya nyata:
    // riwayat pesanannya masih ada tetapi tidak lagi punya pemilik.
    const keterangan = pengguna.role === ROLE_ADMIN || pengguna.role === ROLE_SUPERADMIN
      ? 'Akun "' + nama + '" akan dihapus permanen dan tidak dapat dipakai masuk lagi.'
      : 'Akun "' + nama + '" akan dihapus permanen. Riwayat pemesanannya tetap tersimpan ' +
        "di database, tetapi tidak lagi dapat dibuka oleh pemiliknya dan tidak muncul di " +
        "halaman Riwayat Pemesanan mana pun.";

    bukaKonfirmasi("Hapus pengguna ini?", keterangan, async function () {
      try {
        await deleteDoc(doc(db, COL_USER, pengguna.uid || pengguna.username));
        beriTahu("sukses", 'Akun "' + nama + '" berhasil dihapus.');
      } catch (err) {
        console.error("Gagal menghapus pengguna:", err);
        beriTahu("gagal", "Gagal menghapus: " + err.message);
      }
    });
  }

  /** Username yang sedang dipakai pada portal super admin. */
  function usernameSedangMasuk() {
    try {
      const sesi = JSON.parse(localStorage.getItem("superAdminSession") || "null");
      return sesi && sesi.username ? sesi.username : null;
    } catch (err) {
      return null;
    }
  }

  // -------------------------------------------------------------------
  // 4f. Memasang penyimak
  // -------------------------------------------------------------------
  if (tombolTambah) tombolTambah.addEventListener("click", bukaFormTambah);

  // Bagian cabang muncul / menghilang mengikuti peran yang dipilih
  if (pilihanRole) pilihanRole.addEventListener("change", sesuaikanFormDenganRole);

  if (tombolTutupForm) tombolTutupForm.addEventListener("click", tutupHalamanForm);
  if (tombolBatalForm) tombolBatalForm.addEventListener("click", tutupHalamanForm);
  if (tombolSimpan) {
    tombolSimpan.addEventListener("click", function (e) {
      e.preventDefault();
      simpan();
    });
  }

  // Menekan Enter di dalam isian ikut menyimpan, bukan memuat ulang
  // halaman. Tanpa ini, form akan terkirim ke alamatnya sendiri dan
  // seluruh isian hilang.
  if (formIsian) {
    formIsian.addEventListener("submit", function (e) {
      e.preventDefault();
      simpan();
    });
  }

  if (tombolTutupDetail) tombolTutupDetail.addEventListener("click", tutupHalamanDetail);
  if (tombolTutupDetail2) tombolTutupDetail2.addEventListener("click", tutupHalamanDetail);

  if (tombolBatalHapus) tombolBatalHapus.addEventListener("click", tutupKonfirmasi);
  if (tombolHapus) {
    tombolHapus.addEventListener("click", async function () {
      const aksi = aksiSetelahKonfirmasi;
      tutupKonfirmasi();
      if (aksi) await aksi();
    });
  }

  // Tirai gelap dan tombol Esc hanya berlaku bagi modal konfirmasi.
  // Halaman form dan halaman detail tidak punya tirai untuk diklik, dan
  // Esc yang membuang isian form tanpa peringatan justru berbahaya.
  if (modalKonfirmasi) {
    modalKonfirmasi.addEventListener("click", function (e) {
      if (e.target === modalKonfirmasi) tutupKonfirmasi();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!modalKonfirmasi.classList.contains("hidden")) tutupKonfirmasi();
    });
  }

  // -------------------------------------------------------------------
  // 4g. Yang dipakai user-management.js
  // -------------------------------------------------------------------
  return {
    perbaruiPilihanCabang: perbaruiPilihanCabang,

    /** Menjalankan aksi dari tombol pada sebuah baris tabel. */
    jalankanAksi: function (aksi, username) {
      const pengguna = sumber.cariPenggunaDiDaftar(username);

      if (!pengguna) {
        beriTahu("gagal", "Data pengguna tidak ditemukan. Coba muat ulang halaman.");
        return;
      }

      if (aksi === "detail") bukaDetail(pengguna);
      else if (aksi === "edit") bukaFormUbah(pengguna);
      else if (aksi === "hapus") mintaHapus(pengguna);
    }
  };
}
