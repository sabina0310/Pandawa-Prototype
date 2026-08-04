/**
 * =====================================================================
 * FORM PEMESANAN - LANGKAH 4 (customer/order/step-4.html)
 * =====================================================================
 * Menampilkan bukti pemesanan berdasarkan tiga data di localStorage:
 *   - bookingData     : cabang, tanggal, dan rincian biaya
 *   - identityData    : data diri penyewa & penghuni tambahan
 *   - dataPembayaran  : hasil transaksi dari Midtrans
 *
 * Isi halaman ini juga menjadi sumber teks kuitansi PDF, jadi begitu
 * elemennya terisi, kuitansinya ikut benar dengan sendirinya.
 * =====================================================================
 */

import { formatRupiah } from '../js/format.js';

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

/** Mengubah waktu Midtrans "2025-10-01 14:30:00" menjadi teks Indonesia. */
function formatWaktuMidtrans(teksWaktu) {
  if (!teksWaktu) return '-';
  const waktu = new Date(String(teksWaktu).replace(' ', 'T') + '+07:00');
  if (isNaN(waktu.getTime())) return '-';

  const jam = String(waktu.getHours()).padStart(2, '0');
  const menit = String(waktu.getMinutes()).padStart(2, '0');

  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  return waktu.getDate() + ' ' + bulan[waktu.getMonth()] + ' ' + waktu.getFullYear() +
         ', ' + jam + ':' + menit + ' WIB';
}

/** Menerjemahkan kode metode pembayaran Midtrans ke bahasa Indonesia. */
function labelMetodeBayar(kode) {
  const peta = {
    qris: 'QRIS',
    bank_transfer: 'Transfer Bank',
    gopay: 'E-Wallet (GoPay)',
    echannel: 'Virtual Account',
    credit_card: 'Kartu Kredit'
  };
  return peta[kode] || 'QRIS';
}

// =====================================================================
// PROSES UTAMA
// =====================================================================
function mulai() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData') || 'null');
  const identityData = JSON.parse(localStorage.getItem('identityData') || 'null');
  const dataPembayaran = JSON.parse(localStorage.getItem('dataPembayaran') || 'null');

  // --- Detail transaksi ---
  if (dataPembayaran) {
    isiTeks('invoiceIdValue', dataPembayaran.order_id || '-');
    isiTeks('transactionDateValue', formatWaktuMidtrans(dataPembayaran.settlement_time));
    isiTeks('paymentMethodValue', labelMetodeBayar(dataPembayaran.payment_type));
    isiTeks('paymentStatusValue', 'LUNAS');
  }

  // --- Informasi penyewa ---
  if (identityData) {
    isiTeks('confirmNama', identityData.nama || '-');
    isiTeks('confirmWhatsapp', '+62 ' + (identityData.whatsapp || '-'));
    isiTeks('confirmNik', identityData.nik || '-');

    const penghuni = identityData.tenants || [];
    isiTeks('confirmTenantsSummary',
      penghuni.length > 0 ? penghuni.length + ' orang' : 'Tidak ada');
  }

  // --- Ringkasan pesanan ---
  if (bookingData) {
    const bulanan = bookingData.tipeSewa === 'bulanan';

    isiTeks('orderTypeBadge', bulanan ? 'SEWA BULANAN' : 'SEWA HARIAN');
    isiTeks('roomNameValue', bookingData.namaCabang || '-');
    isiTeks('roomAddressValue', bookingData.alamatCabang || '-');
    isiTeks('summaryCheckin', formatTanggal(bookingData.checkin));
    isiTeks('summaryCheckout', formatTanggal(bookingData.checkout));
    isiTeks('summaryDuration', bookingData.durasi + ' ' + bookingData.satuanDurasi);

    isiTeks('hargaSewaLabel',
      'Harga Sewa (' + bookingData.durasi + ' ' + bookingData.satuanDurasi + ')');
    isiTeks('hargaSewaValue', formatRupiah(bookingData.hargaSewa));
    isiTeks('biayaLayananValue', formatRupiah(bookingData.biayaLayanan));
    isiTeks('totalPembayaranValue', formatRupiah(bookingData.total));

    const gambar = document.querySelector('.relative.h-48 img');
    if (gambar && bookingData.gambarCabang) {
      gambar.src = bookingData.gambarCabang;
      gambar.alt = bookingData.namaCabang;
    }
  }
}

mulai();
