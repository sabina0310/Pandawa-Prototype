/**
 * =====================================================================
 * HALAMAN PEMBAYARAN (dipakai bersama Form Order & Form Perpanjang)
 * =====================================================================
 * Satu berkas ini menggambar dan menjalankan SELURUH halaman bayar:
 *
 *   - QRIS           -> kode QR + tombol "Salin Data QR"
 *   - Virtual Account -> nomor VA + tombol "Salin Nomor VA"
 *
 * Karena keduanya digambar dari sini, halaman bayar Form Order dan
 * Form Perpanjang dijamin sama persis. Yang membedakan hanya apa yang
 * dikerjakan setelah pembayaran lunas, dan itu dititipkan lewat
 * fungsi "saatLunas" pada pengaturan.
 *
 * Pembayaran diselesaikan di Simulator Midtrans Sandbox, jadi tiap
 * metode menyediakan tombol menuju simulatornya masing-masing.
 * =====================================================================
 */

import { infoMetode, metodeVa, langkahPembayaran, ambilMetode } from "./metode-bayar.js";

const JEDA_POLLING = 5000;   // 5 detik

function el(id) { return document.getElementById(id); }

function formatRupiah(angka) {
  return "Rp " + Number(angka || 0).toLocaleString("id-ID");
}

// ---------------------------------------------------------------------
// MENYALIN TEKS KE PAPAN KLIP
// ---------------------------------------------------------------------
// Clipboard API hanya bekerja pada halaman aman (https / localhost),
// jadi disediakan cara cadangan agar tombol salin tetap berguna saat
// halaman dibuka langsung dari berkas.
// ---------------------------------------------------------------------
async function salinTeks(teks) {
  if (!teks) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch (err) {
    // diabaikan, memakai cara cadangan di bawah
  }

  const kotak = document.createElement("textarea");
  kotak.value = teks;
  kotak.style.position = "fixed";
  kotak.style.opacity = "0";
  document.body.appendChild(kotak);
  kotak.select();

  let berhasil = false;
  try {
    berhasil = document.execCommand("copy");
  } catch (err) {
    berhasil = false;
  }

  kotak.remove();
  return berhasil;
}

/** Mengubah tombol menjadi "Tersalin!" sejenak, lalu mengembalikannya. */
function tandaiTersalin(tombol, ikonAwal, teksAwal) {
  const ikon = tombol.querySelector(".material-symbols-outlined");
  const teks = tombol.querySelector("[data-teks]");
  if (ikon) ikon.textContent = "check";
  if (teks) teks.textContent = "Tersalin!";

  setTimeout(function () {
    if (ikon) ikon.textContent = ikonAwal;
    if (teks) teks.textContent = teksAwal;
  }, 2000);
}

// =====================================================================
// 1. MENGGAMBAR KARTU PEMBAYARAN
// =====================================================================

function tombolKecil(id, ikon, teks, utama) {
  const gaya = utama
    ? "border border-primary text-primary hover:bg-primary/5"
    : "bg-surface-container-high text-on-surface hover:bg-surface-variant border border-border-hairline";

  return '<button type="button" id="' + id + '" class="flex items-center justify-center gap-xs ' +
           'px-base py-sm rounded font-button-md transition-colors ' +
           'disabled:opacity-60 disabled:cursor-not-allowed ' + gaya + '">' +
           '<span class="material-symbols-outlined text-[18px]">' + ikon + '</span>' +
           '<span data-teks>' + teks + '</span>' +
         '</button>';
}

function kotakQris() {
  return '<div class="bg-white p-4 rounded-lg border border-border-hairline shadow-sm mb-md ' +
           'flex flex-col items-center min-h-[240px] justify-center w-full max-w-[360px]">' +
           '<div class="flex flex-col items-center gap-sm text-ink-muted" id="qrisLoading">' +
             '<span class="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>' +
             '<span class="font-body-sm text-body-sm">Memuat kode QR...</span>' +
           '</div>' +
           '<img alt="Kode QRIS Pembayaran" class="w-72 h-72 object-contain hidden" id="qrisImage">' +
           '<canvas class="hidden" id="qrisCanvas"></canvas>' +
           '<div class="hidden flex-col items-center gap-sm text-error px-md" id="qrisError">' +
             '<span class="material-symbols-outlined text-[32px]">error</span>' +
             '<span class="font-body-sm text-body-sm" id="qrisErrorText">Kode QR tidak tersedia.</span>' +
           '</div>' +
         '</div>';
}

function kotakVa(m, nomor) {
  return '<div class="w-full max-w-[420px] bg-surface-soft border border-border-hairline rounded-lg ' +
           'p-lg mb-md flex flex-col items-center gap-sm">' +
           '<div class="w-16 h-10 bg-white border border-border-hairline rounded ' +
             'flex items-center justify-center">' + m.logo + '</div>' +
           '<span class="font-label-md text-label-md text-ink-muted">Nomor Virtual Account</span>' +
           '<span class="font-display-md text-display-md text-on-surface tracking-wider ' +
             'break-all text-center" id="nomorVaText" style="font-variant-numeric: tabular-nums;">' +
             (nomor || "-") + '</span>' +
           '<span class="font-body-sm text-body-sm text-ink-muted text-center">Nomor ini hanya ' +
             'berlaku untuk transaksi ini dan akan hangus setelah waktu habis.</span>' +
         '</div>';
}

function gambarKartu(wadah, data, m) {
  if (!wadah) return;

  const va = metodeVa(m.kode);

  const keterangan = va
    ? "Selesaikan pembayaran dengan mentransfer ke nomor Virtual Account di bawah ini melalui " +
      m.label + "."
    : "Scan kode QR di bawah ini menggunakan aplikasi M-Banking atau dompet digital mana pun.";

  // Tombol salin menyesuaikan metode: nomor VA atau data kode QR
  const tombolSalinUtama = va
    ? tombolKecil("salinVaBtn", "content_copy", "Salin Nomor VA")
    : tombolKecil("salinQrBtn", "content_copy", "Salin Data QR");

  const tombolUnduhQr = va ? "" :
    '<a id="downloadQrBtn" download="qris-pilar-pandawa.png" class="flex items-center justify-center ' +
      'gap-xs px-base py-sm rounded bg-surface-container-high text-on-surface hover:bg-surface-variant ' +
      'transition-colors font-button-md border border-border-hairline no-underline">' +
      '<span class="material-symbols-outlined text-[18px]">download</span>Unduh Kode QR</a>';

  wadah.innerHTML =
    '<div class="bg-surface-canvas border border-border-hairline rounded-xl shadow-sm p-lg ' +
      'flex flex-col items-center text-center">' +

      '<h2 class="font-display-md text-display-md text-on-surface mb-xs">Pembayaran via ' +
        m.label + '</h2>' +
      '<p class="font-body-sm text-body-sm text-on-surface-variant mb-md mx-auto max-w-2xl">' +
        keterangan + '</p>' +

      // --- Status & nomor pesanan ---
      '<div class="flex flex-wrap items-center justify-center gap-sm mb-md">' +
        '<span id="statusBadge" class="inline-flex items-center gap-xs bg-status-warning/10 ' +
          'text-status-warning border border-status-warning/30 px-md py-xs rounded-full ' +
          'font-badge text-badge">' +
          '<span class="material-symbols-outlined text-[16px]" id="statusBadgeIcon">schedule</span>' +
          '<span id="statusBadgeText">Menunggu Pembayaran</span>' +
        '</span>' +
        '<span class="font-body-sm text-body-sm text-on-surface-variant">ID Transaksi: ' +
          '<strong class="text-on-surface" id="orderIdText">' + (data.order_id || "-") + '</strong></span>' +
      '</div>' +

      // --- Isi utama: kode QR atau nomor Virtual Account ---
      (va ? kotakVa(m, data.va_number) : kotakQris()) +

      // --- Nominal ---
      '<div class="flex items-center justify-center gap-sm bg-surface-soft py-sm px-md rounded-lg mb-lg">' +
        '<span class="font-title-md text-title-md text-on-surface" id="nominalText">Nominal: ' +
          formatRupiah(data.gross_amount) + '</span>' +
        '<button type="button" aria-label="Salin nominal" id="salinNominalBtn" ' +
          'class="text-primary hover:text-primary-container transition-colors flex items-center">' +
          '<span class="material-symbols-outlined text-[20px]">content_copy</span></button>' +
      '</div>' +

      // --- Tombol tindakan ---
      '<div class="w-full flex flex-col sm:flex-row flex-wrap gap-md justify-center">' +
        tombolKecil("refreshPaymentBtn", "refresh", "Refresh Status Pembayaran", true) +
        tombolSalinUtama +
        tombolUnduhQr +
      '</div>' +

      // --- Jalan pintas ke simulator sandbox ---
      '<a href="' + m.simulator + '" target="_blank" rel="noopener" ' +
        'class="mt-md inline-flex items-center gap-xs bg-primary-container text-on-primary ' +
        'font-button-md text-button-md px-lg py-md rounded-lg hover:brightness-110 ' +
        'transition-all no-underline shadow-sm">' +
        '<span class="material-symbols-outlined text-[20px]">open_in_new</span>' +
        'Buka Simulator Pembayaran</a>' +

      // --- Keterangan hasil pengecekan ---
      '<p class="font-body-sm text-body-sm text-ink-muted mt-md" id="pollingInfo">' +
        'Status pembayaran dicek otomatis setiap 5 detik.</p>' +
      '<div class="hidden items-start gap-xs mt-sm px-md py-sm rounded-lg text-left w-full ' +
        'max-w-[460px]" id="hasilCek">' +
        '<span class="material-symbols-outlined text-[18px]" id="hasilCekIkon">info</span>' +
        '<span class="font-body-sm text-body-sm" id="hasilCekTeks"></span>' +
      '</div>' +

    '</div>';
}

// =====================================================================
// 2. CARA PEMBAYARAN
// =====================================================================
function gambarCaraBayar(wadah, m) {
  if (!wadah) return;

  wadah.innerHTML =
    '<div class="bg-surface-canvas border border-border-hairline rounded-xl p-lg">' +
      '<h3 class="font-title-md text-title-md text-on-surface mb-xs flex items-center gap-xs">' +
        '<span class="material-symbols-outlined text-primary">info</span>Cara Melakukan Pembayaran' +
      '</h3>' +

      // Penegasan bahwa ini lingkungan uji, supaya penguji tidak
      // mencoba membayar sungguhan lewat aplikasi banknya.
      '<div class="flex items-start gap-xs bg-status-warning/10 border border-status-warning/30 ' +
        'rounded-lg p-sm mb-md">' +
        '<span class="material-symbols-outlined text-status-warning text-[18px]">science</span>' +
        '<p class="font-body-sm text-body-sm text-ink-secondary">Sistem ini memakai ' +
          '<strong>Midtrans Sandbox</strong>, jadi tidak ada uang sungguhan yang berpindah. ' +
          'Pembayaran diselesaikan melalui Simulator Midtrans, bukan lewat aplikasi bank Anda.</p>' +
      '</div>' +

      '<ol class="list-decimal list-outside ml-md space-y-sm font-body-sm text-body-sm ' +
        'text-on-surface-variant">' +
        langkahPembayaran(m.kode).map(function (langkah) {
          return '<li class="pl-xs">' + langkah + '</li>';
        }).join("") +
      '</ol>' +
    '</div>';
}

// =====================================================================
// 3. KODE QR
// =====================================================================
function tampilkanQr(data) {
  const loading = el("qrisLoading");
  const gambar = el("qrisImage");
  const kanvas = el("qrisCanvas");
  const kotakError = el("qrisError");
  const tombolUnduh = el("downloadQrBtn");

  function gagal(pesan) {
    if (loading) loading.classList.add("hidden");
    const teks = el("qrisErrorText");
    if (teks) teks.textContent = pesan;
    if (kotakError) {
      kotakError.classList.remove("hidden");
      kotakError.classList.add("flex");
    }
    if (tombolUnduh) tombolUnduh.classList.add("hidden");
  }

  function dariQrString(teksQr) {
    if (typeof window.QRCode === "undefined") {
      gagal("Pustaka pembuat QR gagal dimuat.");
      return;
    }
    window.QRCode.toCanvas(kanvas, teksQr, { width: 288, margin: 1 }, function (err) {
      if (err) { gagal("Gagal membuat gambar QR."); return; }
      loading.classList.add("hidden");
      gambar.classList.add("hidden");
      kanvas.classList.remove("hidden");
      if (tombolUnduh) tombolUnduh.href = kanvas.toDataURL("image/png");
    });
  }

  if (data.qr_url) {
    gambar.onload = function () {
      loading.classList.add("hidden");
      gambar.classList.remove("hidden");
    };
    gambar.onerror = function () {
      if (data.qr_string) dariQrString(data.qr_string);
      else gagal("Kode QR gagal dimuat.");
    };
    gambar.src = data.qr_url;
    if (tombolUnduh) tombolUnduh.href = data.qr_url;
    return;
  }

  if (data.qr_string) { dariQrString(data.qr_string); return; }

  gagal("Kode QR tidak tersedia dari Midtrans.");
}

// =====================================================================
// 4. PROSES UTAMA
// =====================================================================

/**
 * Menjalankan halaman pembayaran.
 *
 * @param {Object}   opsi
 * @param {string}   opsi.kunciData    - kunci localStorage berisi hasil /api/create-transaction
 * @param {string}   opsi.idKartu      - id elemen tempat kartu pembayaran digambar
 * @param {string}   opsi.idCara       - id elemen tempat langkah pembayaran digambar
 * @param {string}   opsi.idModal      - id modal "pembayaran berhasil"
 * @param {string}   opsi.pesanKembali - kalimat bila data pembayaran tidak ditemukan
 * @param {Function} opsi.saatLunas    - dijalankan sekali saat pembayaran diterima
 */
export function mulaiPembayaran(opsi) {
  const wadahKartu = el(opsi.idKartu);
  const wadahCara = el(opsi.idCara);

  const mentah = localStorage.getItem(opsi.kunciData);
  const data = mentah ? JSON.parse(mentah) : null;

  // --- Data pembayaran belum ada ---
  if (!data || !data.order_id) {
    if (wadahKartu) {
      wadahKartu.innerHTML =
        '<div class="bg-surface-canvas border border-border-hairline rounded-xl shadow-sm p-xl ' +
          'flex flex-col items-center text-center gap-sm">' +
          '<span class="material-symbols-outlined text-[40px] text-error">error</span>' +
          '<p class="font-body-md text-body-md text-error">' + opsi.pesanKembali + '</p>' +
        '</div>';
    }
    if (wadahCara) wadahCara.innerHTML = "";
    return;
  }

  // Metode diambil dari hasil transaksi. Bila transaksi lama belum
  // menyimpannya, pilihan terakhir pengguna dipakai sebagai cadangan.
  const m = infoMetode(data.metode || ambilMetode());

  gambarKartu(wadahKartu, data, m);
  gambarCaraBayar(wadahCara, m);

  if (!metodeVa(m.kode)) tampilkanQr(data);

  // -------------------------------------------------------------------
  // Status pembayaran
  // -------------------------------------------------------------------
  let idPolling = null;
  let sudahLunas = false;

  function perbaruiBadge(status, lunas, gagal) {
    const badge = el("statusBadge");
    const ikon = el("statusBadgeIcon");
    const teks = el("statusBadgeText");
    if (!badge) return;

    badge.className = "inline-flex items-center gap-xs px-md py-xs rounded-full font-badge text-badge border";

    if (lunas) {
      badge.classList.add("bg-status-available/10", "text-status-available", "border-status-available/30");
      ikon.textContent = "check_circle";
      teks.textContent = "Lunas";
    } else if (gagal) {
      badge.classList.add("bg-error/10", "text-error", "border-error/30");
      ikon.textContent = "cancel";
      teks.textContent = status === "expire" ? "Kedaluwarsa" : "Pembayaran Gagal";
    } else {
      badge.classList.add("bg-status-warning/10", "text-status-warning", "border-status-warning/30");
      ikon.textContent = "schedule";
      teks.textContent = "Menunggu Pembayaran";
    }
  }

  /** Menampilkan hasil pengecekan sebagai kotak berwarna di bawah tombol. */
  function tulisHasil(jenis, pesan) {
    const kotak = el("hasilCek");
    const ikon = el("hasilCekIkon");
    const teks = el("hasilCekTeks");
    if (!kotak) return;

    const gaya = {
      belum: ["bg-status-warning/10", "border-status-warning/30", "text-status-warning", "schedule"],
      gagal: ["bg-error/10", "border-error/30", "text-error", "error"],
      info: ["bg-primary-container/10", "border-primary-container/30", "text-primary-container", "info"]
    }[jenis] || ["bg-primary-container/10", "border-primary-container/30", "text-primary-container", "info"];

    kotak.className = "flex items-start gap-xs mt-sm px-md py-sm rounded-lg text-left w-full " +
                      "max-w-[460px] border " + gaya[0] + " " + gaya[1] + " " + gaya[2];
    ikon.textContent = gaya[3];
    teks.textContent = pesan;
  }

  async function cekStatus(dariTombol) {
    if (sudahLunas) return;

    const tombol = el("refreshPaymentBtn");
    const ikon = tombol ? tombol.querySelector(".material-symbols-outlined") : null;
    const teks = tombol ? tombol.querySelector("[data-teks]") : null;

    if (dariTombol && tombol) {
      tombol.disabled = true;
      if (ikon) ikon.classList.add("animate-spin");
      if (teks) teks.textContent = "Mengecek...";
    }

    try {
      const tanggapan = await fetch(
        "/api/check-status?order_id=" + encodeURIComponent(data.order_id)
      );
      const hasil = await tanggapan.json();

      if (!tanggapan.ok) throw new Error(hasil.error || "Gagal mengecek status.");

      perbaruiBadge(hasil.transaction_status, hasil.lunas, hasil.gagal);

      if (hasil.lunas) {
        sudahLunas = true;
        if (idPolling) { clearInterval(idPolling); idPolling = null; }

        data.transaction_status = hasil.transaction_status;
        data.payment_type = hasil.payment_type;
        data.settlement_time = hasil.settlement_time;
        localStorage.setItem(opsi.kunciData, JSON.stringify(data));

        const modal = el(opsi.idModal);
        if (modal) {
          modal.classList.remove("hidden");
          modal.classList.add("flex");
        }

        if (typeof opsi.saatLunas === "function") opsi.saatLunas(data, m);

      } else if (hasil.gagal) {
        if (idPolling) { clearInterval(idPolling); idPolling = null; }
        tulisHasil("gagal",
          "Transaksi sudah tidak dapat dibayar (" + hasil.transaction_status + "). " +
          "Silakan ulangi dari langkah sebelumnya.");

      } else if (dariTombol) {
        // Inilah jawaban yang dilihat penguji bila menekan Refresh
        // sebelum pembayaran diselesaikan di simulator.
        tulisHasil("belum",
          "Pembayaran belum diterima. Selesaikan dulu pembayaran " + m.singkat +
          " di Simulator Midtrans, lalu tekan tombol ini lagi.");
      }

    } catch (err) {
      tulisHasil("gagal",
        err.message === "Failed to fetch"
          ? 'Tidak dapat menghubungi server. Jalankan "node server.js" lalu buka lewat http://localhost:3000'
          : "Gagal mengecek status: " + err.message);

    } finally {
      if (dariTombol && tombol) {
        tombol.disabled = false;
        if (ikon) { ikon.classList.remove("animate-spin"); ikon.textContent = "refresh"; }
        if (teks) teks.textContent = "Refresh Status Pembayaran";
      }
    }
  }

  // -------------------------------------------------------------------
  // Hitung mundur masa berlaku
  // -------------------------------------------------------------------
  const tampilanWaktu = el("countdown-timer");
  if (tampilanWaktu) {
    let sisa = 15 * 60;
    if (data.expiry_time) {
      // Format Midtrans: "2026-08-05 14:45:00" dengan zona waktu WIB
      const habis = new Date(String(data.expiry_time).replace(" ", "T") + "+07:00");
      const selisih = Math.floor((habis - new Date()) / 1000);
      if (!isNaN(selisih)) sisa = Math.max(0, selisih);
    }

    const gambarWaktu = function () {
      if (sisa < 0) sisa = 0;
      tampilanWaktu.textContent =
        String(Math.floor(sisa / 3600)).padStart(2, "0") + ":" +
        String(Math.floor((sisa % 3600) / 60)).padStart(2, "0") + ":" +
        String(sisa % 60).padStart(2, "0");
      sisa--;
    };
    gambarWaktu();
    setInterval(gambarWaktu, 1000);
  }

  // -------------------------------------------------------------------
  // Tombol
  // -------------------------------------------------------------------
  const tombolRefresh = el("refreshPaymentBtn");
  if (tombolRefresh) {
    tombolRefresh.addEventListener("click", function () { cekStatus(true); });
  }

  const tombolSalinVa = el("salinVaBtn");
  if (tombolSalinVa) {
    tombolSalinVa.addEventListener("click", async function () {
      const berhasil = await salinTeks(data.va_number);
      if (berhasil) tandaiTersalin(tombolSalinVa, "content_copy", "Salin Nomor VA");
      else window.prompt("Salin nomor Virtual Account di bawah ini:", data.va_number || "");
    });
  }

  const tombolSalinQr = el("salinQrBtn");
  if (tombolSalinQr) {
    tombolSalinQr.addEventListener("click", async function () {
      // Simulator menerima teks QR; bila tidak ada, URL gambarnya dipakai
      const isi = data.qr_string || data.qr_url || "";
      const berhasil = await salinTeks(isi);
      if (berhasil) tandaiTersalin(tombolSalinQr, "content_copy", "Salin Data QR");
      else window.prompt("Salin data QR di bawah ini:", isi);
    });
  }

  const tombolSalinNominal = el("salinNominalBtn");
  if (tombolSalinNominal) {
    tombolSalinNominal.addEventListener("click", async function () {
      const berhasil = await salinTeks(String(data.gross_amount || ""));
      if (berhasil) tulisHasil("info", "Nominal " + formatRupiah(data.gross_amount) + " tersalin.");
    });
  }

  // -------------------------------------------------------------------
  // Pengecekan otomatis
  // -------------------------------------------------------------------
  perbaruiBadge(data.transaction_status || "pending", false, false);
  cekStatus(false);
  idPolling = setInterval(function () { cekStatus(false); }, JEDA_POLLING);

  window.addEventListener("beforeunload", function () {
    if (idPolling) clearInterval(idPolling);
  });
}
