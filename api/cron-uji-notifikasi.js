/**
 * =====================================================================
 * ================== FILE SIMULASI PENGUJIAN (UAT) ====================
 * =====================================================================
 * PERHATIAN: file ini BUKAN bagian dari logika bisnis yang sebenarnya.
 *
 * Tujuannya semata-mata untuk keperluan pengujian UAT / demo sidang:
 * membuktikan bahwa sistem MAMPU mengirim notifikasi WhatsApp secara
 * otomatis, tanpa harus menunggu tanggal check-out asli tiba (yang
 * bisa berbulan-bulan lagi).
 *
 * Bedanya dengan cron produksi (api/cron-notifikasi-tenggat.js):
 *
 *   cron-notifikasi-tenggat.js  |  cron-uji-notifikasi.js (file ini)
 *   ----------------------------|--------------------------------------
 *   Pemicu: tanggal_checkout    |  Pemicu: settlement_time + 3 menit
 *   Jadwal: 1x sehari           |  Jadwal: tiap 3 menit
 *   Isi   : pengingat tenggat   |  Isi   : konfirmasi pembayaran
 *   Sifat : produksi            |  Sifat : simulasi, boleh dihapus
 *
 * SETELAH PENGUJIAN SELESAI, file ini aman untuk dihapus. Hapus juga
 * entri cron-uji-notifikasi pada vercel.json bila ada. Logika notifikasi
 * tenggat yang sebenarnya sama sekali tidak terpengaruh.
 * =====================================================================
 *
 * Endpoint : GET /api/cron-uji-notifikasi
 *
 * Alur kerja:
 *   1. Ambil transaksi berstatus settlement yang belum pernah dikirimi
 *      notifikasi uji (status_notifikasi_uji masih false)
 *   2. Saring hanya yang settlement_time-nya JATUH PADA HARI INI
 *      -> data hasil seeding otomatis terlewat karena waktunya lampau,
 *         jadi yang diproses hanya transaksi baru yang Anda buat sendiri
 *   3. Saring lagi yang sudah lewat 3 menit sejak settlement_time
 *   4. Kirim WhatsApp konfirmasi pembayaran, lalu tandai true supaya
 *      hanya terkirim SATU KALI
 * =====================================================================
 */

const {
  collection, query, where, getDocs, doc, updateDoc
} = require('firebase/firestore');

const {
  ambilFirestore,
  COL_TRANSAKSI,
  tentukanTujuan,
  kirimWhatsapp,
  formatTanggal,
  keDate,
  tanggalHariIni,
  aksesDiizinkan
} = require('./_notifikasi-lib');

// =====================================================================
// [A] PENGATURAN JEDA UJI  <-- UBAH DI SINI
// ---------------------------------------------------------------------
// Berapa menit setelah pembayaran lunas notifikasi baru dikirim.
// Untuk demo yang lebih cepat, ubah menjadi 1. Untuk jeda lebih
// panjang, ubah menjadi 5, 10, dan seterusnya.
// =====================================================================
const JEDA_MENIT = 3;

// =====================================================================
// [B] ISI PESAN WHATSAPP UJI  <-- UBAH KALIMATNYA DI SINI
// ---------------------------------------------------------------------
// Variabel yang tersedia:
//   data.nama          -> nama penyewa
//   data.orderId       -> nomor pesanan
//   data.nominal       -> total pembayaran (sudah diformat)
//   data.tanggalMasuk  -> tanggal check-in
//   data.tanggalKeluar -> tanggal check-out
//   data.menitBerlalu  -> berapa menit sejak pembayaran lunas
// =====================================================================
function susunPesanUji(data) {
  return (
    'Halo *' + data.nama + '*,\n\n' +
    'Pembayaran Anda telah *BERHASIL* kami terima. Terima kasih.\n\n' +
    'Rincian pemesanan:\n' +
    '- Nomor pesanan : ' + data.orderId + '\n' +
    '- Total bayar   : ' + data.nominal + '\n' +
    '- Check-in      : ' + data.tanggalMasuk + '\n' +
    '- Check-out     : ' + data.tanggalKeluar + '\n\n' +
    'Nomor kamar Anda akan ditentukan oleh admin dan diinformasikan ' +
    'sebelum tanggal check-in.\n\n' +
    'Silakan tunjukkan pesan ini beserta KTP asli kepada petugas saat ' +
    'kedatangan.\n\n' +
    'Terima kasih telah mempercayai Pilar Pandawa.\n' +
    '_Pesan otomatis - dikirim ' + data.menitBerlalu + ' menit setelah pembayaran._'
  );
}

/** Mengubah angka menjadi format rupiah. */
function formatRupiah(angka) {
  return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

// =====================================================================
// HANDLER UTAMA
// =====================================================================
module.exports = async (req, res) => {
  if (!aksesDiizinkan(req)) {
    return res.status(401).json({ error: 'Akses ditolak. Sertakan CRON_SECRET yang benar.' });
  }

  const mulai = Date.now();
  console.log('=== CRON UJI NOTIFIKASI (SIMULASI UAT) dimulai ===');

  try {
    const db = ambilFirestore();

    // -----------------------------------------------------------------
    // 1. Ambil transaksi lunas yang belum dikirimi notifikasi uji
    // -----------------------------------------------------------------
    const kueri = query(
      collection(db, COL_TRANSAKSI),
      where('transaction_status', '==', 'settlement'),
      where('status_notifikasi_uji', '==', false)
    );

    const cuplikan = await getDocs(kueri);
    console.log('Transaksi lunas yang belum dinotifikasi: ' + cuplikan.size);

    const terkirim = [];
    const belumWaktunya = [];
    const bukanHariIni = [];
    const gagal = [];

    const sekarang = new Date();

    for (const dokumen of cuplikan.docs) {
      const data = dokumen.data();
      const waktuLunas = keDate(data.settlement_time);

      if (!waktuLunas || isNaN(waktuLunas.getTime())) {
        gagal.push({ order_id: data.order_id, alasan: 'settlement_time kosong / tidak valid' });
        continue;
      }

      // -------------------------------------------------------------
      // 2. HANYA transaksi yang lunas HARI INI.
      //    Inilah penyaring yang membuat 31 transaksi hasil seeding
      //    (settlement_time-nya berbulan-bulan lalu) tidak ikut
      //    terkirim. Yang diproses hanya pesanan baru yang Anda buat
      //    sendiri lewat alur pemesanan customer.
      // -------------------------------------------------------------
      if (!tanggalHariIni(waktuLunas)) {
        bukanHariIni.push(data.order_id);
        continue;
      }

      // -------------------------------------------------------------
      // 3. Sudah lewat JEDA_MENIT sejak pembayaran?
      // -------------------------------------------------------------
      const menitBerlalu = Math.floor((sekarang - waktuLunas) / 60000);

      if (menitBerlalu < JEDA_MENIT) {
        belumWaktunya.push({
          order_id: data.order_id,
          menit_berlalu: menitBerlalu,
          kurang: JEDA_MENIT - menitBerlalu
        });
        continue;
      }

      // -------------------------------------------------------------
      // 4. Kirim pesan.
      //    Berbeda dengan cron tenggat, di sini nomor tujuan memang
      //    nomor penyewa sungguhan -- karena transaksinya Anda buat
      //    sendiri, jadi nomornya juga nomor Anda sendiri.
      //    Pengalihan FONNTE_NOMOR_UJI tetap dihormati bila diisi.
      // -------------------------------------------------------------
      const tujuan = tentukanTujuan(data.kontak_penyewa);

      if (!tujuan.tujuan) {
        gagal.push({
          order_id: data.order_id,
          nama: data.nama_penyewa,
          alasan: 'Nomor kontak tidak valid: ' + data.kontak_penyewa
        });
        continue;
      }

      const pesan = susunPesanUji({
        nama: data.nama_penyewa,
        orderId: data.order_id,
        nominal: formatRupiah(data.order_amount),
        tanggalMasuk: formatTanggal(data.tanggal_checkin),
        tanggalKeluar: formatTanggal(data.tanggal_checkout),
        menitBerlalu: menitBerlalu
      });

      const hasilKirim = await kirimWhatsapp(tujuan.tujuan, pesan);

      if (!hasilKirim.berhasil) {
        gagal.push({
          order_id: data.order_id,
          nama: data.nama_penyewa,
          alasan: hasilKirim.keterangan
        });
        continue;
      }

      // -------------------------------------------------------------
      // 5. Tandai supaya hanya terkirim satu kali
      // -------------------------------------------------------------
      await updateDoc(doc(db, COL_TRANSAKSI, dokumen.id), {
        status_notifikasi_uji: true
      });

      terkirim.push({
        order_id: data.order_id,
        nama: data.nama_penyewa,
        menit_berlalu: menitBerlalu,
        nomor_tujuan: tujuan.tujuan,
        dialihkan: tujuan.dialihkan
      });
    }

    // -----------------------------------------------------------------
    // 6. Ringkasan ke console
    // -----------------------------------------------------------------
    console.log('--- Ringkasan ---');
    console.log('Terkirim        : ' + terkirim.length);
    terkirim.forEach(function (t) {
      console.log('  ' + t.nama + ' (' + t.order_id + ') | ' +
                  t.menit_berlalu + ' menit setelah lunas | ke ' + t.nomor_tujuan +
                  (t.dialihkan ? ' (DIALIHKAN)' : ''));
    });
    console.log('Belum 3 menit   : ' + belumWaktunya.length);
    belumWaktunya.forEach(function (b) {
      console.log('  ' + b.order_id + ' -> baru ' + b.menit_berlalu +
                  ' menit, kurang ' + b.kurang + ' menit lagi');
    });
    console.log('Bukan hari ini  : ' + bukanHariIni.length + ' (data seeding, sengaja dilewati)');
    console.log('Gagal           : ' + gagal.length);
    gagal.forEach(function (g) { console.log('  ' + g.order_id + ' -> ' + g.alasan); });
    console.log('=== Selesai dalam ' + (Date.now() - mulai) + ' ms ===');

    return res.status(200).json({
      sukses: true,
      catatan: 'Endpoint SIMULASI UAT. Bukan bagian dari logika notifikasi tenggat.',
      waktu: new Date().toISOString(),
      jeda_menit: JEDA_MENIT,
      diperiksa: cuplikan.size,
      terkirim: terkirim.length,
      belum_waktunya: belumWaktunya.length,
      bukan_hari_ini: bukanHariIni.length,
      gagal: gagal.length,
      detail_terkirim: terkirim,
      detail_belum_waktunya: belumWaktunya,
      detail_gagal: gagal
    });

  } catch (err) {
    console.error('CRON UJI GAGAL:', err);

    const perluIndex = String(err.message || '').includes('index');

    return res.status(500).json({
      sukses: false,
      error: err.message,
      petunjuk: perluIndex
        ? 'Firestore meminta composite index. Buka tautan pada pesan error di atas, klik "Create index", tunggu sampai Enabled, lalu ulangi.'
        : 'Pastikan field status_notifikasi_uji sudah ada di dokumen. Dokumen tanpa field tersebut tidak terbaca oleh query.'
    });
  }
};
