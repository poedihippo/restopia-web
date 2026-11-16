'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react'
import { dashboardService } from '@/services/dashboard.service'
import { formatCurrency } from '@/utils/price'
import type {
  ChartBreakdown,
  ChartTimeSeries,
  DashboardChartInterval,
  DashboardChartKey,
  DashboardChartsResponse,
} from '@/types/api'

/*
 * Chart cards for GET /v1/dashboard/charts. Plain SVG (no chart library):
 * one y-axis per chart, Revenue/Orders as a toggle rather than a dual axis,
 * hover tooltip on every mark, legend whenever a chart has 2+ series.
 */

// Validated categorical order (dataviz reference palette, light mode).
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const OTHER_COLOR = '#a3a7b3'
const SINGLE = '#c68b4e' // brand caramel for single-series charts
const GRID = '#eef0f4'

type Unit = 'money' | 'qty' | 'count'

const CHART_META: Record<DashboardChartKey, { title: string; unit: Unit }> = {
  sales_trend: { title: 'Tren Penjualan', unit: 'money' },
  sales_by_channel: { title: 'Penjualan per Channel', unit: 'money' },
  payment_methods: { title: 'Metode Pembayaran', unit: 'money' },
  top_products: { title: 'Produk Terlaris', unit: 'qty' },
  sales_by_hour: { title: 'Penjualan per Jam', unit: 'money' },
  production_trend: { title: 'Tren Produksi', unit: 'count' },
  top_produced_products: { title: 'Produk Paling Banyak Diproduksi', unit: 'qty' },
  purchase_trend: { title: 'Tren Pembelian', unit: 'money' },
  top_suppliers: { title: 'Supplier Teratas', unit: 'money' },
  stock_flow: { title: 'Arus Stok', unit: 'count' },
  stock_health: { title: 'Kesehatan Stok', unit: 'count' },
  branch_comparison: { title: 'Perbandingan Cabang', unit: 'money' },
}

// Series that are money even inside a mixed chart (orders are counts).
const MONEY_SERIES = new Set(['revenue', 'spending'])

const fmtNum = (n: number) => Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
const fmtCompact = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e9) return `${fmtNum(+(n / 1e9).toFixed(1))}M`
  if (a >= 1e6) return `${fmtNum(+(n / 1e6).toFixed(1))}jt`
  if (a >= 1e3) return `${fmtNum(+(n / 1e3).toFixed(1))}rb`
  return fmtNum(n)
}
const fmtValue = (n: number, money: boolean) => (money ? formatCurrency(n) : fmtNum(n))

// Series / status labels arrive from the API in English; show them in Indonesian
// (unknown labels pass through unchanged).
const API_LABELS: Record<string, string> = {
  revenue: 'Pendapatan',
  orders: 'Pesanan',
  'sales orders': 'Sales order',
  spending: 'Belanja',
  'purchase orders': 'Purchase order',
  productions: 'Produksi',
  production: 'Produksi',
  'items produced': 'Item diproduksi',
  quantity: 'Kuantitas',
  qty: 'Qty',
  in: 'Masuk',
  out: 'Keluar',
  'stock in': 'Stok masuk',
  'stock out': 'Stok keluar',
  healthy: 'Aman',
  'low stock': 'Stok menipis',
  expiring: 'Segera kedaluwarsa',
  expired: 'Kedaluwarsa',
  'out of stock': 'Habis',
  other: 'Lainnya',
  'walk-in': 'Pelanggan umum',
}
export const apiLabel = (label: string) => API_LABELS[label?.trim().toLowerCase()] ?? label

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Labels arrive as DD-MM-YYYY (never parse sales_by_hour labels this way).
const fmtLabel = (label: string, interval: DashboardChartInterval, hourly: boolean, long = false) => {
  if (hourly) return long ? `${label}:00 – ${label}:59` : label
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(label)
  if (!m) return label
  const [, d, mo, y] = m
  const mon = MONTHS[Number(mo) - 1]
  if (interval === 'month') return long ? `${mon} ${y}` : mon
  if (interval === 'week') return long ? `Minggu ${Number(d)} ${mon} ${y}` : `${Number(d)} ${mon}`
  return long ? `${Number(d)} ${mon} ${y}` : `${Number(d)} ${mon}`
}

const niceMax = (v: number) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="dc-tip" style={{ left: x, top: y }}>
      {children}
    </div>
  )
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null
  const up = pct >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className="dc-badge"
      style={{ color: up ? 'var(--success)' : 'var(--destructive)', background: up ? 'var(--success-bg)' : 'var(--destructive-bg)' }}
      title="Dibandingkan dengan periode sebelumnya"
    >
      <Icon size={12} />
      {Math.abs(pct).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
    </span>
  )
}

// ── Time series: area/line or bars, one y-axis ───────────────────────────────

function TimeSeriesChart({
  chart,
  interval,
  hourly,
  kind,
  seriesKeys,
}: {
  chart: ChartTimeSeries
  interval: DashboardChartInterval
  hourly: boolean
  kind: 'area' | 'bar'
  seriesKeys: string[]
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const series = chart.series.filter((s) => seriesKeys.includes(s.key))
  const n = chart.labels.length
  const H = 190
  const pad = { l: 44, r: 8, t: 10, b: 22 }
  const iw = Math.max(0, width - pad.l - pad.r)
  const ih = H - pad.t - pad.b
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.data)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const y = (v: number) => pad.t + ih - (v / max) * ih
  const band = n > 0 ? iw / n : 0
  const xCenter = (i: number) => pad.l + band * i + band / 2
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 46))))
  const colors = series.length > 1 ? CATEGORICAL : [SINGLE]

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect()
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n)
    setHover(Math.min(n - 1, Math.max(0, i)))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Grafik tren" className="dc-ts">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="dc-axis">
                {fmtCompact(t)}
              </text>
            </g>
          ))}
          {chart.labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={xCenter(i)} y={H - 6} textAnchor="middle" className="dc-axis">
                {fmtLabel(l, interval, hourly)}
              </text>
            ) : null,
          )}

          {kind === 'area'
            ? series.map((s, si) => {
                const pts = s.data.map((v, i) => `${xCenter(i)},${y(v)}`)
                const color = colors[si]
                return (
                  <g key={s.key}>
                    {series.length === 1 && n > 1 && (
                      <path
                        d={`M${xCenter(0)},${y(0)} L${pts.join(' L')} L${xCenter(n - 1)},${y(0)} Z`}
                        fill={color}
                        opacity={0.12}
                      />
                    )}
                    <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {n === 1 && <circle cx={xCenter(0)} cy={y(s.data[0])} r={4} fill={color} />}
                  </g>
                )
              })
            : chart.labels.map((_, i) => {
                const gap = 2
                const groupW = Math.max(2, Math.min(28, band * 0.7))
                const bw = Math.max(1, (groupW - gap * (series.length - 1)) / series.length)
                const x0 = xCenter(i) - groupW / 2
                return series.map((s, si) => {
                  const v = s.data[i] ?? 0
                  const top = y(v)
                  const h = Math.max(0, pad.t + ih - top)
                  const r = Math.min(4, bw / 2, h)
                  const x = x0 + si * (bw + gap)
                  return (
                    <path
                      key={`${i}-${s.key}`}
                      d={`M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z`}
                      fill={colors[si]}
                      opacity={hover == null || hover === i ? 1 : 0.45}
                    />
                  )
                })
              })}

          {hover != null && kind === 'area' && (
            <g>
              <line x1={xCenter(hover)} x2={xCenter(hover)} y1={pad.t} y2={pad.t + ih} stroke="#c9ccd5" strokeDasharray="3 3" />
              {series.map((s, si) => (
                <circle key={s.key} cx={xCenter(hover)} cy={y(s.data[hover] ?? 0)} r={4.5} fill={colors[si]} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={pad.l}
            y={pad.t}
            width={iw}
            height={ih}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover != null && (
        <Tooltip x={Math.min(Math.max(xCenter(hover), 70), width - 70)} y={pad.t}>
          <div className="dc-tip-title">{fmtLabel(chart.labels[hover], interval, hourly, true)}</div>
          {series.map((s, si) => (
            <div key={s.key} className="dc-tip-row">
              <span className="dc-swatch" style={{ background: colors[si] }} />
              <span>{apiLabel(s.label)}</span>
              <strong>{fmtValue(s.data[hover] ?? 0, MONEY_SERIES.has(s.key))}</strong>
            </div>
          ))}
        </Tooltip>
      )}
      {series.length > 1 && (
        <div className="dc-legend">
          {series.map((s, si) => (
            <span key={s.key}>
              <span className="dc-swatch" style={{ background: colors[si] }} />
              {apiLabel(s.label)} · {fmtNum(s.total)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Breakdown: helpers ───────────────────────────────────────────────────────

function foldItems(b: ChartBreakdown, max = 7) {
  if (b.items.length <= max + 1) return b.items
  const head = b.items.slice(0, max)
  const rest = b.items.slice(max)
  return [...head, { id: null, label: `Lainnya (${rest.length})`, value: rest.reduce((a, i) => a + i.value, 0), count: rest.reduce((a, i) => a + i.count, 0) }]
}

// ── Breakdown: horizontal bars ───────────────────────────────────────────────

// Round the axis max up to 1/2/2.5/5 × 10^n so ticks land on readable numbers.
function niceTicks(max: number, count = 5) {
  const raw = Math.max(max, 1) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step || step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

const SERIES_LABEL: Record<Unit, string> = { money: 'Nilai', qty: 'Qty terjual', count: 'Jumlah' }

// `share` = parts of a whole (channels, payment methods): keep every item by
// folding the tail into "Other", and show each bar's % of the total.
function HBars({ data, unit, countLabel, share }: { data: ChartBreakdown; unit: Unit; countLabel?: string; share?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const items = share ? foldItems(data) : data.items.slice(0, 7)
  const sum = items.reduce((a, i) => a + i.value, 0)
  const pct = (v: number) => (sum > 0 ? `${Math.round((v / sum) * 100)}%` : '–')
  const money = unit === 'money'
  const ticks = niceTicks(Math.max(0, ...items.map((i) => i.value)))
  const top = ticks[ticks.length - 1]
  const at = (v: number) => `${(v / top) * 100}%`
  const tick = (v: number) => (money ? fmtCompact(v) : fmtNum(v))
  return (
    <div className="dc-hbars">
      <div className="dc-hbars-plot">
        <div className="dc-hbars-grid" aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ left: at(t) }} />)}
        </div>
        {items.map((it, i) => {
          const w = (it.value / top) * 100
          return (
            <div
              key={it.id ?? i}
              className="dc-hbar"
              data-dim={hover != null && hover !== i ? '' : undefined}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              title={`${it.label}: ${fmtValue(it.value, money)}${share ? ` (${pct(it.value)})` : ''}${countLabel ? ` · ${fmtNum(it.count)} ${countLabel}` : ''}`}
            >
              <span className="dc-hbar-label">{it.label}</span>
              <div className="dc-hbar-track">
                <div className="dc-hbar-fill" style={{ '--i': i, width: `${w}%`, background: it.label.startsWith('Lainnya (') ? OTHER_COLOR : SINGLE } as React.CSSProperties} />
                {hover === i && (
                  <span className="dc-hbar-value" data-inside={w > 62 || undefined} style={w > 62 ? { right: `${100 - w}%` } : { left: `${w}%` }}>
                    {money ? fmtCompact(it.value) : fmtNum(it.value)}
                    {share && ` · ${pct(it.value)}`}
                    {countLabel && ` · ${fmtNum(it.count)} ${countLabel}`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="dc-hbar dc-hbars-axis" aria-hidden="true">
        <span />
        <div className="dc-hbar-track">
          {ticks.map((t) => (
            <span key={t} style={{ left: at(t) }}>{tick(t)}</span>
          ))}
        </div>
      </div>
      <div className="dc-hbars-legend">
        <span className="dc-swatch" style={{ background: SINGLE, borderRadius: 999 }} />
        {SERIES_LABEL[unit]}
      </div>
    </div>
  )
}

// ── Breakdown: stock health (status colours, always with icon + label) ──────

const HEALTH: Record<string, { color: string; icon: React.ElementType }> = {
  Healthy: { color: 'var(--success)', icon: CheckCircle2 },
  'Low stock': { color: 'var(--warning)', icon: AlertTriangle },
  Expiring: { color: '#db6440', icon: Clock },
  Expired: { color: 'var(--destructive)', icon: XCircle },
}

function StockHealth({ data }: { data: ChartBreakdown }) {
  const total = data.total || data.items.reduce((a, i) => a + i.value, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="dc-stack">
        {total > 0 &&
          data.items.map((it) =>
            it.value > 0 ? (
              <div
                key={it.label}
                title={`${apiLabel(it.label)}: ${fmtNum(it.value)}`}
                style={{ flex: it.value, background: HEALTH[it.label]?.color ?? OTHER_COLOR }}
              />
            ) : null,
          )}
      </div>
      <div className="dc-health-grid">
        {data.items.map((it) => {
          const meta = HEALTH[it.label] ?? { color: OTHER_COLOR, icon: CheckCircle2 }
          const Icon = meta.icon
          return (
            <div key={it.label} className="dc-health">
              <Icon size={14} style={{ color: meta.color, flexShrink: 0 }} />
              <span>{apiLabel(it.label)}</span>
              <strong>{fmtNum(it.value)}</strong>
              <span className="dc-legend-pct">{total > 0 ? `${Math.round((it.value / total) * 100)}%` : '–'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function ChartCard({
  title,
  headline,
  toggle,
  children,
}: {
  title: string
  headline?: React.ReactNode
  toggle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="v2-card dc-card">
      <header className="dc-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="dc-card-title">{title}</div>
          {headline}
        </div>
        {toggle}
      </header>
      <div className="dc-card-body">{children}</div>
    </section>
  )
}

function TrendCard({
  chartKey,
  chart,
  interval,
}: {
  chartKey: DashboardChartKey
  chart: ChartTimeSeries
  interval: DashboardChartInterval
}) {
  const meta = CHART_META[chartKey]
  const hourly = chartKey === 'sales_by_hour'
  // stock_flow shows in/out together (same unit); the rest toggle one series at a time.
  const together = chartKey === 'stock_flow'
  const [active, setActive] = useState(chart.series[0]?.key)
  const current = chart.series.find((s) => s.key === active) ?? chart.series[0]
  const kind = chartKey === 'stock_flow' || hourly ? 'bar' : 'area'
  const headline = together ? null : current ? (
    <div className="dc-headline">
      <span>{fmtValue(current.total, MONEY_SERIES.has(current.key))}</span>
      <ChangeBadge pct={current.change_pct} />
    </div>
  ) : null
  const toggle =
    !together && chart.series.length > 1 ? (
      <div className="v2-seg" role="tablist" aria-label={`Seri ${meta.title}`}>
        {chart.series.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={s.key === current?.key} onClick={() => setActive(s.key)}>
            {apiLabel(s.label)}
          </button>
        ))}
      </div>
    ) : null
  return (
    <ChartCard title={meta.title} headline={headline} toggle={toggle}>
      <TimeSeriesChart
        chart={chart}
        interval={interval}
        hourly={hourly}
        kind={kind}
        seriesKeys={together ? chart.series.map((s) => s.key) : current ? [current.key] : []}
      />
    </ChartCard>
  )
}

function BreakdownCard({ chartKey, data }: { chartKey: DashboardChartKey; data: ChartBreakdown }) {
  const meta = CHART_META[chartKey]
  const money = meta.unit === 'money'
  const headline =
    chartKey === 'stock_health' ? (
      <div className="dc-sub">{fmtNum(data.total)} item stok</div>
    ) : (
      <div className="dc-sub">
        {money ? `Total ${formatCurrency(data.total)}` : `Total ${fmtNum(data.total)} ${meta.unit === 'qty' ? 'pcs' : ''}`}
      </div>
    )
  let body: React.ReactNode
  if (data.items.length === 0) body = <div className="dc-empty">Tidak ada data di periode ini</div>
  else if (chartKey === 'stock_health') body = <StockHealth data={data} />
  else if (chartKey === 'sales_by_channel' || chartKey === 'payment_methods') body = <HBars data={data} unit={meta.unit} share />
  else body = <HBars data={data} unit={meta.unit} countLabel={meta.unit === 'qty' ? 'pesanan' : undefined} />
  return (
    <ChartCard title={meta.title} headline={headline}>
      {body}
    </ChartCard>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

type ChartsParams = {
  dateFrom: string
  dateTo: string
  interval: DashboardChartInterval
  branchId?: number
  activeBranchId?: number
}

export const chartsRangeError = (dateFrom: string, dateTo: string): string | null => {
  if (!dateFrom || !dateTo) return null
  const days = Math.round((Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000) + 1
  if (days < 1) return 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.'
  if (days > 366) return 'Periode maksimal 366 hari.'
  return null
}

// Shared by the KPI band and the chart grid — same key, so one request.
export function useDashboardCharts({ dateFrom, dateTo, interval, branchId, activeBranchId }: ChartsParams) {
  const rangeError = chartsRangeError(dateFrom, dateTo)
  const query = useQuery({
    // activeBranchId: the chart set follows the active branch type, so refetch on switch.
    queryKey: ['dashboard-charts', dateFrom, dateTo, interval, branchId ?? null, activeBranchId ?? null],
    queryFn: () =>
      dashboardService
        .charts({ date_from: dateFrom, date_to: dateTo, interval, branch_id: branchId })
        .then((r) => r.data),
    enabled: !rangeError,
    retry: false,
  })
  const charts = (query.data as any)?.data as DashboardChartsResponse | undefined
  return { ...query, charts, rangeError }
}

export default function DashboardCharts(props: ChartsParams) {
  const { interval } = props
  const { isLoading, isError, error, charts, rangeError } = useDashboardCharts(props)

  let content: React.ReactNode
  if (rangeError) {
    content = <div className="v2-card dc-state" style={{ color: 'var(--warning)' }}>{rangeError}</div>
  } else if (isLoading) {
    content = (
      <div className="dc-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="dc-cell" data-span={i === 0 ? 2 : 1}>
          <div className="v2-card dc-card" style={{ padding: 16, justifyContent: 'flex-start' }}>
            <div className="v2-skeleton" style={{ width: 120, height: 12 }} />
            <div className="v2-skeleton" style={{ width: '100%', height: 170, marginTop: 14 }} />
          </div>
          </div>
        ))}
      </div>
    )
  } else if (isError) {
    const status = (error as any)?.response?.status
    const msg = (error as any)?.response?.data?.message
    content = (
      <div className="v2-card dc-state">
        {status === 403
          ? msg || 'Anda tidak punya izin untuk melihat grafik ini.'
          : status === 404
            ? 'Cabang tidak ditemukan di perusahaan Anda.'
            : status === 422
              ? msg || 'Periode yang dipilih tidak valid.'
              : 'Gagal memuat grafik.'}
      </div>
    )
  } else if (!charts || charts.available_charts.length === 0) {
    content = <div className="v2-card dc-state">Tidak ada grafik untuk cabang ini.</div>
  } else {
    const interval_ = charts.period?.interval ?? interval
    // Even rows: each wide trend card is paired with one breakdown card (2 + 1
    // columns); leftover breakdowns fill rows of three, a leftover trend spans
    // the full row. Cards in a row stretch to the same height.
    const keys = charts.available_charts.filter((k) => charts[k])
    const trends = keys.filter((k) => 'series' in (charts[k] as object))
    const breakdowns = keys.filter((k) => !('series' in (charts[k] as object)))
    const ordered: { key: DashboardChartKey; span: 1 | 2 | 3 }[] = []
    trends.forEach((k, i) => {
      const partner = breakdowns[i]
      ordered.push({ key: k, span: partner ? 2 : 3 })
      if (partner) ordered.push({ key: partner, span: 1 })
    })
    breakdowns.slice(trends.length).forEach((k) => ordered.push({ key: k, span: 1 }))
    content = (
      <div className="dc-grid">
        {ordered.map(({ key, span }) => {
          const chart = charts[key]!
          return (
            <div key={key} className="dc-cell" data-span={span}>
              {'series' in chart ? (
                <TrendCard chartKey={key} chart={chart} interval={interval_} />
              ) : (
                <BreakdownCard chartKey={key} data={chart} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {content}
      <style>{`
        .dc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
        .dc-cell { min-width: 0; display: flex; }
        /* Draw-in once the cell is revealed (see useReveal in Dashboard/index). */
        .dash-anim .dc-ts { clip-path: inset(0 100% 0 0); }
        .dash-anim .is-in .dc-ts { clip-path: inset(0 0 0 0); transition: clip-path 1200ms cubic-bezier(0.65, 0, 0.35, 1) calc(var(--reveal-delay, 0ms) + 150ms); }
        .dash-anim .dc-hbar-fill { transform-origin: left center; animation: dc-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) both paused; animation-delay: calc(var(--reveal-delay, 0ms) + 200ms + var(--i, 0) * 70ms); }
        .dash-anim .is-in .dc-hbar-fill { animation-play-state: running; }
        @keyframes dc-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .dc-card { transition: box-shadow 200ms ease, border-color 200ms ease; }
        .dc-card:hover { box-shadow: 0 1px 2px rgba(20, 22, 40, 0.04), 0 10px 24px -14px rgba(20, 22, 40, 0.22); }
        .dc-cell[data-span="2"] { grid-column: span 2; }
        .dc-cell[data-span="3"] { grid-column: 1 / -1; }
        .dc-card { overflow: visible; min-width: 0; flex: 1; display: flex; flex-direction: column; height: 320px; }
        /* Fixed card height, so empty and full cards line up. */
        .dc-card-body { flex: 1; min-height: 0; padding: 6px 16px 16px; display: flex; flex-direction: column; justify-content: flex-start; overflow: hidden; }
        .dc-card-body > * { width: 100%; }
        .dc-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 14px 16px 4px; }
        .dc-card-title { font-size: 13.5px; font-weight: 500; color: var(--foreground); }
        .dc-headline { display: flex; align-items: center; gap: 8px; margin-top: 2px; font-size: 18px; font-weight: 500; color: var(--foreground); letter-spacing: -0.02em; }
        .dc-sub { margin-top: 2px; font-size: 12px; color: var(--foreground-muted); }
        .dc-badge { display: inline-flex; align-items: center; gap: 2px; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 500; letter-spacing: 0; }
        .dc-axis { font-size: 10.5px; fill: var(--foreground-subtle); font-family: var(--font-sans); }
        .dc-tip {
          position: absolute; transform: translate(-50%, 0); pointer-events: none; z-index: 5;
          min-width: 150px; padding: 8px 10px; border-radius: 8px;
          background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-md);
          font-size: 12px; color: var(--foreground);
        }
        .dc-tip-title { font-weight: 500; margin-bottom: 4px; }
        .dc-tip-row { display: flex; align-items: center; gap: 6px; color: var(--foreground-muted); }
        .dc-tip-row strong { margin-left: auto; padding-left: 12px; color: var(--foreground); }
        .dc-swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .dc-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 6px; font-size: 12px; color: var(--foreground-muted); }
        .dc-legend > span { display: inline-flex; align-items: center; gap: 6px; }
        .dc-legend-row { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px; font-size: 12px; cursor: default; transition: opacity 120ms ease, background 120ms ease; }
        .dc-legend-row:hover { background: var(--surface-muted, var(--background)); }
        .dc-legend-row[data-dim], .dc-hbar[data-dim] { opacity: 0.45; }
        .dc-legend-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--foreground); }
        .dc-legend-value { font-weight: 500; color: var(--foreground); white-space: nowrap; flex-shrink: 0; }
        .dc-legend-pct { width: 30px; flex-shrink: 0; text-align: right; color: var(--foreground-subtle); font-size: 11px; }
        .dc-hbars { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; --dc-label-w: 104px; }
        .dc-hbars-plot { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }
        .dc-hbar { flex: 1; min-height: 0; max-height: 34px; display: grid; grid-template-columns: var(--dc-label-w) minmax(0, 1fr); align-items: center; gap: 8px; cursor: default; transition: opacity 120ms ease; }
        .dc-hbar-label { font-size: 11.5px; color: var(--foreground-muted); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dc-hbar-track { position: relative; height: 100%; display: flex; align-items: center; border-left: 1px solid var(--border-strong, var(--border)); }
        .dc-hbars-grid { position: absolute; top: 0; bottom: 0; left: calc(var(--dc-label-w) + 8px); right: 0; pointer-events: none; }
        .dc-hbars-grid > span { position: absolute; top: 0; bottom: 0; border-left: 1px dashed ${GRID}; }
        .dc-hbar-fill { position: relative; z-index: 1; height: 72%; max-height: 22px; min-width: 2px; border-radius: 0 3px 3px 0; transition: width 300ms ease; }
        .dc-hbar-value { position: absolute; z-index: 2; padding: 0 6px; font-size: 11px; font-weight: 500; white-space: nowrap; color: var(--foreground); }
        .dc-hbar-value[data-inside] { color: #fff; }
        .dc-hbars-axis { flex: 0 0 auto; height: 16px; }
        .dc-hbars-axis .dc-hbar-track { border-left-color: transparent; }
        .dc-hbars-axis .dc-hbar-track > span { position: absolute; transform: translateX(-50%); font-size: 10.5px; color: var(--foreground-subtle); white-space: nowrap; }
        .dc-hbars-legend { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: 2px; font-size: 11.5px; font-weight: 500; color: var(--foreground-muted); }
        .dc-stack { margin-top: 6px; display: flex; gap: 2px; height: 12px; border-radius: 999px; overflow: hidden; background: var(--surface-muted, var(--background)); }
        .dc-health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dc-health { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 8px; background: var(--surface-muted, var(--background)); font-size: 12px; color: var(--foreground-muted); }
        .dc-health strong { margin-left: auto; color: var(--foreground); }
        .dc-empty { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 12.5px; color: var(--foreground-subtle); }
        .dc-state { padding: 28px 16px; text-align: center; font-size: 12.5px; color: var(--foreground-subtle); }
        @media (max-width: 1100px) {
          .dc-grid { grid-template-columns: minmax(0, 1fr); }
          .dc-cell[data-span] { grid-column: auto; }
        }
        @media (max-width: 700px) {
          .dc-card { height: auto; min-height: 300px; }
        }
      `}</style>
    </>
  )
}

