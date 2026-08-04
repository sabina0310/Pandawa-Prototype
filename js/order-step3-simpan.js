/**
 * =====================================================================
 * PENYIMPANAN PESANAN KE FIRESTORE (customer/order/step-3.html)
 * =====================================================================
 * Halaman step-3 mengurus tampilan QRIS dan pengecekan status
 * pembayaran. Begitu Midtrans menyatakan pembayaran LUNAS, pesanan
 * perlu dicatat ke collection "transaksi_pemesanan" supaya muncul di
 * halaman admin.
 *
 * Script pembayaran di step-3.html ditulis sebagai script biasa,
 * sedangkan Firestore memerlukan modul. Karena itu fungsi penyimpanan
 * disediakan di sini lalu dipasang ke window agar bisa dipanggil dari
 * script tersebut.
 *
 * Dokumen dibuat dengan kamar_id = null, sehingga pesanan langsung
 * masuk ke daftar "Menunggu Alokasi Kamar" pada dashboard admin.
 * =====================================================================
 */

import { simpanPesananKeFirestore } from '../js/customer-data.js';

/**
 * Dipanggil oleh step-3.html setelah status pembayaran menjadi lunas.
 * Sengaja tidak melempar error keluar: kegagalan menyimpan tidak boleh
 * menghalangi pengunjung melihat halaman bukti pemesanan.
 */
window.simpanPesananKeDatabase = async function () {
  const penanda = document.getElementById('statusSimpanDatabase');

  function tulisStatus(pesan, jenis) {
    if (!penanda) return;
    penanda.textContent = pesan;
    penanda.className = jenis === 'error'
      ? 'font-body-sm text-[12px] text-error mt-sm text-center'
      : 'font-body-sm text-[12px] text-ink-muted mt-sm text-center';
  }

  try {
    const bookingData = JSON.parse(localStorage.getItem('bookingData') || 'null');
    const identityData = JSON.parse(localStorage.getItem('identityData') || 'null');
    const dataPembayaran = JSON.parse(localStorage.getItem('dataPembayaran') || 'null');

    if (!bookingData || !identityData || !dataPembayaran) {
      tulisStatus('Pesanan tidak dapat dicatat: data pemesanan tidak lengkap.', 'error');
      return;
    }

    tulisStatus('Menyimpan pesanan ke database...');

    const hasil = await simpanPesananKeFirestore(bookingData, identityData, dataPembayaran);

    tulisStatus(hasil.dibuat
      ? 'Pesanan berhasil dicatat. Admin akan menentukan nomor kamar Anda.'
      : 'Pesanan ini sudah tercatat sebelumnya.');

  } catch (err) {
    console.error('Gagal menyimpan pesanan ke Firestore:', err);

    // Pembayaran sudah berhasil, jadi kegagalan di sini bukan hal fatal
    // bagi pengunjung. Cukup diberitahukan agar bisa dilaporkan ke admin.
    tulisStatus(
      'Pembayaran berhasil, tetapi pesanan gagal dicatat otomatis. ' +
      'Silakan tunjukkan bukti pembayaran ini kepada admin.',
      'error'
    );
  }
};
