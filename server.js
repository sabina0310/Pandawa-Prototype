/**
 * Server Lokal Sederhana - Prototipe Pilar Pandawa
 * =================================================================
 * Cara menjalankan:
 *   1. Salin file .env.example menjadi .env, lalu isi Server Key Midtrans
 *   2. Jalankan di terminal:  node server.js
 *   3. Buka browser:          http://localhost:3000
 *
 * Server ini punya dua tugas:
 *   a. Menyajikan file HTML/gambar/CSS (file statis)
 *   b. Menjalankan file di folder /api sebagai endpoint API
 *
 * Kenapa perlu server? Karena Server Key Midtrans bersifat rahasia dan
 * tidak boleh diletakkan di JavaScript browser. Server inilah yang
 * menyimpan key tersebut dan meneruskan permintaan ke Midtrans.
 *
 * Dibuat memakai modul bawaan Node.js saja (http, fs, path, url),
 * jadi TIDAK perlu "npm install" apa pun.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// =================================================================
// 1. Membaca file .env secara manual (pengganti library dotenv)
// =================================================================
function muatEnv() {
  const berkasEnv = path.join(ROOT, '.env');

  if (!fs.existsSync(berkasEnv)) {
    console.log('[!] File .env belum ada. Salin .env.example menjadi .env lalu isi Server Key Anda.');
    return;
  }

  const isi = fs.readFileSync(berkasEnv, 'utf8');
  isi.split('\n').forEach(function (baris) {
    const teks = baris.trim();

    // Lewati baris kosong dan baris komentar
    if (!teks || teks.startsWith('#')) return;

    const posisiSamaDengan = teks.indexOf('=');
    if (posisiSamaDengan === -1) return;

    const kunci = teks.substring(0, posisiSamaDengan).trim();
    let nilai = teks.substring(posisiSamaDengan + 1).trim();

    // Hapus tanda kutip bila ada
    nilai = nilai.replace(/^["']|["']$/g, '');

    if (kunci) process.env[kunci] = nilai;
  });
}

muatEnv();

// =================================================================
// 2. Daftar tipe file agar browser menampilkannya dengan benar
// =================================================================
const TIPE_FILE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// File/folder yang tidak boleh diakses lewat browser (berisi data rahasia)
const DILARANG_DIAKSES = ['.env', '.git'];

// =================================================================
// 3. Penyesuaian agar file di folder /api bisa dipakai apa adanya
//    (formatnya sama dengan serverless function, jadi tetap bisa
//     di-deploy ke Vercel tanpa mengubah kode sedikit pun)
// =================================================================
function siapkanResponse(res) {
  // Meniru res.status(200).json({...})
  res.status = function (kode) {
    res.statusCode = kode;
    return res;
  };

  res.json = function (obj) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };

  return res;
}

// Membaca isi body permintaan POST lalu mengubahnya jadi objek
function bacaBody(req) {
  return new Promise(function (selesai) {
    let data = '';
    req.on('data', function (potongan) { data += potongan; });
    req.on('end', function () {
      try {
        selesai(data ? JSON.parse(data) : {});
      } catch (err) {
        selesai({});
      }
    });
  });
}

// =================================================================
// 4. Server utama
// =================================================================
const server = http.createServer(async function (req, res) {
  const alamat = url.parse(req.url, true);
  let jalur = decodeURIComponent(alamat.pathname);

  siapkanResponse(res);

  // ---------- A. Permintaan ke endpoint API ----------
  if (jalur.startsWith('/api/')) {
    const namaEndpoint = jalur.replace('/api/', '').replace(/\/$/, '');
    const berkasApi = path.join(ROOT, 'api', namaEndpoint + '.js');

    if (!berkasApi.startsWith(path.join(ROOT, 'api')) || !fs.existsSync(berkasApi)) {
      return res.status(404).json({ error: 'Endpoint tidak ditemukan: ' + jalur });
    }

    try {
      // Hapus cache agar perubahan pada file /api langsung terbaca
      // tanpa perlu menghentikan server
      delete require.cache[require.resolve(berkasApi)];

      const handler = require(berkasApi);

      req.query = alamat.query;          // untuk GET  -> req.query.order_id
      req.body = await bacaBody(req);    // untuk POST -> req.body.nama, dst.

      return handler(req, res);
    } catch (err) {
      console.error('Error pada endpoint ' + jalur + ':', err);
      return res.status(500).json({ error: 'Gagal menjalankan endpoint: ' + err.message });
    }
  }

  // ---------- B. Permintaan file statis (HTML, gambar, dll) ----------
  if (jalur === '/') jalur = '/index.html';

  // Tolak akses ke file rahasia
  const jalurKecil = jalur.toLowerCase();
  const terlarang = DILARANG_DIAKSES.some(function (item) {
    return jalurKecil.includes(item);
  });
  if (terlarang) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('403 - Akses ditolak');
  }

  const berkas = path.join(ROOT, jalur);

  // Cegah akses ke luar folder proyek (contoh: /../../file-lain)
  if (!berkas.startsWith(ROOT)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('403 - Akses ditolak');
  }

  fs.readFile(berkas, function (err, data) {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<h1>404 - Halaman tidak ditemukan</h1><p>' + jalur + '</p>');
    }

    const ekstensi = path.extname(berkas).toLowerCase();
    res.setHeader('Content-Type', TIPE_FILE[ekstensi] || 'application/octet-stream');
    res.end(data);
  });
});

// =================================================================
// 5. Menjalankan server
// =================================================================
server.listen(PORT, function () {
  console.log('');
  console.log('  Pilar Pandawa - Server Lokal');
  console.log('  ----------------------------------------');
  console.log('  Alamat  : http://localhost:' + PORT);
  console.log('  Midtrans: ' + (process.env.MIDTRANS_SERVER_KEY
    ? 'Server Key terbaca (mode Sandbox)'
    : 'BELUM ADA Server Key -> pembayaran QRIS tidak akan jalan'));
  console.log('  ----------------------------------------');
  console.log('  Tekan Ctrl+C untuk menghentikan server.');
  console.log('');
});
