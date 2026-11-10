import React, { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import type { PosCartItem, PosCartBundle } from '@/types/api'
import { formatCurrency } from '@/utils/price';
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { getProductUomName } from '@/utils/productUomName'
import { toast } from 'sonner'

/** How much of a cart line may still be sold; undefined = not capped client-side. */
const qtyLimitOf = (item: PosCartItem): number | undefined =>
  typeof item.maxQty === 'number' && item.maxQty > 0 ? item.maxQty : undefined

/** Same, for a bundle line. */
const bundleQtyLimitOf = (item: PosCartBundle): number | undefined =>
  typeof item.maxQty === 'number' && item.maxQty > 0 ? item.maxQty : undefined

const formatQty = (v: number): string =>
  v.toLocaleString('id-ID', { maximumFractionDigits: 2 })

/** Stock warning for a capped bundle line, naming the scarce item when known. */
const bundleStockMessage = (item: PosCartBundle, max: number): string =>
  item.limitedBy
    ? `Stok ${item.limitedBy} tidak mencukupi — maksimal ${formatQty(max)} bundle`
    : `Stok tidak mencukupi — maksimal ${formatQty(max)} bundle`

const qtyBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--foreground)',
  flexShrink: 0,
}

interface PosCartSidebarProps {
  orderType: 'online' | 'offline'
  setOrderType: (val: 'online' | 'offline') => void
  cart: PosCartItem[]
  setCart: (val: any) => void
  bundleCart: PosCartBundle[]
  setBundleCart: (val: any) => void
  editingOrderId: number | null
  editingOrderCode: string | null
  /** Leave edit mode — clears the cart so the held order isn't re-created as a new one. */
  onCancelEdit: () => void
  subtotal: number
  total: number
  discountAmount: number
  /** Server PPN (after the voucher discount); 0 hides the line. */
  taxAmount?: number
  taxIncluded?: boolean
  appliedVoucher: any
  voucherCode: number | ''
  setVoucherCode: (val: number | '') => void
  voucherLoading: boolean
  handleApplyVoucher: (selectedVoucher?: any) => void
  salesChannelId: number | null
  setSalesChannelId: (val: number | null) => void
  salesChannels: any[]
  orderNote: string
  setOrderNote: (val: string) => void
  transactionDate: string
  setTransactionDate: (val: string) => void
  fulfillmentDate: string
  setFulfillmentDate: (val: string) => void
  handleHold: () => void
  handleCharge: () => void
  isHoldPending?: boolean
  isPending?: boolean
  paymentMethodsLoading?: boolean
  paymentMethods?: any[]
  // These were inside the index, we handle lotPicker state locally
}

export default function PosCartSidebar({
  orderType,
  setOrderType,
  cart,
  setCart,
  bundleCart,
  setBundleCart,
  editingOrderId,
  editingOrderCode,
  onCancelEdit,
  subtotal,
  total,
  discountAmount,
  taxAmount,
  taxIncluded,
  appliedVoucher,
  // voucher / sales channel props are still accepted but now edited in the
  // review step and payment modal; dates + note are also set in the hold dialog.
  orderNote,
  setOrderNote,
  transactionDate,
  fulfillmentDate,
  setFulfillmentDate,
  handleHold,
  handleCharge,
  isHoldPending = false,
  isPending = false,
  paymentMethodsLoading = false,
  paymentMethods = [],
}: PosCartSidebarProps) {

  // Order details (customer, voucher, note) are filled in the review step
  // before payment; sales channel is picked in the payment modal.
  const [lotPickerFor, setLotPickerFor] = useState<number | null>(null)
  // Holding an order always asks when it will be picked up / delivered.
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  // Hover / press feedback for the footer actions (inline styles have no :hover).
  const [hoverBtn, setHoverBtn] = useState<'hold' | 'charge' | null>(null)
  const [pressBtn, setPressBtn] = useState<'hold' | 'charge' | null>(null)


  const changeCartLot = (currentInventoryId: number, targetLot: any) => {

    // You will need to bring the changeCartLot logic here, or pass it via props.
    // Assuming for now it's passed or simplified:
    // This is part of the logic that the user can learn to implement.
    // TODO: implement lot changing logic inside usePosLogic and pass as prop.
  }

  const cartEmpty = cart.length === 0 && bundleCart.length === 0
  const noMethods = !paymentMethodsLoading && paymentMethods.length === 0
  const busy = isPending || isHoldPending
  const holdDisabled = busy || cartEmpty
  const chargeDisabled = busy || cartEmpty || noMethods

  const actionMotion = (key: 'hold' | 'charge', disabled: boolean): React.CSSProperties => {
    const lifted = !disabled && hoverBtn === key
    const pressed = lifted && pressBtn === key
    return {
      transform: pressed ? 'translateY(0) scale(0.98)' : lifted ? 'translateY(-2px)' : 'none',
      boxShadow: pressed ? 'var(--shadow-sm)' : lifted ? 'var(--shadow-md)' : 'none',
      transition: 'transform 140ms ease, box-shadow 140ms ease, background 140ms ease, border-color 140ms ease',
    }
  }
  const motionHandlers = (key: 'hold' | 'charge') => ({
    onMouseEnter: () => setHoverBtn(key),
    onMouseLeave: () => { setHoverBtn(null); setPressBtn(null) },
    onMouseDown: () => setPressBtn(key),
    onMouseUp: () => setPressBtn(null),
  })

  return (
    <div
      style={{
        width: 380,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          height: 56,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--foreground)' }}>
            Order
          </span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            {(['offline', 'online'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setOrderType(t)
                  setCart([])
                }}
                style={{
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: orderType === t ? 'var(--accent)' : 'var(--border)',
                  background: orderType === t ? 'var(--accent)' : 'var(--surface)',
                  color: orderType === t ? 'white' : 'var(--foreground-muted)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setCart([]); setBundleCart([]) }}
          title="Clear cart"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Clear
        </button>
      </div>

      {editingOrderId && (
        <div style={{
          padding: '6px 16px',
          background: 'var(--warning-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 500 }}>
            Editing held order: {editingOrderCode}
          </span>
          <button
            type="button"
            onClick={onCancelEdit}
            style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--warning)', cursor: 'pointer' }}
          >
            Cancel edit
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {cartEmpty ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--foreground-muted)',
              padding: '32px 0',
            }}
          >
            <ShoppingCart size={32} color="var(--border)" />
            <span style={{ fontSize: 13 }}>Cart is empty</span>
            <span style={{ fontSize: 11 }}>Click products to add them</span>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product_inventory_id}
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                position: 'relative',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.code}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    style={qtyBtnStyle}
                    onClick={() =>
                      setCart((prev: any) =>
                        prev
                          .map((c: any) =>
                            c.product_inventory_id === item.product_inventory_id
                              ? { ...c, qty: c.qty - 1 }
                              : c
                          )
                          .filter((c: any) => c.qty > 0)
                      )
                    }
                  >
                    −
                  </button>
                  <LocalizedNumberInput
                    value={item.qty}
                    onChange={(val) => {
                      const max = qtyLimitOf(item)
                      let next = Math.max(0.001, val)
                      if (max !== undefined && next > max) {
                        toast.error(`Stok tidak mencukupi — tersedia ${formatQty(max)}`)
                        next = max
                      }
                      setCart((prev: any) =>
                        prev.map((c: any) =>
                          c.product_inventory_id === item.product_inventory_id
                            ? { ...c, qty: next }
                            : c
                        )
                      )
                    }}
                    decimals={2}
                    padDecimals={false}
                    style={{
                      width: 56,
                      height: 28,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      background: 'var(--surface-raised)',
                    }}
                  />
                  <button
                    type="button"
                    style={qtyBtnStyle}
                    onClick={() => {
                      const max = qtyLimitOf(item)
                      if (max !== undefined && item.qty + 1 > max) {
                        toast.error(`Stok tidak mencukupi — tersedia ${formatQty(max)}`)
                        return
                      }
                      setCart((prev: any) =>
                        prev.map((c: any) =>
                          c.product_inventory_id === item.product_inventory_id
                            ? { ...c, qty: c.qty + 1 }
                            : c
                        )
                      )
                    }}
                  >
                    +
                  </button>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                  {formatCurrency(item.price * item.qty)}
                </span>
              </div>
            </div>
          ))
        )}

        {bundleCart.map((item: any) => (
          <div
            key={`bundle-${item.bundle_id}`}
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                  {item.name}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.code}</div>
              
              {/* Bundle items breakdown */}
              {item.bundle_details && item.bundle_details.length > 0 && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                  {item.bundle_details.map((bd: any, idx: number) => {
                    const prodName = bd.product_name || getProductUomName(bd.product_uom, bd.product_uom?.product?.name) || getProductUomName(bd.product_inventory?.product_uom, bd.product_inventory?.product_uom?.product?.name) || `Item`
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--foreground-subtle)', marginBottom: idx === item.bundle_details.length - 1 ? 0 : 4 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          • {prodName}
                        </span>
                        <span>x{bd.qty}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  style={qtyBtnStyle}
                  onClick={() =>
                    setBundleCart((prev: any) =>
                      prev
                        .map((c: any) =>
                          c.bundle_id === item.bundle_id
                            ? { ...c, qty: c.qty - 1 }
                            : c
                        )
                        .filter((c: any) => c.qty > 0)
                    )
                  }
                >
                  −
                </button>
                <LocalizedNumberInput
                  value={item.qty}
                  onChange={(val) => {
                    let next = Math.max(0.001, val)
                    const max = bundleQtyLimitOf(item)
                    if (max !== undefined && next > max) {
                      toast.error(bundleStockMessage(item, max))
                      next = max
                    }
                    setBundleCart((prev: any) =>
                      prev.map((c: any) =>
                        c.bundle_id === item.bundle_id ? { ...c, qty: next } : c
                      )
                    )
                  }}
                  decimals={2}
                  padDecimals={false}
                  style={{
                    width: 56,
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    background: 'var(--surface-raised)',
                  }}
                />
                <button
                  type="button"
                  style={qtyBtnStyle}
                  onClick={() => {
                    const max = bundleQtyLimitOf(item)
                    if (max !== undefined && item.qty + 1 > max) {
                      toast.error(bundleStockMessage(item, max))
                      return
                    }
                    setBundleCart((prev: any) =>
                      prev.map((c: any) =>
                        c.bundle_id === item.bundle_id ? { ...c, qty: c.qty + 1 } : c
                      )
                    )
                  }}
                >
                  +
                </button>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                {formatCurrency(item.price * item.qty)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--foreground-muted)' }}>
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {appliedVoucher && discountAmount > 0 && (
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--destructive)', padding: '2px 0' }}>
              <span>Diskon ({appliedVoucher.code})</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </span>
        )}

        {(taxAmount ?? 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--foreground-muted)' }}>
            <span>{taxIncluded ? 'PPN (termasuk)' : 'PPN'}</span>
            <span>{formatCurrency(taxAmount ?? 0)}</span>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
            {formatCurrency(total)}
          </span>
        </div>
      </div>


      <div
        style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setShowHoldDialog(true)}
            disabled={holdDisabled}
            {...motionHandlers('hold')}
            style={{
              ...actionMotion('hold', holdDisabled),
              flex: '0 0 auto',
              height: 48,
              padding: '0 18px',
              background: holdDisabled ? 'var(--border)' : 'var(--accent-light-bg)',
              color: holdDisabled ? 'var(--foreground-muted)' : 'var(--accent)',
              border: `1px solid ${holdDisabled ? 'var(--border)' : hoverBtn === 'hold' ? 'var(--accent)' : 'var(--accent-light)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
              cursor: holdDisabled ? 'not-allowed' : 'pointer',
              opacity: isHoldPending ? 0.7 : 1,
            }}
          >
            {isHoldPending ? 'Holding…' : 'Hold Order'}
          </button>
          <button
            type="button"
            onClick={handleCharge}
            disabled={chargeDisabled}
            {...motionHandlers('charge')}
            style={{
              ...actionMotion('charge', chargeDisabled),
              flex: 1,
              height: 48,
              background: chargeDisabled ? 'var(--border)' : hoverBtn === 'charge' ? 'var(--accent-hover)' : 'var(--accent)',
              color: chargeDisabled ? 'var(--foreground-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 16,
              fontWeight: 600,
              cursor: chargeDisabled ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Processing...' : 'Charge Now'}
          </button>
        </div>
      </div>

      {showHoldDialog && (
        <HoldOrderDialog
          transactionDate={transactionDate}
          fulfillmentDate={fulfillmentDate}
          setFulfillmentDate={setFulfillmentDate}
          orderNote={orderNote}
          setOrderNote={setOrderNote}
          isEditing={!!editingOrderId}
          onCancel={() => setShowHoldDialog(false)}
          onConfirm={() => {
            setShowHoldDialog(false)
            handleHold()
          }}
        />
      )}
    </div>
  )
}

const dateOffset = (from: string, days: number): string => {
  const d = new Date(`${from}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

const holdFieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
  marginBottom: 6,
}

const holdFieldStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 14,
  boxSizing: 'border-box',
}

function HoldOrderDialog({
  transactionDate,
  fulfillmentDate,
  setFulfillmentDate,
  orderNote,
  setOrderNote,
  isEditing,
  onCancel,
  onConfirm,
}: {
  transactionDate: string
  fulfillmentDate: string
  setFulfillmentDate: (val: string) => void
  orderNote: string
  setOrderNote: (val: string) => void
  isEditing: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const today = new Date().toLocaleDateString('en-CA')
  const base = transactionDate || today
  const value = fulfillmentDate.slice(0, 10)
  const quickPicks = [
    { label: 'Today', date: base },
    { label: 'Tomorrow', date: dateOffset(base, 1) },
    { label: 'In 2 days', date: dateOffset(base, 2) },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0, color: 'var(--foreground)' }}>
              {isEditing ? 'Update Held Order' : 'Hold Order'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
              The order is saved unpaid. Open it from Pending to edit or charge it later.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: 'var(--foreground-muted)' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <span style={holdFieldLabel}>Pickup / delivery date</span>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {quickPicks.map((q) => {
                const active = value === q.date
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setFulfillmentDate(q.date)}
                    style={{
                      flex: 1,
                      height: 34,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: active ? 'var(--accent-light-bg)' : 'var(--surface)',
                      color: active ? 'var(--accent)' : 'var(--foreground)',
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>
            <input
              type="date"
              value={value}
              min={transactionDate || undefined}
              onChange={(e) => setFulfillmentDate(e.target.value)}
              style={holdFieldStyle}
            />
          </div>

          <label style={{ display: 'block' }}>
            <span style={holdFieldLabel}>Note (optional)</span>
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              rows={3}
              placeholder="e.g. cake writing, pickup time…"
              style={{ ...holdFieldStyle, height: 'auto', padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ height: 40, padding: '0 16px', background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!value}
            style={{ height: 40, padding: '0 16px', background: value ? 'var(--accent)' : 'var(--border)', color: value ? 'white' : 'var(--foreground-muted)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, cursor: value ? 'pointer' : 'not-allowed' }}
          >
            {isEditing ? 'Save Changes' : 'Hold Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
