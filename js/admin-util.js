/**
 * =====================================================================
 * FUNGSI BANTU BERSAMA UNTUK HALAMAN ADMIN & SUPER ADMIN
 * =====================================================================
 * Berisi hal-hal yang dipakai berulang di banyak halaman:
 * format tanggal, format rupiah, penerjemahan istilah Midtrans ke
 * bahasa Indonesia, dan perhitungan sisa hari menuju jatuh tempo.
 *
 * Ditulis terpisah supaya tiap halaman tidak menulis ulang kode
 * yang sama, dan supaya definisinya konsisten satu sama lain.
 * =====================================================================
 */

// Batas "mendekati jatuh tempo" = 7 hari ke depan.
// Dipakai bersama oleh dashboard, bookings, dan financials agar
// angkanya selalu sama di semua halaman.
export const HARI_JATUH_TEMPO = 7;

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// ---------------------------------------------------------------------
// TANGGAL
// ---------------------------------------------------------------------

/** Mengubah Timestamp Firestore menjadi objek Date biasa. */
export function keDate(nilai) {
  if (!nilai) return null;
  return typeof nilai.toDate === "function" ? nilai.toDate() : new Date(nilai);
}

/** Contoh hasil: "15 Okt 2025" */
export function formatTanggal(nilai) {
  const d = keDate(nilai);
  if (!d) return "-";
  return d.getDate() + " " + NAMA_BULAN[d.getMonth()] + " " + d.getFullYear();
}

/** Contoh hasil: "15 Okt 2025, 14:30 WIB" */
export function formatTanggalJam(nilai) {
  const d = keDate(nilai);
  if (!d) return "-";
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return formatTanggal(d) + ", " + jam + ":" + menit + " WIB";
}

/** Contoh hasil: "14:00 WIB" */
export function formatJam(nilai) {
  const d = keDate(nilai);
  if (!d) return "-";
  return String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0") + " WIB";
}

/** Membuang jam/menit agar dua tanggal bisa dibandingkan per hari. */
export function awalHari(nilai) {
  const d = keDate(nilai);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** true bila tanggal tersebut jatuh pada hari ini. */
export function tanggalHariIni(nilai) {
  const d = awalHari(nilai);
  if (!d) return false;
  return d.getTime() === awalHari(new Date()).getTime();
}

/** Selisih hari dari hari ini. Hasil positif = masih akan datang. */
export function sisaHari(nilai) {
  const d = awalHari(nilai);
  if (!d) return null;
  const selisih = d.getTime() - awalHari(new Date()).getTime();
  return Math.round(selisih / (1000 * 60 * 60 * 24));
}

/** Contoh hasil: "Hari Ini", "Besok", "5 Hari Lagi", "Lewat 2 Hari" */
export function labelSisaHari(nilai) {
  const n = sisaHari(nilai);
  if (n === null) return "-";
  if (n < 0) return "Lewat " + Math.abs(n) + " Hari";
  if (n === 0) return "Hari Ini";
  if (n === 1) return "Besok";
  return n + " Hari Lagi";
}

/** Lama sewa dalam kalimat singkat, contoh: "3 Bulan" atau "5 Hari". */
export function labelDurasi(transaksi) {
  const masuk = awalHari(transaksi.tanggal_checkin);
  const keluar = awalHari(transaksi.tanggal_checkout);
  if (!masuk || !keluar) return "-";

  const jumlahHari = Math.round((keluar - masuk) / (1000 * 60 * 60 * 24));
  if (transaksi.tipe_sewa === "bulanan") {
    return Math.max(1, Math.round(jumlahHari / 30)) + " Bulan";
  }
  return Math.max(1, jumlahHari) + " Hari";
}

/** Lama sewa sebagai angka, dipakai untuk menghitung harga satuan. */
export function hitungDurasi(transaksi) {
  const masuk = awalHari(transaksi.tanggal_checkin);
  const keluar = awalHari(transaksi.tanggal_checkout);
  if (!masuk || !keluar) return 1;

  const jumlahHari = Math.round((keluar - masuk) / (1000 * 60 * 60 * 24));
  if (transaksi.tipe_sewa === "bulanan") {
    return Math.max(1, Math.round(jumlahHari / 30));
  }
  return Math.max(1, jumlahHari);
}

// ---------------------------------------------------------------------
// UANG
// ---------------------------------------------------------------------

/** Contoh hasil: "Rp 515.000" */
export function formatRupiah(angka) {
  return "Rp " + Number(angka || 0).toLocaleString("id-ID");
}

// ---------------------------------------------------------------------
// PENERJEMAHAN ISTILAH MIDTRANS
// ---------------------------------------------------------------------

const LABEL_METODE = {
  qris: "QRIS",
  bank_transfer: "Transfer Bank",
  gopay: "E-Wallet (GoPay)",
  echannel: "Virtual Account",
  credit_card: "Kartu Kredit"
};

/** Mengubah payment_type Midtrans menjadi teks yang dibaca admin. */
export function labelMetodeBayar(kode) {
  return LABEL_METODE[kode] || kode || "-";
}

const LABEL_STATUS = {
  settlement: "LUNAS",
  capture: "LUNAS",
  pending: "BELUM BAYAR",
  deny: "DITOLAK",
  expire: "KADALUARSA",
  cancel: "DIBATALKAN"
};

/** Mengubah transaction_status Midtrans menjadi teks yang dibaca admin. */
export function labelStatusBayar(kode) {
  return LABEL_STATUS[kode] || String(kode || "-").toUpperCase();
}

/** Warna badge Tailwind untuk tiap status pembayaran. */
export function kelasStatusBayar(kode) {
  if (kode === "settlement" || kode === "capture") {
    return "bg-status-available/10 text-status-available";
  }
  if (kode === "pending") {
    return "bg-status-warning/10 text-status-warning";
  }
  return "bg-surface-variant text-ink-secondary";
}

/** true untuk status yang berarti pembayaran gagal / tidak jadi. */
export function statusGagal(kode) {
  return kode === "deny" || kode === "expire" || kode === "cancel";
}

/** true untuk status yang berarti uang sudah diterima. */
export function statusLunas(kode) {
  return kode === "settlement" || kode === "capture";
}

// ---------------------------------------------------------------------
// TEKS
// ---------------------------------------------------------------------

/** Mengambil huruf depan nama, contoh: "Budi Santoso" -> "BS" */
export function inisial(nama) {
  return String(nama || "?")
    .trim()
    .split(/\s+/)
    .map(function (bagian) { return bagian.charAt(0); })
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Membersihkan teks sebelum dimasukkan ke innerHTML.
 * Data dummy memang aman, tapi kebiasaan ini mencegah tampilan rusak
 * bila nanti ada nama atau alamat yang mengandung tanda < atau &.
 */
export function amankanTeks(teks) {
  return String(teks === null || teks === undefined ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Membuat tautan chat WhatsApp dari nomor kontak penyewa. */
export function tautanWa(kontak) {
  const angka = String(kontak || "").replace(/[^0-9]/g, "").replace(/^0/, "62");
  return angka ? "https://wa.me/" + angka : "#";
}

// ---------------------------------------------------------------------
// TAMPILAN LOADING & ERROR
// ---------------------------------------------------------------------

/** Menampilkan satu baris pesan di dalam <tbody> sebuah tabel. */
export function pesanTabel(tbody, pesan, jumlahKolom, jenis) {
  const warna = jenis === "error" ? "text-error" : "text-ink-muted";
  tbody.innerHTML =
    '<tr><td colspan="' + jumlahKolom + '" class="px-lg py-xl text-center ' + warna + ' text-body-sm">' +
    amankanTeks(pesan) + "</td></tr>";
}

/** Menampilkan pesan singkat di dalam sebuah elemen biasa. */
export function pesanKotak(elemen, pesan, jenis) {
  if (!elemen) return;
  const warna = jenis === "error" ? "text-error" : "text-ink-muted";
  elemen.innerHTML =
    '<div class="py-xl text-center ' + warna + ' text-body-sm">' + amankanTeks(pesan) + "</div>";
}

/**
 * Menampilkan pesan error yang jelas ke layar sekaligus ke console.
 * Dipakai di blok catch tiap halaman supaya penyebabnya mudah dilacak.
 */
export function tampilkanError(err, tampilkan) {
  console.error("Gagal memuat data Firestore:", err);

  let pesan = "Gagal memuat data dari server.";
  if (String(err && err.code).includes("permission-denied")) {
    pesan = "Akses ke database ditolak. Periksa Firestore Security Rules.";
  } else if (String(err && err.code).includes("unavailable")) {
    pesan = "Tidak dapat terhubung ke database. Periksa koneksi internet.";
  }

  if (typeof tampilkan === "function") tampilkan(pesan);
  return pesan;
}
