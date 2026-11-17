// "?" help content for each page, keyed by Next.js route pathname. Rendered by
// <PageHelpButton /> in the top bar next to the page name.
//
// Labels (titles, item names) are English; descriptions are Bahasa Indonesia for
// the client. Written from how the backend (dapur-cokelat-api) actually behaves
// and from src/views/Accounting/Faq/faqData.ts — when a rule changes there,
// update the matching entry here.

export interface PageHelpItem {
  /** English label. */
  label: string
  /** Bahasa Indonesia description. */
  body: string
}

export interface PageHelp {
  /** English title of the popup. */
  title: string
  /** Bahasa Indonesia: what this page is. */
  summary: string
  /** English heading of the item list (default "When it's used"). */
  itemsTitle?: string
  items: PageHelpItem[]
  /** Bahasa Indonesia footnote. */
  note?: string
}

const ACCOUNT_SETTING_ORDER =
  'Jurnal otomatis mencari akun dengan urutan: Per-Branch (cabang, lalu cabang induk) → Per-Company. Akun persediaan diatur per kategori produk. Jika akun yang dibutuhkan belum diatur, transaksi terkait gagal dijurnal.'

export const PAGE_HELP: Record<string, PageHelp> = {
  // ── Accounting ──
  '/accounting/dashboard': {
    title: 'Accounting Dashboard',
    summary: 'Ringkasan kondisi pembukuan dan daftar tugas yang perlu diselesaikan agar laporan akurat.',
    itemsTitle: 'What it shows',
    items: [
      { label: 'Setup', body: 'Belum ada periode terbuka untuk hari ini, pengaturan akun (Account Settings) yang belum diisi, serta rekening bank dan metode pembayaran yang belum punya akun COA.' },
      { label: 'Daily', body: 'Pembayaran yang menunggu settlement, pesanan online yang menunggu payout, penjualan counter yang belum dibayar, dan jurnal draft.' },
      { label: 'Month end', body: 'Periode yang perlu ditutup, stock opname yang masih berjalan, dan rekonsiliasi bank yang jatuh tempo.' },
      { label: 'Year end', body: 'Tahun buku yang siap ditutup.' },
      { label: 'AR & AP', body: 'Piutang lewat jatuh tempo, hutang yang segera jatuh tempo, dan invoice lewat jatuh tempo yang memblokir pembuatan PO.' },
    ],
  },
  '/accounting/journals': {
    title: 'Journals',
    summary: 'Daftar semua jurnal: jurnal manual yang dibuat di sini dan jurnal otomatis dari dokumen (penjualan, pembayaran, penerimaan barang, pengiriman, produksi, transaksi kas, stock opname, tutup buku).',
    itemsTitle: 'How it works',
    items: [
      { label: 'Manual journal', body: 'Minimal dua baris bernilai, total debit sama dengan total kredit, satu baris tidak boleh berisi debit dan kredit sekaligus, akun header tidak bisa dipakai, dan tanggal jurnal harus berada di periode yang dipilih dan masih terbuka.' },
      { label: 'Automatic journal', body: 'Jurnal dari dokumen tidak bisa diedit, dihapus, atau di-Reverse dari sini — ubah atau batalkan lewat dokumen asalnya (tombol bertuliskan "Posted by …"). Jurnal penutup tahun juga terkunci.' },
      { label: 'Reverse', body: 'Jurnal manual yang sudah diposting tidak bisa dihapus; gunakan Reverse untuk membuat jurnal pembalik. Jika periode asli sudah ditutup, pembalik masuk ke tanggal hari ini.' },
      { label: 'Bank reconciliation lock', body: 'Baris jurnal yang sudah dicocokkan di Rekonsiliasi Bank harus di-Unmatch dulu sebelum diubah.' },
    ],
  },
  '/accounting/opening-balances': {
    title: 'Opening Balances',
    summary: 'Tempat memasukkan saldo awal akun saat mulai memakai sistem.',
    itemsTitle: 'How it works',
    items: [
      { label: 'Input', body: 'Pilih tanggal saldo awal dan akun penyeimbang (default: Historical Balancing), lalu isi saldo per akun atau impor dari template Excel.' },
      { label: 'Post', body: 'Simpan sebagai draft, periksa, lalu posting — sistem membuat satu jurnal saldo awal untuk cabang yang sedang aktif. Selisih debit dan kredit dibukukan ke akun penyeimbang.' },
      { label: 'Period', body: 'Periode untuk tanggal saldo awal harus sudah dibuat dan masih terbuka.' },
    ],
  },
  '/accounting/cash-transactions': {
    title: 'Cash Transactions',
    summary: 'Pencatatan uang masuk/keluar rekening bank di luar penjualan dan pembelian, misalnya bunga bank, biaya admin, atau setor/tarik kas kecil.',
    itemsTitle: 'Transaction types',
    items: [
      { label: 'Cash In', body: 'Menambah saldo rekening bank. Akun lawan dikredit — jika dikosongkan, memakai akun Kas cabang (cash).' },
      { label: 'Cash Out', body: 'Mengurangi saldo rekening bank. Akun lawan didebit — jika dikosongkan, memakai akun Kas cabang (cash).' },
      { label: 'Transfer', body: 'Memindahkan dana antar dua rekening bank.' },
      { label: 'Journal', body: 'Setiap transaksi otomatis dijurnal. Transaksi tidak bisa diedit — batalkan dengan Reverse. Transaksi tidak bisa dihapus setelah dibalik atau jika periodenya sudah ditutup.' },
    ],
  },
  '/accounting/bank-reconciliation': {
    title: 'Bank Reconciliation',
    summary: 'Membuktikan bahwa saldo rekening di buku besar sama dengan saldo di rekening koran bank. Biasanya dikerjakan satu kali per bulan untuk setiap rekening, setelah rekening koran bulan itu tersedia. Sistem membatasi satu rekonsiliasi per rekening per periode, hanya bisa dibuat selama periodenya masih terbuka, dan periode tidak bisa ditutup selama rekonsiliasinya masih draft.',
    itemsTitle: 'Steps',
    items: [
      { label: 'Create', body: 'Pilih rekening bank dan periode, isi saldo awal dan saldo akhir sesuai rekening koran.' },
      { label: 'Upload', body: 'Unggah rekening koran (.xlsx, .xls, .csv) dengan kolom Tanggal, Keterangan, Debet, Kredit.' },
      { label: 'Match', body: 'Auto-match memasangkan baris dengan nominal dan arah sama (selisih tanggal ±3 hari); sisanya dicocokkan manual. Baris yang hanya ada di bank (biaya admin, bunga) dicatat dengan Book.' },
      { label: 'Complete', body: 'Bisa diselesaikan jika semua baris rekening koran sudah cocok dan selisihnya nol. Rekonsiliasi harus dikerjakan berurutan per bulan.' },
    ],
  },
  '/accounting/budgets': {
    title: 'Budgets',
    summary: 'Anggaran per akun COA per periode (bulan).',
    items: [
      { label: 'Budget vs Actual', body: 'Anggaran di sini dibandingkan dengan realisasi jurnal pada laporan Budget vs Actual.' },
    ],
  },

  // ── Financial reports ──
  '/accounting/reports/trial-balance': {
    title: 'Trial Balance',
    summary: 'Neraca saldo: saldo setiap akun dalam satu periode. Total debit dan kredit harus seimbang.',
    itemsTitle: 'Columns',
    items: [
      { label: 'Opening', body: 'Saldo akun sebelum periode dimulai (termasuk jurnal penutup tahun sebelumnya).' },
      { label: 'Movement', body: 'Mutasi selama periode.' },
      { label: 'Closing', body: 'Opening + Movement. Klik baris akun untuk membuka Buku Besar akun itu.' },
    ],
  },
  '/accounting/reports/income-statement': {
    title: 'Income Statement',
    summary: 'Laporan laba rugi: pendapatan dikurangi HPP dan beban dalam rentang tanggal yang dipilih, berdasarkan jurnal yang diposting.',
    items: [
      { label: 'Branch', body: 'Default menampilkan cabang aktif beserta pickup point-nya. Pilih "Semua cabang" untuk seluruh perusahaan.' },
    ],
  },
  '/accounting/reports/balance-sheet': {
    title: 'Balance Sheet',
    summary: 'Neraca per tanggal: aset = kewajiban + ekuitas.',
    items: [
      { label: 'Current year earnings', body: 'Laba yang belum ditutup ke laba ditahan dihitung langsung dari pendapatan dikurangi beban, sehingga neraca tetap seimbang sebelum tutup buku.' },
      { label: 'Branch', body: 'Default menampilkan cabang aktif beserta pickup point-nya. Saldo kas dan bank dihitung per perusahaan.' },
    ],
  },
  '/accounting/reports/cash-flow': {
    title: 'Cash Flow',
    summary: 'Laporan arus kas: mutasi akun kas dan bank dalam rentang tanggal, dikelompokkan ke aktivitas Operasi, Investasi, dan Pendanaan berdasarkan akun lawannya.',
    items: [
      { label: 'Cash accounts', body: 'Akun yang dihitung sebagai kas: pengaturan cash dan bank perusahaan, akun Kas per cabang, dan akun metode pembayaran yang tidak memakai settlement.' },
    ],
  },
  '/accounting/reports/general-ledger': {
    title: 'General Ledger',
    summary: 'Buku besar: semua mutasi satu akun beserta saldo berjalannya.',
    items: [
      { label: 'Opening balance', body: 'Saldo berjalan dimulai dari saldo akun sebelum tanggal mulai, bukan dari nol.' },
      { label: 'Drill-down', body: 'Klik nomor jurnal untuk membuka jurnalnya, atau referensi untuk membuka dokumen asal.' },
    ],
  },
  '/accounting/reports/journal-entries': {
    title: 'Journal Entries',
    summary: 'Daftar baris jurnal (debit/kredit per akun) yang bisa difilter dan diekspor ke Excel.',
    items: [],
  },
  '/accounting/reports/comparative': {
    title: 'Comparative Reports',
    summary: 'Laba rugi dan neraca per bulan (hingga 12 kolom) dalam satu tahun buku, untuk membandingkan antar bulan. Default memakai tahun buku yang sedang aktif.',
    items: [],
  },
  '/accounting/reports/budget-vs-actual': {
    title: 'Budget vs Actual',
    summary: 'Membandingkan anggaran (menu Budgets) dengan realisasi jurnal per akun untuk satu periode.',
    items: [],
  },
  '/accounting/reports/tax-report': {
    title: 'Tax Report',
    summary: 'Laporan PPN Keluaran dan PPN Masukan dalam rentang tanggal, dibaca dari buku besar.',
    items: [
      { label: 'Output VAT', body: 'Dari penjualan yang mengenakan PPN — invoice dan Sales Order gudang/produksi (akun vat_output).' },
      { label: 'Input VAT', body: 'Dari pembelian ke supplier yang mengenakan PPN (akun vat_input).' },
    ],
    note: 'Ekspor e-Faktur belum tersedia karena sistem belum menyimpan nomor seri faktur pajak dan NPWP pelanggan.',
  },

  // ── AR & AP ──
  '/accounting/reports/ar-aging': {
    title: 'AR Aging',
    summary: 'Umur piutang: sisa tagihan pelanggan per tanggal akhir, dikelompokkan berdasarkan umur.',
    items: [
      { label: 'Included', body: 'Invoice yang masih bersisa setelah pembayaran, dan penjualan kredit customer yang belum ditagihkan (status credit).' },
      { label: 'Age', body: 'Umur dihitung dari tanggal jatuh tempo; jika dokumen tidak punya tanggal jatuh tempo, dihitung dari tanggal dokumen. Dokumen yang belum jatuh tempo masuk kelompok Current.' },
    ],
  },
  '/accounting/reports/ap-aging': {
    title: 'AP Aging',
    summary: 'Umur hutang ke supplier per tanggal.',
    items: [
      { label: 'Included', body: 'Hanya PO yang barangnya sudah diterima (sebagian atau penuh) dan belum lunas. PO draft, ditolak, atau belum diterima belum menjadi hutang.' },
    ],
  },
  '/accounting/reports/customer-statements': {
    title: 'Customer Statements',
    summary: 'Rekening koran pelanggan: daftar tagihan, pembayaran, dan saldo piutang satu pelanggan per tanggal.',
    items: [],
  },
  '/accounting/reports/supplier-debts': {
    title: 'Supplier Payable Card',
    summary: 'Kartu Hutang Supplier: mutasi hutang per supplier — PO yang sudah diterima dan pembayarannya.',
    items: [
      { label: 'Payments', body: 'Pembayaran ke PO yang barangnya belum diterima tidak dihitung di kartu ini.' },
      { label: 'Export', body: 'Ekspor membutuhkan tanggal mulai dan tanggal akhir.' },
    ],
  },
  '/accounting/reports/payments-report': {
    title: 'Payments Report',
    summary: 'Daftar pembayaran (masuk dan keluar) yang bisa difilter dan diekspor ke Excel.',
    items: [],
  },

  // ── Master data ──
  '/accounting/chart-of-accounts': {
    title: 'Chart of Accounts',
    summary: 'Daftar akun (COA) yang dipakai semua jurnal.',
    itemsTitle: 'Fields',
    items: [
      { label: 'Header account', body: 'Akun pengelompok. Tidak bisa dipakai di jurnal — gunakan akun turunannya.' },
      { label: 'Normal balance', body: 'Debit atau kredit. Pengaturan akun hanya menerima akun dengan saldo normal yang sesuai.' },
      { label: 'Active', body: 'Akun nonaktif tidak bisa dipilih di pengaturan akun.' },
      { label: 'Account type', body: 'Menentukan kelompok akun. Posisinya di laporan (neraca atau laba rugi) mengikuti Account Category dari Account Type tersebut.' },
    ],
  },
  '/accounting/account-categories': {
    title: 'Account Categories',
    summary: 'Kelompok besar akun (misalnya Aset, Kewajiban, Ekuitas, Pendapatan, Beban). Account Types berada di bawah kategori ini.',
    itemsTitle: 'Fields',
    items: [
      { label: 'Normal balance', body: 'Saldo normal (debit atau kredit) kategori ini.' },
      { label: 'Statement type', body: 'Menentukan apakah akun-akun di kategori ini masuk ke Neraca atau Laba Rugi.' },
    ],
  },
  '/accounting/account-types': {
    title: 'Account Types',
    summary: 'Jenis akun di bawah sebuah Account Category. Setiap akun COA memiliki satu Account Type.',
    items: [],
  },
  '/accounting/bank-accounts': {
    title: 'Bank Accounts',
    summary: 'Daftar rekening bank perusahaan.',
    items: [
      { label: 'Ledger account', body: 'Setiap rekening harus terhubung ke akun COA. Tanpa itu transaksi ke rekening tidak bisa dijurnal, saldo tidak bisa dihitung, dan rekening tidak bisa direkonsiliasi.' },
      { label: 'Balance', body: 'Saldo rekening = saldo awal + total mutasi akun buku besarnya. Saldo awal tidak bisa diubah setelah akun punya transaksi.' },
      { label: 'Used in', body: 'Cash Transactions, Bank Reconciliation, dan settlement pembayaran.' },
    ],
  },
  '/accounting/taxes': {
    title: 'Taxes',
    summary: 'Daftar tarif pajak (PPN) yang bisa dipilih di dokumen penjualan dan pembelian. Tarif disalin ke setiap baris kena pajak saat dokumen disimpan, jadi mengubah tarif di sini tidak mengubah dokumen yang sudah ada.',
    items: [
      { label: 'Sales Order (warehouse / production)', body: 'Gudang dan produksi memakai pajak di Sales Order. Wajib diisi jika ada baris yang ditandai kena pajak. PPN tiap baris = DPP (setelah diskon/voucher) × tarif.' },
      { label: 'Outlet POS', body: 'POS outlet tidak memakai pajak karena semua harga produk sudah termasuk pajak.' },
      { label: 'Supplier Purchase Order', body: 'Pajak hanya boleh dipakai pada PO ke supplier. PO antar-cabang tidak bisa memakai pajak.' },
      { label: 'Invoice', body: 'PPN pada invoice diambil dari baris Sales Order yang ditagihkan.' },
      { label: 'Automatic journal', body: 'Penjualan: PPN dikredit ke akun PPN Keluaran (vat_output). Pembelian: PPN didebit ke akun PPN Masukan (vat_input) saat penerimaan barang difinalkan.' },
      { label: 'Tax Report', body: 'Laporan pajak membaca saldo akun PPN Keluaran dan PPN Masukan.' },
    ],
    note: 'Kolom Inclusive saat ini hanya disimpan; perhitungan di Sales Order selalu menambahkan PPN di atas harga.',
  },
  '/accounting/fiscal-years': {
    title: 'Fiscal Years',
    summary: 'Tahun buku. Setiap periode (bulan) berada di dalam satu tahun buku.',
    itemsTitle: 'Year-end closing',
    items: [
      { label: 'Requirement', body: 'Tahun buku hanya bisa ditutup jika semua periodenya sudah ditutup. Setelah tahun buku ditutup, periodenya tidak bisa dibuka kembali.' },
      { label: 'Closing journal', body: 'Saat ditutup, sistem membuat jurnal penutup per cabang yang memindahkan saldo pendapatan dan beban ke Laba Ditahan (retained_earnings): laba dikredit, rugi didebit.' },
      { label: 'Locked', body: 'Jurnal penutup tidak bisa diedit, dihapus, atau dibalik secara manual.' },
    ],
  },
  '/accounting/periods': {
    title: 'Periods',
    summary: 'Periode akuntansi (biasanya per bulan) di dalam tahun buku. Setiap jurnal — manual maupun otomatis — masuk ke periode yang mencakup tanggalnya.',
    items: [
      { label: 'Missing / closed period', body: 'Jika periode untuk tanggal transaksi belum dibuat atau sudah ditutup, transaksi ditolak saat dijurnal.' },
      { label: 'Close', body: 'Bisa ditutup jika tidak ada jurnal draft dan rekonsiliasi bank draft di periode itu. Setelah ditutup tidak ada jurnal baru yang bisa masuk.' },
      { label: 'Reopen', body: 'Hanya untuk koreksi; angka laporan periode itu bisa berubah lagi. Tutup kembali setelah selesai. Tidak bisa jika tahun bukunya sudah ditutup.' },
    ],
  },

  // ── Account settings ──
  '/accounting/account-settings': {
    title: 'Company Account Settings',
    summary: 'Akun default jurnal otomatis untuk seluruh perusahaan. Kolom Usage menunjukkan kapan setiap key dipakai; klik Detail untuk daftar lengkapnya.',
    items: [
      { label: 'Lookup order', body: ACCOUNT_SETTING_ORDER },
      { label: 'Company only', body: 'Key yang tidak bisa diatur per cabang — misalnya PPN, selisih stock opname (stock_adjustment), dan laba ditahan untuk tutup buku — selalu memakai pengaturan perusahaan.' },
    ],
  },
  '/accounting/branch-account-settings': {
    title: 'Branch Account Settings',
    summary: 'Pengganti akun per cabang untuk key tertentu (piutang, hutang, pendapatan, diskon, HPP, kas). Key lain selalu memakai pengaturan perusahaan.',
    items: [
      { label: 'Lookup order', body: ACCOUNT_SETTING_ORDER },
      { label: 'Pickup point', body: 'Pickup point mewarisi akun dari outlet induknya jika tidak punya pengaturan sendiri.' },
    ],
  },
  '/accounting/buyer-account-settings': {
    title: 'Buyer Account Settings',
    summary: 'Pengganti akun per buyer (pembeli internal pada Purchase Order) untuk key pembelian.',
    items: [
      { label: 'Hutang dagang (ap_trade)', body: 'Dipakai saat penerimaan barang difinalkan (kredit) dan saat pembayaran ke supplier (debit), dengan urutan buyer → cabang → perusahaan.' },
    ],
  },
  '/accounting/product-category-account-settings': {
    title: 'Product Category Account Settings',
    summary: 'Akun persediaan per kategori produk per cabang. Kolom Usage menunjukkan kapan akun ini dipakai; klik Detail untuk daftar lengkapnya.',
    items: [
      { label: 'Separate categories', body: 'Pisahkan kategori bahan baku dan barang jadi: satu kategori memakai akun yang sama untuk sisi debit dan kredit.' },
      { label: 'Pickup point', body: 'Pickup point mewarisi akun kategori dari outlet induknya.' },
    ],
  },
}

export function getPageHelp(pathname: string): PageHelp | null {
  return PAGE_HELP[pathname] ?? null
}
