'use client'
// Tour content. A step points at an element (CSS selector, or a finder for
// things only recognisable by text) and is skipped when that element is not on
// screen — hidden by permissions, empty data, or a phone layout — so a tour
// never stops on nothing. A step without a target is a centred card.
import { NAV_GROUPS } from '@/components/app-sidebar'

export type TourTarget = string | (() => Element | null)

export interface TourStep {
  target?: TourTarget
  title: string
  body: string
  /** Keyboard hint shown as a key chip under the text, e.g. "Ctrl K". */
  kbd?: string
}

export interface Tour {
  id: string
  /** Bump to show a changed tour again to people who already saw it. */
  version: number
  title: string
  steps: TourStep[]
}

const MAIN = 'main'

/** First visible element matching the selector inside <main>. */
const inMain = (selector: string) => () =>
  Array.from(document.querySelectorAll(`${MAIN} ${selector}`)).find((el) => isVisible(el)) ?? null

export function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return false
  // Off-canvas (the phone sidebar while closed) counts as hidden.
  if (r.right <= 0 || r.left >= window.innerWidth) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
}

/** The screen's main "create" button (New / Create / Tambah / Record …). */
const createButton = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(`${MAIN} button, ${MAIN} a.v2-btn`)).find((b) => {
    const text = (b.textContent ?? '').trim().toLowerCase()
    return !('disabled' in b && b.disabled) && isVisible(b) && /^(\+\s*)?(new|create|add|record|tambah|buat)\b/.test(text)
  }) ?? null

// ── App introduction (first sign-in) ──
export const WELCOME_TOUR: Tour = {
  id: 'welcome',
  version: 1,
  title: 'Pengenalan aplikasi',
  steps: [
    {
      title: 'Selamat datang di Dapur Cokelat 👋',
      body: 'Tur singkat ini menunjukkan bagian penting aplikasi — kurang dari satu menit. Anda bisa melewatinya kapan saja dan memutarnya lagi dari tombol bantuan.',
    },
    {
      // On phones the sidebar is a closed drawer: skip it rather than point at nothing.
      target: () => {
        const el = document.querySelector('[data-tour="sidebar"]')
        if (window.innerWidth < 768 && el?.getAttribute('data-mobile-open') !== 'true') return null
        return el
      },
      title: 'Menu utama',
      body: 'Semua modul dikelompokkan di sini: operasional, penjualan, pembelian, persediaan, akuntansi, dan pengaturan. Menu yang tampil mengikuti hak akses role Anda.',
    },
    {
      target: '[data-tour="menu-search"]',
      title: 'Cari menu dengan cepat',
      body: 'Ketik nama menu untuk langsung membukanya, tanpa perlu menelusuri sidebar.',
      kbd: 'Ctrl K',
    },
    {
      target: '[data-tour="branch"]',
      title: 'Cabang aktif',
      body: 'Semua transaksi dan daftar mengikuti cabang ini. Titik hijau menandakan cabang yang sedang dipakai — klik untuk berpindah cabang.',
    },
    {
      target: '[data-tour="user-menu"]',
      title: 'Akun Anda',
      body: 'Lihat profil, muat ulang hak akses, atau keluar dari aplikasi.',
    },
    {
      target: '[data-tour="help"]',
      title: 'Bantuan kapan saja',
      body: 'Putar ulang tur ini, lihat tips untuk halaman yang sedang dibuka, atau buka FAQ dari tombol ini.',
    },
    {
      title: 'Siap mulai!',
      body: 'Di setiap modul, tips singkat akan ditawarkan saat pertama kali dibuka. Selamat bekerja!',
    },
  ],
}

// ── Module tours (by route) ──
const PAGE_TOURS: Record<string, Tour> = {
  '/dashboard': {
    id: 'page:/dashboard',
    version: 1,
    title: 'Dashboard',
    steps: [
      { target: '.dash-filters', title: 'Atur periode dan cabang', body: 'Pilih rentang tanggal (atau preset seperti bulan ini) dan cabang. Semua angka dan grafik di bawah mengikuti pilihan ini.' },
      { target: '.dash-top', title: 'Ringkasan utama', body: 'Pendapatan dibanding periode sebelumnya, beserta angka kunci lain. Kartu yang bisa diklik membuka laporan detailnya.' },
      { target: '.dash-row-3', title: 'Perlu perhatian', body: 'Pesanan yang menunggu dikirim, pembayaran tertunda, dan stok menipis — status langsung, tidak terbatas periode.' },
    ],
  },
  '/accounting/dashboard': {
    id: 'page:/accounting/dashboard',
    version: 1,
    title: 'Dashboard Akuntansi',
    steps: [
      { target: '.acc-hero', title: 'Ringkasan tugas', body: 'Berapa tugas akuntansi yang masih terbuka. Jika ada tugas kritis, kerjakan itu dulu karena menghambat posting jurnal.' },
      { target: '.acc-period', title: 'Periode berjalan', body: 'Periode akuntansi untuk hari ini dan sisa harinya. Tanpa periode terbuka, semua transaksi gagal dijurnal.' },
      { target: '.acc-filter', title: 'Saring tugas', body: 'Tampilkan yang belum selesai, hanya yang kritis, atau semua. Klik judul grup untuk menciutkannya — pilihan Anda diingat.' },
      { target: '[data-tour="acc-recent"]', title: 'Terakhir dibuka', body: 'Menu yang baru Anda buka, untuk kembali dengan sekali klik.' },
      { target: '[data-tour="acc-quick"]', title: 'Menu cepat', body: 'Pintasan ke menu akuntansi yang sering dipakai. Ketik untuk mencari, tekan Enter untuk membuka hasil pertama.' },
    ],
  },
  '/accounting/bank-reconciliation': {
    id: 'page:/accounting/bank-reconciliation',
    version: 1,
    title: 'Rekonsiliasi Bank',
    steps: [
      { target: createButton, title: 'Mulai rekonsiliasi', body: 'Pilih rekening bank dan periode, lalu isi saldo awal dan akhir sesuai rekening koran.' },
      { target: '[data-tour="filters"]', title: 'Saring daftar', body: 'Cari berdasarkan rekening, periode, atau status Draft / Completed.' },
      { target: inMain('table'), title: 'Daftar rekonsiliasi', body: 'Buka satu rekonsiliasi untuk mengunggah rekening koran, auto-match, mencocokkan manual, dan menyelesaikannya. Kerjakan per bulan secara berurutan.' },
    ],
  },
  '/accounting/faq': {
    id: 'page:/accounting/faq',
    version: 1,
    title: 'FAQ Akuntansi',
    steps: [
      { target: '.faq-search', title: 'Cari jawaban', body: 'Ketik kata kunci atau tempel pesan error yang muncul — jawaban yang cocok langsung terbuka.', kbd: 'Ctrl F' },
      { target: '.faq-nav', title: 'Topik', body: 'Saring pertanyaan per topik: periode, jurnal, kas & bank, rekonsiliasi, laporan, dan lainnya.' },
      { target: inMain('.faq-entry'), title: 'Buka jawaban', body: 'Klik pertanyaan untuk melihat jawaban dan tautan ke menu terkait. "Salin tautan" membagikan jawaban ke rekan kerja.' },
    ],
  },
}

// Short module tips shown on the generic tour's first step.
const MODULE_TIPS: { prefix: string; tip: string }[] = [
  { prefix: '/accounting/periods', tip: 'Setiap jurnal masuk ke periode yang mencakup tanggalnya. Tutup periode setelah semua jurnal diposting dan rekonsiliasi bank selesai.' },
  { prefix: '/accounting/journals', tip: 'Jurnal otomatis dari dokumen hanya bisa diubah dari dokumennya; jurnal yang sudah diposting dibatalkan dengan Reverse, bukan dihapus.' },
  { prefix: '/accounting/cash-transactions', tip: 'Pilih akun lawan untuk biaya atau pendapatan bank. Jika dikosongkan, transaksi dianggap perpindahan antara bank dan kas cabang.' },
  { prefix: '/accounting/bank-accounts', tip: 'Hubungkan setiap rekening ke akun COA agar transaksinya bisa dijurnal dan direkonsiliasi. Saldo awal terkunci setelah ada transaksi.' },
  { prefix: '/accounting/chart-of-accounts', tip: 'Akun header hanya untuk pengelompokan — jurnal selalu memakai akun posting (bukan header).' },
  { prefix: '/accounting/opening-balances', tip: 'Unduh template, isi saldo per akun, lalu unggah. Pastikan periode untuk tanggal saldo awal masih terbuka.' },
  { prefix: '/accounting/reports', tip: 'Gunakan pilihan Period untuk mengisi tanggal laporan sekaligus, dan pilihan cabang untuk melihat satu cabang atau semua.' },
  { prefix: '/accounting', tip: 'Jurnal otomatis dari dokumen hanya bisa diubah dari dokumennya; jurnal yang sudah diposting dibatalkan dengan Reverse.' },
  { prefix: '/sales', tip: 'Status pembayaran dan settlement diperbarui otomatis dari pembayaran yang dicatat.' },
  { prefix: '/purchase', tip: 'PO yang sudah diterima menjadi hutang supplier dan muncul di AP Aging.' },
  { prefix: '/products', tip: 'Perubahan stok tercatat sebagai stock movement, sehingga riwayatnya selalu bisa ditelusuri.' },
  { prefix: '/settings', tip: 'Perubahan pengaturan berlaku untuk cabang aktif kecuali disebutkan untuk seluruh perusahaan.' },
]

/** Sidebar label of a route, for the generic tour's title. */
function moduleName(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === pathname) return item.label
      for (const child of item.children ?? []) if (child.href === pathname) return child.label
    }
  }
  return null
}

/** Generic tour for any list screen: title, filters, create button, table. */
function genericTour(pathname: string): Tour | null {
  const name = moduleName(pathname)
  if (!name) return null
  const tip = MODULE_TIPS.find((t) => pathname.startsWith(t.prefix))?.tip
  return {
    id: `page:${pathname}`,
    version: 1,
    title: name,
    steps: [
      {
        target: inMain('h1'),
        title: `Tips: ${name}`,
        body: tip ?? 'Beberapa hal yang memudahkan kerja di halaman ini.',
      },
      {
        target: '[data-tour="filters"]',
        title: 'Cari dan saring',
        body: 'Pencarian berjalan di server, jadi mencakup semua halaman data. Tombol filter membuka pilihan tambahan.',
        kbd: 'Ctrl F',
      },
      {
        target: createButton,
        title: 'Tambah data',
        body: 'Membuat data baru dari tombol ini.',
        kbd: 'Ctrl B',
      },
      {
        target: inMain('table'),
        title: 'Aksi per baris',
        body: 'Lihat, ubah, dan hapus ada di sisi kanan setiap baris. Tombol abu-abu sedang dinonaktifkan — arahkan kursor ke tombol untuk melihat alasannya.',
      },
    ],
  }
}

export function tourForPath(pathname: string): Tour | null {
  return PAGE_TOURS[pathname] ?? genericTour(pathname)
}

export function tourById(id: string, pathname: string): Tour | null {
  if (id === WELCOME_TOUR.id) return WELCOME_TOUR
  const page = tourForPath(pathname)
  return page && page.id === id ? page : null
}

/** Steps whose target is on screen right now (centred steps always count). */
export function resolveSteps(tour: Tour): { step: TourStep; el: Element | null }[] {
  return tour.steps
    .map((step) => {
      if (!step.target) return { step, el: null }
      const el = typeof step.target === 'function' ? step.target() : document.querySelector(step.target)
      return { step, el: el && isVisible(el) ? el : undefined }
    })
    .filter((s): s is { step: TourStep; el: Element | null } => s.el !== undefined)
}
