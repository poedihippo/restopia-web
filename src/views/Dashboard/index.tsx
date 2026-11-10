'use client'
import { formatCurrency } from '@/utils/price';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'
import { branchesService } from '@/services/branches.service'
import { useAuth } from '@/hooks/useAuth'
import type { DashboardChartInterval } from '@/types/api'
import DashboardCharts, { useDashboardCharts } from './DashboardCharts'
import { exportDashboardExcel } from './dashboardExport'
import { money } from '@/utils/excelExport'
import { productInventoriesService } from '@/services/product-inventories.service'
import { getProductUomName } from '@/utils/productUomName'
import { parseApiDate, formatDateShort } from '@/utils/date'
import {
  ShoppingBag,
  Factory,
  PackageSearch,
  Boxes,
  ShieldOff,
  Wallet,
  Clock,
  AlertTriangle,
  CalendarClock,
  Trophy,
  ArrowUpRight,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react'

// Local dates (en-CA = YYYY-MM-DD). toISOString() is UTC, which in WIB shifts
// "1 Nov 00:00" back to "31 Oct".
const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}
const todayStr = () => new Date().toLocaleDateString('en-CA')

const formatRp = (n: number | undefined | null): string => {
  if (n === undefined || n === null) return 'Rp 0'
  return formatCurrency(Number(n))
}
// Small KPI tiles: millions/billions shortened so the value fits; full amount goes in the tooltip.
const formatRpShort = (n: number | undefined | null): string => {
  const v = Number(n ?? 0)
  const unit = Math.abs(v) >= 1e9 ? { d: 1e9, s: 'M' } : Math.abs(v) >= 1e6 ? { d: 1e6, s: 'jt' } : null
  if (!unit) return formatRp(v)
  return `Rp ${(v / unit.d).toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${unit.s}`
}
const formatNum = (n: number | undefined | null): string => {
  if (n === undefined || n === null) return '0'
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

const PRESETS: { key: string; label: string; from: () => string; to: () => string }[] = [
  { key: 'today', label: 'Today', from: todayStr, to: todayStr },
  { key: '7d', label: '7 days', from: () => daysAgo(6), to: todayStr },
  { key: 'month', label: 'This month', from: firstOfMonth, to: todayStr },
  { key: '30d', label: '30 days', from: () => daysAgo(29), to: todayStr },
]

const PAYMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  partial: { label: 'Partial', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  pending: { label: 'Unpaid', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

type Tone = 'lavender' | 'mint' | 'blue' | 'coral' | 'gold'
const TONES: Tone[] = ['lavender', 'mint', 'blue', 'coral', 'gold']
const toneBg = (t: Tone) => `var(--pastel-${t})`
const toneInk = (t: Tone) => `var(--pastel-${t}-ink)`

const cardStyle: React.CSSProperties = {
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

const MOTIVATIONS = [
  'Every great batch starts with a single step. Let’s make today sweet.',
  'Small progress is still progress — keep it rolling.',
  'Quality is never an accident; it’s always the result of effort.',
  'Good things take time, just like the best chocolate.',
  'Do it with passion or not at all.',
  'Today’s effort is tomorrow’s success.',
  'Customers remember how you made them feel. Make it a good one.',
  'Consistency beats intensity. Show up and do the work.',
  'Great teams bake great results together.',
  'Focus on the next right thing, then the next one.',
  'Your hard work is the secret ingredient.',
  'Make today so good that yesterday gets jealous.',
]

const pickMotivation = (current?: string) => {
  const pool = MOTIVATIONS.filter((m) => m !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

// Chocolate cake illustration for the welcome banner (inline so it themes with the tokens).
function WelcomeArt() {
  return (
    <svg viewBox="0 0 220 150" width="220" height="150" aria-hidden="true" className="dash-welcome-art">
      <ellipse cx="110" cy="138" rx="86" ry="8" fill="var(--accent-light)" opacity="0.25" />
      <rect x="40" y="128" width="140" height="8" rx="4" fill="var(--accent-light)" opacity="0.55" />
      {/* Hover the art: the cake hops and flips upside down (CSS below). */}
      <g className="dash-float">
      <g className="dash-cake">
      <path d="M52 92h116v36H52z" fill="var(--cocoa-700, #4A2C1F)" />
      <path d="M52 92h116v8c-8 0-8 10-16 10s-8-10-16-10-8 14-16 14-8-14-16-14-8 10-16 10-8-10-16-10-8 12-16 12-4-8-4-8z" fill="var(--accent-light)" />
      <path d="M64 58h92v34H64z" fill="var(--cocoa-900, #2C1810)" />
      <path d="M64 58h92v6c-6 0-6 9-12 9s-6-9-12-9-6 13-12 13-6-13-12-13-6 9-12 9-6-9-12-9-6 11-12 11-4-6-4-6z" fill="#F3E3D3" />
      <circle cx="110" cy="50" r="8" fill="#C0392B" />
      <path d="M110 42c2-7 7-10 12-10" stroke="#3E7B3A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="84" y="36" width="4" height="22" rx="2" fill="#F3E3D3" />
      <rect x="132" y="36" width="4" height="22" rx="2" fill="#F3E3D3" />
      <path className="dash-flame" d="M86 28c-3 3-3 6 0 8 3-2 3-5 0-8zM134 28c-3 3-3 6 0 8 3-2 3-5 0-8z" fill="#F5B041" />
      </g>
      </g>
      <g fill="var(--accent-light)">
        <path className="dash-twinkle" d="M24 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path className="dash-twinkle" style={{ animationDelay: '0.6s' }} d="M190 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path className="dash-twinkle" style={{ animationDelay: '1.2s' }} d="M196 84l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" opacity="0.7" />
      </g>
    </svg>
  )
}

const greetingFor = (hour: number) =>
  hour < 11 ? 'Good morning' : hour < 15 ? 'Good afternoon' : hour < 19 ? 'Good evening' : 'Good night'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Eases from the previous value to the new one (0 on first render).
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    const dur = prefersReducedMotion() ? 0 : 1000
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = dur ? Math.min(1, (t - t0) / dur) : 1
      const v = p === 1 ? value : from + (value - from) * (1 - (1 - p) ** 3)
      fromRef.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(shown)}</>
}

// Blocks that fade/rise in as they scroll into view; charts and lists mount
// late, so new matches are picked up by a MutationObserver.
const REVEAL_SEL = '.dash-head, .dash-top > *, .dash-kpis > *, .dash > div:has(> h2), .dc-cell, .dc-state, .dash-row-3 > section, .dash-row-2 > section'

function useReveal(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    root.classList.add('dash-anim')
    const io = new IntersectionObserver(
      (entries) => {
        const pos = (el: Element) => el.getBoundingClientRect()
        // Already scrolled past (fast scroll, late mount): show without animating.
        entries
          .filter((e) => !e.isIntersecting && e.boundingClientRect.bottom < 0)
          .forEach((e) => {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          })
        entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => pos(a).top - pos(b).top || pos(a).left - pos(b).left)
          .forEach((el, i) => {
            el.style.setProperty('--reveal-delay', `${Math.min(i, 8) * 70}ms`)
            el.classList.add('is-in')
            io.unobserve(el)
          })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    )
    // Per-run set (not a DOM flag): StrictMode re-runs this effect on the same nodes.
    const seen = new WeakSet<Element>()
    let queued = 0
    const scan = () => {
      queued = 0
      root.querySelectorAll<HTMLElement>(REVEAL_SEL).forEach((el) => {
        if (seen.has(el) || el.classList.contains('is-in')) return
        seen.add(el)
        el.dataset.reveal = ''
        io.observe(el)
      })
    }
    scan()
    const mo = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(scan)
    })
    mo.observe(root, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
      cancelAnimationFrame(queued)
    }
  }, [ref])
}

function Skeleton({ w = '100%', h = 12 }: { w?: number | string; h?: number }) {
  return <div className="v2-skeleton" style={{ width: w, height: h }} />
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function IconTile({ icon: Icon, tone, size = 28 }: { icon: React.ElementType; tone: Tone; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: Math.round(size / 3.2),
        background: toneBg(tone),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={Math.round(size * 0.52)} color={toneInk(tone)} />
    </span>
  )
}

function Avatar({ name, seed }: { name: string; seed: number }) {
  const tone = TONES[Math.abs(seed) % TONES.length]
  return (
    <span
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        borderRadius: 999,
        background: toneBg(tone),
        color: toneInk(tone),
        fontSize: 11,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

function Panel({
  title,
  icon,
  tone = 'lavender',
  count,
  action,
  children,
}: {
  title: string
  icon: React.ElementType
  tone?: Tone
  count?: number
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <section className="v2-card" style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <IconTile icon={icon} tone={tone} size={26} />
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--foreground)' }}>{title}</span>
        {count != null && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '1px 8px',
              borderRadius: 999,
              background: 'var(--surface-muted, var(--background))',
              color: 'var(--foreground-muted)',
            }}
          >
            {count}
          </span>
        )}
        {action && (
          <button type="button" onClick={action.onClick} className="dash-link">
            <span className="v2-link">
              {action.label}
              <ArrowUpRight size={12} />
            </span>
          </button>
        )}
      </header>
      <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--foreground-subtle)' }}>
      {text}
    </div>
  )
}

function Forbidden({ what }: { what: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', textAlign: 'center' }}>
      <ShieldOff size={22} color="var(--border-strong)" />
      <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 500, color: 'var(--foreground-muted)' }}>Access restricted</div>
      <div style={{ marginTop: 2, fontSize: 12, color: 'var(--foreground-subtle)' }}>
        You don&apos;t have permission to view {what}.
      </div>
    </div>
  )
}

const daysUntil = (value?: string | null): number | null => {
  const d = parseApiDate(value ?? null)
  if (!d) return null
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  return Math.round((start(d) - start(new Date())) / 86_400_000)
}

export default function DashboardView() {
  // Every dashboard link opens in a new tab so the overview stays put.
  const openTab = (href: string) => window.open(href, '_blank', 'noopener')

  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth())
  const [dateTo, setDateTo] = useState<string>(todayStr())

  const {
    data: metricsQueryData,
    isLoading: isMetricsLoading,
    isError: isMetricsError,
    error: metricsError,
  } = useQuery({
    queryKey: ['dashboard-metrics', dateFrom, dateTo],
    queryFn: () =>
      dashboardService
        .metrics({
          // created_at is a datetime: a bare date as the upper bound would
          // stop at 00:00 and drop everything from the last day.
          'filter[created_at_gte]': `${dateFrom} 00:00:00`,
          'filter[created_at_lte]': `${dateTo} 23:59:59`,
        } as any)
        .then((r) => r.data),
    retry: false,
  })

  const {
    data: insightsQueryData,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
    error: insightsError,
  } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: () => dashboardService.insights({} as any).then((r) => r.data),
    retry: false,
  })

  const is403 = (err: any) => err?.response?.status === 403
  const metricsForbidden = isMetricsError && is403(metricsError)
  const insightsForbidden = isInsightsError && is403(insightsError)

  const metricsData: any = (metricsQueryData as any)?.data ?? {}
  const insightsData: any = (insightsQueryData as any)?.data ?? {}

  // Insight inventory rows may arrive without their batch → product; look the
  // names up by batch id so rows read "Almond Pebbles", not "#692".
  const inventoryInsightKeys = [
    'low_stock_product_inventories',
    'top_sold_product_inventories',
    'expiring_product_inventories',
    'expired_product_inventories',
  ]
  const unnamedBatchIds: number[] = Array.from(
    new Set(
      inventoryInsightKeys
        .flatMap((k) => (Array.isArray(insightsData?.[k]) ? insightsData[k] : []))
        .filter((r: any) => !r?.product_uom_batch?.product_uom && r?.product_uom_batch_id)
        .map((r: any) => Number(r.product_uom_batch_id))
    )
  ).sort((a, b) => a - b)

  const { data: batchLookupData } = useQuery({
    queryKey: ['dashboard-insight-batches', unnamedBatchIds],
    enabled: unnamedBatchIds.length > 0,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 100,
          include: 'product_uom_batch,product_uom_batch.product_uom',
          'filter[product_uom_batch_ids]': unnamedBatchIds.join(','),
        } as any)
        .then((r) => r.data),
  })
  const batchById = new Map<number, any>()
  for (const inv of ((batchLookupData as any)?.data?.data ?? []) as any[]) {
    if (inv?.product_uom_batch) batchById.set(Number(inv.product_uom_batch_id), inv.product_uom_batch)
  }

  // Name of an inventory insight row: batch → product UOM (looked up when the row lacks it).
  const batchOf = (o: any) =>
    o?.product_uom_batch?.product_uom ? o.product_uom_batch : batchById.get(Number(o?.product_uom_batch_id))
  const inventoryName = (o: any): string => {
    const batch = batchOf(o)
    const name = batch?.product_uom ? getProductUomName(batch.product_uom) : ''
    return name || o?.product_uom?.product?.name || o?.code || (o?.id != null ? `#${o.id}` : '—')
  }
  const batchCodeOf = (o: any): string => batchOf(o)?.batch_code ?? ''
  // Product behind an inventory row, so the row can open its detail on the Products page.
  const productIdOf = (o: any): number | null => {
    const pu = batchOf(o)?.product_uom ?? o?.product_uom
    const id = pu?.product_id ?? pu?.product?.id
    return id ? Number(id) : null
  }
  const openProduct = (o: any) => {
    const id = productIdOf(o)
    if (id) openTab(`/products?view=${id}`)
  }
  // Inventory name, rendered as a link when the product is known.
  const inventoryLabel = (o: any, style?: React.CSSProperties) =>
    productIdOf(o) ? (
      <span className="v2-link" title={inventoryName(o)} style={{ maxWidth: '100%', minWidth: 0, ...style }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inventoryName(o)}</span>
        <ArrowUpRight size={12} />
      </span>
    ) : (
      <span title={inventoryName(o)} style={{ display: 'block', color: 'var(--foreground)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...style }}>
        {inventoryName(o)}
      </span>
    )
  const expiryOf = (o: any): string | null =>
    o?.expiry_date ?? o?.product_uom_batch?.expiry_date ?? batchOf(o)?.expiry_date ?? null

  const list = (k: string): any[] => (Array.isArray(insightsData?.[k]) ? insightsData[k] : [])
  const recentOrders = list('recent_sales_orders')
  const pendingFulfillment = list('pending_fulfillment_sales_orders')
  const topSold = list('top_sold_product_inventories')
  const lowStock = list('low_stock_product_inventories')
  const expiring = list('expiring_product_inventories')
  const expired = list('expired_product_inventories')
  const topMax = Math.max(1, ...topSold.map((o: any) => Number(o.total_sold ?? 0)))

  const [expiryTab, setExpiryTab] = useState<'expiring' | 'expired'>('expiring')

  // Charts: interval toggle + owner-only branch filter (dashboard.superadmin).
  const { user, hasPermission } = useAuth()
  const isOwner = hasPermission('dashboard.superadmin')

  // Clock/random differ between SSR and client; the text nodes below suppress that hydration warning.
  const greeting = greetingFor(new Date().getHours())
  const [motivation, setMotivation] = useState(() => pickMotivation())
  const rootRef = useRef<HTMLDivElement>(null)
  useReveal(rootRef)
  const [chartInterval, setChartInterval] = useState<DashboardChartInterval>('day')
  const [chartBranchId, setChartBranchId] = useState<number | ''>('')
  const { data: ownerBranchesData } = useQuery({
    queryKey: ['branches-all', 'dashboard-charts'],
    enabled: isOwner,
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' } as any).then((r) => r.data),
  })
  const ownerBranches: any[] = (ownerBranchesData as any)?.data ?? []
  const expiryRows = expiryTab === 'expiring' ? expiring : expired

  const collected = Number(metricsData?.sum_payments ?? 0)
  const pendingPay = Number(metricsData?.calculate_pending_payments ?? 0)
  const collectedPct = collected + pendingPay > 0 ? (collected / (collected + pendingPay)) * 100 : 0

  const activePreset = PRESETS.find((p) => p.from() === dateFrom && p.to() === dateTo)?.key

  // Executive KPIs come from the charts payload (totals + change vs the previous
  // period); fall back to /metrics counts where a chart is not available.
  const { charts: chartsData, isLoading: isChartsLoading } = useDashboardCharts({
    dateFrom,
    dateTo,
    interval: chartInterval,
    branchId: isOwner && chartBranchId !== '' ? chartBranchId : undefined,
    activeBranchId: user?.branch?.id,
  })
  const seriesOf = (chart: any, key: string) =>
    (chart?.series ?? []).find((x: any) => x.key === key) as
      | { data: number[]; total: number; change_pct: number | null }
      | undefined
  const revenue = seriesOf(chartsData?.sales_trend, 'revenue')
  const salesOrders = seriesOf(chartsData?.sales_trend, 'orders')
  const spending = seriesOf(chartsData?.purchase_trend, 'spending')
  const productions = seriesOf(chartsData?.production_trend, 'productions')
  // Hold the whole band until metrics AND charts are in, so it never renders the
  // fallback layout first and then swaps to the revenue layout.
  const kpiLoading = isMetricsLoading || isChartsLoading
  const avgOrder = revenue && salesOrders && salesOrders.total > 0 ? revenue.total / salesOrders.total : null

  const countTiles: Array<{
    label: string
    icon: React.ElementType
    tone: Tone
    value: React.ReactNode
    full?: string
    hint: string
    change?: number | null
    href?: string
    loading?: boolean
  }> = [
    {
      label: 'Sales Orders',
      icon: ShoppingBag,
      tone: 'lavender',
      value: formatNum(salesOrders?.total ?? metricsData?.count_final_sales_orders ?? 0),
      hint: 'final orders',
      change: salesOrders?.change_pct,
      href: '/sales/sales-orders',
      loading: salesOrders ? isChartsLoading : isMetricsLoading,
    },
    avgOrder != null
      ? { label: 'Avg. Order Value', icon: Trophy, tone: 'gold', value: formatRpShort(avgOrder), full: formatRp(avgOrder), hint: 'revenue per order' }
      : {
          label: 'Production',
          icon: Factory,
          tone: 'mint',
          value: formatNum(productions?.total ?? metricsData?.count_final_production_details ?? 0),
          hint: productions ? 'final productions' : 'items produced',
          change: productions?.change_pct,
          href: '/production',
          loading: productions ? isChartsLoading : isMetricsLoading,
        },
    spending
      ? { label: 'Purchase Spend', icon: PackageSearch, tone: 'blue', value: formatRpShort(spending.total), full: formatRp(spending.total), hint: 'purchasing', change: spending.change_pct, href: '/purchase/purchase-orders', loading: isChartsLoading }
      : {
          label: 'Purchase Orders',
          icon: PackageSearch,
          tone: 'blue',
          value: formatNum(metricsData?.count_final_purchase_orders ?? 0),
          hint: 'final orders',
          href: '/purchase/purchase-orders',
          loading: isMetricsLoading,
        },
    avgOrder != null
      ? {
          label: 'Production',
          icon: Factory,
          tone: 'mint',
          value: formatNum(productions?.total ?? metricsData?.count_final_production_details ?? 0),
          hint: productions ? 'final productions' : 'items produced',
          change: productions?.change_pct,
          href: '/production',
          loading: productions ? isChartsLoading : isMetricsLoading,
        }
      : { label: 'Pending Payments', icon: Clock, tone: 'coral', value: formatRp(pendingPay), hint: 'awaiting payment', loading: isMetricsLoading },
  ]

  const exportBranchName =
    isOwner && chartBranchId !== ''
      ? ownerBranches.find((b: any) => Number(b.id) === chartBranchId)?.name ?? `Branch #${chartBranchId}`
      : chartsData?.scope?.mode === 'company'
        ? 'All branches'
        : user?.branch?.name ?? '—'
  const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const handleExport = () => {
    const kpis: [string, any][] = [
      ...(revenue
        ? ([
            ['Revenue', money(revenue.total)],
            ['Revenue change vs previous period (%)', revenue.change_pct ?? ''],
          ] as [string, any][])
        : []),
      ['Sales orders', salesOrders?.total ?? Number(metricsData?.count_final_sales_orders ?? 0)],
      ...(salesOrders?.change_pct != null ? ([['Sales orders change (%)', salesOrders.change_pct]] as [string, any][]) : []),
      ...(avgOrder != null ? ([['Average order value', money(avgOrder)]] as [string, any][]) : []),
      ['Payments collected', money(collected)],
      ['Outstanding payments', money(pendingPay)],
      ['Collected share (%)', Math.round(collectedPct * 10) / 10],
      ...(spending
        ? ([
            ['Purchase spend', money(spending.total)],
            ['Purchase spend change (%)', spending.change_pct ?? ''],
          ] as [string, any][])
        : []),
      ['Purchase orders (final)', Number(metricsData?.count_final_purchase_orders ?? 0)],
      ['Production (final)', productions?.total ?? Number(metricsData?.count_final_production_details ?? 0)],
    ]
    const daysLabel = (d: number | null, past: string, future: string) =>
      d == null ? '' : d < 0 ? `${-d}d ${past}` : d === 0 ? 'Today' : `${d}d ${future}`
    exportDashboardExcel({
      branch: exportBranchName,
      period: `${fmtDay(dateFrom)} – ${fmtDay(dateTo)} (${chartInterval})`,
      kpis,
      charts: chartsData,
      lists: [
        {
          name: 'Pending Fulfillment',
          head: ['Order', 'Customer', 'Fulfillment date', 'Status'],
          rows: pendingFulfillment.map((o: any) => [
            o.code,
            o.customer_name || o.customer?.name || 'Walk-in',
            formatDateShort(o.fulfillment_date),
            daysLabel(daysUntil(o.fulfillment_date), 'late', 'left'),
          ]),
        },
        {
          name: 'Low Stock',
          head: ['Name', 'Batch', 'Stock'],
          rows: lowStock.map((o: any) => [inventoryName(o), batchCodeOf(o), Number(o.stock ?? 0)]),
        },
        {
          name: 'Expiring Soon',
          head: ['Name', 'Batch', 'Expiry', 'Stock', 'Status'],
          rows: expiring.map((o: any) => [inventoryName(o), batchCodeOf(o), expiryOf(o) ? formatDateShort(expiryOf(o)) : '', Number(o.stock ?? 0), daysLabel(daysUntil(expiryOf(o)), 'ago', 'left')]),
        },
        {
          name: 'Expired',
          head: ['Name', 'Batch', 'Expiry', 'Stock', 'Status'],
          rows: expired.map((o: any) => [inventoryName(o), batchCodeOf(o), expiryOf(o) ? formatDateShort(expiryOf(o)) : '', Number(o.stock ?? 0), daysLabel(daysUntil(expiryOf(o)), 'ago', 'left')]),
        },
        {
          name: 'Recent Sales Orders',
          head: ['Order', 'Customer', 'Date', 'Payment', 'Total'],
          rows: recentOrders.map((o: any) => [
            o.code,
            o.customer_name || o.customer?.name || 'Walk-in',
            formatDateShort(o.date),
            PAYMENT_META[o.payment_status as string]?.label ?? o.payment_status ?? '',
            money(o.total_price),
          ]),
        },
        {
          name: 'Top Selling',
          head: ['#', 'Name', 'Sold'],
          rows: topSold.map((o: any, i: number) => [i + 1, inventoryName(o), Number(o.total_sold ?? 0)]),
        },
      ],
    })
  }

  // Revenue sparkline for the hero card.
  const spark = revenue?.data ?? []
  const sparkMax = Math.max(1, ...spark)
  const sparkPts = spark.map((v, i) => `${spark.length > 1 ? (i / (spark.length - 1)) * 100 : 50},${28 - (v / sparkMax) * 26}`)

  const listSkeleton = (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} w={`${90 - i * 8}%`} />
      ))}
    </div>
  )

  return (
    <div ref={rootRef} className="dash" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {/* ── Header ── */}
      <div className="dash-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="dash-filters" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="v2-seg dash-presets" role="tablist" aria-label="Period">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={activePreset === p.key}
                onClick={() => {
                  setDateFrom(p.from())
                  setDateTo(p.to())
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input type="date" className="v2-input" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} aria-label="From" />
          <span className="dash-dash" style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>–</span>
          <input type="date" className="v2-input" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} aria-label="To" />
          {/* Owner branch filter (KPIs + charts) */}
          <span className="dash-sep" style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
          {isOwner && (
            <select
              value={chartBranchId}
              onChange={(e) => setChartBranchId(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="Branch"
              className="v2-select dash-branch"
              style={{ maxWidth: 220 }}
            >
              <option value="">All branches</option>
              {ownerBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="v2-btn v2-btn-ghost dash-export"
            onClick={handleExport}
            disabled={kpiLoading || isInsightsLoading}
            title="Download this dashboard as an Excel file"
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* ── Welcome + revenue ── */}
      <div className="dash-top">
        <section className="dash-welcome">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Welcome back
            </span>
            <h2 suppressHydrationWarning style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {greeting}{user?.name ? `, ${user.name}` : ''} 👋
            </h2>
            <p key={motivation} suppressHydrationWarning className="dash-welcome-quote" style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0, maxWidth: 560, lineHeight: 1.5, minHeight: 20 }}>
              {motivation && `“${motivation}”`}
            </p>
            <div style={{ marginTop: 8 }}>
              <button type="button" className="v2-btn v2-btn-primary" onClick={() => setMotivation((m) => pickMotivation(m))}>
                <Sparkles size={14} />
                Motivate Me!
              </button>
            </div>
          </div>
          <WelcomeArt />
        </section>
        {/* Hero: revenue with change vs previous period; collected vs outstanding below. */}
        {!metricsForbidden && (kpiLoading ? (
          <section className="dash-hero" style={{ justifyContent: 'space-between' }}>
            <div style={{ width: 140, height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ width: 220, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
          </section>
        ) : (
          <section className="dash-hero">
            <span className="dash-hero-orb" style={{ width: 180, height: 180, right: -50, top: -70 }} />
            <span className="dash-hero-orb" style={{ width: 120, height: 120, right: 40, bottom: -70, opacity: 0.6 }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={15} color="var(--caramel)" />
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                {revenue ? 'Revenue' : 'Payments received'}
              </span>
              {revenue?.change_pct != null && (
                <span className="dash-hero-change" data-down={revenue.change_pct < 0 || undefined}>
                  {revenue.change_pct >= 0 ? '▲' : '▼'} {Math.abs(revenue.change_pct).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              {(revenue ? isChartsLoading : isMetricsLoading) ? (
                <div style={{ width: 180, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.12)' }} />
              ) : (
                <div className="dash-hero-value" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  <CountUp value={Number(revenue ? revenue.total : collected) || 0} format={formatRp} />
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                {revenue ? 'vs previous period of the same length' : `${collectedPct.toFixed(0)}% of billed amount collected in period`}
              </div>
            </div>
            {sparkPts.length > 1 && (
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ position: 'relative', width: '100%', height: 34 }} aria-hidden>
                <polyline points={sparkPts.join(' ')} fill="none" stroke="var(--caramel)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            )}
            <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                <div style={{ width: `${collectedPct}%`, height: '100%', background: 'linear-gradient(90deg, #E2B07A, var(--caramel))', borderRadius: 999, transition: 'width 300ms ease' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                <span>
                  Collected <strong style={{ color: '#fff', fontWeight: 500 }}>{formatRp(collected)}</strong>
                </span>
                <span>
                  Outstanding <strong style={{ color: '#fff', fontWeight: 500 }}>{formatRp(pendingPay)}</strong>
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ── KPIs ── */}
      {metricsForbidden ? (
        <section className="v2-card" style={cardStyle}>
          <Forbidden what="dashboard metrics (dashboard.read)" />
        </section>
      ) : kpiLoading ? (
        <div className="dash-kpis" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dash-stat" style={{ background: 'var(--surface)', borderColor: 'var(--border)' } as React.CSSProperties}>
              <div className="v2-skeleton" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div className="v2-skeleton" style={{ width: '50%', height: 10 }} />
                <div className="v2-skeleton" style={{ width: '70%', height: 18 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-kpis">
          {countTiles.map(({ label, icon: Icon, tone, value, full, hint, href, change, loading }) => {
            const body = (
              <>
                <span className="dash-stat-icon">
                  <Icon size={17} color={toneInk(tone)} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--foreground-muted)' }}>{label}</span>
                  {loading ? (
                    <Skeleton w={70} h={22} />
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2, minWidth: 0 }}>
                      <span className="dash-stat-value" title={full ?? (typeof value === 'string' ? value : undefined)} style={{ fontSize: 20, fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.25, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {value}
                      </span>
                      {change != null && (
                        <span className="dash-change" data-down={change < 0 || undefined}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                        </span>
                      )}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{hint} in period</span>
                </span>
              </>
            )
            const style = { '--tile-bg': toneBg(tone), '--tile-ink': toneInk(tone) } as React.CSSProperties
            return href ? (
              <button key={label} type="button" onClick={() => openTab(href)} className="dash-stat" style={style}>
                {body}
                <ArrowUpRight size={14} className="dash-stat-arrow" />
              </button>
            ) : (
              <div key={label} className="dash-stat" style={style}>
                {body}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Charts ── */}
      <div className="dash-section-head" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>Performance</h2>
        <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>Trends and breakdowns for the selected period</span>
        {/* Grouping only re-buckets the over-time charts; totals don't change. */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Group by</span>
          <div className="v2-seg dash-interval" role="tablist" aria-label="Group trend charts by">
            {(['day', 'week', 'month'] as const).map((iv) => (
              <button key={iv} type="button" role="tab" aria-selected={chartInterval === iv} onClick={() => setChartInterval(iv)}>
                {iv === 'day' ? 'Day' : iv === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <DashboardCharts
        dateFrom={dateFrom}
        dateTo={dateTo}
        interval={chartInterval}
        branchId={isOwner && chartBranchId !== '' ? chartBranchId : undefined}
        activeBranchId={user?.branch?.id}
      />

      {/* ── Watchlist ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>Needs Attention</h2>
        <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>Live status, not limited to the period</span>
      </div>
      <div className="dash-row-3">
        <Panel
          title="Pending Fulfillment"
          icon={CalendarClock}
          tone="blue"
          count={insightsForbidden ? undefined : pendingFulfillment.length}
          action={{ label: 'Orders', onClick: () => openTab('/sales/sales-orders') }}
        >
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : isInsightsLoading ? (
            listSkeleton
          ) : pendingFulfillment.length === 0 ? (
            <EmptyRow text="Nothing waiting to be fulfilled" />
          ) : (
            pendingFulfillment.slice(0, 6).map((o: any) => {
              const left = daysUntil(o.fulfillment_date)
              const tone =
                left == null ? null
                  : left < 0 ? { label: `${-left}d late`, color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
                  : left === 0 ? { label: 'Today', color: 'var(--warning)', bg: 'var(--warning-bg)' }
                  : { label: `in ${left}d`, color: 'var(--info)', bg: 'var(--info-bg)' }
              const customer = o.customer_name || o.customer?.name || 'Walk-in'
              return (
                <div key={o.id} className="dash-row" data-click onClick={() => openTab(`/sales/sales-orders/${o.id}/detail`)}>
                  <Avatar name={customer} seed={Number(o.customer_id ?? o.id ?? 0)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="v2-link">
                      {o.code}
                      <ArrowUpRight size={12} />
                    </span>
                    <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer} · {formatDateShort(o.fulfillment_date)}
                    </div>
                  </div>
                  {tone && <Badge {...tone} />}
                </div>
              )
            })
          )}
        </Panel>

        <Panel
          title="Low Stock"
          icon={AlertTriangle}
          tone="coral"
          count={insightsForbidden ? undefined : lowStock.length}
          action={{ label: 'Stock', onClick: () => openTab('/products/product-inventory') }}
        >
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : isInsightsLoading ? (
            listSkeleton
          ) : lowStock.length === 0 ? (
            <EmptyRow text="All stock levels look fine" />
          ) : (
            lowStock.slice(0, 6).map((o: any, i: number) => {
              const stock = Number(o.stock ?? 0)
              return (
                <div key={o.id ?? i} className="dash-row" data-click={productIdOf(o) ? '' : undefined} onClick={() => openProduct(o)}>
                  <IconTile icon={Boxes} tone={stock <= 0 ? 'coral' : 'gold'} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {inventoryLabel(o)}
                    {batchCodeOf(o) && <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>{batchCodeOf(o)}</div>}
                  </div>
                  <span style={{ fontWeight: 500, color: stock <= 0 ? 'var(--destructive)' : 'var(--warning)', flexShrink: 0 }}>
                    {formatNum(stock)}
                  </span>
                </div>
              )
            })
          )}
        </Panel>

        <Panel
          title="Expiry"
          icon={Clock}
          tone="mint"
          count={insightsForbidden ? undefined : expiring.length + expired.length}
        >
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : (
            <>
              <div style={{ padding: '10px 16px 4px' }}>
                <div className="v2-seg" role="tablist" aria-label="Expiry">
                  {([
                    ['expiring', `Expiring soon (${expiring.length})`],
                    ['expired', `Expired (${expired.length})`],
                  ] as const).map(([k, label]) => (
                    <button key={k} type="button" role="tab" aria-selected={expiryTab === k} onClick={() => setExpiryTab(k)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {isInsightsLoading ? (
                listSkeleton
              ) : expiryRows.length === 0 ? (
                <EmptyRow text={expiryTab === 'expiring' ? 'Nothing expiring soon' : 'No expired stock'} />
              ) : (
                expiryRows.slice(0, 6).map((o: any, i: number) => {
                  const exp = expiryOf(o)
                  const left = daysUntil(exp)
                  return (
                    <div key={o.id ?? i} className="dash-row" data-click={productIdOf(o) ? '' : undefined} onClick={() => openProduct(o)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {inventoryLabel(o)}
                        <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                          Exp {exp ? formatDateShort(exp) : '—'} · Stock {formatNum(o.stock)}
                        </div>
                      </div>
                      {left != null && (
                        <Badge
                          {...(left < 0
                            ? { label: `${-left}d ago`, color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
                            : { label: left === 0 ? 'Today' : `${left}d left`, color: 'var(--warning)', bg: 'var(--warning-bg)' })}
                        />
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}
        </Panel>
      </div>

      {/* ── Recent activity ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>Recent Activity</h2>
        <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>Latest orders and best sellers</span>
      </div>
      <div className="dash-row-2">
        <Panel
          title="Recent Sales Orders"
          icon={ShoppingBag}
          tone="lavender"
          action={{ label: 'View all', onClick: () => openTab('/sales/sales-orders') }}
        >
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : isInsightsLoading ? (
            listSkeleton
          ) : recentOrders.length === 0 ? (
            <EmptyRow text="No recent orders" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="v2-table">
                <thead>
                  <tr>
                    {['Order', 'Customer', 'Date', 'Payment', 'Total'].map((h) => (
                      <th key={h} style={{ textAlign: h === 'Total' ? 'right' : 'left', paddingLeft: h === 'Order' ? 16 : undefined, paddingRight: h === 'Total' ? 16 : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.slice(0, 8).map((o: any) => {
                    const pm = PAYMENT_META[o.payment_status as string]
                    const customer = o.customer_name || o.customer?.name || 'Walk-in'
                    return (
                      <tr key={o.id} data-row onClick={() => openTab(`/sales/sales-orders/${o.id}/detail`)} style={{ cursor: 'pointer' }}>
                        <td style={{ paddingLeft: 16, whiteSpace: 'nowrap' }}>
                          <span className="v2-link">
                            {o.code}
                            <ArrowUpRight size={12} />
                          </span>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <Avatar name={customer} seed={Number(o.customer_id ?? o.id ?? 0)} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer}</span>
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>{formatDateShort(o.date)}</td>
                        <td>{pm ? <Badge {...pm} /> : <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>—</span>}</td>
                        <td style={{ paddingRight: 16, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRp(o.total_price)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Top Selling" icon={Trophy} tone="gold" count={topSold.length || undefined}>
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : isInsightsLoading ? (
            listSkeleton
          ) : topSold.length === 0 ? (
            <EmptyRow text="No sales yet" />
          ) : (
            <div style={{ padding: '6px 0' }}>
              {topSold.slice(0, 8).map((o: any, i: number) => {
                const sold = Number(o.total_sold ?? 0)
                return (
                  <div
                    key={o.id ?? i}
                    className="dash-top-row"
                    data-click={productIdOf(o) ? '' : undefined}
                    onClick={() => openProduct(o)}
                    style={{ padding: '7px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          flexShrink: 0,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: i < 3 ? 'var(--accent-light-bg)' : 'var(--surface-muted, var(--background))',
                          color: i < 3 ? 'var(--accent)' : 'var(--foreground-subtle)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex' }}>{inventoryLabel(o)}</span>
                      <span style={{ fontWeight: 500, color: 'var(--foreground)', flexShrink: 0 }}>{formatNum(sold)}</span>
                    </div>
                    <div style={{ marginLeft: 30, height: 5, borderRadius: 999, background: 'var(--surface-muted, var(--background))', overflow: 'hidden' }}>
                      <div style={{ width: `${(sold / topMax) * 100}%`, height: '100%', borderRadius: 999, background: i < 3 ? 'var(--accent-light)' : 'var(--pastel-lavender-ink)', opacity: i < 3 ? 1 : 0.45 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      <style>{`
        .dash-welcome {
          position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 20px 24px; border-radius: var(--radius-xl);
          border: 1px solid var(--border);
          background: linear-gradient(120deg, var(--surface) 0%, var(--surface) 45%, var(--accent-light-bg) 100%);
          box-shadow: var(--shadow-sm);
        }
        /* ── Motion ── (all of it is off under prefers-reduced-motion: no .dash-anim) */
        .dash-anim [data-reveal] { opacity: 0; transform: translateY(18px) scale(0.985); }
        .dash-anim [data-reveal].is-in {
          opacity: 1; transform: none;
          transition:
            opacity 600ms cubic-bezier(0.16, 1, 0.3, 1) var(--reveal-delay, 0ms),
            transform 750ms cubic-bezier(0.16, 1, 0.3, 1) var(--reveal-delay, 0ms),
            border-color 150ms ease, box-shadow 200ms ease, translate 220ms ease;
        }
        .dash-anim .dash-float { animation: dash-float 4.5s ease-in-out infinite; }
        .dash-anim .dash-twinkle { transform-box: fill-box; transform-origin: center; animation: dash-twinkle 2.4s ease-in-out infinite; }
        .dash-anim .dash-flame { transform-box: fill-box; transform-origin: bottom; animation: dash-flame 1.1s ease-in-out infinite alternate; }
        .dash-anim .dash-hero-orb { animation: dash-drift 9s ease-in-out infinite alternate; }
        .dash-anim .dash-welcome-art { cursor: pointer; }
        .dash-anim .dash-cake {
          transform-box: fill-box; transform-origin: 50% 55%;
          transition: rotate 900ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .dash-anim .dash-welcome-art:hover .dash-cake { rotate: 180deg; animation: dash-hop 900ms cubic-bezier(0.22, 1, 0.36, 1); }
        .dash-anim .dash-welcome-art:hover .dash-twinkle { animation-duration: 0.7s; }
        @keyframes dash-hop {
          0% { translate: 0 0; scale: 1; }
          18% { translate: 0 2px; scale: 1.06 0.92; }
          45% { translate: 0 -22px; scale: 0.96 1.05; }
          78% { translate: 0 0; scale: 1.04 0.95; }
          100% { translate: 0 0; scale: 1; }
        }
        @keyframes dash-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes dash-twinkle { 0%, 100% { opacity: 0.35; transform: scale(0.75) rotate(0deg); } 50% { opacity: 1; transform: scale(1.1) rotate(20deg); } }
        @keyframes dash-flame { from { transform: scaleY(0.85); } to { transform: scaleY(1.12); } }
        @keyframes dash-drift { from { translate: 0 0; } to { translate: -18px 10px; } }
        .dash-welcome { container-type: inline-size; }
        .dash-welcome-art { flex-shrink: 0; }
        @container (max-width: 560px) { .dash-welcome-art { width: 140px; height: auto; } }
        @container (max-width: 420px) { .dash-welcome-art { display: none; } }
        .dash-welcome-quote { animation: dash-quote-in 280ms ease; }
        @keyframes dash-quote-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 640px) {
          .dash-welcome { padding: 16px; }
          .dash-welcome-art { display: none; }
        }
        .dash-top { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
        .dash-top > :only-child { grid-column: 1 / -1; }
        .dash-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .dash-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 176px;
          padding: 18px 20px;
          border-radius: var(--radius-xl);
          color: #fff;
          background: linear-gradient(135deg, var(--cocoa-700) 0%, var(--cocoa-900) 100%);
          box-shadow: 0 10px 24px rgba(42, 26, 19, 0.18);
        }
        .dash-hero-orb { position: absolute; border-radius: 999px; background: radial-gradient(circle, rgba(198, 139, 78, 0.45), rgba(198, 139, 78, 0) 70%); pointer-events: none; }
        .dash-hero-btn {
          height: 28px; padding: 0 12px; border: none; border-radius: 8px;
          background: #fff; color: var(--cocoa-700); font-size: 12px; font-weight: 500;
          font-family: var(--font-sans); cursor: pointer; transition: background 150ms ease;
        }
        .dash-hero-btn:hover { background: var(--accent-light-bg); }
        .dash-change { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 999px; font-size: 10.5px; font-weight: 500; color: var(--success); background: rgba(255,255,255,0.7); white-space: nowrap; }
        .dash-change[data-down] { color: var(--destructive); }
        .dash-hero-change { margin-left: auto; height: 22px; display: inline-flex; align-items: center; padding: 0 8px; border-radius: 999px; font-size: 11.5px; font-weight: 500; color: #9BE3C1; background: rgba(155, 227, 193, 0.14); }
        .dash-hero-change[data-down] { color: #FFB4B4; background: rgba(255, 180, 180, 0.14); }
        .dash-stat {
          display: flex; align-items: center; gap: 12px; padding: 14px 16px;
          border: 1px solid transparent; border-radius: var(--radius-lg);
          text-align: left; font: inherit; color: inherit; cursor: default; min-width: 0;
        }
        button.dash-stat { cursor: pointer; }
        .dash-link {
          margin-left: auto; display: inline-flex; align-items: center; gap: 2px;
          height: 24px; padding: 0 6px 0 8px; border: none; border-radius: 6px; background: none;
          font-size: 12px; font-weight: 500; font-family: var(--font-sans);
          color: var(--foreground-muted); cursor: pointer; transition: background 150ms ease, color 150ms ease;
        }
        .dash-link:hover { background: var(--surface-muted, var(--background)); }
        /* Near-white tile with a faint silver sheen; only the icon keeps its tone colour. */
        .dash-stat {
          position: relative; overflow: hidden; isolation: isolate;
          background: linear-gradient(160deg, #ffffff 0%, #ffffff 55%, #f7f8fa 100%);
          border-color: #e8eaee;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(20, 22, 40, 0.05), 0 4px 12px -8px rgba(20, 22, 40, 0.18);
        }
        .dash-stat::after {
          content: ''; position: absolute; z-index: -1; inset: 0;
          background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.6) 45%, transparent 55%);
          pointer-events: none;
        }
        button.dash-stat { transition: border-color 150ms ease, box-shadow 200ms ease, translate 220ms ease; }
        button.dash-stat:hover {
          translate: 0 -2px;
          border-color: #d6d9e0;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(20, 22, 40, 0.05), 0 8px 18px -10px rgba(20, 22, 40, 0.28);
        }
        .dash-stat-icon {
          width: 38px; height: 38px; flex-shrink: 0; border-radius: 11px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--tile-bg);
          border: 1px solid color-mix(in srgb, var(--tile-ink) 20%, transparent);
        }
        .dash-stat-arrow { position: absolute; top: 10px; right: 10px; color: var(--foreground-subtle); transition: color 150ms ease, transform 150ms ease; }
        button.dash-stat:hover .dash-stat-arrow { color: var(--foreground-muted); transform: translate(1px, -1px); }
        .dash-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border); font-size: 12.5px; }
        .dash-row:last-child { border-bottom: none; }
        .dash-row[data-click] { cursor: pointer; transition: background 120ms ease; }
        .dash-row[data-click]:hover { background: var(--surface-muted, var(--background)); }
        .dash-top-row[data-click] { cursor: pointer; transition: background 120ms ease; }
        .dash-top-row[data-click]:hover { background: var(--surface-muted, var(--background)); }
        .dash-row-2 { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
        .dash-row-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
        /* Panels keep their size when empty; panels in a row share one height. */
        .dash-row-2 > section { min-height: 340px; }
        .dash-row-3 > section { min-height: 300px; }
        @media (max-width: 1100px) {
          .dash-top { grid-template-columns: minmax(0, 1fr); }
          .dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dash-row-2, .dash-row-3 { grid-template-columns: minmax(0, 1fr); }
        }
        /* Phones: owners read the dashboard from a mobile browser. */
        @media (max-width: 700px) {
          .dash-head { flex-direction: column; align-items: stretch !important; }
          .dash-filters { display: grid !important; grid-template-columns: 1fr 1fr; }
          .dash-presets { grid-column: 1 / -1; overflow-x: auto; scrollbar-width: none; }
          .dash-presets > button, .dash-interval > button { flex: 1; white-space: nowrap; }
          .dash-filters input[type="date"] { width: 100%; min-width: 0; }
          .dash-dash, .dash-sep { display: none; }
          .dash-branch, .dash-export { grid-column: 1 / -1; max-width: none !important; width: 100%; justify-content: center; }
          .dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .dash-hero { min-height: 0; padding: 16px; }
          .dash-hero-value { font-size: 24px !important; }
          .dash-stat { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px; }
          .dash-stat-icon { width: 30px; height: 30px; border-radius: 9px; }
          .dash-stat-icon svg { width: 15px; height: 15px; }
          .dash-stat-value { font-size: 16px !important; }
          .dash-change { height: 16px; padding: 0 5px; font-size: 10px; }
        }
      `}</style>
    </div>
  )
}
