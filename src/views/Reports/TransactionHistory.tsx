'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort, parseApiDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { salesOrdersService } from '@/services/sales-orders.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
const SETTLEMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  credit: { label: 'Credit', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'var(--foreground-muted)', bg: 'var(--background)' },
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  final: { label: 'Final', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}
const today = () => new Date().toISOString().split('T')[0]

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  marginBottom: 4,
  display: 'block',
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground)',
  background: 'var(--background)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 11,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}

const statCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px 16px',
}

export default function TransactionHistoryReport() {
  const router = useRouter()
  const { user, isSuperadmin } = useAuth()
  const fmtRp = (v: number | null | undefined) => formatCurrency(v ?? 0)

  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [branchFilter, setBranchFilter] = useState('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'' | 'offline' | 'online'>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'report-tx-history',
      dateFrom,
      dateTo,
      branchFilter,
      typeFilter,
      page, perPage,
    ],
    queryFn: () =>
      salesOrdersService
        .list({
          page,
          per_page: perPage,
          include: 'branch,customer,credit_by,created_by,sales_order_details,sales_channel',
          'filter[status]': 'final',
          'filter[date_gte]': dateFrom,
          'filter[date_lte]': dateTo,
          'filter[branch_id]': branchFilter || undefined,
          'filter[type]': typeFilter || undefined,
          sort: 'date',
        } as any)
        .then((r) => r.data),
    enabled,
  })

  const orders: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const totals = orders.reduce(
    (acc, o) => {
      acc.bruto += Number(o.subtotal_price ?? 0)
      acc.disc += Number(o.discount_price ?? 0)
      acc.netto += Number(o.total_price ?? 0)
      acc.payment += Number(o.total_payment ?? 0)
      return acc
    },
    { bruto: 0, disc: 0, netto: 0, payment: 0 },
  )

  const onGenerate = () => {
    setPage(1)
    setEnabled(true)
    refetch()
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 24px 48px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px; margin: 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
          thead { background: #f0f0f0 !important; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      <div
        style={{
          textAlign: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            display: 'block',
            color: 'var(--foreground)',
          }}
        >
          Dapur Cokelat Indonesia
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--foreground-muted)',
            display: 'block',
            marginTop: 2,
          }}
        >
          {(user as any)?.branch?.name ?? 'All Branches'}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            display: 'block',
            marginTop: 6,
            color: 'var(--foreground)',
          }}
        >
          History Transaksi (Transaction History)
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--foreground-muted)',
            display: 'block',
            marginTop: 2,
          }}
        >
          Period: {dateFrom} s/d {dateTo}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--foreground-muted)',
            display: 'block',
          }}
        >
          Printed: {new Date().toLocaleString('id-ID')}
        </span>
      </div>

      <div
        className="no-print"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <label style={labelStyle}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
            />
          </div>
          {isSuperadmin && (
            <div>
              <label style={labelStyle}>Branch ID</label>
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="All branches"
                style={{ ...inputStyle, width: 120 }}
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>Type</label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as '' | 'offline' | 'online')
              }
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">All</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            style={{
              padding: '7px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isFetching ? 'Loading...' : 'Generate'}
          </button>
        </div>
      </div>

      {enabled && (
        <div
          className="no-print"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Total Transactions
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--foreground)',
                marginTop: 4,
              }}
            >
              {orders.length}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Total Bruto
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--foreground)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.bruto)}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Total Discount
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--destructive)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.disc)}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Total Netto
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--success)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.netto)}
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            background: 'var(--surface)',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 36 }}>No</th>
              <th style={thStyle}>Outlet</th>
              <th style={thStyle}>Tanggal</th>
              <th style={thStyle}>Waktu</th>
              <th style={thStyle}>No Trx</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Disc</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Netto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bayar</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Sales Channel</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              <th style={thStyle}>Kasir</th>
              <th style={{ ...thStyle, width: 90 }}>Item Code</th>
              <th style={thStyle}>Produk</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Harga</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 48 }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {!enabled && (
              <tr>
                <td colSpan={17} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Set filters and click Generate to load report.
                </td>
              </tr>
            )}
            {enabled && isLoading && (
              <tr>
                <td colSpan={17} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Loading...
                </td>
              </tr>
            )}
            {enabled && !isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={17} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  No transactions for the selected period.
                </td>
              </tr>
            )}
            {orders.map((order: any, idx: number) => {
              const status = STATUS_META[order.status] ?? STATUS_META.draft
              const dt = parseApiDate(order.created_at)
              const details: any[] = order.sales_order_details ?? []
              const rowCount = Math.max(details.length, 1)
              const orderNo = (page - 1) * perPage + idx + 1

              return Array.from({ length: rowCount }).map((_, rowIdx) => {
                const d = details[rowIdx]
                const pis = d?.product_inventory_snapshot
                const bs = d?.bundle_snapshot
                const prod = pis?.product_uom_batch?.product_uom?.product
                const itemName =
                  prod?.name ??
                  bs?.name ??
                  pis?.name ??
                  (d?.bundle_id
                    ? `Bundle #${d.bundle_id}`
                    : d
                      ? `Item #${d.product_inventory_id ?? '-'}`
                      : '')
                const itemCode = prod?.code ?? bs?.code ?? pis?.code ?? ''
                const qty = Number(d?.qty ?? 0)
                const price = Number(d?.price ?? 0)
                const isFirst = rowIdx === 0
                const cellTop: React.CSSProperties = { ...tdStyle, verticalAlign: 'top' }
                const cellRight: React.CSSProperties = {
                  ...tdStyle,
                  textAlign: 'right',
                  verticalAlign: 'top',
                }

                return (
                  <tr
                    key={`${order.id}-${rowIdx}`}
                    style={rowIdx > 0 ? { background: 'var(--background)' } : undefined}
                  >
                    <td style={cellTop}>{isFirst ? orderNo : ''}</td>
                    <td style={cellTop}>{isFirst ? (order.branch?.name ?? '—') : ''}</td>
                    <td style={{ ...cellTop, whiteSpace: 'nowrap' }}>
                      {isFirst ? (order.date ? formatDateShort(order.date) : '—') : ''}
                    </td>
                    <td style={{ ...cellTop, whiteSpace: 'nowrap' }}>
                      {isFirst ? (dt ? dt.toLocaleTimeString('id-ID') : '—') : ''}
                    </td>
                    <td style={{ ...cellTop, fontFamily: 'monospace', fontSize: 10 }}>
                      {isFirst ? order.code : ''}
                    </td>
                    <td style={cellRight}>{isFirst ? fmtRp(order.subtotal_price) : ''}</td>
                    <td
                      style={{
                        ...cellRight,
                        color: 'var(--destructive)',
                      }}
                    >
                      {isFirst
                        ? Number(order.discount_price ?? 0) > 0
                          ? '- ' + fmtRp(order.discount_price)
                          : '—'
                        : ''}
                    </td>
                    <td style={{ ...cellRight, fontWeight: 600 }}>
                      {isFirst ? fmtRp(order.total_price) : ''}
                    </td>
                    <td style={cellRight}>{isFirst ? fmtRp(order.total_payment) : ''}</td>
                    <td style={cellTop}>
                      {isFirst
                        ? order.customer?.name ?? order.customer_name ?? '—'
                        : ''}
                    </td>
                     <td style={cellTop}>
                      {isFirst
                        ? order.sales_channel?.name ?? order.sales_channel.name ?? '—'
                        : ''}
                    </td>
                    <td style={{ ...cellTop, textAlign: 'center' }}>
                      {isFirst ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 600,
                            background:
                              order.type === 'online'
                                ? 'var(--info-bg)'
                                : 'var(--accent-light-bg)',
                            color: order.type === 'online' ? 'var(--info)' : 'var(--accent)',
                          }}
                        >
                          {order.type ?? '—'}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td style={{ ...cellTop, textAlign: 'center' }}>
                      {isFirst ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 600,
                            background: status.bg,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td style={cellTop}>
                      {isFirst ? (order.created_by?.name ?? '—') : ''}
                    </td>
                    <td style={{ ...cellTop, fontFamily: 'monospace', fontSize: 10 }}>
                      {d ? itemCode || '—' : ''}
                    </td>
                    <td style={cellTop}>{d ? itemName : ''}</td>
                    <td style={cellRight}>{d ? fmtRp(price) : ''}</td>
                    <td style={cellRight}>{d ? qty : ''}</td>
                  </tr>
                )
              })
            })}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--background)' }}>
                <td colSpan={5} style={{ ...tdStyle, fontWeight: 700, textAlign: 'right' }}>
                  TOTAL
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totals.bruto)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    color: 'var(--destructive)',
                  }}
                >
                  {Number(totals.disc) > 0 ? '- ' + fmtRp(totals.disc) : fmtRp(0)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totals.netto)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totals.payment)}
                </td>
                <td colSpan={8} style={tdStyle} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
    </div>
  )
}
