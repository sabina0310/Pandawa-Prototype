/**
 * =====================================================================
 * CRON NOTIFIKASI WHATSAPP - DUA JOB TERPISAH
 * =====================================================================
 * Endpoint : GET /api/cron
 *
 * Berisi dua job yang berdiri sendiri:
 *
 *   JOB BULANAN  -> /api/cron?job=bulanan
 *      Mengingatkan penyewa bulanan yang masa sewanya berakhir
 *      TEPAT 7 hari lagi dan belum menjawab soal perpanjangan.
 *
 *   JOB HARIAN   -> /api/cron?job=harian
 *      Mengingatkan penyewa harian yang harus check-out HARI INI.
 *
 *   Tanpa parameter -> /api/cron
 *      Menjalankan keduanya berurutan.
 *
 * ---------------------------------------------------------------------
 * CATATAN PENTING SOAL PENJADWALAN
 * ---------------------------------------------------------------------
 * File ini TIDAK memakai node-cron / node-schedule. Library semacam itu
 * bekerja dengan menyalakan timer di dalam proses yang hidup terus,
 * sedangkan fungsi serverless mati begitu selesai menjawab request --
 * timernya ikut mati sebelum sempat berdetak.
 *
 * Penjadwalan sepenuhnya ditangani pemanggil dari luar (cron-job.org
 * atau Vercel Cron). File ini hanya endpoint biasa yang bisa dipanggil
 * kapan saja, termasuk lewat browser untuk pengujian manual.
 *
 * ---------------------------------------------------------------------
 * PENCEGAHAN KIRIM GANDA
 * ---------------------------------------------------------------------
 * Syarat "check-out 7 hari lagi" bernilai benar SEPANJANG HARI itu.
 * Bila cron dipanggil tiap 3 menit, tanpa pencegahan satu penyewa bisa
 * menerima ratusan pesan dalam sehari.
 *
 * Pencegahannya memakai collection "log_notifikasi" dengan Document ID
 * berpola:  {order_id}_{jenis}_{tanggal}
 * Contoh :  PP-1754300000000-07_bulanan_2026-08-05
 *
 * Sebelum mengirim, cron memeriksa apakah dokumen ber-ID itu sudah ada.
 * Sudah ada -> lewati. Belum -> kirim, lalu buat dokumennya.
 *
 * Cara ini dipilih agar dokumen transaksi tidak perlu menyimpan kolom
 * penanda apa pun, sekaligus menghasilkan riwayat pengiriman yang bisa
 * ditampilkan di panel notifikasi admin.
 * =====================================================================
 */

const {
  collection, query, where, getDocs, getDoc, doc, setDoc, Timestamp
} = require('firebase/firestore');

const {
  ambilFirestore,
  COL_TRANSAKSI,
  AWALAN_ORDER_UAT,
  modeUjiAktif,
  pesananUji,
  ringkasanPengaturan,
  tentukanTujuan,
  kirimWhatsapp,
  formatTanggal,
  awalHari,
  aksesDiizinkan
} = require('./_notifikasi-lib');

const COL_LOG = 'log_notifikasi';

// =====================================================================
// SARINGAN PESANAN UJI
// ---------------------------------------------------------------------
// Saat UAT_MODE menyala, hanya pesanan ber-order_id "UAT-..." yang
// diproses. Selebihnya dilewati tanpa dikirimi apa pun.
//
// Penyaringannya dikerjakan DI SINI, bukan di dalam kueri Firestore.
// Alasannya teknis: kedua kueri di bawah sudah memakai rentang pada
// "tanggal_checkout", sedangkan "berawalan UAT-" juga berupa rentang
// (>= "UAT-" dan < "UAT."). Firestore melarang dua field rentang dalam
// satu kueri, jadi mustahil digabung.
//
// Biayanya nol pembacaan tambahan: dokumennya memang sudah terambil.
// =====================================================================
function saringKandidat(daftarDokumen) {
  if (!modeUjiAktif()) return daftarDokumen;

  return daftarDokumen.filter(function (dokumen) {
    const data = dokumen.data();
    // order_id dibaca dari isinya, dengan Document ID sebagai cadangan
    return pesananUji(data.order_id || dokumen.id);
  });
}

// =====================================================================
// [A] PENGATURAN JOB BULANAN  <-- UBAH DI SINI
// ---------------------------------------------------------------------
// Berapa hari sebelum tanggal check-out pengingat dikirim.
// Ubah menjadi 3 bila ingin H-3, 14 untuk H-14, dan seterusnya.
//
// Perhatikan: pemeriksaannya TEPAT sama dengan, bukan "kurang dari".
// Jadi pengingat hanya dikirim pada hari ke-7 sebelum check-out.
// =====================================================================
const HARI_SEBELUM_JATUH_TEMPO = 7;

// =====================================================================
// [B] ISI PESAN WHATSAPP  <-- UBAH KALIMATNYA DI SINI
// =====================================================================

/** Pesan untuk penyewa bulanan yang masa sewanya akan berakhir. */
function pesanBulanan(data) {
  return (
    'Halo *' + data.nama + '*,\n\n' +
    'Masa sewa kamar Anda di Pilar Pandawa akan berakhir dalam *' +
    HARI_SEBELUM_JATUH_TEMPO + ' hari lagi*.\n\n' +
    'Rincian sewa:\n' +
    '- Nomor pesanan : ' + data.orderId + '\n' +
    '- Kamar         : ' + data.kamar + '\n' +
    '- Tanggal berakhir : ' + data.tanggalKeluar + '\n\n' +
    'Bila ingin melanjutkan sewa, mohon lakukan *perpanjangan* sebelum ' +
    'tanggal tersebut agar kamar Anda tidak dialihkan ke penyewa lain.\n\n' +
    'Bila tidak melanjutkan, mohon bersiap untuk check-out pada tanggal ' +
    'tersebut.\n\n' +
    'Terima kasih.\n' +
    '_Pesan otomatis dari sistem Pilar Pandawa._'
  );
}

/** Pesan untuk penyewa harian yang harus check-out hari ini. */
function pesanHarian(data) {
  return (
    'Halo *' + data.nama + '*,\n\n' +
    'Kami mengingatkan bahwa masa sewa harian Anda *berakhir hari ini*.\n\n' +
    'Rincian sewa:\n' +
    '- Nomor pesanan : ' + data.orderId + '\n' +
    '- Kamar         : ' + data.kamar + '\n' +
    '- Check-out     : ' + data.tanggalKeluar + ', paling lambat pukul 12.00\n\n' +
    'Mohon kembalikan kunci kamar kepada petugas saat meninggalkan kos. ' +
    'Bila ingin memperpanjang masa inap, silakan hubungi petugas sebelum ' +
    'jam check-out.\n\n' +
    'Terima kasih telah menginap di Pilar Pandawa.\n' +
    '_Pesan otomatis dari sistem Pilar Pandawa._'
  );
}

// =====================================================================
// FUNGSI BANTU
// =====================================================================

/** Mengubah tanggal menjadi teks "2026-08-05" untuk dipakai di ID log. */
function kunciTanggal(tanggal) {
  const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
  const hari = String(tanggal.getDate()).padStart(2, '0');
  return tanggal.getFullYear() + '-' + bulan + '-' + hari;
}

/** Menyusun Document ID log. Pola inilah yang mencegah kiriman ganda. */
function idLog(orderId, jenis, tanggal) {
  return orderId + '_' + jenis + '_' + kunciTanggal(tanggal);
}

/** Awal dan akhir sebuah hari, untuk menyaring rentang di Firestore. */
function rentangHari(geserHari) {
  const mulai = awalHari(new Date());
  mulai.setDate(mulai.getDate() + geserHari);

  const selesai = new Date(mulai);
  selesai.setDate(selesai.getDate() + 1);

  return { mulai: mulai, selesai: selesai };
}

// =====================================================================
// PEMROSESAN SATU TRANSAKSI
// ---------------------------------------------------------------------
// Dipakai bersama oleh kedua job. Setiap kesalahan ditangani di sini
// dan dikembalikan sebagai hasil, TIDAK dilempar keluar, supaya satu
// pengiriman yang gagal tidak menghentikan pemrosesan penyewa lain.
// =====================================================================
async function prosesSatu(db, dokumen, jenis, penyusunPesan, judulLog) {
  const data = dokumen.data();
  const hariIni = new Date();

  try {
    // --- 1. Sudah pernah dikirim hari ini? ---
    const idDokumenLog = idLog(data.order_id, jenis, hariIni);
    const logLama = await getDoc(doc(db, COL_LOG, idDokumenLog));

    if (logLama.exists()) {
      return { hasil: 'dilewati', order_id: data.order_id, alasan: 'sudah dikirim hari ini' };
    }

    // --- 2. Tentukan nomor tujuan ---
    const tujuan = tentukanTujuan(data.kontak_penyewa);

    if (!tujuan.tujuan) {
      return {
        hasil: 'gagal',
        order_id: data.order_id,
        nama: data.nama_penyewa,
        alasan: 'Nomor kontak tidak valid: ' + data.kontak_penyewa
      };
    }

    // --- 3. Susun pesan ---
    const tanggalKeluar = formatTanggal(data.tanggal_checkout);

    let pesan = penyusunPesan({
      nama: data.nama_penyewa,
      orderId: data.order_id,
      kamar: data.kamar_id || 'Belum dialokasikan',
      tanggalKeluar: tanggalKeluar
    });

    // Saat pengalihan nomor uji aktif, tujuan aslinya ikut dicatat
    if (tujuan.dialihkan) {
      pesan = '[UJI COBA] Pesan ini seharusnya dikirim ke ' +
              (tujuan.nomorPenyewa || data.kontak_penyewa) + '\n' +
              '--------------------------------\n' + pesan;
    }

    // --- 4. Kirim ---
    const hasilKirim = await kirimWhatsapp(tujuan.tujuan, pesan);

    // --- 5. Catat ke log ---
    // Pengiriman yang GAGAL sengaja tidak dicatat, supaya bisa dicoba
    // lagi pada pemanggilan cron berikutnya.
    if (!hasilKirim.berhasil) {
      return {
        hasil: 'gagal',
        order_id: data.order_id,
        nama: data.nama_penyewa,
        alasan: hasilKirim.keterangan
      };
    }

    await setDoc(doc(db, COL_LOG, idDokumenLog), {
      order_id: data.order_id,
      jenis: jenis,
      judul: judulLog,
      ringkasan: 'Sewa ' + data.nama_penyewa + ' berakhir ' + tanggalKeluar,
      nama_penyewa: data.nama_penyewa,
      cabang_id: data.cabang_id,
      kamar_id: data.kamar_id || null,
      kontak_tujuan: tujuan.tujuan,
      dialihkan: tujuan.dialihkan,
      waktu_kirim: Timestamp.fromDate(hariIni),
      status: 'berhasil',
      keterangan: hasilKirim.keterangan,
      pesan: pesan,
      dibaca: false   // dipakai panel notifikasi admin
    });

    return {
      hasil: 'terkirim',
      order_id: data.order_id,
      nama: data.nama_penyewa,
      kamar: data.kamar_id,
      checkout: tanggalKeluar,
      nomor_tujuan: tujuan.tujuan,
      dialihkan: tujuan.dialihkan
    };

  } catch (err) {
    // Kesalahan tak terduga pada satu dokumen tidak boleh menghentikan
    // pemrosesan dokumen lainnya.
    console.error('  Gagal memproses ' + data.order_id + ':', err.message);
    return {
      hasil: 'gagal',
      order_id: data.order_id,
      nama: data.nama_penyewa,
      alasan: err.message
    };
  }
}

/** Mengelompokkan hasil pemrosesan menjadi ringkasan. */
function ringkas(daftarHasil) {
  return {
    terkirim: daftarHasil.filter(function (h) { return h.hasil === 'terkirim'; }),
    dilewati: daftarHasil.filter(function (h) { return h.hasil === 'dilewati'; }),
    gagal: daftarHasil.filter(function (h) { return h.hasil === 'gagal'; })
  };
}

/** Mencetak ringkasan sebuah job ke console. */
function cetakRingkasan(namaJob, jumlahKandidat, r, lamaMs) {
  console.log('[' + namaJob + '] kandidat dari database : ' + jumlahKandidat);
  console.log('[' + namaJob + '] berhasil terkirim      : ' + r.terkirim.length);
  r.terkirim.forEach(function (t) {
    console.log('    -> ' + t.nama + ' (' + t.order_id + ') | kamar ' + (t.kamar || '-') +
                ' | checkout ' + t.checkout + ' | ke ' + t.nomor_tujuan +
                (t.dialihkan ? ' (DIALIHKAN)' : ''));
  });
  console.log('[' + namaJob + '] dilewati (sudah dikirim hari ini) : ' + r.dilewati.length);
  console.log('[' + namaJob + '] gagal terkirim         : ' + r.gagal.length);
  r.gagal.forEach(function (g) {
    console.log('    -> ' + (g.nama || g.order_id) + ' : ' + g.alasan);
  });
  console.log('[' + namaJob + '] selesai dalam ' + lamaMs + ' ms');
}

// =====================================================================
// JOB 1 - SEWA BULANAN (pengingat perpanjangan H-7)
// ---------------------------------------------------------------------
// Syarat sebuah transaksi ikut diproses:
//   tipe_sewa           == "bulanan"
//   transaction_status  == "settlement"   (sudah lunas)
//   status_checkin      == "checked_in"   (sedang menempati kamar)
//   status_perpanjangan == "belum"        (belum menjawab)
//   tanggal_checkout    jatuh TEPAT 7 hari dari hari ini
//
// Seluruh syarat dikerjakan Firestore, bukan disaring di JavaScript,
// sehingga yang terunduh hanya dokumen yang memang perlu diproses.
// =====================================================================
async function jobBulanan(db) {
  const mulai = Date.now();
  console.log('--- JOB BULANAN dimulai ---');

  const rentang = rentangHari(HARI_SEBELUM_JATUH_TEMPO);

  const kueri = query(
    collection(db, COL_TRANSAKSI),
    where('tipe_sewa', '==', 'bulanan'),
    where('transaction_status', '==', 'settlement'),
    where('status_checkin', '==', 'checked_in'),
    where('status_perpanjangan', '==', 'belum'),
    where('tanggal_checkout', '>=', Timestamp.fromDate(rentang.mulai)),
    where('tanggal_checkout', '<', Timestamp.fromDate(rentang.selesai))
  );

  const cuplikan = await getDocs(kueri);
  const kandidat = saringKandidat(cuplikan.docs);

  const hasil = [];
  for (const dokumen of kandidat) {
    hasil.push(await prosesSatu(
      db, dokumen, 'bulanan', pesanBulanan,
      'Pengingat Jatuh Tempo (H-' + HARI_SEBELUM_JATUH_TEMPO + ')'
    ));
  }

  const r = ringkas(hasil);
  cetakRingkasan('BULANAN', kandidat.length, r, Date.now() - mulai);

  return {
    job: 'bulanan',
    kandidat: kandidat.length,
    disaring_mode_uji: cuplikan.size - kandidat.length,
    terkirim: r.terkirim.length,
    dilewati: r.dilewati.length,
    gagal: r.gagal.length,
    detail_terkirim: r.terkirim,
    detail_gagal: r.gagal
  };
}

// =====================================================================
// JOB 2 - SEWA HARIAN (pengingat check-out hari ini)
// ---------------------------------------------------------------------
// Syarat sebuah transaksi ikut diproses:
//   tipe_sewa          == "harian"
//   transaction_status == "settlement"
//   status_checkin     == "checked_in"   (sedang menempati kamar)
//   tanggal_checkout   jatuh PADA HARI INI
//
// Sewa harian tidak mengenal perpanjangan, jadi status_perpanjangan
// tidak ikut diperiksa.
// =====================================================================
async function jobHarian(db) {
  const mulai = Date.now();
  console.log('--- JOB HARIAN dimulai ---');

  const rentang = rentangHari(0); // hari ini

  const kueri = query(
    collection(db, COL_TRANSAKSI),
    where('tipe_sewa', '==', 'harian'),
    where('transaction_status', '==', 'settlement'),
    where('status_checkin', '==', 'checked_in'),
    where('tanggal_checkout', '>=', Timestamp.fromDate(rentang.mulai)),
    where('tanggal_checkout', '<', Timestamp.fromDate(rentang.selesai))
  );

  const cuplikan = await getDocs(kueri);
  const kandidat = saringKandidat(cuplikan.docs);

  const hasil = [];
  for (const dokumen of kandidat) {
    hasil.push(await prosesSatu(
      db, dokumen, 'harian', pesanHarian,
      'Pengingat Check-out Hari Ini'
    ));
  }

  const r = ringkas(hasil);
  cetakRingkasan('HARIAN', kandidat.length, r, Date.now() - mulai);

  return {
    job: 'harian',
    kandidat: kandidat.length,
    disaring_mode_uji: cuplikan.size - kandidat.length,
    terkirim: r.terkirim.length,
    dilewati: r.dilewati.length,
    gagal: r.gagal.length,
    detail_terkirim: r.terkirim,
    detail_gagal: r.gagal
  };
}

// =====================================================================
// HANDLER UTAMA
// =====================================================================
module.exports = async (req, res) => {
  if (!aksesDiizinkan(req)) {
    return res.status(401).json({ error: 'Akses ditolak. Sertakan CRON_SECRET yang benar.' });
  }

  const pilihanJob = (req.query && req.query.job) || 'semua';

  if (['bulanan', 'harian', 'semua'].indexOf(pilihanJob) === -1) {
    return res.status(400).json({
      error: 'Parameter job tidak dikenal: "' + pilihanJob + '".',
      pilihan_yang_benar: ['bulanan', 'harian', 'semua (atau tanpa parameter)']
    });
  }

  const mulai = Date.now();
  console.log('===== CRON NOTIFIKASI dipanggil (job=' + pilihanJob + ') =====');

  // Kedua sakelar berdiri sendiri, jadi keduanya dicetak: UAT_MODE
  // menentukan transaksi mana yang diproses, FONNTE_NOMOR_UJI
  // menentukan nomor tujuannya.
  console.log('[PENGATURAN] ' + ringkasanPengaturan().keterangan);

  try {
    const db = ambilFirestore();
    const laporan = [];

    // Kedua job dijalankan terpisah dan tidak saling mengganggu.
    // Kegagalan salah satunya tidak membatalkan yang lain.
    if (pilihanJob === 'bulanan' || pilihanJob === 'semua') {
      try {
        laporan.push(await jobBulanan(db));
      } catch (err) {
        console.error('JOB BULANAN gagal total:', err.message);
        laporan.push({ job: 'bulanan', error: err.message, petunjuk: petunjukError(err) });
      }
    }

    if (pilihanJob === 'harian' || pilihanJob === 'semua') {
      try {
        laporan.push(await jobHarian(db));
      } catch (err) {
        console.error('JOB HARIAN gagal total:', err.message);
        laporan.push({ job: 'harian', error: err.message, petunjuk: petunjukError(err) });
      }
    }

    const totalTerkirim = laporan.reduce(function (t, l) { return t + (l.terkirim || 0); }, 0);
    console.log('===== Selesai. Total terkirim: ' + totalTerkirim +
                ' | ' + (Date.now() - mulai) + ' ms =====');

    return res.status(200).json({
      sukses: true,
      waktu: new Date().toISOString(),
      job_dijalankan: pilihanJob,
      total_terkirim: totalTerkirim,
      mode_uji_aktif: modeUjiAktif(),
      awalan_order_uji: modeUjiAktif() ? AWALAN_ORDER_UAT : null,
      pengalihan_nomor_aktif: !!process.env.FONNTE_NOMOR_UJI,
      laporan: laporan
    });

  } catch (err) {
    console.error('CRON GAGAL:', err);
    return res.status(500).json({
      sukses: false,
      error: err.message,
      petunjuk: petunjukError(err)
    });
  }
};

/** Menerjemahkan error Firestore yang sering muncul menjadi petunjuk. */
function petunjukError(err) {
  const pesan = String(err && err.message || '');

  if (pesan.includes('index')) {
    return 'Firestore meminta composite index untuk kombinasi filter ini. ' +
           'Buka tautan yang tercantum pada pesan error di atas (atau di Vercel Logs), ' +
           'klik "Create index", tunggu sampai statusnya Enabled, lalu panggil ulang endpoint ini. ' +
           'Cukup dilakukan sekali untuk tiap job.';
  }

  if (pesan.includes('permission')) {
    return 'Firestore Security Rules menolak akses. Pastikan Rules masih mengizinkan baca/tulis.';
  }

  return 'Periksa Vercel Logs untuk rincian lengkapnya.';
}
