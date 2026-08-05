/**
 * =====================================================================
 * PERPANJANGAN SEWA - LANGKAH 3 (customer/extend/step-3.html)
 * =====================================================================
 * Menampilkan bukti perpanjangan berdasarkan dua data di localStorage:
 *   extensionData                 -> pilihan durasi & periode baru
 *   dataPembayaranPerpanjangan    -> hasil transaksi dari Midtrans
 * =====================================================================
 */

import { formatRupiah } from '../js/format.js';
import { infoMetode } from '../js/metode-bayar.js';

function isi(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

function formatTanggal(teks) {
  if (!teks) return '-';
  const d = new Date(teks + 'T00:00:00');
  if (isNaN(d.getTime())) return '-';

  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

function formatWaktuMidtrans(teks) {
  if (!teks) return '-';
  const w = new Date(String(teks).replace(' ', 'T') + '+07:00');
  if (isNaN(w.getTime())) return '-';

  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return w.getDate() + ' ' + bulan[w.getMonth()] + ' ' + w.getFullYear() + ', ' +
         String(w.getHours()).padStart(2, '0') + ':' +
         String(w.getMinutes()).padStart(2, '0') + ' WIB';
}

/**
 * Menyebutkan metode pembayaran yang dipakai.
 *
 * Yang diutamakan adalah field "metode" dari /api/create-transaction
 * karena menyebut banknya sekaligus (misalnya "BNI Virtual Account").
 * payment_type dari Midtrans hanya dipakai sebagai cadangan, sebab
 * nilainya cuma "bank_transfer" tanpa keterangan bank.
 */
function labelMetodeBayar(bayar) {
  if (bayar && bayar.metode) return infoMetode(bayar.metode).label;

  return {
    qris: 'QRIS',
    bank_transfer: 'Virtual Account',
    echannel: 'Virtual Account',
    credit_card: 'Kartu Kredit'
  }[bayar && bayar.payment_type] || 'QRIS';
}

function mulai() {
  const data = JSON.parse(localStorage.getItem('extensionData') || 'null');
  const bayar = JSON.parse(localStorage.getItem('dataPembayaranPerpanjangan') || 'null');

  if (!data) {
    alert('Data perpanjangan tidak ditemukan. Anda akan diarahkan kembali ke halaman profil.');
    window.location.href = '../cust-profile.html';
    return;
  }

  // --- Detail transaksi ---
  if (bayar) {
    isi('invoiceIdValue', bayar.order_id || '-');
    isi('transactionDateValue', formatWaktuMidtrans(bayar.settlement_time));
    isi('paymentMethodValue', labelMetodeBayar(bayar));
    isi('paymentStatusValue', 'LUNAS');
  }

  // --- Ringkasan perpanjangan ---
  const namaKamar = data.kamarId ? 'Kamar ' + data.kamarId : data.namaCabang;

  isi('confirmRoomName', namaKamar);
  isi('confirmOldPeriod', 'Berakhir ' + formatTanggal(data.checkin));
  isi('confirmNewPeriod', 'Diperpanjang sampai ' + formatTanggal(data.checkout));
  isi('confirmNote', data.catatan || 'Tidak ada catatan');

  isi('summaryRoomName', namaKamar);
  isi('summaryBranch', data.namaCabang);
  isi('summaryOldEnd', formatTanggal(data.checkin));
  isi('summaryNewEnd', formatTanggal(data.checkout));
  isi('summaryDuration', data.durasi + ' ' + data.satuanDurasi);

  isi('hargaSewaLabel', 'Sewa Kamar (' + data.durasi + ' ' + data.satuanDurasi + ')');
  isi('hargaSewaValue', formatRupiah(data.hargaSewa));
  isi('totalPembayaranValue', formatRupiah(data.total));

  // --- Tombol kembali ---
  const tombolKembali = document.getElementById('backToProfileBtn');
  if (tombolKembali) {
    tombolKembali.addEventListener('click', function (e) {
      e.preventDefault();
      // Data perpanjangan dibersihkan agar tidak terbawa ke sesi berikutnya
      localStorage.removeItem('extensionData');
      localStorage.removeItem('dataPembayaranPerpanjangan');
      window.location.href = '../cust-profile.html';
    });
  }
}

mulai();
