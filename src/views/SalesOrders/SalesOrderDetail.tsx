'use client';

import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import salesOrderService from '@/services/sales-order.service';
import { toastMutationApiError } from '@/utils/apiError';
import api from '@/hooks/useApi';
import SalesOrdersDetail from './Detail/SalesOrdersDetail';

const sectionStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  marginTop: 16,
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

  const { data } = useQuery({
    queryKey: ['sales-order-detail', id],
    enabled: router.isReady && Number.isFinite(id) && id > 0,
    queryFn: () =>
      api
        .get('/sales-orders', {
          params: {
            'filter[id]': id,
            include:
              'created_by,updated_by,branch,customer,media,sales_order_details',
            per_page: 1,
          },
        })
        .then((r) => r.data),
  });
  const envelope = (data as any)?.data
  const ordersList = Array.isArray(envelope)
    ? envelope
    : (envelope?.data ?? [])
  const order = ordersList[0] ?? null;

  const details = order?.sales_order_details ?? [];

  const subtotal = Number(order?.subtotal_price ?? 0)
  const discount = Number(order?.discount_price ?? 0)
  const total = Number(order?.total_price ?? 0)

  const { data: paymentsData } = useQuery({
    queryKey: ['sales-order-payments', id],
    enabled: router.isReady && Number.isFinite(id) && id > 0,
    queryFn: () =>
      api
        .get('/payments', {
          params: {
            per_page: 50,
            include: 'payment_method',
            'filter[sales_order_id]': id,
          },
        })
        .then((r) => r.data),
  });
  const paymentsEnvelope = (paymentsData as any)?.data
  const paymentsRaw = Array.isArray(paymentsEnvelope)
    ? paymentsEnvelope
    : (paymentsEnvelope as any)?.data ?? []
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : []
  const totalPaid = useMemo(
    () => payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0),
    [payments],
  )

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: () => salesOrderService.delete(id),
    onSuccess: () => {
      toast.success('Order deleted');
      router.push('/sales-orders');
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
          onClick={() => router.push(`/sales-orders/${id}/edit`)}
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

      <SalesOrdersDetail
        id={id}
        payments={payments}
        totalPaid={totalPaid}
        lineItemsSlot={
          <div style={sectionStyle}>
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
                {details.length === 0 && (
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
                {details.map((d: any, idx: number) => {
                  const isBundle = !!d.bundle_id
                  const snap = d.product_inventory_snapshot
                  const name =
                    snap?.product_uom?.product?.name ??
                    snap?.code ??
                    (isBundle ? 'Bundle' : `Item ${idx + 1}`)
                  const code = snap?.code ?? d.bundle?.code ?? '—'
                  const detailStatus: Record<
                    string,
                    { bg: string; color: string }
                  > = {
                    pending: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
                    process: { bg: 'var(--info-bg)', color: 'var(--info)' },
                    completed: { bg: 'var(--success-bg)', color: 'var(--success)' },
                  }
                  const ds =
                    detailStatus[d.status] ?? {
                      bg: 'var(--border)',
                      color: 'var(--foreground-muted)',
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
                            background: ds.bg,
                            color: ds.color,
                            textTransform: 'capitalize',
                          }}
                        >
                          {d.status}
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
    </div>
  );
}
