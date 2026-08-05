/**
 * =====================================================================
 * CRUD CABANG & KAMAR (halaman branches)
 * =====================================================================
 * Berisi seluruh aksi tulis ke Firestore untuk halaman Manajemen Kamar
 * & Cabang: tambah, ubah, dan hapus.
 *
 * Dipisah dari js/admin-branches.js supaya file itu tetap fokus pada
 * urusan MENAMPILKAN data, sedangkan file ini mengurus MENGUBAH data.
 *
 * Semua pencarian elemen dilakukan dengan pemeriksaan null. Halaman
 * admin/branches.html belum memasang tombol-tombol ini, jadi fungsinya
 * cukup diam tanpa menimbulkan error di sana.
 *
 * Skema yang dipakai persis mengikuti seed-data.js:
 *   cabang : nama_cabang, alamat, deskripsi, gambar_url, galeri_foto,
 *            maps_url, fasilitas_umum, fasilitas_kamar, harga_bulanan,
 *            harga_harian, biaya_layanan
 *   kamar  : nomor_kamar, cabang_id, tersedia
 * =====================================================================
 */

import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, updateDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { db, COL_CABANG, COL_KAMAR, COL_TRANSAKSI } from "./firebase-init.js";
import { amankanTeks } from "./admin-util.js";

// =====================================================================
// 1. NOTIFIKASI HASIL AKSI
// =====================================================================
const elNotifikasi = document.getElementById("notifikasiAksi");

/**
 * Menampilkan kotak pemberitahuan di pojok kanan bawah.
 * @param {string} jenis - "sukses" | "gagal" | "info"
 */
export function beriTahu(jenis, pesan) {
  if (!elNotifikasi) {
    // Halaman tanpa kotak notifikasi tetap harus memberi kabar
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
    '<span class="material-symbols-outlined text-[20px] shrink-0">' + gaya.ikon + '</span>' +
    '<span>' + amankanTeks(pesan) + '</span>';

  elNotifikasi.appendChild(kotak);

  // Pesan gagal dibiarkan lebih lama karena biasanya perlu dibaca
  const lama = jenis === "gagal" ? 6000 : 3500;
  setTimeout(function () {
    kotak.classList.add("opacity-0");
    setTimeout(function () { kotak.remove(); }, 300);
  }, lama);
}

// =====================================================================
// 2. MODAL KONFIRMASI HAPUS
// =====================================================================
const elModalKonfirmasi = document.getElementById("konfirmasiModal");
const elKonfirmasiJudul = document.getElementById("konfirmasiJudul");
const elKonfirmasiPesan = document.getElementById("konfirmasiPesan");
const elKonfirmasiBatal = document.getElementById("konfirmasiBatal");
const elKonfirmasiHapus = document.getElementById("konfirmasiHapus");

let aksiSetelahKonfirmasi = null;

function bukaKonfirmasi(judul, pesan, saatDisetujui) {
  if (!elModalKonfirmasi) {
    // Cadangan bila modal tidak tersedia di halaman
    if (confirm(judul + "\n\n" + pesan)) saatDisetujui();
    return;
  }

  elKonfirmasiJudul.textContent = judul;
  elKonfirmasiPesan.textContent = pesan;
  aksiSetelahKonfirmasi = saatDisetujui;

  elModalKonfirmasi.classList.remove("hidden");
  elModalKonfirmasi.classList.add("flex");
}

function tutupKonfirmasi() {
  if (!elModalKonfirmasi) return;
  elModalKonfirmasi.classList.add("hidden");
  elModalKonfirmasi.classList.remove("flex");
  aksiSetelahKonfirmasi = null;
}

if (elModalKonfirmasi) {
  elKonfirmasiBatal.addEventListener("click", tutupKonfirmasi);
  elModalKonfirmasi.addEventListener("click", function (e) {
    if (e.target === elModalKonfirmasi) tutupKonfirmasi();
  });
  elKonfirmasiHapus.addEventListener("click", async function () {
    const aksi = aksiSetelahKonfirmasi;
    tutupKonfirmasi();
    if (aksi) await aksi();
  });
}

// =====================================================================
// 3. FUNGSI BANTU
// =====================================================================

/** Mengubah "Mawar Kos Indah" menjadi "mawar-kos-indah" untuk Document ID. */
function buatSlug(teks) {
  return String(teks || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Menentukan awalan kode kamar untuk sebuah cabang, contoh "PSN".
 * Diambil dari kamar yang sudah ada agar pola lama tetap terjaga.
 * Bila cabang belum punya kamar, dipakai 3 huruf pertama dari id cabang.
 */
function tentukanAwalanKamar(idCabang, daftarKamarCabang) {
  if (daftarKamarCabang.length > 0) {
    const contoh = String(daftarKamarCabang[0].id);
    const pisah = contoh.split("-");
    if (pisah.length > 1) return pisah[0];
  }

  return String(idCabang).replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "KMR";
}

/** Membaca checkbox fasilitas yang tercentang pada sebuah kelompok. */
function bacaFasilitas(idKelompok) {
  const kelompok = document.getElementById(idKelompok);
  if (!kelompok) return [];

  const hasil = [];
  kelompok.querySelectorAll("[data-facility]").forEach(function (kotak) {
    if (kotak.checked) hasil.push(kotak.dataset.facility);
  });
  return hasil;
}

/** Mencentang checkbox sesuai daftar fasilitas yang sudah tersimpan. */
function isiFasilitas(idKelompok, daftar) {
  const kelompok = document.getElementById(idKelompok);
  if (!kelompok) return;

  const dipilih = Array.isArray(daftar) ? daftar : [];
  kelompok.querySelectorAll("[data-facility]").forEach(function (kotak) {
    kotak.checked = dipilih.indexOf(kotak.dataset.facility) !== -1;
  });
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
// 4. PEMERIKSAAN SEBELUM MENGHAPUS
// =====================================================================

/**
 * Memeriksa apakah sebuah kamar sedang dipakai.
 * Dua lapis pemeriksaan:
 *   1. field "tersedia" pada dokumen kamar
 *   2. transaksi yang masih berstatus checked_in di kamar tersebut
 * Lapis kedua dipakai agar pesan kesalahannya bisa menyebut nama
 * penghuninya, bukan sekadar "kamar terisi".
 */
async function periksaKamarDipakai(idKamar, dataKamar) {
  if (dataKamar && dataKamar.tersedia === false) {
    const kueri = query(
      collection(db, COL_TRANSAKSI),
      where("kamar_id", "==", idKamar),
      where("status_checkin", "==", "checked_in")
    );

    const cuplikan = await getDocs(kueri);

    if (!cuplikan.empty) {
      const penghuni = cuplikan.docs[0].data();
      return "sedang dihuni oleh " + penghuni.nama_penyewa;
    }

    return "berstatus terisi";
  }

  return null; // aman untuk dihapus
}

// =====================================================================
// 5. TAMBAH / EDIT CABANG
// =====================================================================
const elFormCabang = document.getElementById("addBranchForm");
const elJudulFormCabang = document.getElementById("addBranchPageTitle");
const elSimpanCabang = document.getElementById("saveAddBranchBtn");

const inputCabang = {
  nama: document.getElementById("branchNameInput"),
  alamat: document.getElementById("branchAddressInput"),
  maps: document.getElementById("branchMapsUrlInput"),
  deskripsi: document.getElementById("branchDescInput"),
  hargaBulanan: document.getElementById("branchHargaBulananInput"),
  hargaHarian: document.getElementById("branchHargaHarianInput")
};

// null = sedang menambah cabang baru, berisi id = sedang mengubah
let idCabangDiubah = null;

/** Mengisi form cabang dengan data yang ada (untuk mode ubah). */
export function isiFormCabang(idCabang, data) {
  idCabangDiubah = idCabang;

  if (inputCabang.nama) inputCabang.nama.value = data ? data.nama_cabang || "" : "";
  if (inputCabang.alamat) inputCabang.alamat.value = data ? data.alamat || "" : "";
  if (inputCabang.maps) inputCabang.maps.value = data ? data.maps_url || "" : "";
  if (inputCabang.deskripsi) inputCabang.deskripsi.value = data ? data.deskripsi || "" : "";
  if (inputCabang.hargaBulanan) inputCabang.hargaBulanan.value = data ? data.harga_bulanan || "" : "";
  if (inputCabang.hargaHarian) inputCabang.hargaHarian.value = data ? data.harga_harian || "" : "";

  isiFasilitas("branchFacilitiesGroup", data ? data.fasilitas_umum : []);
  isiFasilitas("roomFacilitiesGroup", data ? data.fasilitas_kamar : []);

  if (elJudulFormCabang) {
    elJudulFormCabang.textContent = idCabang ? "Edit Info Cabang" : "Tambah Cabang Baru";
  }
  if (elSimpanCabang) {
    elSimpanCabang.textContent = idCabang ? "Simpan Perubahan" : "Simpan Data Cabang";
  }
}

/** Memeriksa isian form cabang. Mengembalikan null bila ada yang salah. */
function bacaFormCabang() {
  const nama = inputCabang.nama ? inputCabang.nama.value.trim() : "";
  const alamat = inputCabang.alamat ? inputCabang.alamat.value.trim() : "";
  const hargaBulanan = Number(inputCabang.hargaBulanan ? inputCabang.hargaBulanan.value : 0);
  const hargaHarian = Number(inputCabang.hargaHarian ? inputCabang.hargaHarian.value : 0);

  if (!nama) {
    tandaiSalah(inputCabang.nama, "Nama cabang wajib diisi.");
    return null;
  }
  if (nama.length < 3) {
    tandaiSalah(inputCabang.nama, "Nama cabang terlalu pendek.");
    return null;
  }
  if (!alamat) {
    tandaiSalah(inputCabang.alamat, "Alamat cabang wajib diisi.");
    return null;
  }
  if (!hargaBulanan || hargaBulanan <= 0) {
    tandaiSalah(inputCabang.hargaBulanan, "Harga bulanan wajib diisi dan harus lebih dari 0.");
    return null;
  }
  if (!hargaHarian || hargaHarian <= 0) {
    tandaiSalah(inputCabang.hargaHarian, "Harga harian wajib diisi dan harus lebih dari 0.");
    return null;
  }

  const fasilitasUmum = bacaFasilitas("branchFacilitiesGroup");
  if (fasilitasUmum.length === 0) {
    beriTahu("gagal", "Pilih minimal satu fasilitas cabang.");
    return null;
  }

  return {
    nama_cabang: nama,
    alamat: alamat,
    deskripsi: inputCabang.deskripsi ? inputCabang.deskripsi.value.trim() : "",
    maps_url: inputCabang.maps ? inputCabang.maps.value.trim() : "",
    fasilitas_umum: fasilitasUmum,
    fasilitas_kamar: bacaFasilitas("roomFacilitiesGroup"),
    harga_bulanan: hargaBulanan,
    harga_harian: hargaHarian,
    biaya_layanan: 0
  };
}

async function simpanCabang() {
  const data = bacaFormCabang();
  if (!data) return false;

  const teksAsli = kunciTombol(elSimpanCabang, true, "Menyimpan...");

  try {
    if (idCabangDiubah) {
      // --- MODE UBAH ---
      // Foto tidak ikut diperbarui agar gambar cabang tidak berubah
      // setiap kali informasinya disunting.
      await updateDoc(doc(db, COL_CABANG, idCabangDiubah), data);
      beriTahu("sukses", 'Cabang "' + data.nama_cabang + '" berhasil diperbarui.');

    } else {
      // --- MODE TAMBAH ---
      let idBaru = buatSlug(data.nama_cabang);

      // Pastikan Document ID belum dipakai cabang lain
      let urutan = 2;
      while ((await getDoc(doc(db, COL_CABANG, idBaru))).exists()) {
        idBaru = buatSlug(data.nama_cabang) + "-" + urutan;
        urutan++;
      }

      // Foto dibuat otomatis memakai pola yang sama dengan seed-data.js
      data.gambar_url = "https://picsum.photos/seed/" + idBaru + "/800/600";
      data.galeri_foto = [
        "https://picsum.photos/seed/" + idBaru + "-1/600/450",
        "https://picsum.photos/seed/" + idBaru + "-2/600/450",
        "https://picsum.photos/seed/" + idBaru + "-3/600/450"
      ];

      await setDoc(doc(db, COL_CABANG, idBaru), data);
      beriTahu("sukses",
        'Cabang "' + data.nama_cabang + '" berhasil ditambahkan. ' +
        'Silakan tambahkan kamar untuk cabang ini.');
    }

    return true;

  } catch (err) {
    console.error("Gagal menyimpan cabang:", err);
    beriTahu("gagal", "Gagal menyimpan cabang: " + err.message);
    return false;

  } finally {
    kunciTombol(elSimpanCabang, false);
    if (elSimpanCabang && teksAsli) elSimpanCabang.textContent = teksAsli;
  }
}

// =====================================================================
// 6. HAPUS CABANG
// =====================================================================

/**
 * Cabang hanya boleh dihapus bila SELURUH kamarnya kosong.
 * Bila lolos, kamar-kamarnya ikut terhapus dalam satu batch agar tidak
 * ada kamar yatim yang menunjuk ke cabang yang sudah tiada.
 */
export function mintaHapusCabang(idCabang, dataCabang, daftarKamarCabang, saatSelesai) {
  const terisi = daftarKamarCabang.filter(function (k) { return k.tersedia === false; });

  if (terisi.length > 0) {
    const nomor = terisi.map(function (k) { return k.nomor_kamar; }).join(", ");
    beriTahu("gagal",
      'Cabang "' + dataCabang.nama_cabang + '" tidak dapat dihapus karena masih ada ' +
      terisi.length + ' kamar yang tersewa (kamar ' + nomor + '). ' +
      'Pastikan seluruh penghuni sudah check-out terlebih dahulu.');
    return;
  }

  const keterangan = daftarKamarCabang.length > 0
    ? 'Cabang "' + dataCabang.nama_cabang + '" beserta ' + daftarKamarCabang.length +
      ' kamar di dalamnya akan dihapus permanen. Riwayat transaksi tetap tersimpan, ' +
      'tetapi nama cabangnya tidak lagi dapat ditampilkan.'
    : 'Cabang "' + dataCabang.nama_cabang + '" akan dihapus permanen.';

  bukaKonfirmasi("Hapus cabang ini?", keterangan, async function () {
    try {
      // Satu batch: cabang dan seluruh kamarnya terhapus bersamaan,
      // sehingga tidak mungkin cabang hilang tapi kamarnya tertinggal.
      const batch = writeBatch(db);

      daftarKamarCabang.forEach(function (kamar) {
        batch.delete(doc(db, COL_KAMAR, kamar.id));
      });
      batch.delete(doc(db, COL_CABANG, idCabang));

      await batch.commit();

      beriTahu("sukses",
        'Cabang "' + dataCabang.nama_cabang + '" beserta ' +
        daftarKamarCabang.length + ' kamar berhasil dihapus.');

      if (saatSelesai) saatSelesai();

    } catch (err) {
      console.error("Gagal menghapus cabang:", err);
      beriTahu("gagal", "Gagal menghapus cabang: " + err.message);
    }
  });
}

// =====================================================================
// 7. TAMBAH KAMAR
// =====================================================================
const elSimpanKamar = document.getElementById("saveAddRoomBtn");
const elPilihCabangKamar = document.getElementById("addRoomBranchSelect");
const elNomorKamarBaru = document.getElementById("addRoomNumberInput");

async function simpanKamarBaru() {
  const idCabang = elPilihCabangKamar ? elPilihCabangKamar.value : "";
  const nomor = elNomorKamarBaru ? elNomorKamarBaru.value.trim() : "";

  if (!idCabang) {
    beriTahu("gagal", "Silakan pilih cabang terlebih dahulu.");
    return false;
  }
  if (!nomor) {
    tandaiSalah(elNomorKamarBaru, "Nomor kamar wajib diisi.");
    return false;
  }

  const teksAsli = kunciTombol(elSimpanKamar, true, "Menyimpan...");

  try {
    // Ambil kamar milik cabang ini untuk menentukan awalan kode
    // sekaligus memeriksa nomor yang sudah terpakai.
    const cuplikan = await getDocs(
      query(collection(db, COL_KAMAR), where("cabang_id", "==", idCabang))
    );

    const kamarCabang = [];
    cuplikan.forEach(function (d) {
      kamarCabang.push(Object.assign({ id: d.id }, d.data()));
    });

    const bentrok = kamarCabang.some(function (k) {
      return String(k.nomor_kamar) === nomor;
    });

    if (bentrok) {
      tandaiSalah(elNomorKamarBaru, 'Nomor kamar "' + nomor + '" sudah ada di cabang ini.');
      return false;
    }

    const idKamar = tentukanAwalanKamar(idCabang, kamarCabang) + "-" + nomor;

    if ((await getDoc(doc(db, COL_KAMAR, idKamar))).exists()) {
      tandaiSalah(elNomorKamarBaru, 'Kode kamar "' + idKamar + '" sudah dipakai.');
      return false;
    }

    await setDoc(doc(db, COL_KAMAR, idKamar), {
      nomor_kamar: nomor,
      cabang_id: idCabang,
      tersedia: true
    });

    beriTahu("sukses", 'Kamar "' + nomor + '" (' + idKamar + ') berhasil ditambahkan.');
    if (elNomorKamarBaru) elNomorKamarBaru.value = "";
    return true;

  } catch (err) {
    console.error("Gagal menambah kamar:", err);
    beriTahu("gagal", "Gagal menambah kamar: " + err.message);
    return false;

  } finally {
    kunciTombol(elSimpanKamar, false);
    if (elSimpanKamar && teksAsli) elSimpanKamar.textContent = teksAsli;
  }
}

// =====================================================================
// 8. EDIT KAMAR
// =====================================================================
const elSimpanEditKamar = document.getElementById("saveEditRoomBtn");
const elKodeKamarEdit = document.getElementById("editRoomCodeInput");
const elCabangKamarEdit = document.getElementById("editRoomBranchInput");
const elNomorKamarEdit = document.getElementById("editRoomNumberInput");
const elStatusKamarEdit = document.getElementById("editRoomStatusSelect");

let idKamarDiubah = null;

/** Mengisi form edit kamar dengan data kamar yang dipilih. */
export function isiFormKamar(kamar, namaCabang) {
  idKamarDiubah = kamar.id;

  if (elKodeKamarEdit) elKodeKamarEdit.value = kamar.id;
  if (elCabangKamarEdit) elCabangKamarEdit.value = namaCabang;
  if (elNomorKamarEdit) elNomorKamarEdit.value = kamar.nomor_kamar || "";
  if (elStatusKamarEdit) elStatusKamarEdit.value = kamar.tersedia === false ? "terisi" : "tersedia";
}

async function simpanEditKamar() {
  if (!idKamarDiubah) return false;

  const nomor = elNomorKamarEdit ? elNomorKamarEdit.value.trim() : "";

  if (!nomor) {
    tandaiSalah(elNomorKamarEdit, "Nomor kamar wajib diisi.");
    return false;
  }

  const teksAsli = kunciTombol(elSimpanEditKamar, true, "Menyimpan...");

  try {
    const kamarLama = await getDoc(doc(db, COL_KAMAR, idKamarDiubah));

    if (!kamarLama.exists()) {
      beriTahu("gagal", "Kamar tidak ditemukan. Mungkin sudah dihapus.");
      return false;
    }

    const dataLama = kamarLama.data();

    // Nomor tidak boleh bentrok dengan kamar lain di cabang yang sama
    const cuplikan = await getDocs(
      query(collection(db, COL_KAMAR), where("cabang_id", "==", dataLama.cabang_id))
    );

    const bentrok = cuplikan.docs.some(function (d) {
      return d.id !== idKamarDiubah && String(d.data().nomor_kamar) === nomor;
    });

    if (bentrok) {
      tandaiSalah(elNomorKamarEdit, 'Nomor kamar "' + nomor + '" sudah dipakai kamar lain di cabang ini.');
      return false;
    }

    const tersediaBaru = elStatusKamarEdit ? elStatusKamarEdit.value === "tersedia" : dataLama.tersedia;

    // Menandai kamar berpenghuni sebagai "tersedia" akan membuat data
    // menjadi tidak sinkron, jadi dicegah di sini.
    if (tersediaBaru === true && dataLama.tersedia === false) {
      const alasan = await periksaKamarDipakai(idKamarDiubah, dataLama);
      if (alasan && alasan.indexOf("dihuni") !== -1) {
        beriTahu("gagal",
          "Status tidak dapat diubah menjadi Tersedia karena kamar ini " + alasan +
          ". Proses check-out penghuninya terlebih dahulu.");
        return false;
      }
    }

    await updateDoc(doc(db, COL_KAMAR, idKamarDiubah), {
      nomor_kamar: nomor,
      tersedia: tersediaBaru
    });

    beriTahu("sukses", "Data kamar " + idKamarDiubah + " berhasil diperbarui.");
    return true;

  } catch (err) {
    console.error("Gagal menyimpan kamar:", err);
    beriTahu("gagal", "Gagal menyimpan kamar: " + err.message);
    return false;

  } finally {
    kunciTombol(elSimpanEditKamar, false);
    if (elSimpanEditKamar && teksAsli) elSimpanEditKamar.textContent = teksAsli;
  }
}

// =====================================================================
// 9. HAPUS KAMAR
// =====================================================================
export function mintaHapusKamar(kamar, saatSelesai) {
  bukaKonfirmasi(
    "Hapus kamar ini?",
    'Kamar "' + kamar.nomor_kamar + '" (' + kamar.id + ') akan dihapus permanen dari cabang ini.',
    async function () {
      try {
        // Diperiksa ulang tepat sebelum menghapus, karena statusnya
        // bisa saja berubah sejak halaman terakhir digambar.
        const cuplikan = await getDoc(doc(db, COL_KAMAR, kamar.id));

        if (!cuplikan.exists()) {
          beriTahu("gagal", "Kamar sudah tidak ada di database.");
          if (saatSelesai) saatSelesai();
          return;
        }

        const alasan = await periksaKamarDipakai(kamar.id, cuplikan.data());

        if (alasan) {
          beriTahu("gagal",
            'Kamar "' + kamar.nomor_kamar + '" tidak dapat dihapus karena ' + alasan +
            ". Proses check-out terlebih dahulu sebelum menghapus kamar.");
          return;
        }

        await deleteDoc(doc(db, COL_KAMAR, kamar.id));
        beriTahu("sukses", 'Kamar "' + kamar.nomor_kamar + '" berhasil dihapus.');

        if (saatSelesai) saatSelesai();

      } catch (err) {
        console.error("Gagal menghapus kamar:", err);
        beriTahu("gagal", "Gagal menghapus kamar: " + err.message);
      }
    }
  );
}

// =====================================================================
// 10. MEMASANG TOMBOL SIMPAN
// ---------------------------------------------------------------------
// Halaman hanya ditutup bila penyimpanan berhasil, supaya isian yang
// gagal tidak hilang dan bisa langsung diperbaiki penggunanya.
// =====================================================================
export function pasangTombolSimpan(tutupHalaman) {
  if (elSimpanCabang) {
    elSimpanCabang.addEventListener("click", async function (e) {
      e.preventDefault();
      if (await simpanCabang()) tutupHalaman(elFormCabang);
    });
  }

  if (elSimpanKamar) {
    elSimpanKamar.addEventListener("click", async function (e) {
      e.preventDefault();
      if (await simpanKamarBaru()) tutupHalaman(document.getElementById("addRoomForm"));
    });
  }

  if (elSimpanEditKamar) {
    elSimpanEditKamar.addEventListener("click", async function (e) {
      e.preventDefault();
      if (await simpanEditKamar()) tutupHalaman(document.getElementById("editRoomForm"));
    });
  }
}

/** Menandai bahwa form cabang sedang dipakai untuk menambah, bukan mengubah. */
export function siapkanTambahCabang() {
  isiFormCabang(null, null);
}
