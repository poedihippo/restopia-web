import React from 'react'
import { formatCurrency } from '@/utils/price';

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
