'use client'
import { formatCurrency } from '@/utils/price';

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useAuth } from '@/hooks/useAuth'
import { salesOrdersService } from '@/services/sales-orders.service'
import { ArrowLeft, Printer } from 'lucide-react'
const today = () => new Date().toISOString().split('T')[0]

export default function SalesReport() {
  const { user, isSuperadmin } = useAuth()
  const router = useRouter()

  const [dateFrom, setDateFrom] = useState<string>(today())
  const [dateTo, setDateTo] = useState<string>(today())
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading } = useQuery({
    queryKey: ['report-sales', dateFrom, dateTo, branchFilter],
    queryFn: () =>
      salesOrdersService
        .list({
          per_page: 500,
          include: 'sales_order_details,payments.payment_method,branch',
          'filter[status]': 'final',
          'filter[date_gte]': dateFrom,
          'filter[date_lte]': dateTo,
          'filter[branch_id]': branchFilter || undefined,
          sort: 'date',
        } as any)
        .then((r) => r.data),
    enabled,
  })
  const orders: any[] = (data as any)?.data ?? []

  // ── Aggregation (all client-side) ─────────────────────────────────────────
  const aggregated = useMemo(() => {
    const catMap: Record<
      string,
      {
        items: Array<{
          code: string
          name: string
          qty: number
          price: number
          amount: number
        }>
        totalQty: number
        totalAmount: number
      }
    > = {}

    let grossSales = 0
    let totalDiscount = 0
    let totalCash = 0
    let totalDebit = 0
    let totalCard = 0
    let totalTransfer = 0
    let totalCreditCustomer = 0
    let totalCreditKaryawan = 0
    let totalVoucher = 0

    orders.forEach((order: any) => {
      grossSales += order.subtotal_price ?? 0
      totalDiscount += order.discount_price ?? 0

      // Line items → group by category
      ;(order.sales_order_details ?? []).forEach((d: any) => {
        // Snapshots are already-parsed JSON columns captured at sale time.
        const pis = d.product_inventory_snapshot
        const bs = d.bundle_snapshot
        const prod = pis?.product_uom_batch?.product_uom?.product
        const code = prod?.code ?? bs?.code ?? '-'
        const name = prod?.name ?? bs?.name ?? '-'
        const catName = prod?.product_category?.name ?? 'OTHER'
        const qty = d.qty ?? 0
        const price = d.price ?? 0
        const amount = qty * price

        if (!catMap[catName]) {
          catMap[catName] = { items: [], totalQty: 0, totalAmount: 0 }
        }
        catMap[catName].items.push({ code, name, qty, price, amount })
        catMap[catName].totalQty += qty
        catMap[catName].totalAmount += amount
      })

      // Payment breakdown — categorize by payment method name
      ;(order.payments ?? []).forEach((p: any) => {
        const method = (p.payment_method?.name ?? '').toLowerCase()
        const amt = p.amount ?? 0
        if (method.includes('cash')) {
          totalCash += amt
        } else if (method.includes('debit') || method.includes('bca')) {
          totalDebit += amt
        } else if (
          method.includes('visa') ||
          method.includes('master') ||
          method.includes('card')
        ) {
          totalCard += amt
        } else if (method.includes('transfer')) {
          totalTransfer += amt
        } else if (method.includes('credit')) {
          if (order.credit_by_id) {
            totalCreditKaryawan += amt
          } else {
            totalCreditCustomer += amt
          }
        } else if (method.includes('voucher')) {
          totalVoucher += amt
        } else {
          totalCash += amt
        }
      })
    })

    const netSales = grossSales - totalDiscount
    const totalGrossQty = Object.values(catMap).reduce(
      (s, c) => s + c.totalQty,
      0,
    )
    const totalBanking = totalCash + totalDebit + totalCard + totalTransfer

    return {
      catMap,
      grossSales,
      totalDiscount,
      netSales,
      totalTransactions: orders.length,
      totalGrossQty,
      totalCash,
      totalDebit,
      totalCard,
      totalTransfer,
      totalCreditCustomer,
      totalCreditKaryawan,
      totalVoucher,
      totalBanking,
      grandTotal: grossSales,
    }
  }, [orders])

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  const accentBtnStyle: React.CSSProperties = {
    padding: '9px 18px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const topBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground-muted)',
    cursor: 'pointer',
  }

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--foreground-muted)',
  }

  const catHeaderStyle: React.CSSProperties = {
    background: 'var(--background)',
    padding: '6px 12px',
    borderTop: '2px solid var(--border)',
    borderBottom: '1px solid var(--border)',
  }

  const catHeaderTextStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  }

  const sectionHeaderBlock = (title: string) => (
    <div
      style={{
        background: 'var(--background)',
        padding: '8px 12px',
        borderTop: '2px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
        {title}
      </span>
    </div>
  )

  // Sales Summary row helper
  const SummaryRow = (
    label: string,
    value: number,
    highlight = false,
    negative = false,
  ) => (
    <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
      <td
        style={{
          padding: '5px 8px',
          color: negative ? 'var(--destructive)' : 'inherit',
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: '5px 8px',
          textAlign: 'right',
          fontWeight: highlight ? 700 : 400,
          color: highlight
            ? 'var(--accent)'
            : negative
              ? 'var(--destructive)'
              : 'inherit',
        }}
      >
        {formatCurrency(value)}
      </td>
    </tr>
  )

  // Payment Breakdown row helper
  const PayRow = (label: string, value: number) => (
    <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '5px 8px' }}>{label}</td>
      <td style={{ padding: '5px 8px', textAlign: 'right' }}>
        {formatCurrency(value)}
      </td>
    </tr>
  )

  const catEntries = Object.entries(aggregated.catMap)

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 1000,
        margin: '0 auto',
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px; margin: 0; padding: 8mm; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 2px 6px; font-size: 10px; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Top bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <button type="button" onClick={() => router.back()} style={topBtnStyle}>
          <ArrowLeft size={14} /> Reports
        </button>
        <button type="button" onClick={() => window.print()} style={topBtnStyle}>
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Report header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '2px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
          }}
        >
          SALES F REPORT
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
          Dapur Cokelat Indonesia
        </div>
        <div style={{ fontSize: 14, marginTop: 2 }}>
          {(user as any)?.branch?.name ?? 'All Branches'}
        </div>
        <div
          style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4 }}
        >
          {`Period: ${dateFrom} s/d ${dateTo}`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
          {`Printed: ${new Date().toLocaleString('id-ID')}`}
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="no-print"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          marginBottom: 24,
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
            <label style={fieldLabelStyle}>FROM</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={fieldLabelStyle}>TO</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
            />
          </div>

          {isSuperadmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={fieldLabelStyle}>BRANCH ID</label>
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="All branches"
                style={inputStyle}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setEnabled(true)
            }}
            style={accentBtnStyle}
          >
            Generate
          </button>
        </div>
      </div>

      {/* Not generated state */}
      {!enabled && (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--foreground-muted)',
          }}
        >
          Set date range and click Generate to view report
        </div>
      )}

      {/* Loading */}
      {enabled && isLoading && (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--foreground-muted)',
          }}
        >
          Loading report data...
        </div>
      )}

      {/* Report content */}
      {enabled && !isLoading && (
        <>
          {/* ── SECTION 1: Items by Category ── */}
          {catEntries.map(([catName, cat]) => (
            <div key={catName} style={{ marginBottom: 24 }}>
              <div style={catHeaderStyle}>
                <span style={catHeaderTextStyle}>{catName}</span>
              </div>

              <table style={tableStyle}>
                <thead style={{ background: 'var(--background)' }}>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', width: 120 }}>
                      Item Code
                    </th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Name</th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 60 }}>
                      Qty
                    </th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 100 }}>
                      Price
                    </th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {cat.items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background:
                          idx % 2 === 0 ? 'transparent' : 'var(--background)',
                      }}
                    >
                      <td
                        style={{
                          padding: '5px 8px',
                          fontFamily: 'monospace',
                          fontSize: 11,
                        }}
                      >
                        {item.code}
                      </td>
                      <td style={{ padding: '5px 8px' }}>{item.name}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                        {item.qty.toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                        {formatCurrency(item.price)}
                      </td>
                      <td
                        style={{
                          padding: '5px 8px',
                          textAlign: 'right',
                          fontWeight: 500,
                        }}
                      >
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr style={{ background: 'var(--surface)', fontWeight: 700 }}>
                    <td
                      colSpan={2}
                      style={{
                        textAlign: 'right',
                        padding: '6px 8px',
                        fontSize: 12,
                      }}
                    >
                      {'TOTAL ' + catName.toUpperCase()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                      {formatCurrency(cat.totalQty, '')}
                    </td>
                    <td></td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '6px 8px',
                        color: 'var(--accent)',
                      }}
                    >
                      {formatCurrency(cat.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          {/* ── SECTION 2: Category Summary ── */}
          <div style={{ marginTop: 32 }}>
            {sectionHeaderBlock('KATEGORI')}

            <table style={tableStyle}>
              <thead style={{ background: 'var(--background)' }}>
                <tr>
                  <th
                    style={{
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    KATEGORI
                  </th>
                  <th
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    QTY
                  </th>
                  <th
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    AMOUNT
                  </th>
                </tr>
              </thead>

              <tbody>
                {catEntries.map(([catName, cat]) => (
                  <tr
                    key={catName}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>
                      {'TOTAL ' + catName.toUpperCase()}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                      {formatCurrency(cat.totalQty, '')}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                      {formatCurrency(cat.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot style={{ fontWeight: 700 }}>
                <tr
                  style={{
                    background: 'var(--surface)',
                    borderTop: '2px solid var(--border)',
                  }}
                >
                  <td style={{ padding: 8, fontSize: 13 }}>TOTAL GROSS SALES</td>
                  <td style={{ padding: 8, textAlign: 'right', fontSize: 13 }}>
                    {formatCurrency(aggregated.totalGrossQty, '')}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      textAlign: 'right',
                      fontSize: 13,
                      color: 'var(--accent)',
                    }}
                  >
                    {formatCurrency(aggregated.grossSales)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    Jml Transaksi Sales
                  </td>
                  <td
                    style={{
                      padding: '4px 8px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {aggregated.totalTransactions}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── SECTION 3: Financial + Payment Summary ── */}
          <div
            style={{
              marginTop: 24,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
            }}
          >
            {/* Left: Sales Summary */}
            <div>
              {sectionHeaderBlock('SALES SUMMARY')}
              <table style={tableStyle}>
                <tbody>
                  {SummaryRow('GROSS SALES', aggregated.grossSales)}
                  {SummaryRow('DISCOUNT', aggregated.totalDiscount, false, true)}
                  <tr
                    style={{
                      borderTop: '2px solid var(--border)',
                      fontWeight: 700,
                    }}
                  >
                    <td style={{ padding: '6px 8px' }}>NET SALES</td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--accent)',
                      }}
                    >
                      {formatCurrency(aggregated.netSales)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: Payment Breakdown */}
            <div>
              {sectionHeaderBlock('PAYMENT BREAKDOWN')}
              <table style={tableStyle}>
                <tbody>
                  {PayRow('CASH', aggregated.totalCash)}
                  {PayRow('DEBIT/BCA CARD', aggregated.totalDebit)}
                  {PayRow('VISA/MASTER', aggregated.totalCard)}
                  {PayRow('TRANSFER', aggregated.totalTransfer)}
                  {PayRow('CREDIT Customer', aggregated.totalCreditCustomer)}
                  {PayRow('CREDIT Karyawan', aggregated.totalCreditKaryawan)}
                  {PayRow('VOUCHER', aggregated.totalVoucher)}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      borderTop: '2px solid var(--border)',
                      fontWeight: 700,
                    }}
                  >
                    <td style={{ padding: '6px 8px' }}>TOTAL BANKING</td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--accent)',
                      }}
                    >
                      {formatCurrency(aggregated.totalBanking)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Empty state */}
          {orders.length === 0 && (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                color: 'var(--foreground-muted)',
              }}
            >
              No sales data for the selected period
            </div>
          )}
        </>
      )}
    </div>
  )
}
