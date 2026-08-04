/**
 * =====================================================================
 * FUNGSI BANTU FORMAT TAMPILAN (dipakai bersama)
 * =====================================================================
 * Dipisah ke file sendiri supaya tidak ditulis ulang di tiap halaman.
 * =====================================================================
 */

/**
 * Mengubah angka menjadi format rupiah lengkap.
 * Contoh: 150000 -> "Rp 150.000"
 */
export function formatRupiah(angka) {
  return "Rp " + Number(angka || 0).toLocaleString("id-ID");
}

/**
 * Mengubah angka menjadi format rupiah singkat untuk kartu katalog.
 * Contoh: 150000 -> "Rp 150K"   |   1500000 -> "Rp 1.5M"
 */
export function formatRupiahSingkat(angka) {
  const nilai = Number(angka || 0);

  if (nilai >= 1000000) {
    const juta = nilai / 1000000;
    // Hilangkan ",0" pada angka bulat (2.0M menjadi 2M)
    return "Rp " + (juta % 1 === 0 ? juta : juta.toFixed(1)) + "M";
  }

  if (nilai >= 1000) {
    return "Rp " + Math.round(nilai / 1000) + "K";
  }

  return "Rp " + nilai;
}

/**
 * Mengubah satuan harga menjadi sufiks yang tampil di kartu.
 * Contoh: "bulan" -> "/bln"   |   "hari" -> "/hari"
 */
export function satuanSingkat(satuan) {
  return satuan === "bulan" ? "/bln" : "/hari";
}

/**
 * Menentukan ikon Material Symbols yang cocok untuk sebuah fasilitas.
 * Bila nama fasilitas belum terdaftar, dipakai ikon centang sebagai cadangan.
 */
const PETA_IKON_FASILITAS = {
  "WiFi": "wifi",
  "WiFi Gratis": "wifi",
  "AC": "ac_unit",
  "Kasur Springbed": "bed",
  "Meja Kerja": "desk",
  "Kamar Mandi Dalam": "shower",
  "TV": "tv",
  "Water Heater": "water_heater",
  "Kulkas Mini": "kitchen",
  "Parkir Kendaraan": "local_parking",
  "CCTV 24 Jam": "videocam",
  "Dapur Bersama": "soup_kitchen",
  "Laundry": "local_laundry_service",
  "Keamanan Malam": "security"
};

export function ikonFasilitas(namaFasilitas) {
  return PETA_IKON_FASILITAS[namaFasilitas] || "check_circle";
}
