/**
 * =====================================================================
 * HALAMAN DETAIL CABANG (customer/room-detail.html)
 * =====================================================================
 * Alur:
 *   1. Baca ID cabang dari alamat URL -> room-detail.html?cabang=pesona-kos
 *   2. Ambil satu dokumen cabang memakai getDoc, lalu hitung berapa
 *      kamar yang masih tersedia di cabang tersebut
 *   3. Isikan datanya ke elemen HTML yang sudah ada
 *   4. Hitung total biaya secara langsung setiap kali pengunjung
 *      mengubah tipe sewa atau tanggal
 *   5. Bila seluruh kamar terisi -> tombol pemesanan dimatikan
 *
 * Aturan tanggal:
 *   - Sewa BULANAN: pengunjung memilih durasi 1 / 3 / 6 bulan, lalu
 *     tanggal check-out dihitung otomatis dari tanggal check-in.
 *   - Sewa HARIAN : pengunjung memilih sendiri tanggal check-out,
 *     minimal satu hari setelah check-in.
 *
 * Tanggal yang sudah diisi pengunjung pada panel filter Beranda atau
 * Katalog dibawa ke sini lewat parameter alamat &mulai= dan &selesai=,
 * lalu langsung mengisi form pemesanan. Lihat js/filter-tanggal.js.
 *
 * Catatan model data:
 * Pengunjung memesan CABANG, bukan nomor kamar. Nomor kamar baru
 * ditentukan admin pada halaman Alokasi Kamar setelah pembayaran.
 * =====================================================================
 */

import { ambilSatuCabang, hitungBiaya, selisihHari } from '../js/customer-data.js';
import { formatRupiah, ikonFasilitas } from '../js/format.js';
import { KUNCI_TUJUAN, KUNCI_CABANG_DIBUKA } from '../js/customer-auth.js';
import {
  keTeksTanggal, bacaPilihanTanggal, rangkaiPilihanTanggal,
  bulanAntara, DURASI_BULAN_TERSEDIA
} from '../js/filter-tanggal.js';

// Menyimpan data cabang agar bisa dipakai saat menekan "Pesan Sekarang"
let cabangAktif = null;

// Durasi sewa bulanan yang sedang dipilih (1, 3, atau 6)
let durasiBulanTerpilih = 1;

// =====================================================================
// 1. FUNGSI BANTU
// =====================================================================

function isiTeks(id, nilai) {
  const elemen = document.getElementById(id);
  if (elemen) elemen.textContent = nilai;
}

/**
 * Menyembunyikan atau menampilkan satu elemen.
 *
 * Memakai style.display, bukan kelas "hidden", khusus untuk
 * #detailKonten. Elemen itu juga memakai kelas "lg:grid", dan aturan di
 * dalam media query berada lebih belakang pada berkas Tailwind sehingga
 * "lg:grid" mengalahkan "hidden". Akibatnya mulai lebar 1024px isi
 * halaman tetap tampil bersamaan dengan tampilan "Memuat data...".
 *
 * Nilai '' mengembalikan tampilan ke aturan kelasnya (flex / lg:grid).
 */
function aturTampil(elemen, tampil) {
  if (elemen) elemen.style.display = tampil ? '' : 'none';
}

function aturLoading(sedangMemuat) {
  const lapisan = document.getElementById('detailLoading');
  const isi = document.getElementById('detailKonten');
  if (lapisan) lapisan.classList.toggle('hidden', !sedangMemuat);
  aturTampil(isi, !sedangMemuat);
}

function tampilkanError(judul, keterangan) {
  const lapisan = document.getElementById('detailLoading');
  const isi = document.getElementById('detailKonten');

  aturTampil(isi, false);
  if (!lapisan) return;

  lapisan.classList.remove('hidden');
  lapisan.innerHTML =
    '<div class="flex flex-col items-center justify-center text-center gap-md py-section">' +
      '<div class="w-16 h-16 rounded-full bg-error-container flex items-center justify-center">' +
        '<span class="material-symbols-outlined text-error text-[32px]">error</span>' +
      '</div>' +
      '<h2 class="font-display-lg text-display-lg text-ink-primary">' + judul + '</h2>' +
      '<p class="font-body-md text-body-md text-ink-muted max-w-md">' + keterangan + '</p>' +
      '<a href="catalogue.html" class="mt-md inline-flex items-center gap-sm bg-primary text-on-primary font-button-md text-button-md px-lg py-md rounded-xl hover:bg-primary-container transition-colors no-underline">' +
        '<span class="material-symbols-outlined text-[20px]">grid_view</span>Lihat Katalog Cabang' +
      '</a>' +
    '</div>';
}

// Catatan: keTeksTanggal() kini diambil dari js/filter-tanggal.js agar
// perhitungan tanggal di halaman ini dan di panel filter Beranda /
// Katalog memakai aturan yang persis sama.

// =====================================================================
// 2. MENGISI DATA CABANG KE ELEMEN HTML
// =====================================================================
function tampilkanDetailCabang(cabang) {
  // --- Judul, alamat, deskripsi ---
  isiTeks('detailNamaKamar', cabang.nama_cabang);
  isiTeks('detailAlamat', cabang.alamat);
  isiTeks('detailDeskripsi', cabang.deskripsi);
  isiTeks('detailBadgeTipe', 'HARIAN / BULANAN');

  // --- Badge ketersediaan ---
  const badgeStatus = document.getElementById('detailBadgeStatus');
  if (badgeStatus) {
    if (cabang.kamar_tersedia > 0) {
      badgeStatus.className =
        'bg-status-available/10 text-status-available px-4 py-1.5 rounded-full font-badge text-badge tracking-wider shadow-sm border border-status-available/20';
      badgeStatus.textContent = cabang.kamar_tersedia + ' KAMAR TERSEDIA';
    } else {
      badgeStatus.className =
        'bg-status-occupied/10 text-status-occupied px-4 py-1.5 rounded-full font-badge text-badge tracking-wider shadow-sm border border-status-occupied/20';
      badgeStatus.textContent = 'KAMAR PENUH';
    }
  }

  // --- Ringkasan ketersediaan di kotak pemesanan ---
  isiTeks('detailKetersediaan',
    cabang.kamar_tersedia + ' dari ' + cabang.total_kamar + ' kamar siap huni');

  // --- Foto utama dan galeri ---
  const fotoUtama = document.getElementById('detailFotoUtama');
  if (fotoUtama && cabang.gambar_url) {
    fotoUtama.src = cabang.gambar_url;
    fotoUtama.alt = cabang.nama_cabang;
  }

  const galeri = Array.isArray(cabang.galeri_foto) ? cabang.galeri_foto : [];
  ['detailFoto1', 'detailFoto2', 'detailFoto3'].forEach(function (idFoto, urutan) {
    const gambar = document.getElementById(idFoto);
    if (!gambar) return;

    if (galeri[urutan]) {
      gambar.src = galeri[urutan];
      gambar.alt = cabang.nama_cabang + ' - foto ' + (urutan + 1);
    } else {
      // Sembunyikan bingkai foto bila datanya tidak ada
      const bingkai = gambar.closest('div');
      if (bingkai) bingkai.classList.add('hidden');
    }
  });

  // --- Fasilitas kamar (sama untuk semua kamar dalam satu cabang) ---
  const wadahFasilitas = document.getElementById('detailFasilitas');
  const daftarFasilitas = Array.isArray(cabang.fasilitas_kamar) ? cabang.fasilitas_kamar : [];

  if (wadahFasilitas) {
    wadahFasilitas.innerHTML = daftarFasilitas.map(function (fasilitas) {
      return '' +
        '<div class="flex flex-col items-center justify-center p-xl bg-surface-canvas border border-border-hairline rounded-2xl hover:border-ink-primary transition-colors text-center shadow-sm">' +
          '<span class="material-symbols-outlined text-[32px] text-ink-primary mb-md">' + ikonFasilitas(fasilitas) + '</span>' +
          '<span class="font-label-md text-label-md text-ink-primary">' + fasilitas + '</span>' +
        '</div>';
    }).join('');
  }

  // --- Fasilitas umum cabang (WiFi, parkir, CCTV, dan sejenisnya) ---
  const wadahFasilitasUmum = document.getElementById('detailFasilitasUmum');
  const fasilitasUmum = Array.isArray(cabang.fasilitas_umum) ? cabang.fasilitas_umum : [];

  if (wadahFasilitasUmum) {
    wadahFasilitasUmum.innerHTML = fasilitasUmum.map(function (fasilitas) {
      return '' +
        '<div class="flex items-center gap-sm px-md py-sm bg-surface-soft border border-border-hairline rounded-xl">' +
          '<span class="material-symbols-outlined text-[20px] text-primary">' + ikonFasilitas(fasilitas) + '</span>' +
          '<span class="font-body-sm text-body-sm text-ink-primary">' + fasilitas + '</span>' +
        '</div>';
    }).join('');
  }

  // --- Bagian peta lokasi ---
  isiTeks('detailJudulLokasi', 'Lokasi ' + cabang.nama_cabang);
  isiTeks('detailNamaCabangPeta', cabang.nama_cabang + ' Pilar Pandawa');
  isiTeks('detailAlamatPeta', cabang.alamat);

  const tautanPeta = document.getElementById('detailTautanPeta');
  if (tautanPeta && cabang.maps_url) {
    tautanPeta.href = cabang.maps_url;
  }
}

// =====================================================================
// 3. PERHITUNGAN BIAYA SECARA LANGSUNG
// =====================================================================
function hitungUlangBiaya() {
  if (!cabangAktif) return;

  const tipeSewa = document.getElementById('tipeSewaSelect').value;
  const checkin = document.getElementById('checkinInput').value;
  const checkout = document.getElementById('checkoutInput').value;

  const bulanan = tipeSewa === 'bulanan';

  // Harga acuan di bagian atas kotak pemesanan
  isiTeks('detailHarga', formatRupiah(bulanan ? cabangAktif.harga_bulanan : cabangAktif.harga_harian));
  isiTeks('detailSatuanHarga', bulanan ? '/ bulan' : '/ hari');

  const biaya = hitungBiaya(cabangAktif, tipeSewa, checkin, checkout);

  if (!biaya.valid) {
    isiTeks('detailLabelHargaSewa', 'Harga Sewa');
    isiTeks('detailNilaiHargaSewa', '-');
    isiTeks('detailBiayaLayanan', formatRupiah(cabangAktif.biaya_layanan));
    isiTeks('detailTotal', '-');
    return;
  }

  isiTeks('detailLabelHargaSewa', 'Harga Sewa (' + biaya.durasi + ' ' + biaya.satuanDurasi + ')');
  isiTeks('detailNilaiHargaSewa', formatRupiah(biaya.hargaSewa));
  isiTeks('detailBiayaLayanan', formatRupiah(biaya.biayaLayanan));
  isiTeks('detailTotal', formatRupiah(biaya.total));
}

// =====================================================================
// 4. PENGATURAN TANGGAL
// =====================================================================

/**
 * Untuk sewa bulanan, tanggal check-out dihitung otomatis dari
 * tanggal check-in ditambah durasi bulan yang dipilih.
 */
function hitungCheckoutOtomatis() {
  const checkinInput = document.getElementById('checkinInput');
  const checkoutInput = document.getElementById('checkoutInput');
  if (!checkinInput.value) return;

  const mulai = new Date(checkinInput.value + 'T00:00:00');
  if (isNaN(mulai.getTime())) return;

  const akhir = new Date(mulai);
  akhir.setMonth(akhir.getMonth() + durasiBulanTerpilih);

  checkoutInput.value = keTeksTanggal(akhir);
}

/** Tanggal check-in paling awal adalah hari ini. */
function aturBatasTanggal() {
  const checkinInput = document.getElementById('checkinInput');
  const checkoutInput = document.getElementById('checkoutInput');

  const hariIni = keTeksTanggal(new Date());
  checkinInput.min = hariIni;

  // Check-out minimal satu hari setelah check-in
  if (checkinInput.value) {
    const besok = new Date(checkinInput.value + 'T00:00:00');
    besok.setDate(besok.getDate() + 1);
    checkoutInput.min = keTeksTanggal(besok);
  } else {
    checkoutInput.min = hariIni;
  }
}

/**
 * Mengisi form pemesanan dengan tanggal yang dibawa dari panel filter
 * Beranda atau Katalog, supaya pengunjung tidak mengetik ulang.
 *
 * Dijalankan SEBELUM perbaruiTampilanTipeSewa(), karena pada sewa
 * bulanan fungsi itulah yang menghitung tanggal check-out dari
 * durasiBulanTerpilih. Jadi di sini yang diisi hanya check-in dan
 * durasinya; check-out bulanan dibiarkan dihitung oleh aturan yang
 * sudah ada agar tidak ada dua sumber kebenaran.
 *
 * Tanggal yang tidak sah atau sudah lewat sudah dibuang lebih dulu oleh
 * bacaPilihanTanggal(), sehingga form tidak pernah terisi nilai yang
 * langsung ditolak validasinya sendiri.
 */
function terapkanPilihanTanggal(parameter) {
  const pilihan = bacaPilihanTanggal(parameter);
  if (!pilihan.mulai && !pilihan.selesai) return;

  const checkinInput = document.getElementById('checkinInput');
  const checkoutInput = document.getElementById('checkoutInput');
  const bulanan = document.getElementById('tipeSewaSelect').value === 'bulanan';

  if (pilihan.mulai) checkinInput.value = pilihan.mulai;

  if (bulanan) {
    // Yang dibawa ke sewa bulanan bukan tanggal check-out-nya, melainkan
    // berapa bulan lamanya. Jarak dua tanggal dipakai lebih dulu karena
    // itu yang benar-benar dipilih pengunjung; nilai "durasi" hanya
    // dipakai bila tanggal selesai memang dikosongkan.
    const bulan = bulanAntara(pilihan.mulai, pilihan.selesai) || pilihan.durasi;
    if (DURASI_BULAN_TERSEDIA.indexOf(bulan) !== -1) {
      durasiBulanTerpilih = bulan;
    }
    return;
  }

  // Sewa harian: tanggal check-out dipakai apa adanya selama masuk akal.
  if (pilihan.selesai &&
      (!pilihan.mulai || selisihHari(pilihan.mulai, pilihan.selesai) > 0)) {
    checkoutInput.value = pilihan.selesai;
    return;
  }

  // Tanggal selesai dikosongkan -> dihitung dari durasi panel Beranda.
  if (pilihan.mulai && pilihan.durasi > 0) {
    const akhir = new Date(pilihan.mulai + 'T00:00:00');
    akhir.setDate(akhir.getDate() + pilihan.durasi);
    checkoutInput.value = keTeksTanggal(akhir);
  }
}

/**
 * Menyesuaikan tampilan form mengikuti tipe sewa yang dipilih:
 * tombol durasi bulan hanya muncul pada sewa bulanan, dan pada sewa
 * bulanan tanggal check-out dikunci karena dihitung otomatis.
 */
function perbaruiTampilanTipeSewa() {
  const tipeSewa = document.getElementById('tipeSewaSelect').value;
  const bulanan = tipeSewa === 'bulanan';

  const grupDurasi = document.getElementById('durasiBulananGroup');
  const checkoutInput = document.getElementById('checkoutInput');
  const catatanHarian = document.getElementById('catatanSewaHarian');

  if (grupDurasi) grupDurasi.classList.toggle('hidden', !bulanan);
  if (catatanHarian) catatanHarian.classList.toggle('hidden', bulanan);

  // Pada sewa bulanan tanggal check-out tidak boleh diketik manual
  checkoutInput.readOnly = bulanan;
  checkoutInput.classList.toggle('cursor-not-allowed', bulanan);
  checkoutInput.classList.toggle('opacity-70', bulanan);

  if (bulanan) {
    hitungCheckoutOtomatis();
  }

  aturBatasTanggal();
  hitungUlangBiaya();
}

/** Menyorot tombol durasi bulan yang sedang dipilih. */
function perbaruiTombolDurasi() {
  document.querySelectorAll('.tombol-durasi-bulan').forEach(function (tombol) {
    const aktif = Number(tombol.dataset.bulan) === durasiBulanTerpilih;

    tombol.classList.toggle('bg-primary', aktif);
    tombol.classList.toggle('text-on-primary', aktif);
    tombol.classList.toggle('border-primary', aktif);
    tombol.classList.toggle('bg-surface-soft', !aktif);
    tombol.classList.toggle('text-ink-primary', !aktif);
    tombol.classList.toggle('border-transparent', !aktif);
  });
}

// =====================================================================
// 5. TOMBOL "PESAN SEKARANG"
// =====================================================================
function matikanTombolPesan(alasan) {
  const tombol = document.getElementById('pesanSekarangBtn');
  if (!tombol) return;

  tombol.disabled = true;
  tombol.className =
    'w-full bg-surface-variant text-ink-muted font-button-md text-button-md py-4 rounded-xl flex items-center justify-center gap-sm cursor-not-allowed';
  tombol.innerHTML =
    '<span class="material-symbols-outlined text-[20px]">block</span>' + alasan;
}

function pasangTombolPesan() {
  const tombol = document.getElementById('pesanSekarangBtn');
  const modal = document.getElementById('loginRequiredModal');

  tombol.addEventListener('click', function () {
    const tipeSewa = document.getElementById('tipeSewaSelect').value;
    const checkin = document.getElementById('checkinInput').value;
    const checkout = document.getElementById('checkoutInput').value;

    // --- Pemeriksaan tanggal sebelum lanjut ---
    if (!checkin) {
      alert('Silakan pilih tanggal check-in terlebih dahulu.');
      return;
    }
    if (!checkout) {
      alert('Silakan pilih tanggal check-out terlebih dahulu.');
      return;
    }
    if (selisihHari(checkin, checkout) <= 0) {
      alert('Tanggal check-out harus setelah tanggal check-in.');
      return;
    }

    const biaya = hitungBiaya(cabangAktif, tipeSewa, checkin, checkout);
    if (!biaya.valid || biaya.total <= 0) {
      alert('Total biaya belum dapat dihitung. Periksa kembali tanggal yang dipilih.');
      return;
    }

    // --- Wajib login sebelum memesan ---
    if (!localStorage.getItem('customerSession')) {
      // Titipkan alamat halaman ini supaya setelah login pengunjung
      // dikembalikan ke cabang yang sedang dilihatnya, bukan ke beranda.
      // Tanggal yang sudah diisi ikut dititipkan agar tidak hilang saat
      // pengunjung mampir ke halaman login.
      localStorage.setItem(KUNCI_TUJUAN,
        'room-detail.html?cabang=' + encodeURIComponent(cabangAktif.id) +
        '&tipe=' + encodeURIComponent(tipeSewa) +
        rangkaiPilihanTanggal({ mulai: checkin, selesai: checkout }));

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      return;
    }

    // --- Simpan pilihan pemesanan untuk dipakai halaman order ---
    localStorage.setItem('bookingData', JSON.stringify({
      cabangId: cabangAktif.id,
      namaCabang: cabangAktif.nama_cabang,
      alamatCabang: cabangAktif.alamat,
      gambarCabang: cabangAktif.gambar_url,

      tipeSewa: tipeSewa,
      checkin: checkin,
      checkout: checkout,

      durasi: biaya.durasi,
      satuanDurasi: biaya.satuanDurasi,
      hargaSatuan: biaya.hargaSatuan,
      hargaSewa: biaya.hargaSewa,
      biayaLayanan: biaya.biayaLayanan,
      total: biaya.total
    }));

    window.location.href = 'order/step-1.html';
  });
}

// =====================================================================
// 6. PEMASANGAN SELURUH AKSI FORM
// =====================================================================
function pasangAksiForm() {
  const tipeSewaSelect = document.getElementById('tipeSewaSelect');
  const checkinInput = document.getElementById('checkinInput');
  const checkoutInput = document.getElementById('checkoutInput');

  tipeSewaSelect.addEventListener('change', perbaruiTampilanTipeSewa);

  checkinInput.addEventListener('change', function () {
    aturBatasTanggal();

    // Pada sewa bulanan, check-out selalu mengikuti check-in
    if (tipeSewaSelect.value === 'bulanan') {
      hitungCheckoutOtomatis();
    } else if (checkoutInput.value && selisihHari(checkinInput.value, checkoutInput.value) <= 0) {
      // Pada sewa harian, check-out yang sudah tidak masuk akal dikosongkan
      checkoutInput.value = '';
    }

    hitungUlangBiaya();
  });

  checkoutInput.addEventListener('change', hitungUlangBiaya);

  // Tombol durasi 1 / 3 / 6 bulan
  document.querySelectorAll('.tombol-durasi-bulan').forEach(function (tombol) {
    tombol.addEventListener('click', function (e) {
      e.preventDefault();
      durasiBulanTerpilih = Number(tombol.dataset.bulan);
      perbaruiTombolDurasi();
      hitungCheckoutOtomatis();
      hitungUlangBiaya();
    });
  });

  pasangTombolPesan();
}

// =====================================================================
// 7. PROSES UTAMA
// =====================================================================
async function muatDetail() {
  aturLoading(true);

  const parameter = new URLSearchParams(window.location.search);
  const idCabang = parameter.get('cabang');

  if (!idCabang) {
    tampilkanError('Cabang tidak dipilih',
      'Alamat halaman ini harus menyertakan ID cabang, contoh: room-detail.html?cabang=pesona-kos');
    return;
  }

  try {
    const cabang = await ambilSatuCabang(idCabang);

    if (!cabang) {
      tampilkanError('Cabang tidak ditemukan',
        'Data cabang dengan ID "' + idCabang + '" tidak ada di database. Silakan pilih cabang lain dari katalog.');
      return;
    }

    cabangAktif = cabang;
    tampilkanDetailCabang(cabang);
    document.title = cabang.nama_cabang + ' - Pilar Pandawa';

    // Catat cabang yang sedang dibuka. Berguna untuk mengembalikan
    // pengunjung ke tempat yang sama setelah ia login.
    localStorage.setItem(KUNCI_CABANG_DIBUKA, JSON.stringify({
      cabangId: cabang.id,
      namaCabang: cabang.nama_cabang,
      alamat: cabang.alamat,
      waktuDibuka: new Date().toISOString()
    }));

    aturLoading(false);

    // Tipe sewa bisa dibawa dari beranda: room-detail.html?cabang=x&tipe=bulanan
    const tipeDibawa = parameter.get('tipe');
    if (tipeDibawa === 'bulanan' || tipeDibawa === 'harian') {
      document.getElementById('tipeSewaSelect').value = tipeDibawa;
    }

    // Tanggal dari panel filter halaman sebelumnya, contoh:
    // room-detail.html?cabang=x&tipe=bulanan&mulai=2026-09-01
    terapkanPilihanTanggal(parameter);

    pasangAksiForm();
    perbaruiTombolDurasi();
    perbaruiTampilanTipeSewa();

    // Cabang yang seluruh kamarnya terisi tidak bisa dipesan
    if (cabang.kamar_tersedia === 0) {
      matikanTombolPesan('Kamar Sedang Penuh');
    }

  } catch (err) {
    console.error('Gagal memuat detail cabang:', err);
    tampilkanError('Gagal memuat data',
      'Tidak dapat mengambil data dari server. Periksa koneksi internet Anda, lalu muat ulang halaman.');
  }
}

muatDetail();
