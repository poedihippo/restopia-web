import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, ReceiptText, Search, Undo2, X } from 'lucide-react'
import { formatCurrency } from '@/utils/price';
import { useAuth } from '@/hooks/useAuth'
import ReturnOrderModal from '@/views/SalesOrders/ReturnOrderModal'
import { useReprintReceipt } from '../hooks/useReprintReceipt'

const SETTLEMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--foreground-muted)', bg: 'var(--surface-muted, var(--background))' },
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
  const { hasPermission } = useAuth()
  const canReturn = hasPermission('sales-order.return') || hasPermission('point-of-sale.return')
  // Whole or line-by-line return (with refund) happens in the return modal.
  const [returnTarget, setReturnTarget] = useState<{ id: number; code?: string } | null>(null)
  const { reprint, printingId } = useReprintReceipt()

  // Focus the search when the drawer opens (Ctrl+F also lands here while it
  // is open — see PosHeader).
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (showHistory) searchRef.current?.focus()
  }, [showHistory])

  if (!showHistory) return null

  const total = Number(historyMeta?.total ?? historyOrders.length)
  const pill = (label: string, color: string, bg: string) => (
    <span
      style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
        background: bg, color, whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
  const dateInput: React.CSSProperties = {
    flex: 1, minWidth: 0, height: 34, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: '0 10px', fontSize: 12.5, color: 'var(--foreground)', background: 'var(--surface)',
    fontFamily: 'var(--font-sans)',
  }

  return (
    <>
      <style>{`
        .pos-hist-btn {
          flex: 1; height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          border-radius: var(--radius-md); font: 500 12.5px var(--font-sans); cursor: pointer;
          border: 1px solid var(--border); background: var(--surface); color: var(--foreground);
          transition: background-color 150ms ease, border-color 150ms ease;
        }
        .pos-hist-btn:not(:disabled):hover { background: var(--surface-muted); border-color: var(--border-strong); }
        .pos-hist-btn[data-tone="danger"] { color: var(--destructive); }
        .pos-hist-btn[data-tone="danger"]:not(:disabled):hover { background: var(--destructive-bg); border-color: var(--destructive); }
        .pos-hist-btn:disabled { opacity: 0.6; cursor: wait; }
        .pos-hist-close:hover { background: var(--destructive-bg) !important; border-color: var(--destructive) !important; color: var(--destructive) !important; }
        .pos-hist-search:focus-within { border-color: var(--accent-light) !important; box-shadow: 0 0 0 3px var(--accent-light-bg); }
        .pos-hist-card { transition: border-color 150ms ease, box-shadow 150ms ease; }
        .pos-hist-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={() => setShowHistory(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(17, 17, 20, 0.28)' }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transaction history"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 90,
          width: 'min(460px, 100vw)', background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Transaction History</span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 1 }}>
              {isHistoryLoading ? 'Loading…' : `${total} transaction${total === 1 ? '' : 's'}`}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowHistory(false)}
            className="pos-hist-btn pos-hist-close"
            style={{ flex: 'none', width: 34, padding: 0, marginLeft: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <label
            className="pos-hist-search"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)',
              cursor: 'text', transition: 'border-color 150ms ease, box-shadow 150ms ease',
            }}
          >
            <Search size={15} style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              data-pos-search="history"
              type="text"
              placeholder="Search order code or customer"
              aria-label="Search transactions"
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value)
                setHistoryPage(1)
              }}
              style={{
                flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
                background: 'transparent', fontSize: 13.5, color: 'var(--foreground)', fontFamily: 'var(--font-sans)',
              }}
            />
            <kbd style={{ fontSize: 10.5, color: 'var(--foreground-subtle)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', fontFamily: 'var(--font-sans)' }}>
              Ctrl F
            </kbd>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              aria-label="From date"
              value={historyDateFrom}
              onChange={(e) => {
                setHistoryDateFrom(e.target.value)
                setHistoryPage(1)
              }}
              style={dateInput}
            />
            <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>to</span>
            <input
              type="date"
              aria-label="To date"
              value={historyDateTo}
              onChange={(e) => {
                setHistoryDateTo(e.target.value)
                setHistoryPage(1)
              }}
              style={dateInput}
            />
          </div>
        </div>

        {/* Orders list */}
        <div
          style={{
            flex: 1, overflowY: 'auto', padding: '14px 20px',
            display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--background)',
          }}
        >
          {isHistoryLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="v2-skeleton" style={{ height: 118, borderRadius: 'var(--radius-lg)' }} />
            ))}

          {!isHistoryLoading && historyOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--foreground-muted)' }}>
              <ReceiptText size={30} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--foreground-subtle)' }} />
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--foreground)' }}>No transactions found</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>Try another date range or search.</div>
            </div>
          )}

          {!isHistoryLoading && historyOrders.map((order: any) => {
            const settlementMeta = SETTLEMENT_META[order.settlement_status as string] ?? SETTLEMENT_META.pending
            const isFinal = order.status === 'final'
            const itemCount = order.sales_order_details?.length ?? 0
            const returned = Number(order.returned_amount ?? 0)
            const canReturnOrder =
              canReturn && isFinal && order.settlement_status !== 'cancelled' && !order.has_delivery && !order.has_invoice

            return (
              <div
                key={order.id}
                className="pos-hist-card"
                style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px', background: 'var(--surface)',
                }}
              >
                {/* Code + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {order.code}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {pill(settlementMeta.label, settlementMeta.color, settlementMeta.bg)}
                    {pill(
                      isFinal ? 'Final' : String(order.status ?? '').replace(/^./, (c) => c.toUpperCase()),
                      isFinal ? 'var(--success)' : 'var(--warning)',
                      isFinal ? 'var(--success-bg)' : 'var(--warning-bg)',
                    )}
                  </div>
                </div>

                {/* Who / when */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--foreground-muted)' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.customer_name || order.customer?.name || 'Walk-in'}
                    {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                    {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
                  </span>
                  <span style={{ color: 'var(--foreground-subtle)', whiteSpace: 'nowrap' }}>{order.created_at}</span>
                </div>

                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Total</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(Number(order.total_price))}
                  </span>
                </div>

                {/* Partial returns: the order is now worth total − returned. */}
                {returned > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                      <span>Returned</span>
                      <span>− {formatCurrency(returned)}</span>
                    </div>
                    {Number(order.refunded_amount ?? 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--destructive)' }}>
                        <span>Refunded</span>
                        <span>{formatCurrency(Number(order.refunded_amount))}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--foreground)' }}>
                      <span>Net total</span>
                      <span>{formatCurrency(Number(order.total_price) - returned)}</span>
                    </div>
                  </div>
                )}

                {/* Actions — return only for final orders without deliveries/invoices, not cancelled */}
                {(isFinal || canReturnOrder) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {isFinal && (
                      <button
                        type="button"
                        className="pos-hist-btn"
                        onClick={() => reprint(order.id)}
                        disabled={printingId === order.id}
                      >
                        <Printer size={14} />
                        {printingId === order.id ? 'Printing…' : 'Reprint'}
                      </button>
                    )}
                    {canReturnOrder && (
                      <button
                        type="button"
                        className="pos-hist-btn"
                        data-tone="danger"
                        onClick={() => setReturnTarget({ id: order.id, code: order.code })}
                      >
                        <Undo2 size={14} />
                        {returned > 0 ? 'Return remaining' : 'Return'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {historyMeta && historyMeta.last_page > 1 && (
          <div
            style={{
              padding: '10px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}
          >
            <button
              type="button"
              aria-label="Previous page"
              className="pos-hist-btn"
              style={{ flex: 'none', width: 34, padding: 0 }}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
              Page {historyPage} of {historyMeta.last_page}
            </span>
            <button
              type="button"
              aria-label="Next page"
              className="pos-hist-btn"
              style={{ flex: 'none', width: 34, padding: 0 }}
              onClick={() => setHistoryPage((p) => Math.min(historyMeta.last_page, p + 1))}
              disabled={historyPage === historyMeta.last_page}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {returnTarget && (
        <ReturnOrderModal
          orderId={returnTarget.id}
          orderCode={returnTarget.code}
          onClose={() => setReturnTarget(null)}
        />
      )}
    </>
  )
}
