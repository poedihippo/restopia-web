'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileSpreadsheet,
  HandCoins,
  History,
  Landmark,
  ListTree,
  NotebookPen,
  PartyPopper,
  PieChart,
  ReceiptText,
  RefreshCw,
  Search,
  Scale,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { CountUp } from '@/views/Dashboard/motion'
import { clearRecentPages, useRecentPages } from '@/lib/recentPages'
import {
  accountingDashboardService,
  type AccountingTask,
  type AccountingTaskGroup,
  type AccountingTaskSeverity,
  type AccountingTasksResponse,
} from '@/services/accounting-dashboard.service'
import { formatCurrency } from '@/utils/price'
import { formatDate, formatDateTime } from '@/utils/date'

// Copy and links are owned here, keyed by the API task key.
// doneTitle is what the row says once there is nothing left to do.
const TASK_META: Record<string, { title: string; doneTitle: string; description: string; href: string; unit?: string }> = {
  no_open_period_today: {
    title: 'Tidak ada periode terbuka untuk hari ini',
    doneTitle: 'Periode untuk hari ini sudah terbuka',
    description: 'Semua posting jurnal akan gagal sampai periode yang mencakup hari ini dibuat atau dibuka.',
    href: '/accounting/periods',
  },
  account_settings_missing: {
    title: 'Pengaturan akun perusahaan belum lengkap',
    doneTitle: 'Pengaturan akun perusahaan sudah lengkap',
    description: 'Ada pengaturan akun yang belum menunjuk ke akun (COA) yang valid.',
    href: '/accounting/account-settings',
    unit: 'pengaturan',
  },
  bank_accounts_without_coa: {
    title: 'Rekening bank tanpa akun COA',
    doneTitle: 'Semua rekening bank sudah punya akun COA',
    description: 'Rekening bank aktif yang belum dihubungkan ke akun buku besar.',
    href: '/accounting/bank-accounts',
    unit: 'rekening',
  },
  payment_methods_without_coa: {
    title: 'Metode pembayaran tanpa akun COA',
    doneTitle: 'Semua metode pembayaran sudah punya akun COA',
    description: 'Metode pembayaran langsung tanpa akun default maupun akun per cabang.',
    href: '/settings/payment-methods',
    unit: 'metode',
  },
  payments_awaiting_settlement: {
    title: 'Pembayaran menunggu settlement',
    doneTitle: 'Tidak ada pembayaran yang menunggu settlement',
    description: 'Pembayaran EDC / QRIS / kartu yang dananya belum dicatat masuk ke bank.',
    href: '/sales/payment-settlements',
    unit: 'pembayaran',
  },
  online_orders_awaiting_payout: {
    title: 'Pesanan online menunggu payout',
    doneTitle: 'Tidak ada pesanan online yang menunggu payout',
    description: 'Pesanan marketplace final yang payout-nya belum diterima.',
    href: '/sales/settle-payout',
    unit: 'pesanan',
  },
  unpaid_counter_orders: {
    title: 'Pesanan kasir belum lunas',
    doneTitle: 'Tidak ada pesanan kasir yang belum lunas',
    description: 'Pesanan offline yang belum dibayar atau baru dibayar sebagian.',
    href: '/sales/unpaid-offline-orders',
    unit: 'pesanan',
  },
  draft_journals: {
    title: 'Jurnal draft belum diposting',
    doneTitle: 'Tidak ada jurnal draft',
    description: 'Jurnal yang belum diposting tidak masuk ke laporan keuangan.',
    href: '/accounting/journals',
    unit: 'jurnal',
  },
  periods_to_close: {
    title: 'Periode yang sudah lewat belum ditutup',
    doneTitle: 'Semua periode yang sudah lewat sudah ditutup',
    description: 'Tutup periode setelah semua transaksi bulan tersebut selesai dicatat.',
    href: '/accounting/periods',
    unit: 'periode',
  },
  stock_opnames_open: {
    title: 'Stock opname masih berjalan',
    doneTitle: 'Tidak ada stock opname yang masih berjalan',
    description: 'Stock opname berstatus draft atau counting yang belum diselesaikan.',
    href: '/products/product-inventory/stock-opname',
    unit: 'opname',
  },
  bank_reconciliations_due: {
    title: 'Rekonsiliasi bank belum selesai',
    doneTitle: 'Rekonsiliasi bank periode terakhir sudah selesai',
    description: 'Rekening bank tanpa rekonsiliasi selesai untuk periode terakhir yang sudah berakhir.',
    href: '/accounting/bank-reconciliation',
    unit: 'rekening',
  },
  fiscal_year_ready_to_close: {
    title: 'Tahun buku siap ditutup',
    doneTitle: 'Tidak ada tahun buku yang menunggu ditutup',
    description: 'Tahun buku sudah berakhir dan semua periodenya sudah ditutup.',
    href: '/accounting/fiscal-years',
    unit: 'tahun buku',
  },
  overdue_receivables: {
    title: 'Piutang lewat jatuh tempo',
    doneTitle: 'Tidak ada piutang lewat jatuh tempo',
    description: 'Invoice pelanggan yang sudah melewati tanggal jatuh tempo.',
    href: '/accounting/reports/ar-aging',
    unit: 'invoice',
  },
  payables_due_soon: {
    title: 'Hutang jatuh tempo dalam 7 hari',
    doneTitle: 'Tidak ada hutang jatuh tempo dalam 7 hari',
    description: 'Tagihan supplier yang jatuh tempo dalam 7 hari atau sudah lewat jatuh tempo.',
    href: '/accounting/reports/ap-aging',
    unit: 'PO',
  },
  overdue_invoices_blocking: {
    title: 'Cabang terblokir invoice jatuh tempo',
    doneTitle: 'Tidak ada cabang yang terblokir invoice',
    description: 'Cabang dengan invoice lewat jatuh tempo tidak bisa membuat PO baru sampai dilunasi atau dibuka.',
    href: '/transfer/invoices',
    unit: 'cabang',
  },
}

const GROUPS: { key: AccountingTaskGroup; title: string; subtitle: string }[] = [
  { key: 'setup', title: 'Pengaturan dasar', subtitle: 'Harus beres dulu — kalau ada yang kurang, transaksi bisa gagal diposting ke jurnal.' },
  { key: 'daily', title: 'Harian', subtitle: 'Dicek setiap hari agar kas, bank, dan penjualan tercatat lengkap.' },
  { key: 'month_end', title: 'Akhir bulan', subtitle: 'Diselesaikan sebelum periode bulan berjalan ditutup.' },
  { key: 'year_end', title: 'Akhir tahun', subtitle: 'Penutupan tahun buku.' },
  { key: 'ar_ap', title: 'Piutang & Hutang', subtitle: 'Tagihan pelanggan dan supplier yang perlu ditindaklanjuti.' },
]

// Shortcuts to the accounting menus (same hrefs and permissions as the sidebar).
type QuickLink = { label: string; href: string; icon: LucideIcon; permission: string }
const QUICK_MENU: { title: string; links: QuickLink[] }[] = [
  {
    title: 'Transaksi',
    links: [
      { label: 'Jurnal', href: '/accounting/journals', icon: NotebookPen, permission: 'journal.menu' },
      { label: 'Kas & Bank', href: '/accounting/cash-transactions', icon: Wallet, permission: 'cash-transaction.menu' },
      { label: 'Rekonsiliasi Bank', href: '/accounting/bank-reconciliation', icon: ArrowLeftRight, permission: 'bank-reconciliation.menu' },
      { label: 'Settlement EDC/QRIS', href: '/sales/payment-settlements', icon: ReceiptText, permission: 'payment.menu' },
    ],
  },
  {
    title: 'Piutang & Hutang',
    links: [
      { label: 'AR Aging', href: '/accounting/reports/ar-aging', icon: ArrowDownLeft, permission: 'report.menu' },
      { label: 'AP Aging', href: '/accounting/reports/ap-aging', icon: ArrowUpRight, permission: 'journal.menu' },
      { label: 'Kartu Piutang', href: '/accounting/reports/customer-statements', icon: Users, permission: 'report.menu' },
      { label: 'Kartu Hutang', href: '/accounting/reports/supplier-debts', icon: HandCoins, permission: 'kartu-hutang-supplier.menu' },
    ],
  },
  {
    title: 'Laporan',
    links: [
      { label: 'Buku Besar', href: '/accounting/reports/general-ledger', icon: BookOpen, permission: 'report.menu' },
      { label: 'Neraca Saldo', href: '/accounting/reports/trial-balance', icon: FileSpreadsheet, permission: 'journal.menu' },
      { label: 'Laba Rugi', href: '/accounting/reports/income-statement', icon: PieChart, permission: 'journal.menu' },
      { label: 'Neraca', href: '/accounting/reports/balance-sheet', icon: Scale, permission: 'journal.menu' },
    ],
  },
  {
    title: 'Master & Pengaturan',
    links: [
      { label: 'Bagan Akun (COA)', href: '/accounting/chart-of-accounts', icon: ListTree, permission: 'chart-of-account.menu' },
      { label: 'Rekening Bank', href: '/accounting/bank-accounts', icon: Landmark, permission: 'bank-account.menu' },
      { label: 'Periode', href: '/accounting/periods', icon: CalendarDays, permission: 'period.menu' },
      { label: 'Pengaturan Akun', href: '/accounting/account-settings', icon: SlidersHorizontal, permission: 'account-setting.menu' },
    ],
  },
]

const SEVERITY_COLOR: Record<AccountingTaskSeverity, string> = {
  critical: 'var(--destructive)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  done: 'var(--success)',
}

const SEVERITY_RANK: Record<AccountingTaskSeverity, number> = { critical: 0, warning: 1, info: 2, done: 3 }

const SEVERITY_LABEL: Record<AccountingTaskSeverity, string> = {
  critical: 'Kritis',
  warning: 'Perlu tindakan',
  info: 'Info',
  done: 'Selesai',
}

type TaskFilter = 'open' | AccountingTaskSeverity | 'all'
const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'open', label: 'Belum selesai' },
  { key: 'critical', label: 'Kritis' },
  { key: 'warning', label: 'Perlu tindakan' },
  { key: 'info', label: 'Info' },
  { key: 'done', label: 'Selesai' },
  { key: 'all', label: 'Semua' },
]

const matchesFilter = (t: AccountingTask, f: TaskFilter) =>
  f === 'all' ? true : f === 'open' ? t.severity !== 'done' : t.severity === f

// Per-viewer UI memory (filter + collapsed groups); the page works without it.
const STORAGE_KEY = 'accounting-dashboard-ui'
function readUi(): { filter?: TaskFilter; collapsed?: string[] } {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
function writeUi(ui: { filter: TaskFilter; collapsed: string[] }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ui))
  } catch {
    /* storage unavailable: keep it in memory only */
  }
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--foreground)',
  margin: 0,
}

const mutedText: CSSProperties = { fontSize: 12, color: 'var(--foreground-muted)' }

function SeverityDot({ severity }: { severity: AccountingTaskSeverity }) {
  if (severity === 'done') {
    return (
      <span
        aria-label={SEVERITY_LABEL.done}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--success-bg)',
          color: 'var(--success)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Check size={12} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span aria-label={SEVERITY_LABEL[severity]} style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span
        className={severity === 'critical' ? 'acc-pulse' : undefined}
        style={{ width: 10, height: 10, borderRadius: '50%', background: SEVERITY_COLOR[severity], boxShadow: `0 0 0 3px color-mix(in srgb, ${SEVERITY_COLOR[severity]} 18%, transparent)` }}
      />
    </span>
  )
}

function taskMeta(key: string) {
  return TASK_META[key] ?? { title: key, doneTitle: key, description: '', href: '/accounting/journals' }
}

function TaskRow({ task }: { task: AccountingTask }) {
  const meta = taskMeta(task.key)
  const facts: string[] = []
  if (task.key !== 'no_open_period_today' && task.count > 0) facts.push(`${task.count.toLocaleString('id-ID')} ${meta.unit ?? ''}`.trim())
  if (task.amount != null && task.amount !== 0) facts.push(formatCurrency(task.amount))
  if (task.oldest_date) facts.push(`sejak ${formatDate(task.oldest_date)}`)

  return (
    <Link href={meta.href} className="acc-task">
      <SeverityDot severity={task.severity} />
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)' }}>{meta.title}</div>
        {meta.description && <div style={{ ...mutedText, marginTop: 2 }}>{meta.description}</div>}
      </div>
      {facts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {facts.map((f) => (
            <span key={f} className="acc-fact">
              {f}
            </span>
          ))}
        </div>
      )}
      <span className="acc-open">
        Buka <ArrowUpRight size={13} />
      </span>
    </Link>
  )
}

function DoneRow({ task }: { task: AccountingTask }) {
  const meta = taskMeta(task.key)
  return (
    <Link href={meta.href} className="acc-done">
      <SeverityDot severity="done" />
      <span style={{ flex: 1, minWidth: 0 }}>{meta.doneTitle}</span>
      <ArrowUpRight size={12} className="acc-done-arrow" />
    </Link>
  )
}

function GroupSection({
  title,
  subtitle,
  tasks,
  filter,
  collapsed,
  onToggle,
}: {
  title: string
  subtitle: string
  tasks: AccountingTask[]
  filter: TaskFilter
  collapsed: boolean
  onToggle: () => void
}) {
  const open = tasks.filter((t) => t.severity !== 'done').sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  const done = tasks.filter((t) => t.severity === 'done')
  const visibleOpen = open.filter((t) => matchesFilter(t, filter))
  const visibleDone = done.filter((t) => matchesFilter(t, filter))
  const worst = open[0]?.severity
  const pct = tasks.length ? (done.length / tasks.length) * 100 : 0

  return (
    <section className="v2-card" style={{ overflow: 'hidden' }}>
      <button type="button" className="acc-group-head" onClick={onToggle} aria-expanded={!collapsed}>
        <ChevronDown size={16} className="acc-chevron" data-collapsed={collapsed || undefined} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={sectionTitleStyle}>{title}</h2>
            {open.length > 0 && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '1px 8px',
                  borderRadius: 999,
                  color: worst ? SEVERITY_COLOR[worst] : 'var(--foreground-muted)',
                  background: worst === 'critical' ? 'var(--destructive-bg)' : worst === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
                }}
              >
                {open.length} perlu dikerjakan
              </span>
            )}
          </div>
          <div style={{ ...mutedText, marginTop: 2 }}>{subtitle}</div>
        </div>
        {/* Mini progress ring: share of this group's checks that are done. */}
        <span className="acc-ring" style={{ '--pct': `${pct}%` } as CSSProperties} title={`${done.length}/${tasks.length} selesai`}>
          <span>
            {done.length}/{tasks.length}
          </span>
        </span>
      </button>

      <div className="acc-collapse" data-collapsed={collapsed || undefined}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          {visibleOpen.map((t) => (
            <TaskRow key={t.key} task={t} />
          ))}
          {visibleOpen.length === 0 && filter !== 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <SeverityDot severity="done" />
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                {open.length === 0 ? 'Semua beres, tidak ada yang perlu dikerjakan.' : 'Tidak ada tugas dengan filter ini.'}
              </span>
            </div>
          )}
          {visibleDone.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--background)', padding: '4px 0 6px' }}>
              {visibleDone.map((t) => (
                <DoneRow key={t.key} task={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function LedgerArt() {
  return (
    <svg viewBox="0 0 240 150" width="220" height="138" aria-hidden="true" className="acc-hero-art">
      <ellipse cx="118" cy="140" rx="96" ry="7" fill="var(--accent-light)" opacity="0.25" />
      <g className="acc-float">
        {/* open ledger */}
        <rect x="26" y="38" width="160" height="96" rx="9" fill="var(--cocoa-700, #4A2E21)" />
        <path d="M34 44h70c4 0 6 2 6 5v79H34z" fill="#FBF4EC" />
        <path d="M110 49c0-3 2-5 6-5h62v84h-68z" fill="#F3E3D3" />
        <rect x="106" y="44" width="8" height="84" fill="var(--cocoa-900, #2A1A13)" opacity="0.35" />
        <g fill="var(--accent-light)">
          <rect x="44" y="58" width="34" height="3" rx="1.5" opacity="0.7" />
          <rect x="84" y="58" width="14" height="3" rx="1.5" />
          <rect x="44" y="70" width="28" height="3" rx="1.5" opacity="0.7" />
          <rect x="84" y="70" width="14" height="3" rx="1.5" />
          <rect x="44" y="82" width="38" height="3" rx="1.5" opacity="0.7" />
          <rect x="88" y="82" width="10" height="3" rx="1.5" />
          <rect x="44" y="94" width="24" height="3" rx="1.5" opacity="0.7" />
          <rect x="84" y="94" width="14" height="3" rx="1.5" />
        </g>
        <rect x="44" y="108" width="54" height="2" rx="1" fill="var(--cocoa-700, #4A2E21)" opacity="0.5" />
        <rect x="80" y="114" width="18" height="4" rx="2" fill="var(--cocoa-700, #4A2E21)" />
        {/* growing bars */}
        <g fill="var(--caramel, #C68B4E)">
          <rect className="acc-bar" x="122" y="100" width="10" height="18" rx="2" opacity="0.55" />
          <rect className="acc-bar" style={{ animationDelay: '120ms' }} x="138" y="90" width="10" height="28" rx="2" opacity="0.7" />
          <rect className="acc-bar" style={{ animationDelay: '240ms' }} x="154" y="78" width="10" height="40" rx="2" opacity="0.85" />
        </g>
        <polyline points="127,92 143,82 159,70 172,58" fill="none" stroke="var(--cocoa-700, #4A2E21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="172" cy="58" r="3.5" fill="var(--cocoa-700, #4A2E21)" />
        {/* check badge */}
        <g className="acc-pop">
          <circle cx="40" cy="38" r="13" fill="var(--success, #2E7D5B)" />
          <path d="M34 38l4 4 8-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      {/* coin stack */}
      <g className="acc-coins">
        {[124, 116, 108, 100].map((y) => (
          <g key={y}>
            <rect x="192" y={y} width="34" height="8" fill="#D9A066" />
            <ellipse cx="209" cy={y + 8} rx="17" ry="5" fill="#C68B4E" />
            <ellipse cx="209" cy={y} rx="17" ry="5" fill="#E8B983" />
          </g>
        ))}
        <text x="209" y="102.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="var(--cocoa-700, #4A2E21)">Rp</text>
      </g>
      <g fill="var(--accent-light)">
        <path className="acc-twinkle" d="M14 66l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path className="acc-twinkle" style={{ animationDelay: '0.7s' }} d="M206 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path className="acc-twinkle" style={{ animationDelay: '1.4s' }} d="M230 76l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" opacity="0.7" />
      </g>
    </svg>
  )
}

function Hero({ tasks }: { tasks: AccountingTask[] }) {
  const { user } = useAuth()
  const total = tasks.length
  const done = tasks.filter((t) => t.severity === 'done').length
  const critical = tasks.filter((t) => t.severity === 'critical').length
  const open = total - done
  const pct = total ? Math.round((done / total) * 100) : 0

  const headline =
    open === 0
      ? 'Semua pembukuan beres 🎉'
      : critical > 0
        ? `${critical} hal penting perlu dibereskan dulu`
        : `${open} tugas menunggu dikerjakan`
  const firstName = user?.name?.split(' ')[0] ?? ''

  return (
    <section className="acc-hero">
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {firstName ? `Halo, ${firstName}` : 'Tugas akuntansi'}
        </span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {headline}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
          {open === 0
            ? 'Tidak ada yang tertunda. Laporan keuangan siap dibaca.'
            : critical > 0
              ? 'Mulai dari tugas kritis (titik merah) karena itu menghambat posting jurnal, lalu harian, akhir bulan, dan seterusnya.'
              : 'Tidak ada yang kritis. Mulai dari tugas harian, lalu akhir bulan, akhir tahun, serta piutang & hutang.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, maxWidth: 360 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div
              className="acc-progress"
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 999,
                background: critical > 0 ? 'var(--destructive)' : 'linear-gradient(90deg, #E2B07A, var(--caramel, #C68B4E))',
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {done}/{total} selesai
          </span>
        </div>
      </div>
      <LedgerArt />
    </section>
  )
}

function KpiCard({ icon, label, value, hint, href }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; href: string }) {
  return (
    <Link href={href} className="v2-card acc-kpi">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...mutedText, fontWeight: 500 }}>
        <span className="acc-kpi-icon">{icon}</span>
        {label}
        <ArrowUpRight size={13} className="acc-kpi-arrow" />
      </div>
      <div className="acc-kpi-value">{value}</div>
      {hint && <div style={mutedText}>{hint}</div>}
    </Link>
  )
}

const relativeTime = (at: number) => {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} mnt lalu`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.round(hours / 24)
  return days === 1 ? 'kemarin' : `${days} hari lalu`
}

// Menus this viewer opened recently (this browser only), newest first.
function RecentlyViewed() {
  const pages = useRecentPages().filter((p) => p.href !== '/accounting/dashboard').slice(0, 4)

  return (
    <section data-tour="acc-recent" className="v2-card" style={{ padding: '14px 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <History size={15} style={{ color: 'var(--foreground-muted)' }} />
        <h2 style={{ ...sectionTitleStyle, flex: 1 }}>Terakhir dibuka</h2>
        {pages.length > 0 && (
          <button type="button" className="acc-recent-clear" onClick={clearRecentPages} title="Hapus riwayat menu di browser ini">
            Hapus
          </button>
        )}
      </div>
      {pages.length === 0 ? (
        <div style={{ ...mutedText, padding: '12px 4px 8px', lineHeight: 1.5 }}>Menu yang Anda buka akan muncul di sini supaya bisa kembali dengan sekali klik.</div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {pages.map((p) => (
            <Link key={p.href} href={p.href} className="acc-quick acc-recent">
              <span className="acc-recent-initial">{p.label.slice(0, 1).toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.section}</span>
              </span>
              <span className="acc-recent-time">{relativeTime(p.at)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function QuickMenu() {
  const { hasPermission } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const sections = QUICK_MENU.map((section) => ({
    ...section,
    links: section.links.filter((l) => hasPermission(l.permission) && (!q || l.label.toLowerCase().includes(q) || section.title.toLowerCase().includes(q))),
  })).filter((section) => section.links.length > 0)
  const first = sections[0]?.links[0]

  if (!q && sections.length === 0) return null

  return (
    <section data-tour="acc-quick" className="v2-card" style={{ padding: '14px 12px 8px' }}>
      <h2 style={{ ...sectionTitleStyle, padding: '0 4px' }}>Menu cepat</h2>
      <div style={{ position: 'relative', margin: '10px 4px 0' }}>
        <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)' }} />
        <input
          className="v2-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && first) router.push(first.href)
            if (e.key === 'Escape') setQuery('')
          }}
          placeholder="Cari menu… (Enter untuk buka)"
          aria-label="Cari menu akuntansi"
          style={{ width: '100%', paddingLeft: 30 }}
        />
      </div>
      {sections.length === 0 && <div style={{ ...mutedText, padding: '14px 4px 8px' }}>Tidak ada menu yang cocok.</div>}
      {sections.map((section) => (
        <div key={section.title} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--foreground-subtle)', padding: '0 4px 4px' }}>
            {section.title}
          </div>
          {section.links.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className="acc-quick" data-first={(q && first?.href === href) || undefined}>
              <span className="acc-quick-icon">
                <Icon size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              <ChevronRight size={14} className="acc-quick-arrow" />
            </Link>
          ))}
        </div>
      ))}
    </section>
  )
}

// The current period is the one thing every posting depends on, so it gets
// the featured card: live dot (like the active-branch pill), days-left ring
// and a timeline from the period's start to its end.
function PeriodCard({ period }: { period: AccountingTasksResponse['kpis']['current_period'] }) {
  const day = (v: string) => {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msDay = 86_400_000

  let totalDays = 0
  let dayNo = 0
  let left = 0
  if (period) {
    const start = day(period.start_date)
    const end = day(period.end_date)
    totalDays = Math.round((end.getTime() - start.getTime()) / msDay) + 1
    dayNo = Math.min(totalDays, Math.max(0, Math.round((today.getTime() - start.getTime()) / msDay) + 1))
    left = Math.max(0, totalDays - dayNo)
  }
  const pct = totalDays ? (dayNo / totalDays) * 100 : 0
  const state = !period ? 'none' : period.is_closed ? 'closed' : 'open'
  const endingSoon = state === 'open' && left <= 3

  return (
    <Link href="/accounting/periods" className="acc-period" data-state={state}>
      <span className="acc-period-orb" />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="acc-period-icon">
          <CalendarDays size={15} />
          <span className="acc-period-dot" data-state={state} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Periode Berjalan</span>
        <span className="acc-period-status" data-state={state}>
          {state === 'open' ? 'Terbuka · bisa posting' : state === 'closed' ? 'Ditutup' : 'Belum ada'}
        </span>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div className="acc-period-name">{period ? period.name : 'Buat periode dulu'}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            {period
              ? `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`
              : 'Tanpa periode yang mencakup hari ini, semua posting jurnal gagal.'}
          </div>
        </div>
        {period && (
          <span className="acc-period-ring" style={{ '--pct': `${pct}%` } as CSSProperties} title={`Hari ke-${dayNo} dari ${totalDays}`}>
            <span>
              <strong>{left}</strong>
              <small>hari lagi</small>
            </span>
          </span>
        )}
      </div>

      {period && (
        <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="acc-period-track">
            <div className="acc-period-fill" style={{ width: `${pct}%` }} />
            {dayNo > 0 && left > 0 && <span className="acc-period-today" style={{ left: `${pct}%` }} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
            <span>
              Hari ke-<strong style={{ color: '#fff', fontWeight: 500 }}>{dayNo}</strong> dari {totalDays}
            </span>
            <span style={{ color: endingSoon ? '#F5C27A' : undefined, fontWeight: endingSoon ? 600 : undefined }}>
              {state === 'closed' ? 'Periode sudah ditutup' : endingSoon ? 'Siapkan tutup buku' : 'Tutup buku di akhir periode'}
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}

function LoadingState() {
  return (
    <>
      <div className="v2-skeleton" style={{ height: 150, borderRadius: 'var(--radius-xl)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="v2-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="v2-skeleton" style={{ height: 12, width: '50%' }} />
            <div className="v2-skeleton" style={{ height: 20, width: '75%' }} />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="v2-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="v2-skeleton" style={{ height: 14, width: 140 }} />
          {[0, 1, 2].map((j) => (
            <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="v2-skeleton" style={{ width: 12, height: 12, borderRadius: '50%' }} />
              <div className="v2-skeleton" style={{ height: 12, flex: 1 }} />
              <div className="v2-skeleton" style={{ height: 26, width: 64 }} />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

const money = (n: number) => formatCurrency(Math.round(n))

export default function AccountingDashboardView() {
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['accounting-dashboard-tasks'],
    queryFn: () => accountingDashboardService.tasks().then((r) => r.data),
  })

  // The viewer's last filter and folded groups. Read on first render: the
  // server only renders the loading state, which uses neither.
  const [filter, setFilter] = useState<TaskFilter>(() => {
    const saved = readUi().filter
    return saved && FILTERS.some((f) => f.key === saved) ? saved : 'open'
  })
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    const saved = readUi().collapsed
    return Array.isArray(saved) ? saved : []
  })
  const remember = (next: { filter?: TaskFilter; collapsed?: string[] }) => writeUi({ filter: next.filter ?? filter, collapsed: next.collapsed ?? collapsed })
  const pickFilter = (f: TaskFilter) => {
    setFilter(f)
    remember({ filter: f })
  }
  const toggleGroup = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]
    setCollapsed(next)
    remember({ collapsed: next })
  }

  const payload = (data as any)?.data as AccountingTasksResponse | undefined
  const tasks: AccountingTask[] = payload?.tasks ?? []
  const countFor = (f: TaskFilter) => tasks.filter((t) => matchesFilter(t, f)).length
  const groupsShown = GROUPS.filter((g) => tasks.some((t) => t.group === g.key && matchesFilter(t, filter)))
  const allCollapsed = groupsShown.length > 0 && groupsShown.every((g) => collapsed.includes(g.key))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 24px' }}>
      <style>{`
        /* No card: the greeting sits straight on the page background, like /dashboard. */
        .acc-hero {
          position: relative; container-type: inline-size;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 8px 8px 8px 2px;
        }
        .acc-hero-art { position: relative; flex-shrink: 0; width: 180px; height: auto; margin: -8px 0; cursor: pointer; }
        @container (max-width: 560px) { .acc-hero-art { width: 160px; } }
        @container (max-width: 420px) { .acc-hero-art { display: none; } }
        .acc-bar, .acc-twinkle, .acc-pop { transform-box: fill-box; }
        .acc-progress { transition: width 600ms cubic-bezier(0.22, 1, 0.36, 1); }

        .acc-kpi { padding: 16px; display: flex; flex-direction: column; gap: 6px; min-width: 0; text-decoration: none; transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        .acc-kpi:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .acc-kpi-icon { width: 26px; height: 26px; border-radius: var(--radius-md); background: var(--accent-light-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; transition: transform 200ms ease; }
        .acc-kpi:hover .acc-kpi-icon { transform: rotate(-8deg) scale(1.08); }
        .acc-kpi-arrow { margin-left: auto; color: var(--foreground-subtle); opacity: 0; transform: translate(-3px, 3px); transition: opacity 150ms ease, transform 150ms ease; }
        .acc-kpi:hover .acc-kpi-arrow { opacity: 1; transform: none; }

        /* Quick menu: a slim right rail beside the cards and tasks; full width once it wraps. */
        .acc-side { flex: 1 1 280px; min-width: 0; max-width: 100%; position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
        @media (min-width: 1100px) { .acc-side { flex: 0 0 340px; } }
        .acc-kpis { display: grid; grid-template-columns: minmax(300px, 1.2fr) minmax(0, 2fr); gap: 12px; align-items: stretch; margin-bottom: 4px; }
        .acc-kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .acc-kpi-grid > .acc-kpi { justify-content: space-between; padding: 14px; }
        .acc-kpi-value { font-size: 19px; font-weight: 600; color: var(--foreground); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .acc-kpi-grid .acc-kpi-value { font-size: 17px; }
        /* Sized by the left column (the quick-menu rail takes 340px), not the screen. */
        .acc-main { container-type: inline-size; }
        @container (max-width: 1000px) { .acc-kpis { grid-template-columns: minmax(0, 1fr); } }
        @container (max-width: 560px) { .acc-kpi-grid { grid-template-columns: minmax(0, 1fr); } }

        .acc-period {
          position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 14px;
          min-height: 168px; padding: 16px 18px; border-radius: var(--radius-xl); color: #fff; text-decoration: none;
          background: linear-gradient(135deg, var(--cocoa-700) 0%, var(--cocoa-900) 100%);
          box-shadow: 0 10px 24px rgba(42, 26, 19, 0.18);
          transition: transform 150ms ease, box-shadow 200ms ease;
        }
        .acc-period:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(42, 26, 19, 0.26); }
        .acc-period[data-state="none"], .acc-period[data-state="closed"] { background: linear-gradient(135deg, #5A2A24 0%, #2A1513 100%); }
        .acc-period-orb { position: absolute; width: 200px; height: 200px; right: -60px; top: -90px; border-radius: 999px; pointer-events: none; background: radial-gradient(circle, rgba(198, 139, 78, 0.4), rgba(198, 139, 78, 0) 70%); }
        .acc-period-icon {
          position: relative; width: 30px; height: 30px; flex-shrink: 0; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.12); color: var(--caramel);
        }
        .acc-period-dot { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 999px; border: 2px solid var(--cocoa-700); background: #4ADE80; }
        .acc-period-dot[data-state="closed"], .acc-period-dot[data-state="none"] { background: #F87171; }
        .acc-period-dot[data-state="open"]::after {
          content: ''; position: absolute; inset: -2px; border-radius: 999px; border: 2px solid #4ADE80;
          animation: branch-ping 2.4s ease-out infinite;
        }
        .acc-period-status { margin-left: auto; height: 22px; display: inline-flex; align-items: center; padding: 0 9px; border-radius: 999px; font-size: 11px; font-weight: 500; white-space: nowrap; color: #9BE3C1; background: rgba(155, 227, 193, 0.14); }
        .acc-period-status[data-state="closed"], .acc-period-status[data-state="none"] { color: #FFB4B4; background: rgba(255, 180, 180, 0.14); }
        .acc-period-name { font-family: var(--font-display); font-size: 26px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acc-period-ring {
          --size: 64px; flex-shrink: 0; width: var(--size); height: var(--size); border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          background: conic-gradient(var(--caramel) var(--pct), rgba(255,255,255,0.14) 0);
        }
        .acc-period-ring > span {
          width: calc(var(--size) - 10px); height: calc(var(--size) - 10px); border-radius: 50%; background: var(--cocoa-900);
          display: inline-flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1;
        }
        .acc-period-ring strong { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .acc-period-ring small { font-size: 9px; color: rgba(255,255,255,0.65); margin-top: 2px; }
        .acc-period-track { position: relative; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.14); }
        .acc-period-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #E2B07A, var(--caramel)); transition: width 700ms cubic-bezier(0.22, 1, 0.36, 1); }
        .acc-period-today {
          position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 999px; transform: translate(-50%, -50%);
          background: #fff; border: 3px solid var(--caramel); box-shadow: 0 0 0 4px rgba(198, 139, 78, 0.25);
        }
        @media (prefers-reduced-motion: reduce) { .acc-period-dot[data-state="open"]::after { animation: none; } }

        .acc-recent { align-items: center; }
        .acc-recent-initial { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; background: var(--background); border: 1px solid var(--border); color: var(--foreground-muted); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; transition: background 150ms ease, color 150ms ease, border-color 150ms ease; }
        .acc-recent:hover .acc-recent-initial { background: var(--accent); border-color: var(--accent); color: #fff; }
        .acc-recent-time { flex-shrink: 0; font-size: 11px; color: var(--foreground-subtle); white-space: nowrap; }
        .acc-recent-clear { border: none; background: transparent; padding: 2px 6px; border-radius: 6px; font: inherit; font-size: 11.5px; color: var(--foreground-subtle); cursor: pointer; }
        .acc-recent-clear:hover { background: var(--background); color: var(--foreground); }

        .acc-filter { display: flex; gap: 6px; flex-wrap: wrap; }
        .acc-chip {
          display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 999px;
          border: 1px solid var(--border); background: var(--surface); color: var(--foreground-muted);
          font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 150ms ease;
        }
        .acc-chip:hover { border-color: var(--border-strong); color: var(--foreground); }
        .acc-chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
        .acc-chip-count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; background: var(--background); color: var(--foreground-muted); }
        .acc-chip[aria-pressed="true"] .acc-chip-count { background: rgba(255,255,255,0.18); color: #fff; }

        .acc-group-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; border: none; background: transparent; cursor: pointer; font: inherit; color: inherit; transition: background 150ms ease; }
        .acc-group-head:hover { background: var(--background); }
        .acc-chevron { flex-shrink: 0; color: var(--foreground-muted); transition: transform 200ms ease; }
        .acc-chevron[data-collapsed] { transform: rotate(-90deg); }
        .acc-ring {
          --size: 38px; flex-shrink: 0; width: var(--size); height: var(--size); border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          background: conic-gradient(var(--success) var(--pct), var(--border) 0);
          transition: background 400ms ease;
        }
        .acc-ring > span { width: calc(var(--size) - 8px); height: calc(var(--size) - 8px); border-radius: 50%; background: var(--surface); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: var(--foreground-muted); font-variant-numeric: tabular-nums; }
        .acc-collapse { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 250ms ease; }
        .acc-collapse[data-collapsed] { grid-template-rows: 0fr; }

        .acc-task {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--border);
          flex-wrap: wrap; text-decoration: none; color: inherit; transition: background 120ms ease;
        }
        .acc-task:hover { background: var(--background); }
        .acc-fact { font-size: 12px; font-weight: 500; color: var(--foreground); background: var(--background); border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .acc-task:hover .acc-fact { background: var(--surface); }
        .acc-open { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 12px; font-weight: 500; color: var(--foreground); background: var(--surface); transition: all 150ms ease; }
        .acc-task:hover .acc-open { background: var(--accent); border-color: var(--accent); color: #fff; }
        .acc-done { display: flex; align-items: center; gap: 10px; padding: 7px 16px; font-size: 12.5px; color: var(--foreground-muted); text-decoration: none; }
        .acc-done:hover { color: var(--foreground); }
        .acc-done-arrow { opacity: 0; transition: opacity 150ms ease; }
        .acc-done:hover .acc-done-arrow { opacity: 1; }

        .acc-quick { display: flex; align-items: center; gap: 10px; padding: 7px 6px; border-radius: var(--radius-md); text-decoration: none; font-size: 13px; color: var(--foreground); transition: background 150ms ease; }
        .acc-quick:hover, .acc-quick[data-first] { background: var(--background); }
        .acc-quick-icon { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; background: var(--accent-light-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; transition: background 150ms ease, color 150ms ease; }
        .acc-quick:hover .acc-quick-icon { background: var(--accent); color: #fff; }
        .acc-quick-arrow { flex-shrink: 0; color: var(--foreground-subtle); transition: transform 150ms ease; }
        .acc-quick:hover .acc-quick-arrow { transform: translateX(2px); }

        @media (prefers-reduced-motion: no-preference) {
          .acc-float { animation: acc-float 4.5s ease-in-out infinite; }
          .acc-coins { animation: acc-float 4.5s ease-in-out 0.6s infinite; }
          .acc-bar { transform-origin: bottom; animation: acc-grow 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .acc-pop { transform-origin: center; animation: acc-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 500ms both; }
          .acc-twinkle { transform-origin: center; animation: acc-twinkle 2.4s ease-in-out infinite; }
          /* Hover the illustration: the coins hop and the chart regrows. */
          .acc-hero-art:hover .acc-coins { animation: acc-hop 650ms cubic-bezier(0.22, 1, 0.36, 1); }
          .acc-hero-art:hover .acc-bar { animation: acc-regrow 650ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .acc-hero-art:hover .acc-twinkle { animation-duration: 0.7s; }
          .acc-pulse { animation: acc-pulse 1.8s ease-out infinite; }
        }
        @keyframes acc-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes acc-hop { 0% { transform: translateY(0); } 40% { transform: translateY(-14px); } 100% { transform: translateY(0); } }
        @keyframes acc-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes acc-regrow { 0% { transform: scaleY(1); } 30% { transform: scaleY(0.3); } 100% { transform: scaleY(1); } }
        @keyframes acc-pop { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes acc-twinkle { 0%, 100% { opacity: 0.35; transform: scale(0.75) rotate(0deg); } 50% { opacity: 1; transform: scale(1.1) rotate(20deg); } }
        @keyframes acc-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--destructive) 45%, transparent); } 100% { box-shadow: 0 0 0 8px transparent; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
            Accounting Dashboard
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>Tugas akuntansi yang perlu dikerjakan</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {payload && <span style={mutedText}>Diperbarui {formatDateTime(payload.generated_at ?? new Date(dataUpdatedAt).toISOString())}</span>}
          <button type="button" className="v2-btn v2-btn-ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError || !payload ? (
        <div className="v2-card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <AlertTriangle size={28} style={{ color: 'var(--destructive)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Gagal memuat tugas akuntansi</div>
          <div style={mutedText}>Periksa koneksi atau hak akses Anda, lalu coba lagi.</div>
          <button type="button" className="v2-btn v2-btn-primary" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} /> Coba lagi
          </button>
        </div>
      ) : (
        <>
          <Hero tasks={tasks} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="acc-main" style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="acc-kpis">
                <PeriodCard period={payload.kpis.current_period} />
                <div className="acc-kpi-grid">
                <KpiCard
                  icon={<Landmark size={14} />}
                  label="Saldo Kas & Bank"
                  href="/accounting/bank-accounts"
                  value={<CountUp value={Number(payload.kpis.cash_bank_balance) || 0} format={money} />}
                  hint="Rekening bank aktif"
                />
                <KpiCard
                  icon={<ArrowDownLeft size={14} />}
                  label="Piutang Terbuka"
                  href="/accounting/reports/ar-aging"
                  value={<CountUp value={Number(payload.kpis.receivables_open) || 0} format={money} />}
                  hint="Total AR Aging"
                />
                <KpiCard
                  icon={<ArrowUpRight size={14} />}
                  label="Hutang Terbuka"
                  href="/accounting/reports/ap-aging"
                  value={<CountUp value={Number(payload.kpis.payables_open) || 0} format={money} />}
                  hint="Total AP Aging"
                />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div className="acc-filter" role="group" aria-label="Saring tugas">
                  {FILTERS.map((f) => {
                    const n = countFor(f.key)
                    if (n === 0 && f.key !== filter && f.key !== 'open' && f.key !== 'all') return null
                    return (
                      <button key={f.key} type="button" className="acc-chip" aria-pressed={filter === f.key} onClick={() => pickFilter(f.key)}>
                        {f.key !== 'open' && f.key !== 'all' && <SeverityDot severity={f.key} />}
                        {f.label}
                        <span className="acc-chip-count">{n}</span>
                      </button>
                    )
                  })}
                </div>
                {groupsShown.length > 0 && (
                  <button
                    type="button"
                    className="v2-btn v2-btn-ghost v2-btn-sm"
                    onClick={() => {
                      const next = allCollapsed ? collapsed.filter((k) => !groupsShown.some((g) => g.key === k)) : Array.from(new Set([...collapsed, ...groupsShown.map((g) => g.key)]))
                      setCollapsed(next)
                      remember({ collapsed: next })
                    }}
                  >
                    {allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                    {allCollapsed ? 'Buka semua' : 'Ciutkan semua'}
                  </button>
                )}
              </div>

              {groupsShown.length === 0 ? (
                <div className="v2-card" style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                  <PartyPopper size={26} style={{ color: 'var(--success)' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Tidak ada tugas di sini</div>
                  <button type="button" className="v2-btn v2-btn-ghost v2-btn-sm" onClick={() => pickFilter('all')}>
                    Lihat semua tugas
                  </button>
                </div>
              ) : (
                groupsShown.map((g) => (
                  <GroupSection
                    key={g.key}
                    title={g.title}
                    subtitle={g.subtitle}
                    tasks={tasks.filter((t) => t.group === g.key)}
                    filter={filter}
                    collapsed={collapsed.includes(g.key)}
                    onToggle={() => toggleGroup(g.key)}
                  />
                ))
              )}
            </div>
            <aside className="acc-side">
              <RecentlyViewed />
              <QuickMenu />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
