/**
 * =====================================================================
 * HALAMAN BERANDA (index.html)
 * Menampilkan pratinjau katalog: 1 kartu mewakili 1 CABANG kos
 * =====================================================================
 * Alur:
 *   1. Ambil seluruh cabang beserta hitungan kamarnya
 *   2. Tampilkan ringkasan tiap cabang (harga, sisa kamar)
 *   3. Kartu diklik -> room-detail.html?cabang=<id cabang>
 *
 * Cabang yang seluruh kamarnya terisi ditandai "Penuh" dan tidak
 * bisa diklik untuk memesan.
 * =====================================================================
 */

import { ambilCabangDenganKetersediaan } from './customer-data.js';
import { formatRupiahSingkat } from './format.js';

const wadahKartu = document.getElementById('katalogPreviewGrid');
const pilihanCabang = document.getElementById('filterCabangBeranda');
const tombolCari = document.getElementById('searchKamarBtn');
const tombolLihatSemua = document.getElementById('viewAllRoomsBtn');
const tabHarian = document.getElementById('tab-harian');
const tabBulanan = document.getElementById('tab-bulanan');

let daftarCabang = [];
let modeSewa = 'harian';

// =====================================================================
// 1. TAMPILAN SEMENTARA
// =====================================================================
function tampilkanLoading() {
  let html = '';
  for (let i = 0; i < 4; i++) {
    html +=
      '<div class="bg-surface-canvas rounded-2xl border border-border-hairline shadow-sm overflow-hidden flex flex-col animate-pulse">' +
      '<div class="h-64 w-full bg-surface-variant"></div>' +
      '<div class="p-lg flex flex-col gap-md">' +
      '<div class="h-3 w-1/2 bg-surface-variant rounded"></div>' +
      '<div class="h-5 w-3/4 bg-surface-variant rounded"></div>' +
      '<div class="h-8 w-1/3 bg-surface-variant rounded mt-md"></div>' +
      '</div></div>';
  }
  wadahKartu.innerHTML = html;
}

function tampilkanPesan(ikon, judul, keterangan) {
  wadahKartu.innerHTML =
    '<div class="col-span-full flex flex-col items-center justify-center text-center py-section gap-sm">' +
    '<span class="material-symbols-outlined text-[48px] text-ink-muted">' + ikon + '</span>' +
    '<p class="font-display-md text-display-md text-ink-primary">' + judul + '</p>' +
    '<p class="font-body-md text-body-md text-ink-muted max-w-md">' + keterangan + '</p>' +
    '</div>';
}

// =====================================================================
// 2. MEMBUAT HTML SATU KARTU CABANG
//    Kelas CSS dibuat sama persis dengan desain awal halaman
// =====================================================================
function buatKartuCabang(cabang) {
  const penuh = cabang.kamar_tersedia === 0;

  const badgeStatus = penuh
    ? '<div class="absolute top-md right-md bg-white/90 backdrop-blur-sm text-status-occupied font-badge text-badge px-md py-sm rounded-full shadow-sm">Penuh</div>'
    : '<div class="absolute top-md right-md bg-white/90 backdrop-blur-sm text-status-available font-badge text-badge px-md py-sm rounded-full shadow-sm">' +
      cabang.kamar_tersedia + ' Kamar Tersedia</div>';

  // Cabang penuh tampil lebih redup dan tidak bisa diklik
  const gayaKartu = penuh
    ? 'opacity-75 cursor-not-allowed'
    : 'cursor-pointer hover:shadow-lg';

  return '' +
    '<div class="room-card bg-surface-canvas rounded-2xl border border-border-hairline shadow-sm overflow-hidden flex flex-col group transition-all duration-300 ' + gayaKartu + '" ' +
      'data-cabang-id="' + cabang.id + '" data-penuh="' + (penuh ? '1' : '0') + '">' +
      '<div class="relative h-64 w-full overflow-hidden">' +
        '<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" alt="' + cabang.nama_cabang + '" src="' + cabang.gambar_url + '">' +
        badgeStatus +
        '<div class="absolute bottom-md left-md bg-white/90 backdrop-blur-sm px-sm py-xs rounded-md font-tag-uppercase text-tag-uppercase text-ink-primary shadow-sm">HARIAN / BULANAN</div>' +
      '</div>' +
      '<div class="p-lg flex flex-col flex-grow">' +
        '<div class="flex items-center gap-xs text-ink-muted font-label-md text-[12px] mb-sm">' +
          '<span class="material-symbols-outlined text-[16px]">location_on</span> ' + cabang.alamat +
        '</div>' +
        '<h3 class="font-display-md text-display-md text-ink-primary mb-sm">' + cabang.nama_cabang + '</h3>' +
        // Ringkasan ketersediaan kamar
        '<div class="flex items-center gap-xs text-ink-muted font-body-sm text-[13px] mb-md">' +
          '<span class="material-symbols-outlined text-[16px]">meeting_room</span> ' +
          cabang.kamar_tersedia + ' dari ' + cabang.total_kamar + ' kamar siap huni' +
        '</div>' +
        '<div class="mt-auto flex justify-between items-end">' +
          '<div>' +
            '<span class="text-ink-muted text-[12px] block mb-xs">Mulai dari</span>' +
            '<div class="font-display-md text-ink-primary font-bold">' + formatRupiahSingkat(cabang.harga_harian) +
              '<span class="text-ink-muted font-normal text-body-sm">/hari</span>' +
            '</div>' +
            '<span class="text-ink-muted text-[12px]">' + formatRupiahSingkat(cabang.harga_bulanan) + '/bln</span>' +
          '</div>' +
          '<div class="w-10 h-10 rounded-full bg-surface-soft flex items-center justify-center group-hover:bg-ink-primary group-hover:text-white transition-colors">' +
            '<span class="material-symbols-outlined">arrow_forward</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// =====================================================================
// 3. MENAMPILKAN DAFTAR CABANG
// =====================================================================
function tampilkanCabang() {
  if (daftarCabang.length === 0) {
    tampilkanPesan('inbox', 'Belum ada data cabang',
      'Collection "cabang" masih kosong. Silakan isi data terlebih dahulu melalui halaman seeding.');
    return;
  }

  // Beranda hanya menampilkan pratinjau, maksimal 4 cabang
  wadahKartu.innerHTML = daftarCabang.slice(0, 4).map(buatKartuCabang).join('');

  wadahKartu.querySelectorAll('.room-card').forEach(function (kartu) {
    if (kartu.dataset.penuh === '1') return; // cabang penuh tidak bisa dibuka

    kartu.addEventListener('click', function () {
      bukaDetailCabang(kartu.dataset.cabangId);
    });
  });
}

// =====================================================================
// 4. PANEL PENCARIAN DI ATAS HALAMAN
// =====================================================================

function isiPilihanCabang() {
  if (!pilihanCabang) return;

  pilihanCabang.innerHTML =
    '<option value="semua">Semua Cabang</option>' +
    daftarCabang.map(function (cabang) {
      const tanda = cabang.kamar_tersedia === 0 ? ' (Penuh)' : '';
      return '<option value="' + cabang.id + '">' + cabang.nama_cabang + tanda + '</option>';
    }).join('');
}

/** Membuka halaman detail sambil membawa pilihan tipe sewa dari beranda. */
function bukaDetailCabang(idCabang) {
  window.location.href =
    'customer/room-detail.html?cabang=' + encodeURIComponent(idCabang) +
    '&tipe=' + encodeURIComponent(modeSewa);
}

function pasangAksiPanelPencarian() {
  // Tab Harian / Bulanan.
  // Tampilan tombol dan isi pilihan durasi diatur oleh script bawaan
  // index.html; di sini kita hanya mencatat tipe sewa yang dipilih
  // agar bisa dibawa ke halaman berikutnya.
  if (tabHarian) {
    tabHarian.addEventListener('click', function () { modeSewa = 'harian'; });
  }
  if (tabBulanan) {
    tabBulanan.addEventListener('click', function () { modeSewa = 'bulanan'; });
  }

  // Tombol "Cari Kamar": langsung ke detail bila cabang sudah dipilih,
  // kalau belum dipilih diarahkan ke katalog lengkap.
  if (tombolCari) {
    tombolCari.addEventListener('click', function () {
      const dipilih = pilihanCabang ? pilihanCabang.value : 'semua';

      if (dipilih && dipilih !== 'semua') {
        bukaDetailCabang(dipilih);
      } else {
        window.location.href = 'customer/catalogue.html?tipe=' + encodeURIComponent(modeSewa);
      }
    });
  }

  if (tombolLihatSemua) {
    tombolLihatSemua.addEventListener('click', function () {
      window.location.href = 'customer/catalogue.html';
    });
  }
}

// =====================================================================
// 5. PROSES UTAMA
// =====================================================================
async function muatBeranda() {
  tampilkanLoading();
  pasangAksiPanelPencarian();

  try {
    daftarCabang = await ambilCabangDenganKetersediaan();
    isiPilihanCabang();
    tampilkanCabang();
  } catch (err) {
    console.error('Gagal memuat data cabang:', err);
    tampilkanPesan('cloud_off', 'Gagal memuat data',
      'Tidak dapat mengambil data dari server. Periksa koneksi internet Anda, lalu muat ulang halaman.');
  }
}

muatBeranda();
