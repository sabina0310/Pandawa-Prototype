/**
 * =====================================================================
 * MENYUSUN TRANSKRIP LENGKAP SESI CLAUDE CODE
 * =====================================================================
 * Berbeda dengan ambil-prompt.js yang hanya mengambil permintaan
 * pengguna, berkas ini menyusun SELURUH jalannya percakapan:
 *
 *     - permintaan pengguna
 *     - jawaban asisten
 *     - setiap pemanggilan tool beserta argumennya
 *     - hasil yang dikembalikan tool
 *
 * SUMBERNYA
 * Claude Code mencatat semuanya di
 *     C:\Users\<nama>\.claude\projects\<nama-proyek>\<id-sesi>.jsonl
 * Satu baris = satu peristiwa. Berkasnya berukuran puluhan MB.
 *
 * DUA HAL YANG TIDAK DISALIN APA ADANYA
 *
 *   1. Blok gambar. Tangkapan layar tersimpan sebagai data base64 yang
 *      panjangnya bisa ratusan ribu karakter. Yang ditulis hanya
 *      penandanya, bukan datanya.
 *
 *   2. Hasil tool yang sangat panjang. Pembacaan berkas dan hasil
 *      pengujian bisa ribuan baris. Secara bawaan dipotong; batasnya
 *      bisa diubah, atau dimatikan sama sekali.
 *
 * CARA PAKAI
 *   node ambil-transkrip.js                     -> bawaan, potong 2000 huruf
 *   node ambil-transkrip.js --batas=8000        -> potong lebih longgar
 *   node ambil-transkrip.js --penuh             -> tanpa potong sama sekali
 *   node ambil-transkrip.js --nalar             -> sertakan proses berpikir
 *   node ambil-transkrip.js --pisah             -> pecah per hari
 *
 * Hasilnya ditulis ke folder transkrip/.
 * =====================================================================
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------
// 1. PILIHAN DARI BARIS PERINTAH
// ---------------------------------------------------------------------
const argumen = process.argv.slice(2);
const punya = (nama) => argumen.some((a) => a === "--" + nama);
const angka = (nama, bawaan) => {
  const cocok = argumen.find((a) => a.startsWith("--" + nama + "="));
  return cocok ? Number(cocok.split("=")[1]) : bawaan;
};

const PENUH = punya("penuh");
const BATAS = PENUH ? Infinity : angka("batas", 2000);
const SERTAKAN_NALAR = punya("nalar");
const PISAH_PER_HARI = punya("pisah");

const KELUARAN = path.join(__dirname, "transkrip");

// ---------------------------------------------------------------------
// 2. MENCARI BERKAS CATATAN SESI
// ---------------------------------------------------------------------
const RUMAH = process.env.USERPROFILE || process.env.HOME;
const FOLDER = path.join(RUMAH, ".claude", "projects", "d--Pandawa-Prototype");

if (!fs.existsSync(FOLDER)) {
  console.error("Folder catatan sesi tidak ditemukan:\n  " + FOLDER);
  process.exit(1);
}

const berkasSesi = fs.readdirSync(FOLDER)
  .filter((n) => n.endsWith(".jsonl"))
  .map((n) => {
    const p = path.join(FOLDER, n);
    return { nama: n, jalur: p, waktu: fs.statSync(p).mtimeMs };
  })
  .sort((a, b) => a.waktu - b.waktu);

if (berkasSesi.length === 0) {
  console.error("Tidak ada berkas .jsonl di " + FOLDER);
  process.exit(1);
}

// ---------------------------------------------------------------------
// 3. FUNGSI BANTU
// ---------------------------------------------------------------------

/** Membuang sisipan otomatis yang bukan ketikan pengguna. */
function bersihkanSisipan(teks) {
  return String(teks)
    .replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "")
    .replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .trim();
}

/** Memotong teks yang terlalu panjang, dengan keterangan berapa yang dibuang. */
function potong(teks) {
  const isi = String(teks == null ? "" : teks);
  if (isi.length <= BATAS) return isi;

  const sisa = isi.length - BATAS;
  return isi.slice(0, BATAS) +
    "\n\n... [dipotong " + sisa.toLocaleString("id-ID") + " huruf lagi] ...";
}

/** Membungkus teks dalam blok kode Markdown, aman terhadap backtick di dalamnya. */
function blokKode(teks, bahasa) {
  const isi = String(teks == null ? "" : teks);
  // Pagar dibuat lebih panjang daripada rentetan backtick terpanjang di isinya
  const terpanjang = (isi.match(/`+/g) || []).reduce(
    (n, s) => Math.max(n, s.length), 0);
  const pagar = "`".repeat(Math.max(3, terpanjang + 1));
  return pagar + (bahasa || "") + "\n" + isi + "\n" + pagar;
}

/** Mengubah isi pesan menjadi daftar blok yang seragam. */
function bacaBlok(pesan) {
  const isi = pesan.content;
  if (typeof isi === "string") return [{ type: "text", text: isi }];
  return Array.isArray(isi) ? isi : [];
}

/** Ringkasan argumen pemanggilan tool, tanpa membanjiri halaman. */
function ringkasArgumen(nama, argumenTool) {
  const a = argumenTool || {};

  // Beberapa tool punya satu argumen utama yang paling menjelaskan
  if (nama === "Bash" || nama === "PowerShell") return a.command;
  if (nama === "Read") return a.file_path + (a.offset ? "  (mulai baris " + a.offset + ")" : "");
  if (nama === "Write") return a.file_path;
  if (nama === "Glob") return a.pattern + (a.path ? "   di " + a.path : "");
  if (nama === "Grep") return a.pattern + (a.path ? "   di " + a.path : "");

  if (nama === "Edit") {
    return a.file_path +
      "\n\n--- diganti dari ---\n" + potong(a.old_string) +
      "\n\n--- menjadi ---\n" + potong(a.new_string);
  }

  return JSON.stringify(a, null, 2);
}

/** Isi hasil tool, dengan gambar diganti penanda. */
function bacaHasilTool(blok) {
  const isi = blok.content;

  if (typeof isi === "string") return isi;

  if (Array.isArray(isi)) {
    return isi.map(function (b) {
      if (b.type === "image") {
        const ukuran = b.source && b.source.data ? b.source.data.length : 0;
        return "[gambar — " + Math.round(ukuran / 1024) + " KB, tidak disalin ke transkrip]";
      }
      return b.text || "";
    }).join("\n");
  }

  return "";
}

// ---------------------------------------------------------------------
// 4. MEMBACA SELURUH PERISTIWA
// ---------------------------------------------------------------------
async function bacaPeristiwa(info) {
  const hasil = [];
  const aliran = readline.createInterface({
    input: fs.createReadStream(info.jalur),
    crlfDelay: Infinity
  });

  // Nama tool disimpan agar hasilnya nanti bisa diberi label yang benar
  const namaTool = {};

  for await (const baris of aliran) {
    let data;
    try { data = JSON.parse(baris); } catch (err) { continue; }

    if (data.type !== "user" && data.type !== "assistant") continue;
    if (!data.message) continue;

    const waktu = (data.timestamp || "").slice(0, 19).replace("T", " ");

    for (const blok of bacaBlok(data.message)) {
      if (data.type === "user") {
        if (blok.type === "tool_result") {
          hasil.push({
            jenis: "hasil",
            waktu: waktu,
            tool: namaTool[blok.tool_use_id] || "Tool",
            galat: blok.is_error === true,
            isi: bacaHasilTool(blok)
          });
          continue;
        }

        if (blok.type === "image") {
          hasil.push({ jenis: "gambar-pengguna", waktu: waktu });
          continue;
        }

        const teks = bersihkanSisipan(blok.text || "");
        // Perintah garis miring bukan permintaan, tetapi tetap dicatat
        const perintah = /<command-name>([\s\S]*?)<\/command-name>/.exec(blok.text || "");
        if (perintah) {
          hasil.push({ jenis: "perintah", waktu: waktu, isi: perintah[1].trim() });
          continue;
        }
        if (teks) hasil.push({ jenis: "permintaan", waktu: waktu, isi: teks });
        continue;
      }

      // --- asisten ---
      if (blok.type === "text" && blok.text && blok.text.trim()) {
        hasil.push({ jenis: "jawaban", waktu: waktu, isi: blok.text });
      } else if (blok.type === "thinking" && SERTAKAN_NALAR) {
        hasil.push({ jenis: "nalar", waktu: waktu, isi: blok.thinking || "" });
      } else if (blok.type === "tool_use") {
        namaTool[blok.id] = blok.name;
        hasil.push({
          jenis: "panggil",
          waktu: waktu,
          tool: blok.name,
          isi: ringkasArgumen(blok.name, blok.input)
        });
      }
    }
  }

  return hasil;
}

// ---------------------------------------------------------------------
// 5. MENULIS SATU PERISTIWA MENJADI MARKDOWN
// ---------------------------------------------------------------------
function tulisPeristiwa(p, nomorPermintaan) {
  const baris = [];

  switch (p.jenis) {
    case "permintaan":
      baris.push("\n---\n");
      baris.push("## " + nomorPermintaan + ". Permintaan Pengguna");
      baris.push("*" + p.waktu + "*\n");
      baris.push("> " + p.isi.split("\n").join("\n> "));
      break;

    case "perintah":
      baris.push("\n**Perintah:** `/" + p.isi.replace(/^\//, "") + "`  \n*" + p.waktu + "*");
      break;

    case "gambar-pengguna":
      baris.push("\n**Pengguna melampirkan sebuah gambar.**  \n*" + p.waktu + "*");
      break;

    case "jawaban":
      baris.push("\n### Jawaban Asisten");
      baris.push("*" + p.waktu + "*\n");
      baris.push(potong(p.isi));
      break;

    case "nalar":
      baris.push("\n<details><summary>Proses berpikir</summary>\n");
      baris.push(blokKode(potong(p.isi)));
      baris.push("\n</details>");
      break;

    case "panggil":
      baris.push("\n**Memanggil tool `" + p.tool + "`**  \n*" + p.waktu + "*\n");
      baris.push(blokKode(potong(p.isi)));
      break;

    case "hasil":
      baris.push("\n**Hasil `" + p.tool + "`" +
        (p.galat ? " — GAGAL" : "") + "**\n");
      baris.push(blokKode(potong(p.isi)));
      break;
  }

  return baris.join("\n");
}

// ---------------------------------------------------------------------
// 6. PROSES UTAMA
// ---------------------------------------------------------------------
async function jalan() {
  let semua = [];
  for (const info of berkasSesi) {
    semua = semua.concat(await bacaPeristiwa(info));
  }

  if (semua.length === 0) {
    console.error("Tidak ada peristiwa yang terbaca.");
    process.exit(1);
  }

  fs.mkdirSync(KELUARAN, { recursive: true });

  const jumlah = {};
  semua.forEach((p) => { jumlah[p.jenis] = (jumlah[p.jenis] || 0) + 1; });

  const kepala = [
    "# Transkrip Lengkap — Prototipe Pilar Pandawa",
    "",
    "Disusun dari catatan sesi Claude Code.",
    "",
    "| Keterangan | Jumlah |",
    "|---|---|",
    "| Permintaan pengguna | " + (jumlah.permintaan || 0) + " |",
    "| Jawaban asisten | " + (jumlah.jawaban || 0) + " |",
    "| Pemanggilan tool | " + (jumlah.panggil || 0) + " |",
    "| Hasil tool | " + (jumlah.hasil || 0) + " |",
    "",
    "Rentang waktu: " + semua[0].waktu + " sampai " + semua[semua.length - 1].waktu,
    "",
    "Batas panjang tiap blok: " +
      (PENUH ? "tanpa batas" : BATAS.toLocaleString("id-ID") + " huruf") +
      ". Proses berpikir " + (SERTAKAN_NALAR ? "disertakan" : "tidak disertakan") + ".",
    ""
  ].join("\n");

  // --- Dipecah per hari, atau satu berkas utuh ---
  const perHari = {};
  let nomor = 0;

  semua.forEach(function (p) {
    if (p.jenis === "permintaan") nomor++;
    const hari = (p.waktu || "").slice(0, 10) || "tanpa-tanggal";
    if (!perHari[hari]) perHari[hari] = [];
    perHari[hari].push(tulisPeristiwa(p, nomor));
  });

  const daftarHari = Object.keys(perHari).sort();
  const dibuat = [];

  if (PISAH_PER_HARI) {
    daftarHari.forEach(function (hari) {
      const nama = "transkrip-" + hari + ".md";
      const jalur = path.join(KELUARAN, nama);
      fs.writeFileSync(jalur,
        "# Transkrip " + hari + " — Prototipe Pilar Pandawa\n" +
        perHari[hari].join("\n"), "utf8");
      dibuat.push(jalur);
    });

    // Daftar isi
    const isi = ["# Transkrip Lengkap — Prototipe Pilar Pandawa", "",
      "Dipecah per hari.", ""]
      .concat(daftarHari.map((h) => "- [" + h + "](transkrip-" + h + ".md)"));
    const jalurIsi = path.join(KELUARAN, "daftar-isi.md");
    fs.writeFileSync(jalurIsi, isi.join("\n"), "utf8");
    dibuat.push(jalurIsi);

  } else {
    const jalur = path.join(KELUARAN, "transkrip-lengkap.md");
    const badan = daftarHari.map((h) => perHari[h].join("\n")).join("\n");
    fs.writeFileSync(jalur, kepala + badan, "utf8");
    dibuat.push(jalur);
  }

  console.error("Selesai.");
  dibuat.forEach(function (j) {
    const mb = fs.statSync(j).size / 1024 / 1024;
    console.error("  " + path.relative(__dirname, j) + "   " + mb.toFixed(2) + " MB");
  });
  console.error("\n  permintaan " + (jumlah.permintaan || 0) +
    " | jawaban " + (jumlah.jawaban || 0) +
    " | panggil tool " + (jumlah.panggil || 0) +
    " | hasil " + (jumlah.hasil || 0));
}

jalan();
