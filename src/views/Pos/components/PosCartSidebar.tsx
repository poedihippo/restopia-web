import React, { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import type { PosCartItem, PosCartBundle } from '@/types/api'
import useGetVoucherList from '@/hooks/voucher/useGetVoucherList'
import SearchableSelect from '@/components/SearchableSelect'
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

// Some styling constants for the sidebar
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--background)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--foreground-muted)',
  marginBottom: 4,
  display: 'block',
}

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
  setEditingOrderId: (val: number | null) => void
  setEditingOrderCode: (val: string | null) => void
  subtotal: number
  total: number
  discountAmount: number
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
  setEditingOrderId,
  setEditingOrderCode,
  subtotal,
  total,
  discountAmount,
  appliedVoucher,
  voucherCode,
  setVoucherCode,
  voucherLoading,
  handleApplyVoucher,
  salesChannelId,
  setSalesChannelId,
  salesChannels,
  orderNote,
  setOrderNote,
  transactionDate,
  setTransactionDate,
  fulfillmentDate,
  setFulfillmentDate,
  handleHold,
  handleCharge,
  isHoldPending = false,
  isPending = false,
  paymentMethodsLoading = false,
  paymentMethods = [],
}: PosCartSidebarProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false)
  const [lotPickerFor, setLotPickerFor] = useState<number | null>(null)

  const { data: vouchersData, isLoading: vouchersLoadingQuery } = useGetVoucherList({
    per_page: 100,
    'filter[status]': 'active',
  } as any)

  const voucherOptions = useMemo(() => {
    return (vouchersData?.data || []).map((v: any) => ({
      label: v.code,
      value: v.id,
      sublabel: v.description || '',
    }))
  }, [vouchersData])

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
          ✕ Clear
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
            ✏️ Editing pre-order: {editingOrderCode}
          </span>
          <button
            type="button"
            onClick={() => { setEditingOrderId(null); setEditingOrderCode(null) }}
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

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOrderDetailsOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: 'var(--background)',
          border: 'none',
          borderTop: '1px solid var(--border)',
          borderBottom: orderDetailsOpen ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--foreground)',
          flexShrink: 0,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span>Order Details</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--foreground-muted)' }}>
          {orderDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {orderDetailsOpen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
            flexShrink: 0,
          }}
        >
          {/* Sales Channel field */}
          <div style={{ padding: '0 16px', flexShrink: 0, marginTop: 10 }}>
            <span style={labelStyle}>Sales Channel</span>
            <select
              value={salesChannelId || ''}
              onChange={(e) => setSalesChannelId(e.target.value ? Number(e.target.value) : null)}
              style={inputStyle}
            >
              <option value="">Select channel...</option>
              {salesChannels.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voucher field */}
          <div style={{ padding: '0 16px', flexShrink: 0, marginTop: 10 }}>
            <span style={labelStyle}>Voucher</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={voucherOptions}
                  value={voucherCode}
                  onChange={(val) => setVoucherCode(val as number)}
                  placeholder="Select voucher..."
                  searchPlaceholder="Search voucher..."
                  loading={vouchersLoadingQuery}
                  onSearchChange={setDropdownSearch}
/>
              </div>
              <button
                type="button"
                onClick={() => {
                  const selectedVoucher = vouchersData?.data?.find((v: any) => v.id === voucherCode)
                  handleApplyVoucher(selectedVoucher)
                }}
                disabled={voucherLoading || !voucherCode}
                style={{
                  padding: '0 12px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: voucherLoading || !voucherCode ? 'not-allowed' : 'pointer',
                  opacity: voucherLoading || !voucherCode ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {voucherLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
              </button>
            </div>
          </div>

          <div style={{ padding: '8px 16px', flexShrink: 0 }}>
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Order note..."
              rows={2}
              style={{
                width: '100%',
                resize: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--background)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

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
            onClick={handleHold}
            disabled={holdDisabled}
            style={{
              flex: '0 0 auto',
              height: 48,
              padding: '0 18px',
              background: holdDisabled ? 'var(--border)' : 'var(--surface)',
              color: holdDisabled ? 'var(--foreground-muted)' : 'var(--foreground)',
              border: `1px solid ${holdDisabled ? 'var(--border)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
              cursor: holdDisabled ? 'not-allowed' : 'pointer',
              opacity: isHoldPending ? 0.7 : 1,
            }}
          >
            {isHoldPending ? 'Holding…' : '🗂 Hold'}
          </button>
          <button
            type="button"
            onClick={handleCharge}
            disabled={chargeDisabled}
            style={{
              flex: 1,
              height: 48,
              background: chargeDisabled ? 'var(--border)' : 'var(--accent)',
              color: chargeDisabled ? 'var(--foreground-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 16,
              fontWeight: 600,
              cursor: chargeDisabled ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Processing...' : `Charge ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

