/**
 * =====================================================================
 * PEMBUAT KUITANSI PDF (dipakai bersama)
 * =====================================================================
 * Menghasilkan berkas PDF dengan BENTUK YANG SAMA PERSIS seperti tombol
 * "Unduh Bukti Pemesanan" pada customer/order/step-4.html:
 *
 *   1. Susunan kuitansi digambar dulu sebagai HTML biasa di luar layar
 *   2. html2canvas memotret susunan itu menjadi gambar
 *   3. jsPDF menempelkan gambar tersebut ke halaman A4 lalu mengunduhnya
 *
 * Bedanya hanya sumber datanya: di step-4 datanya dari localStorage
 * (pesanan yang baru saja dibuat), sedangkan di sini datanya dari
 * dokumen Firestore, sehingga pesanan lama pun tetap bisa dicetak.
 *
 * Halaman yang memakai modul ini WAJIB memuat dua pustaka berikut
 * sebelum modulnya, sama seperti pada step-4.html:
 *   <script src=".../html2canvas.min.js"></script>
 *   <script src=".../jspdf.umd.min.js"></script>
 * =====================================================================
 */

import {
  formatRupiah, labelDurasi, labelMetodeBayar, amankanTeks
} from "./admin-util.js";

// ---------------------------------------------------------------------
// RINCIAN BIAYA
// ---------------------------------------------------------------------

/**
 * Memecah total pembayaran menjadi sewa kamar + biaya layanan.
 *
 * Yang tersimpan di Firestore hanyalah order_amount (total yang benar
 * benar dibayar). Biaya layanannya diambil dari data cabang, lalu
 * sisanya dianggap harga sewa -- cara yang sama dipakai saat pesanan
 * dibuat, jadi hasilnya cocok dengan yang dulu ditagihkan.
 */
function rincianBiaya(transaksi, cabang) {
  const total = Number(transaksi.order_amount || 0);
  const layanan = cabang ? Number(cabang.biaya_layanan || 0) : 0;
  const sewa = total - layanan;

  // Bila biaya layanan cabang sudah berubah sejak pesanan dibuat,
  // pemecahannya bisa tidak masuk akal. Dalam keadaan itu kuitansi
  // cukup menampilkan satu baris agar angkanya tidak menyesatkan.
  if (layanan <= 0 || sewa <= 0) {
    return [{ label: "Sewa Kamar (" + labelDurasi(transaksi) + ")", nilai: total }];
  }

  return [
    { label: "Sewa Kamar (" + labelDurasi(transaksi) + ")", nilai: sewa },
    { label: "Biaya Layanan", nilai: layanan }
  ];
}

// ---------------------------------------------------------------------
// SUSUNAN KUITANSI
// ---------------------------------------------------------------------

/**
 * Membangun potongan HTML kuitansi. Gaya tulisannya sengaja ditulis
 * langsung pada tiap elemen (bukan class Tailwind) karena html2canvas
 * memotret elemen apa adanya, sehingga hasilnya tidak bergantung pada
 * CSS halaman yang memanggilnya.
 */
function susunKuitansi(transaksi, cabang) {
  const namaCabang = cabang ? cabang.nama_cabang : "Cabang tidak ditemukan";
  const nomorKamar = transaksi.kamar_id ? transaksi.kamar_id : "Ditentukan admin";
  const tipeSewa = transaksi.tipe_sewa === "bulanan" ? "BULANAN" : "HARIAN";
  const metode = labelMetodeBayar(transaksi.payment_type);

  const baris = rincianBiaya(transaksi, cabang).map(function (item) {
    return '<div style="display:flex; justify-content:space-between; font-size:13px; padding:8px 0; border-bottom:1px solid #eaecf0;">' +
             '<span style="color:#3f3f3f;">' + amankanTeks(item.label) + '</span>' +
             '<span style="font-weight:600;">' + formatRupiah(item.nilai) + '</span>' +
           '</div>';
  }).join("");

  return '' +
    '<div style="width:700px; padding:40px; background:#ffffff; font-family:\'Plus Jakarta Sans\', sans-serif; color:#1b1c1c;">' +

      // --- Kepala kuitansi ---
      '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
        '<div>' +
          '<div style="font-size:22px; font-weight:700; color:#0040a6;">Pilar Pandawa</div>' +
          '<div style="font-size:13px; color:#6a6a6a; margin-top:2px;">Professional Boarding House Management</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:14px; font-weight:700; letter-spacing:0.5px; color:#674000; text-transform:uppercase;">Kuitansi Pembayaran</div>' +
          '<div style="display:inline-block; margin-top:6px; background:#f0eded; color:#6a6a6a; font-size:11px; padding:3px 10px; border-radius:4px;">' +
            amankanTeks(transaksi.order_id) + '</div>' +
        '</div>' +
      '</div>' +

      '<hr style="border:none; border-top:1px solid #dddddd; margin:20px 0;">' +

      // --- Data penyewa & detail kamar ---
      '<div style="display:flex; gap:32px;">' +
        '<div style="flex:1;">' +
          '<div style="font-size:11px; font-weight:700; letter-spacing:0.5px; color:#674000; text-transform:uppercase; margin-bottom:10px;">Data Penyewa</div>' +
          '<div style="font-size:12px; color:#6a6a6a; margin-bottom:2px;">Nama Lengkap</div>' +
          '<div style="font-size:14px; font-weight:600; margin-bottom:10px;">' + amankanTeks(transaksi.nama_penyewa || "-") + '</div>' +
          '<div style="font-size:12px; color:#6a6a6a; margin-bottom:2px;">WhatsApp</div>' +
          '<div style="font-size:14px; margin-bottom:10px;">' + amankanTeks(transaksi.kontak_penyewa || "-") + '</div>' +
          '<div style="font-size:12px; color:#6a6a6a; margin-bottom:2px;">NIK</div>' +
          '<div style="font-size:14px;">' + amankanTeks(transaksi.nik_penyewa || "-") + '</div>' +
        '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:11px; font-weight:700; letter-spacing:0.5px; color:#674000; text-transform:uppercase; margin-bottom:10px;">Detail Kamar</div>' +
          '<div style="font-size:12px; color:#6a6a6a; margin-bottom:2px;">Cabang</div>' +
          '<div style="font-size:14px; font-weight:600; margin-bottom:10px;">' + amankanTeks(namaCabang) + '</div>' +
          '<div style="display:flex; gap:24px;">' +
            '<div>' +
              '<div style="font-size:12px; color:#6a6a6a; margin-bottom:2px;">Nomor Kamar</div>' +
              '<div style="font-size:14px; font-weight:600;">' + amankanTeks(nomorKamar) + '</div>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:12px; color:#6a6a6a; margin-bottom:2px;">Tipe</div>' +
              '<div style="display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; background:#f0eded; color:#3f3f3f; padding:2px 8px; border-radius:4px;">' +
                tipeSewa + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<hr style="border:none; border-top:1px solid #dddddd; margin:20px 0;">' +

      // --- Detail transaksi ---
      '<div style="font-size:11px; font-weight:700; letter-spacing:0.5px; color:#674000; text-transform:uppercase; margin-bottom:10px;">Detail Transaksi</div>' +
      '<div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#6a6a6a; text-transform:uppercase; border-bottom:1px solid #dddddd; padding-bottom:8px; margin-bottom:4px;">' +
        '<span>Deskripsi</span><span>Jumlah</span>' +
      '</div>' +
      baris +
      '<div style="display:flex; justify-content:space-between; align-items:center; background:#e8f0fe; padding:10px 12px; border-radius:6px; margin-top:8px;">' +
        '<span style="font-size:13px; font-weight:700; color:#1b1c1c;">Total Pembayaran</span>' +
        '<span style="font-size:16px; font-weight:700; color:#0040a6;">' + formatRupiah(transaksi.order_amount) + '</span>' +
      '</div>' +
      '<div style="text-align:center; font-size:12px; font-weight:700; color:#10b981; text-transform:uppercase; margin-top:12px;">' +
        'Lunas - Pembayaran via ' + amankanTeks(metode) + '</div>' +

      // --- Informasi penting ---
      '<div style="display:flex; gap:10px; align-items:flex-start; background:#f6f3f2; border-radius:8px; padding:12px 14px; margin-top:24px;">' +
        '<div style="font-size:13px; font-weight:700; color:#1b1c1c;">&#9432;</div>' +
        '<div>' +
          '<div style="font-size:13px; font-weight:700; margin-bottom:6px;">Informasi Penting</div>' +
          '<ul style="margin:0; padding-left:16px; font-size:12px; color:#3f3f3f; line-height:1.6;">' +
            '<li>Waktu Check-in: 14:00 WIB, Check-out: 12:00 WIB.</li>' +
            '<li>' + (transaksi.kamar_id
                        ? "Akses WiFi ditanyakan kepada petugas cabang."
                        : "Nomor kamar dan akses WiFi diberikan petugas saat check-in.") + '</li>' +
            '<li>Hubungi Pengelola Cabang: +62 811-9876-5432 untuk bantuan.</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +

    '</div>';
}

// ---------------------------------------------------------------------
// PROSES UNDUH
// ---------------------------------------------------------------------

/**
 * Membuat lalu mengunduh kuitansi PDF satu pesanan.
 *
 * @param {Object} transaksi - satu dokumen transaksi_pemesanan
 * @param {Object} cabang    - dokumen cabang terkait (boleh null)
 * @param {HTMLElement} tombol - tombol pemicu, agar bisa diberi
 *                               keterangan "Menyiapkan PDF..."
 */
export async function unduhKuitansi(transaksi, cabang, tombol) {
  if (typeof window.html2canvas !== "function" ||
      !window.jspdf || typeof window.jspdf.jsPDF !== "function") {
    alert("Pustaka pembuat PDF belum termuat. Periksa koneksi internet Anda, lalu muat ulang halaman.");
    return;
  }

  const teksAsli = tombol ? tombol.innerHTML : null;
  if (tombol) {
    tombol.disabled = true;
    tombol.classList.add("opacity-60", "cursor-not-allowed");
    tombol.innerHTML =
      '<span class="material-symbols-outlined text-[18px]">hourglass_top</span>Menyiapkan PDF...';
  }

  // Kuitansi digambar di luar layar supaya tidak mengganggu tampilan,
  // lalu dibuang lagi setelah dipotret.
  const wadah = document.createElement("div");
  wadah.style.cssText = "position:fixed; top:0; left:-9999px; z-index:-1;";
  wadah.innerHTML = susunKuitansi(transaksi, cabang);
  document.body.appendChild(wadah);

  try {
    const kanvas = await window.html2canvas(wadah.firstElementChild, {
      scale: 2,
      backgroundColor: "#ffffff"
    });

    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF("p", "pt", "a4");
    const lebarHalaman = pdf.internal.pageSize.getWidth();
    const tinggiGambar = (kanvas.height * lebarHalaman) / kanvas.width;

    pdf.addImage(kanvas.toDataURL("image/png"), "PNG", 0, 0, lebarHalaman, tinggiGambar);
    pdf.save("Kuitansi-" + String(transaksi.order_id || "pesanan").replace(/\//g, "-") + ".pdf");

  } catch (err) {
    console.error("Gagal membuat kuitansi PDF:", err);
    alert("Gagal membuat PDF. Silakan coba lagi.");

  } finally {
    wadah.remove();
    if (tombol) {
      tombol.disabled = false;
      tombol.classList.remove("opacity-60", "cursor-not-allowed");
      tombol.innerHTML = teksAsli;
    }
  }
}
