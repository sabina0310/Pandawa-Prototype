/**
 * Serverless Function: Membuat transaksi di Midtrans SANDBOX
 * -----------------------------------------------------------------
 * Endpoint : POST /api/create-transaction
 * Dokumentasi: https://docs.midtrans.com/reference/qris
 *              https://docs.midtrans.com/reference/bank-transfer
 *
 * Mendukung dua jenis pembayaran, ditentukan oleh field "metode":
 *   qris                     -> payment_type "qris"
 *   va_bca / va_bri / va_bni -> payment_type "bank_transfer"
 *
 * Menggunakan Core API (endpoint /charge), BUKAN Snap, supaya kode QR
 * maupun nomor Virtual Account bisa ditampilkan langsung di halaman
 * pembayaran tanpa popup.
 *
 * Server Key diambil dari environment variable MIDTRANS_SERVER_KEY
 * (lihat file .env.example). Server Key TIDAK BOLEH ditulis langsung
 * di dalam kode karena bersifat rahasia.
 */

const MIDTRANS_BASE_URL = 'https://api.sandbox.midtrans.com/v2';

// Metode yang dikenali beserta kode bank yang dipahami Midtrans.
// Daftar ini sengaja dibatasi: nilai di luar daftar akan ditolak,
// supaya kode bank sembarangan tidak pernah diteruskan ke Midtrans.
const METODE_DIDUKUNG = {
  qris: { jenis: 'qris', bank: null },
  va_bca: { jenis: 'bank_transfer', bank: 'bca' },
  va_bri: { jenis: 'bank_transfer', bank: 'bri' },
  va_bni: { jenis: 'bank_transfer', bank: 'bni' }
};

module.exports = async (req, res) => {
  // Izinkan pemanggilan dari halaman HTML (berguna saat pengujian lokal)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
  }

  // 1. Pastikan Server Key sudah diatur
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return res.status(500).json({
      error: 'MIDTRANS_SERVER_KEY belum diatur. Salin .env.example menjadi .env lalu isi Server Key Sandbox Anda.'
    });
  }

  try {
    // 2. Ambil data pemesanan yang dikirim halaman pemesanan/perpanjangan
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { nama, whatsapp, kamar, total } = body;

    const grossAmount = parseInt(total, 10);
    if (!nama || !kamar || !grossAmount || grossAmount <= 0) {
      return res.status(400).json({
        error: 'Data pemesanan tidak lengkap. Wajib ada: nama, kamar, dan total (angka lebih dari 0).'
      });
    }

    // Bila metode tidak disebutkan, QRIS dipakai sebagai bawaan
    const metode = body.metode || 'qris';
    const pilihan = METODE_DIDUKUNG[metode];

    if (!pilihan) {
      return res.status(400).json({
        error: 'Metode pembayaran "' + metode + '" tidak dikenali. ' +
               'Pilihan yang tersedia: ' + Object.keys(METODE_DIDUKUNG).join(', ') + '.'
      });
    }

    // 3. Buat order_id unik. Midtrans menolak order_id yang terpakai ulang.
    const orderId = 'PP-' + Date.now();

    // 4. Susun payload sesuai format Core API Midtrans
    const payload = {
      payment_type: pilihan.jenis,
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      item_details: [
        {
          id: 'SEWA-KAMAR',
          price: grossAmount,
          quantity: 1,
          name: String(kamar).substring(0, 50) // Midtrans batasi maksimal 50 karakter
        }
      ],
      customer_details: {
        first_name: String(nama).substring(0, 20) // Midtrans batasi maksimal 20 karakter
      }
    };

    // Bagian yang berbeda antara QRIS dan Virtual Account
    if (pilihan.jenis === 'qris') {
      // Catatan: "acquirer" di bawah adalah nama PENERBIT kode QR di sisi
      // Midtrans, bukan pilihan pembayaran GoPay yang dilihat pengguna.
      // Nilai ini wajib ada agar kode QR dapat dibuat, jadi tetap dipakai
      // meskipun opsi E-Wallet GoPay sudah dihapus dari seluruh halaman.
      payload.qris = { acquirer: 'gopay' };
    } else {
      payload.bank_transfer = { bank: pilihan.bank };
    }

    // Nomor WhatsApp bersifat opsional
    if (whatsapp) {
      const nomorBersih = String(whatsapp).replace(/\D/g, '');
      if (nomorBersih) {
        payload.customer_details.phone = ('+62' + nomorBersih).substring(0, 19);
      }
    }

    // 5. Autentikasi Midtrans: Basic Auth berisi base64 dari "SERVER_KEY:"
    const auth = Buffer.from(serverKey + ':').toString('base64');

    const midtransResponse = await fetch(MIDTRANS_BASE_URL + '/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Basic ' + auth
      },
      body: JSON.stringify(payload)
    });

    const data = await midtransResponse.json();

    // 6. Midtrans mengembalikan status_code diawali "2" bila transaksi berhasil dibuat
    if (!String(data.status_code || '').startsWith('2')) {
      return res.status(400).json({
        error: data.status_message || 'Gagal membuat transaksi di Midtrans.',
        detail: data
      });
    }

    // 7. URL gambar QR ada di dalam array "actions" (khusus QRIS)
    const aksiQr = (data.actions || []).find(function (aksi) {
      return aksi.name === 'generate-qr-code';
    });

    // 8. Nomor Virtual Account ada di "va_numbers" (khusus bank_transfer).
    //    Midtrans mengirimkannya sebagai array walaupun isinya satu bank.
    let nomorVa = null;
    if (pilihan.jenis === 'bank_transfer') {
      const daftarVa = data.va_numbers || [];
      const cocok = daftarVa.find(function (item) {
        return String(item.bank).toLowerCase() === pilihan.bank;
      });
      nomorVa = (cocok || daftarVa[0] || {}).va_number || null;

      if (!nomorVa) {
        return res.status(502).json({
          error: 'Midtrans tidak mengirimkan nomor Virtual Account untuk bank ' +
                 pilihan.bank.toUpperCase() + '. Periksa apakah metode ini sudah ' +
                 'diaktifkan pada dashboard Midtrans Anda.',
          detail: data
        });
      }
    }

    // 9. Kirim balik data yang dibutuhkan halaman pembayaran
    return res.status(200).json({
      order_id: data.order_id,
      transaction_id: data.transaction_id,
      transaction_status: data.transaction_status, // biasanya "pending"
      gross_amount: grossAmount,

      metode: metode,                              // qris / va_bca / va_bri / va_bni
      payment_type: data.payment_type || pilihan.jenis,
      bank: pilihan.bank,                          // null bila QRIS

      qr_url: aksiQr ? aksiQr.url : null,          // gambar QR siap pakai
      qr_string: data.qr_string || null,           // cadangan: teks QR mentah
      va_number: nomorVa,                          // null bila QRIS

      expiry_time: data.expiry_time || null,
      nama: nama,
      kamar: kamar
    });
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server: ' + err.message });
  }
};
