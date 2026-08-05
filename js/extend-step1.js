/**
 * =====================================================================
 * PERPANJANGAN SEWA - LANGKAH 1 (customer/extend/step-1.html)
 * =====================================================================
 * Menampilkan ringkasan perpanjangan yang dipilih di dashboard, lalu
 * membuat transaksi QRIS ke Midtrans -- persis seperti alur pemesanan
 * biasa pada order/step-2.js.
 *
 * Nominal yang dikirim ke Midtrans diambil dari hasil perhitungan di
 * localStorage ("extensionData"), bukan dari teks yang tampil di layar.
 * =====================================================================
 */

import { formatRupiah } from '../js/format.js';
import { gambarPilihanMetode, ambilMetode, infoMetode } from '../js/metode-bayar.js';

const API_BASE = '';

let data = null;

function isi(id, nilai) {
  const el = document.getElementById(id);
  if (el) el.textContent = nilai;
}

function formatTanggal(teks) {
  if (!teks) return '-';
  const d = new Date(teks + 'T00:00:00');
  if (isNaN(d.getTime())) return '-';

  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

// =====================================================================
// MENAMPILKAN RINGKASAN
// =====================================================================
function tampilkanRingkasan() {
  isi('summaryRoomName', data.kamarId ? 'Kamar ' + data.kamarId : data.namaCabang);
  isi('summaryBranch', data.namaCabang);
  isi('summaryCurrentEnd', formatTanggal(data.checkin));   // akhir periode lama
  isi('summaryNewEnd', formatTanggal(data.checkout));      // akhir periode baru
  isi('summaryDuration', data.durasi + ' ' + data.satuanDurasi);

  isi('summarySewaLabel', 'Sewa Kamar (' + data.durasi + ' ' + data.satuanDurasi + ')');
  isi('summarySewaValue', formatRupiah(data.hargaSewa));
  isi('summaryTotalValue', formatRupiah(data.total));
}

// =====================================================================
// PEMBUATAN TRANSAKSI QRIS
// =====================================================================
function setLoading(sedangProses) {
  const tombol = document.getElementById('lanjutStep2Btn');
  if (!tombol) return;

  tombol.disabled = sedangProses;
  tombol.classList.toggle('opacity-60', sedangProses);
  tombol.classList.toggle('cursor-not-allowed', sedangProses);
}

function tampilkanError(pesan) {
  const kotak = document.getElementById('paymentErrorAlert');
  isi('paymentErrorText', pesan);
  if (kotak) {
    kotak.classList.remove('hidden');
    kotak.classList.add('flex');
  }
}

function sembunyikanError() {
  const kotak = document.getElementById('paymentErrorAlert');
  if (kotak) {
    kotak.classList.add('hidden');
    kotak.classList.remove('flex');
  }
}

async function prosesPembayaran() {
  sembunyikanError();
  setLoading(true);

  try {
    const total = Number(data.total || 0);
    if (!total || total <= 0) {
      throw new Error('Total perpanjangan tidak valid. Silakan ulangi dari halaman profil.');
    }

    // Metode dibaca dari pilihan yang barusan disimpan pada halaman ini
    const metode = ambilMetode();

    const tanggapan = await fetch(API_BASE + '/api/create-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: data.namaPenyewa || 'Penyewa',
        whatsapp: String(data.kontakPenyewa || '').replace(/[^0-9]/g, '').replace(/^62/, ''),
        kamar: 'Perpanjangan ' + data.namaCabang +
               (data.kamarId ? ' - Kamar ' + data.kamarId : ''),
        total: total,
        metode: metode
      })
    });

    const hasil = await tanggapan.json();

    if (!tanggapan.ok) {
      throw new Error(hasil.error ||
        'Gagal membuat transaksi ' + infoMetode(metode).singkat + '.');
    }

    // Dipakai halaman step-2 untuk menampilkan QR dan memantau statusnya
    localStorage.setItem('dataPembayaranPerpanjangan', JSON.stringify(hasil));
    window.location.href = 'step-2.html';

  } catch (err) {
    setLoading(false);
    tampilkanError(
      err.message === 'Failed to fetch'
        ? 'Tidak dapat menghubungi server. Jalankan "node server.js" lalu buka lewat http://localhost:3000'
        : err.message
    );
  }
}

// =====================================================================
// PROSES UTAMA
// =====================================================================
function mulai() {
  const mentah = localStorage.getItem('extensionData');
  data = mentah ? JSON.parse(mentah) : null;

  if (!data || !data.orderIdLama) {
    alert('Data perpanjangan tidak ditemukan. Anda akan diarahkan kembali ke halaman profil.');
    window.location.href = '../cust-profile.html';
    return;
  }

  tampilkanRingkasan();

  // Pilihan metode pembayaran digambar dari js/metode-bayar.js, sama
  // persis dengan yang dipakai Form Order.
  gambarPilihanMetode(document.getElementById('payment-accordion-container'));

  const tombol = document.getElementById('lanjutStep2Btn');
  if (tombol) {
    tombol.addEventListener('click', function (e) {
      e.preventDefault();
      prosesPembayaran();
    });
  }
}

mulai();
