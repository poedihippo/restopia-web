'use client'
import { paymentSourceLabel } from '@/utils/paymentSource'
import { formatDate } from '@/utils/date'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoicesService } from '@/services/invoices.service'
import { useAuth } from '@/hooks/useAuth'
import { useCentralCompanyScope } from '@/hooks/useCentralCompanyScope'
import {
  Printer,
  FileSpreadsheet,
  PackageSearch,
  Loader2,
  Plus, ArrowUpRight, Wallet, Ban,
} from 'lucide-react'
import { invoiceVoidBlock, blockedStyle } from '@/lib/actionGuards'
import { getInvoiceDueInfo } from '@/utils/invoiceDue'
import BackLink from '@/components/BackLink'
import PrintDocument, { PrintTotals, formatPrintDate, printFileTitle, usePrintCompany } from '@/components/print/PrintDocument'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentsService } from '@/services/payments.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { bankAccountsService } from '@/services/bank-accounts.service'
import { toastMutationApiError } from '@/utils/apiError'
import Link from 'next/link'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { formatNumberId } from '@/utils/numberFormat'
import { downloadExcel, money, type ExcelRow } from '@/utils/excelExport'

interface InvoiceDetailProps {
  id: number
}

interface PartyRef {
  id: number
  code?: string
  name?: string
}

/** PO asal SO yang ditagihkan — nested di invoice_sales_orders.sales_order. */
interface InvoicePurchaseOrder {
  id: number
  code?: string
  date?: string
  type?: string
  total_price?: number
  supplier?: PartyRef | null
  supplier_branch?: PartyRef | null
  buyer?: PartyRef | null
}

interface InvoiceSalesOrderRef {
  id?: number
  invoice_id?: number
  sales_order_id?: number
  sales_order?: {
    id: number
    code?: string
    date?: string
    total_price?: number
    purchase_order?: InvoicePurchaseOrder | null
  } | null
}

interface InvoiceFull {
  id: number
  code: string
  branch_id?: number
  billed_branch_id?: number
  date: string
  subtotal_price?: number
  discount_price?: number
  additional_charge_price?: number
  tax_amount?: number
  /** Cross-company handling fee — 0 when not applied. */
  handling_fee_percent?: number
  handling_fee_amount?: number
  total_price: number
  total_payment?: number
  status: 'issued' | 'paid' | 'void'
  payment_status?: 'pending' | 'partial' | 'paid'
  due_date?: string
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  billed_branch?: { id: number; name: string }
  /** Relasi invoice → SO → PO (sumber kode PO, supplier, buyer). */
  invoice_sales_orders?: InvoiceSalesOrderRef[]
  additional_charges?: { id: number; name: string; amount: number; chart_of_account_id?: number | null }[]
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  issued: { label: 'Issued', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  void: { label: 'Void', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const PAYMENT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Unpaid', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  partial: { label: 'Partial', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
}

interface OrderRow {
  key: string
  poId?: number
  poCode: string
  soCode: string
  date?: string
  total: number
}

/** Satu baris per SO yang ditagihkan, dengan data PO asalnya. */
function buildOrderRows(refs: InvoiceSalesOrderRef[] | undefined): OrderRow[] {
  return (refs ?? []).map((ref, i) => {
    const so = ref.sales_order
    const po = so?.purchase_order
    return {
      key: String(ref.id ?? ref.sales_order_id ?? i),
      poId: po?.id,
      poCode: po?.code || '—',
      soCode: so?.code || (ref.sales_order_id ? `SO #${ref.sales_order_id}` : '—'),
      date: po?.date ?? so?.date,
      total: Number(so?.total_price ?? po?.total_price ?? 0),
    }
  })
}

const rp = (n: number | string | null | undefined) =>
  `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

const rpRounded = (n: number | string | null | undefined) =>
  `Rp ${Math.round(Number(n ?? 0)).toLocaleString('id-ID')}`

export default function InvoiceDetail({ id }: InvoiceDetailProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('invoice.read')
  const canVoid = hasPermission('invoice.delete')
  const [voidConfirmOpen, setVoidConfirmOpen] = React.useState(false)
  // Warehouse / production also open the company's other branches' invoices.
  const { isCentral, activeBranchId, scopeParams } = useCentralCompanyScope()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice-detail', id, scopeParams.scope],
    queryFn: () =>
      invoicesService
        .get(id, {
          // Detail item tidak diambil — PO/SO cukup dari invoice_sales_orders
          // (sales_order.purchase_order ikut ter-nest di response).
          // Catatan: include `sales_order_details` membuat GET /invoices/{id}
          // membalas 500 — jangan dipakai di sini.
          include: 'updated_by,billed_branch,invoice_sales_orders,created_by,additional_charges',
          ...scopeParams,
        })
        .then((r) => r.data),
    enabled: canRead && !!id && !isNaN(id),
  })

  const invoice = (data as any)?.data as InvoiceFull | undefined

  const [showPaymentForm, setShowPaymentForm] = React.useState(false)
  const [paymentMethodId, setPaymentMethodId] = React.useState<number>(0)
  const [paymentAmount, setPaymentAmount] = React.useState<number>(0)
  const [paymentDescription, setPaymentDescription] = React.useState<string>('')

  const { data: paymentsData } = useQuery({
    queryKey: ['invoice-payments', id, scopeParams.scope],
    enabled: canRead && !!id && !isNaN(id),
    // filter[invoice_id] matches payments.allocations.invoice_id on the API.
    // Page through every result so no payment is dropped by a per_page cap.
    queryFn: async () => {
      const all: any[] = []
      for (let page = 1; page <= 50; page++) {
        const res = await paymentsService.list({
          page,
          per_page: 200,
          include: 'payment_method,bank_account,allocations',
          'filter[invoice_id]': id,
          ...scopeParams,
        } as any)
        const body = (res.data as any) ?? {}
        all.push(...(body.data ?? []))
        const lastPage = Number(body.meta?.total_pages ?? body.meta?.last_page ?? 1)
        if (page >= lastPage) break
      }
      return all
    },
  })

  // Keep only payments with an allocation on this invoice (guards against an
  // API that ignores the filter).
  const payments = ((paymentsData as any[]) ?? []).filter((p: any) =>
    p.allocations?.some((a: any) => Number(a.invoice_id) === Number(id))
  )

  const voidMutation = useMutation({
    mutationFn: () => invoicesService.void(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('Invoice voided')
      setVoidConfirmOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to void invoice'),
  })

  // An invoice raised from purchase orders (every billed SO came from a PO —
  // the inter-branch flow) is paid with purchase-side methods; any other
  // invoice with sales-side ones. filter[type] also returns type "all". The
  // API applies the same rule to a receive payment.
  const invoiceSalesOrders = invoice?.invoice_sales_orders ?? []
  const fromPurchaseOrders =
    invoiceSalesOrders.length > 0 &&
    invoiceSalesOrders.every((ref) => !!ref.sales_order?.purchase_order?.id)
  // An inter-branch invoice is paid into one of the company's Kas/Bank
  // accounts (bank_account_id); any other invoice with a customer payment method.
  const { data: pmData } = useQuery({
    queryKey: ['payment-methods-all', 'sales_orders', 'active'],
    enabled: canRead && !!id && !!invoice && !fromPurchaseOrders,
    queryFn: () =>
      paymentMethodsService
        .list({ per_page: 50, sort: 'id', 'filter[type]': 'sales_orders', 'filter[is_active]': true } as any)
        .then((r) => r.data),
  })
  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts-all', 'active'],
    enabled: canRead && !!id && !!invoice && fromPurchaseOrders,
    queryFn: () =>
      bankAccountsService
        .list({ per_page: 200, 'filter[is_active]': true, sort: 'bank_name' } as any)
        .then((r) => r.data),
  })
  const sourceOptions: { id: number; name: string }[] = fromPurchaseOrders
    ? (((bankAccountsData as any)?.data ?? []) as any[]).map((b) => ({
        id: b.id,
        name: [b.bank_name, b.account_number, b.account_name].filter(Boolean).join(' · '),
      }))
    : ((pmData as any)?.data ?? [])

  const createPaymentMutation = useMutation({
    mutationFn: () =>
      paymentsService.create({
        // Money received against the issuer's receivable (receive journal:
        // DR the method's account / CR Piutang), whichever method list is shown.
        type: 'receive',
        date: new Date().toLocaleDateString('en-CA'),
        payments: [{
          ...(fromPurchaseOrders
            ? { bank_account_id: paymentMethodId }
            : { payment_method_id: paymentMethodId }),
          amount: paymentAmount,
          description: paymentDescription || undefined,
          allocations: [{ invoice_id: id, amount: paymentAmount }],
        }],
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', id] })
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] })
      toast.success('Payment recorded')
      setPaymentMethodId(0)
      setPaymentAmount(0)
      setPaymentDescription('')
      setShowPaymentForm(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to record payment'),
  })

  const orderRows = useMemo(() => buildOrderRows(invoice?.invoice_sales_orders), [invoice])

  const statusMeta = STATUS_META[invoice?.status as keyof typeof STATUS_META] ?? STATUS_META.issued
  // Print kop = company of the issuing branch.
  const printCompany = usePrintCompany(invoice?.branch?.id ?? invoice?.branch_id, invoice?.branch?.name)
  // Payment status: pakai field backend; fallback turunan dari pembayaran.
  const paymentStatusValue: string =
    invoice?.payment_status ??
    (Number(invoice?.total_payment ?? 0) <= 0
      ? 'pending'
      : Number(invoice?.total_payment ?? 0) >= Number(invoice?.total_price ?? 0)
        ? 'paid'
        : 'partial')
  const paymentMeta = PAYMENT_STATUS_META[paymentStatusValue] ?? PAYMENT_STATUS_META.pending
  const due = getInvoiceDueInfo(invoice)

  // Excel copy of what the page shows: header info, orders, totals, payments.
  const exportExcel = () => {
    if (!invoice) return
    const totalPaid = Number(invoice.total_payment ?? 0)
    const rows: ExcelRow[] = [
      ['Invoice', invoice.code],
      ['Dapur Cokelat Indonesia'],
      [],
      ['Billed branch', invoice.billed_branch?.name ?? ''],
      ['Seller branch', invoice.branch?.name ?? ''],
      ['Invoice status', statusMeta.label],
      ['Payment status', paymentMeta.label],
      ['Invoice date', invoice.date ? formatDate(invoice.date) : ''],
      ['Due date', invoice.due_date ? formatDate(invoice.due_date) : ''],
      ...(due.isOverdue ? [['Overdue', `${due.daysOverdue} day(s)`] as ExcelRow] : []),
      ...(invoice.description ? [['Notes', invoice.description] as ExcelRow] : []),
      [],
      ['No', 'PO', 'SO', 'Date', 'Total'],
      ...orderRows.map((row, i) => [
        i + 1,
        row.poCode,
        row.soCode,
        row.date ? formatDate(row.date) : '',
        money(row.total),
      ]),
      [],
      ['', '', '', 'Subtotal', money(invoice.subtotal_price ?? 0)],
      ...((invoice.discount_price ?? 0) > 0
        ? [['', '', '', 'Discount', money(-Number(invoice.discount_price))] as ExcelRow]
        : []),
      ...(invoice.additional_charges ?? []).map(
        (ac) => ['', '', '', ac.name, money(ac.amount)] as ExcelRow,
      ),
      ...(Number(invoice.handling_fee_amount ?? 0) > 0
        ? [['', '', '', `Handling fee (${Number(invoice.handling_fee_percent ?? 0)}%)`, money(Number(invoice.handling_fee_amount))] as ExcelRow]
        : []),
      ['', '', '', 'Tax', money(Math.round(Number(invoice.tax_amount ?? 0)))],
      ['', '', '', 'Total', money(invoice.total_price)],
      ['', '', '', 'Total paid', money(totalPaid)],
      ['', '', '', 'Balance due', money(Number(invoice.total_price ?? 0) - totalPaid)],
    ]
    if (payments.length > 0) {
      rows.push([], ['Payments'], ['No', 'Date', 'Method', 'Reference', 'Amount'])
      payments.forEach((p: any, i: number) => {
        const allocation = p.allocations?.find((a: any) => a.invoice_id === invoice.id)
        rows.push([
          i + 1,
          p.date ? formatDate(p.date) : '',
          paymentSourceLabel(p, ''),
          p.reference_number ?? '',
          money(allocation?.amount ?? p.amount),
        ])
      })
    }
    downloadExcel(`invoice-${invoice.code ?? invoice.id}.xlsx`, [
      { name: 'Invoice', rows, cols: [16, 22, 22, 16, 18] },
    ])
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  }


  if (!canRead) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--warning)' }}>
          You do not have permission to view invoices.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading invoice...</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <PackageSearch size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>Invoice not found</p>
        <BackLink href="/transfer/invoices" label="Invoices" style={{ marginTop: 16 }} />
      </div>
    )
  }

  const total = Number(invoice.total_price ?? 0)
  const paid = Number(invoice.total_payment ?? 0)
  const balance = Math.max(0, total - paid)
  const paidPct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0
  // A payment is recorded at the invoice's own branches: a warehouse viewing
  // another branch's invoice (company scope) only reads it.
  const ownInvoice =
    !isCentral || invoice.branch_id === activeBranchId || invoice.billed_branch_id === activeBranchId
  const canRecordPayment =
    ownInvoice && invoice.status !== 'paid' && invoice.status !== 'void' && !showPaymentForm && total > 0 && balance > 0

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  }

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
  }

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: 0,
  }

  const pillStyle = (meta: { color: string; bg: string }): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    background: meta.bg,
    color: meta.color,
    whiteSpace: 'nowrap',
  })

  const secondaryBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--foreground)',
    cursor: 'pointer',
  }

  const primaryBtnStyle: React.CSSProperties = {
    ...secondaryBtnStyle,
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    color: 'white',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 20px',
    fontSize: 13,
    borderBottom: '1px solid var(--border)',
  }

  const summaryRow = (label: React.ReactNode, value: React.ReactNode, opts?: { color?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13 }}>
      <span style={{ color: opts?.color ?? 'var(--foreground-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: opts?.color ?? 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )

  const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    marginBottom: 6,
  }

  const fieldInputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface)',
    fontSize: 13,
    color: 'var(--foreground)',
  }

  return (
    <div
      style={{
        padding: '28px 32px 64px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BackLink href="/transfer/invoices" label="Invoices" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                {invoice.code}
              </h1>
              <span style={pillStyle(statusMeta)}>{statusMeta.label}</span>
              <span style={pillStyle(paymentMeta)}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: paymentMeta.color }} />
                {paymentMeta.label}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '6px 0 0' }}>
              Billed to <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{invoice.billed_branch?.name ?? '—'}</strong>
              {invoice.branch?.name && (
                <> · from <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{invoice.branch.name}</strong></>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {canVoid && (() => {
              const reason = invoiceVoidBlock(invoice)
              return (
                <button
                  type="button"
                  onClick={() => { if (!reason) setVoidConfirmOpen(true) }}
                  disabled={!!reason}
                  title={reason ?? 'Void this invoice'}
                  style={{ ...secondaryBtnStyle, color: 'var(--destructive)', ...(reason ? blockedStyle : {}) }}
                >
                  <Ban size={14} />
                  Void invoice
                </button>
              )
            })()}
            <button type="button" onClick={exportExcel} style={secondaryBtnStyle}>
              <FileSpreadsheet size={14} />
              Export Excel
            </button>
            <button type="button" onClick={() => window.print()} style={primaryBtnStyle}>
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Summary: key dates + payment progress */}
      <div style={cardStyle}>
        <div className="inv-meta-grid">
          {[
            { label: 'Invoice date', value: invoice.date ? formatDate(invoice.date) : '—' },
            {
              label: 'Due date',
              value: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: due.isOverdue ? 'var(--destructive)' : 'var(--foreground)' }}>
                    {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                  </span>
                  {due.isOverdue && (
                    <span style={pillStyle({ color: 'var(--destructive)', bg: 'var(--destructive-bg)' })}>
                      {due.daysOverdue} day{due.daysOverdue === 1 ? '' : 's'} overdue
                    </span>
                  )}
                </span>
              ),
            },
            { label: 'Billed to', value: invoice.billed_branch?.name ?? '—' },
            { label: 'Issued by', value: invoice.branch?.name ?? '—' },
          ].map((f) => (
            <div key={f.label} className="inv-meta-cell">
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{f.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', minWidth: 0 }}>{f.value}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
            padding: '18px 20px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--background)',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              {balance > 0 ? 'Balance due' : 'Fully paid'}
            </span>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: balance > 0 ? (due.isOverdue ? 'var(--destructive)' : 'var(--foreground)') : 'var(--success)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              {rp(balance > 0 ? balance : total)}
            </div>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>of {rp(total)} total</span>
          </div>

          <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ color: 'var(--foreground-muted)' }}>
                Paid <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{rp(paid)}</strong>
              </span>
              <span style={{ fontWeight: 600, color: paymentMeta.color }}>{Math.round(paidPct)}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${paidPct}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: paymentMeta.color,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.description && (
        <div style={{ ...cardStyle, padding: '14px 20px' }}>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>Notes</span>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{invoice.description}</p>
        </div>
      )}

      {/* Orders + totals */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <h2 style={cardTitleStyle}>Orders</h2>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {orderRows.length} order{orderRows.length === 1 ? '' : 's'}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)' }}>
              <th style={{ ...thStyle, width: 48, padding: '10px 20px' }}>#</th>
              <th style={{ ...thStyle, padding: '10px 20px' }}>Purchase order</th>
              <th style={{ ...thStyle, padding: '10px 20px' }}>Date</th>
              <th style={{ ...thStyle, padding: '10px 20px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {orderRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, padding: 32, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                  No orders on this invoice
                </td>
              </tr>
            ) : (
              orderRows.map((row, index) => (
                <tr key={row.key}>
                  <td style={{ ...tdStyle, color: 'var(--foreground-subtle)', fontSize: 12 }}>{index + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {row.poId ? (
                        <Link
                          href={`/purchase/purchase-orders/${row.poId}/detail`}
                          style={{ fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace' }}
                        >
                          <span className="v2-link">{row.poCode}<ArrowUpRight size={12} /></span>
                        </Link>
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--foreground)', fontFamily: 'monospace' }}>{row.poCode}</span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{row.soCode}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                    {row.date ? formatDate(row.date) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {rp(row.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 20px' }}>
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summaryRow('Subtotal', rp(invoice.subtotal_price ?? 0))}
            {(invoice.discount_price ?? 0) > 0 && summaryRow('Discount', `-${rp(invoice.discount_price)}`)}
            {invoice.additional_charges?.length
              ? invoice.additional_charges.map((ac) => (
                  <React.Fragment key={`ac-${ac.id}`}>{summaryRow(ac.name || 'Additional charges', rp(ac.amount))}</React.Fragment>
                ))
              : (invoice.additional_charge_price ?? 0) !== 0 && summaryRow('Additional charges', rp(invoice.additional_charge_price))}
            {Number(invoice.handling_fee_amount ?? 0) > 0 &&
              summaryRow(`Handling fee (${Number(invoice.handling_fee_percent ?? 0)}%)`, rp(invoice.handling_fee_amount))}
            {summaryRow('Tax', rpRounded(invoice.tax_amount))}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{rp(total)}</span>
            </div>
            {paid > 0 && (
              <>
                {summaryRow('Paid', `-${rp(paid)}`, { color: 'var(--success)' })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Balance due</span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: balance > 0 ? 'var(--destructive)' : 'var(--success)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {rp(total - paid)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payments */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={cardTitleStyle}>Payments</h2>
            {payments.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>· {payments.length}</span>
            )}
          </div>
          {canRecordPayment && (
            <button
              type="button"
              onClick={() => setShowPaymentForm(true)}
              style={{ ...primaryBtnStyle, padding: '6px 12px' }}
            >
              <Plus size={14} />
              Record Payment
            </button>
          )}
        </div>

        {showPaymentForm && (
          <div style={{ padding: 20, background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={fieldLabelStyle}>{fromPurchaseOrders ? 'Received into (Kas / Bank)' : 'Payment method'}</label>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                  style={fieldInputStyle}
                >
                  <option value={0}>{fromPurchaseOrders ? 'Select account...' : 'Select method...'}</option>
                  {sourceOptions.map((pm: any) => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>Amount</label>
                {/* Pemisah ribuan otomatis saat mengetik (1000 → 1.000) */}
                <LocalizedNumberInput
                  value={paymentAmount || null}
                  onChange={setPaymentAmount}
                  decimals={2}
                  padDecimals={false}
                  placeholder={`Max: ${formatNumberId(invoice.total_price, 2, { pad: false })}`}
                  style={{ textAlign: 'left' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>Description (optional)</label>
              <input
                type="text"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="Payment notes..."
                style={fieldInputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowPaymentForm(false)} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createPaymentMutation.mutate()}
                disabled={paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending}
                style={{
                  ...primaryBtnStyle,
                  cursor: paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending ? 0.6 : 1,
                }}
              >
                {createPaymentMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Save Payment
              </button>
            </div>
          </div>
        )}

        {payments.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--background)' }}>
                <th style={{ ...thStyle, padding: '10px 20px' }}>Date</th>
                <th style={{ ...thStyle, padding: '10px 20px' }}>Method</th>
                <th style={{ ...thStyle, padding: '10px 20px' }}>Reference</th>
                <th style={{ ...thStyle, padding: '10px 20px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => {
                const allocation = p.allocations?.find((a: any) => a.invoice_id === invoice.id)
                return (
                  <tr key={p.id}>
                    <td style={{ ...tdStyle, color: 'var(--foreground)' }}>{formatDate(p.date)}</td>
                    <td style={{ ...tdStyle, color: 'var(--foreground)' }}>{paymentSourceLabel(p)}</td>
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                      {p.reference_number ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                      {rp(allocation?.amount ?? p.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          !showPaymentForm && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <Wallet size={28} style={{ color: 'var(--foreground-subtle)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: 0 }}>No payments recorded yet</p>
            </div>
          )
        )}
      </div>

      {/* Printable A4 invoice (hidden on screen, shown only in print) */}
      <PrintDocument
        title="INVOICE"
        company={printCompany}
        meta={[
          { label: 'Invoice No.', value: invoice.code || '-' },
          { label: 'Date', value: invoice.date ? formatPrintDate(invoice.date) : '-' },
          { label: 'Billed To', value: invoice.billed_branch?.name || '-' },
          { label: 'Due Date', value: invoice.due_date ? formatPrintDate(invoice.due_date) : '-' },
          { label: 'From', value: invoice.branch?.name || '-' },
          { label: 'Status', value: String(statusMeta.label).toUpperCase() },
        ]}
        columns={[
          { header: 'NO', width: '11mm', align: 'center' },
          { header: 'PO / SO' },
          { header: 'DATE', width: '30mm', nowrap: true },
          { header: 'TOTAL', width: '38mm', align: 'right', nowrap: true },
        ]}
        rows={orderRows.map((row, i) => ({
          key: row.key,
          cells: [
            i + 1,
            <>
              {row.poCode}
              {row.soCode ? <div style={{ fontSize: '8pt' }}>{row.soCode}</div> : null}
            </>,
            row.date ? formatPrintDate(row.date) : '-',
            rp(row.total),
          ],
        }))}
        afterTable={
          <PrintTotals
            lines={[
              { label: 'Subtotal', value: rp(invoice.subtotal_price ?? 0) },
              ...((invoice.discount_price ?? 0) > 0 ? [{ label: 'Discount', value: `-${rp(invoice.discount_price)}` }] : []),
              ...(invoice.additional_charges?.length
                ? invoice.additional_charges.map((ac) => ({ label: ac.name || 'Additional Charges', value: rp(ac.amount) }))
                : (invoice.additional_charge_price ?? 0) !== 0
                  ? [{ label: 'Additional Charges', value: rp(invoice.additional_charge_price) }]
                  : []),
              ...(Number(invoice.handling_fee_amount ?? 0) > 0
                ? [{ label: `Handling fee (${Number(invoice.handling_fee_percent ?? 0)}%)`, value: rp(invoice.handling_fee_amount) }]
                : []),
              { label: 'Tax', value: rpRounded(invoice.tax_amount) },
              { label: 'Grand Total', value: rp(invoice.total_price), strong: true, ruleAbove: true },
            ]}
          />
        }
        fileTitle={printFileTitle(
          `Invoice ${invoice.code ?? ''}`,
          invoice.billed_branch?.name,
          invoice.date ? formatPrintDate(invoice.date) : '',
        )}
      />

      {voidConfirmOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setVoidConfirmOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 400, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Void {invoice.code}?</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              The invoice is marked void and its journal is reversed. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setVoidConfirmOpen(false)} style={secondaryBtnStyle}>Cancel</button>
              <button
                type="button"
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending}
                style={{ ...primaryBtnStyle, background: 'var(--destructive)', border: '1px solid var(--destructive)', opacity: voidMutation.isPending ? 0.7 : 1 }}
              >
                {voidMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Void invoice
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .inv-meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .inv-meta-cell { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; min-width: 0; }
        .inv-meta-cell + .inv-meta-cell { border-left: 1px solid var(--border); }
        @media (max-width: 760px) {
          .inv-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .inv-meta-cell:nth-child(3) { border-left: none; }
          .inv-meta-cell:nth-child(n + 3) { border-top: 1px solid var(--border); }
        }
      `}</style>
    </div>
  )
}
