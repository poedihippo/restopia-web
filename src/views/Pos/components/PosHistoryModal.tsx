import React from 'react'
import { formatCurrency } from '@/utils/price';
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { salesOrdersService } from '@/services/sales-orders.service'
import { toastMutationApiError } from '@/utils/apiError'

const SETTLEMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--foreground-muted)', bg: 'var(--background)' },
  credit: { label: 'Credit', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

interface PosHistoryModalProps {
  showHistory: boolean
  setShowHistory: (val: boolean) => void
  historySearch: string
  setHistorySearch: (val: string) => void
  historyDateFrom: string
  setHistoryDateFrom: (val: string) => void
  historyDateTo: string
  setHistoryDateTo: (val: string) => void
  historyPage: number
  setHistoryPage: (val: number | ((prev: number) => number)) => void
  historyOrders: any[]
  historyMeta: any
  isHistoryLoading: boolean
}

export default function PosHistoryModal({
  showHistory,
  setShowHistory,
  historySearch,
  setHistorySearch,
  historyDateFrom,
  setHistoryDateFrom,
  historyDateTo,
  setHistoryDateTo,
  historyPage,
  setHistoryPage,
  historyOrders,
  historyMeta,
  isHistoryLoading,
}: PosHistoryModalProps) {
  const qc = useQueryClient()

  const returnOrderMutation = useMutation({
    mutationFn: (order: { id: number; code?: string }) => salesOrdersService.returnOrder(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-history'] })
      qc.invalidateQueries({ queryKey: ['product-inventories-pos'] })
      toast.success('Order returned successfully')
    },
    onError: (err: any, order) => {
      // A paid-out online order sharing its payout with other orders can't be
      // returned until that payout is moved back to pending.
      const message: string = err?.response?.data?.message ?? ''
      const fieldMessages = Object.values(err?.response?.data?.errors ?? {}).flat().map(String)
      const shared = [message, ...fieldMessages].find((m) => /paid out together/i.test(m))
      if (err?.response?.status === 422 && shared) {
        toast.error(shared, {
          duration: 10000,
          action: {
            label: 'Undo payout',
            onClick: () =>
              window.open(
                `/sales/settle-payout?tab=settled&search=${encodeURIComponent(order.code ?? '')}`,
                '_blank',
              ),
          },
        })
        return
      }
      toastMutationApiError(err, 'Failed to return order')
    },
  })

  if (!showHistory) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setShowHistory(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.35)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 90,
          width: 480, background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 56, padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)', fontSize: 18,
              fontWeight: 700, color: 'var(--accent)',
            }}
          >
            Transaction History
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => {
                setHistoryDateFrom(e.target.value)
                setHistoryPage(1)
              }}
              style={{
                height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '0 6px', fontSize: 12, color: 'var(--foreground)', background: 'var(--background)',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>—</span>
            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => {
                setHistoryDateTo(e.target.value)
                setHistoryPage(1)
              }}
              style={{
                height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '0 6px', fontSize: 12, color: 'var(--foreground)', background: 'var(--background)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              fontSize: 22, cursor: 'pointer', color: 'var(--foreground-muted)', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div
          style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
        >
          <input
            type="text"
            placeholder="Search by order code or customer..."
            value={historySearch}
            onChange={(e) => {
              setHistorySearch(e.target.value)
              setHistoryPage(1)
            }}
            style={{
              width: '100%', height: 36, border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 13,
              color: 'var(--foreground)', background: 'var(--background)', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Orders list */}
        <div
          style={{
            flex: 1, overflowY: 'auto', padding: '12px 20px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {isHistoryLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 80, borderRadius: 'var(--radius-md)',
                  background: 'var(--border)', opacity: 0.5,
                }}
              />
            ))}

          {!isHistoryLoading && historyOrders.length === 0 && (
            <div
              style={{ textAlign: 'center', padding: '48px 0', color: 'var(--foreground-muted)' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              <p style={{ fontSize: 14 }}>No transactions today</p>
            </div>
          )}

          {historyOrders.map((order: any) => (
            <div
              key={order.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                padding: '12px 16px', background: 'var(--background)',
              }}
            >
              {/* Order header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>
                  {order.code}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(() => {
                    const settlementMeta =
                      SETTLEMENT_META[order.settlement_status as string] ?? SETTLEMENT_META.pending
                    return (
                      <span
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-xl)',
                          background: settlementMeta.bg, color: settlementMeta.color,
                        }}
                      >
                        {settlementMeta.label}
                      </span>
                    )
                  })()}
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-xl)',
                      background: order.status === 'final' ? 'var(--success-bg)' : 'var(--warning-bg)',
                      color: order.status === 'final' ? 'var(--success)' : 'var(--warning)', textTransform: 'capitalize',
                    }}
                  >
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Customer + date row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {order.customer_name || order.customer?.name || 'Walk-in'}
                  {order.customer_phone ? ` 📞 ${order.customer_phone}` : ''}
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                  {order.created_at}
                </span>
              </div>

              {/* Items summary */}
              {order.sales_order_details && order.sales_order_details.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 8 }}>
                  {order.sales_order_details.length} item(s)
                </div>
              )}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                  {formatCurrency(Number(order.total_price))}
                </span>
              </div>

              {/* Return button — only for final orders without deliveries/invoices, not already cancelled */}
              {order.status === 'final' &&
                order.settlement_status !== 'cancelled' &&
                !order.has_delivery &&
                !order.has_invoice && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Return order ${order.code}? This will reverse all payments and restore stock.`)) {
                      returnOrderMutation.mutate({ id: order.id, code: order.code })
                    }
                  }}
                  disabled={returnOrderMutation.isPending}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    padding: '6px 12px',
                    border: '1px solid var(--destructive)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--destructive-bg)',
                    color: 'var(--destructive)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    opacity: returnOrderMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {returnOrderMutation.isPending ? 'Returning...' : '↩ Return Order'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {historyMeta && historyMeta.last_page > 1 && (
          <div
            style={{
              padding: '12px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              style={{
                height: 32, padding: '0 14px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                color: historyPage === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
                cursor: historyPage === 1 ? 'not-allowed' : 'pointer', fontSize: 13,
              }}
            >
              « Prev
            </button>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              Page {historyPage} of {historyMeta.last_page}
            </span>
            <button
              type="button"
              onClick={() => setHistoryPage((p) => Math.min(historyMeta.last_page, p + 1))}
              disabled={historyPage === historyMeta.last_page}
              style={{
                height: 32, padding: '0 14px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                color: historyPage === historyMeta.last_page ? 'var(--foreground-subtle)' : 'var(--foreground)',
                cursor: historyPage === historyMeta.last_page ? 'not-allowed' : 'pointer', fontSize: 13,
              }}
            >
              Next »
            </button>
          </div>
        )}
      </div>
    </>
  )
}
