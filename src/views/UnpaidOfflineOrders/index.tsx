'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Inbox, Loader2, Receipt, Search, Wallet, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { salesOrdersService } from '@/services/sales-orders.service'
import { formatCurrency } from '@/utils/price'
import { formatDateShort } from '@/utils/date'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { useReprintReceipt } from '@/views/Pos/hooks/useReprintReceipt'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'

// Unpaid and partially paid orders both still owe money.
const UNPAID_PAYMENT_STATUSES = 'pending,partial'

const controlStyle: CSSProperties = {
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0 10px',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  minWidth: 0,
}

const thStyle: CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  background: 'var(--background)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}

const actionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 30,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  final: { label: 'Final', color: 'var(--success)', bg: 'var(--success-bg)' },
  pending: { label: 'Held', color: 'var(--warning)', bg: 'var(--warning-bg)' },
}

/**
 * Offline (walk-in) sales orders that still owe money, so the cashier can
 * collect the payment or reprint the receipt without searching all orders.
 */
export default function UnpaidOfflineOrdersView() {
  const router = useRouter()
  const { reprint, printingId } = useReprintReceipt()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const filters = {
    sort: '-created_at',
    include: 'customer,branch',
    'filter[type]': 'offline',
    'filter[payment_statuses]': UNPAID_PAYMENT_STATUSES,
    ...(debouncedSearch ? { 'filter[search]': debouncedSearch } : {}),
    ...(dateFrom ? { 'filter[date_gte]': dateFrom } : {}),
    ...(dateTo ? { 'filter[date_lte]': dateTo } : {}),
  }

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['unpaid-offline-orders', page, perPage, debouncedSearch, dateFrom, dateTo],
    queryFn: () =>
      salesOrdersService
        .list({ ...filters, page, per_page: perPage } as any)
        .then((r) => r.data),
  })
  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const remainingOf = (o: any) =>
    o.remaining_payment != null
      ? Number(o.remaining_payment)
      : Number(o.total_price ?? 0) - Number(o.returned_amount ?? 0) - Number(o.total_payment ?? 0)

  const openOrder = (id: number) => router.push(`/sales/sales-orders/${id}/detail`)

  // Exports every matching order (all pages), not only the visible page.
  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    setExporting(true)
    try {
      const all = await salesOrdersService.listAll(filters)
      if (all.length === 0) {
        toast.info('No orders to export')
        return
      }
      const rows: ExcelRow[] = [
        ...reportHeader({
          title: 'Unpaid Offline Orders',
          period: dateFrom || dateTo ? `${dateFrom || '…'} – ${dateTo || '…'}` : undefined,
          extra: debouncedSearch ? [`Search : ${debouncedSearch}`] : [],
        }),
        ['No', 'Order', 'Branch', 'Date', 'Customer', 'Phone', 'Status', 'Payment', 'Total', 'Paid', 'Remaining'],
        ...all.map((o: any, i: number) => [
          i + 1,
          o.code,
          o.branch?.name ?? '',
          formatDateShort(o.date),
          o.customer_name || o.customer?.name || 'Walk-in',
          o.customer_phone || o.customer?.phone || '',
          STATUS_META[o.status as string]?.label ?? o.status ?? '',
          o.payment_status === 'partial' ? 'Partially paid' : 'Unpaid',
          money(o.total_price),
          money(o.total_payment),
          money(Math.max(0, remainingOf(o))),
        ]),
        [],
        ['', '', '', '', '', '', '', 'Total',
          money(all.reduce((s: number, o: any) => s + Number(o.total_price ?? 0), 0)),
          money(all.reduce((s: number, o: any) => s + Number(o.total_payment ?? 0), 0)),
          money(all.reduce((s: number, o: any) => s + Math.max(0, remainingOf(o)), 0))],
      ]
      downloadExcel(`unpaid-offline-orders-${new Date().toLocaleDateString('en-CA')}.xlsx`, [
        { name: 'Unpaid Offline', rows, cols: [5, 22, 20, 12, 24, 16, 10, 14, 14, 14, 14] },
      ])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>
          Unpaid Offline Orders
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
          Walk-in orders still waiting for payment. Open one to record the payment.
        </p>
      </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={exporting}
          style={{ ...actionButtonStyle, height: 36, padding: '0 14px', fontSize: 13, opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={15} />}
          Export Excel
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or customer…"
            style={{ ...controlStyle, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            style={controlStyle}
            aria-label="From date"
          />
          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            style={controlStyle}
            aria-label="To date"
          />
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--foreground-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {isFetching && !isLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          {meta?.total != null ? `${meta.total} order${meta.total === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 170 }}>Order</th>
                <th style={{ ...thStyle, width: 110 }}>Date</th>
                <th style={thStyle}>Customer</th>
                <th style={{ ...thStyle, width: 90 }}>Status</th>
                <th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Total</th>
                <th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Paid</th>
                <th style={{ ...thStyle, width: 140, textAlign: 'right' }}>Remaining</th>
                <th style={{ ...thStyle, width: 190 }} />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 8 }).map((__, c) => (
                      <td key={c} style={tdStyle}>
                        <div style={{ height: 12, borderRadius: 4, background: 'var(--background)' }} />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && isError && (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--destructive)' }}>
                    Failed to load orders
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--foreground-muted)' }}>
                      <Inbox size={28} color="var(--foreground-subtle)" />
                      <span style={{ fontSize: 14 }}>
                        No unpaid offline orders
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                items.map((o: any) => {
                  const status = STATUS_META[o.status as string] ?? {
                    label: o.status ?? '—',
                    color: 'var(--foreground-muted)',
                    bg: 'var(--background)',
                  }
                  return (
                    <tr key={o.id}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => openOrder(o.id)}
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', textAlign: 'left' }}
                        >
                          <span className="v2-link">{o.code}<ArrowUpRight size={12} /></span>
                        </button>
                        {o.branch?.name && (
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{o.branch.name}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{formatDateShort(o.date)}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500 }}>{o.customer_name || o.customer?.name || 'Walk-in'}</div>
                        {(o.customer_phone || o.customer?.phone) && (
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>
                            {o.customer_phone || o.customer?.phone}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', height: 22, alignItems: 'center', padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: status.color, background: status.bg }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(Number(o.total_price ?? 0))}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--foreground-muted)' }}>
                        {formatCurrency(Number(o.total_payment ?? 0))}
                        {o.payment_status === 'partial' && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', marginTop: 2 }}>Partially paid</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--destructive)' }}>
                        {formatCurrency(Math.max(0, remainingOf(o)))}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {o.status === 'final' && (
                            <button
                              type="button"
                              onClick={() => reprint(o.id)}
                              disabled={printingId === o.id}
                              title="Reprint receipt"
                              style={{ ...actionButtonStyle, opacity: printingId === o.id ? 0.6 : 1 }}
                            >
                              {printingId === o.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Receipt size={13} />}
                              Receipt
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openOrder(o.id)}
                            style={{ ...actionButtonStyle, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
                          >
                            <Wallet size={13} />
                            Pay
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {meta && meta.last_page > 1 && (
        <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
