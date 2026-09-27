/**
 * =====================================================================
 * ============== ENDPOINT KHUSUS PENGUJIAN (UAT) ======================
 * =====================================================================
 * PERHATIAN: file ini BUKAN bagian dari alur bisnis yang sebenarnya.
 *
 * Endpoint : POST /api/uat-dummy-booking   body: { order_id }
 *
 * Tugasnya: begitu sebuah pemesanan ASLI berhasil tersimpan, endpoint
 * ini membuat SATU pemesanan tambahan (dummy) dengan tanggal check-out
 * tepat 7 hari dari hari ini, memakai data diri yang sama persis
 * dengan pemesan aslinya.
 *
 * Tujuannya: cron notifikasi H-7 (api/cron.js) langsung menemukan
 * dummy itu pada pemanggilan berikutnya, sehingga penguji menerima
 * pesan WhatsApp pengingat hanya beberapa menit setelah memesan --
 * tanpa perlu menunggu tanggal jatuh tempo sungguhan yang bisa
 * berbulan-bulan lagi.
 *
 * ---------------------------------------------------------------------
 * CARA MEMATIKAN DI PRODUCTION
 * ---------------------------------------------------------------------
 * Kosongkan atau hapus environment variable UAT_MODE. Tanpa
 * UAT_MODE=true, endpoint ini menolak semua permintaan dan tidak
 * pernah membuat data apa pun. Tidak ada kode yang perlu diubah.
 *
 * Setelah pengujian selesai, file ini beserta api/uat-bersihkan.js
 * aman untuk dihapus.
 * =====================================================================
 */

const {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, Timestamp
} = require('firebase/firestore');

const { ambilFirestore, COL_TRANSAKSI } = require('./_notifikasi-lib');

const COL_CABANG = 'cabang';
const COL_KAMAR = 'kamar';

// =====================================================================
// [A] PENGATURAN  <-- UBAH DI SINI
// ---------------------------------------------------------------------
// HARI_TENGGAT : selisih hari antara hari ini dan tanggal check-out
//                dummy. Harus SAMA dengan HARI_SEBELUM_JATUH_TEMPO
//                pada api/cron.js agar langsung terdeteksi.
// PENANDA      : ditambahkan di belakang nama penyewa supaya data uji
//                mudah dibedakan dari data sungguhan.
// =====================================================================
const HARI_TENGGAT = 7;
const PENANDA = ' [UAT]';

/** Membuat tanggal dengan pergeseran hari dari hari ini. */
function geserHari(jumlahHari, jam) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + jumlahHari);
  tanggal.setHours(jam, 0, 0, 0);
  return tanggal;
}

/**
 * Mengambil satu kamar yang benar-benar masih tersedia PADA CABANG YANG
 * SAMA dengan pemesanan asli, dipilih acak di antara kamar-kamar itu.
 * Sengaja tidak memakai angka karangan supaya data dummy tetap merujuk
 * kamar yang sungguh-sungguh ada -- dan sengaja dibatasi ke cabang yang
 * sama supaya laporan/notifikasi dummy konsisten dengan cabang yang
 * benar-benar dipilih penyewa saat memesan.
 */
async function ambilKamarTersedia(db, cabangId) {
  const cuplikan = await getDocs(
    query(
      collection(db, COL_KAMAR),
      where('cabang_id', '==', cabangId),
      where('tersedia', '==', true)
    )
  );

  if (cuplikan.empty) return null;

  const daftar = cuplikan.docs.map(function (d) {
    return Object.assign({ id: d.id }, d.data());
  });

  return daftar[Math.floor(Math.random() * daftar.length)];
}

// =====================================================================
// HANDLER UTAMA
// =====================================================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- Saklar utama ---
  if (String(process.env.UAT_MODE).toLowerCase() !== 'true') {
    console.log('[UAT] Permintaan diabaikan: UAT_MODE tidak aktif.');
    return res.status(200).json({
      sukses: false,
      aktif: false,
      alasan: 'UAT_MODE tidak aktif. Data dummy tidak dibuat.'
    });
  }

  const orderIdAsli = req.body ? req.body.order_id : null;

  if (!orderIdAsli) {
    return res.status(400).json({ error: 'Parameter order_id wajib diisi.' });
  }

  const mulai = Date.now();
  console.log('[UAT] Diminta membuat dummy untuk booking asli: ' + orderIdAsli);

  try {
    const db = ambilFirestore();

    // -----------------------------------------------------------------
    // 1. Ambil pemesanan aslinya sebagai sumber data diri
    // -----------------------------------------------------------------
    const cuplikanAsli = await getDoc(doc(db, COL_TRANSAKSI, orderIdAsli));

    if (!cuplikanAsli.exists()) {
      console.log('[UAT] GAGAL: booking asli ' + orderIdAsli + ' tidak ditemukan.');
      return res.status(404).json({
        sukses: false,
        error: 'Booking asli dengan order_id "' + orderIdAsli + '" tidak ditemukan.'
      });
    }

    const asli = cuplikanAsli.data();

    // Cegah dummy dibuatkan dummy lagi bila endpoint terpanggil ulang
    if (String(asli.nama_penyewa || '').includes(PENANDA.trim())) {
      console.log('[UAT] Dilewati: ' + orderIdAsli + ' sendiri adalah data uji.');
      return res.status(200).json({
        sukses: false,
        alasan: 'Booking sumber merupakan data uji, dummy tidak dibuat berulang.'
      });
    }

    // -----------------------------------------------------------------
    // 2. Pilih kamar yang benar-benar tersedia, di cabang yang SAMA
    //    dengan pemesanan asli (bukan cabang mana pun secara acak).
    // -----------------------------------------------------------------
    if (!asli.cabang_id) {
      console.log('[UAT] GAGAL: booking asli tidak memiliki cabang_id.');
      return res.status(422).json({
        sukses: false,
        error: 'Booking asli "' + orderIdAsli + '" tidak memiliki cabang_id, dummy tidak bisa dibuat.'
      });
    }

    const kamar = await ambilKamarTersedia(db, asli.cabang_id);

    if (!kamar) {
      console.log('[UAT] GAGAL: tidak ada kamar tersedia di cabang ' + asli.cabang_id + '.');
      return res.status(409).json({
        sukses: false,
        error: 'Tidak ada kamar yang tersedia di cabang "' + asli.cabang_id + '" untuk data uji. ' +
               'Jalankan /api/uat-bersihkan untuk mengembalikan kamar bekas pengujian.'
      });
    }

    const cabangDoc = await getDoc(doc(db, COL_CABANG, kamar.cabang_id));
    const cabang = cabangDoc.exists() ? cabangDoc.data() : {};

    // -----------------------------------------------------------------
    // 3. Susun dokumen dummy
    //    Seluruh field wajib diisi persis seperti pemesanan normal,
    //    supaya tidak terlewat oleh penyaring cron.
    // -----------------------------------------------------------------
    const sekarang = new Date();
    const durasiBulan = 1;

    // Check-out 7 hari lagi; check-in dihitung mundur sesuai lama sewa
    // agar jatuh di masa lalu -- konsisten dengan status checked_in.
    const tanggalCheckout = geserHari(HARI_TENGGAT, 12);
    const tanggalCheckin = new Date(tanggalCheckout);
    tanggalCheckin.setMonth(tanggalCheckin.getMonth() - durasiBulan);
    tanggalCheckin.setHours(14, 0, 0, 0);

    const nominal = Number(cabang.harga_bulanan || 0) * durasiBulan;
    const orderIdDummy = 'UAT-' + sekarang.getTime();

    const dummy = {
      order_id: orderIdDummy,
      order_amount: nominal,
      payment_type: asli.payment_type || 'qris',
      transaction_status: 'settlement',              // syarat cron
      transaction_time: Timestamp.fromDate(sekarang),
      settlement_time: Timestamp.fromDate(sekarang),

      cabang_id: kamar.cabang_id,
      kamar_id: kamar.id,                            // syarat cron
      tipe_sewa: 'bulanan',                          // syarat cron

      // --- Data diri disalin PERSIS dari pemesan asli ---
      // Hanya namanya yang diberi penanda; nomor WhatsApp sengaja
      // dibiarkan sama agar pesan pengingat benar-benar sampai ke
      // penguji yang baru saja memesan.
      nama_penyewa: (asli.nama_penyewa || 'Penyewa') + PENANDA,
      nik_penyewa: asli.nik_penyewa || '-',
      kontak_penyewa: asli.kontak_penyewa || '',
      customer_username: asli.customer_username || null,
      penghuni_tambahan: Array.isArray(asli.penghuni_tambahan) ? asli.penghuni_tambahan : [],

      tanggal_checkin: Timestamp.fromDate(tanggalCheckin),
      tanggal_checkout: Timestamp.fromDate(tanggalCheckout),

      status_checkin: 'checked_in',                  // syarat cron
      tanggal_aktual_checkin: Timestamp.fromDate(tanggalCheckin),
      tanggal_aktual_checkout: null,

      status_perpanjangan: 'belum',                  // syarat cron

      // --- Penanda data uji ---
      uat_dummy: true,
      uat_dari_order: orderIdAsli
    };

    await setDoc(doc(db, COL_TRANSAKSI, orderIdDummy), dummy);

    // -----------------------------------------------------------------
    // 4. Tandai kamarnya terisi agar konsisten dengan status checked_in
    // -----------------------------------------------------------------
    await updateDoc(doc(db, COL_KAMAR, kamar.id), { tersedia: false });

    // -----------------------------------------------------------------
    // 5. Catat ke log
    // -----------------------------------------------------------------
    console.log('[UAT] BERHASIL membuat data uji');
    console.log('  dipicu booking asli : ' + orderIdAsli);
    console.log('  order_id dummy      : ' + orderIdDummy);
    console.log('  penyewa             : ' + dummy.nama_penyewa);
    console.log('  kontak WhatsApp     : ' + dummy.kontak_penyewa);
    console.log('  kamar               : ' + kamar.id + ' (' + (cabang.nama_cabang || kamar.cabang_id) + ')');
    console.log('  tanggal check-out   : ' + tanggalCheckout.toISOString() + ' (H-' + HARI_TENGGAT + ')');
    console.log('  nominal             : Rp ' + nominal.toLocaleString('id-ID'));
    console.log('  waktu dibuat        : ' + sekarang.toISOString());
    console.log('  selesai dalam       : ' + (Date.now() - mulai) + ' ms');

    return res.status(200).json({
      sukses: true,
      aktif: true,
      catatan: 'Data uji dibuat. Cron notifikasi H-7 akan mengirim WhatsApp pada pemanggilan berikutnya.',
      dipicu_oleh: orderIdAsli,
      dummy: {
        order_id: orderIdDummy,
        nama_penyewa: dummy.nama_penyewa,
        kontak_penyewa: dummy.kontak_penyewa,
        kamar_id: kamar.id,
        cabang: cabang.nama_cabang || kamar.cabang_id,
        tanggal_checkout: tanggalCheckout.toISOString(),
        order_amount: nominal
      },
      waktu: sekarang.toISOString()
    });

  } catch (err) {
    console.error('[UAT] GAGAL membuat data uji:', err);
    return res.status(500).json({
      sukses: false,
      error: err.message,
      petunjuk: String(err.message || '').includes('index')
        ? 'Firestore meminta index. Buka tautan pada pesan error, buat index, lalu ulangi.'
        : 'Periksa Firestore Security Rules dan koneksi database.'
    });
  }
};
