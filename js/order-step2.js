/**
 * =====================================================================
 * FORM PEMESANAN - LANGKAH 2 (customer/order/step-2.html)
 * =====================================================================
 * Halaman ini menampilkan ulang seluruh data yang sudah diisi supaya
 * pengunjung bisa memeriksanya, lalu membuat transaksi QRIS ke
 * Midtrans Sandbox melalui /api/create-transaction.
 *
 * Catatan penting:
 * Nominal yang dikirim ke Midtrans diambil dari hasil perhitungan di
 * localStorage ("bookingData"), BUKAN dari teks yang tampil di layar.
 * Dengan begitu jumlah yang ditagih pasti sama dengan yang dihitung.
 * =====================================================================
 */

import { formatRupiah } from '../js/format.js';

// Biarkan kosong bila halaman dibuka lewat server lokal
// (jalankan "node server.js" lalu buka http://localhost:3000).
const API_BASE = '';

let bookingData = null;
let identityData = null;

// =====================================================================
// 1. FUNGSI BANTU
// =====================================================================

function isiTeks(id, nilai) {
  const elemen = document.getElementById(id);
  if (elemen) elemen.textContent = nilai;
}

function formatTanggal(teksTanggal) {
  if (!teksTanggal) return '-';
  const tanggal = new Date(teksTanggal + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return '-';

  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return tanggal.getDate() + ' ' + bulan[tanggal.getMonth()] + ' ' + tanggal.getFullYear();
}

// =====================================================================
// 2. MENAMPILKAN DATA PENYEWA
// =====================================================================
function kartuPenghuniHtml(penghuni, urutan) {
  const labelHubungan = { suami: 'Suami', istri: 'Istri', anak: 'Anak' }[penghuni.hubungan] || '-';

  return '' +
    '<div class="pb-md border-b border-border-hairline last:border-0 last:pb-0">' +
      '<p class="font-label-md text-label-md text-ink-primary font-bold mb-sm">Penghuni Tambahan ' + urutan + '</p>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-md">' +
        '<div><p class="font-label-md text-label-md text-ink-muted mb-xxs">Nama Lengkap</p>' +
          '<p class="font-body-md text-body-md text-ink-primary font-medium">' + (penghuni.nama || '-') + '</p></div>' +
        '<div><p class="font-label-md text-label-md text-ink-muted mb-xxs">NIK (Nomor Induk Kependudukan)</p>' +
          '<p class="font-body-md text-body-md text-ink-primary font-medium">' + (penghuni.nik || '-') + '</p></div>' +
        '<div><p class="font-label-md text-label-md text-ink-muted mb-xxs">Hubungan</p>' +
          '<p class="font-body-md text-body-md text-ink-primary font-medium">' + labelHubungan + '</p></div>' +
        '<div><p class="font-label-md text-label-md text-ink-muted mb-xxs">Nomor WhatsApp</p>' +
          '<p class="font-body-md text-body-md text-ink-primary font-medium">+62 ' + (penghuni.whatsapp || '-') + '</p></div>' +
      '</div>' +
    '</div>';
}

function tampilkanIdentitas() {
  isiTeks('reviewNama', identityData.nama || '-');
  isiTeks('reviewNik', identityData.nik || '-');
  isiTeks('reviewWhatsapp', '+62 ' + (identityData.whatsapp || '-'));

  const penghuni = identityData.tenants || [];
  const bagian = document.getElementById('tenantsReviewSection');
  const wadah = document.getElementById('tenantsReviewContainer');

  if (penghuni.length > 0 && wadah) {
    wadah.innerHTML = penghuni.map(function (orang, urutan) {
      return kartuPenghuniHtml(orang, urutan + 1);
    }).join('');
  } else if (bagian) {
    bagian.classList.add('hidden');
  }
}

// =====================================================================
// 3. MENAMPILKAN RINGKASAN PESANAN
// =====================================================================
function tampilkanRingkasan() {
  const bulanan = bookingData.tipeSewa === 'bulanan';

  isiTeks('orderTypeBadge', bulanan ? 'SEWA BULANAN' : 'SEWA HARIAN');
  isiTeks('summaryRoomName', bookingData.namaCabang || '-');
  isiTeks('summaryRoomAddress', bookingData.alamatCabang || '-');
  isiTeks('summaryCheckin', formatTanggal(bookingData.checkin));
  isiTeks('summaryCheckout', formatTanggal(bookingData.checkout));
  isiTeks('summaryDuration', bookingData.durasi + ' ' + bookingData.satuanDurasi);

  isiTeks('summaryHargaLabel',
    'Harga Sewa (' + bookingData.durasi + ' ' + bookingData.satuanDurasi + ')');
  isiTeks('summaryHargaValue', formatRupiah(bookingData.hargaSewa));
  isiTeks('summaryBiayaLayanan', formatRupiah(bookingData.biayaLayanan));
  isiTeks('summaryTotalValue', formatRupiah(bookingData.total));

  const gambar = document.getElementById('summaryRoomImage');
  if (gambar && bookingData.gambarCabang) {
    gambar.src = bookingData.gambarCabang;
    gambar.alt = bookingData.namaCabang;
  }
}

// =====================================================================
// 4. INTEGRASI MIDTRANS SANDBOX (QRIS)
// =====================================================================

function setLoadingTombol(sedangProses) {
  const tombol = document.getElementById('lanjutStep3Btn');
  const spinner = document.getElementById('lanjutStep3Spinner');
  const teks = document.getElementById('lanjutStep3Text');
  const panah = document.getElementById('lanjutStep3Arrow');

  tombol.disabled = sedangProses;
  spinner.classList.toggle('hidden', !sedangProses);
  panah.classList.toggle('hidden', sedangProses);
  teks.textContent = sedangProses ? 'Membuat kode QRIS...' : 'Lanjut ke Pembayaran';
}

function tampilkanError(pesan) {
  const kotak = document.getElementById('paymentErrorAlert');
  isiTeks('paymentErrorText', pesan);
  kotak.classList.remove('hidden');
  kotak.classList.add('flex');
}

function sembunyikanError() {
  const kotak = document.getElementById('paymentErrorAlert');
  kotak.classList.add('hidden');
  kotak.classList.remove('flex');
}

async function prosesPembayaranQris() {
  sembunyikanError();
  setLoadingTombol(true);

  try {
    // Nominal diambil dari hasil hitungan, bukan dari teks di layar
    const total = Number(bookingData.total || 0);

    if (!total || total <= 0) {
      throw new Error('Total pembayaran tidak valid. Silakan ulangi pemesanan dari halaman cabang.');
    }

    const dataPesanan = {
      nama: identityData.nama || 'Penyewa',
      whatsapp: identityData.whatsapp || '',
      kamar: bookingData.namaCabang + ' - Sewa ' +
             (bookingData.tipeSewa === 'bulanan' ? 'Bulanan' : 'Harian'),
      total: total
    };

    const tanggapan = await fetch(API_BASE + '/api/create-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataPesanan)
    });

    const hasil = await tanggapan.json();

    if (!tanggapan.ok) {
      throw new Error(hasil.error || 'Gagal membuat transaksi QRIS.');
    }

    localStorage.setItem('dataPembayaran', JSON.stringify(hasil));
    window.location.href = 'step-3.html';

  } catch (err) {
    setLoadingTombol(false);
    tampilkanError(
      err.message === 'Failed to fetch'
        ? 'Tidak dapat menghubungi server. Jalankan "node server.js" lalu buka halaman ini lewat http://localhost:3000'
        : err.message
    );
  }
}

// =====================================================================
// 5. PROSES UTAMA
// =====================================================================
function mulai() {
  const bookingMentah = localStorage.getItem('bookingData');
  const identityMentah = localStorage.getItem('identityData');

  bookingData = bookingMentah ? JSON.parse(bookingMentah) : null;
  identityData = identityMentah ? JSON.parse(identityMentah) : null;

  // Halaman ini tidak bisa berdiri sendiri tanpa data dari langkah sebelumnya
  if (!bookingData || !bookingData.cabangId) {
    alert('Data pemesanan tidak ditemukan. Anda akan diarahkan kembali ke katalog.');
    window.location.href = '../catalogue.html';
    return;
  }

  if (!identityData || !identityData.nama) {
    alert('Data diri belum lengkap. Anda akan diarahkan kembali ke langkah 1.');
    window.location.href = 'step-1.html';
    return;
  }

  tampilkanIdentitas();
  tampilkanRingkasan();

  const tombol = document.getElementById('lanjutStep3Btn');
  if (tombol) {
    tombol.addEventListener('click', prosesPembayaranQris);
  }
}

mulai();
