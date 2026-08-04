/**
 * =====================================================================
 * CRON PRODUKSI: NOTIFIKASI TENGGAT PERPANJANGAN SEWA
 * =====================================================================
 * Endpoint : GET /api/cron-notifikasi-tenggat
 * Jadwal   : 1x sehari (lihat vercel.json)
 *
 * Tugasnya: mengingatkan penyewa BULANAN yang masa sewanya akan
 * segera habis, agar mereka sempat memperpanjang sebelum check-out.
 *
 * Alur kerja:
 *   1. Ambil transaksi bulanan yang sudah lunas dan belum diperpanjang
 *   2. Hitung sisa hari menuju tanggal_checkout
 *   3. Bila sisa hari masuk salah satu milestone (H-7 / H-3 / H-1) dan
 *      penandanya masih false -> kirim WhatsApp lalu tandai true
 *   4. Cetak ringkasan hasilnya ke console
 *
 * Penanda per milestone membuat satu penyewa hanya menerima SATU pesan
 * untuk tiap tahap, walaupun cron dijalankan berkali-kali dalam sehari.
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
  sisaHariMenuju,
  aksesDiizinkan
} = require('./_notifikasi-lib');

// =====================================================================
// [A] PENGATURAN MILESTONE  <-- UBAH DI SINI
// ---------------------------------------------------------------------
// "hari"  : sisa hari menuju check-out yang memicu pengiriman
// "kunci" : nama field di dalam map status_notifikasi_tenggat
//
// Menambah milestone baru cukup menambah satu baris, contoh H-14:
//     { hari: 14, kunci: 'h14' },
// Lalu tambahkan juga "h14: false" pada nilai awal dokumen di
// seed-data.js dan js/customer-data.js agar konsisten.
//
// Urutan WAJIB dari yang paling longgar ke paling mendesak.
// =====================================================================
const MILESTONE = [
  { hari: 7, kunci: 'h7' },
  { hari: 3, kunci: 'h3' },
  { hari: 1, kunci: 'h1' }
];

// =====================================================================
// [B] ISI PESAN WHATSAPP  <-- UBAH KALIMATNYA DI SINI
// ---------------------------------------------------------------------
// Fungsi ini menghasilkan teks pesan. Silakan ubah susunan kalimatnya
// sesuka Anda; yang penting variabel di dalamnya tetap dipakai.
//
// Variabel yang tersedia:
//   data.nama          -> nama penyewa
//   data.cabang        -> id cabang (contoh: "pesona-kos")
//   data.tanggalKeluar -> tanggal check-out, sudah diformat
//   data.sisaHari      -> angka sisa hari
//   data.orderId       -> nomor pesanan
// =====================================================================
function susunPesanTenggat(data) {
  // Kalimat pembuka menyesuaikan seberapa mendesak sisa waktunya
  let keteranganWaktu;
  if (data.sisaHari <= 0) {
    keteranganWaktu = 'berakhir *hari ini*';
  } else if (data.sisaHari === 1) {
    keteranganWaktu = 'berakhir *besok*';
  } else {
    keteranganWaktu = 'akan berakhir dalam *' + data.sisaHari + ' hari lagi*';
  }

  return (
    'Halo *' + data.nama + '*,\n\n' +
    'Kami ingin mengingatkan bahwa masa sewa kamar Anda di Pilar Pandawa ' +
    keteranganWaktu + '.\n\n' +
    'Rincian sewa Anda:\n' +
    '- Nomor pesanan : ' + data.orderId + '\n' +
    '- Tanggal check-out : ' + data.tanggalKeluar + '\n\n' +
    'Apabila Anda ingin melanjutkan sewa, mohon lakukan *perpanjangan* ' +
    'sebelum tanggal tersebut agar kamar Anda tidak dialihkan ke penyewa lain.\n\n' +
    'Perpanjangan dapat dilakukan melalui halaman profil pada aplikasi.\n\n' +
    'Terima kasih.\n' +
    '_Pesan ini dikirim otomatis oleh sistem Pilar Pandawa._'
  );
}

// =====================================================================
// LOGIKA PEMILIHAN MILESTONE
// ---------------------------------------------------------------------
// Aturan yang dipakai: "kurang dari atau sama dengan" milestone.
//
// Alasannya, bila cron gagal berjalan satu hari (server mati, kuota
// habis), pemeriksaan "tepat sama dengan" akan melewatkan pengingat
// itu selamanya. Dengan "<=", pengingat tetap terkirim di hari
// berikutnya.
//
// Bila sisa hari sekaligus memenuhi beberapa milestone (misalnya sisa
// 2 hari memenuhi H-7 dan H-3), yang dikirim hanya SATU pesan memakai
// milestone paling mendesak. Milestone yang sudah terlewat ikut
// ditandai true supaya tidak dikirim menyusul di kemudian hari.
// =====================================================================
function pilihMilestone(sisaHari, penanda) {
  // Sewa yang sudah lewat tanggal check-out bukan urusan pengingat ini
  if (sisaHari === null || sisaHari < 0) return null;

  const memenuhi = MILESTONE.filter(function (m) { return sisaHari <= m.hari; });
  if (memenuhi.length === 0) return null;

  const belumTerkirim = memenuhi.filter(function (m) { return penanda[m.kunci] !== true; });
  if (belumTerkirim.length === 0) return null;

  // Milestone paling mendesak = angka hari terkecil
  const terpilih = memenuhi[memenuhi.length - 1];

  return {
    terpilih: terpilih,
    // Semua milestone yang sudah terlampaui ikut ditandai
    ditandai: memenuhi.map(function (m) { return m.kunci; })
  };
}

// =====================================================================
// HANDLER UTAMA
// =====================================================================
module.exports = async (req, res) => {
  if (!aksesDiizinkan(req)) {
    return res.status(401).json({ error: 'Akses ditolak. Sertakan CRON_SECRET yang benar.' });
  }

  const mulai = Date.now();
  console.log('=== CRON NOTIFIKASI TENGGAT dimulai ===');

  try {
    const db = ambilFirestore();

    // -----------------------------------------------------------------
    // 1. Ambil transaksi yang perlu diperiksa
    //    Ketiga syarat ini dikerjakan langsung oleh Firestore.
    // -----------------------------------------------------------------
    const kueri = query(
      collection(db, COL_TRANSAKSI),
      where('tipe_sewa', '==', 'bulanan'),
      where('transaction_status', '==', 'settlement'),
      where('status_perpanjangan', '==', false)
    );

    const cuplikan = await getDocs(kueri);
    console.log('Transaksi yang memenuhi filter: ' + cuplikan.size);

    const terkirim = [];
    const dilewati = [];
    const gagal = [];

    // -----------------------------------------------------------------
    // 2. Periksa satu per satu
    // -----------------------------------------------------------------
    for (const dokumen of cuplikan.docs) {
      const data = dokumen.data();
      const penanda = data.status_notifikasi_tenggat || {};
      const sisaHari = sisaHariMenuju(data.tanggal_checkout);

      const hasilPilih = pilihMilestone(sisaHari, penanda);

      if (!hasilPilih) {
        dilewati.push({ order_id: data.order_id, sisa_hari: sisaHari });
        continue;
      }

      const tujuan = tentukanTujuan(data.kontak_penyewa);

      if (!tujuan.tujuan) {
        gagal.push({
          order_id: data.order_id,
          nama: data.nama_penyewa,
          alasan: 'Nomor kontak tidak valid: ' + data.kontak_penyewa
        });
        continue;
      }

      // -------------------------------------------------------------
      // 3. Susun dan kirim pesan
      // -------------------------------------------------------------
      let pesan = susunPesanTenggat({
        nama: data.nama_penyewa,
        cabang: data.cabang_id,
        tanggalKeluar: formatTanggal(data.tanggal_checkout),
        sisaHari: sisaHari,
        orderId: data.order_id
      });

      // Saat pengalihan aktif, tujuan asli ikut ditulis supaya jelas
      // pesan ini sebenarnya ditujukan untuk siapa
      if (tujuan.dialihkan) {
        pesan =
          '[UJI COBA] Pesan ini seharusnya dikirim ke ' +
          (tujuan.nomorPenyewa || data.kontak_penyewa) + '\n' +
          '--------------------------------\n' + pesan;
      }

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
      // 4. Tandai milestone agar tidak terkirim dua kali
      //    Penandaan dilakukan SETELAH pengiriman berhasil, supaya
      //    pesan yang gagal masih bisa dicoba lagi besok.
      // -------------------------------------------------------------
      const penandaBaru = Object.assign({}, penanda);
      hasilPilih.ditandai.forEach(function (kunci) { penandaBaru[kunci] = true; });

      await updateDoc(doc(db, COL_TRANSAKSI, dokumen.id), {
        status_notifikasi_tenggat: penandaBaru
      });

      terkirim.push({
        order_id: data.order_id,
        nama: data.nama_penyewa,
        milestone: hasilPilih.terpilih.kunci,
        sisa_hari: sisaHari,
        checkout: formatTanggal(data.tanggal_checkout),
        nomor_tujuan: tujuan.tujuan,
        dialihkan: tujuan.dialihkan
      });
    }

    // -----------------------------------------------------------------
    // 5. Catat ringkasan ke console
    // -----------------------------------------------------------------
    console.log('--- Ringkasan ---');
    console.log('Terkirim : ' + terkirim.length);
    terkirim.forEach(function (t) {
      console.log('  [' + t.milestone + '] ' + t.nama + ' (' + t.order_id + ')' +
                  ' | sisa ' + t.sisa_hari + ' hari | checkout ' + t.checkout +
                  ' | ke ' + t.nomor_tujuan + (t.dialihkan ? ' (DIALIHKAN)' : ''));
    });
    console.log('Dilewati : ' + dilewati.length + ' (belum masuk milestone / sudah pernah dikirim)');
    console.log('Gagal    : ' + gagal.length);
    gagal.forEach(function (g) {
      console.log('  ' + g.nama + ' (' + g.order_id + ') -> ' + g.alasan);
    });
    console.log('=== Selesai dalam ' + (Date.now() - mulai) + ' ms ===');

    return res.status(200).json({
      sukses: true,
      waktu: new Date().toISOString(),
      diperiksa: cuplikan.size,
      terkirim: terkirim.length,
      dilewati: dilewati.length,
      gagal: gagal.length,
      pengalihan_nomor_aktif: !!process.env.FONNTE_NOMOR_UJI,
      detail_terkirim: terkirim,
      detail_gagal: gagal
    });

  } catch (err) {
    console.error('CRON TENGGAT GAGAL:', err);

    // Firestore meminta composite index bila kombinasi filter belum
    // pernah dipakai. Pesan errornya memuat tautan pembuatan index.
    const perluIndex = String(err.message || '').includes('index');

    return res.status(500).json({
      sukses: false,
      error: err.message,
      petunjuk: perluIndex
        ? 'Firestore meminta composite index. Buka tautan yang tercantum pada pesan error di atas, klik "Create index", tunggu sampai statusnya Enabled, lalu jalankan ulang endpoint ini.'
        : 'Periksa apakah field status_perpanjangan sudah ada di dokumen. Dokumen tanpa field tersebut tidak akan ikut terbaca oleh query.'
    });
  }
};
