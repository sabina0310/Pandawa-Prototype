/**
 * =====================================================================
 * MEMBAWA PILIHAN TANGGAL ANTAR HALAMAN
 * =====================================================================
 * Beranda dan Katalog sama-sama menyediakan kolom tanggal pada panel
 * filter. Sebelumnya isian itu berhenti di halamannya sendiri, sehingga
 * pengunjung harus mengetik ulang tanggal yang sama pada form pemesanan
 * di halaman Detail Cabang.
 *
 * Berkas ini menyalurkan pilihan tersebut lewat parameter alamat:
 *
 *   room-detail.html?cabang=<id>&tipe=<harian|bulanan>
 *                   &mulai=YYYY-MM-DD&selesai=YYYY-MM-DD&durasi=<angka>
 *
 * Parameter alamat dipilih, bukan localStorage, karena pilihan tanggal
 * memang bagian dari "halaman apa yang sedang dilihat": tautannya bisa
 * disalin dan dibagikan, tombol kembali membawa pilihan yang sama, dan
 * dua tab yang dibuka bersamaan tidak saling menimpa.
 *
 * Arti parameter "durasi" mengikuti "tipe":
 *   tipe=harian  -> jumlah HARI  (1 / 2 / 3 / 7 pada panel Beranda)
 *   tipe=bulanan -> jumlah BULAN (1 / 3 / 6 pada panel Beranda)
 * Parameter ini hanya menjadi cadangan bila pengunjung mengisi tanggal
 * mulai tetapi mengosongkan tanggal selesai.
 * =====================================================================
 */

export const PARAM_MULAI = 'mulai';
export const PARAM_SELESAI = 'selesai';
export const PARAM_DURASI = 'durasi';

/** Pilihan durasi bulan yang tersedia di halaman Detail Cabang. */
export const DURASI_BULAN_TERSEDIA = [1, 3, 6];

// =====================================================================
// 1. PENANGANAN TANGGAL
// =====================================================================

/** Mengubah objek Date menjadi teks "YYYY-MM-DD" untuk input tanggal. */
export function keTeksTanggal(tanggal) {
  const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
  const hari = String(tanggal.getDate()).padStart(2, '0');
  return tanggal.getFullYear() + '-' + bulan + '-' + hari;
}

/** Tanggal hari ini dalam bentuk "YYYY-MM-DD". */
export function hariIni() {
  return keTeksTanggal(new Date());
}

/**
 * Memeriksa satu nilai tanggal sebelum dipakai.
 *
 * Nilai ditolak bila bentuknya bukan "YYYY-MM-DD", bukan tanggal yang
 * benar-benar ada (contoh 2026-02-31), atau sudah lewat. Tanggal yang
 * sudah lewat sengaja dibuang karena kolom check-in di halaman Detail
 * Cabang memasang batas minimal hari ini; mengisinya dengan tanggal
 * lampau hanya akan membuat form gagal divalidasi.
 *
 * @returns {string} tanggalnya bila sah, atau '' bila tidak
 */
export function tanggalDipakai(teks) {
  const nilai = String(teks === undefined || teks === null ? '' : teks).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return '';

  // Perbandingan ulang menolak tanggal yang tidak nyata: Date akan
  // menggeser 2026-02-31 menjadi 2026-03-03, sehingga teksnya berubah.
  const tanggal = new Date(nilai + 'T00:00:00');
  if (isNaN(tanggal.getTime()) || keTeksTanggal(tanggal) !== nilai) return '';

  // Bentuknya lebar tetap, jadi perbandingan teks sudah cukup.
  return nilai >= hariIni() ? nilai : '';
}

/**
 * Menghitung tanggal akhir sewa bulanan: tanggal mulai + durasi bulan.
 *
 * Dipakai panel filter Beranda maupun Katalog. Aturannya sengaja sama
 * dengan hitungCheckoutOtomatis() di js/room-detail.js, karena tanggal
 * yang dihitung di sini langsung dibawa ke form pemesanan.
 *
 * @returns {string} "YYYY-MM-DD", atau '' bila tanggal mulai belum diisi
 */
export function akhirSewaBulanan(mulai, bulan) {
  if (!mulai) return '';

  const awal = new Date(mulai + 'T00:00:00');
  if (isNaN(awal.getTime())) return '';

  const jumlah = Number(bulan) > 0 ? Number(bulan) : 1;

  const akhir = new Date(awal);
  akhir.setMonth(akhir.getMonth() + jumlah);
  return keTeksTanggal(akhir);
}

/**
 * Menghitung berapa BULAN jarak dua tanggal, hanya bila jaraknya pas
 * dengan salah satu pilihan durasi di halaman Detail Cabang.
 *
 * Perhitungannya sengaja meniru hitungCheckoutOtomatis() di
 * js/room-detail.js (menambah bulan pada objek Date), supaya keduanya
 * tidak pernah berbeda hasil.
 *
 * @returns {number|null} 1, 3, 6, atau null bila tidak ada yang cocok
 */
export function bulanAntara(mulai, selesai) {
  if (!mulai || !selesai) return null;

  const awal = new Date(mulai + 'T00:00:00');
  if (isNaN(awal.getTime())) return null;

  for (let i = 0; i < DURASI_BULAN_TERSEDIA.length; i++) {
    const bulan = DURASI_BULAN_TERSEDIA[i];
    const akhir = new Date(awal);
    akhir.setMonth(akhir.getMonth() + bulan);

    if (keTeksTanggal(akhir) === selesai) return bulan;
  }

  return null;
}

// =====================================================================
// 2. MEMBACA & MERANGKAI PARAMETER
// =====================================================================

/**
 * Membaca pilihan tanggal dari alamat halaman.
 *
 * @param {URLSearchParams|string} sumber - URLSearchParams, atau teks
 *        query seperti "?mulai=2026-09-01"
 * @returns {{mulai: string, selesai: string, durasi: number}}
 */
export function bacaPilihanTanggal(sumber) {
  const parameter = sumber instanceof URLSearchParams
    ? sumber
    : new URLSearchParams(sumber || '');

  const durasi = Number(parameter.get(PARAM_DURASI));

  return {
    mulai: tanggalDipakai(parameter.get(PARAM_MULAI)),
    selesai: tanggalDipakai(parameter.get(PARAM_SELESAI)),
    durasi: Number.isInteger(durasi) && durasi > 0 ? durasi : 0
  };
}

/**
 * Merangkai pilihan tanggal menjadi potongan alamat yang siap
 * disambung, contoh: "&mulai=2026-09-01&selesai=2026-10-01".
 *
 * Nilai yang kosong atau tidak sah tidak ikut ditulis, sehingga alamat
 * halaman tetap bersih bila pengunjung memang tidak mengisi apa pun.
 */
export function rangkaiPilihanTanggal(pilihan) {
  const isi = pilihan || {};
  const bagian = [];

  const mulai = tanggalDipakai(isi.mulai);
  const selesai = tanggalDipakai(isi.selesai);
  const durasi = Number(isi.durasi);

  if (mulai) bagian.push(PARAM_MULAI + '=' + encodeURIComponent(mulai));
  if (selesai) bagian.push(PARAM_SELESAI + '=' + encodeURIComponent(selesai));
  if (Number.isInteger(durasi) && durasi > 0) {
    bagian.push(PARAM_DURASI + '=' + encodeURIComponent(durasi));
  }

  return bagian.length === 0 ? '' : '&' + bagian.join('&');
}

/**
 * Membaca isi dua kolom tanggal pada panel filter.
 *
 * Dipakai Beranda maupun Katalog; keduanya hanya berbeda id elemennya.
 */
export function bacaKolomTanggal(idMulai, idSelesai) {
  const kolomMulai = document.getElementById(idMulai);
  const kolomSelesai = document.getElementById(idSelesai);

  return {
    mulai: tanggalDipakai(kolomMulai ? kolomMulai.value : ''),
    selesai: tanggalDipakai(kolomSelesai ? kolomSelesai.value : ''),
    durasi: 0
  };
}

/**
 * Mengisi dua kolom tanggal pada panel filter dengan pilihan yang
 * dibawa dari halaman sebelumnya, lalu memasang batas minimal hari ini
 * supaya pengunjung tidak bisa memilih tanggal yang sudah lewat.
 */
export function isiKolomTanggal(idMulai, idSelesai, pilihan) {
  const kolomMulai = document.getElementById(idMulai);
  const kolomSelesai = document.getElementById(idSelesai);
  const isi = pilihan || {};

  if (kolomMulai) {
    kolomMulai.min = hariIni();
    if (isi.mulai) kolomMulai.value = isi.mulai;
  }

  if (kolomSelesai) {
    kolomSelesai.min = isi.mulai || hariIni();
    if (isi.selesai) kolomSelesai.value = isi.selesai;
  }
}
