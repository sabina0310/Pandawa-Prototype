/**
 * Serverless Function: Membuat transaksi QRIS di Midtrans SANDBOX
 * -----------------------------------------------------------------
 * Endpoint : POST /api/create-transaction
 * Dokumentasi: https://docs.midtrans.com/reference/qris
 *
 * Menggunakan Core API (endpoint /charge) dengan payment_type "qris",
 * BUKAN Snap, supaya kode QR bisa ditampilkan langsung di halaman
 * step-3.html (tanpa popup).
 *
 * Server Key diambil dari environment variable MIDTRANS_SERVER_KEY
 * (lihat file .env.example). Server Key TIDAK BOLEH ditulis langsung
 * di dalam kode karena bersifat rahasia.
 */

const MIDTRANS_BASE_URL = 'https://api.sandbox.midtrans.com/v2';

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
    // 2. Ambil data pemesanan yang dikirim dari halaman step-2.html
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { nama, whatsapp, kamar, total } = body;

    const grossAmount = parseInt(total, 10);
    if (!nama || !kamar || !grossAmount || grossAmount <= 0) {
      return res.status(400).json({
        error: 'Data pemesanan tidak lengkap. Wajib ada: nama, kamar, dan total (angka lebih dari 0).'
      });
    }

    // 3. Buat order_id unik. Midtrans menolak order_id yang terpakai ulang.
    const orderId = 'PP-' + Date.now();

    // 4. Susun payload sesuai format Core API Midtrans untuk QRIS
    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      qris: {
        acquirer: 'gopay'
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

    // 7. URL gambar QR ada di dalam array "actions"
    const aksiQr = (data.actions || []).find(function (aksi) {
      return aksi.name === 'generate-qr-code';
    });

    // 8. Kirim balik data yang dibutuhkan halaman step-3.html
    return res.status(200).json({
      order_id: data.order_id,
      transaction_id: data.transaction_id,
      transaction_status: data.transaction_status, // biasanya "pending"
      gross_amount: grossAmount,
      qr_url: aksiQr ? aksiQr.url : null,          // gambar QR siap pakai
      qr_string: data.qr_string || null,           // cadangan: teks QR mentah
      expiry_time: data.expiry_time || null,
      nama: nama,
      kamar: kamar
    });
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server: ' + err.message });
  }
};
