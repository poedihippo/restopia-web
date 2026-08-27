'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort } from '@/utils/date';

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { salesOrdersService } from '@/services/sales-orders.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
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
  const { user, isSuperadmin } = useAuth()
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth())
  const [dateTo, setDateTo] = useState<string>(today())
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [enabled, setEnabled] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(1000)

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
          include: 'branch,customer,credit_by',
          'filter[status]': 'final',
          'filter[date_gte]': dateFrom,
          'filter[date_lte]': dateTo,
          'filter[branch_id]': branchFilter || undefined,
          sort: 'date',
        } as any)
        .then((r) => r.data),
    enabled,
  })
  const orders = (data as any)?.data ?? []
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
        <button
          type="button"
          onClick={() => window.print()}
          style={ghostBtnStyle}
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
          {isSuperadmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>BRANCH ID</label>
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="All branches"
                style={{ ...inputStyle, width: 140 }}
              />
            </div>
          )}
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
          <div style={labelStyle}>Total Bruto</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {formatCurrency(pageTotals.bruto)}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={labelStyle}>Total Discount</div>
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
          <div style={labelStyle}>Total Netto</div>
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
              <th style={{ ...thStyle, textAlign: 'center' }}>Payment Status</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={11}
                  style={{ ...tdBase, textAlign: 'center', padding: 32 }}
                >
                  Loading...
                </td>
              </tr>
            )}
            {!enabled && (
              <tr>
                <td
                  colSpan={11}
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
                  colSpan={11}
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
                  <td style={tdBase}>{(page - 1) * 50 + idx + 1}</td>
                  <td style={tdBase}>{order.branch?.name ?? '—'}</td>
                  <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                    {order.date
                      ? formatDateShort(order.date)
                      : '—'}
                  </td>
                  <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                    {order.created_at || order.date
                      ? new Date(
                          order.created_at ?? order.date,
                        ).toLocaleTimeString('id-ID')
                      : '—'}
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
                <td colSpan={2} style={tdBase}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

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
