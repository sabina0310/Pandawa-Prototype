/**
 * =====================================================================
 * FORM PEMESANAN - LANGKAH 1 (customer/order/step-1.html)
 * =====================================================================
 * Tugas halaman ini:
 *   1. Membaca pilihan cabang & tanggal dari localStorage "bookingData"
 *      (disimpan oleh halaman detail cabang)
 *   2. Menampilkan ringkasan pesanan beserta rincian biayanya
 *   3. Menyesuaikan form dengan tipe sewa yang dipilih
 *   4. Memeriksa seluruh isian sebelum lanjut ke langkah 2
 *
 * Aturan tipe sewa:
 *   - HARIAN  : hanya untuk satu penyewa, khusus pria. Bagian
 *               penghuni tambahan disembunyikan.
 *   - BULANAN : boleh menambah penghuni lain (maksimal 3 orang)
 *               yang masih satu keluarga.
 * =====================================================================
 */

import { formatRupiah } from '../js/format.js';

const MAKS_PENGHUNI_TAMBAHAN = 3;

// Data pesanan yang dibawa dari halaman detail cabang
let bookingData = null;
let jumlahPenghuni = 0;

// =====================================================================
// 1. FUNGSI BANTU
// =====================================================================

function isiTeks(id, nilai) {
  const elemen = document.getElementById(id);
  if (elemen) elemen.textContent = nilai;
}

/** Mengubah "2025-10-15" menjadi "15 Okt 2025". */
function formatTanggal(teksTanggal) {
  if (!teksTanggal) return '-';
  const tanggal = new Date(teksTanggal + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return '-';

  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return tanggal.getDate() + ' ' + bulan[tanggal.getMonth()] + ' ' + tanggal.getFullYear();
}

// =====================================================================
// 2. MENAMPILKAN PESAN KESALAHAN PADA SEBUAH ISIAN
// =====================================================================

/**
 * Menandai satu isian sebagai salah: garis tepinya menjadi merah dan
 * pesan singkat ditampilkan tepat di bawahnya. Elemen pesan dibuat
 * sekali lalu dipakai ulang agar tidak menumpuk.
 */
function tandaiSalah(elemenInput, pesan) {
  if (!elemenInput) return;

  elemenInput.classList.add('border-error');
  elemenInput.classList.remove('border-border-strong');

  const idPesan = 'error-' + elemenInput.id;
  let elemenPesan = document.getElementById(idPesan);

  if (!elemenPesan) {
    elemenPesan = document.createElement('p');
    elemenPesan.id = idPesan;
    elemenPesan.className = 'font-body-sm text-[12px] text-error mt-xxs';
    // Diletakkan setelah pembungkus terdekat agar rapi pada isian WhatsApp
    const induk = elemenInput.closest('.flex.flex-col') || elemenInput.parentElement;
    induk.appendChild(elemenPesan);
  }

  elemenPesan.textContent = pesan;
  elemenPesan.classList.remove('hidden');
}

function bersihkanTanda(elemenInput) {
  if (!elemenInput) return;

  elemenInput.classList.remove('border-error');
  elemenInput.classList.add('border-border-strong');

  const elemenPesan = document.getElementById('error-' + elemenInput.id);
  if (elemenPesan) elemenPesan.classList.add('hidden');
}

function bersihkanSemuaTanda() {
  document.querySelectorAll('#formPemesanan input, #formPemesanan select')
    .forEach(bersihkanTanda);

  const ringkasan = document.getElementById('ringkasanError');
  if (ringkasan) ringkasan.classList.add('hidden');
}

function tampilkanRingkasanError(jumlahMasalah) {
  const ringkasan = document.getElementById('ringkasanError');
  if (!ringkasan) return;

  isiTeks('ringkasanErrorTeks',
    'Ada ' + jumlahMasalah + ' isian yang perlu diperbaiki sebelum melanjutkan.');
  ringkasan.classList.remove('hidden');
  ringkasan.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =====================================================================
// 3. ATURAN PEMERIKSAAN ISIAN
// =====================================================================

function periksaNik(nilai) {
  const bersih = String(nilai || '').trim();
  if (!bersih) return 'NIK wajib diisi.';
  if (!/^[0-9]+$/.test(bersih)) return 'NIK hanya boleh berisi angka.';
  if (bersih.length !== 16) return 'NIK harus tepat 16 digit (sekarang ' + bersih.length + ' digit).';
  return null;
}

function periksaNama(nilai) {
  const bersih = String(nilai || '').trim();
  if (!bersih) return 'Nama lengkap wajib diisi.';
  if (bersih.length < 3) return 'Nama terlalu pendek.';
  return null;
}

function periksaWhatsapp(nilai) {
  // Awalan +62 sudah tercetak di sebelah kiri isian,
  // jadi yang diketik pengguna dimulai dari angka 8.
  const bersih = String(nilai || '').trim().replace(/[\s-]/g, '');
  if (!bersih) return 'Nomor WhatsApp wajib diisi.';
  if (!/^[0-9]+$/.test(bersih)) return 'Nomor hanya boleh berisi angka.';
  if (!bersih.startsWith('8')) return 'Nomor diawali angka 8, contoh: 81234567890.';
  if (bersih.length < 9 || bersih.length > 13) return 'Panjang nomor tidak wajar (9-13 digit).';
  return null;
}

// =====================================================================
// 4. FORM PENGHUNI TAMBAHAN (khusus sewa bulanan)
// =====================================================================

function kartuPenghuniHtml(urutan) {
  return '' +
    '<div class="flex flex-col gap-sm border border-border-hairline rounded-lg p-md bg-surface-container-lowest shadow-sm" data-penghuni="' + urutan + '">' +
      '<div class="flex items-center justify-between pb-xs border-b border-border-hairline">' +
        '<h4 class="font-title-md text-title-md text-ink-primary">Data Penghuni Tambahan ' + urutan + '</h4>' +
        '<button type="button" data-hapus="' + urutan + '" ' +
          'class="tombol-hapus-penghuni flex items-center gap-xxs text-error font-label-md text-label-md hover:underline">' +
          '<span class="material-symbols-outlined text-[18px]">delete</span>Hapus</button>' +
      '</div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-lg mt-xs">' +

        '<div class="flex flex-col gap-xs">' +
          '<label class="font-title-md text-label-md text-ink-primary" for="nik_penghuni_' + urutan + '">Nomor Induk Kependudukan (NIK)</label>' +
          '<input class="w-full bg-surface-canvas border border-border-strong rounded-lg px-md py-md font-body-md text-ink-primary focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all outline-none placeholder:text-ink-muted" ' +
            'id="nik_penghuni_' + urutan + '" name="nik_penghuni_' + urutan + '" placeholder="Masukkan 16 digit NIK penghuni ' + urutan + '" type="text" inputmode="numeric" maxlength="16">' +
        '</div>' +

        '<div class="flex flex-col gap-xs">' +
          '<label class="font-title-md text-label-md text-ink-primary" for="nama_penghuni_' + urutan + '">Nama Lengkap (Sesuai KTP)</label>' +
          '<input class="w-full bg-surface-canvas border border-border-strong rounded-lg px-md py-md font-body-md text-ink-primary focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all outline-none placeholder:text-ink-muted" ' +
            'id="nama_penghuni_' + urutan + '" name="nama_penghuni_' + urutan + '" placeholder="Masukkan nama lengkap penghuni ' + urutan + '" type="text">' +
        '</div>' +

        '<div class="flex flex-col gap-xs">' +
          '<label class="font-title-md text-label-md text-ink-primary" for="hubungan_' + urutan + '">Hubungan Keluarga</label>' +
          '<select class="w-full bg-surface-canvas border border-border-strong rounded-lg px-md py-md font-body-md text-ink-primary focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all outline-none" ' +
            'id="hubungan_' + urutan + '" name="hubungan_' + urutan + '">' +
            '<option value="">Pilih Hubungan</option>' +
            '<option value="suami">Suami</option>' +
            '<option value="istri">Istri</option>' +
            '<option value="anak">Anak</option>' +
          '</select>' +
        '</div>' +

        '<div class="flex flex-col gap-xs">' +
          '<label class="font-title-md text-label-md text-ink-primary" for="whatsapp_penghuni_' + urutan + '">Nomor WhatsApp Aktif</label>' +
          '<div class="relative flex items-center">' +
            '<span class="absolute left-md font-body-md text-ink-secondary bg-surface-soft h-[calc(100%-2px)] rounded-l-lg flex items-center px-sm border-r border-border-strong">+62</span>' +
            '<input class="w-full bg-surface-canvas border border-border-strong rounded-lg pl-[64px] pr-md py-md font-body-md text-ink-primary focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all outline-none placeholder:text-ink-muted" ' +
              'id="whatsapp_penghuni_' + urutan + '" name="whatsapp_penghuni_' + urutan + '" placeholder="81234567890" type="tel" inputmode="numeric">' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
}

/** Menggambar ulang seluruh kartu penghuni sesuai jumlah saat ini. */
function gambarPenghuni(nilaiLama) {
  const wadah = document.getElementById('penghuni-forms-container');
  wadah.innerHTML = '';

  for (let i = 1; i <= jumlahPenghuni; i++) {
    wadah.insertAdjacentHTML('beforeend', kartuPenghuniHtml(i));
  }

  // Kembalikan isian yang sudah diketik sebelum kartu digambar ulang
  if (Array.isArray(nilaiLama)) {
    nilaiLama.forEach(function (data, urutan) {
      const nomor = urutan + 1;
      if (nomor > jumlahPenghuni) return;

      const nik = document.getElementById('nik_penghuni_' + nomor);
      const nama = document.getElementById('nama_penghuni_' + nomor);
      const hubungan = document.getElementById('hubungan_' + nomor);
      const wa = document.getElementById('whatsapp_penghuni_' + nomor);

      if (nik) nik.value = data.nik || '';
      if (nama) nama.value = data.nama || '';
      if (hubungan) hubungan.value = data.hubungan || '';
      if (wa) wa.value = data.whatsapp || '';
    });
  }

  // Tombol hapus pada tiap kartu
  wadah.querySelectorAll('.tombol-hapus-penghuni').forEach(function (tombol) {
    tombol.addEventListener('click', function () {
      hapusPenghuni(Number(tombol.dataset.hapus));
    });
  });

  perbaruiTampilanTombolTambah();
}

/** Membaca isian penghuni tambahan yang sedang tampil di layar. */
function bacaPenghuni() {
  const hasil = [];

  for (let i = 1; i <= jumlahPenghuni; i++) {
    const nik = document.getElementById('nik_penghuni_' + i);
    const nama = document.getElementById('nama_penghuni_' + i);
    const hubungan = document.getElementById('hubungan_' + i);
    const wa = document.getElementById('whatsapp_penghuni_' + i);

    hasil.push({
      nik: nik ? nik.value.trim() : '',
      nama: nama ? nama.value.trim() : '',
      hubungan: hubungan ? hubungan.value : '',
      whatsapp: wa ? wa.value.trim() : ''
    });
  }

  return hasil;
}

function tambahPenghuni() {
  if (jumlahPenghuni >= MAKS_PENGHUNI_TAMBAHAN) return;

  const nilaiLama = bacaPenghuni();
  jumlahPenghuni++;
  gambarPenghuni(nilaiLama);
}

function hapusPenghuni(urutan) {
  const nilaiLama = bacaPenghuni();
  nilaiLama.splice(urutan - 1, 1);

  jumlahPenghuni--;
  gambarPenghuni(nilaiLama);
}

function perbaruiTampilanTombolTambah() {
  const tombol = document.getElementById('tambahPenghuniBtn');
  if (!tombol) return;

  const penuh = jumlahPenghuni >= MAKS_PENGHUNI_TAMBAHAN;

  tombol.disabled = penuh;
  tombol.classList.toggle('opacity-50', penuh);
  tombol.classList.toggle('cursor-not-allowed', penuh);

  isiTeks('infoJumlahPenghuni',
    penuh
      ? 'Jumlah penghuni tambahan sudah mencapai batas maksimal (' + MAKS_PENGHUNI_TAMBAHAN + ' orang).'
      : jumlahPenghuni + ' dari ' + MAKS_PENGHUNI_TAMBAHAN + ' penghuni tambahan ditambahkan.');
}

// =====================================================================
// 5. MENAMPILKAN RINGKASAN PESANAN
// =====================================================================
function tampilkanRingkasan() {
  const bulanan = bookingData.tipeSewa === 'bulanan';

  isiTeks('orderTypeBadge', bulanan ? 'SEWA BULANAN' : 'SEWA HARIAN');
  isiTeks('summaryRoomName', bookingData.namaCabang || '-');
  isiTeks('summaryRoomAddress', bookingData.alamatCabang || '-');
  isiTeks('summaryCheckin', formatTanggal(bookingData.checkin));
  isiTeks('summaryCheckout', formatTanggal(bookingData.checkout));
  isiTeks('summaryDuration', bookingData.durasi + ' ' + bookingData.satuanDurasi);

  isiTeks('summaryHargaLabel',
    'Harga Sewa (' + bookingData.durasi + ' ' + bookingData.satuanDurasi + ')');
  isiTeks('summaryHargaValue', formatRupiah(bookingData.hargaSewa));
  isiTeks('summaryBiayaLayanan', formatRupiah(bookingData.biayaLayanan));
  isiTeks('summaryTotalValue', formatRupiah(bookingData.total));

  // Foto cabang pada kartu ringkasan
  const gambar = document.getElementById('summaryRoomImage');
  if (gambar && bookingData.gambarCabang) {
    gambar.src = bookingData.gambarCabang;
    gambar.alt = bookingData.namaCabang;
  }

  // Bagian penghuni tambahan & peringatan sewa harian
  const bagianPenghuni = document.getElementById('additional-tenant-section');
  const peringatanHarian = document.getElementById('peringatanSewaHarian');

  if (bagianPenghuni) bagianPenghuni.classList.toggle('hidden', !bulanan);
  if (peringatanHarian) peringatanHarian.classList.toggle('hidden', bulanan);
}

// =====================================================================
// 6. PEMERIKSAAN SELURUH FORM
// =====================================================================
function periksaForm() {
  bersihkanSemuaTanda();

  let masalah = 0;

  function cek(idInput, pemeriksa) {
    const input = document.getElementById(idInput);
    const pesan = pemeriksa(input ? input.value : '');
    if (pesan) {
      tandaiSalah(input, pesan);
      masalah++;
      return false;
    }
    return true;
  }

  // --- Penyewa utama ---
  cek('nik', periksaNik);
  cek('nama', periksaNama);
  cek('whatsapp', periksaWhatsapp);

  // --- Penghuni tambahan (hanya pada sewa bulanan) ---
  if (bookingData.tipeSewa === 'bulanan') {
    for (let i = 1; i <= jumlahPenghuni; i++) {
      cek('nik_penghuni_' + i, periksaNik);
      cek('nama_penghuni_' + i, periksaNama);
      cek('whatsapp_penghuni_' + i, periksaWhatsapp);

      const hubungan = document.getElementById('hubungan_' + i);
      if (hubungan && !hubungan.value) {
        tandaiSalah(hubungan, 'Hubungan keluarga wajib dipilih.');
        masalah++;
      }
    }

    // NIK tidak boleh sama antar penghuni
    const semuaNik = [document.getElementById('nik').value.trim()];
    for (let i = 1; i <= jumlahPenghuni; i++) {
      const input = document.getElementById('nik_penghuni_' + i);
      const nilai = input ? input.value.trim() : '';

      if (nilai && semuaNik.indexOf(nilai) !== -1) {
        tandaiSalah(input, 'NIK ini sudah dipakai penghuni lain.');
        masalah++;
      }
      semuaNik.push(nilai);
    }
  }

  // --- Pernyataan persetujuan ---
  const setuju = document.getElementById('agreement');
  if (setuju && !setuju.checked) {
    masalah++;
    const kotak = document.getElementById('kotakPersetujuan');
    if (kotak) kotak.classList.add('border-error');
  } else {
    const kotak = document.getElementById('kotakPersetujuan');
    if (kotak) kotak.classList.remove('border-error');
  }

  if (masalah > 0) {
    tampilkanRingkasanError(masalah);
    return false;
  }

  return true;
}

// =====================================================================
// 7. LANJUT KE LANGKAH 2
// =====================================================================
function lanjutKeStep2() {
  if (!periksaForm()) return;

  const identityData = {
    nik: document.getElementById('nik').value.trim(),
    nama: document.getElementById('nama').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim(),
    tenants: bookingData.tipeSewa === 'bulanan' ? bacaPenghuni() : []
  };

  localStorage.setItem('identityData', JSON.stringify(identityData));
  window.location.href = 'step-2.html';
}

// =====================================================================
// 8. PROSES UTAMA
// =====================================================================
function mulai() {
  const mentah = localStorage.getItem('bookingData');
  bookingData = mentah ? JSON.parse(mentah) : null;

  // Halaman ini tidak berguna tanpa pilihan cabang & tanggal
  if (!bookingData || !bookingData.cabangId) {
    alert('Data pemesanan tidak ditemukan. Anda akan diarahkan kembali ke katalog.');
    window.location.href = '../catalogue.html';
    return;
  }

  tampilkanRingkasan();

  // Sewa bulanan dimulai dengan satu kartu penghuni tambahan
  if (bookingData.tipeSewa === 'bulanan') {
    jumlahPenghuni = 1;
    gambarPenghuni([]);
  }

  const tombolTambah = document.getElementById('tambahPenghuniBtn');
  if (tombolTambah) {
    tombolTambah.addEventListener('click', tambahPenghuni);
  }

  const tombolLanjut = document.getElementById('lanjutStep2Btn');
  if (tombolLanjut) {
    tombolLanjut.addEventListener('click', lanjutKeStep2);
  }

  // Tanda merah dihapus begitu pengguna memperbaiki isiannya
  document.addEventListener('input', function (e) {
    if (e.target.matches('input, select')) bersihkanTanda(e.target);
  });
}

mulai();
