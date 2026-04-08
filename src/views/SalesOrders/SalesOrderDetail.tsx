'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import salesOrderService from '@/services/sales-order.service';
import { toastMutationApiError } from '@/utils/apiError';
import SalesOrdersDetail from './Detail/SalesOrdersDetail';

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

  const { data: orderPayload } = useQuery({
    queryKey: ['sales-order-detail-actions', id],
    enabled: router.isReady && Number.isFinite(id) && id > 0,
    queryFn: () =>
      salesOrderService.findById(id, { include: 'customer' }).then((r) => r.data),
  });
  const order = (orderPayload as any)?.data;

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

      <SalesOrdersDetail id={id} />

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
