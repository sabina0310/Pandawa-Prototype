/**
 * =====================================================================
 * METODE PEMBAYARAN (dipakai bersama Form Order & Form Perpanjang)
 * =====================================================================
 * Seluruh keterangan tentang metode pembayaran dikumpulkan di satu
 * berkas ini: nama, logo, kode bank untuk Midtrans, alamat simulator
 * sandbox, dan langkah pembayarannya.
 *
 * Tujuannya supaya kedua form benar-benar sama. Bila suatu saat ada
 * bank baru, cukup menambah satu entri di sini dan kedua form ikut
 * berubah dengan sendirinya -- tidak ada markup yang perlu disalin.
 *
 * Pilihan pengguna disimpan di localStorage dengan kunci
 * "metodePembayaran", sehingga tetap sama dari langkah pertama sampai
 * halaman pembayaran, bahkan bila halaman dimuat ulang.
 * =====================================================================
 */

export const KUNCI_METODE = "metodePembayaran";
export const METODE_BAWAAN = "qris";

// ---------------------------------------------------------------------
// LOGO
// ---------------------------------------------------------------------
// Digambar sebagai SVG di dalam berkas ini, bukan diambil dari alamat
// gambar di internet. Dengan begitu logonya tidak pernah gagal dimuat,
// ukurannya selalu sama, dan tetap tajam di layar beresolusi tinggi.
// ---------------------------------------------------------------------

function wordmark(teks, warna, ukuran) {
  return '<svg viewBox="0 0 52 24" style="width:46px;height:21px" xmlns="http://www.w3.org/2000/svg" ' +
           'role="img" aria-label="' + teks + '">' +
           '<text x="26" y="17" text-anchor="middle" ' +
             'font-family="\'Plus Jakarta Sans\', Arial, sans-serif" ' +
             'font-size="' + (ukuran || 15) + '" font-weight="800" letter-spacing="-0.4" ' +
             'fill="' + warna + '">' + teks + '</text>' +
         '</svg>';
}

/** Logo QRIS: petak kode QR kecil di kiri, tulisan QRIS di kanan. */
function logoQris() {
  return '<svg viewBox="0 0 52 24" style="width:46px;height:21px" xmlns="http://www.w3.org/2000/svg" ' +
           'role="img" aria-label="QRIS">' +
           '<g fill="#1b1c1c">' +
             '<rect x="2" y="5" width="6" height="6" rx="1"/>' +
             '<rect x="2" y="13" width="6" height="6" rx="1"/>' +
             '<rect x="10" y="5" width="6" height="6" rx="1"/>' +
             '<rect x="10" y="15" width="3" height="4" rx="0.5"/>' +
             '<rect x="14" y="13" width="2" height="2" rx="0.5"/>' +
           '</g>' +
           '<text x="34" y="17" text-anchor="middle" ' +
             'font-family="\'Plus Jakarta Sans\', Arial, sans-serif" ' +
             'font-size="12" font-weight="800" letter-spacing="0.2" fill="#E4002B">QRIS</text>' +
         '</svg>';
}

// ---------------------------------------------------------------------
// DAFTAR METODE
// ---------------------------------------------------------------------

export const METODE = {
  va_bca: {
    kode: "va_bca",
    label: "BCA Virtual Account",
    singkat: "Virtual Account BCA",
    kategori: "va",
    bank: "bca",                 // dikirim ke Midtrans sebagai bank_transfer.bank
    logo: wordmark("BCA", "#0060AF"),
    simulator: "https://simulator.sandbox.midtrans.com/bca/va/index"
  },
  va_bri: {
    kode: "va_bri",
    label: "BRI Virtual Account",
    singkat: "Virtual Account BRI",
    kategori: "va",
    bank: "bri",
    logo: wordmark("BRI", "#00529C"),
    simulator: "https://simulator.sandbox.midtrans.com/openapi/va/index?bank=bri"
  },
  va_bni: {
    kode: "va_bni",
    label: "BNI Virtual Account",
    singkat: "Virtual Account BNI",
    kategori: "va",
    bank: "bni",
    logo: wordmark("BNI", "#F05A22"),
    simulator: "https://simulator.sandbox.midtrans.com/bni/va/index"
  },
  qris: {
    kode: "qris",
    label: "QRIS",
    singkat: "QRIS",
    kategori: "qris",
    bank: null,
    logo: logoQris(),
    simulator: "https://simulator.sandbox.midtrans.com/v2/qris/index"
  }
};

/** Urutan tampil: Virtual Account dulu, QRIS terakhir. */
export const URUTAN_VA = ["va_bca", "va_bri", "va_bni"];

/** Mengambil keterangan satu metode; selalu mengembalikan objek yang sah. */
export function infoMetode(kode) {
  return METODE[kode] || METODE[METODE_BAWAAN];
}

export function metodeVa(kode) {
  return infoMetode(kode).kategori === "va";
}

// ---------------------------------------------------------------------
// MENYIMPAN PILIHAN
// ---------------------------------------------------------------------

/** Menyimpan pilihan pengguna agar terbawa ke langkah berikutnya. */
export function simpanMetode(kode) {
  localStorage.setItem(KUNCI_METODE, infoMetode(kode).kode);
}

/** Membaca pilihan yang tersimpan. Bila belum ada, jawabannya QRIS. */
export function ambilMetode() {
  const tersimpan = localStorage.getItem(KUNCI_METODE);
  return METODE[tersimpan] ? tersimpan : METODE_BAWAAN;
}

// ---------------------------------------------------------------------
// TAMPILAN PILIHAN METODE
// ---------------------------------------------------------------------

function barisMetode(kode, terpilih) {
  const m = METODE[kode];

  return '<label class="flex items-center justify-between p-md hover:bg-surface-soft cursor-pointer ' +
           'border-b border-border-hairline last:border-0">' +
           '<div class="flex items-center gap-md">' +
             '<div class="w-14 h-8 bg-white border border-border-hairline rounded flex items-center justify-center">' +
               m.logo +
             '</div>' +
             '<span class="font-body-md text-ink-primary">' + m.label + '</span>' +
           '</div>' +
           '<input type="radio" name="payment_method" value="' + m.kode + '" ' +
             (kode === terpilih ? "checked " : "") +
             'class="w-5 h-5 text-primary-container focus:ring-primary-container border-border-strong">' +
         '</label>';
}

/**
 * Menggambar seluruh pilihan metode pembayaran ke dalam sebuah wadah.
 * Dipanggil oleh Form Order (langkah 1) dan Form Perpanjang (langkah 1)
 * dengan markup yang sama persis.
 *
 * @param {HTMLElement} wadah      - elemen tempat pilihan digambar
 * @param {Function}    saatBerubah - dipanggil dengan kode metode terpilih
 */
export function gambarPilihanMetode(wadah, saatBerubah) {
  if (!wadah) return;

  const terpilih = ambilMetode();
  const qris = METODE.qris;

  wadah.innerHTML =
    // --- Kelompok Virtual Account ---
    '<div class="payment-category border border-border-strong rounded-xl overflow-hidden transition-all ' +
      'bg-surface-canvas" data-category="va">' +
      '<div class="p-md flex items-center justify-between cursor-pointer hover:bg-surface-soft ' +
        'transition-colors" id="va-header">' +
        '<div class="flex items-center gap-md">' +
          '<div class="w-12 h-12 rounded-lg bg-surface-soft border border-border-hairline ' +
            'flex items-center justify-center text-primary-container">' +
            '<span class="material-symbols-outlined text-[24px]">account_balance</span></div>' +
          '<div class="flex flex-col">' +
            '<span class="font-title-md text-title-md text-ink-primary">Virtual Account</span>' +
            '<span class="font-body-sm text-body-sm text-ink-muted">BCA, BRI, BNI</span>' +
          '</div>' +
        '</div>' +
        '<span class="material-symbols-outlined text-ink-muted transition-transform duration-300" ' +
          'id="va-chevron">expand_more</span>' +
      '</div>' +
      '<div class="hidden flex-col bg-surface-container-lowest border-t border-border-hairline" id="va-content">' +
        URUTAN_VA.map(function (kode) { return barisMetode(kode, terpilih); }).join("") +
      '</div>' +
    '</div>' +

    // --- QRIS berdiri sendiri, tanpa akordeon ---
    '<label class="border border-border-strong rounded-xl p-md flex items-center justify-between ' +
      'bg-surface-canvas cursor-pointer hover:bg-surface-soft hover:border-primary-container transition-all">' +
      '<div class="flex items-center gap-md">' +
        '<div class="w-12 h-12 rounded-lg bg-surface-soft border border-border-hairline ' +
          'flex items-center justify-center">' + qris.logo + '</div>' +
        '<div class="flex flex-col">' +
          '<span class="font-title-md text-title-md text-ink-primary">QRIS</span>' +
          '<span class="font-body-sm text-body-sm text-ink-muted">Scan dari aplikasi M-Banking ' +
            'atau dompet digital mana pun</span>' +
        '</div>' +
      '</div>' +
      '<input type="radio" name="payment_method" value="qris" ' + (terpilih === "qris" ? "checked " : "") +
        'class="w-5 h-5 text-primary-container focus:ring-primary-container border-border-strong">' +
    '</label>';

  // --- Akordeon Virtual Account ---
  const kepala = wadah.querySelector("#va-header");
  const isi = wadah.querySelector("#va-content");
  const chevron = wadah.querySelector("#va-chevron");
  const kotak = wadah.querySelector('[data-category="va"]');

  function bukaVa(buka) {
    isi.classList.toggle("hidden", !buka);
    isi.classList.toggle("flex", buka);
    chevron.style.transform = buka ? "rotate(180deg)" : "rotate(0deg)";
    kotak.classList.toggle("border-primary-container", buka);
  }

  if (kepala) {
    kepala.addEventListener("click", function () {
      bukaVa(isi.classList.contains("hidden"));
    });
  }

  // Bila pilihan tersimpan berupa Virtual Account, akordeonnya
  // langsung terbuka supaya pengguna melihat pilihannya masih ada.
  bukaVa(metodeVa(terpilih));

  // --- Menyimpan setiap perubahan pilihan ---
  wadah.querySelectorAll('input[name="payment_method"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      if (!radio.checked) return;
      simpanMetode(radio.value);
      if (typeof saatBerubah === "function") saatBerubah(radio.value);
    });
  });

  // Pilihan bawaan ikut dicatat, supaya isi localStorage tidak pernah
  // kosong saat pengguna langsung menekan tombol lanjut.
  simpanMetode(terpilih);

  return terpilih;
}

// ---------------------------------------------------------------------
// LANGKAH PEMBAYARAN (khusus lingkungan uji / UAT)
// ---------------------------------------------------------------------

/**
 * Menyusun langkah pembayaran sesuai metode terpilih.
 *
 * Karena sistem ini memakai Midtrans SANDBOX, tidak ada uang sungguhan
 * yang berpindah. Pembayarannya diselesaikan pada Simulator Midtrans,
 * jadi langkah-langkahnya mengarahkan penguji ke sana.
 */
export function langkahPembayaran(kode) {
  const m = infoMetode(kode);

  if (m.kategori === "qris") {
    return [
      'Tekan tombol <strong>"Salin Data QR"</strong> di atas.',
      'Tekan <strong>"Buka Simulator Pembayaran"</strong>. Simulator QRIS Midtrans ' +
        'akan terbuka di tab baru.',
      'Tempelkan data QR yang tadi disalin pada kolom yang tersedia di simulator, ' +
        'lalu tekan tombol bayar di sana.',
      'Kembali ke halaman ini. Status akan terbaca sendiri dalam beberapa detik, ' +
        'atau tekan <strong>"Refresh Status Pembayaran"</strong>.'
    ];
  }

  return [
    'Tekan tombol <strong>"Salin Nomor VA"</strong> di atas.',
    'Tekan <strong>"Buka Simulator Pembayaran"</strong>. Simulator ' + m.label +
      ' akan terbuka di tab baru.',
    'Tempelkan nomor Virtual Account pada kolom yang tersedia, tekan <strong>Inquire</strong> ' +
      'untuk memeriksa tagihan, lalu tekan <strong>Pay</strong>.',
    'Kembali ke halaman ini. Status akan terbaca sendiri dalam beberapa detik, ' +
      'atau tekan <strong>"Refresh Status Pembayaran"</strong>.'
  ];
}
