/**
 * =====================================================================
 * PANEL NOTIFIKASI (admin & super admin)
 * =====================================================================
 * Sebelumnya panel lonceng pada top-nav.html berisi TIGA contoh yang
 * ditulis langsung di HTML -- tidak terhubung ke Firestore sama sekali.
 * Berkas ini menggantikannya dengan dua sumber data nyata, digabung
 * jadi satu daftar terurut dari yang terbaru:
 *
 *   1. collection "log_notifikasi" -> pengingat jatuh tempo yang
 *      sudah/akan dikirim cron (api/cron.js). Status baca/belum memakai
 *      field "dibaca" yang memang sudah ada di setiap dokumennya.
 *   2. collection "transaksi_pemesanan" -> pemesanan yang BARU DIBUAT,
 *      baik yang sudah lunas maupun yang belum (pending/gagal).
 *
 * Transaksi tidak punya field "sudah dibaca" di Firestore (menambahnya
 * berarti mengubah skema yang dipakai banyak halaman lain), jadi
 * status baca/belumnya memakai timestamp "terakhir dibaca" yang
 * disimpan di localStorage peramban ini -- see KUNCI_TERAKHIR_DIBACA.
 *
 * ---------------------------------------------------------------------
 * CARA DIMUAT
 * ---------------------------------------------------------------------
 * Sama seperti js/admin-laci.js: dipanggil dari dalam top-nav.html
 * sebagai <script> BIASA (bukan type="module"), karena skrip pemuat di
 * tiap halaman (yang menyisipkan ulang <script> dari top-nav.html agar
 * benar-benar dijalankan) tidak ikut menyalin atribut type="module".
 * Modul Firestore yang dibutuhkan dimuat lewat import() dinamis, yang
 * tetap boleh dipakai di dalam skrip biasa.
 * =====================================================================
 */
(function () {
  "use strict";

  var KUNCI_TERAKHIR_DIBACA = "notifikasiTerakhirDibaca";
  var BATAS_ITEM_SUMBER = 15; // diambil dari server, per collection
  var BATAS_ITEM_TAMPIL = 15; // ditampilkan setelah kedua sumber digabung

  // ===================================================================
  // MENUNGGU TOP-NAV SELESAI DISISIPKAN (lihat js/admin-laci.js)
  // ===================================================================
  function siapkan() {
    var tombol = document.getElementById("notificationBtn");
    var panel = document.getElementById("notificationPanel");
    if (!tombol || !panel) return false;
    if (tombol.dataset.notifSiap === "1") return true;
    tombol.dataset.notifSiap = "1";

    jalankan(tombol, panel);
    return true;
  }

  /** "10 menit yang lalu" / "3 hari yang lalu", dari sebuah Date. */
  function waktuRelatif(tanggal) {
    var detik = Math.max(0, Math.floor((Date.now() - tanggal.getTime()) / 1000));
    if (detik < 60) return "Baru saja";

    var menit = Math.floor(detik / 60);
    if (menit < 60) return menit + " menit yang lalu";

    var jam = Math.floor(menit / 60);
    if (jam < 24) return jam + " jam yang lalu";

    var hari = Math.floor(jam / 24);
    return hari + " hari yang lalu";
  }

  async function jalankan(tombol, panel) {
    var firestore = await import("https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js");
    var adminData = await import("./admin-data.js");
    var adminUtil = await import("./admin-util.js");
    var firebaseInit = await import("./firebase-init.js");

    var db = firebaseInit.db;
    var COL_TRANSAKSI = adminData.COL_TRANSAKSI;
    var COL_LOG = "log_notifikasi"; // sama dengan COL_LOG pada api/cron.js & seed-data.js

    var amankanTeks = adminUtil.amankanTeks;
    var formatRupiah = adminUtil.formatRupiah;
    var statusLunas = adminUtil.statusLunas;
    var statusGagal = adminUtil.statusGagal;
    var keDate = adminUtil.keDate;

    var elDot = document.getElementById("notificationDot");
    var elBadge = document.getElementById("notificationCountBadge");
    var elMarkAllRead = document.getElementById("markAllReadBtn");
    var elDaftar = document.getElementById("notificationList");
    if (!elDaftar) return; // markup lama belum diperbarui

    var petaCabang = {};
    try {
      petaCabang = await adminData.ambilPeta(adminData.COL_CABANG);
    } catch (err) {
      // Nama cabang sekadar pemanis teks; kalau gagal dimuat, biarkan
      // kosong -- notifikasi tetap tampil tanpa nama cabang.
    }

    var daftarLog = [];
    var daftarTransaksi = [];

    // -----------------------------------------------------------------
    // SATU BARIS NOTIFIKASI DARI LOG_NOTIFIKASI (pengingat jatuh tempo)
    // -----------------------------------------------------------------
    function dariLog(dokumen) {
      var waktu = keDate(dokumen.waktu_kirim) || new Date(0);
      return {
        id: "log_" + dokumen.id,
        waktu: waktu,
        dibaca: dokumen.dibaca === true,
        ikon: "schedule",
        kelasIkon: "bg-status-warning/10 text-status-warning",
        kelasLatarBelumDibaca: "bg-status-warning/5",
        judul: dokumen.judul || "Pengingat Masa Sewa",
        deskripsi: dokumen.ringkasan || "",
        // Dipakai "Tandai semua dibaca" untuk tahu dokumen mana yang
        // perlu ditulis ulang ke Firestore.
        _refLog: dokumen.id
      };
    }

    // -----------------------------------------------------------------
    // SATU BARIS NOTIFIKASI DARI TRANSAKSI BARU (lunas maupun belum)
    // -----------------------------------------------------------------
    function dariTransaksi(dokumen) {
      var waktu = keDate(dokumen.transaction_time) || new Date(0);
      var namaCabang = (petaCabang[dokumen.cabang_id] && petaCabang[dokumen.cabang_id].nama_cabang) ||
                       dokumen.cabang_id || "-";
      var jumlah = formatRupiah(dokumen.order_amount);
      var penyewa = amankanTeks(dokumen.nama_penyewa || "-");

      if (statusLunas(dokumen.transaction_status)) {
        return {
          id: "trx_" + dokumen.id,
          waktu: waktu,
          dibaca: dokumenSudahDibacaSebelum(waktu),
          ikon: "check_circle",
          kelasIkon: "bg-status-available/10 text-status-available",
          kelasLatarBelumDibaca: "bg-primary/5",
          judul: "Pembayaran Berhasil!",
          deskripsi: penyewa + " (" + amankanTeks(namaCabang) + ") telah membayar " + jumlah + "."
        };
      }

      if (statusGagal(dokumen.transaction_status)) {
        return {
          id: "trx_" + dokumen.id,
          waktu: waktu,
          dibaca: dokumenSudahDibacaSebelum(waktu),
          ikon: "cancel",
          kelasIkon: "bg-error/10 text-error",
          kelasLatarBelumDibaca: "bg-error/5",
          judul: "Pembayaran Gagal / Dibatalkan",
          deskripsi: penyewa + " (" + amankanTeks(namaCabang) + ") -- pemesanan " + jumlah + " tidak berhasil."
        };
      }

      return {
        id: "trx_" + dokumen.id,
        waktu: waktu,
        dibaca: dokumenSudahDibacaSebelum(waktu),
        ikon: "pending_actions",
        kelasIkon: "bg-surface-variant text-ink-secondary",
        kelasLatarBelumDibaca: "bg-surface-variant/40",
        judul: "Pesanan Baru Menunggu Pembayaran",
        deskripsi: penyewa + " (" + amankanTeks(namaCabang) + ") -- " + jumlah + "."
      };
    }

    function ambilTerakhirDibaca() {
      var nilai = Number(localStorage.getItem(KUNCI_TERAKHIR_DIBACA) || 0);
      return isNaN(nilai) ? 0 : nilai;
    }

    function dokumenSudahDibacaSebelum(waktu) {
      return waktu.getTime() <= ambilTerakhirDibaca();
    }

    // -----------------------------------------------------------------
    // MENGGABUNGKAN & MENGGAMBAR
    // -----------------------------------------------------------------
    function satuBarisHtml(item) {
      return '' +
        '<div class="notification-item flex gap-sm px-base py-base rounded-lg' +
        (item.dibaca ? "" : " " + item.kelasLatarBelumDibaca) + '">' +
        '<div class="w-9 h-9 rounded-full ' + item.kelasIkon + ' flex items-center justify-center shrink-0">' +
        '<span class="material-symbols-outlined text-[20px]"' +
        (item.dibaca ? "" : ' style="font-variation-settings: \'FILL\' 1;"') + '>' + item.ikon + '</span>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
        '<p class="font-semibold text-body-sm text-ink-primary">' + amankanTeks(item.judul) + '</p>' +
        '<p class="text-label-md text-ink-secondary mt-0.5">' + amankanTeks(item.deskripsi) + '</p>' +
        '<p class="text-badge text-ink-muted mt-1">' + waktuRelatif(item.waktu) + '</p>' +
        '</div>' +
        '</div>';
    }

    function gambarUlang() {
      var gabungan = daftarLog.concat(daftarTransaksi)
        .sort(function (a, b) { return b.waktu - a.waktu; })
        .slice(0, BATAS_ITEM_TAMPIL);

      if (gabungan.length === 0) {
        elDaftar.innerHTML =
          '<div class="px-base py-section text-center text-ink-muted text-body-sm">Belum ada aktivitas.</div>';
      } else {
        elDaftar.innerHTML = gabungan.map(satuBarisHtml).join("");
      }

      var jumlahBelumDibaca = gabungan.filter(function (item) { return !item.dibaca; }).length;

      if (elDot) elDot.classList.toggle("hidden", jumlahBelumDibaca === 0);
      if (elBadge) {
        elBadge.classList.toggle("hidden", jumlahBelumDibaca === 0);
        elBadge.textContent = jumlahBelumDibaca + " Baru";
      }
    }

    // -----------------------------------------------------------------
    // TANDAI SEMUA DIBACA
    // -----------------------------------------------------------------
    if (elMarkAllRead) {
      elMarkAllRead.addEventListener("click", async function () {
        elMarkAllRead.disabled = true;

        try {
          var belumDibaca = daftarLog.filter(function (item) { return !item.dibaca; });

          if (belumDibaca.length > 0) {
            var batch = firestore.writeBatch(db);
            belumDibaca.forEach(function (item) {
              batch.update(firestore.doc(db, COL_LOG, item._refLog), { dibaca: true });
            });
            await batch.commit();
          }

          // Menandai seluruh transaksi yang sedang tampil sebagai
          // "sudah dibaca" untuk peramban ini.
          localStorage.setItem(KUNCI_TERAKHIR_DIBACA, String(Date.now()));

          // onSnapshot log_notifikasi akan menyusul dengan data resmi
          // dari server, tetapi diperbarui juga di sini supaya terasa
          // seketika (tidak menunggu bolak-balik jaringan).
          daftarLog.forEach(function (item) { item.dibaca = true; });
          daftarTransaksi.forEach(function (item) { item.dibaca = true; });
          gambarUlang();
        } catch (err) {
          console.error("Gagal menandai notifikasi terbaca:", err);
        } finally {
          elMarkAllRead.disabled = false;
        }
      });
    }

    // -----------------------------------------------------------------
    // PEMANTAUAN REAL-TIME
    // -----------------------------------------------------------------
    var kueriLog = firestore.query(
      firestore.collection(db, COL_LOG),
      firestore.orderBy("waktu_kirim", "desc"),
      firestore.limit(BATAS_ITEM_SUMBER)
    );
    firestore.onSnapshot(kueriLog, function (cuplikan) {
      daftarLog = [];
      cuplikan.forEach(function (dok) {
        daftarLog.push(dariLog(Object.assign({ id: dok.id }, dok.data())));
      });
      gambarUlang();
    }, function (err) { console.error("Gagal memuat log_notifikasi:", err); });

    var kueriTransaksi = firestore.query(
      firestore.collection(db, COL_TRANSAKSI),
      firestore.orderBy("transaction_time", "desc"),
      firestore.limit(BATAS_ITEM_SUMBER)
    );
    firestore.onSnapshot(kueriTransaksi, function (cuplikan) {
      daftarTransaksi = [];
      cuplikan.forEach(function (dok) {
        daftarTransaksi.push(dariTransaksi(Object.assign({ id: dok.id }, dok.data())));
      });
      gambarUlang();
    }, function (err) { console.error("Gagal memuat transaksi_pemesanan:", err); });
  }

  if (siapkan()) return;

  var pengamat = new MutationObserver(function () {
    if (siapkan()) pengamat.disconnect();
  });
  pengamat.observe(document.body, { childList: true, subtree: true });

  setTimeout(function () { pengamat.disconnect(); }, 8000);
})();
