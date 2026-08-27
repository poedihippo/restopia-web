'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort } from '@/utils/date';

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
  const [perPage, setPerPage] = useState(1000)
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
          include: 'branch,customer,credit_by,created_by',
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
              <th style={thStyle}>No</th>
              <th style={thStyle}>Outlet</th>
              <th style={thStyle}>Tanggal</th>
              <th style={thStyle}>Waktu</th>
              <th style={thStyle}>No Trx</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Disc Rp</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Netto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total Bayar</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Settlement</th>
              <th style={thStyle}>Credit By</th>
              <th style={thStyle}>Customer</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              <th style={thStyle}>Kasir</th>
            </tr>
          </thead>
          <tbody>
            {!enabled && (
              <tr>
                <td colSpan={15} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Set filters and click Generate to load report.
                </td>
              </tr>
            )}
            {enabled && isLoading && (
              <tr>
                <td colSpan={15} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Loading...
                </td>
              </tr>
            )}
            {enabled && !isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={15} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  No transactions for the selected period.
                </td>
              </tr>
            )}
            {orders.map((order: any, idx: number) => {
              const settle = SETTLEMENT_META[order.settlement_status] ?? SETTLEMENT_META.pending
              const status = STATUS_META[order.status] ?? STATUS_META.draft
              const dt = order.created_at ? new Date(order.created_at) : null
              return (
                <tr key={order.id}>
                  <td style={tdStyle}>{(page - 1) * 100 + idx + 1}</td>
                  <td style={tdStyle}>{order.branch?.name ?? '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {order.date
                      ? formatDateShort(order.date)
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {dt ? dt.toLocaleTimeString('id-ID') : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10 }}>
                    {order.code}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {fmtRp(order.subtotal_price)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color: 'var(--destructive)',
                    }}
                  >
                    {Number(order.discount_price ?? 0) > 0
                      ? '- ' + fmtRp(order.discount_price)
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {fmtRp(order.total_price)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {fmtRp(order.total_payment)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 10,
                        fontWeight: 600,
                        background: settle.bg,
                        color: settle.color,
                      }}
                    >
                      {settle.label}
                    </span>
                  </td>
                  <td style={tdStyle}>{order.credit_by?.name ?? '—'}</td>
                  <td style={tdStyle}>
                    {order.customer?.name ?? order.customer_name ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 10,
                        fontWeight: 600,
                        background:
                          order.type === 'online' ? 'var(--info-bg)' : 'var(--accent-light-bg)',
                        color: order.type === 'online' ? 'var(--info)' : 'var(--accent)',
                      }}
                    >
                      {order.type ?? '—'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
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
                  </td>
                  <td style={tdStyle}>{order.created_by?.name ?? '—'}</td>
                </tr>
              )
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
                  - {fmtRp(totals.disc)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totals.netto)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totals.payment)}
                </td>
                <td colSpan={6} style={tdStyle} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
    </div>
  )
}
