/**
 * =====================================================================
 * FORM PEMESANAN - LANGKAH 3 (customer/order/step-3.html)
 * =====================================================================
 * Halaman pembayaran. Seluruh tampilan dan pengecekan statusnya
 * dikerjakan js/pembayaran.js, yang juga dipakai Form Perpanjang --
 * sehingga kedua form benar-benar sama.
 *
 * Yang khusus untuk pemesanan hanyalah dua hal:
 *   1. Data pembayaran dibaca dari localStorage "dataPembayaran"
 *   2. Setelah lunas, pesanan dicatat ke Firestore lewat
 *      window.simpanPesananKeDatabase() dari order-step3-simpan.js
 * =====================================================================
 */

import { mulaiPembayaran } from './pembayaran.js';

// Diimpor karena efeknya: berkas ini memasang window.simpanPesananKeDatabase
import './order-step3-simpan.js';

mulaiPembayaran({
  kunciData: 'dataPembayaran',
  idKartu: 'kartuPembayaran',
  idCara: 'caraPembayaran',
  idModal: 'paymentSuccessModal',
  pesanKembali: 'Data pembayaran tidak ditemukan. Silakan ulangi pemesanan dari langkah sebelumnya.',

  saatLunas: function () {
    if (typeof window.simpanPesananKeDatabase === 'function') {
      window.simpanPesananKeDatabase();
    }
  }
});

// Tombol pada modal "Pembayaran Berhasil"
const tombolLanjut = document.getElementById('goToStep4Btn');
if (tombolLanjut) {
  tombolLanjut.addEventListener('click', function () {
    window.location.href = 'step-4.html';
  });
}
