'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { salesOrdersService } from '@/services/sales-orders.service'
import { useAuth } from '@/hooks/useAuth'

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}
const today = () => new Date().toISOString().split('T')[0]
const fmtRp = (v: number | null | undefined) =>
  'Rp ' + Number(v ?? 0).toLocaleString('id-ID')

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

const parseVoucher = (snap: any) => {
  if (!snap) return null
  try {
    return typeof snap === 'string' ? JSON.parse(snap) : snap
  } catch {
    return null
  }
}

export default function DiscountVoucherReport() {
  const router = useRouter()
  const { user, isSuperadmin } = useAuth()

  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [branchFilter, setBranchFilter] = useState('')
  const [enabled, setEnabled] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['report-discount-voucher', dateFrom, dateTo, branchFilter],
    queryFn: () =>
      salesOrdersService
        .list({
          per_page: 500,
          include: 'branch,customer',
          'filter[status]': 'final',
          'filter[date_gte]': dateFrom,
          'filter[date_lte]': dateTo,
          'filter[branch_id]': branchFilter || undefined,
          sort: 'date',
        } as any)
        .then((r) => r.data),
    enabled,
  })

  const filtered = useMemo(() => {
    const rows: any[] = (data as any)?.data ?? []
    return rows.filter(
      (o: any) => Number(o.discount_price ?? 0) > 0 || o.voucher_id,
    )
  }, [data])

  const totalDiscount = filtered.reduce(
    (s: number, o: any) => s + Number(o.discount_price ?? 0),
    0,
  )
  const ordersWithVoucher = filtered.filter((o: any) => o.voucher_id).length
  const ordersWithDiscountOnly = filtered.filter((o: any) => !o.voucher_id).length
  const totalOrders = filtered.reduce(
    (s: number, o: any) => s + Number(o.total_price ?? 0),
    0,
  )

  const onGenerate = () => {
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
          Discount &amp; Voucher Report
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
          style={{ fontSize: 11, color: 'var(--foreground-muted)', display: 'block' }}
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
              Transactions w/ Discount
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--foreground)',
                marginTop: 4,
              }}
            >
              {filtered.length}
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
              {fmtRp(totalDiscount)}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Orders with Voucher
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--info)',
                marginTop: 4,
              }}
            >
              {ordersWithVoucher}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Discount Only
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--accent)',
                marginTop: 4,
              }}
            >
              {ordersWithDiscountOnly}
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
              <th style={thStyle}>Customer</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Discount Rp</th>
              <th style={thStyle}>Voucher Code</th>
              <th style={thStyle}>Voucher Type</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Voucher Value</th>
              <th style={thStyle}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {!enabled && (
              <tr>
                <td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Set filters and click Generate to load report.
                </td>
              </tr>
            )}
            {enabled && isLoading && (
              <tr>
                <td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Loading...
                </td>
              </tr>
            )}
            {enabled && !isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  No discount or voucher transactions for the selected period.
                </td>
              </tr>
            )}
            {filtered.map((order: any, idx: number) => {
              const vSnap = parseVoucher(order.voucher_snapshot)
              const dt = order.created_at ? new Date(order.created_at) : null
              const valueDisplay =
                vSnap?.discount_type === 'percent'
                  ? `${vSnap.discount_value}%`
                  : vSnap?.discount_value
                    ? fmtRp(vSnap.discount_value)
                    : '—'
              return (
                <tr key={order.id}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={tdStyle}>{order.branch?.name ?? '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {order.date
                      ? new Date(order.date).toLocaleDateString('id-ID')
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {dt ? dt.toLocaleTimeString('id-ID') : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10 }}>
                    {order.code}
                  </td>
                  <td style={tdStyle}>
                    {order.customer?.name ?? order.customer_name ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {fmtRp(order.total_price)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color: 'var(--destructive)',
                      fontWeight: 600,
                    }}
                  >
                    {Number(order.discount_price ?? 0) > 0
                      ? fmtRp(order.discount_price)
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10 }}>
                    {vSnap?.code ?? '—'}
                  </td>
                  <td style={tdStyle}>
                    {vSnap?.discount_type === 'percent'
                      ? '%'
                      : vSnap?.discount_type === 'fixed'
                        ? 'Fixed'
                        : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{valueDisplay}</td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--foreground-muted)' }}>
                    {order.description ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--background)' }}>
                <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, textAlign: 'right' }}>
                  TOTAL
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totalOrders)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    color: 'var(--destructive)',
                  }}
                >
                  {fmtRp(totalDiscount)}
                </td>
                <td colSpan={4} style={tdStyle} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: 'var(--foreground-muted)',
          fontStyle: 'italic',
        }}
      >
        * Compliment and Spoiled data are not available in the current system version.
      </div>
    </div>
  )
}
