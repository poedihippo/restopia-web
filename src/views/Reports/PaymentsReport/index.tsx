'use client'

import { paymentSourceLabel } from '@/utils/paymentSource'
import React, { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, Download, Loader2, Search, Wallet } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { paymentsService } from '@/services/payments.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { downloadFileFromResponse } from '@/utils/file'
import { formatCurrency } from '@/utils/price'
import { formatDateShort } from '@/utils/date'
import { CustomPagination } from '@/components/ui/CustomPagination'

type PaymentType = '' | 'receive' | 'disburse' | 'refund'

// receive = money in; disburse (supplier payments) and refund (paid back to a
// customer) are money out.
const TYPE_META: Record<string, { label: string; outgoing: boolean; color: string; bg: string }> = {
  receive: { label: 'Receipt', outgoing: false, color: 'var(--success)', bg: 'var(--success-bg)' },
  disburse: { label: 'Disbursement', outgoing: true, color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
  refund: { label: 'Refund', outgoing: true, color: 'var(--warning)', bg: 'var(--warning-bg)' },
}

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}
const todayStr = () => new Date().toLocaleDateString('en-CA')

// Each allocation says what the payment paid: a sales order, an invoice or a PO.
function allocationLinks(allocations: any[] = []) {
  return allocations
    .map((a) =>
      a.sales_order_id
        ? { key: `so-${a.id}`, label: `SO #${a.sales_order_id}`, href: `/sales/sales-orders/${a.sales_order_id}/detail` }
        : a.invoice_id
          ? { key: `inv-${a.id}`, label: `INV #${a.invoice_id}`, href: `/transfer/invoices/${a.invoice_id}` }
          : a.purchase_order_id
            ? { key: `po-${a.id}`, label: `PO #${a.purchase_order_id}`, href: `/purchase/purchase-orders/${a.purchase_order_id}/detail` }
            : null,
    )
    .filter(Boolean) as { key: string; label: string; href: string }[]
}

export default function PaymentsReportView() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [type, setType] = useState<PaymentType>('')
  const [methodId, setMethodId] = useState<number | ''>('')
  const [reversed, setReversed] = useState<'' | 'false' | 'true'>('false')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, type, methodId, reversed, debouncedSearch])

  // The screen and the download send exactly the same filters, so both show
  // the same rows.
  const filters: Record<string, string | number | undefined> = {
    sort: '-date',
    'filter[date_gte]': dateFrom || undefined,
    'filter[date_lte]': dateTo || undefined,
    'filter[type]': type || undefined,
    'filter[payment_method_id]': methodId === '' ? undefined : methodId,
    'filter[is_reversed]': reversed || undefined,
    'filter[search]': debouncedSearch || undefined,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payments-report', filters, page, perPage],
    queryFn: () =>
      paymentsService
        .list({ ...filters, include: 'payment_method,bank_account,allocations', page, per_page: perPage })
        .then((r) => r.data),
  })
  const rows: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const { data: methodsData } = useQuery({
    queryKey: ['payment-methods-all', 'payments-report'],
    queryFn: () => paymentMethodsService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
  })
  const methods: any[] = (methodsData as any)?.data ?? []

  const { mutate: exportExcel, isPending: exporting } = useMutation({
    mutationFn: () => reportsService.exportPayments(filters),
    onSuccess: (res) => downloadFileFromResponse(res, `payments-${dateFrom || 'all'}-${dateTo || 'all'}.xlsx`),
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  const columns = ['Payment No.', 'Type', 'Method', 'Date', 'Amount', 'Balance', 'Reversed', 'Paid for']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Payments Report</h1>
          <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
            Money received and paid out
            {meta?.total != null && <span style={{ color: 'var(--foreground-subtle)' }}> · {Number(meta.total).toLocaleString('id-ID')} payments</span>}
          </p>
        </div>
        <button type="button" className="v2-btn v2-btn-primary" onClick={() => exportExcel()} disabled={exporting}>
          {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
          {exporting ? 'Exporting…' : 'Download Excel'}
        </button>
      </div>

      <div className="v2-card" style={{ overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)', pointerEvents: 'none' }} />
            <input
              data-search
              className="v2-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Payment no. or description…  (Ctrl+F)"
              style={{ width: '100%', paddingLeft: 30, background: 'var(--surface-muted)' }}
            />
          </div>
          <input type="date" className="v2-input" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="From" />
          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>–</span>
          <input type="date" className="v2-input" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="To" />
          <div className="v2-seg" role="tablist" aria-label="Type">
            {([['', 'All'], ['receive', 'Receipt'], ['disburse', 'Disbursement'], ['refund', 'Refund']] as const).map(([v, l]) => (
              <button key={l} type="button" role="tab" aria-selected={type === v} onClick={() => setType(v)}>
                {l}
              </button>
            ))}
          </div>
          <select className="v2-select" value={methodId} onChange={(e) => setMethodId(e.target.value === '' ? '' : Number(e.target.value))} style={{ maxWidth: 200 }}>
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select className="v2-select" value={reversed} onChange={(e) => setReversed(e.target.value as any)}>
            <option value="false">Not reversed</option>
            <option value="true">Reversed only</option>
            <option value="">All</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="v2-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} style={{ textAlign: c === 'Amount' || c === 'Balance' ? 'right' : 'left' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, r) => (
                  <tr key={`sk-${r}`}>
                    {columns.map((c) => (
                      <td key={c}>
                        <div className="v2-skeleton" style={{ height: 10, width: '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {isError && (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', height: 96, color: 'var(--destructive)' }}>
                    Failed to load payments
                  </td>
                </tr>
              )}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length}>
                    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--pastel-blue)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={20} style={{ color: 'var(--pastel-blue-ink)' }} />
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>No payments found</span>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Try another period or filter</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((p) => {
                  const meta = TYPE_META[p.type] ?? { label: p.type ?? '—', outgoing: false, color: 'var(--foreground-muted)', bg: 'var(--border)' }
                  const Dir = meta.outgoing ? ArrowUpRight : ArrowDownLeft
                  const links = allocationLinks(p.allocations)
                  return (
                    <tr key={p.id} data-row style={{ opacity: p.is_reversed ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{p.payment_number ?? `#${p.id}`}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                          <Dir size={12} />
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--foreground-muted)' }}>{paymentSourceLabel(p)}</td>
                      <td style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>{formatDateShort(p.date)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap', color: meta.outgoing ? 'var(--destructive)' : 'var(--foreground)' }}>
                        {meta.outgoing ? '− ' : ''}
                        {formatCurrency(p.amount)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: Number(p.unallocated_amount) > 0 ? 'var(--warning)' : 'var(--foreground-subtle)' }}>
                        {formatCurrency(p.unallocated_amount ?? 0)}
                      </td>
                      <td>
                        {p.is_reversed ? (
                          <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 999, color: 'var(--destructive)', background: 'var(--destructive-bg)' }}>Reversed</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>No</span>
                        )}
                      </td>
                      <td>
                        {links.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>—</span>
                        ) : (
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {links.map((l) => (
                              <a key={l.key} href={l.href} target="_blank" rel="noopener" className="v2-link" style={{ fontSize: 12 }}>
                                {l.label}
                                <ArrowUpRight size={11} />
                              </a>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
