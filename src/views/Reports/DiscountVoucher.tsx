'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort } from '@/utils/date';

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'
import { fetchFinalSalesOrders } from '@/utils/salesReport'
import { useAuth } from '@/hooks/useAuth'
import ReportBranchSelect, { useReportBranchName } from './ReportBranchSelect'
const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}
const today = () => new Date().toLocaleDateString('en-CA')

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
  const { user } = useAuth()
  const fmtRp = (v: number | null | undefined) => formatCurrency(v ?? 0)

  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [branchFilter, setBranchFilter] = useState('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [enabled, setEnabled] = useState(false)
  // filter[search]: order code, customer name or phone (server-side).
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])
  const branchName = useReportBranchName(branchFilter)

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['report-discount-voucher', dateFrom, dateTo, branchFilter, debouncedSearch],
    queryFn: () =>
      fetchFinalSalesOrders({
        dateFrom,
        dateTo,
        branchId: branchFilter,
        search: debouncedSearch,
        include: 'branch,customer',
      }),
    enabled,
  })

  const filtered = useMemo(() => {
    const rows: any[] = data ?? []
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

  const voucherTypeLabel = (v: any) =>
    v?.discount_type === 'percent' ? '%' : v?.discount_type === 'fixed' ? 'Fixed' : '—'

  const handleExport = () => {
    if (!enabled || isLoading || filtered.length === 0) {
      toast.error('Generate the report first')
      return
    }
    const rows: ExcelRow[] = [
      ...reportHeader({
        title: 'Discount & Voucher Report',
        branch: branchName,
        period: `${dateFrom} s/d ${dateTo}`,
        extra: [
          `Transactions w/ Discount : ${filtered.length}`,
          `Orders with Voucher : ${ordersWithVoucher}`,
          `Discount Only : ${ordersWithDiscountOnly}`,
        ],
      }),
      [
        'No', 'Outlet', 'Tanggal', 'Waktu', 'No Trx', 'Customer', 'Total', 'Discount Rp',
        'Voucher Code', 'Voucher Type', 'Voucher Value', 'Remark',
      ],
      ...filtered.map((order: any, idx: number) => {
        const vSnap = parseVoucher(order.voucher_snapshot)
        const dt = order.created_at ? new Date(order.created_at) : null
        return [
          idx + 1,
          order.branch?.name ?? '',
          order.date ? formatDateShort(order.date) : '',
          dt ? dt.toLocaleTimeString('id-ID') : '',
          order.code,
          order.customer?.name ?? order.customer_name ?? '',
          money(order.total_price),
          money(order.discount_price),
          vSnap?.code ?? '',
          voucherTypeLabel(vSnap),
          vSnap?.discount_type === 'percent'
            ? `${vSnap.discount_value}%`
            : vSnap?.discount_value
              ? money(vSnap.discount_value)
              : '',
          order.description ?? '',
        ]
      }),
      ['', '', '', '', '', 'TOTAL', money(totalOrders), money(totalDiscount)],
    ]
    downloadExcel(`discount-voucher-${dateFrom}_${dateTo}.xlsx`, [
      { name: 'Discount & Voucher', rows, cols: [6, 20, 12, 10, 30, 24, 14, 14, 16, 12, 14, 30] },
    ])
  }

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
          thead { background: none !important; }
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
        <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={false}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Download size={14} />
          Export Excel
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
          {branchName}
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
          <div>
            <label style={labelStyle}>Branch</label>
            <ReportBranchSelect
              value={branchFilter}
              onChange={setBranchFilter}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '1 1 200px', maxWidth: 300 }}>
            <label style={labelStyle}>Search</label>
            <input
              type="search"
              data-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order code, customer or phone…"
              style={{ ...inputStyle, width: '100%' }}
            />
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
                      ? formatDateShort(order.date)
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
                    {voucherTypeLabel(vSnap)}
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
