'use client'
import { formatCurrency } from '@/utils/price';

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useAuth } from '@/hooks/useAuth'
import ReportBranchSelect, { useReportBranchName } from './ReportBranchSelect'
import { salesOrdersService } from '@/services/sales-orders.service'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'
import {
  fetchFinalSalesOrders,
  fetchPeriodPayments,
  flattenSalesOrderAllocations,
  resolveDetailItem,
  isEmployeeCredit,
  PAYMENT_BUCKET_LABEL,
  type PaymentBucket,
} from '@/utils/salesReport'
const today = () => new Date().toLocaleDateString('en-CA')

// Non-cash buckets deducted from the sub total to arrive at the cash deposit.
const NON_CASH_BUCKETS: PaymentBucket[] = ['voucher', 'transfer', 'debit', 'card', 'other']
const ALL_BUCKETS: PaymentBucket[] = ['cash', 'debit', 'card', 'transfer', 'voucher', 'other']

type BucketTotals = Record<PaymentBucket, number>

/** One line of the SALES / SETORAN summaries — rendered on screen and exported as-is. */
interface SummaryLine {
  label: string
  value: number
  sign?: string
  bold?: boolean
  topBorder?: boolean
  /** Sub-heading row without a value. */
  heading?: boolean
}
const emptyBuckets = (): BucketTotals => ({
  cash: 0,
  debit: 0,
  card: 0,
  transfer: 0,
  credit: 0,
  voucher: 0,
  other: 0,
})

export default function SalesReport() {
  const { user } = useAuth()
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

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['report-sales', dateFrom, dateTo, branchFilter],
    queryFn: () =>
      fetchFinalSalesOrders({
        dateFrom,
        dateTo,
        branchId: branchFilter,
        include: 'sales_order_details,branch',
      }),
    enabled,
  })
  const orders: any[] = useMemo(() => ordersData ?? [], [ordersData])

  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['report-sales-payments', dateFrom, dateTo, branchFilter],
    queryFn: () => fetchPeriodPayments({ dateFrom, dateTo, branchId: branchFilter }),
    enabled,
  })
  const allocations = useMemo(
    () => flattenSalesOrderAllocations(paymentsData ?? []),
    [paymentsData],
  )

  // Payments in the period can settle orders outside it: older credit
  // (credit payment) or not-yet-final pre-orders (down payment +).
  const outsideOrderIds = useMemo(() => {
    const inPeriod = new Set(orders.map((o: any) => Number(o.id)))
    return Array.from(
      new Set(
        allocations
          .map((a) => a.salesOrderId)
          .filter((id) => !inPeriod.has(id)),
      ),
    ).sort((a, b) => a - b)
  }, [orders, allocations])

  const { data: outsideOrdersData, isLoading: isOutsideLoading } = useQuery({
    queryKey: ['report-sales-outside-orders', outsideOrderIds],
    queryFn: () =>
      Promise.all(
        outsideOrderIds.map((id) =>
          salesOrdersService
            .findById(id)
            .then((r) => (r.data as any)?.data)
            .catch(() => null),
        ),
      ),
    enabled: enabled && !!ordersData && outsideOrderIds.length > 0,
  })

  // ── Aggregation (all client-side) ─────────────────────────────────────────
  const aggregated = useMemo(() => {
    // Category → items grouped by (code, price), like the legacy report.
    const catMap: Record<
      string,
      {
        items: Record<string, { code: string; name: string; qty: number; price: number; amount: number }>
        totalQty: number
        totalAmount: number
        minCode: string
      }
    > = {}

    let grossSales = 0
    let totalDiscount = 0
    let totalTax = 0
    let totalCharge = 0
    let paidOutsidePeriod = 0
    let unpaid = 0

    const orderMap = new Map<number, any>()
    const paidInPeriod = new Map<number, number>()

    orders.forEach((order: any) => {
      orderMap.set(Number(order.id), order)
      grossSales += Number(order.subtotal_price ?? 0)
      totalDiscount += Number(order.discount_price ?? 0)
      totalTax += Number(order.tax_amount ?? 0)
      totalCharge += Number(order.additional_charge_price ?? 0)

      ;(order.sales_order_details ?? []).forEach((d: any) => {
        const item = resolveDetailItem(d)
        const cat = (catMap[item.category] ??= {
          items: {},
          totalQty: 0,
          totalAmount: 0,
          minCode: item.code,
        })
        const key = `${item.code}|${item.price}`
        const row = (cat.items[key] ??= {
          code: item.code,
          name: item.name,
          qty: 0,
          price: item.price,
          amount: 0,
        })
        row.qty += item.qty
        row.amount += item.amount
        cat.totalQty += item.qty
        cat.totalAmount += item.amount
        if (item.code < cat.minCode) cat.minCode = item.code
      })
    })

    // Sales payments (orders in period) vs DP+ / credit payments (orders outside).
    const sales = emptyBuckets()
    let creditCustomer = 0
    let creditKaryawan = 0
    const dpPlus = emptyBuckets()
    const creditPayment = emptyBuckets()
    const byMethod: Record<string, number> = {}

    const outsideMap = new Map<number, any>()
    ;(outsideOrdersData ?? []).forEach((o: any) => o && outsideMap.set(Number(o.id), o))

    allocations.forEach((a) => {
      const order = orderMap.get(a.salesOrderId)
      if (order) {
        paidInPeriod.set(a.salesOrderId, (paidInPeriod.get(a.salesOrderId) ?? 0) + a.amount)
        // Marketplace (online) orders are customer credit regardless of method.
        if (a.bucket === 'credit' || order.type === 'online') {
          if (isEmployeeCredit(order)) creditKaryawan += a.amount
          else creditCustomer += a.amount
          return
        }
        sales[a.bucket] += a.amount
        byMethod[a.methodName] = (byMethod[a.methodName] ?? 0) + a.amount
        return
      }

      if (a.bucket === 'credit') return
      byMethod[a.methodName] = (byMethod[a.methodName] ?? 0) + a.amount
      const outside = outsideMap.get(a.salesOrderId)
      const isOlderFinal =
        outside && outside.status === 'final' && String(outside.date ?? '') < dateFrom
      if (isOlderFinal) creditPayment[a.bucket] += a.amount
      else dpPlus[a.bucket] += a.amount
    })

    orders.forEach((order: any) => {
      const inPeriod = paidInPeriod.get(Number(order.id)) ?? 0
      const totalPayment = Number(order.total_payment ?? inPeriod)
      paidOutsidePeriod += Math.max(0, totalPayment - inPeriod)
      unpaid += Math.max(0, Number(order.remaining_payment ?? 0))
    })

    const sumBuckets = (b: BucketTotals) => ALL_BUCKETS.reduce((s, k) => s + b[k], 0)
    const netSales = grossSales - totalDiscount
    const totalSales = netSales + totalTax + totalCharge
    const totalCredit = creditCustomer + creditKaryawan
    const dpPlusTotal = sumBuckets(dpPlus)
    const creditPaymentTotal = sumBuckets(creditPayment)
    const subTotal =
      totalSales - paidOutsidePeriod - unpaid - totalCredit + dpPlusTotal + creditPaymentTotal

    const received = emptyBuckets()
    ALL_BUCKETS.forEach((k) => {
      received[k] = sales[k] + dpPlus[k] + creditPayment[k]
    })
    const cashDeposit = subTotal - NON_CASH_BUCKETS.reduce((s, k) => s + received[k], 0)

    const categories = Object.entries(catMap)
      .sort(([, a], [, b]) => a.minCode.localeCompare(b.minCode))
      .map(([name, cat]) => ({
        name,
        totalQty: cat.totalQty,
        totalAmount: cat.totalAmount,
        items: Object.values(cat.items).sort(
          (a, b) => a.code.localeCompare(b.code) || a.price - b.price,
        ),
      }))

    return {
      categories,
      grossSales,
      totalDiscount,
      netSales,
      totalTax,
      totalCharge,
      totalSales,
      totalTransactions: orders.length,
      totalGrossQty: categories.reduce((s, c) => s + c.totalQty, 0),
      sales,
      creditCustomer,
      creditKaryawan,
      totalCredit,
      paidOutsidePeriod,
      unpaid,
      dpPlus,
      dpPlusTotal,
      creditPayment,
      creditPaymentTotal,
      subTotal,
      received,
      cashDeposit,
      byMethod: Object.entries(byMethod).sort(([a], [b]) => a.localeCompare(b)),
    }
  }, [orders, allocations, outsideOrdersData, dateFrom])

  const branchName = useReportBranchName(branchFilter)
  const loading =
    isLoading || isPaymentsLoading || (outsideOrderIds.length > 0 && isOutsideLoading)
  const a = aggregated

  const salesLines: SummaryLine[] = [
    { label: 'GROSS SALES', value: a.grossSales },
    { label: 'DISCOUNT', value: a.totalDiscount, sign: '(-)' },
    { label: 'NET SALES', value: a.netSales, bold: true, topBorder: true },
    { label: 'TAX', value: a.totalTax, sign: '(+)' },
    { label: 'DELIVERY / ADD. CHARGE', value: a.totalCharge, sign: '(+)' },
    { label: 'TOTAL SALES', value: a.totalSales, bold: true, topBorder: true },
    { label: 'TOTAL SALES DIBAYAR DENGAN', value: 0, heading: true },
    { label: 'CREDIT Customer', value: a.creditCustomer },
    { label: 'CREDIT Karyawan', value: a.creditKaryawan },
    { label: 'CASH SALES', value: a.sales.cash },
    { label: 'DEBIT/BCA CARD', value: a.sales.debit },
    { label: 'VISA/MASTER', value: a.sales.card },
    { label: 'TRANSFER', value: a.sales.transfer },
    { label: 'VOUCHER', value: a.sales.voucher },
    ...(a.sales.other > 0 ? [{ label: 'LAINNYA', value: a.sales.other }] : []),
    { label: 'DP / DIBAYAR DI LUAR PERIODE', value: a.paidOutsidePeriod },
    ...(a.unpaid > 0 ? [{ label: 'BELUM DIBAYAR', value: a.unpaid }] : []),
  ]

  const setoranLines: SummaryLine[] = [
    { label: 'TOTAL SALES', value: a.totalSales },
    { label: 'DOWN PAYMENT −', value: a.paidOutsidePeriod, sign: '(-)' },
    ...(a.unpaid > 0 ? [{ label: 'BELUM DIBAYAR', value: a.unpaid, sign: '(-)' }] : []),
    { label: 'DOWN PAYMENT +', value: a.dpPlusTotal, sign: '(+)' },
    { label: 'CREDIT', value: a.totalCredit, sign: '(-)' },
    { label: 'CREDIT PAYMENT', value: a.creditPaymentTotal, sign: '(+)' },
    { label: 'SUB TOTAL', value: a.subTotal, bold: true, topBorder: true },
    { label: 'VOUCHER', value: a.received.voucher, sign: '(-)' },
    { label: 'TRANSFER', value: a.received.transfer, sign: '(-)' },
    { label: 'DEBIT/BCA CARD', value: a.received.debit, sign: '(-)' },
    { label: 'VISA/MASTER', value: a.received.card, sign: '(-)' },
    ...(a.received.other > 0
      ? [{ label: 'LAINNYA', value: a.received.other, sign: '(-)' }]
      : []),
    { label: 'TOTAL CASH (SETORAN)', value: a.cashDeposit, bold: true, topBorder: true },
  ]

  const bucketSum = (b: BucketTotals) => ALL_BUCKETS.reduce((sum, k) => sum + b[k], 0)

  const handleExport = () => {
    if (!enabled || loading || orders.length === 0) {
      toast.error('Generate the report first')
      return
    }
    const rows: ExcelRow[] = [
      ...reportHeader({
        title: 'SALES F REPORT',
        branch: branchName,
        period: `${dateFrom} s/d ${dateTo}`,
        extra: [`User : ${(user as any)?.name ?? '-'}`],
      }),
      ['Item Code', 'Name', 'Qty', 'Price', 'Amount'],
    ]
    a.categories.forEach((cat) => {
      cat.items.forEach((item) => {
        rows.push([item.code, item.name, item.qty, money(item.price), money(item.amount)])
      })
      rows.push([`TOTAL ${cat.name.toUpperCase()}`, '', cat.totalQty, '', money(cat.totalAmount)])
    })

    rows.push([], ['KATEGORI', '', 'QTY', '', 'AMOUNT'])
    a.categories.forEach((cat) => {
      rows.push([`TOTAL ${cat.name.toUpperCase()}`, '', cat.totalQty, '', money(cat.totalAmount)])
    })
    rows.push(['TOTAL GROSS SALES', '', a.totalGrossQty, '', money(a.grossSales)])

    // SALES (cols A-C) and SETORAN (cols E-G) side by side, as on screen.
    rows.push([], [`Jml Transaksi Sales : ${a.totalTransactions}`], ['SALES', '', '', '', 'SETORAN'])
    const lineCells = (l?: SummaryLine): ExcelRow =>
      !l ? ['', '', ''] : l.heading ? [l.label, '', ''] : [l.label, money(l.value), l.sign ?? '']
    for (let i = 0; i < Math.max(salesLines.length, setoranLines.length); i++) {
      rows.push([...lineCells(salesLines[i]), '', ...lineCells(setoranLines[i])])
    }

    rows.push(
      [],
      ['NOTE : PENERIMAAN PER METODE'],
      ['Metode', 'Sales', 'DP Plus', 'Credit Payment', 'Total'],
    )
    ALL_BUCKETS.forEach((k) => {
      rows.push([
        PAYMENT_BUCKET_LABEL[k],
        money(a.sales[k]),
        money(a.dpPlus[k]),
        money(a.creditPayment[k]),
        money(a.received[k]),
      ])
    })
    rows.push([
      'TOTAL',
      money(bucketSum(a.sales)),
      money(a.dpPlusTotal),
      money(a.creditPaymentTotal),
      money(bucketSum(a.received)),
    ])

    if (a.byMethod.length > 0) {
      rows.push([], ['RINCIAN METODE PEMBAYARAN'])
      a.byMethod.forEach(([name, amount]) => rows.push([name, money(amount)]))
    }

    downloadExcel(`sales-report-${dateFrom}_${dateTo}.xlsx`, [
      { name: 'Sales Report', rows, cols: [32, 36, 10, 16, 18, 16, 6] },
    ])
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
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

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--background)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '4px 8px',
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

  // Summary row: label | amount | sign (e.g. "(+)", "(-)")
  const Row = (line: SummaryLine) =>
    line.heading ? (
      <tr key={line.label}>
        <td colSpan={3} style={{ padding: '10px 8px 4px', fontWeight: 600, fontSize: 11 }}>
          {line.label}
        </td>
      </tr>
    ) : (
      <tr
        key={line.label}
        style={{
          borderBottom: '1px solid var(--border)',
          borderTop: line.topBorder ? '2px solid var(--border)' : undefined,
          fontWeight: line.bold ? 700 : 400,
        }}
      >
        <td style={{ padding: '5px 8px' }}>{line.label}</td>
        <td
          style={{
            padding: '5px 8px',
            textAlign: 'right',
            color: line.bold ? 'var(--accent)' : 'inherit',
          }}
        >
          {formatCurrency(line.value)}
        </td>
        <td style={{ padding: '5px 8px', width: 32, color: 'var(--foreground-muted)' }}>
          {line.sign ?? ''}
        </td>
      </tr>
    )

  const fmtQty = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 })

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleExport} style={topBtnStyle}>
            <Download size={14} />
            Export Excel
          </button>
          <button type="button" onClick={() => window.print()} style={topBtnStyle}>
            <Printer size={14} /> Print
          </button>
        </div>
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
        <div style={{ fontSize: 14, marginTop: 2 }}>{branchName}</div>
        <div
          style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4 }}
        >
          {`Period: ${dateFrom} s/d ${dateTo}`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
          {`User: ${(user as any)?.name ?? '-'} · Printed: ${new Date().toLocaleString('id-ID')}`}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={fieldLabelStyle}>BRANCH</label>
            <ReportBranchSelect
              value={branchFilter}
              onChange={setBranchFilter}
              style={inputStyle}
            />
          </div>

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
      {enabled && loading && (
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

      {/* Empty state */}
      {enabled && !loading && orders.length === 0 && (
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

      {/* Report content */}
      {enabled && !loading && orders.length > 0 && (
        <>
          {/* ── SECTION 1: Items by category (one table, subtotal row per category) ── */}
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                <th style={{ ...thStyle, textAlign: 'left', width: 110 }}>Item Code</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Name</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 60 }}>Qty</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 110 }}>Price</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 130 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {a.categories.map((cat, catIdx) => {
                // Continuous numbering across category groups.
                const offset = a.categories
                  .slice(0, catIdx)
                  .reduce((n, c) => n + c.items.length, 0)
                return (
                <React.Fragment key={cat.name}>
                  {cat.items.map((item, idx) => (
                    <tr key={`${cat.name}-${item.code}-${item.price}`}>
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', width: 50 }}>
                        {offset + idx + 1}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                        {item.code}
                      </td>
                      <td style={tdStyle}>{item.name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtQty(item.qty)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(item.price, '')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(item.amount, '')}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--background)', fontWeight: 700 }}>
                    <td style={tdStyle} />
                    <td colSpan={2} style={tdStyle}>
                      {'TOTAL ' + cat.name.toUpperCase()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtQty(cat.totalQty)}</td>
                    <td colSpan={2} style={{ ...tdStyle, textAlign: 'right' }}>
                      {formatCurrency(cat.totalAmount, '')}
                    </td>
                  </tr>
                </React.Fragment>
                )
              })}
            </tbody>
          </table>

          {/* ── SECTION 2: Category summary ── */}
          <div style={{ marginTop: 32 }}>
            {sectionHeaderBlock('KATEGORI')}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>KATEGORI</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>QTY</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 150 }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {a.categories.map((cat) => (
                  <tr key={cat.name}>
                    <td style={tdStyle}>{'TOTAL ' + cat.name.toUpperCase()}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtQty(cat.totalQty)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {formatCurrency(cat.totalAmount, '')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>TOTAL GROSS SALES</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{fmtQty(a.totalGrossQty)}</td>
                  <td style={{ padding: 8, textAlign: 'right', color: 'var(--accent)' }}>
                    {formatCurrency(a.grossSales, '')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── SECTION 3: Sales summary (left) + cash reconciliation (right) ── */}
          <div style={{ marginTop: 24, fontSize: 12, color: 'var(--foreground-muted)' }}>
            Jml Transaksi Sales : <b style={{ color: 'var(--foreground)' }}>{a.totalTransactions}</b>
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
              alignItems: 'start',
            }}
          >
            <div>
              {sectionHeaderBlock('SALES')}
              <table style={tableStyle}>
                <tbody>
                  {salesLines.map(Row)}
                </tbody>
              </table>
            </div>

            <div>
              {sectionHeaderBlock('SETORAN')}
              <table style={tableStyle}>
                <tbody>
                  {setoranLines.map(Row)}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 4: Notes — receipts by method and source ── */}
          <div style={{ marginTop: 32 }}>
            {sectionHeaderBlock('NOTE : PENERIMAAN PER METODE')}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Metode</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sales</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>DP Plus</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Credit Payment</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ALL_BUCKETS.map((k) => (
                  <tr key={k}>
                    <td style={tdStyle}>{PAYMENT_BUCKET_LABEL[k]}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(a.sales[k], '')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(a.dpPlus[k], '')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {formatCurrency(a.creditPayment[k], '')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(a.received[k], '')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>TOTAL</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    {formatCurrency(bucketSum(a.sales), '')}
                  </td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(a.dpPlusTotal, '')}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    {formatCurrency(a.creditPaymentTotal, '')}
                  </td>
                  <td style={{ padding: 8, textAlign: 'right', color: 'var(--accent)' }}>
                    {formatCurrency(bucketSum(a.received), '')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {a.byMethod.length > 0 && (
            <div style={{ marginTop: 24, maxWidth: 480 }}>
              {sectionHeaderBlock('RINCIAN METODE PEMBAYARAN')}
              <table style={tableStyle}>
                <tbody>
                  {a.byMethod.map(([name, amount]) => (
                    <tr key={name}>
                      <td style={tdStyle}>{name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
