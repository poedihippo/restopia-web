'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import '@/styles/pos-print.css'
import { productInventoriesService } from '@/services/product-inventories.service'
import salesOrderService from '@/services/sales-order.service'
import customerService from '@/services/customer.service'
import { toast } from 'sonner'
import type { PosCartItem } from '@/types/api'

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

export default function PosView() {
  // Product grid state
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  // Cart / order state
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherDiscount, setVoucherDiscount] = useState(0)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [orderNote, setOrderNote] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<{
    cart: PosCartItem[]
    subtotal: number
    discount: number
    total: number
    customerName: string
    code: string
    date: string
  } | null>(null)

  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // Product search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Close customer dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Product inventories query
  const { data, isLoading } = useQuery({
    queryKey: ['product-inventories-pos', searchDebounced],
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 60,
          sort: 'code',
          'filter[search]': searchDebounced || undefined,
          include: 'product,product_uom',
        })
        .then((r) => r.data),
  })
  const items: any[] = (data as any)?.data?.data ?? []

  // Customer search query
  const { data: customerData } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: () =>
      customerService
        .list({
          per_page: 10,
          'filter[search]': customerSearch,
        })
        .then((r) => r.data),
    enabled: customerSearch.length >= 2,
  })
  const customers: any[] = (customerData as any)?.data?.data ?? []

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const total = Math.max(0, subtotal - voucherDiscount)

  // Sales order mutation
  const { mutate, isPending } = useMutation({
    mutationFn: (payload: any) => salesOrderService.create(payload as any),
    onSuccess: () => {
      setShowReceipt(true)
      toast.success('Order placed!')
    },
    onError: (err: any) => {
      setReceiptData(null)
      toast.error(err?.response?.data?.message ?? 'Failed to place order')
    },
  })

  const resetCart = useCallback(() => {
    setCart([])
    setSelectedCustomerId(null)
    setCustomerSearch('')
    setGuestName('')
    setGuestPhone('')
    setVoucherCode('')
    setVoucherDiscount(0)
    setOrderNote('')
    setShowReceipt(false)
    setReceiptData(null)
  }, [])

  // Add to cart
  const addToCart = useCallback((item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_inventory_id === item.id)
      if (existing) {
        return prev.map((c) =>
          c.product_inventory_id === item.id ? { ...c, qty: c.qty + 1 } : c
        )
      }
      return [
        ...prev,
        {
          product_inventory_id: item.id,
          name: item.product?.name ?? item.code,
          code: item.code,
          price: item.base_price ?? 0,
          qty: 1,
        },
      ]
    })
  }, [])

  // Charge handler
  const handleCharge = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    const payload = {
      code: `POS-${Date.now()}`,
      type: 'offline' as const,
      customer_id: selectedCustomerId ?? null,
      customer_name: selectedCustomerId ? undefined : guestName || undefined,
      customer_phone: selectedCustomerId ? undefined : guestPhone || undefined,
      date: new Date().toISOString().slice(0, 10),
      voucher_id: null,
      subtotal_price: subtotal,
      discount_price: voucherDiscount,
      total_price: total,
      status: 'final' as const,
      description: orderNote || undefined,
      details: cart.map((c) => ({
        product_inventory_id: c.product_inventory_id,
        qty: c.qty,
        price: c.price,
        status: 'completed' as const,
      })),
    }
    setReceiptData({
      cart: [...cart],
      subtotal,
      discount: voucherDiscount,
      total,
      customerName: selectedCustomerId ? customerSearch : guestName || 'Walk-in',
      code: payload.code,
      date: payload.date,
    })
    mutate(payload)
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: 'var(--background)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      {/* ─── LEFT — Product Grid Panel ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Topbar */}
        <div
          style={{
            height: 56,
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface)',
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}
          >
            Dapur Coklat POS
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            style={{
              flex: 1,
              height: 36,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0 12px',
              fontSize: 14,
              color: 'var(--foreground)',
              background: 'var(--background)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {/* Product grid area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {isLoading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 160,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--border)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60%',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 40 }}>🛍️</span>
              <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                No products found
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
              }}
            >
              {items.map((item: any) => {
                const isHovered = hoveredCard === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    onMouseEnter={() => setHoveredCard(item.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${isHovered ? 'var(--accent-light)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: isHovered ? 'var(--shadow-sm)' : 'none',
                      transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: '1.35',
                      }}
                    >
                      {item.product?.name ?? item.code}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.code}
                    </span>
                    <div style={{ marginTop: 'auto' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>
                        Rp {(item.base_price ?? 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT — Cart Panel ─── */}
      <div
        style={{
          width: 380,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        {/* Cart header */}
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
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--foreground)' }}>
            Order
          </span>
          <button
            type="button"
            onClick={() => setCart([])}
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

        {/* Cart items */}
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
          {cart.length === 0 ? (
            <p style={{ color: 'var(--foreground-muted)', fontSize: 14, textAlign: 'center', marginTop: 24 }}>
              Cart is empty.
            </p>
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
                }}
              >
                {/* Name + code */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.code}</div>
                </div>

                {/* Qty + price row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      style={qtyBtnStyle}
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((c) =>
                              c.product_inventory_id === item.product_inventory_id
                                ? { ...c, qty: c.qty - 1 }
                                : c
                            )
                            .filter((c) => c.qty > 0)
                        )
                      }
                    >
                      −
                    </button>
                    <span
                      style={{
                        minWidth: 24,
                        textAlign: 'center',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                      }}
                    >
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      style={qtyBtnStyle}
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((c) =>
                            c.product_inventory_id === item.product_inventory_id
                              ? { ...c, qty: c.qty + 1 }
                              : c
                          )
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                    Rp {(item.price * item.qty).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer section */}
        <div
          style={{
            padding: '10px 16px 8px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <label style={labelStyle}>Customer</label>
          <div style={{ position: 'relative' }} ref={customerDropdownRef}>
            {selectedCustomerId ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--accent-light-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  color: 'var(--accent)',
                }}
              >
                <span style={{ flex: 1 }}>✓ {customerSearch}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(null)
                    setCustomerSearch('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--foreground-muted)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Search customer..."
                  style={inputStyle}
                />
                {showCustomerDropdown && customers.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      zIndex: 50,
                      maxHeight: 180,
                      overflowY: 'auto',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    {customers.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id)
                          setCustomerSearch(c.name)
                          setShowCustomerDropdown(false)
                        }}
                        style={{
                          padding: '9px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                          color: 'var(--foreground)',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--background)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = 'transparent')
                        }
                      >
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        {c.phone && (
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                            {c.phone}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Guest fields — only when no customer selected and no search text */}
          {!selectedCustomerId && !customerSearch && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <div style={{ flex: 1 }}>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest name"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Guest phone"
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* Voucher section */}
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <label style={labelStyle}>Voucher Code</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder="Enter code..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => {
                if (!voucherCode) return
                toast.info('Voucher applied (manual discount)')
              }}
              style={{
                padding: '7px 12px',
                background: 'var(--accent-light-bg)',
                color: 'var(--accent)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Note section */}
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
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

        {/* Cart footer */}
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
          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--foreground-muted)' }}>
            <span>Subtotal</span>
            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>

          {/* Discount (only when applied) */}
          {voucherDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--success)' }}>
              <span>Discount</span>
              <span>- Rp {voucherDiscount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
              Rp {total.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Charge button */}
          <button
            type="button"
            onClick={handleCharge}
            disabled={isPending || cart.length === 0}
            style={{
              width: '100%',
              height: 48,
              marginTop: 6,
              background: cart.length === 0 ? 'var(--border)' : 'var(--accent)',
              color: cart.length === 0 ? 'var(--foreground-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 16,
              fontWeight: 600,
              cursor: isPending || cart.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
              transition: 'background 150ms ease',
            }}
          >
            {isPending ? 'Processing...' : `Charge Rp ${total.toLocaleString('id-ID')}`}
          </button>
        </div>
      </div>

      {showReceipt &&
        receiptData &&
        createPortal(
          <div id="pos-receipt">
            <h2>Dapur Coklat</h2>
            <div className="divider" />
            <div className="row">
              <span>Order</span>
              <span>{receiptData.code}</span>
            </div>
            <div className="row">
              <span>Date</span>
              <span>{receiptData.date}</span>
            </div>
            <div className="row">
              <span>Customer</span>
              <span>{receiptData.customerName}</span>
            </div>
            <div className="divider" />
            {receiptData.cart.map((item, i) => (
              <div key={i}>
                <div>
                  {item.name} (×{item.qty})
                </div>
                <div className="row">
                  <span />
                  <span>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
            <div className="divider" />
            {receiptData.discount > 0 && (
              <div className="row">
                <span>Discount</span>
                <span>- Rp {receiptData.discount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="row total-row">
              <span>TOTAL</span>
              <span>Rp {receiptData.total.toLocaleString('id-ID')}</span>
            </div>
            <div className="divider" />
            <p style={{ textAlign: 'center', marginTop: 8 }}>Thank you!</p>
          </div>,
          document.body
        )}

      {showReceipt && receiptData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 360,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                marginBottom: 4,
                color: 'var(--accent)',
              }}
            >
              Order Complete
            </h2>
            <p style={{ color: 'var(--foreground-muted)', fontSize: 13, marginBottom: 20 }}>
              {receiptData.code} · {receiptData.date} · {receiptData.customerName}
            </p>

            {receiptData.cart.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: 14,
                }}
              >
                <span>
                  {item.name} × {item.qty}
                </span>
                <span>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            {receiptData.discount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  color: 'var(--success)',
                  marginBottom: 4,
                }}
              >
                <span>Discount</span>
                <span>- Rp {receiptData.discount.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 24,
              }}
            >
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>
                Rp {receiptData.total.toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                🖨 Print Receipt
              </button>
              <button
                type="button"
                onClick={resetCart}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
