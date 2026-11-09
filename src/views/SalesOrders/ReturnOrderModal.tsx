'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/utils/price'
import { salesOrdersService } from '@/services/sales-orders.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { toastMutationApiError } from '@/utils/apiError'

interface ReturnOrderModalProps {
  orderId: number
  orderCode?: string
  onClose: () => void
  /** Called after a successful return (whole or partial). */
  onReturned?: () => void
}

const num = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const parseJson = (v: any) => {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

const lineName = (d: any, idx: number) => {
  const snap = parseJson(d.product_inventory_snapshot)
  const uomSnap = parseJson(d.product_uom_snapshot)
  return (
    uomSnap?.product?.name ??
    snap?.product_uom?.product?.name ??
    snap?.product_uom_batch?.product_uom?.product?.name ??
    snap?.name ??
    d.product_inventory?.product_uom?.product?.name ??
    d.bundle?.name ??
    (d.bundle_id ? 'Bundle' : `Item ${d.id ?? idx + 1}`)
  )
}

/**
 * Return a sales order — whole, or line by line (partial). A partial return of
 * a paid order refunds the customer, so the cashier picks how it is paid back.
 * The refund amount is computed by the server; the figure here is a preview
 * using the same rule: paid − (total − returned so far − this return's net).
 */
export default function ReturnOrderModal({ orderId, orderCode, onClose, onReturned }: ReturnOrderModalProps) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['sales-order-return', orderId],
    queryFn: () =>
      salesOrdersService
        .findById(orderId, { include: 'sales_order_details' })
        .then((r) => r.data),
  })
  const order: any = (data as any)?.data
  const details: any[] = order?.sales_order_details ?? []

  const { data: methodsData } = useQuery({
    queryKey: ['payment-methods-all'],
    queryFn: () =>
      paymentMethodsService
        .list({ per_page: 50, sort: 'id', 'filter[type]': 'all,sales_orders' } as any)
        .then((r) => r.data),
  })
  // The Credit tender can never pay a refund.
  const refundMethods: any[] = ((methodsData as any)?.data ?? []).filter(
    (pm: any) => !String(pm.name ?? '').toLowerCase().includes('credit'),
  )

  const returnedAmount = num(order?.returned_amount)
  const hasPartialReturns = returnedAmount > 0
  // Only an order with a posted sales journal (settled, or online) can be
  // partially returned; after a partial return only lines can be returned.
  const canPartial = order?.settlement_status === 'settled' || order?.type === 'online'
  const canWhole = !hasPartialReturns

  const [pickedMode, setMode] = useState<'whole' | 'lines'>('lines')
  // Force the only mode the order allows.
  const mode: 'whole' | 'lines' = !canPartial ? 'whole' : !canWhole ? 'lines' : pickedMode
  const [qtys, setQtys] = useState<Record<number, number>>({})
  const [refundMethodId, setRefundMethodId] = useState<number>(0)
  // Set when the server says the order was paid and needs a refund method.
  const [refundError, setRefundError] = useState<string | null>(null)

  const totalPrice = num(order?.total_price)
  const totalPayment = num(order?.total_payment)

  // Share of a line's total (dpp − discount_amount + tax_amount) per unit.
  const unitNet = (d: any) => {
    const qty = num(d.qty)
    if (qty <= 0) return 0
    const lineTotal =
      d.total_price != null
        ? num(d.total_price)
        : num(d.dpp ?? num(d.price) * qty) - num(d.discount_amount) + num(d.tax_amount)
    return lineTotal / qty
  }

  const selectedLines = details
    .filter((d) => num(qtys[d.id]) > 0)
    .map((d) => ({ sales_order_detail_id: Number(d.id), qty: num(qtys[d.id]) }))

  const thisReturnNet = details.reduce((s, d) => s + unitNet(d) * num(qtys[d.id]), 0)

  const refundEstimate =
    mode === 'lines'
      ? Math.max(0, totalPayment - (totalPrice - returnedAmount - thisReturnNet))
      : 0
  const needsRefundMethod = mode === 'lines' && (refundEstimate > 0 || !!refundError)

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'whole'
        ? salesOrdersService.returnOrder(orderId)
        : salesOrdersService.returnOrder(orderId, {
          lines: selectedLines,
          refund_payment_method_id: needsRefundMethod && refundMethodId ? refundMethodId : undefined,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-history'] })
      qc.invalidateQueries({ queryKey: ['product-inventories-pos'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-order-detail', orderId] })
      qc.invalidateQueries({ queryKey: ['sales-order-payment-allocations', orderId] })
      qc.invalidateQueries({ queryKey: ['sales-order-return', orderId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      const code = orderCode ?? order?.code
      toast.success(
        mode === 'whole'
          ? `Order ${code ?? ''} returned`
          : `Items of ${code ?? 'the order'} returned${refundEstimate > 0 ? ` · refund ${formatCurrency(refundEstimate)}` : ''}`,
      )
      onReturned?.()
      onClose()
    },
    onError: (err: any) => {
      const fieldErrors = err?.response?.data?.errors ?? {}
      const refundMsg = fieldErrors?.refund_payment_method_id
      if (refundMsg) {
        // The order is paid: ask the cashier how it is paid back, then resend.
        setRefundError(String(Array.isArray(refundMsg) ? refundMsg[0] : refundMsg))
        return
      }
      // A paid-out online order sharing its payout with other orders can't be
      // returned until that payout is moved back to pending.
      const message: string = err?.response?.data?.message ?? ''
      const fieldMessages = Object.values(fieldErrors).flat().map(String)
      const shared = [message, ...fieldMessages].find((m) => /paid out together/i.test(m))
      if (err?.response?.status === 422 && shared) {
        const code = orderCode ?? order?.code ?? ''
        toast.error(shared, {
          duration: 10000,
          action: {
            label: 'Undo payout',
            onClick: () =>
              window.open(`/sales/settle-payout?tab=settled&search=${encodeURIComponent(code)}`, '_blank'),
          },
        })
        return
      }
      toastMutationApiError(err, 'Failed to return order')
    },
  })

  const canSubmit =
    !mutation.isPending &&
    !!order &&
    (mode === 'whole'
      ? canWhole
      : selectedLines.length > 0 && (!needsRefundMethod || refundMethodId > 0))

  const setQty = (id: number, max: number, value: number) =>
    setQtys((prev) => ({ ...prev, [id]: Math.min(max, Math.max(0, value)) }))

  const tabStyle = (active: boolean, disabled: boolean): CSSProperties => ({
    flex: 1,
    height: 34,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? 'white' : disabled ? 'var(--foreground-subtle)' : 'var(--foreground)',
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  const summaryRow = (label: string, value: string, strong = false, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 14 : 13 }}>
      <span style={{ color: 'var(--foreground-muted)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: color ?? 'var(--foreground)' }}>{value}</span>
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={() => !mutation.isPending && onClose()}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}
      />
      <div
        style={{
          position: 'relative', width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
            Return {orderCode ?? order?.code ?? 'Order'}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              fontSize: 22, cursor: 'pointer', color: 'var(--foreground-muted)', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading || !order ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--foreground-muted)', fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading order…
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={!canPartial}
                  onClick={() => setMode('lines')}
                  style={tabStyle(mode === 'lines', !canPartial)}
                  title={!canPartial ? 'Only a settled or online order can be returned line by line' : undefined}
                >
                  Return items
                </button>
                <button
                  type="button"
                  disabled={!canWhole}
                  onClick={() => setMode('whole')}
                  style={tabStyle(mode === 'whole', !canWhole)}
                  title={!canWhole ? 'This order has partial returns; return its remaining lines instead' : undefined}
                >
                  Return whole order
                </button>
              </div>

              {hasPartialReturns && (
                <div
                  style={{
                    padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 12,
                    background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)',
                  }}
                >
                  This order already has partial returns ({formatCurrency(returnedAmount)}). Return the remaining quantities line by line.
                </div>
              )}

              {mode === 'whole' ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                  The whole order is returned: all payments are reversed and the stock is restored.
                </p>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {details.map((d, idx) => {
                    const max = num(d.qty)
                    const q = num(qtys[d.id])
                    return (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                          borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{lineName(d, idx)}</div>
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                            Sold {max} × {formatCurrency(num(d.price))}
                            {num(d.discount_amount) > 0 && ` · disc −${formatCurrency(num(d.discount_amount))}`}
                            {num(d.tax_amount) > 0 && ` · PPN ${formatCurrency(num(d.tax_amount))}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => setQty(d.id, max, q - 1)}
                            disabled={q <= 0}
                            style={{
                              width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface)', color: 'var(--foreground)', cursor: q <= 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={max}
                            value={q}
                            onChange={(e) => setQty(d.id, max, Number(e.target.value) || 0)}
                            style={{
                              width: 56, height: 28, textAlign: 'center', fontSize: 13,
                              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                              background: 'var(--background)', color: 'var(--foreground)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setQty(d.id, max, q + 1)}
                            disabled={q >= max}
                            style={{
                              width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface)', color: 'var(--foreground)', cursor: q >= max ? 'not-allowed' : 'pointer',
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div style={{ width: 96, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                          {q > 0 ? formatCurrency(unitNet(d) * q) : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {mode === 'lines' && (
                <div
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
                    background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  }}
                >
                  {summaryRow('Order total', formatCurrency(totalPrice))}
                  {returnedAmount > 0 && summaryRow('Returned before', `− ${formatCurrency(returnedAmount)}`)}
                  {summaryRow('This return', `− ${formatCurrency(thisReturnNet)}`)}
                  {summaryRow('Paid', formatCurrency(totalPayment))}
                  {summaryRow(
                    'Refund to customer',
                    formatCurrency(refundEstimate),
                    true,
                    refundEstimate > 0 ? 'var(--destructive)' : undefined,
                  )}
                </div>
              )}

              {needsRefundMethod && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    Refund payment method
                  </label>
                  <select
                    value={refundMethodId}
                    onChange={(e) => {
                      setRefundMethodId(Number(e.target.value))
                      setRefundError(null)
                    }}
                    style={{
                      height: 36, padding: '0 10px', fontSize: 13,
                      border: `1px solid ${refundError ? 'var(--destructive)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)',
                    }}
                  >
                    <option value={0} disabled>Select how the customer is paid back</option>
                    {refundMethods.map((pm: any) => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                  {refundError && (
                    <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{refundError}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            style={{
              height: 36, padding: '0 16px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface)',
              color: 'var(--foreground)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            style={{
              height: 36, padding: '0 16px', border: 'none',
              borderRadius: 'var(--radius-md)', background: 'var(--destructive)',
              color: 'white', fontSize: 13, fontWeight: 500,
              cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {mutation.isPending && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {mode === 'whole' ? 'Return whole order' : 'Return selected items'}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
