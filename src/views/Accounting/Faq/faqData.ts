// Accounting FAQ content (no backend). Written from how the system actually
// behaves — the rules the API enforces and the accounting audit
// (docs/accounting-audit-todo.md). When a rule changes, update its answer here.

export type FaqCategoryKey = 'periode' | 'jurnal' | 'kas-bank' | 'rekonsiliasi' | 'laporan' | 'piutang-hutang' | 'setup'

export interface FaqLink {
  label: string
  href: string
}

export interface FaqItem {
  id: string
  category: FaqCategoryKey
  question: string
  /** Paragraphs. */
  answer: string[]
  /** Numbered steps, when the answer is a procedure. */
  steps?: string[]
  /** Error text a user may have seen, so searching the message finds the answer. */
  errorText?: string
  links?: FaqLink[]
}

export const FAQ_CATEGORIES: { key: FaqCategoryKey; title: string; description: string }[] = [
  { key: 'periode', title: 'Periode & Tutup Buku', description: 'Periode akuntansi, tutup bulan, dan tutup tahun buku' },
  { key: 'jurnal', title: 'Jurnal', description: 'Jurnal manual, jurnal otomatis, dan pembalikan' },
  { key: 'kas-bank', title: 'Kas, Bank & Settlement', description: 'Transaksi kas, saldo rekening, EDC/QRIS, dan payout online' },
  { key: 'rekonsiliasi', title: 'Rekonsiliasi Bank', description: 'Mencocokkan rekening koran dengan buku besar' },
  { key: 'laporan', title: 'Laporan Keuangan', description: 'Neraca saldo, laba rugi, neraca, arus kas, dan pajak' },
  { key: 'piutang-hutang', title: 'Piutang & Hutang', description: 'Aging, kartu piutang/hutang, dan invoice jatuh tempo' },
  { key: 'setup', title: 'Pengaturan & Hak Akses', description: 'Akun default jurnal otomatis dan menu yang tidak muncul' },
]

export const FAQ_ITEMS: FaqItem[] = [
  // ── Periode & Tutup Buku ──
  {
    id: 'periode-tidak-ada',
    category: 'periode',
    question: 'Kenapa transaksi gagal dengan pesan "no accounting period covers…" atau "period is closed"?',
    errorText: 'no accounting period covers create it before posting; the accounting period is closed, so nothing can be posted',
    answer: [
      'Setiap jurnal — manual maupun otomatis dari penjualan, pembayaran, kas, dan dokumen lain — masuk ke periode akuntansi yang mencakup tanggal transaksinya. Jika periode untuk tanggal itu belum dibuat, atau sudah ditutup, sistem menolak posting agar laporan periode yang sudah dilaporkan tidak berubah.',
      'Solusinya: buat periode untuk bulan tersebut (di dalam tahun buku yang sesuai), atau gunakan tanggal yang berada di periode yang masih terbuka. Dashboard Akuntansi menandai kondisi ini sebagai tugas kritis.',
    ],
    links: [
      { label: 'Periods', href: '/accounting/periods' },
      { label: 'Fiscal Years', href: '/accounting/fiscal-years' },
    ],
  },
  {
    id: 'tutup-periode',
    category: 'periode',
    question: 'Bagaimana cara menutup periode bulanan?',
    answer: ['Tutup periode setelah semua transaksi bulan itu tercatat. Setelah ditutup, tidak ada jurnal baru yang bisa masuk ke periode tersebut.'],
    steps: [
      'Posting semua jurnal draft di periode itu — penutupan ditolak selama masih ada jurnal draft, dan pesannya menyebutkan cabang mana yang masih punya draft.',
      'Selesaikan (Complete) atau hapus rekonsiliasi bank yang masih draft untuk periode itu.',
      'Selesaikan stock opname yang masih berjalan agar selisih persediaan ikut terjurnal.',
      'Cek Neraca Saldo: total debit dan kredit harus seimbang.',
      'Buka Periods, lalu klik Close pada periode tersebut.',
    ],
    links: [
      { label: 'Periods', href: '/accounting/periods' },
      { label: 'Journals', href: '/accounting/journals' },
      { label: 'Trial Balance', href: '/accounting/reports/trial-balance' },
    ],
  },
  {
    id: 'buka-ulang-periode',
    category: 'periode',
    question: 'Apakah periode yang sudah ditutup bisa dibuka lagi?',
    answer: [
      'Bisa, lewat tombol Reopen di menu Periods, selama tahun bukunya belum ditutup. Gunakan hanya untuk koreksi: setelah dibuka, angka laporan periode itu bisa berubah lagi. Tutup kembali setelah koreksi selesai.',
      'Untuk kesalahan kecil, cara yang lebih aman adalah membuat jurnal koreksi di periode berjalan tanpa membuka periode lama.',
    ],
    links: [{ label: 'Periods', href: '/accounting/periods' }],
  },
  {
    id: 'tutup-tahun-buku',
    category: 'periode',
    question: 'Bagaimana cara menutup tahun buku?',
    answer: [
      'Tahun buku hanya bisa ditutup jika semua periodenya sudah ditutup; setelah itu periodenya tidak bisa dibuka kembali. Saat ditutup, sistem membuat jurnal penutup yang memindahkan saldo pendapatan dan beban ke laba ditahan, sehingga tahun berikutnya dimulai dengan laba rugi nol.',
      'Jurnal penutup tidak bisa diedit, dihapus, atau dibalik secara manual. Dashboard Akuntansi akan mengingatkan saat tahun buku siap ditutup.',
    ],
    links: [{ label: 'Fiscal Years', href: '/accounting/fiscal-years' }],
  },
  {
    id: 'tanggal-di-luar-periode',
    category: 'periode',
    question: 'Kenapa jurnal manual ditolak dengan pesan "journal date is outside period"?',
    errorText: 'the journal date is outside period',
    answer: [
      'Tanggal jurnal harus berada di dalam rentang periode yang dipilih. Laporan dikelompokkan berdasarkan tanggal jurnal, jadi jurnal bertanggal Januari yang dimasukkan ke periode Februari akan tetap mengubah laporan Januari.',
      'Pilih periode yang sesuai dengan tanggal jurnal — formulir jurnal memilihkan periode secara otomatis dari tanggal yang diisi.',
    ],
    links: [{ label: 'Journals', href: '/accounting/journals' }],
  },

  // ── Jurnal ──
  {
    id: 'jurnal-tidak-bisa-diubah',
    category: 'jurnal',
    question: 'Kenapa sebuah jurnal tidak bisa diedit atau dihapus?',
    answer: [
      'Jurnal yang dibuat otomatis oleh dokumen (penjualan, pembayaran, PO, penerimaan barang, transaksi kas, stock opname) tidak bisa diedit, dihapus, atau di-Reverse dari menu Journals — ubah atau batalkan lewat dokumen asalnya. Tombolnya dinonaktifkan dengan keterangan "Posted by …".',
      'Jurnal manual yang sudah diposting tidak bisa dihapus karena sudah menjadi bagian buku besar. Untuk membatalkannya gunakan Reverse, yang membuat jurnal pembalik dengan nilai berlawanan.',
    ],
    links: [{ label: 'Journals', href: '/accounting/journals' }],
  },
  {
    id: 'reverse-jurnal',
    category: 'jurnal',
    question: 'Ke periode mana jurnal pembalik (Reverse) masuk?',
    answer: [
      'Jika periode jurnal asli masih terbuka, jurnal pembalik memakai tanggal yang sama sehingga keduanya saling menghapus di periode itu.',
      'Jika periode asli sudah ditutup, jurnal pembalik masuk ke tanggal hari ini (zona waktu WIB) di periode yang sedang terbuka, sehingga periode lama tetap tidak berubah.',
    ],
  },
  {
    id: 'jurnal-direkonsiliasi',
    category: 'jurnal',
    question: 'Kenapa muncul pesan "this entry is matched in a bank reconciliation"?',
    errorText: 'this entry is matched in a bank reconciliation; unmatch it there first',
    answer: [
      'Baris jurnal itu sudah dicocokkan dengan baris rekening koran di Rekonsiliasi Bank. Mengubah atau menghapusnya akan membuat rekonsiliasi tidak valid.',
      'Buka rekonsiliasi bank yang bersangkutan, lakukan Unmatch pada pasangan tersebut, lalu ulangi perubahan. Jika rekonsiliasinya sudah Completed, buka kembali (Reopen) terlebih dahulu.',
    ],
    links: [{ label: 'Bank Reconciliation', href: '/accounting/bank-reconciliation' }],
  },
  {
    id: 'nomor-jurnal',
    category: 'jurnal',
    question: 'Bagaimana nomor jurnal dibuat?',
    answer: [
      'Nomor jurnal dibuat per cabang, per tanggal, dan per sumber (misalnya jurnal penjualan, kas, atau manual punya awalan berbeda). Urutannya mengambil nomor tertinggi yang sudah ada lalu ditambah satu, sehingga tidak terjadi nomor ganda walaupun ada jurnal yang dihapus.',
    ],
  },
  {
    id: 'saldo-awal',
    category: 'jurnal',
    question: 'Bagaimana memasukkan saldo awal saat mulai memakai sistem?',
    answer: [
      'Gunakan menu Opening Balances: pilih tanggal saldo awal dan akun penyeimbang (default: Historical Balancing), lalu isi saldo per akun atau impor dari template Excel. Simpan sebagai draft, periksa, lalu posting — sistem membuat satu jurnal saldo awal untuk cabang yang sedang aktif; selisih debit dan kredit dibukukan ke akun penyeimbang. Pastikan periode untuk tanggal tersebut sudah dibuat dan masih terbuka.',
    ],
    links: [{ label: 'Opening Balances', href: '/accounting/opening-balances' }],
  },

  // ── Kas, Bank & Settlement ──
  {
    id: 'kas-masuk-keluar',
    category: 'kas-bank',
    question: 'Apa beda Cash In, Cash Out, dan Transfer di Cash Transactions?',
    answer: [
      'Cash In menambah saldo rekening bank, Cash Out menguranginya, dan Transfer memindahkan dana antar dua rekening bank. Untuk Cash In/Out pilih akun lawan (misalnya Pendapatan Bunga atau Beban Administrasi Bank). Jika akun lawan dikosongkan, sistem memakai akun Kas cabang — artinya perpindahan antara bank dan kas kecil.',
      'Transaksi kas tidak bisa diedit; untuk membatalkannya gunakan Reverse. Transaksi kas tidak bisa dihapus setelah dibalik (reversed) atau jika periodenya sudah ditutup.',
    ],
    links: [{ label: 'Cash Transactions', href: '/accounting/cash-transactions' }],
  },
  {
    id: 'saldo-awal-rekening',
    category: 'kas-bank',
    question: 'Kenapa saldo awal rekening bank tidak bisa diubah lagi?',
    answer: [
      'Setelah akun buku besar rekening itu memiliki transaksi, saldo awal sudah menjadi bagian dari semua saldo yang dilaporkan. Mengubahnya akan menggeser seluruh saldo historis. Untuk koreksi, buat jurnal penyesuaian.',
      'Saldo rekening di menu Bank Accounts = saldo awal + total mutasi akun buku besarnya.',
    ],
    links: [{ label: 'Bank Accounts', href: '/accounting/bank-accounts' }],
  },
  {
    id: 'settlement-edc',
    category: 'kas-bank',
    question: 'Pembayaran kartu atau EDC sudah diterima tapi kenapa belum masuk ke saldo bank?',
    answer: [
      'Metode pembayaran yang memakai settlement (diatur per metode, biasanya kartu / EDC) tidak langsung menjurnal ke bank. Piutangnya tetap terbuka sampai dana benar-benar masuk ke rekening, karena bank biasanya mencairkannya beberapa hari kemudian dan memotong biaya (MDR).',
      'Saat dana masuk, catat di Settlements › Offline Orders: pilih pembayarannya, rekening tujuan, dan biaya yang dipotong. Sistem menjurnal Bank + Beban Admin terhadap piutang.',
    ],
    links: [{ label: 'Settlements (Offline)', href: '/sales/payment-settlements' }],
  },
  {
    id: 'payout-online',
    category: 'kas-bank',
    question: 'Bagaimana mencatat payout dari marketplace (pesanan online)?',
    answer: [
      'Pesanan online yang sudah final menunggu payout dari marketplace. Saat dana diterima, catat di Settlements › Online Orders dengan memilih pesanan yang dibayarkan dan potongan komisinya.',
    ],
    links: [{ label: 'Settlements (Online)', href: '/sales/settle-payout' }],
  },

  // ── Rekonsiliasi Bank ──
  {
    id: 'apa-itu-rekonsiliasi',
    category: 'rekonsiliasi',
    question: 'Apa itu rekonsiliasi bank dan kapan harus dikerjakan?',
    answer: [
      'Rekonsiliasi bank membuktikan bahwa saldo rekening di buku besar sama dengan saldo di rekening koran bank. Dikerjakan untuk setiap rekening bank, satu kali per periode (bulan), setelah rekening koran bulan itu tersedia — sebelum periode ditutup.',
      'Dashboard Akuntansi menampilkan rekening yang belum direkonsiliasi untuk periode terakhir yang sudah berakhir.',
    ],
    links: [{ label: 'Bank Reconciliation', href: '/accounting/bank-reconciliation' }],
  },
  {
    id: 'langkah-rekonsiliasi',
    category: 'rekonsiliasi',
    question: 'Bagaimana langkah-langkah rekonsiliasi bank?',
    answer: ['Ringkasan di sisi kanan layar menghitung selisih secara langsung di setiap langkah.'],
    steps: [
      'Klik New reconciliation, pilih rekening bank dan periode, lalu isi saldo awal dan saldo akhir sesuai rekening koran.',
      'Unggah rekening koran (Excel/CSV). Periksa pratinjau — baris yang bermasalah ditandai sebelum disimpan.',
      'Klik Auto-match: sistem memasangkan baris dengan nominal dan arah yang sama dalam selisih tanggal ±3 hari, hanya jika pasangannya pasti (tidak ambigu).',
      'Cocokkan sisanya secara manual: pilih satu atau beberapa baris rekening koran dan baris buku besar dengan total yang sama, lalu klik Match.',
      'Untuk baris yang hanya ada di bank (biaya admin, bunga, pajak bunga), gunakan Book — sistem membuat transaksi kas dan langsung mencocokkannya.',
      'Setelah selisih nol dan semua baris rekening koran sudah cocok, klik Complete.',
    ],
    links: [{ label: 'Bank Reconciliation', href: '/accounting/bank-reconciliation' }],
  },
  {
    id: 'tidak-bisa-complete',
    category: 'rekonsiliasi',
    question: 'Kenapa tombol Complete tidak bisa diklik?',
    answer: ['Rekonsiliasi hanya bisa diselesaikan jika ketiga syarat ini terpenuhi:'],
    steps: [
      'Setiap baris rekening koran sudah dicocokkan atau di-Book.',
      'Saldo awal + total masuk − total keluar = saldo akhir rekening koran (cek kembali angka yang diketik dari rekening koran).',
      'Selisih = 0, yaitu saldo bank yang disesuaikan (saldo akhir + setoran dalam perjalanan − pembayaran belum dicairkan) sama dengan saldo buku besar.',
    ],
  },
  {
    id: 'format-rekening-koran',
    category: 'rekonsiliasi',
    question: 'Format file rekening koran seperti apa yang bisa diunggah?',
    answer: [
      'File .xlsx, .xls, atau .csv dengan kolom Tanggal, Keterangan, Debet (keluar), dan Kredit (masuk); kolom Referensi dan Saldo bersifat opsional. Nama kolom ekspor bank yang umum dikenali otomatis, dan angka format Indonesia (1.250.000,00) maupun internasional didukung.',
      'Unduh template dari layar upload jika ekspor bank Anda tidak terbaca. Baris tanpa nominal (misalnya baris saldo awal) dilewati, dan baris bertanggal di luar periode ditolak.',
    ],
  },
  {
    id: 'urutan-rekonsiliasi',
    category: 'rekonsiliasi',
    question: 'Apakah rekonsiliasi harus dikerjakan berurutan per bulan?',
    errorText: 'reconcile periods in order; an earlier reconciliation of this bank account is still a draft; only the latest one can be reopened',
    answer: [
      'Ya. Untuk satu rekening, rekonsiliasi bulan baru tidak bisa dibuat selama rekonsiliasi bulan sebelumnya masih draft, dan tidak bisa dibuat untuk bulan yang lebih awal dari yang sudah ada. Hanya rekonsiliasi terakhir yang bisa dibuka kembali, dan hanya selama periodenya masih terbuka.',
      'Transaksi yang belum muncul di bank bulan ini (setoran dalam perjalanan, cek belum dicairkan) otomatis terbawa ke rekonsiliasi bulan berikutnya.',
    ],
  },

  // ── Laporan ──
  {
    id: 'filter-periode',
    category: 'laporan',
    question: 'Bagaimana cara melihat laporan untuk satu periode tertentu?',
    answer: [
      'Hampir setiap laporan akuntansi memiliki pilihan Period (Kartu Hutang Supplier tidak). Memilih periode akan mengisi tanggal mulai dan tanggal akhir secara otomatis. Untuk laporan "per tanggal" (Neraca, AP Aging, Customer Statements), tanggalnya diisi dengan tanggal akhir periode. Comparative Reports memakai tahun buku. Jika tanggal diubah manual, pilihan kembali ke "Rentang tanggal sendiri".',
    ],
  },
  {
    id: 'filter-cabang',
    category: 'laporan',
    question: 'Laporan menampilkan data cabang mana saja?',
    answer: [
      'Laporan keuangan (Neraca Saldo, Laba Rugi, Neraca, Arus Kas, Buku Besar, Pajak) secara default menampilkan cabang yang sedang aktif beserta pickup point di bawahnya. Pilih "Semua cabang" untuk melihat seluruh perusahaan, atau pilih satu cabang tertentu. Laporan piutang & hutang mengikuti cabang aktif. Saldo kas dan bank selalu dihitung per perusahaan karena rekening bank tidak terikat ke satu cabang.',
    ],
  },
  {
    id: 'neraca-saldo',
    category: 'laporan',
    question: 'Apa arti kolom Opening, Movement, dan Closing di Neraca Saldo?',
    answer: [
      'Opening adalah saldo akun sebelum periode dimulai (termasuk jurnal penutup tahun sebelumnya), Movement adalah mutasi selama periode, dan Closing = Opening + Movement. Klik baris akun untuk membuka Buku Besar akun itu dengan tanggal periode yang sama.',
    ],
    links: [
      { label: 'Trial Balance', href: '/accounting/reports/trial-balance' },
      { label: 'General Ledger', href: '/accounting/reports/general-ledger' },
    ],
  },
  {
    id: 'buku-besar-saldo-awal',
    category: 'laporan',
    question: 'Kenapa Buku Besar menampilkan baris "Opening balance"?',
    answer: [
      'Saldo berjalan di Buku Besar dimulai dari saldo akun sebelum tanggal mulai yang dipilih, bukan dari nol, sehingga saldo akhir di layar sama dengan saldo akun sebenarnya. Klik nomor jurnal untuk membuka jurnalnya, atau referensi untuk membuka dokumen asal.',
    ],
    links: [{ label: 'General Ledger', href: '/accounting/reports/general-ledger' }],
  },
  {
    id: 'pajak',
    category: 'laporan',
    question: 'PPN keluaran di Tax Report diambil dari mana?',
    answer: [
      'Dari semua penjualan yang mengenakan PPN: invoice, penjualan kasir (POS), dan pesanan online. PPN masukan diambil dari pembelian. Ekspor e-Faktur belum tersedia karena sistem belum menyimpan nomor seri faktur pajak dan NPWP pelanggan.',
    ],
    links: [{ label: 'Tax Report', href: '/accounting/reports/tax-report' }],
  },

  // ── Piutang & Hutang ──
  {
    id: 'ap-aging-po',
    category: 'piutang-hutang',
    question: 'Kenapa sebuah PO tidak muncul di AP Aging?',
    answer: [
      'AP Aging hanya memuat PO yang barangnya sudah diterima (sebagian atau penuh) dan belum lunas sampai tanggal laporan. PO draft, ditolak, atau belum diterima belum menjadi hutang. Pembayaran ke PO yang belum diterima juga tidak dihitung di Kartu Hutang.',
    ],
    links: [
      { label: 'AP Aging', href: '/accounting/reports/ap-aging' },
      { label: 'Kartu Hutang Supplier', href: '/accounting/reports/supplier-debts' },
    ],
  },
  {
    id: 'piutang-overdue',
    category: 'piutang-hutang',
    question: 'Kapan piutang dianggap lewat jatuh tempo?',
    answer: [
      'Di Dashboard Akuntansi dan untuk blokir PO, piutang dianggap lewat jatuh tempo jika invoice-nya memiliki tanggal jatuh tempo yang sudah lewat.',
      'Di laporan AR Aging, umur piutang dihitung dari tanggal jatuh tempo; dokumen tanpa tanggal jatuh tempo (misalnya penjualan kredit yang belum ditagihkan) dihitung dari tanggal dokumennya. Dokumen yang belum jatuh tempo masuk kelompok Current.',
    ],
    links: [{ label: 'AR Aging', href: '/accounting/reports/ar-aging' }],
  },
  {
    id: 'cabang-terblokir',
    category: 'piutang-hutang',
    question: 'Kenapa cabang tidak bisa membuat PO baru?',
    answer: [
      'Cabang yang memiliki invoice lewat jatuh tempo diblokir dari membuat PO baru sampai invoice tersebut dilunasi. Jika perlu pengecualian, superadmin dapat membuka blokir dengan Unlock overdue di menu Invoices.',
    ],
    links: [{ label: 'Invoices', href: '/transfer/invoices' }],
  },
  {
    id: 'kartu-export',
    category: 'piutang-hutang',
    question: 'Kenapa tombol ekspor Kartu Piutang/Hutang tidak aktif?',
    answer: ['Ekspor kartu membutuhkan tanggal mulai dan tanggal akhir. Isi keduanya (atau pilih Period) dan tombol akan aktif.'],
  },

  // ── Pengaturan & Hak Akses ──
  {
    id: 'akun-default',
    category: 'setup',
    question: 'Akun mana yang dipakai jurnal otomatis?',
    answer: [
      'Jurnal otomatis mengambil akun dari pengaturan akun dengan urutan: pengaturan per cabang (jika diisi), lalu cabang induk, lalu pengaturan perusahaan. Akun persediaan, penjualan, dan HPP bisa diatur per kategori produk. Metode pembayaran dan rekening bank masing-masing memakai akun yang diatur di menunya.',
      'Jika ada pengaturan yang belum menunjuk ke akun, transaksi terkait gagal dijurnal — Dashboard Akuntansi menandainya di grup Pengaturan dasar.',
    ],
    links: [
      { label: 'Account Settings (Company)', href: '/accounting/account-settings' },
      { label: 'Account Settings (Branch)', href: '/accounting/branch-account-settings' },
      { label: 'Payment Methods', href: '/settings/payment-methods' },
    ],
  },
  {
    id: 'rekening-tanpa-coa',
    category: 'setup',
    question: 'Kenapa rekening bank perlu dihubungkan ke akun COA?',
    answer: [
      'Tanpa akun buku besar, transaksi ke rekening itu tidak bisa dijurnal, saldo rekening tidak bisa dihitung, dan rekening tidak bisa direkonsiliasi. Atur akun COA di menu Bank Accounts.',
    ],
    links: [{ label: 'Bank Accounts', href: '/accounting/bank-accounts' }],
  },
  {
    id: 'menu-tidak-muncul',
    category: 'setup',
    question: 'Kenapa menu atau tombol tertentu tidak muncul?',
    answer: [
      'Menu dan tombol mengikuti hak akses role Anda. Contohnya Rekonsiliasi Bank membutuhkan bank-reconciliation.menu, dan Dashboard Akuntansi membutuhkan accounting-dashboard.read atau journal.menu. Minta admin menambahkan hak akses tersebut ke role Anda.',
      'Tombol yang terlihat tetapi abu-abu sedang dinonaktifkan karena kondisi data (misalnya periode sudah ditutup). Arahkan kursor ke tombol untuk melihat alasannya.',
    ],
    links: [{ label: 'Roles', href: '/users/roles' }],
  },
]
