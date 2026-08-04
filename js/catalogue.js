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
 * Filter "Tipe Sewa" dan "Tanggal" pada sisi kiri sengaja dibiarkan
 * apa adanya untuk sementara. Setiap kamar bisa disewa harian maupun
 * bulanan, sehingga tipe sewa tidak membedakan cabang; sedangkan
 * penyaringan tanggal memerlukan data kalender pemesanan yang belum
 * ada pada prototipe ini.
 * =====================================================================
 */

import { ambilCabangDenganKetersediaan } from '../js/customer-data.js';
import { formatRupiahSingkat } from '../js/format.js';

const wadahKartu = document.getElementById('katalogGrid');
const pilihanCabang = document.getElementById('filterCabang');
const tombolFilter = document.getElementById('btnTerapkanFilter');
const infoJumlah = document.getElementById('infoJumlahKamar');

// Menyimpan seluruh data cabang agar filter tidak perlu memuat ulang dari server
let semuaCabang = [];

// Tipe sewa yang dibawa dari beranda, contoh: catalogue.html?tipe=bulanan
const tipeSewaDibawa = new URLSearchParams(window.location.search).get('tipe') || '';

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
      let alamat = 'room-detail.html?cabang=' + encodeURIComponent(kartu.dataset.cabangId);

      // Bawa juga tipe sewa bila pengunjung datang dari beranda
      if (tipeSewaDibawa) {
        alamat += '&tipe=' + encodeURIComponent(tipeSewaDibawa);
      }
      window.location.href = alamat;
    });
  });
}

// =====================================================================
// 5. MENJALANKAN FILTER
// =====================================================================
function terapkanFilter() {
  const cabangDipilih = pilihanCabang ? pilihanCabang.value : 'semua';

  const hasil = semuaCabang.filter(function (cabang) {
    return cabangDipilih === 'semua' || cabang.id === cabangDipilih;
  });

  tampilkanCabang(hasil);
}

// =====================================================================
// 6. MENGISI PILIHAN CABANG SECARA OTOMATIS DARI DATA FIRESTORE
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
// 7. PROSES UTAMA
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
// 8. PEMASANGAN AKSI FILTER
// =====================================================================
if (tombolFilter) {
  tombolFilter.addEventListener('click', terapkanFilter);
}

// Filter juga langsung berjalan saat pilihan diubah, tanpa menunggu tombol
if (pilihanCabang) {
  pilihanCabang.addEventListener('change', terapkanFilter);
}

muatKatalog();
