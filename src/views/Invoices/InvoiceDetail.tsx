'use client'
import { formatDate } from '@/utils/date'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { invoicesService } from '@/services/invoices.service'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft,
  Calendar,
  Building2,
  Truck,
  FileText,
  Printer,
  PackageSearch,
  Wallet,
  Loader2,
  Plus
} from 'lucide-react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentsService } from '@/services/payments.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'

interface InvoiceDetailProps {
  id: number
}

/** Detail Sales Order yang dirujuk invoice — sumber nama produk baris. */
interface SoDetailSnapshot {
  id?: number
  product_inventory_snapshot?: {
    product_uom_batch?: {
      product_uom?: {
        name?: string | null
        product?: { name: string }
        uom?: { name: string }
      }
    }
  }
  /** Snapshot product-UOM dari SO — sumber nama produk yang selalu terisi. */
  product_uom_snapshot?: {
    name?: string
    product?: { name?: string }
    uom?: { name?: string }
  } | null
  bundle_snapshot?: { name?: string } | null
}

interface InvoiceDetailLine {
  id: number
  qty: number
  price: number
  dpp: number
  is_taxable: boolean
  tax_rate: number
  tax_amount: number
  total_price?: number
  description?: string
  receipt_id?: number
  sales_order_detail_id?: number
  sales_order_detail?: SoDetailSnapshot
}

interface InvoiceFull {
  id: number
  code: string
  date: string
  subtotal_price?: number
  discount_price?: number
  additional_charge_price?: number
  tax_amount?: number
  total_price: number
  total_payment?: number
  status: 'issued' | 'paid' | 'void'
  payment_status?: 'pending' | 'partial' | 'paid'
  due_date?: string
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  billed_branch?: { id: number; name: string }
  invoice_details?: InvoiceDetailLine[]
  /** Include `sales_order_details` — cadangan resolve nama bila nested tidak ikut. */
  sales_order_details?: SoDetailSnapshot[]
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

/**
 * Nama item baris invoice (dipakai tabel layar & tabel cetak).
 * Payload Sales Order menyimpan nama produk di
 * `sales_order_detail.product_uom_snapshot` — path itu yang diprioritaskan;
 * snapshot inventory/bundle dipertahankan sebagai fallback, terakhir Item #id.
 */
function lineItemText(
  line: InvoiceDetailLine,
  soLineMap?: Record<number, SoDetailSnapshot | undefined>,
): string {
  const soLine =
    line.sales_order_detail ??
    (line.sales_order_detail_id != null ? soLineMap?.[line.sales_order_detail_id] : undefined)
  const snap = soLine?.product_uom_snapshot
  const invPu = soLine?.product_inventory_snapshot?.product_uom_batch?.product_uom
  const name =
    snap?.product?.name ||
    invPu?.product?.name ||
    soLine?.bundle_snapshot?.name ||
    getProductUomName(invPu, invPu?.product?.name) ||
    `Item #${line.id}`
  const uom = snap?.uom?.name || invPu?.uom?.name
  return uom ? `${name} (${uom})` : name
}

const rp = (n: number | string | null | undefined) =>
  `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

const rpRounded = (n: number | string | null | undefined) =>
  `Rp ${Math.round(Number(n ?? 0)).toLocaleString('id-ID')}`

export default function InvoiceDetail({ id }: InvoiceDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('invoice.read')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: () =>
      invoicesService
        .get(id, {
          include: 'updated_by,billed_branch,invoice_details,invoice_details.sales_order_detail,sales_order_details,created_by,additional_charges',
        })
        .then((r) => r.data),
    enabled: canRead && !!id && !isNaN(id),
  })

  const invoice = (data as any)?.data as InvoiceFull | undefined

  const [showPaymentForm, setShowPaymentForm] = React.useState(false)
  const [paymentMethodId, setPaymentMethodId] = React.useState<number>(0)
  const [paymentAmount, setPaymentAmount] = React.useState<number>(0)
  const [paymentDescription, setPaymentDescription] = React.useState<string>('')

  const invoiceReceiptIds = invoice?.invoice_details?.map(d => d.receipt_id).filter(Boolean) || []

  const { data: paymentsData } = useQuery({
    queryKey: ['invoice-payments', id],
    enabled: canRead && !!id && !isNaN(id),
    queryFn: () =>
      paymentsService
        .list({
          per_page: 50,
          include: 'payment_method,allocations',
          'filter[invoice_id]': id,
        } as any)
        .then((r) => r.data),
  })

  const allPayments = (paymentsData as any)?.data ?? []
  const payments = allPayments.filter((p: any) =>
    p.allocations?.some((a: any) =>
      a.invoice_id === Number(id) ||
      (a.receipt_id && invoiceReceiptIds.includes(a.receipt_id))
    )
  )

  const { data: pmData } = useQuery({
    queryKey: ['payment-methods-all'],
    enabled: canRead && !!id,
    queryFn: () =>
      paymentMethodsService
        .list({ per_page: 50, sort: 'id' } as any)
        .then((r) => r.data),
  })
  const paymentMethods = (pmData as any)?.data ?? []

  const createPaymentMutation = useMutation({
    mutationFn: () =>
      paymentsService.create({
        type: 'disburse',
        date: new Date().toISOString().split('T')[0],
        payments: [{
          payment_method_id: paymentMethodId,
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

  const details = invoice?.invoice_details || []
  // Cadangan resolve nama produk: include `sales_order_details` (array terpisah).
  const soLineMap: Record<number, SoDetailSnapshot | undefined> = {}
  for (const sod of invoice?.sales_order_details || []) {
    if (sod.id != null) soLineMap[sod.id] = sod
  }

  const statusMeta = STATUS_META[invoice?.status as keyof typeof STATUS_META] ?? STATUS_META.issued
  // Payment status: pakai field backend; fallback turunan dari pembayaran.
  const paymentStatusValue: string =
    invoice?.payment_status ??
    (Number(invoice?.total_payment ?? 0) <= 0
      ? 'pending'
      : Number(invoice?.total_payment ?? 0) >= Number(invoice?.total_price ?? 0)
        ? 'paid'
        : 'partial')
  const paymentMeta = PAYMENT_STATUS_META[paymentStatusValue] ?? PAYMENT_STATUS_META.pending

  const backBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground-muted)',
    cursor: 'pointer',
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

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
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
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => router.push('/transfer/invoices')} style={backBtnStyle}>
            <ArrowLeft size={14} />
            Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                {invoice.code}
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  background: statusMeta.bg,
                  color: statusMeta.color,
                }}
              >
                {statusMeta.label}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Invoice</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <Printer size={13} />
          Print Invoice
        </button>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {/* Billed Branch */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Billed Branch</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.billed_branch?.name ?? '—'}
          </div>
        </div>

        {/* Seller Branch */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Seller Branch</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.branch?.name ?? '—'}
          </div>
        </div>

        {/* Delivery box removed */}

        {/* Invoice Status */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Invoice Status</span>
          </div>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '4px 12px',
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 600,
              background: statusMeta.bg,
              color: statusMeta.color,
            }}
          >
            {statusMeta.label}
          </span>
        </div>

        {/* Payment Status */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wallet size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Payment Status</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 600,
                background: paymentMeta.bg,
                color: paymentMeta.color,
              }}
            >
              {paymentMeta.label}
            </span>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              {rp(invoice.total_payment ?? 0)} / {rp(invoice.total_price)}
            </span>
          </div>
        </div>

        {/* Date */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Invoice Date</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.date ? formatDate(invoice.date) : '—'}
          </div>
        </div>
      </div>

      {/* Description block */}
      {invoice.description && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}
        >
          <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 8 }}>Notes</span>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
            {invoice.description}
          </p>
        </div>
      )}

      {/* Line items table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={sectionLabelStyle}>Line Items</span>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{details.length} item(s)</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, width: 50 }}>#</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Unit Price</th>
              <th style={{ ...thStyle, width: 160, textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                  No items found
                </td>
              </tr>
            ) : (
              details.map((line, index) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>{index + 1}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {lineItemText(line, soLineMap)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {line.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {rp(line.price)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--foreground)', textAlign: 'right' }}>
                    {rp(line.dpp ?? (line.qty * line.price))}
                  </td>
                </tr>
              ))
            )}

            {/* Totals */}
            <tr style={{ background: 'var(--background)', borderTop: '2px solid var(--border)' }}>
              <td colSpan={4} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: 'var(--foreground-muted)' }}>
                Subtotal
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                {rp(invoice.subtotal_price ?? details.reduce((sum, d) => sum + (d.dpp ?? 0), 0))}
              </td>
            </tr>
            {(invoice.discount_price ?? 0) > 0 && (
              <tr style={{ background: 'var(--background)' }}>
                <td colSpan={4} style={{ padding: '6px 16px', textAlign: 'right', fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Discount
                </td>
                <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                  -{rp(invoice.discount_price)}
                </td>
              </tr>
            )}
            {invoice.additional_charges?.length ? (
              invoice.additional_charges.map((ac) => (
                <tr key={`ac-${ac.id}`} style={{ background: 'var(--background)' }}>
                  <td colSpan={4} style={{ padding: '6px 16px', textAlign: 'right', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {ac.name || 'Additional Charges'}
                  </td>
                  <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                    {rp(ac.amount)}
                  </td>
                </tr>
              ))
            ) : (invoice.additional_charge_price ?? 0) !== 0 ? (
              <tr style={{ background: 'var(--background)' }}>
                <td colSpan={4} style={{ padding: '6px 16px', textAlign: 'right', fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Additional Charges
                </td>
                <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                  {rp(invoice.additional_charge_price)}
                </td>
              </tr>
            ) : null}
            <tr style={{ background: 'var(--background)' }}>
              <td colSpan={4} style={{ padding: '6px 16px 14px', textAlign: 'right', fontSize: 12, color: 'var(--foreground-muted)' }}>
                Tax
              </td>
              <td style={{ padding: '6px 16px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                {rpRounded(invoice.tax_amount)}
              </td>
            </tr>
            <tr style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
              <td colSpan={4} style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)' }}>
                Grand Total
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
                  {rp(invoice.total_price)}
                </span>
              </td>
            </tr>
            {invoice.total_payment ? (
              <>
                <tr style={{ background: 'var(--surface)' }}>
                  <td colSpan={4} style={{ padding: '6px 16px', textAlign: 'right', fontSize: 12, color: 'var(--success)' }}>
                    Total Paid
                  </td>
                  <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                    -{rp(invoice.total_payment)}
                  </td>
                </tr>
                <tr style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={4} style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--destructive)' }}>
                    Balance Due
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--destructive)', fontFamily: 'var(--font-display)' }}>
                      {rp(invoice.total_price - invoice.total_payment)}
                    </span>
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 32, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>Payments</h2>
          {invoice.status !== 'paid' && invoice.status !== 'void' && !showPaymentForm && Number(invoice.total_price ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setShowPaymentForm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Record Payment
            </button>
          )}
        </div>

        {showPaymentForm && (
          <div
            style={{
              padding: 20,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 16 }}>
              New Payment
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}
                >
                  <option value={0}>Select method...</option>
                  {paymentMethods.map((pm: any) => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  Amount
                </label>
                <input
                  type="number"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder={`Max: ${invoice.total_price}`}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                Description (Optional)
              </label>
              <input
                type="text"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="Payment notes..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                style={{
                  padding: '7px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createPaymentMutation.mutate()}
                disabled={paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending ? 0.7 : 1,
                }}
              >
                {createPaymentMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Record Payment
              </button>
            </div>
          </div>
        )}

        {payments.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Method</th>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Allocated Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => {
                  const allocation = p.allocations?.find((a: any) => a.invoice_id === invoice.id)
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground)' }}>
                        {formatDate(p.date)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground)' }}>
                        {p.payment_method?.name ?? '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground)' }}>
                        {p.reference_number ?? '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {rp(allocation?.amount ?? p.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>No payments recorded for this invoice.</p>
          </div>
        )}
      </div>

      {/* 🖨️ Printable A4 invoice (hidden on screen, shown only in print) */}
      <div className="invoice-print">
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            backgroundColor: '#5c3a21',
            color: '#fff',
            padding: '10mm 0',
            marginBottom: '6mm',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <div style={{ fontSize: '24pt', fontWeight: 800, letterSpacing: '2px' }}>DAPUR COKLAT</div>
          <div style={{ fontSize: '14pt', fontWeight: 600, marginTop: '2mm', letterSpacing: '1px', opacity: 0.9 }}>
            INVOICE
          </div>
        </div>

        {/* Invoice info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm', padding: '0 4mm' }}>
          <div>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: '#5c3a21', textTransform: 'uppercase' }}>
              Billed To
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: '2mm', color: '#333' }}>
              {invoice.billed_branch?.name || '-'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Invoice No:</strong> {invoice.code || '-'}
            </div>
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Date:</strong> {invoice.date ? formatDate(invoice.date) : '-'}
            </div>
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>From:</strong> {invoice.branch?.name || '-'}
            </div>
          </div>
        </div>

        {/* Status label */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6mm', padding: '0 4mm' }}>
          <div
            style={{
              padding: '6px 16px',
              border: `2px solid ${statusMeta.color}`,
              backgroundColor: statusMeta.color + '15',
              color: statusMeta.color,
              fontWeight: 800,
              fontSize: '12pt',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {statusMeta.label}
          </div>
        </div>

        {/* Line items */}
        <div style={{ padding: '0 4mm', marginBottom: '8mm' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0e6d2', color: '#5c3a21' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  No
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Product
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Qty
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Unit Price
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {details.map((line, i) => (
                <tr key={line.id} style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#444' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#222', fontWeight: 500 }}>
                    {lineItemText(line, soLineMap)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#444' }}>{line.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#444' }}>{rp(line.price)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 600 }}>
                    {rp(line.dpp ?? (line.qty * line.price))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4mm' }}>
          <div style={{ width: '50%', backgroundColor: '#fdfbf7', padding: '16px', borderRadius: '8px', border: '1px solid #f0e6d2' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', fontSize: '10pt', color: '#5c3a21', borderTop: '2px dashed #d4c4a8' }}>
                    Subtotal
                  </td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#5c3a21', borderTop: '2px dashed #d4c4a8' }}>
                    {rp(invoice.subtotal_price ?? details.reduce((sum, d) => sum + (d.dpp ?? 0), 0))}
                  </td>
                </tr>
                {(invoice.discount_price ?? 0) > 0 && (
                  <tr>
                    <td style={{ padding: '4px 0', fontSize: '10pt', color: '#5c3a21' }}>Discount</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#5c3a21' }}>-{rp(invoice.discount_price)}</td>
                  </tr>
                )}
                {invoice.additional_charges?.length ? (
                  invoice.additional_charges.map((ac) => (
                    <tr key={`print-ac-${ac.id}`}>
                      <td style={{ padding: '4px 0', fontSize: '10pt', color: '#5c3a21' }}>{ac.name || 'Additional Charges'}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#5c3a21' }}>{rp(ac.amount)}</td>
                    </tr>
                  ))
                ) : (invoice.additional_charge_price ?? 0) !== 0 ? (
                  <tr>
                    <td style={{ padding: '4px 0', fontSize: '10pt', color: '#5c3a21' }}>Additional Charges</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#5c3a21' }}>{rp(invoice.additional_charge_price)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{ padding: '4px 0', fontSize: '10pt', color: '#5c3a21' }}>Tax</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#5c3a21' }}>{rpRounded(invoice.tax_amount)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', fontSize: '11pt', fontWeight: 700, color: '#5c3a21', borderTop: '2px dashed #d4c4a8' }}>
                    Grand Total
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '12pt', fontWeight: 800, color: '#5c3a21', borderTop: '2px dashed #d4c4a8' }}>
                    {rp(invoice.total_price)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .invoice-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          /* Enforce background colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Defeat the global pos-print.css rule that otherwise collapses #__next and blanks this page. */
          body > * { display: block !important; }
          #pos-receipt { display: none !important; }
          /* Isolate: hide the on-screen detail UI, show only the invoice. */
          body * { visibility: hidden !important; }
          .invoice-print, .invoice-print * { visibility: visible !important; }
          .invoice-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            font-family: 'Inter', Arial, Helvetica, sans-serif;
          }
          .invoice-print thead { display: table-header-group; }
        }
      `}</style>
    </div>
  )
}
