'use client';
import { formatCurrency } from '@/utils/price';

import { useState, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, Check, User, Printer, Pencil, RotateCcw, Receipt } from 'lucide-react';
import BackLink from '@/components/BackLink';
import { salesOrdersService as salesOrderService } from '@/services/sales-orders.service';
import { paymentsService } from '@/services/payments.service';
import { paymentMethodsService } from '@/services/payment-methods.service';
import { toastMutationApiError } from '@/utils/apiError';
import ReturnOrderModal from './ReturnOrderModal';
import { useAuth } from '@/hooks/useAuth';
import SaleJournals from './SaleJournals';
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { formatNumberId } from '@/utils/numberFormat'
import { formatDate, formatDateTime } from '@/utils/date'
import { lineNameOf, parseSnapshot } from '@/views/Pos/utils/receiptFromOrder'
import { useReprintReceipt } from '@/views/Pos/hooks/useReprintReceipt'

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
}

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 20px',
  minHeight: 52,
  borderBottom: '1px solid var(--border)',
}

const cardTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }

const thStyle: CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  background: 'var(--background)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}

const dlStyle: CSSProperties = { margin: 0, padding: '4px 20px' }

const noteStyle: CSSProperties = {
  padding: '10px 20px',
  fontSize: 12,
  lineHeight: 1.5,
  borderBottom: '1px solid var(--border)',
}

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

const inputStyle: CSSProperties = {
  height: 38,
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
}

const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 36,
  padding: '0 14px',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
}

const primaryButtonStyle: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: '#fff',
}

const iconButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  flexShrink: 0,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  cursor: 'pointer',
}

type BadgeMeta = { label: string; color: string; bg: string }

const ORDER_STATUS_META: Record<string, BadgeMeta> = {
  final: { label: 'Final', color: 'var(--success)', bg: 'var(--success-bg)' },
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
}

const DETAIL_STATUS_META: Record<string, BadgeMeta> = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  process: { label: 'In Progress', color: 'var(--info)', bg: 'var(--info-bg)' },
  completed: { label: 'Completed', color: 'var(--success)', bg: 'var(--success-bg)' },
}

function Badge({ label, color, bg }: BadgeMeta) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        padding: '9px 0',
        borderBottom: '1px dashed var(--border)',
        fontSize: 13,
      }}
    >
      <dt style={{ color: 'var(--foreground-muted)', flexShrink: 0 }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 500, color: 'var(--foreground)', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}
      </dd>
    </div>
  )
}

function TotalRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--foreground-muted)' }}>{label}</span>
      <span style={{ color: 'var(--foreground)' }}>{value}</span>
    </div>
  )
}

function Stamp({ who, when }: { who?: string; when?: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <span>{who || '—'}</span>
      {when && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--foreground-muted)' }}>{formatDateTime(when)}</span>}
    </span>
  )
}

const titleCase = (v?: string | null) =>
  v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'

function lineCodeOf(d: any): string {
  const snap = parseSnapshot(d.product_inventory_snapshot)
  const uomSnap = d.product_uom_snapshot
  return (
    uomSnap?.product?.code ??
    uomSnap?.code ??
    snap?.product_uom_batch?.product_uom?.product?.code ??
    snap?.product_uom?.product?.code ??
    snap?.code ??
    d.product_inventory?.code ??
    d.product_uom_batch?.product_uom?.code ??
    d.bundle?.code ??
    '—'
  )
}

const SETTLEMENT_META: Record<string, BadgeMeta> = {
  pending: { label: 'Pending', color: 'var(--foreground-muted)', bg: 'var(--background)' },
  credit: { label: 'Credit', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

export default function SalesOrderDetail() {
  const router = useRouter();
  const raw = router.query.id;
  const id =
    typeof raw === 'string'
      ? Number(raw)
      : Array.isArray(raw)
        ? Number(raw[0])
        : NaN;

  const [showDelete, setShowDelete] = useState(false);

  const idReady = router.isReady && Number.isFinite(id) && id > 0

  const { data, isLoading } = useQuery({
    queryKey: ['sales-order-detail', id],
    enabled: idReady,
    queryFn: () =>
      salesOrderService
        .findById(id, {
          include:
            'branch,buyer_branch,customer,created_by,updated_by,purchase_order,credit_by,sales_order_details,sales_channel,media,additional_charges',
        })
        .then((r) => r.data),
  });
  const order = (data as any)?.data;
  const details = order?.sales_order_details ?? []

  const subtotal = Number(order?.subtotal_price ?? 0)
  const discount = Number(order?.discount_price ?? 0)
  const total = Number(order?.total_price ?? 0)

  const queryClient = useQueryClient()

  const { data: allocationsData } = useQuery({
    queryKey: ['sales-order-payment-allocations', id],
    enabled: idReady,
    queryFn: () =>
      paymentsService
        .listAllocations({
          per_page: 50,
          include: 'payment',
          'filter[sales_order_id]': id,
        } as any)
        .then((r) => r.data),
  });
  const allocations: any[] = (allocationsData as any)?.data ?? []
  const payments: any[] = useMemo(
    () =>
      allocations.map((a: any) => ({
        id: a.payment?.id ?? a.payment_id,
        allocation_id: a.id,
        amount: a.amount,
        // Marketplace fee taken from this order's share of an online payout.
        fee_amount: Number(a.fee_amount ?? 0),
        // Cash change given on this tender; tendered = amount + change.
        change_amount: Number(a.payment?.change_amount ?? 0),
        description: a.payment?.payment_number ?? '',
        created_at: a.payment?.created_at ?? a.payment?.date,
        date: a.payment?.date,
        payment_method: a.payment?.payment_method,
        is_reversed: a.payment?.is_reversed,
        // `refund` = money paid back for a partial return (outgoing).
        type: a.payment?.type,
      })),
    [allocations],
  )
  // Partial returns: the order is worth total − returned_amount, and the
  // server's total_payment is already net of refunds.
  const returnedAmount = Number(order?.returned_amount ?? 0)
  const refundedAmount = Number(order?.refunded_amount ?? 0)
  const hasPartialReturns = returnedAmount > 0
  const effectiveTotal = total - returnedAmount
  const allocatedPaid = useMemo(
    () =>
      allocations.reduce(
        (s: number, a: any) =>
          s + (a.payment?.type === 'refund' ? -1 : 1) * Number(a.amount ?? 0),
        0,
      ),
    [allocations],
  )
  const totalPaid =
    order?.total_payment != null ? Number(order.total_payment) : allocatedPaid
  const remaining =
    order?.remaining_payment != null
      ? Number(order.remaining_payment)
      : effectiveTotal - totalPaid
  const isFullyPaid = order?.payment_status
    ? order.payment_status === 'paid'
    : remaining <= 0 && effectiveTotal > 0

  let paymentStatus = 'UNPAID'
  let paymentStatusColor = 'var(--destructive)' // red
  if (isFullyPaid) {
    paymentStatus = 'PAID'
    paymentStatusColor = 'var(--success)' // green
  } else if (totalPaid > 0) {
    paymentStatus = 'PARTIAL'
    paymentStatusColor = 'var(--warning)' // orange
  }

  const { hasPermission } = useAuth()
  const canReturn = hasPermission('sales-order.return') || hasPermission('point-of-sale.return')
  const canSeeJournals = hasPermission('journal.menu')
  const { reprint, printingId } = useReprintReceipt()
  const [showReturn, setShowReturn] = useState(false)

  const { data: paymentMethodsData } = useQuery({
    queryKey: ['payment-methods-all', 'sales_orders', 'active'],
    enabled: idReady,
    queryFn: () =>
      paymentMethodsService
        .list({ per_page: 50, sort: 'id', 'filter[type]': 'sales_orders', 'filter[is_active]': true } as any)
        .then((r) => r.data),
  })
  const paymentMethods: any[] = (paymentMethodsData as any)?.data ?? []

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<number>(0)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentDescription, setPaymentDescription] = useState<string>('')

  const createPaymentMutation = useMutation({
    mutationFn: () =>
      paymentsService.create({
        type: 'receive',
        date: new Date().toLocaleDateString('en-CA'),
        payments: [{
          payment_method_id: paymentMethodId,
          amount: paymentAmount,
          description: paymentDescription || undefined,
          allocations: [{ sales_order_id: id, amount: paymentAmount }],
        }],
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-payment-allocations', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-edit', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['unpaid-offline-orders'] })
      toast.success('Payment recorded')
      setPaymentMethodId(0)
      setPaymentAmount(0)
      setPaymentDescription('')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to record payment'),
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => paymentsService.delete(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-payment-allocations', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-edit', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['unpaid-offline-orders'] })
      toast.success('Payment deleted')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete payment'),
  })

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: () => salesOrderService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['unpaid-offline-orders'] });
      queryClient.removeQueries({ queryKey: ['sales-order-detail', id] });
      queryClient.removeQueries({ queryKey: ['sales-order-edit', id] });
      toast.success('Order deleted');
      router.push('/sales/sales-orders');
    },
    onError: (err: any) => toastMutationApiError(err),
  });

  if (!router.isReady || Number.isNaN(id) || id < 1) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: 'var(--font-sans)',
          color: 'var(--foreground-muted)',
        }}
      >
        Loading…
      </div>
    );
  }

  // funds_status: Cash/Visa/BCA money not yet settled into the bank. It takes
  // the badge's place; settlement_status (the sale journal) stays as it is.
  const settlementMeta = order?.funds_status === 'awaiting_settlement'
    ? { label: 'Menunggu settlement', color: 'var(--warning)', bg: 'var(--warning-bg)' }
    : order?.settlement_status
      ? SETTLEMENT_META[order.settlement_status as string] ?? SETTLEMENT_META.pending
      : null
  const paymentBadge = isFullyPaid
    ? { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' }
    : totalPaid > 0
      ? { label: 'Partially paid', color: 'var(--warning)', bg: 'var(--warning-bg)' }
      : { label: 'Unpaid', color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
  const statusBadge = ORDER_STATUS_META[order?.status as string] ?? {
    label: order?.status ? String(order.status) : '—',
    color: 'var(--foreground-muted)',
    bg: 'var(--background)',
  }
  const customerName = order?.customer_name || order?.customer?.name || 'Walk-in customer'
  const customerPhone = order?.customer_phone || order?.customer?.phone || ''
  // Cash change (kembalian) kept by the server; handed over = total_payment + change_amount.
  const changeAmount = Number(order?.change_amount ?? 0)
  const media: any[] = order?.media ?? []
  const isOnlinePendingPayout = order?.type === 'online' && order?.settlement_status === 'pending'
  const canAddPayment = !isFullyPaid && !isOnlinePendingPayout

  const orderInfo: { label: string; value: ReactNode }[] = [
    { label: 'Order date', value: formatDate(order?.date) },
    { label: 'Fulfillment', value: order?.fulfillment_date ? formatDateTime(order.fulfillment_date) : '—' },
    { label: 'Type', value: titleCase(order?.type) },
    ...(order?.sales_channel_id
      ? [{ label: 'Sales channel', value: order.sales_channel?.name ?? `Channel #${order.sales_channel_id}` }]
      : []),
    { label: 'Branch', value: order?.branch?.name ?? '—' },
    ...(order?.buyer_branch_id
      ? [{ label: 'Buyer branch', value: order.buyer_branch?.name ?? `Branch #${order.buyer_branch_id}` }]
      : []),
    ...(order?.purchase_order_id
      ? [{ label: 'Linked PO', value: order.purchase_order?.code ?? `PO-${order.purchase_order_id}` }]
      : []),
    ...(settlementMeta
      ? [{ label: 'Settlement', value: <Badge {...settlementMeta} /> }]
      : []),
    ...(order?.settlement_status === 'credit' && order?.credit_type === 'customer'
      ? [{ label: 'Credit', value: 'Customer credit' }]
      : []),
    ...(order?.credit_by_id
      ? [{
          label: 'Credit by',
          value: (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span>{order.credit_by?.name ?? `User #${order.credit_by_id}`}</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--foreground-muted)' }}>
                Limit Rp {Number(order.credit_by?.credit ?? 0).toLocaleString('id-ID')}
              </span>
            </span>
          ),
        }]
      : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BackLink href="/sales/sales-orders" label="Sales Orders" />
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--foreground)' }}>
                {isLoading ? 'Loading…' : order?.code ?? '—'}
              </h1>
              {order && <Badge {...statusBadge} />}
              {order && <Badge {...paymentBadge} />}
              {hasPartialReturns && <Badge label="Partially returned" color="var(--warning)" bg="var(--warning-bg)" />}
            </div>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              {order
                ? [formatDate(order.date), order.branch?.name, order.created_by?.name && `by ${order.created_by.name}`]
                    .filter(Boolean)
                    .join(' · ')
                : ' '}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => window.print()} style={secondaryButtonStyle}>
            <Printer size={15} />
            Print Invoice
          </button>
          {order?.status === 'final' && (
            <button
              type="button"
              onClick={() => reprint(id)}
              disabled={printingId === id}
              style={{ ...secondaryButtonStyle, opacity: printingId === id ? 0.6 : 1 }}
            >
              {printingId === id ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Receipt size={15} />}
              Print Receipt
            </button>
          )}
          {canReturn &&
            order?.status === 'final' &&
            order?.settlement_status !== 'cancelled' &&
            !order?.has_delivery &&
            !order?.has_invoice && (
            <button type="button" onClick={() => setShowReturn(true)} style={secondaryButtonStyle}>
              <RotateCcw size={15} />
              {hasPartialReturns ? 'Return Remaining' : 'Return'}
            </button>
          )}
          {/* An order with partial returns can no longer be edited or voided. */}
          {!hasPartialReturns && (
            <>
              <button
                type="button"
                onClick={() => router.push(`/sales/sales-orders/${id}/edit`)}
                style={secondaryButtonStyle}
              >
                <Pencil size={15} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                style={{ ...secondaryButtonStyle, color: 'var(--destructive)' }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="so-detail-grid">
        {/* ── Main column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Items */}
          <section style={cardStyle} aria-busy={isLoading}>
            <div style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Items</span>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                {details.length} line{details.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 40 }}>#</th>
                    <th style={thStyle}>Product</th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 70 }}>Qty</th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 130 }}>Unit price</th>
                    <th style={{ ...thStyle, width: 120 }}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 150 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    Array.from({ length: 4 }).map((_, skIdx) => (
                      <tr key={`sk-${skIdx}`}>
                        {Array.from({ length: 6 }).map((__, c) => (
                          <td key={c} style={tdStyle}>
                            <div style={{ height: 12, borderRadius: 4, background: 'var(--background)' }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!isLoading && details.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: 'var(--foreground-muted)' }}>
                        No line items
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    details.map((d: any, idx: number) => {
                      const isBundle = !!d.bundle_id
                      const statusVal = d.status || parseSnapshot(d.product_inventory_snapshot)?.status
                      const statusMeta = DETAIL_STATUS_META[statusVal] ?? {
                        label: statusVal ?? '—',
                        color: 'var(--foreground-muted)',
                        bg: 'var(--background)',
                      }
                      // Line total = dpp − discount_amount (voucher share) + tax_amount (PPN after discount).
                      const dpp = Number(d.dpp ?? Number(d.price) * Number(d.qty))
                      const lineDiscount = Number(d.discount_amount ?? 0)
                      const lineTax = Number(d.tax_amount ?? 0)
                      const lineTotal =
                        d.total_price != null ? Number(d.total_price) : dpp - lineDiscount + lineTax
                      const hasBreakdown = lineDiscount > 0 || lineTax > 0
                      return (
                        <tr key={d.id ?? idx}>
                          <td style={{ ...tdStyle, color: 'var(--foreground-subtle)' }}>{idx + 1}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isBundle && <Badge label="Bundle" color="var(--info)" bg="var(--info-bg)" />}
                              <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{lineNameOf(d, idx)}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>{lineCodeOf(d)}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{d.qty}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>Rp {Number(d.price).toLocaleString('id-ID')}</td>
                          <td style={tdStyle}>
                            <Badge {...statusMeta} />
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                            Rp {(hasBreakdown ? lineTotal : dpp).toLocaleString('id-ID')}
                            {hasBreakdown && (
                              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--foreground-muted)', marginTop: 2 }}>
                                DPP {dpp.toLocaleString('id-ID')}
                                {lineDiscount > 0 && <> · Disc −{lineDiscount.toLocaleString('id-ID')}</>}
                                {lineTax > 0 && <> · PPN {lineTax.toLocaleString('id-ID')}</>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <TotalRow label="Subtotal" value={`Rp ${subtotal.toLocaleString('id-ID')}`} />
                {(order?.additional_charges || []).map((c: any, i: number) => (
                  <TotalRow
                    key={i}
                    label={
                      <>
                        {c.name} {c.tax ? `(Incl. ${c.tax.name} ${c.tax.rate}%)` : ''}
                        {c.description ? <span style={{ display: 'block', fontSize: 11 }}>{c.description}</span> : null}
                      </>
                    }
                    value={`Rp ${Number(c.amount ?? 0).toLocaleString('id-ID')}`}
                  />
                ))}
                {Number(order?.tax_amount ?? 0) > 0 && (
                  <TotalRow label="Tax" value={`Rp ${Number(order?.tax_amount ?? 0).toLocaleString('id-ID')}`} />
                )}
                {discount > 0 && (
                  <TotalRow
                    label="Discount"
                    value={<span style={{ color: 'var(--success)' }}>− Rp {discount.toLocaleString('id-ID')}</span>}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 2, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>Rp {total.toLocaleString('id-ID')}</span>
                </div>
                {hasPartialReturns && (
                  <>
                    <TotalRow
                      label="Returned"
                      value={<span style={{ color: 'var(--warning)' }}>− Rp {returnedAmount.toLocaleString('id-ID')}</span>}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Net total</span>
                      <span style={{ color: 'var(--accent)' }}>Rp {effectiveTotal.toLocaleString('id-ID')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Payments */}
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={cardTitleStyle}>Payments</span>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{payments.length} recorded</span>
              </div>
              {isFullyPaid ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                  <Check size={14} /> Fully paid
                </span>
              ) : isOnlinePendingPayout ? (
                // Marketplace orders are paid by a payout — recording a payment here
                // would mark them paid while settlement stays pending.
                <button
                  type="button"
                  onClick={() => router.push(`/sales/settle-payout?search=${encodeURIComponent(order.code ?? '')}`)}
                  style={primaryButtonStyle}
                >
                  Settle via Payout
                </button>
              ) : canAddPayment && !showPaymentForm ? (
                <button type="button" onClick={() => setShowPaymentForm(true)} style={primaryButtonStyle}>
                  <Plus size={14} /> Add Payment
                </button>
              ) : null}
            </div>

            {order?.settlement_status === 'credit' && order?.credit_type === 'user' && order?.credit_by_id && (
              <div style={{ ...noteStyle, color: 'var(--warning)', background: 'var(--warning-bg)' }}>
                This order uses staff credit for {order.credit_by?.name ?? 'a user'}. To deduct from their credit
                balance, record a payment using the &apos;Credit&apos; method.
              </div>
            )}
            {order?.settlement_status === 'credit' && order?.credit_type === 'customer' && (
              <div style={{ ...noteStyle, color: 'var(--info)', background: 'var(--info-bg)' }}>
                Customer credit — no user balance is tracked for this order.
              </div>
            )}

            {showPaymentForm && (
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', background: 'var(--background)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Payment method</span>
                    <select
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                      style={inputStyle}
                    >
                      <option value={0} disabled>Select method</option>
                      {paymentMethods.map((pm: any) => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={fieldStyle}>
                    <span style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                      Amount (Rp)
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(Math.max(0, remaining))}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}
                      >
                        <span className="v2-link">Fill remaining</span>
                      </button>
                    </span>
                    <LocalizedNumberInput
                      value={paymentAmount}
                      onChange={setPaymentAmount}
                      decimals={2}
                      placeholder={`Rp ${formatNumberId(Math.max(0, remaining), 2)}`}
                    />
                  </label>
                </div>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Description (optional)</span>
                  <input
                    type="text"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    placeholder="e.g. Cash payment, Transfer BCA"
                    style={inputStyle}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setShowPaymentForm(false)} style={secondaryButtonStyle}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => createPaymentMutation.mutate()}
                    disabled={paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending}
                    style={{
                      ...primaryButtonStyle,
                      opacity: paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending ? 0.6 : 1,
                      cursor: paymentMethodId === 0 || paymentAmount <= 0 || createPaymentMutation.isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {createPaymentMutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    Record Payment
                  </button>
                </div>
              </div>
            )}

            {payments.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 170 }}>Date</th>
                      <th style={{ ...thStyle, width: 170 }}>Method</th>
                      <th style={thStyle}>Reference</th>
                      <th style={{ ...thStyle, textAlign: 'right', width: 170 }}>Amount</th>
                      <th style={{ ...thStyle, width: 48 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => {
                      const isDeleting =
                        deletePaymentMutation.isPending && (deletePaymentMutation.variables as any) === p.id
                      return (
                        <tr key={p.allocation_id ?? p.id}>
                          <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                            {formatDateTime(p.created_at ?? p.date)}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {p.payment_method?.name ?? '—'}
                              {p.type === 'refund' && <Badge label="Refund" color="var(--destructive)" bg="var(--destructive-bg)" />}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{p.description || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: p.type === 'refund' ? 'var(--destructive)' : 'var(--foreground)' }}>
                            {p.type === 'refund' ? '− ' : ''}Rp {Number(p.amount ?? 0).toLocaleString('id-ID')}
                            {p.change_amount > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--foreground-muted)', marginTop: 2 }}>
                                Tendered {(Number(p.amount ?? 0) + p.change_amount).toLocaleString('id-ID')} · Change{' '}
                                {p.change_amount.toLocaleString('id-ID')}
                              </div>
                            )}
                            {p.fee_amount > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--foreground-muted)', marginTop: 2 }}>
                                Fee −{p.fee_amount.toLocaleString('id-ID')} · Net{' '}
                                {(Number(p.amount ?? 0) - p.fee_amount).toLocaleString('id-ID')}
                              </div>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {/* A refund, or a payment of an order that was refunded, can't be deleted. */}
                            {p.type !== 'refund' && refundedAmount <= 0 && (
                              <button
                                type="button"
                                onClick={() => deletePaymentMutation.mutate(p.id)}
                                disabled={isDeleting}
                                title="Delete payment"
                                style={{ ...iconButtonStyle, width: 30, height: 30, border: 'none', color: 'var(--destructive)' }}
                              >
                                {isDeleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
                No payments recorded yet
              </div>
            )}
          </section>

          {/* Journals: sales journal + payment journal(s) — shows the Piutang step */}
          {canSeeJournals && (
            <SaleJournals
              order={order}
              payments={allocations.map((a: any) => ({
                id: a.payment?.id ?? a.payment_id,
                journal_id: a.payment?.journal_id,
                method: a.payment?.payment_method?.name,
                number: a.payment?.payment_number,
                settlement_status: a.payment?.settlement_status,
                settlement_id: a.payment?.payment_settlement_id,
              }))}
              cardStyle={cardStyle}
              cardHeaderStyle={cardHeaderStyle}
              cardTitleStyle={cardTitleStyle}
            />
          )}

          {order?.description && (
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardTitleStyle}>Notes</span>
              </div>
              <p style={{ margin: 0, padding: '14px 20px', fontSize: 13, lineHeight: 1.6, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
                {order.description}
              </p>
            </section>
          )}

          {media.length > 0 && (
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardTitleStyle}>Images</span>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{media.length}</span>
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
                {media.map((item: any, index: number) => (
                  <button
                    key={item.id ?? index}
                    type="button"
                    onClick={() => window.open(item.url)}
                    title={item.file_name ?? ''}
                    style={{ position: 'relative', aspectRatio: '1 / 1', padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--background)', cursor: 'pointer' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url ?? ''} alt={item.file_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Side column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Payment summary */}
          <section style={cardStyle}>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>{hasPartialReturns ? 'Net total' : 'Order total'}</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>
                Rp {effectiveTotal.toLocaleString('id-ID')}
              </span>
              {hasPartialReturns && (
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  of Rp {total.toLocaleString('id-ID')} · returned Rp {returnedAmount.toLocaleString('id-ID')}
                </span>
              )}
            </div>
            <dl style={dlStyle}>
              {changeAmount > 0 && (
                <InfoRow label="Tendered" value={`Rp ${(totalPaid + changeAmount).toLocaleString('id-ID')}`} />
              )}
              <InfoRow label="Paid" value={<span style={{ color: 'var(--success)' }}>Rp {totalPaid.toLocaleString('id-ID')}</span>} />
              {refundedAmount > 0 && (
                <InfoRow label="Refunded" value={<span style={{ color: 'var(--destructive)' }}>Rp {refundedAmount.toLocaleString('id-ID')}</span>} />
              )}
              <InfoRow
                label="Remaining"
                value={
                  <span style={{ color: remaining > 0 ? 'var(--destructive)' : 'var(--success)' }}>
                    Rp {Math.max(0, remaining).toLocaleString('id-ID')}
                  </span>
                }
              />
              {changeAmount > 0 && (
                <InfoRow label="Change" value={`Rp ${changeAmount.toLocaleString('id-ID')}`} />
              )}
            </dl>
          </section>

          {/* Customer */}
          <section style={cardStyle}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-light-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={labelStyle}>Customer</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customerName}
                </span>
                {customerPhone && <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{customerPhone}</span>}
              </div>
            </div>
          </section>

          {/* Order info */}
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Order info</span>
            </div>
            <dl style={dlStyle}>
              {orderInfo.map((row) => (
                <InfoRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
            {order?.settlement_status === 'credit' && (
              <div style={{ ...noteStyle, borderTop: '1px solid var(--border)', borderBottom: 'none', color: 'var(--warning)', background: 'var(--warning-bg)' }}>
                Paid via credit — awaiting settlement
              </div>
            )}
          </section>

          {/* Activity */}
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Activity</span>
            </div>
            <dl style={dlStyle}>
              <InfoRow
                label="Created"
                value={<Stamp who={order?.created_by?.name} when={order?.created_at} />}
              />
              <InfoRow
                label="Updated"
                value={<Stamp who={order?.updated_by?.name} when={order?.updated_at} />}
              />
            </dl>
          </section>
        </div>
      </div>

      <style>{`
        .so-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
        @media (max-width: 1100px) { .so-detail-grid { grid-template-columns: minmax(0, 1fr); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {showReturn && (
        <ReturnOrderModal
          orderId={id}
          orderCode={order?.code}
          onClose={() => setShowReturn(false)}
        />
      )}

      {showDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                marginBottom: 8,
                color: 'var(--foreground)',
              }}
            >
              Delete Order
            </h3>
            <p
              style={{
                fontSize: 14,
                color: 'var(--foreground-muted)',
                marginBottom: 24,
              }}
            >
              Delete order <strong>{order?.code ?? '—'}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                style={{
                  flex: 1,
                  height: 40,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete()}
                disabled={deleting}
                style={{
                  flex: 1,
                  height: 40,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive)',
                  color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ Printable A4 Invoice (hidden on screen, shown only in print) */}
      <div className="invoice-print">
        {/* Header */}
        <div style={{ textAlign: 'center', backgroundColor: '#5c3a21', color: '#fff', padding: '10mm 0', marginBottom: '6mm', borderRadius: '8px 8px 0 0' }}>
          <div style={{ fontSize: '24pt', fontWeight: 800, letterSpacing: '2px' }}>
            DAPUR COKELAT
          </div>
          <div style={{ fontSize: '14pt', fontWeight: 600, marginTop: '2mm', letterSpacing: '1px', opacity: 0.9 }}>
            INVOICE
          </div>
        </div>

        {/* Invoice Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm', padding: '0 4mm' }}>
          <div>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: '#5c3a21', textTransform: 'uppercase' }}>Billed To</div>
            <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: '2mm', color: '#333' }}>{order?.customer?.name || '-'}</div>
            <div style={{ fontSize: '10pt', color: '#666', marginTop: '1mm' }}>{order?.customer?.phone || ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Invoice No:</strong> {order?.code || '-'}
            </div>
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Date:</strong> {order?.date || '-'}
            </div>
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Branch:</strong> {order?.branch?.name || '-'}
            </div>
          </div>
        </div>

        {/* Payment Status Label */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6mm', padding: '0 4mm' }}>
          <div style={{
            padding: '6px 16px',
            border: `2px solid ${paymentStatusColor}`,
            backgroundColor: paymentStatusColor + '15', // adding transparency for light background
            color: paymentStatusColor,
            fontWeight: 800,
            fontSize: '12pt',
            borderRadius: '6px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {paymentStatus}
          </div>
        </div>

        {/* Line Items */}
        <div style={{ padding: '0 4mm', marginBottom: '8mm' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0e6d2', color: '#5c3a21' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>No</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>Product Name</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>Unit Price</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {details.map((item: any, i: number) => {
                  let snap = item.product_inventory_snapshot
                  if (typeof snap === 'string') {
                      try { snap = JSON.parse(snap) } catch (e) { }
                  }
                  // Prefer product_uom_snapshot (frozen at order time)
                  const uomSnap = item.product_uom_snapshot
                  const name =
                      uomSnap?.product?.name ??
                      snap?.product_uom?.product?.name ??
                      snap?.product_uom_batch?.product_uom?.product?.name ??
                      snap?.name ??
                      item.product_inventory?.product_uom?.product?.name ??
                      item.product_uom_batch?.product_uom?.product?.name ??
                      item.bundle?.name ??
                      `Item ${item.id ?? i + 1}`

                return (
                <tr key={i} style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#444' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#222', fontWeight: 500 }}>{name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', color: '#444' }}>{item.qty}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#444' }}>{formatCurrency(Number(item.price))}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 600 }}>{formatCurrency(Number(item.price) * Number(item.qty))}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4mm' }}>
          <div style={{ width: '50%', backgroundColor: '#fdfbf7', padding: '16px', borderRadius: '8px', border: '1px solid #f0e6d2' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', fontSize: '10pt', color: '#555' }}>Subtotal</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 500 }}>{formatCurrency(subtotal)}</td>
                </tr>
                {(order?.additional_charges || []).map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 0', fontSize: '10pt', color: '#555' }}>
                      {c.name} {c.tax ? `(${c.tax.name})` : ''}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 500 }}>
                      {formatCurrency(c.amount)}
                    </td>
                  </tr>
                ))}
                <tr>
                      <td style={{ padding: '6px 0', fontSize: '10pt', color: '#555' }}>Tax</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 500 }}>{formatCurrency((order as any)?.tax_amount ?? 0)}</td>
                    </tr>
                  {discount > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0', fontSize: '10pt', color: '#555' }}>Discount</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '10pt', color: '#e11d48', fontWeight: 500 }}>- {formatCurrency(discount)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '8px 0', fontSize: '11pt', fontWeight: 700, color: '#5c3a21', borderTop: '2px dashed #d4c4a8', marginTop: '4px' }}>Grand Total</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '12pt', fontWeight: 800, color: '#5c3a21', borderTop: '2px dashed #d4c4a8', marginTop: '4px' }}>{formatCurrency(total)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', fontSize: '10pt', color: '#555' }}>Total Paid</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '10pt', color: '#16a34a', fontWeight: 600 }}>{formatCurrency(totalPaid)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', fontSize: '11pt', fontWeight: 700, color: '#5c3a21', borderTop: '1px solid #d4c4a8' }}>Remaining Balance</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '12pt', fontWeight: 800, color: remaining > 0 ? '#e11d48' : '#16a34a', borderTop: '1px solid #d4c4a8' }}>{formatCurrency(Math.max(0, remaining))}</td>
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
  );
}

