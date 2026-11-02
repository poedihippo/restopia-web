'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort, parseApiDate } from '@/utils/date';

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Printer, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { salesOrdersService } from '@/services/sales-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'
import ReportBranchSelect, { useReportBranchName } from './ReportBranchSelect'
import {
  fetchAllPages,
  fetchPeriodPayments,
  flattenSalesOrderAllocations,
  resolveDetailItem,
  voucherCode,
  type OrderAllocation,
  type DetailItem,
} from '@/utils/salesReport'
const firstOfMonth = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0]
const today = () => new Date().toISOString().split('T')[0]

const PAYMENT_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  partial: { label: 'Partial', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
}

const SETTLEMENT_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: 'Pending',
    color: 'var(--foreground-muted)',
    bg: 'var(--background)',
  },
  credit: { label: 'Credit', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

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

const tdBase: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
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

const accentBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  height: 36,
}

const ghostBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  cursor: 'pointer',
}

const Badge: React.FC<{ meta: { label: string; color: string; bg: string } }> = ({
  meta,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 11,
      fontWeight: 600,
      color: meta.color,
      background: meta.bg,
    }}
  >
    {meta.label}
  </span>
)

export default function SalesByInvoiceReport() {
  const router = useRouter()
  const { user } = useAuth()
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth())
  const [dateTo, setDateTo] = useState<string>(today())
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const branchName = useReportBranchName(branchFilter)
  const [enabled, setEnabled] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [perPage] = useState<number>(20)
  const [view, setView] = useState<'detail' | 'list'>('detail')

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading } = useQuery({
    queryKey: [
      'report-sales-invoice',
      dateFrom,
      dateTo,
      branchFilter,
      page, perPage,
    ],
    queryFn: () =>
      salesOrdersService
        .list({
          page,
          per_page: perPage,
          include: 'branch,customer,credit_by,created_by,sales_order_details',
          'filter[status]': 'final',
          'filter[date_gte]': dateFrom,
          'filter[date_lte]': dateTo,
          'filter[branch_id]': branchFilter || undefined,
          sort: 'date',
        } as any)
        .then((r) => r.data),
    enabled,
  })
  const orders: any[] = useMemo(() => (data as any)?.data ?? [], [data])
  const meta = (data as any)?.meta

  const pageTotals = useMemo(
    () => ({
      bruto: orders.reduce(
        (s: number, o: any) => s + (o.subtotal_price ?? 0),
        0,
      ),
      discount: orders.reduce(
        (s: number, o: any) => s + (o.discount_price ?? 0),
        0,
      ),
      netto: orders.reduce(
        (s: number, o: any) => s + (o.total_price ?? 0),
        0,
      ),
    }),
    [orders],
  )

  const lastPage = meta?.last_page ?? 1

  const { data: paymentsData } = useQuery({
    queryKey: ['report-sales-invoice-payments', dateFrom, dateTo, branchFilter],
    queryFn: () => fetchPeriodPayments({ dateFrom, dateTo, branchId: branchFilter }),
    enabled,
  })
  const allocByOrder = useMemo(() => {
    const map = new Map<number, OrderAllocation[]>()
    flattenSalesOrderAllocations(paymentsData ?? []).forEach((a) => {
      const list = map.get(a.salesOrderId) ?? []
      list.push(a)
      map.set(a.salesOrderId, list)
    })
    return map
  }, [paymentsData])

  const methodsLabel = (orderId: number) => {
    const names = Array.from(
      new Set((allocByOrder.get(Number(orderId)) ?? []).map((a) => a.methodName)),
    )
    return names.length ? names.join(', ') : '—'
  }

  // Export covers the whole period (the screen is paginated), with the same
  // per-transaction detail and summary columns as the two on-screen views.
  const exportMutation = useMutation({
    mutationFn: () =>
      fetchAllPages((p) =>
        salesOrdersService
          .list({
            page: p,
            per_page: 500,
            include: 'branch,customer,credit_by,created_by,sales_order_details',
            'filter[status]': 'final',
            'filter[date_gte]': dateFrom,
            'filter[date_lte]': dateTo,
            'filter[branch_id]': branchFilter || undefined,
            sort: 'date',
          } as any)
          .then((r) => r.data),
      ),
    onSuccess: (allOrders: any[]) => {
      const header = reportHeader({
        title: 'Sales by Invoice',
        branch: branchName,
        period: `${dateFrom} s/d ${dateTo}`,
        extra: [`Jumlah Transaksi = ${allOrders.length}`],
      })

      const detail: ExcelRow[] = [...header]
      allOrders.forEach((order: any, idx: number) => {
        const v = buildInvoiceView(order, allocByOrder.get(Number(order.id)) ?? [])
        detail.push(
          [`Transaksi Ke = ${idx + 1}`],
          ['Waktu', v.waktu, '', 'No Trx', order.code],
          ['Customer', v.customer, '', 'Phone', v.phone],
          ['Jenis', v.jenis, '', 'Status', v.status],
          ['Kasir', v.kasir, '', 'Kode Promo', v.promo],
          ['Remark', v.remark],
          ['No.', 'Kode', 'Nama', 'Unit', 'Harga', 'Qty', 'Total'],
          ...v.items.map((it, i) => [i + 1, it.code, it.name, it.unit, money(it.price), it.qty, money(it.amount)]),
        )
        for (let i = 0; i < Math.max(v.summaryLeft.length, v.summaryRight.length); i++) {
          const l = v.summaryLeft[i]
          const r = v.summaryRight[i]
          detail.push([l?.[0] ?? '', l ? money(l[1]) : '', '', r?.[0] ?? '', r ? money(r[1]) : ''])
        }
        detail.push([])
      })

      const summary: ExcelRow[] = [
        ...header,
        ['No.', 'Outlet', 'Date', 'Time', 'Invoice No', 'Customer', 'Bruto', 'Discount', 'Netto', 'Payment Method', 'Payment Status', 'Settlement'],
      ]
      const totals = { bruto: 0, discount: 0, netto: 0 }
      allOrders.forEach((order: any, idx: number) => {
        const dt = parseApiDate(order.created_at ?? order.date)
        totals.bruto += Number(order.subtotal_price ?? 0)
        totals.discount += Number(order.discount_price ?? 0)
        totals.netto += Number(order.total_price ?? 0)
        summary.push([
          idx + 1,
          order.branch?.name ?? '',
          order.date ? formatDateShort(order.date) : '',
          dt ? dt.toLocaleTimeString('id-ID') : '',
          order.code,
          order.customer?.name ?? order.customer_name ?? '',
          money(order.subtotal_price),
          money(order.discount_price),
          money(order.total_price),
          methodsLabel(order.id),
          PAYMENT_META[order.payment_status]?.label ?? order.payment_status ?? '',
          SETTLEMENT_META[order.settlement_status]?.label ?? order.settlement_status ?? '',
        ])
      })
      summary.push(['', '', '', '', '', 'TOTAL', money(totals.bruto), money(totals.discount), money(totals.netto)])

      downloadExcel(`sales-by-invoice-${dateFrom}_${dateTo}.xlsx`, [
        { name: 'Detail per Transaksi', rows: detail, cols: [24, 16, 40, 16, 18, 8, 16] },
        { name: 'Ringkasan', rows: summary, cols: [6, 20, 12, 10, 30, 26, 14, 14, 14, 24, 14, 12] },
      ])
      toast.success('Sales by invoice report exported')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export sales by invoice'),
  })

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px; margin: 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
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
        <button type="button" onClick={() => router.back()} style={ghostBtnStyle}>
          <ArrowLeft size={14} />
          Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              if (!enabled) {
                toast.error('Generate the report first')
                return
              }
              exportMutation.mutate()
            }}
            disabled={exportMutation.isPending}
            style={ghostBtnStyle}
          >
            {exportMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={ghostBtnStyle}
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
          }}
        >
          Sales by Invoice
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--foreground-muted)',
            display: 'block',
            marginTop: 2,
          }}
        >
          {`Period: ${dateFrom} s/d ${dateTo}`}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--foreground-muted)',
            display: 'block',
          }}
        >
          {`Printed: ${new Date().toLocaleString('id-ID')}`}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>FROM</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>TO</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>BRANCH</label>
            <ReportBranchSelect
              value={branchFilter}
              onChange={setBranchFilter}
              style={inputStyle}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1)
              setEnabled(true)
            }}
            style={accentBtnStyle}
          >
            Generate
          </button>
        </div>
      </div>

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
          <div style={labelStyle}>Total Invoices</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {formatCurrency((meta?.total ?? orders.length), '')}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={labelStyle}>Bruto (halaman ini)</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {formatCurrency(pageTotals.bruto)}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={labelStyle}>Discount (halaman ini)</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginTop: 4,
              color: 'var(--destructive)',
            }}
          >
            {formatCurrency(pageTotals.discount)}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={labelStyle}>Netto (halaman ini)</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginTop: 4,
              color: 'var(--accent)',
            }}
          >
            {formatCurrency(pageTotals.netto)}
          </div>
        </div>
      </div>

      <div
        className="no-print"
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        {(
          [
            ['detail', 'Detail per Transaksi'],
            ['list', 'Ringkasan'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            style={{
              ...ghostBtnStyle,
              background: view === key ? 'var(--accent)' : 'var(--surface)',
              color: view === key ? 'white' : 'var(--foreground)',
              borderColor: view === key ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'detail' && (
        <div>
          {!enabled && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-muted)' }}>
              Set date range and click Generate
            </div>
          )}
          {enabled && isLoading && (
            <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
          )}
          {enabled && !isLoading && orders.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-muted)' }}>
              No invoices for selected period
            </div>
          )}
          {enabled && !isLoading && orders.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--foreground-muted)' }}>
              Jumlah Transaksi = <b style={{ color: 'var(--foreground)' }}>{meta?.total ?? orders.length}</b>
            </div>
          )}
          {orders.map((order: any, idx: number) => (
            <InvoiceCard
              key={order.id ?? `${order.code}-${idx}`}
              order={order}
              index={(page - 1) * perPage + idx + 1}
              allocations={allocByOrder.get(Number(order.id)) ?? []}
            />
          ))}
        </div>
      )}

      {view === 'list' && (
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 40 }}>No.</th>
              <th style={thStyle}>Outlet</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Invoice No</th>
              <th style={thStyle}>Customer</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Discount</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Netto</th>
              <th style={thStyle}>Payment Method</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Payment Status</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={12}
                  style={{ ...tdBase, textAlign: 'center', padding: 32 }}
                >
                  Loading...
                </td>
              </tr>
            )}
            {!enabled && (
              <tr>
                <td
                  colSpan={12}
                  style={{
                    ...tdBase,
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Set date range and click Generate
                </td>
              </tr>
            )}
            {enabled && !isLoading && orders.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  style={{
                    ...tdBase,
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No invoices for selected period
                </td>
              </tr>
            )}
            {orders.map((order: any, idx: number) => {
              const paymentMeta =
                PAYMENT_META[order.payment_status] ?? {
                  label: order.payment_status ?? '—',
                  color: 'var(--foreground-muted)',
                  bg: 'var(--background)',
                }
              const settlementMeta =
                SETTLEMENT_META[order.settlement_status] ?? {
                  label: order.settlement_status ?? '—',
                  color: 'var(--foreground-muted)',
                  bg: 'var(--background)',
                }
              return (
                <tr
                  key={order.id ?? `${order.code}-${idx}`}
                  style={{
                    background:
                      idx % 2 === 0 ? 'transparent' : 'var(--background)',
                  }}
                >
                  <td style={tdBase}>{(page - 1) * perPage + idx + 1}</td>
                  <td style={tdBase}>{order.branch?.name ?? '—'}</td>
                  <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                    {order.date
                      ? formatDateShort(order.date)
                      : '—'}
                  </td>
                  <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                    {(() => {
                      const dt = parseApiDate(order.created_at ?? order.date)
                      return dt ? dt.toLocaleTimeString('id-ID') : '—'
                    })()}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      fontFamily: 'monospace',
                      fontSize: 10,
                    }}
                  >
                    {order.code}
                  </td>
                  <td style={tdBase}>
                    {order.customer?.name ?? order.customer_name ?? '—'}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right' }}>
                    {formatCurrency(order.subtotal_price ?? 0)}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      color: 'var(--destructive)',
                    }}
                  >
                    {(order.discount_price ?? 0) > 0
                      ? '- ' + formatCurrency(order.discount_price ?? 0)
                      : '—'}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(order.total_price ?? 0)}
                  </td>
                  <td style={{ ...tdBase, fontSize: 11 }}>{methodsLabel(order.id)}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <Badge meta={paymentMeta} />
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <Badge meta={settlementMeta} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr
                style={{
                  fontWeight: 700,
                  background: 'var(--background)',
                }}
              >
                <td
                  colSpan={6}
                  style={{ ...tdBase, textAlign: 'right', padding: '10px 12px' }}
                >
                  PAGE TOTAL
                </td>
                <td
                  style={{ ...tdBase, textAlign: 'right', padding: '10px 12px' }}
                >
                  {formatCurrency(pageTotals.bruto)}
                </td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    padding: '10px 12px',
                    color: 'var(--destructive)',
                  }}
                >
                  {'- ' + formatCurrency(pageTotals.discount)}
                </td>
                <td
                  style={{ ...tdBase, textAlign: 'right', padding: '10px 12px' }}
                >
                  {formatCurrency(pageTotals.netto)}
                </td>
                <td colSpan={3} style={tdBase}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}

      {enabled && lastPage > 1 && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              ...ghostBtnStyle,
              padding: 6,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            style={{
              ...ghostBtnStyle,
              padding: 6,
              cursor: page >= lastPage ? 'not-allowed' : 'pointer',
              opacity: page >= lastPage ? 0.5 : 1,
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

const cardCell: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  borderBottom: '1px solid var(--border)',
}
const cardLabel: React.CSSProperties = {
  ...cardCell,
  color: 'var(--foreground-muted)',
  width: 110,
  whiteSpace: 'nowrap',
}

/** Everything a transaction card shows — used by the card and by the Excel export. */
function buildInvoiceView(order: any, allocations: OrderAllocation[]) {
  const items: DetailItem[] = (order.sales_order_details ?? []).map(resolveDetailItem)
  const bruto = Number(order.subtotal_price ?? 0)
  const discount = Number(order.discount_price ?? 0)
  const paidInPeriod = allocations.reduce((s, a) => s + a.amount, 0)
  const paidOutside = Math.max(0, Number(order.total_payment ?? paidInPeriod) - paidInPeriod)
  const remaining = Math.max(0, Number(order.remaining_payment ?? 0))
  const byMethod = allocations.reduce<Record<string, number>>((m, a) => {
    m[a.methodName] = (m[a.methodName] ?? 0) + a.amount
    return m
  }, {})
  const dt = parseApiDate(order.created_at ?? order.date)

  const summaryLeft: [string, number][] = [
    ['Bruto', bruto],
    ['Diskon', discount],
    ['Netto', bruto - discount],
    ['Tax', Number(order.tax_amount ?? 0)],
    ['Delivery / Add. Charge', Number(order.additional_charge_price ?? 0)],
    ['Total', Number(order.total_price ?? 0)],
  ]
  const summaryRight: [string, number][] = [
    ...Object.entries(byMethod),
    ...(paidOutside > 0 ? [['DP / Dibayar di luar periode', paidOutside] as [string, number]] : []),
    ...(remaining > 0 ? [['Belum Dibayar', remaining] as [string, number]] : []),
    ['Payment', paidInPeriod + paidOutside],
  ]

  return {
    items,
    summaryLeft,
    summaryRight,
    waktu: `${order.date ? formatDateShort(order.date) : '—'}${dt ? ` ${dt.toLocaleTimeString('id-ID')}` : ''}`,
    customer: order.customer?.name ?? order.customer_name ?? '—',
    phone: order.customer?.phone ?? order.customer_phone ?? '—',
    jenis: `${order.type === 'online' ? 'Online' : 'Offline'}${
      order.credit_type ? ` · Credit ${order.credit_type === 'user' ? 'Karyawan' : 'Customer'}` : ''
    }`,
    status: `${PAYMENT_META[order.payment_status]?.label ?? order.payment_status ?? '—'} / ${
      SETTLEMENT_META[order.settlement_status]?.label ?? order.settlement_status ?? '—'
    }`,
    kasir: order.created_by?.name ?? '—',
    promo: voucherCode(order) || '—',
    remark: order.description || '—',
  }
}

const InvoiceCard: React.FC<{
  order: any
  index: number
  allocations: OrderAllocation[]
}> = ({ order, index, allocations }) => {
  const v = buildInvoiceView(order, allocations)
  const { items, summaryLeft, summaryRight } = v
  const rp = (val: number) => formatCurrency(val, '')
  const rows = Math.max(summaryLeft.length, summaryRight.length)

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        marginBottom: 16,
        overflow: 'hidden',
        breakInside: 'avoid',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          background: 'var(--background)',
          fontSize: 12,
          fontWeight: 700,
          borderBottom: '1px solid var(--border)',
        }}
      >
        Transaksi Ke = {index}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={cardLabel}>Waktu</td>
            <td style={cardCell}>{v.waktu}</td>
            <td style={cardLabel}>No Trx</td>
            <td style={{ ...cardCell, fontFamily: 'monospace', fontSize: 11 }}>{order.code}</td>
          </tr>
          <tr>
            <td style={cardLabel}>Customer</td>
            <td style={cardCell}>{v.customer}</td>
            <td style={cardLabel}>Phone</td>
            <td style={cardCell}>{v.phone}</td>
          </tr>
          <tr>
            <td style={cardLabel}>Jenis</td>
            <td style={cardCell}>{v.jenis}</td>
            <td style={cardLabel}>Status</td>
            <td style={cardCell}>{v.status}</td>
          </tr>
          <tr>
            <td style={cardLabel}>Kasir</td>
            <td style={cardCell}>{v.kasir}</td>
            <td style={cardLabel}>Kode Promo</td>
            <td style={cardCell}>{v.promo}</td>
          </tr>
          <tr>
            <td style={cardLabel}>Remark</td>
            <td style={cardCell} colSpan={3}>{v.remark}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 36 }}>No.</th>
            <th style={{ ...thStyle, width: 100 }}>Kode</th>
            <th style={thStyle}>Nama</th>
            <th style={{ ...thStyle, width: 60 }}>Unit</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 100 }}>Harga</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 50 }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 110 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...cardCell, color: 'var(--foreground-muted)' }}>
                No line items
              </td>
            </tr>
          )}
          {items.map((it: any, i: number) => (
            <tr key={i}>
              <td style={cardCell}>{i + 1}</td>
              <td style={{ ...cardCell, fontFamily: 'monospace', fontSize: 11 }}>{it.code}</td>
              <td style={cardCell}>{it.name}</td>
              <td style={cardCell}>{it.unit}</td>
              <td style={{ ...cardCell, textAlign: 'right' }}>{rp(it.price)}</td>
              <td style={{ ...cardCell, textAlign: 'right' }}>
                {it.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
              </td>
              <td style={{ ...cardCell, textAlign: 'right' }}>{rp(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const l = summaryLeft[i]
            const r = summaryRight[i]
            const isTotalRow = (row?: [string, number]) =>
              row && (row[0] === 'Total' || row[0] === 'Payment')
            return (
              <tr key={i}>
                <td style={cardLabel}>{l?.[0] ?? ''}</td>
                <td
                  style={{
                    ...cardCell,
                    textAlign: 'right',
                    fontWeight: isTotalRow(l) ? 700 : 400,
                  }}
                >
                  {l ? rp(l[1]) : ''}
                </td>
                <td style={cardLabel}>{r?.[0] ?? ''}</td>
                <td
                  style={{
                    ...cardCell,
                    textAlign: 'right',
                    fontWeight: isTotalRow(r) ? 700 : 400,
                  }}
                >
                  {r ? rp(r[1]) : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
