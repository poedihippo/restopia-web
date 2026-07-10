import React from 'react'
import { formatDateTime } from '@/utils/date'

interface PosPreordersModalProps {
  showPreorders: boolean
  setShowPreorders: (val: boolean) => void
  preorderSearch: string
  setPreorderSearch: (val: string) => void
  preorderDateFrom: string
  setPreorderDateFrom: (val: string) => void
  preorderPage: number
  setPreorderPage: (val: number | ((prev: number) => number)) => void
  preorders: any[]
  preorderMeta: any
  isPreordersLoading: boolean
  loadPreorderToCart: (order: any) => void
}

export default function PosPreordersModal({
  showPreorders,
  setShowPreorders,
  preorderSearch,
  setPreorderSearch,
  preorderDateFrom,
  setPreorderDateFrom,
  preorderPage,
  setPreorderPage,
  preorders,
  preorderMeta,
  isPreordersLoading,
  loadPreorderToCart,
}: PosPreordersModalProps) {
  if (!showPreorders) return null

  return (
    <>
      <div
        onClick={() => setShowPreorders(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.35)' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 90,
        width: 520, background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          height: 56, padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
            Pending Pre-orders
          </span>
          <button
            type="button"
            onClick={() => setShowPreorders(false)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--foreground-muted)' }}
          >×</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search by code or customer..."
            value={preorderSearch}
            onChange={e => { setPreorderSearch(e.target.value); setPreorderPage(1) }}
            style={{
              width: '100%', height: 36,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '0 12px', fontSize: 13,
              color: 'var(--foreground)', background: 'var(--background)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>Fulfillment:</span>
            <input
              type="date" value={preorderDateFrom}
              onChange={e => { setPreorderDateFrom(e.target.value); setPreorderPage(1) }}
              style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 12, color: 'var(--foreground)', background: 'var(--background)' }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--background)' }}>
          {isPreordersLoading ? (
            <p style={{ fontSize: 14 }}>Loading...</p>
          ) : preorders.length === 0 ? (
            <p style={{ fontSize: 14 }}>No pending pre-orders</p>
          ) : (
            preorders.map((order: any) => (
              <div key={order.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
                      {order.code}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {order.created_at}
                      <span style={{
                        background: 'var(--warning-bg)', color: 'var(--warning)',
                        padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      }}>Pending</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>
                    {order.customer?.name ?? order.customer_name ?? 'Guest'}
                  </span>
                  {(order.customer?.phone || order.customer_phone) && (
                    <span style={{ color: 'var(--foreground-muted)' }}>
                      📞 {order.customer?.phone ?? order.customer_phone}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 8 }}>
                  📅 Pickup:{' '}
                  {order.fulfillment_date
                    ? formatDateTime(order.fulfillment_date)
                    : '—'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {order.sales_order_details?.length ?? 0} item(s)
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                    Rp {Number(order.total_price).toLocaleString('id-ID')}
                  </span>
                </div>

                {order.description && (
                  <div style={{
                    fontSize: 12, color: 'var(--foreground-muted)',
                    background: 'var(--background)', padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)', marginBottom: 10,
                    borderLeft: '3px solid var(--warning)',
                  }}>
                    {order.description}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => loadPreorderToCart(order)}
                  style={{
                    width: '100%', height: 38,
                    background: 'var(--accent)', color: 'white',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🛒 Complete Order / Load to Cart
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {preorderMeta && (preorderMeta.last_page ?? preorderMeta.total_pages ?? 1) > 1 && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={() => setPreorderPage(p => Math.max(1, p - 1))}
              disabled={preorderPage === 1}
              style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: preorderPage === 1 ? 'not-allowed' : 'pointer', color: preorderPage === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)', fontSize: 13 }}
            >« Prev</button>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              {preorderPage} / {preorderMeta.last_page ?? preorderMeta.total_pages}
            </span>
            <button
              type="button"
              onClick={() => setPreorderPage(p => Math.min(preorderMeta.last_page ?? preorderMeta.total_pages, p + 1))}
              disabled={preorderPage === (preorderMeta.last_page ?? preorderMeta.total_pages)}
              style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: preorderPage === (preorderMeta.last_page ?? preorderMeta.total_pages) ? 'not-allowed' : 'pointer', color: preorderPage === (preorderMeta.last_page ?? preorderMeta.total_pages) ? 'var(--foreground-subtle)' : 'var(--foreground)', fontSize: 13 }}
            >Next »</button>
          </div>
        )}
      </div>
    </>
  )
}
