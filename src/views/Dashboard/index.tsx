'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  PackageSearch,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  CreditCard,
  ShieldOff,
} from 'lucide-react'

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}
const todayStr = () => new Date().toISOString().split('T')[0]

const formatRp = (n: number | undefined | null): string => {
  if (n === undefined || n === null) return 'Rp 0'
  return 'Rp ' + Number(n).toLocaleString('id-ID')
}
const formatNum = (n: number | undefined | null): string => {
  if (n === undefined || n === null) return '0'
  return Number(n).toLocaleString('id-ID')
}

type CardConfig = {
  label: string
  icon: React.ElementType
  value: string
  deltaIcon: React.ElementType
  deltaColor: string
  deltaValue: string
  description: string
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
          'filter[created_at_gte]': dateFrom,
          'filter[created_at_lte]': dateTo,
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

  const cards: CardConfig[] = [
    {
      label: 'Total Sales',
      icon: ShoppingBag,
      value: formatRp(
        metricsData?.total_sales ??
          metricsData?.sales_total ??
          metricsData?.total_revenue ??
          0
      ),
      deltaIcon: ArrowUpRight,
      deltaColor: 'var(--success)',
      deltaValue:
        formatNum(metricsData?.total_orders ?? metricsData?.sales_count ?? 0) +
        ' orders',
      description: 'in selected period',
    },
    {
      label: 'Productions',
      icon: Factory,
      value: formatNum(
        metricsData?.total_productions ?? metricsData?.productions_count ?? 0
      ),
      deltaIcon: ArrowUpRight,
      deltaColor: 'var(--foreground-muted)',
      deltaValue: formatNum(metricsData?.pending_productions ?? 0) + ' pending',
      description: 'batches this period',
    },
    {
      label: 'Purchase Orders',
      icon: PackageSearch,
      value: formatNum(
        metricsData?.total_purchase_orders ??
          metricsData?.purchase_orders_count ??
          0
      ),
      deltaIcon: ArrowDownRight,
      deltaColor: 'var(--warning)',
      deltaValue:
        formatNum(metricsData?.pending_purchase_orders ?? 0) + ' pending',
      description: 'awaiting fulfillment',
    },
    {
      label: 'Total Payments',
      icon: CreditCard,
      value: formatRp(
        metricsData?.total_payments ?? metricsData?.payments_total ?? 0
      ),
      deltaIcon: ArrowUpRight,
      deltaColor: 'var(--foreground-muted)',
      deltaValue: formatNum(metricsData?.payments_count ?? 0) + ' transactions',
      description: 'received this period',
    },
  ]

  const dateInputStyle: React.CSSProperties = {
    padding: '5px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const quickActions: Array<{
    icon: React.ElementType
    label: string
    href: string
  }> = [
    { icon: ShoppingBag, label: 'New Sale', href: '/sales/sales-orders/create' },
    { icon: Factory, label: 'New Production', href: '/production/create' },
    {
      icon: PackageSearch,
      label: 'New Purchase Order',
      href: '/purchase/purchase-orders/create',
    },
    { icon: Boxes, label: 'View Stock', href: '/products/product-inventory' },
    { icon: CreditCard, label: 'View Payments', href: '/sales/payments' },
  ]

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 1280,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Real-time overview of your operations
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--foreground-muted)',
              fontWeight: 500,
            }}
          >
            <TrendingUp size={13} color="var(--accent-light)" />
            <span>
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics cards (or 403 access-denied state) */}
      {metricsForbidden ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 48,
            textAlign: 'center',
          }}
        >
          <ShieldOff size={32} color="var(--border)" />
          <span
            style={{
              display: 'block',
              marginTop: 12,
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--foreground-muted)',
            }}
          >
            Access Restricted
          </span>
          <span
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 13,
              color: 'var(--foreground-subtle)',
            }}
          >
            You don&apos;t have permission to view dashboard metrics. Contact your admin to grant dashboard.read permission.
          </span>
        </div>
      ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {cards.map((card) => {
          const Icon = card.icon
          const DeltaIcon = card.deltaIcon
          return (
            <div
              key={card.label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
                  {card.label}
                </span>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    background: 'var(--accent-light-bg)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color="var(--accent-light)" />
                </div>
              </div>

              {isMetricsLoading ? (
                <div
                  style={{
                    height: 28,
                    width: 120,
                    borderRadius: 4,
                    background: 'var(--border)',
                    animation: 'dashboardPulse 1.4s ease-in-out infinite',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {card.value}
                </span>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DeltaIcon size={13} color={card.deltaColor} />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: card.deltaColor,
                  }}
                >
                  {card.deltaValue}
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                  {card.description}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* Insights + Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Insights */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Business Insights
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              {isInsightsLoading ? 'Loading…' : 'Based on all time data'}
            </span>
          </div>
          <div style={{ padding: 20 }}>
            {insightsForbidden ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <ShieldOff size={28} color="var(--border)" />
                <span
                  style={{
                    display: 'block',
                    marginTop: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Access Restricted
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 4,
                    fontSize: 12,
                    color: 'var(--foreground-subtle)',
                  }}
                >
                  You don&apos;t have permission to view dashboard insights.
                </span>
              </div>
            ) : insightsData && Object.keys(insightsData).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(insightsData)
                  .slice(0, 8)
                  .map(([key, value]) => {
                    const title = key.replace(/_/g, ' ')

                    // Best-effort label + numeric extraction from an
                    // unknown object shape. Falls back to JSON for
                    // unrecognized objects so nothing renders as
                    // "[object Object]".
                    const labelOf = (o: any): string => {
                      if (o == null) return '—'
                      if (typeof o !== 'object') return String(o)
                      return (
                        o.name ??
                        o.code ??
                        o.title ??
                        o.label ??
                        o.product?.name ??
                        o.product_uom?.product?.name ??
                        o.sales_order?.code ??
                        (o.id != null ? `#${o.id}` : JSON.stringify(o))
                      )
                    }
                    const metricOf = (o: any): string | null => {
                      if (o == null || typeof o !== 'object') return null
                      if (typeof o.qty === 'number') return o.qty.toLocaleString('id-ID')
                      if (typeof o.stock === 'number')
                        return `Stock ${o.stock.toLocaleString('id-ID')}`
                      if (typeof o.total_sold === 'number')
                        return `Sold ${o.total_sold.toLocaleString('id-ID')}`
                      if (typeof o.total_price === 'number')
                        return `Rp ${o.total_price.toLocaleString('id-ID')}`
                      if (typeof o.amount === 'number')
                        return `Rp ${o.amount.toLocaleString('id-ID')}`
                      if (typeof o.count === 'number')
                        return o.count.toLocaleString('id-ID')
                      if (o.expiry_date) return `Exp ${String(o.expiry_date).slice(0, 10)}`
                      return null
                    }

                    // Scalar
                    if (!Array.isArray(value) && typeof value !== 'object') {
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: 'var(--foreground-muted)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {title}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                            }}
                          >
                            {typeof value === 'number'
                              ? value.toLocaleString('id-ID')
                              : String(value ?? '—')}
                          </span>
                        </div>
                      )
                    }

                    // Array of objects (or array of scalars)
                    const arr = Array.isArray(value)
                      ? value
                      : [value]
                    const visible = arr.slice(0, 5)
                    const overflow = arr.length - visible.length
                    return (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--foreground-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: 0.6,
                            }}
                          >
                            {title}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 99,
                              background: 'var(--background)',
                              border: '1px solid var(--border)',
                              color: 'var(--foreground-muted)',
                              fontWeight: 600,
                            }}
                          >
                            {arr.length}
                          </span>
                        </div>
                        {arr.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                            None
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {visible.map((row, i) => {
                              const metric = metricOf(row)
                              return (
                                <div
                                  key={i}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '6px 0',
                                    borderBottom:
                                      i < visible.length - 1
                                        ? '1px solid var(--border)'
                                        : 'none',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: 'var(--foreground)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      minWidth: 0,
                                      flex: 1,
                                    }}
                                    title={labelOf(row)}
                                  >
                                    {labelOf(row)}
                                  </span>
                                  {metric && (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: 'var(--accent)',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {metric}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                            {overflow > 0 && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--foreground-subtle)',
                                  marginTop: 4,
                                }}
                              >
                                +{overflow} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            ) : !isInsightsLoading ? (
              <div
                style={{
                  padding: '24px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
                  No insights available
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 14,
                      borderRadius: 4,
                      background: 'var(--border)',
                      animation: 'dashboardPulse 1.4s ease-in-out infinite',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Quick Actions
            </span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column' }}>
            {quickActions.map(({ icon: Icon, label, href }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--background)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  fontWeight: 400,
                  transition: 'background 150ms ease',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    background: 'var(--accent-light-bg)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} color="var(--accent-light)" />
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dashboardPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
