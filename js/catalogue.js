/**
 * =====================================================================
 * HALAMAN KATALOG (customer/catalogue.html)
 * Menampilkan SELURUH cabang kos beserta ketersediaan kamarnya
 * =====================================================================
 * Alur:
 *   1. Ambil data cabang + hitungan kamar sekali saja
 *   2. Isi pilihan filter cabang secara otomatis
 *   3. Tampilkan cabang dalam bentuk grid
 *   4. Kartu diklik -> room-detail.html?cabang=<ID cabang>
 *
 * Catatan:
 * Panel filter di sisi kiri berisi hal yang sama dengan panel pencarian
 * di Beranda, dan berperilaku sama pula:
 *
 *   HARIAN  -> tanpa kolom durasi. Pengunjung mengisi sendiri tanggal
 *              mulai dan selesainya.
 *   BULANAN -> ada kolom durasi (1 / 3 / 6 bulan, bawaan 1 bulan).
 *              Tanggal selesai dihitung otomatis dari tanggal mulai
 *              ditambah durasi, dan kolomnya dikunci supaya tidak ada
 *              dua sumber kebenaran.
 *
 * Yang benar-benar menyaring daftar cabang hanyalah "Pilih Cabang".
 * Tipe sewa tidak membedakan cabang, karena setiap kamar bisa disewa
 * harian maupun bulanan; sedangkan penyaringan tanggal memerlukan data
 * kalender pemesanan yang belum ada pada prototipe ini.
 *
 * Meski begitu isian tipe sewa dan tanggal tidak sia-sia: semuanya
 * DIBAWA ke halaman Detail Cabang (dan diterima dari Beranda) supaya
 * pengunjung tidak perlu mengisi hal yang sama dua kali. Aturan
 * pembawaannya ada di js/filter-tanggal.js.
 * =====================================================================
 */

import { ambilCabangDenganKetersediaan } from '../js/customer-data.js';
import { formatRupiahSingkat } from '../js/format.js';
import {
  bacaPilihanTanggal, bacaKolomTanggal, isiKolomTanggal,
  rangkaiPilihanTanggal, akhirSewaBulanan
} from '../js/filter-tanggal.js';

const wadahKartu = document.getElementById('katalogGrid');
const pilihanCabang = document.getElementById('filterCabang');
const tombolFilter = document.getElementById('btnTerapkanFilter');
const infoJumlah = document.getElementById('infoJumlahKamar');

// Menyimpan seluruh data cabang agar filter tidak perlu memuat ulang dari server
let semuaCabang = [];

const pilihanDurasi = document.getElementById('filterDurasiSewa');
const grupDurasi = document.getElementById('durasiSewaGroup');

const ID_MULAI = 'filterTanggalMulai';
const ID_SELESAI = 'filterTanggalSelesai';

// Tipe sewa yang dibawa dari beranda, contoh: catalogue.html?tipe=bulanan
const tipeSewaDibawa = new URLSearchParams(window.location.search).get('tipe') || '';

// Pilihan tanggal yang dibawa dari beranda
const tanggalDibawa = bacaPilihanTanggal(window.location.search);

// =====================================================================
// 1. TAMPILAN SEMENTARA (LOADING)
// =====================================================================
function tampilkanLoading() {
  let html = '';
  for (let i = 0; i < 6; i++) {
    html +=
      '<div class="bg-surface-canvas rounded-[10px] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] overflow-hidden flex flex-col animate-pulse">' +
      '<div class="h-48 bg-surface-variant"></div>' +
      '<div class="p-base flex flex-col gap-sm">' +
      '<div class="h-4 w-3/4 bg-surface-variant rounded"></div>' +
      '<div class="h-3 w-1/2 bg-surface-variant rounded"></div>' +
      '<div class="h-6 w-2/3 bg-surface-variant rounded mt-sm"></div>' +
      '</div></div>';
  }
  wadahKartu.innerHTML = html;
  if (infoJumlah) infoJumlah.textContent = 'Memuat data cabang...';
}

// =====================================================================
// 2. TAMPILAN PESAN (kosong / gagal)
// =====================================================================
function tampilkanPesan(ikon, judul, keterangan) {
  wadahKartu.innerHTML =
    '<div class="col-span-full flex flex-col items-center justify-center text-center py-section gap-sm">' +
    '<span class="material-symbols-outlined text-[48px] text-ink-muted">' + ikon + '</span>' +
    '<p class="font-display-md text-display-md text-ink-primary">' + judul + '</p>' +
    '<p class="font-body-md text-body-md text-ink-muted max-w-md">' + keterangan + '</p>' +
    '</div>';
}

// =====================================================================
// 3. MEMBUAT HTML SATU KARTU CABANG
//    Kelas CSS sama persis dengan desain awal halaman
// =====================================================================
function buatKartuCabang(cabang) {
  const penuh = cabang.kamar_tersedia === 0;

  const badgeStatus = penuh
    ? '<span class="bg-status-occupied/10 text-status-occupied font-badge text-badge px-sm py-xxs rounded-full backdrop-blur-sm">Penuh</span>'
    : '<span class="bg-status-available/10 text-status-available font-badge text-badge px-sm py-xxs rounded-full backdrop-blur-sm">' +
      cabang.kamar_tersedia + ' Tersedia</span>';

  // Cabang penuh ditampilkan lebih redup dan tidak bisa diklik
  const gayaKartu = penuh ? ' opacity-70 cursor-not-allowed' : ' cursor-pointer';

  const teksTombol = penuh ? 'Penuh' : 'Detail';
  const gayaTombol = penuh
    ? 'text-ink-muted border border-border-strong cursor-not-allowed'
    : 'text-primary border border-primary hover:bg-primary-container/10';

  return '' +
    '<div class="room-card bg-surface-canvas rounded-[10px] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] overflow-hidden flex flex-col group' + gayaKartu + '" ' +
      'data-cabang-id="' + cabang.id + '" data-penuh="' + (penuh ? '1' : '0') + '">' +
      '<div class="relative h-48 overflow-hidden">' +
        '<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="' + cabang.nama_cabang + '" src="' + cabang.gambar_url + '">' +
        '<div class="absolute top-sm right-sm flex gap-sm">' +
          badgeStatus +
          '<span class="bg-surface-canvas/90 text-primary font-tag-uppercase text-tag-uppercase px-sm py-xxs rounded-sm uppercase tracking-wide backdrop-blur-sm">HARIAN / BULANAN</span>' +
        '</div>' +
      '</div>' +
      '<div class="p-base flex flex-col flex-grow">' +
        '<h3 class="font-title-md text-title-md text-ink-primary mb-xs">' + cabang.nama_cabang + '</h3>' +
        '<p class="font-body-sm text-body-sm text-ink-muted flex items-center gap-xs mb-sm">' +
          '<span class="material-symbols-outlined text-[16px]">location_on</span>' + cabang.alamat +
        '</p>' +
        // Ringkasan ketersediaan kamar
        '<p class="font-body-sm text-body-sm text-ink-muted flex items-center gap-xs mb-md">' +
          '<span class="material-symbols-outlined text-[16px]">meeting_room</span>' +
          cabang.kamar_tersedia + ' dari ' + cabang.total_kamar + ' kamar siap huni' +
        '</p>' +
        '<div class="mt-auto pt-sm border-t border-border-hairline flex items-center justify-between">' +
          '<span class="font-title-md text-title-md text-primary">' + formatRupiahSingkat(cabang.harga_harian) +
            '<span class="font-body-sm text-ink-muted font-normal">/hari</span>' +
            '<span class="font-body-sm text-ink-muted font-normal block">' + formatRupiahSingkat(cabang.harga_bulanan) + '/bln</span>' +
          '</span>' +
          '<button class="font-button-md text-button-md px-sm py-xs rounded transition-colors ' + gayaTombol + '">' + teksTombol + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// =====================================================================
// 4. MENAMPILKAN DAFTAR CABANG SESUAI FILTER YANG DIPILIH
// =====================================================================
function tampilkanCabang(daftarCabang) {
  if (daftarCabang.length === 0) {
    tampilkanPesan('search_off', 'Cabang tidak ditemukan',
      'Tidak ada cabang yang cocok dengan filter yang Anda pilih. Coba ubah pilihan cabang.');
    if (infoJumlah) infoJumlah.textContent = 'Menampilkan 0 cabang';
    return;
  }

  wadahKartu.innerHTML = daftarCabang.map(buatKartuCabang).join('');

  if (infoJumlah) {
    const totalKamarTersedia = daftarCabang.reduce(function (jumlah, cabang) {
      return jumlah + cabang.kamar_tersedia;
    }, 0);

    infoJumlah.textContent =
      'Menampilkan ' + daftarCabang.length + ' dari ' + semuaCabang.length +
      ' cabang — total ' + totalKamarTersedia + ' kamar tersedia';
  }

  // Klik kartu -> buka halaman detail dengan membawa ID cabang
  wadahKartu.querySelectorAll('.room-card').forEach(function (kartu) {
    if (kartu.dataset.penuh === '1') return; // cabang penuh tidak bisa dibuka

    kartu.addEventListener('click', function () {
      // Tipe sewa dan tanggal diambil dari panel filter, bukan dari
      // alamat halaman ini, supaya perubahan yang baru saja dipilih
      // pengunjung ikut terbawa.
      const bulanan = tipeSewaTerpilih() === 'bulanan';

      let alamat = 'room-detail.html?cabang=' + encodeURIComponent(kartu.dataset.cabangId) +
        '&tipe=' + encodeURIComponent(tipeSewaTerpilih());

      const pilihan = bacaKolomTanggal(ID_MULAI, ID_SELESAI);
      pilihan.durasi = (bulanan && pilihanDurasi) ? Number(pilihanDurasi.value) : 0;
      alamat += rangkaiPilihanTanggal(pilihan);

      window.location.href = alamat;
    });
  });
}

// =====================================================================
// 5. PERILAKU PANEL MENGIKUTI TIPE SEWA
// =====================================================================

/** Tipe sewa yang sedang dipilih: 'harian' atau 'bulanan'. */
function tipeSewaTerpilih() {
  const terpilih = document.querySelector('input[name="rentalType"]:checked');
  return terpilih && terpilih.value === 'bulanan' ? 'bulanan' : 'harian';
}

/**
 * Menyesuaikan panel dengan tipe sewa:
 *
 *   harian  -> kolom durasi disembunyikan, tanggal selesai diisi sendiri
 *   bulanan -> kolom durasi muncul, tanggal selesai dikunci karena
 *              dihitung otomatis dari durasi
 */
function perbaruiTampilanTipeSewa() {
  const bulanan = tipeSewaTerpilih() === 'bulanan';
  const kolomSelesai = document.getElementById(ID_SELESAI);

  if (grupDurasi) {
    grupDurasi.classList.toggle('hidden', !bulanan);
    grupDurasi.classList.toggle('flex', bulanan);
  }

  if (kolomSelesai) {
    kolomSelesai.disabled = bulanan;
    kolomSelesai.classList.toggle('cursor-not-allowed', bulanan);
    kolomSelesai.classList.toggle('opacity-70', bulanan);
  }
}

/**
 * Menghitung tanggal selesai sewa bulanan dari tanggal mulai ditambah
 * durasi yang dipilih. Pada sewa harian tanggal selesai diisi sendiri
 * oleh pengunjung, jadi tidak boleh ditimpa.
 */
function hitungTanggalSelesai() {
  const kolomMulai = document.getElementById(ID_MULAI);
  const kolomSelesai = document.getElementById(ID_SELESAI);

  if (!kolomMulai || !kolomSelesai || tipeSewaTerpilih() !== 'bulanan') return;

  kolomSelesai.value = akhirSewaBulanan(
    kolomMulai.value,
    pilihanDurasi ? pilihanDurasi.value : 1
  );
}

/**
 * Berpindah tipe sewa: isian tanggal dan durasi dikosongkan, karena
 * isian sewa harian dan bulanan punya arti yang berbeda.
 *
 * Berbeda dengan panel Beranda, "Pilih Cabang" di sini SENGAJA tidak
 * ikut dikosongkan. Di halaman ini pilihan cabang benar-benar menyaring
 * daftar yang sedang tampil, dan tidak ada hubungannya dengan tipe
 * sewa; mengosongkannya akan membatalkan penyaringan yang baru saja
 * dipilih pengunjung tanpa alasan yang jelas.
 */
function gantiTipeSewa() {
  const kolomMulai = document.getElementById(ID_MULAI);
  const kolomSelesai = document.getElementById(ID_SELESAI);

  if (pilihanDurasi) pilihanDurasi.selectedIndex = 0;
  if (kolomMulai) kolomMulai.value = '';
  if (kolomSelesai) kolomSelesai.value = '';

  // Memasang ulang batas minimal hari ini pada kedua kolom
  isiKolomTanggal(ID_MULAI, ID_SELESAI, {});
  perbaruiTampilanTipeSewa();
}

// =====================================================================
// 6. MENJALANKAN FILTER
// =====================================================================
function terapkanFilter() {
  const cabangDipilih = pilihanCabang ? pilihanCabang.value : 'semua';

  const hasil = semuaCabang.filter(function (cabang) {
    return cabangDipilih === 'semua' || cabang.id === cabangDipilih;
  });

  tampilkanCabang(hasil);
}

// =====================================================================
// 7. MENGISI PILIHAN CABANG SECARA OTOMATIS DARI DATA FIRESTORE
// =====================================================================
function isiPilihanCabang() {
  if (!pilihanCabang) return;

  pilihanCabang.innerHTML =
    '<option value="semua">Semua Cabang</option>' +
    semuaCabang.map(function (cabang) {
      return '<option value="' + cabang.id + '">' + cabang.nama_cabang + '</option>';
    }).join('');

  // Bila halaman dibuka dari beranda dengan alamat catalogue.html?cabang=xxx,
  // filter langsung disesuaikan dengan cabang yang diklik.
  const paramCabang = new URLSearchParams(window.location.search).get('cabang');
  const ada = semuaCabang.some(function (cabang) { return cabang.id === paramCabang; });
  if (ada) {
    pilihanCabang.value = paramCabang;
  }
}

// =====================================================================
// 8. PROSES UTAMA
// =====================================================================
async function muatKatalog() {
  tampilkanLoading();

  try {
    semuaCabang = await ambilCabangDenganKetersediaan();

    if (semuaCabang.length === 0) {
      tampilkanPesan('inbox', 'Belum ada data cabang',
        'Collection "cabang" masih kosong. Silakan isi data terlebih dahulu melalui halaman seeding.');
      if (infoJumlah) infoJumlah.textContent = '';
      return;
    }

    isiPilihanCabang();
    terapkanFilter();

  } catch (err) {
    console.error('Gagal memuat katalog:', err);
    tampilkanPesan('cloud_off', 'Gagal memuat data',
      'Tidak dapat mengambil data dari server. Periksa koneksi internet Anda, lalu muat ulang halaman.');
    if (infoJumlah) infoJumlah.textContent = '';
  }
}

// =====================================================================
// 9. PEMASANGAN AKSI FILTER
// =====================================================================

// Tipe sewa yang dibawa dari beranda menentukan pilihan awal panel ini.
if (tipeSewaDibawa === 'bulanan' || tipeSewaDibawa === 'harian') {
  const radio = document.querySelector(
    'input[name="rentalType"][value="' + tipeSewaDibawa + '"]');
  if (radio) radio.checked = true;
}

// Kolom tanggal diisi dengan pilihan yang dibawa dari beranda, sekaligus
// dipasangi batas minimal hari ini.
isiKolomTanggal(ID_MULAI, ID_SELESAI, tanggalDibawa);
perbaruiTampilanTipeSewa();

// Tanggal selesai bulanan yang dibawa dari beranda dihitung ulang di
// sini, supaya durasi yang tampil dan tanggalnya selalu sejalan.
if (tipeSewaTerpilih() === 'bulanan') {
  if (pilihanDurasi && tanggalDibawa.durasi > 0) {
    pilihanDurasi.value = String(tanggalDibawa.durasi);
  }
  hitungTanggalSelesai();
}

const kolomMulai = document.getElementById(ID_MULAI);
if (kolomMulai) {
  kolomMulai.addEventListener('change', function () {
    isiKolomTanggal(ID_MULAI, ID_SELESAI, { mulai: kolomMulai.value });

    // Sewa harian: tanggal selesai yang jadi lebih awal daripada tanggal
    // mulai dikosongkan, supaya tidak terbawa sebagai isian yang salah.
    const kolomSelesai = document.getElementById(ID_SELESAI);
    if (tipeSewaTerpilih() === 'harian' && kolomSelesai &&
        kolomSelesai.value && kolomSelesai.value <= kolomMulai.value) {
      kolomSelesai.value = '';
    }

    hitungTanggalSelesai();
  });
}

// Mengubah durasi langsung menggeser tanggal selesai
if (pilihanDurasi) {
  pilihanDurasi.addEventListener('change', hitungTanggalSelesai);
}

// Berpindah tipe sewa mengosongkan isian tanggal & durasi
document.querySelectorAll('input[name="rentalType"]').forEach(function (radio) {
  radio.addEventListener('change', gantiTipeSewa);
});

if (tombolFilter) {
  tombolFilter.addEventListener('click', terapkanFilter);
}

// Filter juga langsung berjalan saat pilihan diubah, tanpa menunggu tombol
if (pilihanCabang) {
  pilihanCabang.addEventListener('change', terapkanFilter);
}

muatKatalog();
