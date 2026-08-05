/**
 * =====================================================================
 * ============== ENDPOINT KHUSUS PENGUJIAN (UAT) ======================
 * =====================================================================
 * Endpoint : GET /api/uat-bersihkan
 *
 * Menghapus seluruh transaksi bertanda uji (uat_dummy = true) dan
 * MENGEMBALIKAN kamar yang tadinya dipakai menjadi tersedia lagi.
 *
 * Gunanya: tiap pengujian memakai satu kamar dari persediaan. Tanpa
 * pembersihan, latihan demo berulang lama-lama menghabiskan kamar dan
 * memaksa seeding ulang. Endpoint ini mengembalikannya dalam sekali
 * panggil, tanpa menyentuh data seeding maupun pemesanan sungguhan.
 *
 * Transaksi PERPANJANGAN hasil pengujian (yang dibuat lewat Midtrans)
 * TIDAK ikut terhapus, karena itu pembayaran sungguhan.
 *
 * Aman dihapus setelah pengujian selesai.
 * =====================================================================
 */

const {
  collection, doc, getDocs, query, where, deleteDoc, updateDoc
} = require('firebase/firestore');

const { ambilFirestore, COL_TRANSAKSI } = require('./_notifikasi-lib');

const COL_KAMAR = 'kamar';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (String(process.env.UAT_MODE).toLowerCase() !== 'true') {
    return res.status(200).json({
      sukses: false,
      aktif: false,
      alasan: 'UAT_MODE tidak aktif. Tidak ada yang dibersihkan.'
    });
  }

  const mulai = Date.now();
  console.log('[UAT] Pembersihan data uji dimulai');

  try {
    const db = ambilFirestore();

    const cuplikan = await getDocs(
      query(collection(db, COL_TRANSAKSI), where('uat_dummy', '==', true))
    );

    if (cuplikan.empty) {
      console.log('[UAT] Tidak ada data uji yang perlu dibersihkan.');
      return res.status(200).json({
        sukses: true,
        dihapus: 0,
        kamar_dikembalikan: 0,
        catatan: 'Tidak ada data uji yang tersisa.'
      });
    }

    const terhapus = [];
    const kamarDikembalikan = [];

    for (const dokumen of cuplikan.docs) {
      const data = dokumen.data();

      // Kembalikan kamarnya lebih dulu, baru hapus transaksinya.
      // Urutan ini membuat kamar tidak tertinggal dalam keadaan
      // terkunci bila proses terhenti di tengah jalan.
      if (data.kamar_id) {
        try {
          await updateDoc(doc(db, COL_KAMAR, data.kamar_id), { tersedia: true });
          kamarDikembalikan.push(data.kamar_id);
        } catch (err) {
          console.log('[UAT] Kamar ' + data.kamar_id + ' gagal dikembalikan: ' + err.message);
        }
      }

      await deleteDoc(doc(db, COL_TRANSAKSI, dokumen.id));
      terhapus.push({
        order_id: data.order_id,
        nama_penyewa: data.nama_penyewa,
        kamar_id: data.kamar_id || null
      });
    }

    console.log('[UAT] Transaksi uji dihapus  : ' + terhapus.length);
    terhapus.forEach(function (t) {
      console.log('  - ' + t.order_id + ' | ' + t.nama_penyewa + ' | kamar ' + (t.kamar_id || '-'));
    });
    console.log('[UAT] Kamar dikembalikan     : ' + kamarDikembalikan.length +
                ' (' + kamarDikembalikan.join(', ') + ')');
    console.log('[UAT] Selesai dalam ' + (Date.now() - mulai) + ' ms');

    return res.status(200).json({
      sukses: true,
      dihapus: terhapus.length,
      kamar_dikembalikan: kamarDikembalikan.length,
      detail: terhapus,
      kamar: kamarDikembalikan,
      catatan: 'Transaksi perpanjangan hasil pembayaran sungguhan tidak ikut dihapus.'
    });

  } catch (err) {
    console.error('[UAT] Pembersihan gagal:', err);
    return res.status(500).json({ sukses: false, error: err.message });
  }
};
