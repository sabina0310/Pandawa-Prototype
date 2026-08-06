/**
 * =====================================================================
 * ARSIP & DETAIL PENGHUNI (halaman super-admin/tenants.html)
 * =====================================================================
 * Berisi aksi yang MENGUBAH data penghuni beserta halaman detailnya.
 * Pemisahannya mengikuti halaman Cabang dan Manajemen Pengguna, di mana
 * satu berkas menampilkan dan satu berkas lagi mengubah.
 *
 * ---------------------------------------------------------------------
 * MENGAPA "HAPUS" BERARTI MENGARSIPKAN
 * ---------------------------------------------------------------------
 * Data penghuni menumpang pada dokumen transaksi. Menghapus dokumennya
 * berarti menghapus catatan pembayarannya juga: baris itu akan hilang
 * dari Laporan Transaksi, dan kuitansi penyewanya tidak lagi bisa
 * dibuka. Karena itu tombol Hapus tidak menghapus apa pun -- ia hanya
 * menambahkan satu penanda:
 *
 *     penghuni_diarsipkan : true
 *     penghuni_diarsipkan_pada : timestamp
 *
 * Baris yang ditandai disembunyikan dari daftar, tetapi seluruh
 * riwayat sewa dan keuangannya tetap utuh, dan bisa dikembalikan kapan
 * saja lewat tombol Pulihkan.
 *
 * Yang SENGAJA tidak diubah saat mengarsipkan:
 *   - status_checkin  -> penghuninya secara nyata masih/pernah tinggal
 *   - kamar.tersedia  -> kamarnya tidak otomatis dinyatakan kosong
 *
 * Mengarsipkan adalah tindakan pembenahan daftar, bukan proses
 * check-out. Menggabungkan keduanya akan membuat kamar terlihat kosong
 * padahal orangnya masih menempati.
 * =====================================================================
 */

import {
  doc, updateDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_TRANSAKSI } from "./firebase-init.js";

import {
  amankanTeks, formatTanggal, formatTanggalJam, formatRupiah,
  labelDurasi, labelMetodeBayar, tautanWa
} from "./admin-util.js";

import { tentukanStatus, labelPerpanjangan } from "./status-pesanan.js";

// =====================================================================
// 1. PENANDA ARSIP
// ---------------------------------------------------------------------
// Nama field ditulis satu kali di sini agar tidak salah ketik, dan
// pembacaannya dibuat tahan terhadap dokumen lama yang belum punya
// field ini sama sekali (seluruh transaksi hasil seeding).
// =====================================================================
export const FIELD_ARSIP = "penghuni_diarsipkan";
export const FIELD_ARSIP_PADA = "penghuni_diarsipkan_pada";

/** true bila penghuni ini sudah diarsipkan. */
export function diarsipkan(transaksi) {
  return transaksi ? transaksi[FIELD_ARSIP] === true : false;
}

// =====================================================================
// 2. NOTIFIKASI HASIL AKSI
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

  const lama = jenis === "gagal" ? 6000 : 3500;
  setTimeout(function () {
    kotak.classList.add("opacity-0");
    setTimeout(function () { kotak.remove(); }, 300);
  }, lama);
}

// =====================================================================
// 3. FUNGSI BANTU TAMPILAN
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

/**
 * Berpindah antara tampilan daftar dan salah satu halaman isian.
 * Semuanya berada di berkas HTML yang sama; yang berpindah hanyalah
 * mana yang ditampilkan -- sama seperti halaman Cabang & Kamar dan
 * Manajemen Pengguna.
 *
 * @param {Element}   daftar - tampilan daftar (tabel penghuni)
 * @param {Element[]} semua  - seluruh halaman yang bisa dibuka
 * @param {Element}   tujuan - halaman yang ditampilkan; null = kembali
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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =====================================================================
// PEMERIKSAAN ISIAN DATA DIRI
// ---------------------------------------------------------------------
// Aturannya disalin persis dari js/order-step1.js, berkas yang dipakai
// penyewa saat pertama mengisi data. Kalau admin boleh menyimpan data
// yang lebih longgar daripada yang diterima form penyewa, database bisa
// berisi NIK 12 digit yang tidak akan pernah lolos di sisi penyewa.
// =====================================================================

export function periksaNik(nilai) {
  const bersih = String(nilai || "").trim();
  if (!bersih) return "NIK wajib diisi.";
  if (!/^[0-9]+$/.test(bersih)) return "NIK hanya boleh berisi angka.";
  if (bersih.length !== 16) {
    return "NIK harus tepat 16 digit (sekarang " + bersih.length + " digit).";
  }
  return null;
}

export function periksaNama(nilai) {
  const bersih = String(nilai || "").trim();
  if (!bersih) return "Nama lengkap wajib diisi.";
  if (bersih.length < 3) return "Nama terlalu pendek.";
  return null;
}

export function periksaWhatsapp(nilai) {
  // Awalan +62 tercetak di sebelah kiri isian, jadi yang diketik
  // dimulai dari angka 8.
  const bersih = String(nilai || "").trim().replace(/[\s-]/g, "");
  if (!bersih) return "Nomor WhatsApp wajib diisi.";
  if (!/^[0-9]+$/.test(bersih)) return "Nomor hanya boleh berisi angka.";
  if (bersih.indexOf("8") !== 0) return "Nomor diawali angka 8, contoh: 81234567890.";
  if (bersih.length < 9 || bersih.length > 13) {
    return "Panjang nomor tidak wajar (9-13 digit).";
  }
  return null;
}

export const HUBUNGAN_SAH = ["suami", "istri", "anak"];

/** Maksimal penghuni tambahan, mengikuti js/order-step1.js */
export const MAKS_PENGHUNI_TAMBAHAN = 3;

/**
 * Memeriksa seluruh isian data diri sekaligus.
 * Ditulis sebagai fungsi murni (tanpa menyentuh DOM) supaya tiap
 * aturannya bisa diuji satu per satu.
 *
 * @param {Object} data - { nama, nik, whatsapp, penghuni: [...] }
 * @returns {Array} daftar { bagian, urutan, field, pesan }; kosong = benar
 */
export function periksaDataDiri(data) {
  const masalah = [];

  const tambah = function (bagian, urutan, field, pesan) {
    if (pesan) masalah.push({ bagian: bagian, urutan: urutan, field: field, pesan: pesan });
  };

  tambah("utama", 0, "nama", periksaNama(data.nama));
  tambah("utama", 0, "nik", periksaNik(data.nik));
  tambah("utama", 0, "whatsapp", periksaWhatsapp(data.whatsapp));

  const penghuni = Array.isArray(data.penghuni) ? data.penghuni : [];

  if (penghuni.length > MAKS_PENGHUNI_TAMBAHAN) {
    masalah.push({
      bagian: "penghuni", urutan: 0, field: "jumlah",
      pesan: "Penghuni tambahan maksimal " + MAKS_PENGHUNI_TAMBAHAN + " orang."
    });
  }

  // NIK tidak boleh sama antar penghuni dalam satu unit -- termasuk
  // dengan NIK penyewa utamanya.
  const nikTerpakai = [String(data.nik || "").trim()];

  penghuni.forEach(function (p, i) {
    tambah("penghuni", i, "nama", periksaNama(p.nama));
    tambah("penghuni", i, "nik", periksaNik(p.nik));
    tambah("penghuni", i, "whatsapp", periksaWhatsapp(p.whatsapp));

    if (HUBUNGAN_SAH.indexOf(p.hubungan) === -1) {
      tambah("penghuni", i, "hubungan", "Hubungan keluarga wajib dipilih.");
    }

    const nik = String(p.nik || "").trim();
    if (nik && nikTerpakai.indexOf(nik) !== -1) {
      tambah("penghuni", i, "nik", "NIK ini sudah dipakai penghuni lain.");
    }
    nikTerpakai.push(nik);
  });

  return masalah;
}

/**
 * Menyeragamkan nomor WhatsApp penghuni tambahan.
 *
 * Nomor penyewa utama disimpan lengkap ("+62 812-3456-7890"), tetapi
 * nomor penghuni tambahan disimpan apa adanya dari form ("81234567890")
 * karena tulisan "+62" pada form hanyalah hiasan di kiri kotak isian.
 *
 * Tanpa penyeragaman ini, tautannya menjadi wa.me/81234567890 -- nomor
 * yang tidak sah karena kehilangan kode negara.
 */
export function seragamkanNomor(nomor) {
  const angka = String(nomor || "").replace(/[^0-9]/g, "");
  if (!angka) return "";

  if (angka.indexOf("62") === 0) return "+" + angka;          // 62812...
  if (angka.indexOf("0") === 0) return "+62" + angka.slice(1); // 0812...
  return "+62" + angka;                                        // 812...
}

// ---------------------------------------------------------------------
// Bentuk kartu dan pasangan label-nilai mengikuti halaman Detail
// Booking, supaya seluruh halaman super admin terbaca seragam:
// judul section bergaris bawah, label di ATAS nilainya.
// ---------------------------------------------------------------------

/** Satu pasangan label-nilai, label di atas nilainya. */
function barisData(label, nilai) {
  return "<div>" +
    '<div class="font-label-md text-label-md text-ink-muted mb-xxs">' +
    amankanTeks(label) + "</div>" +
    '<div class="font-body-md text-body-md text-ink-primary">' + nilai + "</div>" +
    "</div>";
}

/** Kartu bersudul, sama seperti kartu pada halaman Detail Booking. */
function kartu(judul, ikon, isi) {
  return '<div class="bg-surface-canvas rounded-xl p-base border border-border-hairline shadow-sm">' +
    '<h2 class="font-title-md text-title-md text-ink-primary ' +
    'border-b border-border-hairline pb-sm mb-md flex items-center gap-sm">' +
    '<span class="material-symbols-outlined text-primary text-[20px]">' + ikon + "</span>" +
    amankanTeks(judul) + "</h2>" + isi + "</div>";
}

// =====================================================================
// 4. PENYIAPAN HALAMAN
// =====================================================================
export function siapkanCrudPenghuni(sumber) {
  // --- Halaman detail ---
  const tampilanDaftar = document.getElementById("tenantsListView");
  const halamanDetail = document.getElementById("tenantDetailPage");
  const isiDetail = document.getElementById("tenantDetailIsi");
  const judulDetail = document.getElementById("tenantDetailJudul");
  const tombolTutupDetail = document.getElementById("tenantDetailTutup");
  const tombolTutupDetail2 = document.getElementById("tenantDetailTutup2");

  // --- Halaman edit data diri ---
  const halamanForm = document.getElementById("tenantFormPage");
  const judulForm = document.getElementById("tenantFormJudul");
  const ringkasanForm = document.getElementById("tenantFormRingkasan");
  const tombolTutupForm = document.getElementById("tenantFormTutup");
  const tombolBatalForm = document.getElementById("tenantFormBatal");
  const tombolSimpanForm = document.getElementById("tenantFormSimpan");

  const inputNama = document.getElementById("tenantFormNama");
  const inputNik = document.getElementById("tenantFormNik");
  const inputWa = document.getElementById("tenantFormWa");

  const wadahPenghuni = document.getElementById("tenantFormPenghuni");
  const barisPenghuni = document.getElementById("tenantFormBarisPenghuni");
  const catatanPenghuni = document.getElementById("tenantFormCatatanPenghuni");
  const tombolTambahPenghuni = document.getElementById("tenantFormTambahPenghuni");

  // Seluruh halaman yang menggantikan tampilan daftar
  const semuaHalaman = [halamanForm, halamanDetail];

  // order_id yang sedang disunting; null = form tidak sedang dipakai
  let orderDiubah = null;

  // --- Modal konfirmasi ---
  const modalKonfirmasi = document.getElementById("konfirmasiModal");
  const judulKonfirmasi = document.getElementById("konfirmasiJudul");
  const pesanKonfirmasi = document.getElementById("konfirmasiPesan");
  const tombolBatal = document.getElementById("konfirmasiBatal");
  const tombolLanjut = document.getElementById("konfirmasiLanjut");

  let aksiSetelahKonfirmasi = null;

  // -------------------------------------------------------------------
  // 4a. Modal konfirmasi
  // -------------------------------------------------------------------
  function bukaKonfirmasi(judul, pesan, teksTombol, saatDisetujui) {
    if (!modalKonfirmasi) {
      if (confirm(judul + "\n\n" + pesan)) saatDisetujui();
      return;
    }

    if (judulKonfirmasi) judulKonfirmasi.textContent = judul;
    if (pesanKonfirmasi) pesanKonfirmasi.textContent = pesan;
    if (tombolLanjut) tombolLanjut.textContent = teksTombol;

    aksiSetelahKonfirmasi = saatDisetujui;
    buka(modalKonfirmasi);
  }

  function tutupKonfirmasi() {
    tutup(modalKonfirmasi);
    aksiSetelahKonfirmasi = null;
  }

  // -------------------------------------------------------------------
  // 4b. Mengarsipkan & memulihkan
  // -------------------------------------------------------------------
  async function ubahArsip(transaksi, jadiArsip) {
    const nama = transaksi.nama_penyewa || transaksi.order_id;

    try {
      // updateDoc, bukan setDoc: hanya kedua field penanda yang
      // tersentuh, seluruh isi transaksi lainnya tetap utuh.
      const perubahan = {};
      perubahan[FIELD_ARSIP] = jadiArsip;
      perubahan[FIELD_ARSIP_PADA] = jadiArsip ? Timestamp.fromDate(new Date()) : null;

      await updateDoc(doc(db, COL_TRANSAKSI, transaksi.order_id), perubahan);

      beriTahu("sukses", jadiArsip
        ? 'Penghuni "' + nama + '" berhasil diarsipkan. Riwayat sewanya tetap tersimpan.'
        : 'Penghuni "' + nama + '" berhasil dipulihkan ke daftar.');

    } catch (err) {
      console.error("Gagal memperbarui status arsip:", err);
      beriTahu("gagal", "Gagal memperbarui data: " + err.message);
    }
  }

  function mintaArsip(transaksi) {
    const nama = transaksi.nama_penyewa || transaksi.order_id;

    bukaKonfirmasi(
      "Arsipkan penghuni ini?",
      'Penghuni "' + nama + '" akan disembunyikan dari daftar. Riwayat sewa dan catatan ' +
      "pembayarannya TIDAK dihapus, status check-in serta status kamarnya juga tidak berubah. " +
      'Data ini dapat dilihat kembali lewat saringan status "Diarsipkan" dan dipulihkan kapan saja.',
      "Ya, Arsipkan",
      function () { return ubahArsip(transaksi, true); }
    );
  }

  function mintaPulihkan(transaksi) {
    const nama = transaksi.nama_penyewa || transaksi.order_id;

    bukaKonfirmasi(
      "Pulihkan penghuni ini?",
      'Penghuni "' + nama + '" akan kembali muncul di daftar penghuni.',
      "Ya, Pulihkan",
      function () { return ubahArsip(transaksi, false); }
    );
  }

  // -------------------------------------------------------------------
  // 4c. Halaman detail
  // -------------------------------------------------------------------

  /** Kartu 1: data penyewa utama. */
  function kartuPenyewaUtama(t) {
    const nomor = t.kontak_penyewa
      ? '<a class="text-primary hover:underline" href="' + tautanWa(t.kontak_penyewa) +
        '" target="_blank" rel="noopener">' + amankanTeks(t.kontak_penyewa) + "</a>"
      : "-";

    const status = tentukanStatus(t);

    return kartu("Penyewa Utama", "person",
      '<div class="space-y-md">' +
      barisData("Nama Lengkap", amankanTeks(t.nama_penyewa || "-")) +
      barisData("NIK", amankanTeks(t.nik_penyewa || "-")) +
      barisData("No. WhatsApp", nomor) +
      barisData("Akun Penyewa", t.customer_username
        ? "@" + amankanTeks(t.customer_username)
        : '<span class="text-ink-muted">Tidak terhubung akun</span>') +
      barisData("Status Sewa",
        '<span class="inline-flex items-center gap-xxs px-sm py-xxs rounded-full ' +
        'font-badge text-badge ' + status.kelas + '">' +
        '<span class="material-symbols-outlined text-[14px]">' + status.ikon + "</span>" +
        amankanTeks(status.label) + "</span>") +
      "</div>");
  }

  /** Kartu 2: unit sewa yang ditempati. */
  function kartuUnitSewa(t) {
    return kartu("Unit & Masa Sewa", "meeting_room",
      '<div class="space-y-md">' +
      barisData("Cabang", amankanTeks(t.nama_cabang || "-")) +
      barisData("Kamar", amankanTeks(t.nomor_kamar || "-")) +
      barisData("Tipe Sewa", t.tipe_sewa === "bulanan" ? "Bulanan" : "Harian") +
      barisData("Mulai Sewa", amankanTeks(formatTanggal(t.tanggal_checkin))) +
      barisData("Berakhir Sewa", amankanTeks(formatTanggal(t.tanggal_checkout))) +
      barisData("Lama Sewa", amankanTeks(labelDurasi(t))) +
      barisData("Check-in Sebenarnya", t.tanggal_aktual_checkin
        ? amankanTeks(formatTanggalJam(t.tanggal_aktual_checkin))
        : '<span class="text-ink-muted">Belum check-in</span>') +
      barisData("Check-out Sebenarnya", t.tanggal_aktual_checkout
        ? amankanTeks(formatTanggalJam(t.tanggal_aktual_checkout))
        : '<span class="text-ink-muted">Belum check-out</span>') +
      (t.tipe_sewa === "bulanan"
        ? barisData("Rencana Perpanjangan",
            amankanTeks(labelPerpanjangan(t.status_perpanjangan)))
        : "") +
      "</div>");
  }

  /**
   * Kartu 3: penghuni tambahan.
   * Inilah satu-satunya tempat nama anggota lain ditampilkan -- di
   * tabel utama hanya penyewa utamanya yang muncul.
   */
  function kartuPenghuniTambahan(t) {
    const anggota = Array.isArray(t.penghuni_tambahan) ? t.penghuni_tambahan : [];

    if (anggota.length === 0) {
      // Keterangannya dibedakan: pada sewa harian memang tidak pernah
      // ada penghuni tambahan, sedangkan pada bulanan artinya penyewa
      // memilih tinggal sendiri.
      const alasan = t.tipe_sewa === "harian"
        ? "Sewa harian tidak memiliki penghuni tambahan."
        : "Penyewa tidak mendaftarkan penghuni tambahan pada unit ini.";

      return kartu("Penghuni Tambahan", "group",
        '<p class="font-body-sm text-body-sm text-ink-muted">' + alasan + "</p>");
    }

    const daftar = anggota.map(function (p, i) {
      const rapi = seragamkanNomor(p.whatsapp);
      const nomor = rapi
        ? '<a class="text-primary hover:underline" href="' + tautanWa(rapi) +
          '" target="_blank" rel="noopener">' + amankanTeks(rapi) + "</a>"
        : '<span class="text-ink-muted">-</span>';

      return '<div class="bg-surface-canvas rounded-lg border border-border-hairline p-base ' +
        'flex flex-col gap-xs">' +
        '<div class="flex items-center gap-sm">' +
        '<span class="w-6 h-6 rounded-full bg-primary-container/10 text-primary-container ' +
        'flex items-center justify-center font-badge text-badge shrink-0">' + (i + 1) + "</span>" +
        '<p class="font-title-md text-title-md text-ink-primary">' +
        amankanTeks(p.nama || "-") + "</p></div>" +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-xs pl-[32px]">' +
        '<span class="font-body-sm text-body-sm text-ink-muted">NIK: ' +
        amankanTeks(p.nik || "-") + "</span>" +
        '<span class="font-body-sm text-body-sm text-ink-muted">Hubungan: ' +
        amankanTeks(p.hubungan || "-") + "</span>" +
        '<span class="font-body-sm text-body-sm">WhatsApp: ' + nomor + "</span>" +
        "</div></div>";
    }).join("");

    return kartu("Penghuni Tambahan (" + anggota.length + " orang)", "group",
      '<div class="flex flex-col gap-sm">' + daftar + "</div>");
  }

  /** Kartu 4: riwayat sewa & perpanjangan. */
  function kartuRiwayat(t) {
    const riwayat = sumber.riwayatSewa(t);

    if (riwayat.length <= 1) {
      return kartu("Riwayat Sewa", "history",
        '<p class="font-body-sm text-body-sm text-ink-muted">' +
        "Belum ada riwayat lain. Ini merupakan satu-satunya sewa yang tercatat " +
        "untuk penyewa ini.</p>");
    }

    const daftar = riwayat.map(function (r) {
      const ini = r.order_id === t.order_id;
      const status = tentukanStatus(r);

      // Perpanjangan menunjuk transaksi sebelumnya lewat field
      // "perpanjangan_dari" yang ditulis form perpanjang.
      const tanda = r.perpanjangan_dari
        ? '<span class="inline-flex items-center px-sm py-xxs rounded-full bg-surface-variant ' +
          'text-ink-secondary border border-border-hairline font-badge text-badge">Perpanjangan</span>'
        : "";

      return '<div class="rounded-lg border p-base flex flex-col gap-xs ' +
        (ini ? "border-primary/40 bg-primary/5" : "border-border-hairline bg-surface-canvas") +
        '">' +
        '<div class="flex items-center justify-between gap-sm flex-wrap">' +
        '<span class="font-body-sm text-body-sm text-ink-primary">' +
        amankanTeks(r.order_id) + (ini ? " (sedang dibuka)" : "") + "</span>" +
        '<span class="inline-flex items-center gap-xxs px-sm py-xxs rounded-full ' +
        'font-badge text-badge ' + status.kelas + '">' + amankanTeks(status.label) + "</span>" +
        "</div>" +
        '<div class="flex items-center justify-between gap-sm flex-wrap">' +
        '<span class="font-body-sm text-body-sm text-ink-muted">' +
        amankanTeks(r.nama_cabang || "-") + " &middot; Kamar " +
        amankanTeks(r.nomor_kamar || "-") + " &middot; " +
        amankanTeks(formatTanggal(r.tanggal_checkin)) + " – " +
        amankanTeks(formatTanggal(r.tanggal_checkout)) + "</span>" + tanda +
        "</div>" +
        '<span class="font-body-sm text-body-sm text-ink-muted">' +
        amankanTeks(formatRupiah(r.order_amount)) + " &middot; " +
        amankanTeks(labelMetodeBayar(r.payment_type)) + "</span>" +
        "</div>";
    }).join("");

    return kartu("Riwayat Sewa (" + riwayat.length + " transaksi)", "history",
      '<div class="flex flex-col gap-sm">' + daftar + "</div>");
  }

  function bukaDetail(t) {
    if (!isiDetail) return;

    if (judulDetail) {
      judulDetail.textContent = "Detail Penghuni – " + (t.nama_penyewa || t.order_id);
    }

    // Pemberitahuan bahwa data ini sedang diarsipkan, supaya admin
    // tidak bingung mengapa barisnya tidak ada di daftar. Diletakkan
    // memanjang di atas kedua kolom karena berlaku untuk seluruh isi.
    const catatanArsip = diarsipkan(t)
      ? '<div class="lg:col-span-12 flex items-start gap-sm bg-surface-container-high border ' +
        'border-border-hairline rounded-xl p-base">' +
        '<span class="material-symbols-outlined text-ink-muted text-[20px]">inventory_2</span>' +
        '<span class="font-body-sm text-body-sm text-ink-secondary">Penghuni ini sedang ' +
        "diarsipkan, sehingga tidak muncul di daftar utama. Seluruh datanya tetap tersimpan " +
        "dan dapat dipulihkan kapan saja.</span></div>"
      : "";

    // Pembagian 8/4 seperti halaman Detail Booking: keterangan orang di
    // kolom kiri, keterangan unit yang ditempati di kolom kanan.
    isiDetail.innerHTML =
      catatanArsip +
      '<div class="lg:col-span-8 flex flex-col gap-lg">' +
      kartuPenyewaUtama(t) +
      kartuPenghuniTambahan(t) +
      kartuRiwayat(t) +
      "</div>" +
      '<div class="lg:col-span-4 flex flex-col gap-lg">' +
      kartuUnitSewa(t) +
      "</div>";

    tampilkanHalaman(tampilanDaftar, semuaHalaman, halamanDetail);
  }

  function tutupDetail() {
    tampilkanHalaman(tampilanDaftar, semuaHalaman, null);
  }

  // -------------------------------------------------------------------
  // 4d. Form edit data diri
  // ---------------------------------------------------------------------
  // Yang boleh diubah HANYA empat field:
  //   nama_penyewa, nik_penyewa, kontak_penyewa, penghuni_tambahan
  //
  // Sisanya -- cabang, kamar, tipe sewa, tanggal, status, pembayaran --
  // adalah milik transaksi. Mengubahnya dari sini akan membuat data
  // hunian tidak lagi cocok dengan catatan pembayaran dan alokasi
  // kamarnya, jadi field itu tidak diberi isian sama sekali; bukan
  // sekadar dikunci, memang tidak ada.
  // -------------------------------------------------------------------

  /**
   * Mengambil bagian lokal nomor WhatsApp untuk ditaruh di isian.
   * "+62 811-1234-5678" -> "81112345678", karena awalan +62 sudah
   * tercetak di sebelah kiri kotaknya.
   */
  function bagianLokalNomor(nomor) {
    let angka = String(nomor || "").replace(/[^0-9]/g, "");
    if (angka.indexOf("62") === 0) angka = angka.slice(2);
    if (angka.indexOf("0") === 0) angka = angka.slice(1);
    return angka;
  }

  /** Satu baris isian penghuni tambahan. */
  function kotakPenghuni(urutan, data) {
    const p = data || {};

    const pilihan = HUBUNGAN_SAH.map(function (h) {
      const terpilih = p.hubungan === h ? " selected" : "";
      return '<option value="' + h + '"' + terpilih + ">" +
        h.charAt(0).toUpperCase() + h.slice(1) + "</option>";
    }).join("");

    const kelasIsian =
      "w-full h-[44px] bg-surface-canvas border border-border-hairline rounded-xl " +
      "shadow-sm px-base text-body-sm focus:ring-primary outline-none transition-all";

    return '<div class="bg-surface-soft rounded-xl border border-border-hairline p-base ' +
      'flex flex-col gap-sm" data-penghuni="' + urutan + '">' +

      '<div class="flex items-center justify-between gap-sm">' +
      '<p class="font-title-md text-title-md text-ink-primary">Penghuni ' + (urutan + 1) + "</p>" +
      '<button type="button" data-hapus-penghuni="' + urutan + '" title="Hapus penghuni ini" ' +
      'class="p-sm rounded-lg text-error hover:bg-surface-variant transition-colors">' +
      '<span class="material-symbols-outlined text-[20px]">delete</span></button>' +
      "</div>" +

      '<div class="grid grid-cols-1 md:grid-cols-2 gap-sm">' +

      '<div class="flex flex-col gap-xs md:col-span-2">' +
      '<label class="font-label-md text-label-md text-ink-muted">Nama Lengkap</label>' +
      '<input class="' + kelasIsian + '" data-isian="nama" type="text" ' +
      'placeholder="Nama lengkap penghuni" value="' + amankanTeks(p.nama || "") + '">' +
      "</div>" +

      '<div class="flex flex-col gap-xs">' +
      '<label class="font-label-md text-label-md text-ink-muted">NIK</label>' +
      '<input class="' + kelasIsian + '" data-isian="nik" type="text" inputmode="numeric" ' +
      'placeholder="16 digit angka" value="' + amankanTeks(p.nik || "") + '">' +
      "</div>" +

      '<div class="flex flex-col gap-xs">' +
      '<label class="font-label-md text-label-md text-ink-muted">Hubungan Keluarga</label>' +
      '<select class="' + kelasIsian + '" data-isian="hubungan">' +
      '<option value="">Pilih Hubungan</option>' + pilihan +
      "</select></div>" +

      '<div class="flex flex-col gap-xs md:col-span-2">' +
      '<label class="font-label-md text-label-md text-ink-muted">No. WhatsApp</label>' +
      '<div class="relative flex items-center">' +
      '<span class="absolute left-3 font-body-sm text-ink-secondary pr-sm ' +
      'border-r border-border-hairline">+62</span>' +
      '<input class="' + kelasIsian + ' pl-[60px]" data-isian="whatsapp" type="tel" ' +
      'inputmode="numeric" placeholder="81234567890" value="' +
      amankanTeks(bagianLokalNomor(p.whatsapp)) + '">' +
      "</div></div>" +

      "</div></div>";
  }

  /** Membaca seluruh isian penghuni tambahan dari layar. */
  function bacaPenghuni() {
    if (!wadahPenghuni) return [];

    const hasil = [];
    wadahPenghuni.querySelectorAll("[data-penghuni]").forEach(function (kotak) {
      const ambil = function (nama) {
        const el = kotak.querySelector('[data-isian="' + nama + '"]');
        return el ? el.value.trim() : "";
      };

      hasil.push({
        nik: ambil("nik"),
        nama: ambil("nama"),
        hubungan: ambil("hubungan"),
        // Disimpan tanpa awalan +62, sama seperti yang dihasilkan
        // form order milik penyewa.
        whatsapp: ambil("whatsapp").replace(/[\s-]/g, "")
      });
    });

    return hasil;
  }

  /** Menggambar ulang seluruh kotak penghuni tambahan. */
  function gambarPenghuni(daftar) {
    if (!wadahPenghuni) return;

    const isi = Array.isArray(daftar) ? daftar : [];

    wadahPenghuni.innerHTML = isi.length === 0
      ? '<p class="font-body-sm text-body-sm text-ink-muted">Belum ada penghuni tambahan.</p>'
      : isi.map(function (p, i) { return kotakPenghuni(i, p); }).join("");

    // Tombol tambah dimatikan setelah mencapai batas, bukan dihilangkan,
    // supaya letak tombolnya tidak berpindah-pindah.
    if (tombolTambahPenghuni) {
      const penuh = isi.length >= MAKS_PENGHUNI_TAMBAHAN;
      tombolTambahPenghuni.disabled = penuh;
      tombolTambahPenghuni.classList.toggle("opacity-60", penuh);
      tombolTambahPenghuni.classList.toggle("cursor-not-allowed", penuh);
    }

    if (catatanPenghuni) {
      catatanPenghuni.textContent = isi.length >= MAKS_PENGHUNI_TAMBAHAN
        ? "Sudah mencapai batas " + MAKS_PENGHUNI_TAMBAHAN + " penghuni tambahan."
        : "Anggota lain dalam satu unit sewa. Maksimal " + MAKS_PENGHUNI_TAMBAHAN + " orang.";
    }
  }

  /** Keterangan transaksi di bagian atas form -- tanpa isian. */
  function gambarRingkasan(t) {
    if (!ringkasanForm) return;

    const status = tentukanStatus(t);

    const pasangan = [
      ["Kode Pesanan", amankanTeks(t.order_id)],
      ["Cabang", amankanTeks(t.nama_cabang || "-")],
      ["Kamar", amankanTeks(t.nomor_kamar || "-")],
      ["Tipe Sewa", t.tipe_sewa === "bulanan" ? "Bulanan" : "Harian"],
      ["Masa Sewa", amankanTeks(formatTanggal(t.tanggal_checkin)) + " – " +
        amankanTeks(formatTanggal(t.tanggal_checkout))],
      ["Status Sewa", amankanTeks(status.label)]
    ];

    // Digambar sebagai isi kartu: judul bergaris bawah, lalu pasangan
    // label-nilai bertumpuk -- sama seperti kartu Detail Booking.
    ringkasanForm.innerHTML =
      '<h2 class="font-title-md text-title-md text-ink-primary ' +
      'border-b border-border-hairline pb-sm mb-md flex items-center gap-sm">' +
      '<span class="material-symbols-outlined text-ink-muted text-[20px]">lock</span>' +
      "Data Sewa (tidak dapat diubah)</h2>" +

      '<p class="font-body-sm text-body-sm text-ink-muted mb-md">Bagian ini mengikuti data ' +
      "transaksi. Kamar diubah lewat halaman Alokasi Kamar, sedangkan tanggal dan pembayaran " +
      "mengikuti pesanan aslinya.</p>" +

      '<div class="space-y-md">' +
      pasangan.map(function (p) {
        return barisData(p[0], p[1]);
      }).join("") +
      "</div>";
  }

  function bukaForm(t) {
    orderDiubah = t.order_id;

    if (judulForm) {
      judulForm.textContent = "Edit Data Diri – " + (t.nama_penyewa || t.order_id);
    }

    gambarRingkasan(t);

    if (inputNama) inputNama.value = t.nama_penyewa || "";
    if (inputNik) inputNik.value = t.nik_penyewa || "";
    if (inputWa) inputWa.value = bagianLokalNomor(t.kontak_penyewa);

    // Penghuni tambahan hanya dikenal pada sewa bulanan, sama seperti
    // aturan pada form order milik penyewa.
    const bulanan = t.tipe_sewa === "bulanan";
    if (barisPenghuni) barisPenghuni.classList.toggle("hidden", !bulanan);

    gambarPenghuni(bulanan
      ? (Array.isArray(t.penghuni_tambahan) ? t.penghuni_tambahan : [])
      : []);

    tampilkanHalaman(tampilanDaftar, semuaHalaman, halamanForm);
    if (inputNama) inputNama.focus({ preventScroll: true });
  }

  function tutupForm() {
    orderDiubah = null;
    tampilkanHalaman(tampilanDaftar, semuaHalaman, null);
  }

  /** Menandai isian yang salah agar mudah ditemukan. */
  function sorotIsian(masalah) {
    let elemen = null;

    if (masalah.bagian === "utama") {
      elemen = { nama: inputNama, nik: inputNik, whatsapp: inputWa }[masalah.field];
    } else if (wadahPenghuni) {
      const kotak = wadahPenghuni.querySelector('[data-penghuni="' + masalah.urutan + '"]');
      if (kotak) elemen = kotak.querySelector('[data-isian="' + masalah.field + '"]');
    }

    tandaiSalah(elemen, masalah.pesan);
  }

  async function simpanDataDiri() {
    if (!orderDiubah) return;

    const transaksi = sumber.cariTransaksi(orderDiubah);
    if (!transaksi) {
      beriTahu("gagal", "Data penghuni tidak ditemukan. Coba muat ulang halaman.");
      return;
    }

    const bulanan = transaksi.tipe_sewa === "bulanan";

    const isian = {
      nama: inputNama ? inputNama.value.trim() : "",
      nik: inputNik ? inputNik.value.trim() : "",
      whatsapp: inputWa ? inputWa.value.trim().replace(/[\s-]/g, "") : "",
      penghuni: bulanan ? bacaPenghuni() : []
    };

    const masalah = periksaDataDiri(isian);

    if (masalah.length > 0) {
      sorotIsian(masalah[0]);
      return;
    }

    const teksAsli = kunciTombol(tombolSimpanForm, true, "Menyimpan...");

    try {
      // updateDoc dengan HANYA empat field data diri. Field transaksi
      // tidak disebut sama sekali, sehingga tidak mungkin ikut berubah
      // walaupun ada kekeliruan di tempat lain.
      await updateDoc(doc(db, COL_TRANSAKSI, orderDiubah), {
        nama_penyewa: isian.nama,
        nik_penyewa: isian.nik,
        // Awalan disamakan dengan yang ditulis form order penyewa
        kontak_penyewa: "+62 " + isian.whatsapp,
        penghuni_tambahan: isian.penghuni
      });

      beriTahu("sukses", 'Data diri "' + isian.nama + '" berhasil diperbarui.');

      // Tabel tidak digambar ulang di sini: onSnapshot pada collection
      // transaksi akan memberitahu perubahannya sendiri.
      tutupForm();

    } catch (err) {
      console.error("Gagal menyimpan data diri:", err);
      beriTahu("gagal", "Gagal menyimpan: " + err.message);

    } finally {
      kunciTombol(tombolSimpanForm, false);
      if (tombolSimpanForm && teksAsli) tombolSimpanForm.textContent = teksAsli;
    }
  }

  // -------------------------------------------------------------------
  // 4e. Memasang penyimak
  // -------------------------------------------------------------------
  if (tombolTutupDetail) tombolTutupDetail.addEventListener("click", tutupDetail);
  if (tombolTutupDetail2) tombolTutupDetail2.addEventListener("click", tutupDetail);

  if (tombolTutupForm) tombolTutupForm.addEventListener("click", tutupForm);
  if (tombolBatalForm) tombolBatalForm.addEventListener("click", tutupForm);
  if (tombolSimpanForm) {
    tombolSimpanForm.addEventListener("click", function (e) {
      e.preventDefault();
      simpanDataDiri();
    });
  }

  // Menekan Enter di dalam isian ikut menyimpan, bukan memuat ulang
  // halaman dan membuang seluruh isian.
  const formIsian = document.getElementById("tenantForm");
  if (formIsian) {
    formIsian.addEventListener("submit", function (e) {
      e.preventDefault();
      simpanDataDiri();
    });
  }

  if (tombolTambahPenghuni) {
    tombolTambahPenghuni.addEventListener("click", function () {
      // Isian yang sudah diketik dibaca dulu, supaya tidak hilang
      // ketika daftarnya digambar ulang.
      const sekarang = bacaPenghuni();
      if (sekarang.length >= MAKS_PENGHUNI_TAMBAHAN) return;

      sekarang.push({ nik: "", nama: "", hubungan: "", whatsapp: "" });
      gambarPenghuni(sekarang);
    });
  }

  // Tombol hapus ditangani lewat satu penyimak di wadahnya, supaya
  // kotak yang digambar ulang tidak perlu dipasangi ulang.
  if (wadahPenghuni) {
    wadahPenghuni.addEventListener("click", function (e) {
      const tombol = e.target.closest("[data-hapus-penghuni]");
      if (!tombol) return;

      const urutan = Number(tombol.dataset.hapusPenghuni);
      const sekarang = bacaPenghuni();
      sekarang.splice(urutan, 1);
      gambarPenghuni(sekarang);
    });
  }

  if (tombolBatal) tombolBatal.addEventListener("click", tutupKonfirmasi);
  if (tombolLanjut) {
    tombolLanjut.addEventListener("click", async function () {
      const aksi = aksiSetelahKonfirmasi;
      tutupKonfirmasi();
      if (aksi) await aksi();
    });
  }

  // Tirai gelap dan tombol Esc hanya berlaku bagi modal konfirmasi.
  // Halaman detail tidak punya tirai untuk diklik.
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
  // 4e. Yang dipakai tenants.js
  // -------------------------------------------------------------------
  return {
    /** Menjalankan aksi dari tombol pada sebuah baris tabel. */
    jalankanAksi: function (aksi, orderId) {
      const transaksi = sumber.cariTransaksi(orderId);

      if (!transaksi) {
        beriTahu("gagal", "Data penghuni tidak ditemukan. Coba muat ulang halaman.");
        return;
      }

      if (aksi === "detail") bukaDetail(transaksi);
      else if (aksi === "edit") bukaForm(transaksi);
      else if (aksi === "arsip") mintaArsip(transaksi);
      else if (aksi === "pulihkan") mintaPulihkan(transaksi);
    }
  };
}
