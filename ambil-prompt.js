/**
 * =====================================================================
 * MENGAMBIL RIWAYAT PROMPT DARI CATATAN SESI CLAUDE CODE
 * =====================================================================
 * Claude Code menyimpan seluruh percakapan sebagai berkas .jsonl di
 *
 *     C:\Users\<nama>\.claude\projects\<nama-proyek>\<id-sesi>.jsonl
 *
 * Satu baris berkas itu berisi satu peristiwa: pesan pengguna, jawaban
 * asisten, pemanggilan tool, hasil tool, dan seterusnya. Berkasnya
 * karena itu berukuran puluhan MB dan sulit dibaca langsung.
 *
 * Skrip ini menyaring yang biasanya diperlukan untuk dokumentasi:
 * PERMINTAAN YANG BENAR-BENAR DIKETIK PENGGUNA, beserta waktunya.
 *
 * Yang dibuang:
 *   - hasil pemanggilan tool (juga bertipe "user", tetapi bukan ketikan)
 *   - sisipan otomatis IDE seperti <ide_opened_file>
 *   - perintah garis miring seperti /model dan /compact
 *   - sisipan sistem <system-reminder>
 *
 * CARA PAKAI
 *   node ambil-prompt.js                      -> tampilkan ke layar
 *   node ambil-prompt.js > riwayat-prompt.md  -> simpan ke berkas
 * =====================================================================
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------
// 1. Mencari berkas catatan sesi
// ---------------------------------------------------------------------
const RUMAH = process.env.USERPROFILE || process.env.HOME;
const FOLDER = path.join(RUMAH, ".claude", "projects", "d--Pandawa-Prototype");

if (!fs.existsSync(FOLDER)) {
  console.error("Folder catatan sesi tidak ditemukan:\n  " + FOLDER);
  process.exit(1);
}

const berkas = fs.readdirSync(FOLDER)
  .filter(function (n) { return n.endsWith(".jsonl"); })
  .map(function (n) {
    const p = path.join(FOLDER, n);
    return { nama: n, jalur: p, waktu: fs.statSync(p).mtimeMs };
  })
  .sort(function (a, b) { return a.waktu - b.waktu; });

if (berkas.length === 0) {
  console.error("Tidak ada berkas .jsonl di " + FOLDER);
  process.exit(1);
}

// ---------------------------------------------------------------------
// 2. Menentukan mana yang benar-benar ketikan pengguna
// ---------------------------------------------------------------------

/** Membuang sisipan otomatis yang bukan ketikan pengguna. */
function bersihkan(teks) {
  return String(teks)
    .replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "")
    .replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .trim();
}

/** Mengambil bagian teks dari sebuah pesan pengguna. */
function ambilTeks(pesan) {
  const isi = pesan.content;
  if (typeof isi === "string") return isi;
  if (!Array.isArray(isi)) return "";

  // Hasil tool juga bertipe "user"; yang dipakai hanya bagian bertipe teks
  return isi.filter(function (b) { return b.type === "text"; })
            .map(function (b) { return b.text; })
            .join("\n");
}

// ---------------------------------------------------------------------
// 3. Membaca berkas baris demi baris
// ---------------------------------------------------------------------
async function bacaSatuBerkas(info, mulaiDari) {
  const daftar = [];
  const aliran = readline.createInterface({
    input: fs.createReadStream(info.jalur),
    crlfDelay: Infinity
  });

  for await (const baris of aliran) {
    let data;
    try { data = JSON.parse(baris); } catch (err) { continue; }

    if (data.type !== "user" || !data.message) continue;

    const teks = bersihkan(ambilTeks(data.message));
    if (!teks) continue;

    daftar.push({
      nomor: mulaiDari + daftar.length + 1,
      waktu: (data.timestamp || "").slice(0, 16).replace("T", " "),
      teks: teks
    });
  }

  return daftar;
}

async function jalan() {
  let semua = [];

  for (const info of berkas) {
    const hasil = await bacaSatuBerkas(info, semua.length);
    semua = semua.concat(hasil);
  }

  console.log("# Riwayat Permintaan - Prototipe Pilar Pandawa\n");
  console.log("Diambil dari catatan sesi Claude Code.");
  console.log("Jumlah permintaan: **" + semua.length + "**");

  if (semua.length > 0) {
    console.log("Rentang waktu: " + semua[0].waktu +
                " sampai " + semua[semua.length - 1].waktu);
  }

  console.log("\n---\n");

  semua.forEach(function (p) {
    console.log("### " + p.nomor + ". " + p.waktu + "\n");
    console.log(p.teks + "\n");
  });

  console.error("Selesai. " + semua.length + " permintaan ditemukan dari " +
                berkas.length + " berkas sesi.");
}

jalan();
