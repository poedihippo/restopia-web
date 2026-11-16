'use client'

// Building blocks shared by the Production and Warehouse dashboards: every
// card reads an existing list endpoint (counts come from meta.total), so the
// dashboards need no backend of their own.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertTriangle, ArrowUpRight, ChevronRight, FileSpreadsheet, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { CountUp } from '@/views/Dashboard/motion'

// Local dates (en-CA = YYYY-MM-DD), same as /dashboard.
export const getToday = () => new Date().toLocaleDateString('en-CA')
export const getMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}
export const getYesterday = () => daysAgo(1)

const PRESETS: { key: string; label: string; from: () => string; to: () => string }[] = [
  { key: 'today', label: 'Hari ini', from: getToday, to: getToday },
  { key: '7d', label: '7 hari', from: () => daysAgo(6), to: getToday },
  { key: 'month', label: 'Bulan ini', from: getMonthStart, to: getToday },
  { key: '30d', label: '30 hari', from: () => daysAgo(29), to: getToday },
]

export type Period = { from: string; to: string }

/** Selected period (defaults to this month, like /dashboard). */
export function usePeriod() {
  const [from, setFrom] = useState(getMonthStart)
  const [to, setTo] = useState(getToday)
  return { period: { from, to } as Period, setFrom, setTo }
}

export const periodLabel = (p: Period) => {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(p.from)} – ${fmt(p.to)}`
}

/** Preset chips + date range + Export Excel, the same controls as /dashboard. */
export function PeriodFilter({ period, setFrom, setTo, onExport, exporting }: {
  period: Period
  setFrom: (v: string) => void
  setTo: (v: string) => void
  onExport?: () => void
  exporting?: boolean
}) {
  const active = PRESETS.find((p) => p.from() === period.from && p.to() === period.to)?.key
  return (
    <div className="ops-filters">
      <div className="v2-seg ops-presets" role="tablist" aria-label="Periode">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={active === p.key}
            onClick={() => {
              setFrom(p.from())
              setTo(p.to())
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" className="v2-input" value={period.from} max={period.to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="Dari" />
      <span className="ops-dash" style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>–</span>
      <input type="date" className="v2-input" value={period.to} min={period.from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="Sampai" />
      {onExport && (
        <button type="button" className="v2-btn v2-btn-ghost ops-export" onClick={onExport} disabled={exporting} title="Unduh dashboard ini sebagai file Excel">
          <FileSpreadsheet size={14} style={{ animation: exporting ? 'spin 1s linear infinite' : undefined }} />
          {exporting ? 'Menyiapkan…' : 'Export Excel'}
        </button>
      )}
    </div>
  )
}

/** `{ items, total }` from a list envelope (`r.data` → `{ data: [], meta }`). */
export function listOf<T = any>(data: unknown): { items: T[]; total: number } {
  const items: T[] = (data as any)?.data ?? []
  const total = Number((data as any)?.meta?.total ?? items.length) || 0
  return { items, total }
}

export const formatQty = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? '—' : (Math.round(Number(n) * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })

export const PO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  final: { label: 'Final', color: 'var(--accent)', bg: 'var(--accent-light-bg)' },
  accepted: { label: 'Accepted', color: 'var(--success)', bg: 'var(--success-bg)' },
  partially_delivered: { label: 'Partial', color: 'var(--info)', bg: 'var(--info-bg)' },
  delivered: { label: 'Delivered', color: 'var(--success)', bg: 'var(--success-bg)' },
  fulfilled: { label: 'Fulfilled', color: 'var(--info)', bg: 'var(--info-bg)' },
  rejected: { label: 'Rejected', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
  issued: { label: 'Issued', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  overdue: { label: 'Overdue', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

export function StatusPill({ status }: { status: string }) {
  const meta = PO_STATUS[status] ?? { label: status, color: 'var(--foreground-muted)', bg: 'var(--background)' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  )
}

const mutedText: CSSProperties = { fontSize: 12, color: 'var(--foreground-muted)' }

export function DashHeader({ title, subtitle, onRefresh, refreshing, children }: { title: string; subtitle: string; onRefresh: () => void; refreshing: boolean; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>{title}</h1>
        <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {children}
        <button type="button" className="v2-btn v2-btn-ghost" onClick={onRefresh} disabled={refreshing} title="Muat ulang data">
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          Refresh
        </button>
      </div>
    </div>
  )
}

/**
 * Greeting + headline. `expectedType` is the branch type this dashboard is
 * built for; while there is no auto-redirect yet, a viewer on another branch
 * type sees a note instead of being sent away.
 */
export function Hero({ expectedType, headline, body }: { expectedType: 'production' | 'warehouse'; headline: string; body: string }) {
  const { user } = useAuth()
  const branch = (user as any)?.branch as { name?: string; type?: string } | undefined
  const firstName = user?.name?.split(' ')[0] ?? ''
  const mismatch = !!branch?.type && branch.type !== expectedType

  return (
    <section className="ops-hero">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {firstName ? `Halo, ${firstName}` : 'Ringkasan'}
        {branch?.name ? ` · ${branch.name}` : ''}
      </span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{headline}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0, maxWidth: 640, lineHeight: 1.5 }}>{body}</p>
      {mismatch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--info-bg)', color: 'var(--info)', fontSize: 12.5, maxWidth: 640 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>
            Cabang aktif bertipe <strong>{branch?.type}</strong>; dashboard ini dirancang untuk cabang <strong>{expectedType}</strong>. Angka tetap dihitung untuk cabang aktif.
          </span>
        </div>
      )}
      </div>
      {expectedType === 'production' ? <ProductionArt /> : <WarehouseArt />}
    </section>
  )
}

// Inline illustrations in the /dashboard welcome-art style (themed with the tokens).
// Hover: the oven door glows and the cake hops / the cart rolls and the top box hops.
function ProductionArt() {
  return (
    <svg viewBox="0 0 220 150" width="220" height="150" aria-hidden="true" className="ops-hero-art">
      <ellipse cx="110" cy="140" rx="90" ry="7" fill="var(--accent-light)" opacity="0.25" />
      <g className="ops-float">
        {/* oven */}
        <rect x="34" y="48" width="96" height="86" rx="10" fill="var(--cocoa-700, #4A2C1F)" />
        <rect x="34" y="48" width="96" height="16" rx="8" fill="var(--cocoa-900, #2C1810)" />
        <circle cx="50" cy="56" r="3.5" fill="var(--accent-light)" />
        <circle cx="62" cy="56" r="3.5" fill="var(--accent-light)" opacity="0.7" />
        <rect x="100" y="54" width="22" height="4" rx="2" fill="#4ADE80" opacity="0.8" />
        <rect x="44" y="72" width="76" height="52" rx="6" fill="var(--cocoa-900, #2C1810)" />
        <rect className="ops-oven-glow" x="48" y="76" width="68" height="44" rx="4" fill="#F5B041" opacity="0.35" />
        <rect x="56" y="80" width="52" height="4" rx="2" fill="#F3E3D3" opacity="0.8" />
        <rect className="ops-cake" x="62" y="98" width="40" height="16" rx="3" fill="var(--accent-light)" />
        <path className="ops-cake" d="M62 98h40v4c-4 0-4 5-8 5s-4-5-8-5-4 6-8 6-4-6-8-6-4 5-8 5-4-5-4-5z" fill="var(--cocoa-700, #4A2C1F)" />
        <rect x="44" y="114" width="76" height="3" fill="var(--cocoa-700, #4A2C1F)" opacity="0.6" />
        {/* steam */}
        <path className="ops-steam" d="M74 40c-5-5 5-9 0-15" stroke="var(--accent-light)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path className="ops-steam" style={{ animationDelay: '0.5s' }} d="M90 42c-5-5 5-9 0-15" stroke="var(--accent-light)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      </g>
      {/* mixing bowl + whisk */}
      <g className="ops-bob">
        <path d="M140 108h56c0 16-12 26-28 26s-28-10-28-26z" fill="#F3E3D3" />
        <path d="M140 108h56" stroke="var(--cocoa-700, #4A2C1F)" strokeWidth="3" strokeLinecap="round" />
        <path d="M146 108c4-6 10-8 22-8s18 2 22 8z" fill="var(--cocoa-700, #4A2C1F)" />
        <g className="ops-whisk">
          <path d="M178 104l14-34" stroke="var(--caramel, #C68B4E)" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="176" cy="104" rx="6" ry="9" fill="none" stroke="#B9A08A" strokeWidth="2" transform="rotate(22 176 104)" />
        </g>
      </g>
      <g fill="var(--accent-light)">
        <path className="ops-twinkle" d="M16 70l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path className="ops-twinkle" style={{ animationDelay: '0.7s' }} d="M196 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path className="ops-twinkle" style={{ animationDelay: '1.4s' }} d="M150 60l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" opacity="0.7" />
      </g>
    </svg>
  )
}

function WarehouseArt() {
  const box = (x: number, y: number, w: number, h: number, fill: string, cls?: string) => (
    <g className={cls}>
      <rect x={x} y={y} width={w} height={h} rx="2.5" fill={fill} />
      <rect x={x + w / 2 - 3} y={y} width="6" height={h} fill="#F3E3D3" opacity="0.55" />
    </g>
  )
  return (
    <svg viewBox="0 0 220 150" width="220" height="150" aria-hidden="true" className="ops-hero-art">
      <ellipse cx="110" cy="140" rx="92" ry="7" fill="var(--accent-light)" opacity="0.25" />
      <g className="ops-float">
        {/* shelving */}
        <rect x="26" y="26" width="6" height="110" rx="2" fill="var(--cocoa-900, #2C1810)" />
        <rect x="128" y="26" width="6" height="110" rx="2" fill="var(--cocoa-900, #2C1810)" />
        {[60, 98, 134].map((y) => (
          <rect key={y} x="26" y={y} width="108" height="5" rx="2" fill="var(--cocoa-700, #4A2C1F)" />
        ))}
        {box(38, 40, 26, 20, 'var(--caramel, #C68B4E)')}
        {box(68, 46, 20, 14, '#D9A066')}
        {box(92, 34, 30, 26, 'var(--accent-light)', 'ops-box-hop')}
        {box(38, 80, 34, 18, '#D9A066')}
        {box(76, 74, 22, 24, 'var(--caramel, #C68B4E)')}
        {box(102, 84, 20, 14, 'var(--accent-light)')}
        {box(40, 116, 24, 18, 'var(--accent-light)')}
        {box(68, 112, 30, 22, 'var(--caramel, #C68B4E)')}
        {/* clipboard check */}
        <g className="ops-pop">
          <circle cx="132" cy="24" r="12" fill="var(--success, #2E7D5B)" />
          <path d="M126 24l4 4 8-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      {/* hand cart with boxes */}
      <g className="ops-cart">
        <path d="M150 74v56h46" stroke="var(--cocoa-700, #4A2C1F)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {box(156, 104, 32, 24, '#D9A066')}
        {box(160, 84, 24, 20, 'var(--caramel, #C68B4E)')}
        <circle cx="158" cy="134" r="6" fill="var(--cocoa-900, #2C1810)" />
        <circle cx="158" cy="134" r="2" fill="#F3E3D3" />
        <circle cx="190" cy="134" r="6" fill="var(--cocoa-900, #2C1810)" />
        <circle cx="190" cy="134" r="2" fill="#F3E3D3" />
      </g>
      <g fill="var(--accent-light)">
        <path className="ops-twinkle" d="M12 52l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path className="ops-twinkle" style={{ animationDelay: '0.7s' }} d="M204 56l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path className="ops-twinkle" style={{ animationDelay: '1.4s' }} d="M160 40l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" opacity="0.7" />
      </g>
    </svg>
  )
}

export type Tone = 'neutral' | 'warning' | 'danger' | 'info'
const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--foreground)',
  warning: 'var(--warning)',
  danger: 'var(--destructive)',
  info: 'var(--info)',
}
/** Icon-tile tint, the same pastel set as the /dashboard stat cards. */
export type Pastel = 'lavender' | 'mint' | 'blue' | 'coral' | 'gold'
const TONE_PASTEL: Record<Tone, Pastel> = { neutral: 'lavender', warning: 'gold', info: 'blue', danger: 'coral' }

export function KpiTile({ icon: Icon, label, value, hint, href, tone = 'neutral', pastel, loading }: {
  icon: LucideIcon
  label: string
  value: number
  hint?: ReactNode
  href: string
  tone?: Tone
  pastel?: Pastel
  loading?: boolean
}) {
  const p = pastel ?? TONE_PASTEL[tone]
  const style = { '--tile-bg': `var(--pastel-${p})`, '--tile-ink': `var(--pastel-${p}-ink)` } as CSSProperties
  // A zero is good news: only a non-zero alert count takes the alert colour.
  const valueColor = value > 0 ? TONE_COLOR[tone] : 'var(--foreground)'
  return (
    <Link href={href} className="ops-kpi" style={style}>
      <span className="ops-kpi-icon">
        <Icon size={17} />
      </span>
      <ArrowUpRight size={14} className="ops-kpi-arrow" />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, width: '100%' }}>
        <span className="ops-kpi-label">{label}</span>
        <span className="ops-kpi-value" style={{ color: valueColor }}>
          {loading ? <span className="v2-skeleton" style={{ display: 'inline-block', height: 24, width: 56, borderRadius: 6, verticalAlign: 'middle' }} /> : <CountUp value={value} format={(n) => Math.round(n).toLocaleString('id-ID')} />}
        </span>
        {hint && <span className="ops-kpi-hint">{hint}</span>}
      </span>
    </Link>
  )
}

// `quiet`: an informational count (e.g. the period's records), never highlighted as work.
export type PanelTab = { key: string; label: string; count?: number; quiet?: boolean }
export type PanelColumn = { key: string; label: string; align?: 'left' | 'right' | 'center'; width?: number | string }
export type PanelRow = { key: string | number; href: string; cells: Record<string, ReactNode> }

/**
 * A titled data table with status tabs: the dashboard shows the records
 * themselves (number, branch, date, qty, status), not just a link to them.
 */
export function DataPanel({ icon: Icon, title, href, linkLabel = 'Buka menu', tabs, active, onTab, columns, rows, loading, error, empty }: {
  icon: LucideIcon
  title: string
  href: string
  linkLabel?: string
  tabs?: PanelTab[]
  active?: string
  onTab?: (key: string) => void
  columns: PanelColumn[]
  rows: PanelRow[]
  loading?: boolean
  error?: boolean
  empty: string
}) {
  const router = useRouter()
  return (
    <section className="v2-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
        <Icon size={16} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0, flex: '1 1 auto' }}>{title}</h2>
        {tabs && tabs.length > 1 && (
          <div className="v2-seg" role="tablist" aria-label={title}>
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => onTab?.(t.key)} data-fast-click>
                {t.label}
                {t.count != null && <span className="ops-tab-count" data-hot={(!t.quiet && t.count > 0 && active !== t.key) || undefined}>{t.count.toLocaleString('id-ID')}</span>}
              </button>
            ))}
          </div>
        )}
        <Link href={href} className="ops-all">
          {linkLabel} <ChevronRight size={13} />
        </Link>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="v2-table ops-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key}><div className="v2-skeleton" style={{ height: 12, width: '70%', marginLeft: c.align === 'right' ? 'auto' : undefined }} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} style={{ color: 'var(--destructive)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={14} /> Gagal memuat data.</span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ color: 'var(--foreground-muted)', textAlign: 'center', height: 64 }}>{empty}</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} data-row onClick={() => router.push(r.href)} style={{ cursor: 'pointer' }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? 'left', fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined }}>
                      {r.cells[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * Which tab to open: the viewer's pick, else the first "needs action" tab
 * that has records, else the fallback (usually "Terbaru").
 */
export function pickTab(chosen: string | null, actionTabs: PanelTab[], fallback: string) {
  if (chosen) return chosen
  return actionTabs.find((t) => (t.count ?? 0) > 0)?.key ?? fallback
}

/** Product names on a document, e.g. "Tepung, Gula +2". */
export function itemSummary(names: (string | undefined)[], max = 2) {
  const clean = names.filter(Boolean) as string[]
  if (clean.length === 0) return '—'
  const head = clean.slice(0, max).join(', ')
  return clean.length > max ? `${head} +${clean.length - max}` : head
}

export type QuickLink = { label: string; href: string; icon: LucideIcon; permission: string | string[] }

/** Shortcuts to the menus this dashboard summarises (same hrefs/permissions as the sidebar). */
export function QuickMenu({ links }: { links: QuickLink[] }) {
  const { hasPermission } = useAuth()
  const can = (p: string | string[]) => (Array.isArray(p) ? p.some((k) => hasPermission(k)) : hasPermission(p))
  const visible = links.filter((l) => can(l.permission))
  if (visible.length === 0) return null
  return (
    <section className="v2-card" style={{ padding: '14px 12px 8px' }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0, padding: '0 4px 6px' }}>Menu cepat</h2>
      {visible.map(({ label, href, icon: Icon }) => (
        <Link key={href} href={href} className="ops-quick">
          <span className="ops-quick-icon">
            <Icon size={14} />
          </span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <ChevronRight size={14} className="ops-quick-arrow" />
        </Link>
      ))}
    </section>
  )
}

export const OPS_STYLES = `
  .ops-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  @media (max-width: 640px) {
    .ops-filters { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
    .ops-presets { grid-column: 1 / -1; overflow-x: auto; scrollbar-width: none; }
    .ops-presets > button { flex: 1; white-space: nowrap; }
    .ops-filters input[type="date"] { width: 100%; min-width: 0; }
    .ops-dash { display: none; }
    .ops-export { grid-column: 1 / -1; justify-content: center; }
  }
  /* Hero: text left, illustration right (hidden on narrow screens), like /dashboard. */
  .ops-hero { container-type: inline-size; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 4px 8px 4px 2px; }
  .ops-hero-art { flex-shrink: 0; width: 170px; height: auto; margin: -10px 0; cursor: pointer; overflow: visible; }
  @container (max-width: 560px) { .ops-hero-art { width: 140px; } }
  @container (max-width: 420px) { .ops-hero-art { display: none; } }
  .ops-cake, .ops-whisk, .ops-box-hop, .ops-cart, .ops-pop, .ops-twinkle, .ops-steam { transform-box: fill-box; }
  .ops-oven-glow { transition: opacity 300ms ease; }
  .ops-hero-art:hover .ops-oven-glow { opacity: 0.8; }
  @media (prefers-reduced-motion: no-preference) {
    .ops-float { animation: ops-float 4.5s ease-in-out infinite; }
    .ops-bob { animation: ops-float 4.5s ease-in-out 0.6s infinite; }
    .ops-twinkle { transform-origin: center; animation: ops-twinkle 2.4s ease-in-out infinite; }
    .ops-steam { transform-origin: bottom; animation: ops-steam 2.2s ease-in-out infinite; }
    .ops-whisk { transform-origin: 10% 100%; animation: ops-whisk 1.6s ease-in-out infinite; }
    .ops-pop { transform-origin: center; animation: ops-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 400ms both; }
    .ops-hero-art:hover .ops-cake { animation: ops-hop 650ms cubic-bezier(0.22, 1, 0.36, 1); }
    .ops-hero-art:hover .ops-box-hop { animation: ops-hop 650ms cubic-bezier(0.22, 1, 0.36, 1); }
    .ops-hero-art:hover .ops-cart { animation: ops-roll 900ms cubic-bezier(0.22, 1, 0.36, 1); }
    .ops-hero-art:hover .ops-whisk { animation-duration: 0.4s; }
    .ops-hero-art:hover .ops-twinkle { animation-duration: 0.7s; }
  }
  @keyframes ops-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes ops-hop { 0% { transform: translateY(0); } 40% { transform: translateY(-12px); } 100% { transform: translateY(0); } }
  @keyframes ops-roll { 0% { transform: translateX(0); } 45% { transform: translateX(-14px); } 100% { transform: translateX(0); } }
  @keyframes ops-steam { 0% { opacity: 0; transform: translateY(4px) scaleY(0.8); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px) scaleY(1.1); } }
  @keyframes ops-whisk { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
  @keyframes ops-pop { from { transform: scale(0); } to { transform: scale(1); } }
  @keyframes ops-twinkle { 0%, 100% { opacity: 0.35; transform: scale(0.75) rotate(0deg); } 50% { opacity: 1; transform: scale(1.1) rotate(20deg); } }
  .ops-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  /* Stat cards: same look as the /dashboard .dash-stat tiles (silver sheen, pastel icon tile, ↗). */
  .ops-kpi {
    position: relative; overflow: hidden; isolation: isolate; min-width: 0;
    display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
    padding: 16px 18px; border: 1px solid #e8eaee; border-radius: var(--radius-lg);
    text-decoration: none; color: inherit;
    background: linear-gradient(160deg, #ffffff 0%, #ffffff 55%, #f7f8fa 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(20, 22, 40, 0.05), 0 4px 12px -8px rgba(20, 22, 40, 0.18);
    transition: border-color 150ms ease, box-shadow 200ms ease, translate 220ms ease;
  }
  .ops-kpi::after {
    content: ''; position: absolute; z-index: -1; inset: 0; pointer-events: none;
    background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.6) 45%, transparent 55%);
  }
  .ops-kpi:hover {
    translate: 0 -2px; border-color: #d6d9e0;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(20, 22, 40, 0.05), 0 8px 18px -10px rgba(20, 22, 40, 0.28);
  }
  .ops-kpi:focus-visible { outline: 2px solid var(--accent-light); outline-offset: 2px; }
  .ops-kpi-icon {
    width: 38px; height: 38px; flex-shrink: 0; border-radius: 11px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--tile-bg); color: var(--tile-ink);
    border: 1px solid color-mix(in srgb, var(--tile-ink) 20%, transparent);
  }
  .ops-kpi-arrow { position: absolute; top: 10px; right: 10px; color: var(--foreground-subtle); transition: color 150ms ease, transform 150ms ease; }
  .ops-kpi:hover .ops-kpi-arrow { color: var(--foreground-muted); transform: translate(1px, -1px); }
  .ops-kpi-label { font-size: 11.5px; font-weight: 500; color: var(--foreground-muted); }
  .ops-kpi-value { font-size: 24px; font-weight: 500; line-height: 1.25; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .ops-kpi-hint { font-size: 11px; color: var(--foreground-muted); line-height: 1.4; }
  @media (max-width: 700px) {
    .ops-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .ops-kpi { gap: 8px; padding: 12px; }
    .ops-kpi-icon { width: 30px; height: 30px; border-radius: 9px; }
    .ops-kpi-icon svg { width: 15px; height: 15px; }
    .ops-kpi-value { font-size: 18px; }
  }
  .ops-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr)); gap: 12px; align-items: start; }
  /* Tables on the left, Menu cepat as a slim right rail; full width once it wraps. */
  .ops-layout { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .ops-main { flex: 2 1 640px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
  .ops-side { flex: 1 1 260px; min-width: 0; position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
  @media (min-width: 1200px) { .ops-side { flex: 0 0 280px; } }
  .ops-quick { display: flex; align-items: center; gap: 10px; padding: 7px 6px; border-radius: var(--radius-md); text-decoration: none; font-size: 13px; color: var(--foreground); transition: background 150ms ease; }
  .ops-quick:hover { background: var(--background); }
  .ops-quick-icon { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; background: var(--accent-light-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; transition: background 150ms ease, color 150ms ease; }
  .ops-quick:hover .ops-quick-icon { background: var(--accent); color: #fff; }
  .ops-quick-arrow { flex-shrink: 0; color: var(--foreground-subtle); transition: transform 150ms ease; }
  .ops-quick:hover .ops-quick-arrow { transform: translateX(2px); }
  .ops-all { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 500; color: var(--foreground-muted); text-decoration: none; white-space: nowrap; }
  .ops-all:hover { color: var(--foreground); }
  .ops-table tbody td { height: 42px; padding: 9px 16px; }
  .ops-table .ops-code { font-weight: 600; color: var(--foreground); white-space: nowrap; }
  .ops-table .ops-sub { display: block; font-size: 11.5px; color: var(--foreground-muted); margin-top: 1px; }
  .ops-tab-count { margin-left: 6px; min-width: 16px; height: 16px; padding: 0 5px; border-radius: 999px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; background: var(--border); color: var(--foreground-muted); }
  .ops-tab-count[data-hot] { background: var(--warning-bg); color: var(--warning); }
`
