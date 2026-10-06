'use client';
import { formatCurrency } from '@/utils/price';

import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, Check, User, Printer } from 'lucide-react';
import { salesOrdersService as salesOrderService } from '@/services/sales-orders.service';
import { paymentsService } from '@/services/payments.service';
import { paymentMethodsService } from '@/services/payment-methods.service';
import { toastMutationApiError } from '@/utils/apiError';
import SalesOrdersDetail from './Detail/SalesOrdersDetail';
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { formatNumberId } from '@/utils/numberFormat'

const sectionStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  marginTop: 16,
}

const SETTLEMENT_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
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
            'branch,customer,created_by,purchase_order,credit_by,sales_order_details,sales_channel',
        })
        .then((r) => r.data),
  });
  const order = (data as any)?.data;
  const details = order?.sales_order_details ?? []
  const isDetailsLoading = isLoading

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
        description: a.payment?.payment_number ?? '',
        created_at: a.payment?.created_at ?? a.payment?.date,
        date: a.payment?.date,
        payment_method: a.payment?.payment_method,
        is_reversed: a.payment?.is_reversed,
      })),
    [allocations],
  )
  const totalPaid = useMemo(
    () => allocations.reduce((s: number, a: any) => s + Number(a.amount ?? 0), 0),
    [allocations],
  )
  const remaining = Number(order?.total_price ?? 0) - totalPaid
  const isFullyPaid = remaining <= 0 && Number(order?.total_price ?? 0) > 0

  let paymentStatus = 'UNPAID'
  let paymentStatusColor = 'var(--destructive)' // red
  if (isFullyPaid) {
    paymentStatus = 'PAID'
    paymentStatusColor = 'var(--success)' // green
  } else if (totalPaid > 0) {
    paymentStatus = 'PARTIAL'
    paymentStatusColor = 'var(--warning)' // orange
  }

  const { data: paymentMethodsData } = useQuery({
    queryKey: ['payment-methods-all'],
    enabled: idReady,
    queryFn: () =>
      paymentMethodsService
        .list({ per_page: 50, sort: 'id', 'filter[type]': 'all,sales_orders' } as any)
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
        date: new Date().toISOString().split('T')[0],
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
      toast.success('Payment deleted')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete payment'),
  })

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: () => salesOrderService.delete(id),
    onSuccess: () => {
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

  return (
    <div>
      <div
        style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 38,
            padding: '0 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--foreground)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Printer size={15} />
          Download Invoice
        </button>
        <button
          type="button"
          onClick={() => router.push(`/sales/sales-orders/${id}/edit`)}
          style={{
            height: 38,
            padding: '0 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--foreground)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Edit Order
        </button>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          style={{
            height: 38,
            padding: '0 16px',
            border: '1px solid var(--destructive)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--destructive)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Delete
        </button>
      </div>

      {(order?.purchase_order_id || order?.buyer_branch_id || order?.sales_channel_id || order?.credit_by_id) && (
        <div
          style={{
            ...sectionStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          {order?.purchase_order_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Linked PO
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--accent)',
                }}
              >
                {order.purchase_order?.code ?? `PO-${order.purchase_order_id}`}
              </span>
            </div>
          )}
          {order?.buyer_branch_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Buyer Branch
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                {order.buyer_branch?.name ?? `Branch #${order.buyer_branch_id}`}
              </span>
            </div>
          )}
          {order?.sales_channel_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'var(--accent-light-bg)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Sales Channel
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                {order.sales_channel?.name ?? `Channel #${order.sales_channel_id}`}
              </span>
            </div>
          )}
          {order?.settlement_status === 'credit' && order?.credit_type === 'customer' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 99,
                  background: 'var(--info-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={14} color="var(--info)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  Credit Type
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  Customer Credit
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  {order.customer?.name ?? `Customer #${order.customer_id ?? '—'}`}
                  {' · no user balance tracked'}
                </span>
              </div>
            </div>
          )}
          {order?.credit_by_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 99,
                  background: 'var(--accent-light-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={14} color="var(--accent-light)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  Credit By
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  {order.credit_by?.name ?? `User #${order.credit_by_id}`}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Limit: Rp{' '}
                  {Number(order.credit_by?.credit ?? 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {order?.settlement_status && (
        <div
          style={{
            ...sectionStyle,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--foreground-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              Settlement
            </span>
            {(() => {
              const settlementMeta =
                SETTLEMENT_META[order.settlement_status as string] ??
                SETTLEMENT_META.pending
              return (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 600,
                    background: settlementMeta.bg,
                    color: settlementMeta.color,
                  }}
                >
                  {settlementMeta.label}
                </span>
              )
            })()}
          </div>
          {order.settlement_status === 'credit' && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--warning)',
                marginTop: 2,
              }}
            >
              ⚠ Paid via credit — awaiting settlement
            </span>
          )}
        </div>
      )}

      <div style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}
            >
              Payments
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              {payments.length} payment(s) recorded
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Order Total
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                }}
              >
                Rp {Number(order?.total_price ?? 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Paid
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--success)',
                }}
              >
                Rp {totalPaid.toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Remaining
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    remaining > 0 ? 'var(--destructive)' : 'var(--success)',
                }}
              >
                Rp {Math.max(0, remaining).toLocaleString('id-ID')}
              </span>
            </div>

            {isFullyPaid ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  border: '1px solid var(--success)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Check size={13} />
                Fully Paid
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  background: 'var(--accent-light-bg)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {!showPaymentForm && <Plus size={13} />}
                {showPaymentForm ? 'Cancel' : 'Add Payment'}
              </button>
            )}
          </div>
        </div>

        {order?.settlement_status === 'credit' && order?.credit_type === 'user' && order?.credit_by_id && (
          <div
            style={{
              background: 'var(--warning-bg)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: 12,
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>
              ⚠ This order uses staff credit for {order.credit_by?.name ?? 'a user'}. To deduct from their credit balance, record a payment using the &apos;Credit&apos; method.
            </span>
          </div>
        )}
        {order?.settlement_status === 'credit' && order?.credit_type === 'customer' && (
          <div
            style={{
              background: 'var(--info-bg)',
              border: '1px solid var(--info)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: 12,
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>
              Customer credit — no user balance is tracked for this order.
            </span>
          </div>
        )}

        {showPaymentForm && (
          <div
            style={{
              padding: 16,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
                  Payment Method
                </label>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    background: 'var(--surface)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--foreground)',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value={0} disabled>
                    Select method
                  </option>
                  {paymentMethods.map((pm: any) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
                  Amount (Rp)
                </label>
                <LocalizedNumberInput
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  decimals={2}
                  placeholder={`Rp ${formatNumberId(order?.total_price ?? 0, 2)}`}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    background: 'var(--surface)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--foreground)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                }}
              >
                Description (optional)
              </label>
              <input
                type="text"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="e.g. Cash payment, Transfer BCA"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  background: 'var(--surface)',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--foreground)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                Quick fill:
              </span>
              <button
                type="button"
                onClick={() => setPaymentAmount(Math.max(0, remaining))}
                style={{
                  padding: '4px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}
              >
                Remaining (Rp {Math.max(0, remaining).toLocaleString('id-ID')})
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                disabled={
                  paymentMethodId === 0 ||
                  paymentAmount <= 0 ||
                  createPaymentMutation.isPending
                }
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
                  cursor:
                    paymentMethodId === 0 ||
                      paymentAmount <= 0 ||
                      createPaymentMutation.isPending
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    paymentMethodId === 0 ||
                      paymentAmount <= 0 ||
                      createPaymentMutation.isPending
                      ? 0.7
                      : 1,
                }}
              >
                {createPaymentMutation.isPending && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Record Payment
              </button>
            </div>
          </div>
        )}

        {payments.length > 0 ? (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  {[
                    { label: 'Date', width: 170 },
                    { label: 'Method', width: 160 },
                    { label: 'Amount', width: 160 },
                    { label: 'Description', width: undefined },
                    { label: '', width: 48 },
                  ].map((col, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '10px 14px',
                        textAlign:
                          col.label === 'Amount' ? 'right' : 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--foreground-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                        ...(col.width ? { width: col.width } : {}),
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => {
                  const dateSrc = p.created_at ?? p.date
                  const dateStr = dateSrc
                    ? dateSrc
                    : '-'
                  const isDeleting =
                    deletePaymentMutation.isPending &&
                    (deletePaymentMutation.variables as any) === p.id
                  return (
                    <tr
                      key={p.id}
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <td
                        style={{
                          padding: '10px 14px',
                          fontSize: 13,
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {dateStr}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          fontSize: 13,
                          color: 'var(--foreground)',
                        }}
                      >
                        {p.payment_method?.name ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          textAlign: 'right',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        Rp {Number(p.amount ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {p.description || '—'}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => deletePaymentMutation.mutate(p.id)}
                          disabled={isDeleting}
                          title="Delete payment"
                          style={{
                            padding: 6,
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            color: 'var(--destructive)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            opacity: isDeleting ? 0.5 : 1,
                          }}
                        >
                          {isDeleting ? (
                            <Loader2
                              size={14}
                              style={{ animation: 'spin 1s linear infinite' }}
                            />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            No payments recorded yet
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>

      <SalesOrdersDetail
        id={id}
        payments={payments}
        totalPaid={totalPaid}
        lineItemsSlot={
          <div
            style={sectionStyle}
            aria-busy={isLoading || isDetailsLoading}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 20,
                color: 'var(--foreground)',
              }}
            >
              Line Items
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Product', 'Code', 'Qty', 'Unit Price', 'Status', 'Subtotal'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--foreground-muted)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {isDetailsLoading &&
                  Array.from({ length: 4 }).map((_, skIdx) => (
                    <tr key={`sk-${skIdx}`}>
                      {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                        <td
                          key={c}
                          style={{
                            padding: '12px 12px',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div
                            style={{
                              height: 14,
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--border)',
                              opacity: 0.65,
                              width: c === 2 ? '70%' : c === 1 ? '40%' : '55%',
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!isDetailsLoading && details.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 32,
                        textAlign: 'center',
                        color: 'var(--foreground-muted)',
                        fontSize: 14,
                      }}
                    >
                      No line items
                    </td>
                  </tr>
                )}
                {!isDetailsLoading &&
                  details.map((d: any, idx: number) => {
                    const isBundle = !!d.bundle_id
                    let snap = d.product_inventory_snapshot
                    if (typeof snap === 'string') {
                      try { snap = JSON.parse(snap) } catch (e) { }
                    }
                    // Prefer product_uom_snapshot (frozen at order time) over
                    // product_inventory_snapshot which may be null.
                    const uomSnap = d.product_uom_snapshot
                    const name =
                      uomSnap?.product?.name ??
                      snap?.product_uom?.product?.name ??
                      snap?.product_uom_batch?.product_uom?.product?.name ??
                      snap?.name ??
                      d.product_inventory?.product_uom?.product?.name ??
                      d.product_uom_batch?.product_uom?.product?.name ??
                      d.bundle?.name ??
                      (isBundle ? 'Bundle' : `Item ${d.id ?? idx + 1}`)
                    const code =
                      uomSnap?.product?.code ??
                      uomSnap?.code ??
                      snap?.product_uom_batch?.product_uom?.product?.code ??
                      snap?.product_uom?.product?.code ??
                      snap?.code ??
                      d.product_inventory?.code ??
                      d.product_uom_batch?.product_uom?.code ??
                      d.bundle?.code ??
                      '—'
                    const DETAIL_STATUS_META: Record<
                      string,
                      { label: string; color: string; bg: string }
                    > = {
                      pending: {
                        label: 'Pending',
                        color: 'var(--warning)',
                        bg: 'var(--warning-bg)',
                      },
                      process: {
                        label: 'In Progress',
                        color: 'var(--info)',
                        bg: 'var(--info-bg)',
                      },
                      completed: {
                        label: 'Completed',
                        color: 'var(--success)',
                        bg: 'var(--success-bg)',
                      },
                    }
                    const statusVal = d.status || snap?.status;
                    const statusMeta =
                      DETAIL_STATUS_META[statusVal] ?? {
                        label: statusVal ?? '—',
                        color: 'var(--foreground-muted)',
                        bg: 'var(--background)',
                      }
                    return (
                      <tr key={d.id ?? idx}>
                        <td
                          style={{
                            padding: '12px 12px',
                            fontSize: 13,
                            color: 'var(--foreground-muted)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: '12px 12px',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isBundle && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: 'var(--accent)',
                                  background: 'var(--accent-light-bg)',
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                Bundle
                              </span>
                            )}
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: '12px 12px',
                            fontSize: 12,
                            color: 'var(--foreground-muted)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          {code}
                        </td>
                        <td
                          style={{
                            padding: '12px 12px',
                            fontSize: 14,
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          {d.qty}
                        </td>
                        <td
                          style={{
                            padding: '12px 12px',
                            fontSize: 14,
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          Rp {Number(d.price).toLocaleString('id-ID')}
                        </td>
                        <td
                          style={{
                            padding: '12px 12px',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-xl)',
                              background: statusMeta.bg,
                              color: statusMeta.color,
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '12px 12px',
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--accent)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          Rp {(Number(d.price) * Number(d.qty)).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <div style={{ width: 280 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: 'var(--foreground-muted)' }}>Subtotal</span>
                  <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                </div>
                {(order?.additional_charges || []).map((c: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: 'var(--foreground-muted)' }}>
                      {c.name} {c.tax ? `(Incl. ${c.tax.name} ${c.tax.rate}%)` : ''}
                      {c.description ? <span style={{display: 'block', fontSize: 11}}>{c.description}</span> : null}
                    </span>
                    <span>Rp {Number(c.amount ?? 0).toLocaleString('id-ID')}</span>
                  </div>
                ))}
                <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ color: 'var(--foreground-muted)' }}>Tax</span>
                      <span>Rp {Number((order as any)?.tax_amount ?? 0).toLocaleString('id-ID')}</span>
                    </div>
                  {discount > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ color: 'var(--foreground-muted)' }}>Discount</span>
                    <span style={{ color: 'var(--success)' }}>
                      - Rp {discount.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
                    Rp {total.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        }
      />

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

