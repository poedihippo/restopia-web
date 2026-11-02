'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort } from '@/utils/date';

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'
import { salesOrdersService } from '@/services/sales-orders.service'
import { fetchAllPages, isEmployeeCredit } from '@/utils/salesReport'
import { useAuth } from '@/hooks/useAuth'
import ReportBranchSelect, { useReportBranchName } from './ReportBranchSelect'
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

/** Outstanding credit: the API's remaining_payment, falling back to the total while still on credit. */
const getBalance = (o: any) => {
  if (o.remaining_payment != null) return Math.max(0, Number(o.remaining_payment))
  return o.settlement_status === 'credit' ? Number(o.total_price ?? 0) : 0
}

/** Who owes the credit: the employee for staff credit, otherwise the customer. */
const creditorName = (o: any) =>
  isEmployeeCredit(o)
    ? o.credit_by?.name ?? o.customer_name ?? '—'
    : o.customer?.name ?? o.customer_name ?? '—'

const getAging = (dateStr: string) => {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86400000,
  )
  return {
    days,
    bucket: days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3,
  }
}

export default function CreditReport() {
  const router = useRouter()
  const { user } = useAuth()
  const fmtRp = (v: number | null | undefined) => formatCurrency(v ?? 0)

  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [branchFilter, setBranchFilter] = useState('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [settlementFilter, setSettlementFilter] = useState<
    '' | 'credit' | 'settled' | 'cancelled'
  >('credit')
  const branchName = useReportBranchName(branchFilter)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'report-credit',
      dateFrom,
      dateTo,
      branchFilter,
      settlementFilter,
    ],
    queryFn: () =>
      fetchAllPages((page) =>
        salesOrdersService
          .list({
            page,
            per_page: 500,
            include: 'branch,customer,credit_by',
            // "All" = every credit sale regardless of settlement state.
            ...(settlementFilter
              ? { 'filter[settlement_status]': settlementFilter }
              : { 'filter[is_credit]': '1' }),
            'filter[date_gte]': dateFrom,
            'filter[date_lte]': dateTo,
            'filter[branch_id]': branchFilter || undefined,
            sort: 'date',
          } as any)
          .then((r) => r.data),
      ),
    enabled,
  })

  const orders: any[] = useMemo(() => data ?? [], [data])

  const totals = useMemo(() => {
    const buckets = [0, 0, 0, 0]
    let total = 0
    orders.forEach((o: any) => {
      const { bucket } = getAging(o.date)
      const balance = getBalance(o)
      buckets[bucket] += balance
      total += balance
    })
    return { buckets, total }
  }, [orders])

  const SETTLEMENT_FILTER_LABEL: Record<string, string> = {
    credit: 'Credit (unpaid)',
    settled: 'Settled',
    cancelled: 'Cancelled',
    '': 'All',
  }

  const handleExport = () => {
    if (!enabled || isLoading || orders.length === 0) {
      toast.error('Generate the report first')
      return
    }
    const rows: ExcelRow[] = [
      ...reportHeader({
        title: `CREDIT PER TRANSAKSI (${orders.length})`,
        branch: branchName,
        period: `${dateFrom} s/d ${dateTo}`,
        extra: [`Status Creditlist : ${SETTLEMENT_FILTER_LABEL[settlementFilter]}`],
      }),
      [
        'No', 'No Trx', 'Waktu Trx', 'Nama Customer / Karyawan', 'Remark', 'Phone', 'Jenis',
        'Balance', 'P1 (0-30)', 'P2 (31-60)', 'P3 (61-90)', 'P4 (>90)', 'Status',
      ],
    ]
    orders.forEach((order: any, idx: number) => {
      const balance = getBalance(order)
      const buckets = [0, 0, 0, 0]
      buckets[getAging(order.date).bucket] = balance
      const dt = order.created_at ? new Date(order.created_at) : null
      rows.push([
        idx + 1,
        order.code,
        `${order.date ? formatDateShort(order.date) : ''}${dt ? ' ' + dt.toLocaleTimeString('id-ID') : ''}`,
        creditorName(order),
        order.description ?? '',
        order.customer?.phone ?? order.customer_phone ?? '',
        isEmployeeCredit(order) ? 'Karyawan' : 'Customer',
        money(balance),
        ...buckets.map(money),
        balance <= 0
          ? 'Paid'
          : SETTLEMENT_META[order.settlement_status]?.label ?? order.settlement_status ?? '',
      ])
    })
    rows.push([
      '', '', '', '', '', '', 'TOTAL',
      money(totals.total),
      ...totals.buckets.map(money),
      '',
    ])
    downloadExcel(`credit-report-${dateFrom}_${dateTo}.xlsx`, [
      { name: 'Credit Report', rows, cols: [6, 30, 20, 30, 26, 16, 12, 16, 14, 14, 14, 14, 12] },
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
        <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleExport}
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
          Credit Receivable Report (Aging)
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
            <label style={labelStyle}>Settlement</label>
            <select
              value={settlementFilter}
              onChange={(e) =>
                setSettlementFilter(e.target.value as any)
              }
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="credit">Credit (unpaid)</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
              <option value="">All</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            <ReportBranchSelect
              value={branchFilter}
              onChange={setBranchFilter}
              style={inputStyle}
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
              Total Outstanding
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--foreground)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.total)}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Period 1 (0–30d)
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--success)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.buckets[0])}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Period 2 (31–60d)
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--warning)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.buckets[1])}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Period 3+ (&gt;60d)
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--destructive)',
                marginTop: 4,
              }}
            >
              {fmtRp(totals.buckets[2] + totals.buckets[3])}
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
              <th style={thStyle}>No Trx</th>
              <th style={thStyle}>Tanggal</th>
              <th style={thStyle}>Nama Customer / Karyawan</th>
              <th style={thStyle}>Remark</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Jenis</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>P1 (0–30)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>P2 (31–60)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>P3 (61–90)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>P4 (&gt;90)</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {!enabled && (
              <tr>
                <td colSpan={13} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Set filters and click Generate to load report.
                </td>
              </tr>
            )}
            {enabled && isLoading && (
              <tr>
                <td colSpan={13} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Loading...
                </td>
              </tr>
            )}
            {enabled && !isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={13} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  No credit orders for the selected period.
                </td>
              </tr>
            )}
            {orders.map((order: any, idx: number) => {
              const aging = getAging(order.date)
              const balance = getBalance(order)
              const bucketAmounts = [0, 0, 0, 0]
              bucketAmounts[aging.bucket] = balance
              const settle =
                balance <= 0
                  ? { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' }
                  : SETTLEMENT_META[order.settlement_status] ?? SETTLEMENT_META.pending
              const dt = order.created_at ? new Date(order.created_at) : null
              return (
                <tr key={order.id}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10 }}>
                    {order.code}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {order.date
                      ? formatDateShort(order.date)
                      : '—'}
                    {dt && (
                      <span style={{ color: 'var(--foreground-muted)', marginLeft: 6 }}>
                        {dt.toLocaleTimeString('id-ID')}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    {creditorName(order)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    {order.description ?? '—'}
                  </td>
                  <td style={tdStyle}>
                    {order.customer?.phone ?? order.customer_phone ?? '—'}
                  </td>
                  <td style={tdStyle}>{isEmployeeCredit(order) ? 'Karyawan' : 'Customer'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {fmtRp(balance)}
                  </td>
                  {bucketAmounts.map((amt, i) => (
                    <td
                      key={i}
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color: amt > 0 ? 'var(--warning)' : 'var(--foreground-subtle)',
                        fontWeight: amt > 0 ? 600 : 400,
                      }}
                    >
                      {amt > 0 ? fmtRp(amt) : '—'}
                    </td>
                  ))}
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
                </tr>
              )
            })}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--background)' }}>
                <td
                  colSpan={7}
                  style={{ ...tdStyle, fontWeight: 700, textAlign: 'right' }}
                >
                  TOTAL
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                  {fmtRp(totals.total)}
                </td>
                {totals.buckets.map((b, i) => (
                  <td
                    key={i}
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 700,
                      color: b > 0 ? 'var(--warning)' : 'var(--foreground-muted)',
                    }}
                  >
                    {b > 0 ? fmtRp(b) : '—'}
                  </td>
                ))}
                <td style={tdStyle} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
