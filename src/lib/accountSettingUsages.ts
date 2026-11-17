// Where each account-setting key is actually used by the backend
// (dapur-cokelat-api, traced from its journal / report code, Nov 2026).
//
// One map shared by the Company, Per-Branch and Per-Product-Category
// account-setting screens. Keep it in sync with the backend: when a posting
// site starts (or stops) reading a key, update its entry here. A key with an
// empty list is shown as "Belum digunakan".
//
// User-facing text is in Bahasa Indonesia (the client is Indonesian).

export type AccountSettingUsageSide = 'debit' | 'credit' | 'debit_or_credit' | 'report'

export interface AccountSettingUsage {
  /** Short name of the flow, shown in the detail dialog. */
  flow: string
  /** When the account is used, in plain words (starts lowercase: follows "Digunakan saat"). */
  when: string
  /** Which side of the journal the account lands on. */
  side: AccountSettingUsageSide
  /** Optional extra detail (fallbacks, conditions). */
  note?: string
}

/**
 * Pseudo key for the Per-Product-Category screen: its rows have no setting key,
 * each row maps a product category to its inventory account.
 */
export const PRODUCT_CATEGORY_INVENTORY_KEY = 'product_category_inventory'

export const ACCOUNT_SETTING_USAGES: Record<string, AccountSettingUsage[]> = {
  ar_trade: [
    { flow: 'Penjualan POS', when: 'penjualan POS tunai/counter (bukan kredit) dilunasi', side: 'debit', note: 'Sebesar total order. Dibalik jika penjualan dibatalkan atau dikembalikan ke pending.' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS counter diretur', side: 'credit' },
    { flow: 'Invoice', when: 'invoice dibuat untuk sales order tanpa tipe kredit', side: 'debit' },
    { flow: 'Pembayaran', when: 'pembayaran masuk / refund melunasi penjualan counter atau invoice-nya', side: 'credit' },
  ],
  ar_trade_customer: [
    { flow: 'Penjualan POS kredit', when: 'penjualan POS dengan kredit customer atau kredit karyawan dipindah ke kredit / dilunasi', side: 'debit', note: 'Wajib untuk penjualan kredit — transaksi gagal jika belum dipetakan; tidak pernah dialihkan ke ar_trade.' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS kredit diretur', side: 'credit' },
    { flow: 'Invoice', when: 'invoice dibuat untuk sales order kredit', side: 'debit' },
    { flow: 'Pembayaran', when: 'pembayaran masuk melunasi penjualan kredit atau invoice-nya, atau ada sisa pembayaran yang tidak dialokasikan ke dokumen apa pun', side: 'credit' },
  ],
  ap_trade: [
    { flow: 'Penerimaan barang', when: 'penerimaan barang (receipt) difinalkan', side: 'credit', note: 'Ditentukan per buyer PO: buyer → cabang → perusahaan.' },
    { flow: 'Koreksi PPN Masukan', when: 'jurnal koreksi PPN Masukan diposting untuk receipt lama', side: 'credit' },
    { flow: 'Pembayaran supplier', when: 'pembayaran keluar (disburse) membayar purchase order / supplier', side: 'debit', note: 'Ditentukan per buyer PO: buyer → cabang → perusahaan.' },
  ],
  customer_deposits: [],
  supplier_advances: [],
  sales_revenue: [
    { flow: 'Penjualan POS', when: 'penjualan POS counter (bukan online) dilunasi', side: 'credit', note: 'Sebesar subtotal sebelum diskon dan pajak.' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS counter diretur', side: 'debit' },
    { flow: 'Invoice', when: 'invoice dibuat', side: 'credit', note: 'Sebesar subtotal invoice.' },
  ],
  sales_revenue_online: [
    { flow: 'Penjualan online', when: 'penjualan channel online (GoFood, Grab Food, …) menjadi final', side: 'credit', note: 'Wajib untuk penjualan online — transaksi gagal jika belum dipetakan; tidak dialihkan ke sales_revenue.' },
    { flow: 'Retur online', when: 'sebagian penjualan channel online diretur', side: 'debit' },
  ],
  sales_discount: [
    { flow: 'Penjualan POS', when: 'penjualan POS yang memiliki diskon dilunasi', side: 'debit' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS berdiskon diretur', side: 'credit' },
    { flow: 'Invoice', when: 'invoice yang memiliki diskon dibuat', side: 'debit' },
  ],
  vat_output: [
    { flow: 'Penjualan POS', when: 'penjualan POS kena pajak dilunasi', side: 'credit' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS kena pajak diretur', side: 'debit' },
    { flow: 'Invoice', when: 'invoice kena pajak dibuat', side: 'credit' },
    { flow: 'Laporan pajak', when: 'laporan pajak membaca PPN Keluaran dari akun ini', side: 'report' },
  ],
  purchase_expense: [],
  purchase_discount: [],
  vat_input: [
    { flow: 'Penerimaan barang', when: 'penerimaan barang untuk PO kena pajak difinalkan', side: 'debit', note: 'Pajak PO atas bagian yang diterima.' },
    { flow: 'Koreksi PPN Masukan', when: 'jurnal koreksi PPN Masukan diposting untuk receipt lama', side: 'debit' },
    { flow: 'Laporan pajak', when: 'laporan pajak membaca PPN Masukan dari akun ini', side: 'report' },
  ],
  cash: [
    { flow: 'Kas masuk', when: 'transaksi kas masuk disimpan tanpa memilih akun lawan', side: 'credit', note: 'Rekening bank didebit; kas outlet (cabang → induk → perusahaan) dikredit.' },
    { flow: 'Kas keluar', when: 'transaksi kas keluar disimpan tanpa memilih akun lawan', side: 'debit', note: 'Kas outlet didebit; rekening bank dikredit.' },
    { flow: 'Laporan arus kas', when: 'laporan arus kas menghitung akun ini (dan override cabang) sebagai kas', side: 'report' },
  ],
  bank: [
    { flow: 'Laporan arus kas', when: 'laporan arus kas menghitung akun ini sebagai kas', side: 'report', note: 'Tidak ada jurnal yang langsung memakai key ini; pembayaran memakai akun dari metode pembayaran masing-masing.' },
  ],
  rounding: [],
  retained_earnings: [
    { flow: 'Tutup buku akhir tahun', when: 'tahun fiskal ditutup', side: 'debit_or_credit', note: 'Laba bersih dikredit, rugi bersih didebit.' },
  ],
  sales_other_charge: [],
  handling_fee_revenue: [
    { flow: 'Invoice', when: 'invoice antar-perusahaan memiliki handling fee', side: 'credit' },
  ],
  inventory_asset: [
    { flow: 'Stock opname', when: 'stock opname diselesaikan dan produk tidak punya akun kategori maupun akun bahan baku / barang jadi', side: 'debit_or_credit', note: 'Cadangan terakhir. Selisih lebih didebit, selisih kurang dikredit.' },
  ],
  stock_adjustment: [
    { flow: 'Stock opname', when: 'stock opname diselesaikan dan ada selisih stok', side: 'debit_or_credit', note: 'Selisih lebih dikredit, selisih kurang didebit.' },
  ],
  cogs: [
    { flow: 'Penjualan POS', when: 'penjualan POS dilunasi (online: saat final)', side: 'debit', note: 'Sebesar HPP yang tercatat pada baris penjualan.' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS diretur', side: 'credit' },
    { flow: 'Pengiriman', when: 'pengiriman yang keluar dari perusahaan (customer eksternal atau perusahaan lain) difinalkan', side: 'debit' },
  ],
  raw_material_inventory: [
    { flow: 'Penerimaan barang', when: 'penerimaan barang difinalkan untuk produk yang kategorinya belum punya akun persediaan', side: 'debit', note: 'Hanya cadangan — akun Per Kategori Produk lebih diutamakan.' },
    { flow: 'Produksi', when: 'produksi difinalkan dan kategori bahan yang dipakai belum punya akun persediaan', side: 'credit', note: 'Hanya cadangan — akun Per Kategori Produk lebih diutamakan.' },
    { flow: 'Stock opname', when: 'stock opname diselesaikan untuk produk bahan baku / supply yang kategorinya belum punya akun persediaan', side: 'debit_or_credit', note: 'Hanya cadangan. Selisih lebih didebit, selisih kurang dikredit.' },
  ],
  finished_goods_inventory: [
    { flow: 'Produksi', when: 'produksi difinalkan dan kategori produk hasil belum punya akun persediaan', side: 'debit', note: 'Hanya cadangan — akun Per Kategori Produk lebih diutamakan.' },
    { flow: 'Pengiriman', when: 'pengiriman keluar perusahaan difinalkan untuk produk yang kategorinya belum punya akun persediaan', side: 'credit', note: 'Hanya cadangan — akun Per Kategori Produk lebih diutamakan.' },
    { flow: 'Stock opname', when: 'stock opname diselesaikan untuk produk WIP / barang jadi yang kategorinya belum punya akun persediaan', side: 'debit_or_credit', note: 'Hanya cadangan. Selisih lebih didebit, selisih kurang dikredit.' },
  ],
  [PRODUCT_CATEGORY_INVENTORY_KEY]: [
    { flow: 'Penerimaan barang', when: 'penerimaan barang difinalkan', side: 'debit', note: 'Kategori tanpa pemetaan memakai raw_material_inventory.' },
    { flow: 'Produksi', when: 'produksi difinalkan', side: 'debit_or_credit', note: 'Kategori produk hasil didebit, kategori bahan yang dipakai dikredit. Kategori tanpa pemetaan memakai finished_goods_inventory / raw_material_inventory.' },
    { flow: 'Penjualan POS', when: 'penjualan POS dilunasi (online: saat final)', side: 'credit', note: 'Mengurangi persediaan sebesar HPP. Wajib — penjualan gagal jika kategori belum punya akun.' },
    { flow: 'Retur POS', when: 'sebagian penjualan POS diretur', side: 'debit' },
    { flow: 'Pengiriman', when: 'pengiriman keluar perusahaan difinalkan', side: 'credit', note: 'Kategori tanpa pemetaan memakai finished_goods_inventory.' },
    { flow: 'Stock opname', when: 'stock opname diselesaikan dan ada selisih stok', side: 'debit_or_credit', note: 'Selisih lebih didebit, selisih kurang dikredit.' },
  ],
}

export function getAccountSettingUsages(key?: string | null): AccountSettingUsage[] {
  if (!key) return []
  return ACCOUNT_SETTING_USAGES[key] ?? []
}

export const ACCOUNT_SETTING_USAGE_SIDE_LABEL: Record<AccountSettingUsageSide, string> = {
  debit: 'Debit',
  credit: 'Kredit',
  debit_or_credit: 'Debit / Kredit',
  report: 'Hanya laporan',
}
