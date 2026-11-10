'use client'
import { formatCurrency } from '@/utils/price';

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { getProductUomName } from '@/utils/productUomName'
import { parseApiDate, formatDateShort } from '@/utils/date'
import {
  ShoppingBag,
  Factory,
  PackageSearch,
  Boxes,
  CreditCard,
  ShieldOff,
  Wallet,
  Clock,
  AlertTriangle,
  CalendarClock,
  Trophy,
  ChevronRight,
  Plus,
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

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

function Skeleton({ w = '100%', h = 12 }: { w?: number | string; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 4,
        background: 'var(--border)',
        animation: 'dashboardPulse 1.4s ease-in-out infinite',
      }}
    />
  )
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
        fontWeight: 600,
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function Panel({
  title,
  icon: Icon,
  count,
  action,
  children,
}: {
  title: string
  icon: React.ElementType
  count?: number
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <section style={cardStyle}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon size={15} color="var(--accent-light)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
        {count != null && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: 999,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
            }}
          >
            {count}
          </span>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--accent)',
              cursor: 'pointer',
            }}
          >
            {action.label}
            <ChevronRight size={13} />
          </button>
        )}
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13, color: 'var(--foreground-subtle)' }}>
      {text}
    </div>
  )
}

function Forbidden({ what }: { what: string }) {
  return (
    <div style={{ padding: '28px 18px', textAlign: 'center' }}>
      <ShieldOff size={24} color="var(--border-strong)" />
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: 'var(--foreground-muted)' }}>Access restricted</div>
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
  const router = useRouter()

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
  const expiryRows = expiryTab === 'expiring' ? expiring : expired

  const collected = Number(metricsData?.sum_payments ?? 0)
  const pendingPay = Number(metricsData?.calculate_pending_payments ?? 0)
  const collectedPct = collected + pendingPay > 0 ? (collected / (collected + pendingPay)) * 100 : 0

  const activePreset = PRESETS.find((p) => p.from() === dateFrom && p.to() === dateTo)?.key

  const dateInputStyle: React.CSSProperties = {
    height: 32,
    padding: '0 8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const quickActions: Array<{ icon: React.ElementType; label: string; href: string }> = [
    { icon: ShoppingBag, label: 'New Sale', href: '/sales/sales-orders/create' },
    { icon: Factory, label: 'New Production', href: '/production/create' },
    { icon: PackageSearch, label: 'New Purchase Order', href: '/purchase/purchase-orders/create' },
    { icon: Boxes, label: 'Stock', href: '/products/product-inventory' },
    { icon: CreditCard, label: 'Payments', href: '/sales/payments' },
  ]

  const countTiles = [
    { label: 'Sales Orders', icon: ShoppingBag, value: metricsData?.count_final_sales_orders, hint: 'final orders', href: '/sales/sales-orders' },
    { label: 'Production', icon: Factory, value: metricsData?.count_final_production_details, hint: 'items produced', href: '/production' },
    { label: 'Purchase Orders', icon: PackageSearch, value: metricsData?.count_final_purchase_orders, hint: 'final orders', href: '/purchase/purchase-orders' },
  ]

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 18px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  }

  const listSkeleton = (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} w={`${90 - i * 8}%`} />
      ))}
    </div>
  )

  return (
    <div className="dash" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1360, margin: '0 auto', width: '100%' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {PRESETS.map((p) => {
              const active = activePreset === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setDateFrom(p.from())
                    setDateTo(p.to())
                  }}
                  style={{
                    height: 26,
                    padding: '0 10px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--foreground-muted)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} style={dateInputStyle} aria-label="From" />
          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>–</span>
          <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} style={dateInputStyle} aria-label="To" />
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {quickActions.map(({ icon: Icon, label, href }, i) => (
          <button
            key={href}
            type="button"
            onClick={() => router.push(href)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              background: i === 0 ? 'var(--accent)' : 'var(--surface)',
              color: i === 0 ? '#fff' : 'var(--foreground)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {i < 3 ? <Plus size={13} /> : <Icon size={13} />}
            {label.replace(/^New /, '')}
          </button>
        ))}
      </div>

      {/* ── KPIs ── */}
      {metricsForbidden ? (
        <section style={cardStyle}>
          <Forbidden what="dashboard metrics (dashboard.read)" />
        </section>
      ) : (
        <div className="dash-kpis">
          {/* Payments: collected vs pending */}
          <section style={{ ...cardStyle, padding: 18, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={15} color="var(--accent-light)" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>Payments received</span>
            </div>
            {isMetricsLoading ? (
              <Skeleton w={180} h={30} />
            ) : (
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {formatRp(collected)}
              </span>
            )}
            <div style={{ height: 8, borderRadius: 999, background: 'var(--warning-bg)', overflow: 'hidden' }}>
              <div style={{ width: `${collectedPct}%`, height: '100%', background: 'var(--success)', borderRadius: 999, transition: 'width 300ms ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--foreground-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)' }} />
                Collected {collectedPct.toFixed(0)}%
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--foreground-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning)' }} />
                Pending <strong style={{ color: 'var(--warning)', fontWeight: 600 }}>{formatRp(pendingPay)}</strong>
              </span>
            </div>
          </section>

          {countTiles.map(({ label, icon: Icon, value, hint, href }) => (
            <button
              key={label}
              type="button"
              onClick={() => router.push(href)}
              style={{ ...cardStyle, padding: 18, gap: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>{label}</span>
                <span style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--accent-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color="var(--accent-light)" />
                </span>
              </div>
              {isMetricsLoading ? (
                <Skeleton w={70} h={30} />
              ) : (
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>{formatNum(value ?? 0)}</span>
              )}
              <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>{hint} in period</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Orders + top sellers ── */}
      <div className="dash-row-2">
        <Panel
          title="Recent Sales Orders"
          icon={ShoppingBag}
          action={{ label: 'View all', onClick: () => router.push('/sales/sales-orders') }}
        >
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : isInsightsLoading ? (
            listSkeleton
          ) : recentOrders.length === 0 ? (
            <EmptyRow text="No recent orders" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Order', 'Customer', 'Date', 'Payment', 'Total'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '9px 18px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--foreground-muted)',
                          background: 'var(--background)',
                          borderBottom: '1px solid var(--border)',
                          textAlign: h === 'Total' ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.slice(0, 8).map((o: any) => {
                    const pm = PAYMENT_META[o.payment_status as string]
                    return (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/sales/sales-orders/${o.id}/detail`)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                          {o.code}
                        </td>
                        <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--foreground)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.customer_name || o.customer?.name || 'Walk-in'}
                        </td>
                        <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateShort(o.date)}
                        </td>
                        <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                          {pm ? <Badge {...pm} /> : <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--foreground)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {formatRp(o.total_price)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Top Selling" icon={Trophy} count={topSold.length || undefined}>
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
                  <div key={o.id ?? i} style={{ padding: '8px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--foreground-subtle)' }}>{i + 1}</span>
                      <span title={inventoryName(o)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>
                        {inventoryName(o)}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--foreground)', flexShrink: 0 }}>{formatNum(sold)}</span>
                    </div>
                    <div style={{ marginLeft: 28, height: 6, borderRadius: 999, background: 'var(--background)', overflow: 'hidden' }}>
                      <div style={{ width: `${(sold / topMax) * 100}%`, height: '100%', borderRadius: 999, background: i < 3 ? 'var(--accent-light)' : 'var(--border-strong)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Alerts ── */}
      <div className="dash-row-3">
        <Panel
          title="Pending Fulfillment"
          icon={CalendarClock}
          count={insightsForbidden ? undefined : pendingFulfillment.length}
          action={{ label: 'Orders', onClick: () => router.push('/sales/sales-orders') }}
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
              return (
                <div
                  key={o.id}
                  onClick={() => router.push(`/sales/sales-orders/${o.id}/detail`)}
                  style={{ ...rowStyle, cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{o.code}</div>
                    <div style={{ fontSize: 12, color: 'var(--foreground-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.customer_name || o.customer?.name || 'Walk-in'} · {formatDateShort(o.fulfillment_date)}
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
          count={insightsForbidden ? undefined : lowStock.length}
          action={{ label: 'Stock', onClick: () => router.push('/products/product-inventory') }}
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
                <div key={o.id ?? i} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div title={inventoryName(o)} style={{ color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inventoryName(o)}
                    </div>
                    {batchCodeOf(o) && <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>{batchCodeOf(o)}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: stock <= 0 ? 'var(--destructive)' : 'var(--warning)', flexShrink: 0 }}>
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
          count={insightsForbidden ? undefined : expiring.length + expired.length}
        >
          {insightsForbidden ? (
            <Forbidden what="insights" />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0' }}>
                {([
                  ['expiring', `Expiring soon (${expiring.length})`],
                  ['expired', `Expired (${expired.length})`],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setExpiryTab(k)}
                    style={{
                      height: 26,
                      padding: '0 10px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: expiryTab === k ? 'var(--foreground)' : 'var(--surface)',
                      color: expiryTab === k ? 'var(--surface)' : 'var(--foreground-muted)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
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
                    <div key={o.id ?? i} style={rowStyle}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div title={inventoryName(o)} style={{ color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inventoryName(o)}
                        </div>
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

      <style>{`
        @keyframes dashboardPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .dash-kpis { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)); gap: 16px; }
        .dash-row-2 { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        .dash-row-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
        @media (max-width: 1100px) {
          .dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dash-row-2, .dash-row-3 { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </div>
  )
}
