/**
 * Serverless Function: Mengecek status pembayaran ke Midtrans SANDBOX
 * --------------------------------------------------------------------
 * Endpoint : GET /api/check-status?order_id=PP-1234567890
 * Dokumentasi: https://docs.midtrans.com/reference/get-transaction-status
 *
 * Dipanggil berulang (polling) oleh halaman step-3.html untuk mengetahui
 * apakah pembayaran QRIS sudah masuk atau belum.
 *
 * Arti transaction_status dari Midtrans:
 *   - pending    : QR sudah dibuat, menunggu pembayaran
 *   - settlement : pembayaran berhasil (LUNAS) -> dipakai untuk QRIS
 *   - capture    : pembayaran berhasil (LUNAS) -> umumnya kartu kredit
 *   - expire     : QR kedaluwarsa
 *   - cancel     : transaksi dibatalkan
 *   - deny       : pembayaran ditolak
 */

const MIDTRANS_BASE_URL = 'https://api.sandbox.midtrans.com/v2';

module.exports = async (req, res) => {
  // Izinkan pemanggilan dari halaman HTML (berguna saat pengujian lokal)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Pastikan Server Key sudah diatur
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return res.status(500).json({
      error: 'MIDTRANS_SERVER_KEY belum diatur. Salin .env.example menjadi .env lalu isi Server Key Sandbox Anda.'
    });
  }

  // 2. Ambil order_id dari query string
  const orderId = req.query ? req.query.order_id : null;
  if (!orderId) {
    return res.status(400).json({ error: 'Parameter order_id wajib diisi.' });
  }

  try {
    // 3. Autentikasi Midtrans: Basic Auth berisi base64 dari "SERVER_KEY:"
    const auth = Buffer.from(serverKey + ':').toString('base64');

    const midtransResponse = await fetch(
      MIDTRANS_BASE_URL + '/' + encodeURIComponent(orderId) + '/status',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Basic ' + auth
        }
      }
    );

    const data = await midtransResponse.json();

    // 4. Bila order_id tidak ditemukan, Midtrans mengembalikan status_code 404
    if (String(data.status_code) === '404') {
      return res.status(404).json({
        error: 'Transaksi tidak ditemukan di Midtrans.',
        order_id: orderId
      });
    }

    // 5. Tangani kegagalan lain, misalnya Server Key salah (status_code 401).
    //    Tanpa pengecekan ini, status akan terbaca "unknown" dan pengecekan
    //    otomatis di halaman akan berputar terus tanpa penjelasan.
    if (!String(data.status_code || '').startsWith('2')) {
      return res.status(400).json({
        error: data.status_message || 'Gagal mengecek status transaksi di Midtrans.',
        order_id: orderId,
        detail: data
      });
    }

    const status = data.transaction_status || 'unknown';

    // 6. Tentukan apakah pembayaran sudah lunas
    const lunas = status === 'settlement' || status === 'capture';

    // 7. Tentukan apakah transaksi sudah tidak bisa dibayar lagi
    const gagal = status === 'expire' || status === 'cancel' || status === 'deny';

    return res.status(200).json({
      order_id: data.order_id || orderId,
      transaction_status: status,
      payment_type: data.payment_type || null,
      gross_amount: data.gross_amount || null,
      settlement_time: data.settlement_time || null,
      lunas: lunas,
      gagal: gagal
    });
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server: ' + err.message });
  }
};
