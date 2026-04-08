'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productCategoriesService } from '@/services/product-categories.service'
import salesOrderService from '@/services/sales-order.service'
import customerService from '@/services/customer.service'
import bundleService from '@/services/bundle.service'
import { toast } from 'sonner'
import type { PosCartItem, PosCartBundle } from '@/types/api'

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
  const todayISO = () => new Date().toISOString().slice(0, 16)

  // Product grid state
  const [activeTab, setActiveTab] = useState<'products' | 'bundles'>('products')
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [bundleCart, setBundleCart] = useState<PosCartBundle[]>([])
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleSearchDebounced, setBundleSearchDebounced] = useState('')
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<string>('code')
  const [productPage, setProductPage] = useState(1)
  const [inStockOnly, setInStockOnly] = useState<boolean>(false)
  // Cart / order state
  const [orderType, setOrderType] = useState<'offline' | 'online'>('offline')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherDiscount, setVoucherDiscount] = useState(0)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [orderNote, setOrderNote] = useState('')
  const [fulfillmentDate, setFulfillmentDate] = useState<string>(todayISO())
  const [showReceipt, setShowReceipt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchDebounced, setHistorySearchDebounced] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyDateFrom, setHistoryDateFrom] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [historyDateTo, setHistoryDateTo] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [receiptData, setReceiptData] = useState<{
    cart: PosCartItem[]
    subtotal: number
    discount: number
    total: number
    customerName: string
    code: string
    date: string
    paymentMethod: 'cash' | 'transfer'
    cashTendered: number
    change: number
  } | null>(null)

  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // Product search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Bundle search debounce
  useEffect(() => {
    const t = setTimeout(() => setBundleSearchDebounced(bundleSearch), 400)
    return () => clearTimeout(t)
  }, [bundleSearch])

  // History search debounce
  useEffect(() => {
    const t = setTimeout(() => setHistorySearchDebounced(historySearch), 400)
    return () => clearTimeout(t)
  }, [historySearch])

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

  // Product inventories query — params built inside queryFn (no unsupported filters)
  const { data, isLoading } = useQuery({
    queryKey: [
      'product-inventories-pos',
      productPage,
      searchDebounced,
      sortBy,
      inStockOnly,
      orderType,
    ],
    queryFn: () => {
      const params: Record<string, any> = {
        page: productPage,
        per_page: 20,
        'filter[product_type]': 'final',
        'filter[status]': 'active',
        include: 'product_uom,product_uom.product,product_uom.product.product_category',
      }
      if (searchDebounced) params['filter[search]'] = searchDebounced
      if (inStockOnly) params['filter[stock_gte]'] = 1
      if (sortBy === 'price_asc') params['sort'] = 'base_price'
      else if (sortBy === 'price_desc') params['sort'] = '-base_price'
      else if (sortBy === 'stock_desc') params['sort'] = '-stock'
      else params['sort'] = 'code'
      return productInventoriesService.list(params).then((r) => r.data)
    },
  })
  const items: any[] = (data as any)?.data ?? []
  const productMeta = (data as any)?.meta

  const filteredItems = useMemo(() => {
    if (categoryId === null) return items
    return items.filter(
      (item: any) => item.product_uom?.product?.product_category_id === categoryId
    )
  }, [items, categoryId])

  // Product categories query
  const { data: catData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const categories: any[] = (catData as any)?.data ?? []

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

  const { data: bundleData, isLoading: isBundleLoading } = useQuery({
    queryKey: ['pos-bundles', bundleSearchDebounced],
    queryFn: () =>
      bundleService
        .list({
          per_page: 60,
          'filter[status]': 'active',
          'filter[search]': bundleSearchDebounced || undefined,
          include: 'bundle_details',
        })
        .then((r) => r.data),
  })
  const bundles: any[] = (bundleData as any)?.data ?? []

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: [
      'pos-history',
      historyPage,
      historySearchDebounced,
      historyDateFrom,
      historyDateTo,
    ],
    enabled: showHistory,
    queryFn: () => {
      const params: Record<string, any> = {
        page: historyPage,
        per_page: 20,
        sort: '-created_at',
        include: 'sales_order_details',
      }
      if (historySearchDebounced) params['filter[search]'] = historySearchDebounced
      if (historyDateFrom) params['filter[date_gte]'] = historyDateFrom
      if (historyDateTo) params['filter[date_lte]'] = historyDateTo
      return salesOrderService.list(params).then((r) => r.data)
    },
  })
  const orders: any[] = (historyData as any)?.data ?? []
  const historyMeta = (historyData as any)?.meta

  // Totals
  const subtotal =
    cart.reduce((s, c) => s + c.price * c.qty, 0) +
    bundleCart.reduce((s, c) => s + c.price * c.qty, 0)
  const total = Math.max(0, subtotal - voucherDiscount)

  // Payment modal derived values
  const change =
    paymentMethod === 'cash'
      ? Math.max(0, Number(cashTendered.replace(/\D/g, '')) - total)
      : 0
  const quickAmounts = [
    total,
    Math.ceil(total / 10000) * 10000 + 10000,
    50000,
    100000,
    200000,
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .filter((v) => v >= total)
    .slice(0, 4)

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
    setBundleCart([])
    setActiveTab('products')
    setBundleSearch('')
    setSelectedCustomerId(null)
    setCustomerSearch('')
    setGuestName('')
    setGuestPhone('')
    setVoucherCode('')
    setVoucherDiscount(0)
    setOrderNote('')
    setFulfillmentDate(todayISO())
    setOrderType('offline')
    setShowPayment(false)
    setPaymentMethod('cash')
    setCashTendered('')
    setShowReceipt(false)
    setReceiptData(null)
  }, [])

  // Add to cart
  const addToCart = useCallback(
    (item: any) => {
      if ((item.stock ?? 0) <= 0) {
        toast.error('Item is out of stock')
        return
      }
      const linePrice =
        orderType === 'online'
          ? (item.online_price ?? item.base_price ?? 0)
          : (item.base_price ?? 0)
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
            name:
              item.product_uom?.product?.name ??
              item.productUom?.product?.name ??
              item.product?.name ??
              item.code,
            code: item.code,
            price: linePrice,
            qty: 1,
            price_editable: item.price_editable ?? false,
          },
        ]
      })
    },
    [orderType]
  )

  const addBundleToCart = useCallback((bundle: any) => {
    setBundleCart((prev) => {
      const existing = prev.find((c) => c.bundle_id === bundle.id)
      if (existing) {
        return prev.map((c) =>
          c.bundle_id === bundle.id ? { ...c, qty: c.qty + 1 } : c
        )
      }
      return [
        ...prev,
        {
          bundle_id: bundle.id,
          name: bundle.name,
          code: bundle.code,
          price: bundle.price ?? 0,
          qty: 1,
          bundle_details: (bundle.details ?? []).map((d: any) => ({
            product_inventory_id: d.product_inventory_id ?? d.product_uom_id,
            qty: d.qty,
          })),
        },
      ]
    })
  }, [])

  // Payment gate — opens payment modal
  const handleCharge = () => {
    if (cart.length === 0 && bundleCart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setShowPayment(true)
  }

  // Confirm payment — submits order after payment modal confirms
  const handleConfirmPayment = () => {
    const tendered =
      paymentMethod === 'cash' ? Number(cashTendered.replace(/\D/g, '')) : total
    const orderChange = paymentMethod === 'cash' ? Math.max(0, tendered - total) : 0
    const payload = {
      code: `POS-${Date.now()}`,
      type: orderType,
      customer_id: selectedCustomerId ?? null,
      customer_name: selectedCustomerId ? undefined : guestName || undefined,
      customer_phone: selectedCustomerId ? undefined : guestPhone || undefined,
      date: new Date().toISOString().slice(0, 10),
      fulfillment_date: new Date(fulfillmentDate).toISOString(),
      voucher_id: null,
      subtotal_price: subtotal,
      discount_price: voucherDiscount,
      total_price: total,
      status: 'final' as const,
      description: orderNote || undefined,
      details: [
        ...cart.map((c) => ({
          product_inventory_id: c.product_inventory_id,
          bundle_id: null,
          bundle_details: null,
          qty: c.qty,
          price: c.price,
          status: 'completed' as const,
        })),
        ...bundleCart.map((c) => ({
          product_inventory_id: null,
          bundle_id: c.bundle_id,
          bundle_details: c.bundle_details,
          qty: c.qty,
          price: c.price,
          status: 'completed' as const,
        })),
      ],
    }
    setReceiptData({
      cart: [...cart],
      subtotal,
      discount: voucherDiscount,
      total,
      customerName: selectedCustomerId ? customerSearch : guestName || 'Walk-in',
      code: payload.code,
      date: payload.date,
      paymentMethod,
      cashTendered: tendered,
      change: orderChange,
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
            onChange={(e) => { setSearch(e.target.value); setProductPage(1) }}
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
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            style={{
              marginLeft: 'auto',
              height: 36,
              padding: '0 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            🧾 History
          </button>
        </div>

        {/* Products / Bundles tab switcher */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          {(['products', 'bundles'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                height: 40,
                padding: '0 20px',
                border: 'none',
                borderBottom:
                  activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'none',
                color: activeTab === tab ? 'var(--accent)' : 'var(--foreground-muted)',
                fontWeight: activeTab === tab ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'products' ? '🛍 Products' : '🎁 Bundles'}
            </button>
          ))}
        </div>

        {activeTab === 'products' && (
        <>
        {/* Category tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 20px',
            overflowX: 'auto',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => { setCategoryId(null); setProductPage(1) }}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid',
              borderColor: categoryId === null ? 'var(--accent)' : 'var(--border)',
              background: categoryId === null ? 'var(--accent)' : 'var(--surface)',
              color: categoryId === null ? 'white' : 'var(--foreground)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            All
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setCategoryId(cat.id); setProductPage(1) }}
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid',
                borderColor: categoryId === cat.id ? 'var(--accent)' : 'var(--border)',
                background: categoryId === cat.id ? 'var(--accent)' : 'var(--surface)',
                color: categoryId === cat.id ? 'white' : 'var(--foreground)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort + Filter bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
            flexShrink: 0,
          }}
        >
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
            Sort:
          </label>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setProductPage(1) }}
            style={{
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 8px',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="code">Code A–Z</option>
            <option value="price_asc">Price Low–High</option>
            <option value="price_desc">Price High–Low</option>
            <option value="stock_desc">Stock High–Low</option>
          </select>
          <button
            type="button"
            onClick={() => { setInStockOnly((v) => !v); setProductPage(1) }}
            style={{
              height: 32,
              padding: '0 12px',
              border: '1px solid',
              borderColor: inStockOnly ? 'var(--success)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: inStockOnly ? 'var(--success-bg)' : 'var(--surface)',
              color: inStockOnly ? 'var(--success)' : 'var(--foreground-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {inStockOnly ? '✓ In Stock Only' : 'In Stock Only'}
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--foreground-subtle)' }}>
            {productMeta?.total ?? items.length} items
          </span>
        </div>

        {/* Product grid area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {isLoading ? (            <div
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
          ) : filteredItems.length === 0 ? (
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
              {filteredItems.map((item: any) => {
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
                      opacity: (item.stock ?? 0) <= 0 ? 0.45 : 1,
                      cursor: (item.stock ?? 0) <= 0 ? 'not-allowed' : 'pointer',
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
                      {item.product_uom?.product?.name ??
                        item.productUom?.product?.name ??
                        item.product?.name ??
                        item.code}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: item.stock > 0 ? 'var(--success)' : 'var(--destructive)',
                        fontWeight: 500,
                      }}
                    >
                      Stock: {item.stock ?? 0}
                    </span>
                    <div style={{ marginTop: 'auto' }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--accent)',
                          marginTop: 4,
                        }}
                      >
                        Rp{' '}
                        {(orderType === 'online'
                          ? (item.online_price ?? item.base_price ?? 0)
                          : (item.base_price ?? 0)
                        ).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Product grid pagination */}
          {productMeta &&
            (productMeta?.last_page ?? productMeta?.total_pages ?? 1) > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                padding: '16px 0',
              }}
            >
              <button
                type="button"
                onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                disabled={productPage === 1}
                style={{
                  height: 32,
                  padding: '0 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  color: productPage === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
                  cursor: productPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                {productPage} /{' '}
                {productMeta?.last_page ?? productMeta?.total_pages ?? 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setProductPage((p) =>
                    Math.min(
                      productMeta?.last_page ?? productMeta?.total_pages ?? 1,
                      p + 1
                    )
                  )
                }
                disabled={
                  productPage ===
                  (productMeta?.last_page ?? productMeta?.total_pages ?? 1)
                }
                style={{
                  height: 32,
                  padding: '0 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  color:
                    productPage ===
                    (productMeta?.last_page ?? productMeta?.total_pages ?? 1)
                      ? 'var(--foreground-subtle)'
                      : 'var(--foreground)',
                  cursor:
                    productPage ===
                    (productMeta?.last_page ?? productMeta?.total_pages ?? 1)
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: 13,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {activeTab === 'bundles' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Bundle search */}
            <div
              style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <input
                type="text"
                placeholder="Search bundles..."
                value={bundleSearch}
                onChange={(e) => setBundleSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  background: 'var(--background)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Bundle grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {isBundleLoading && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        height: 120,
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--border)',
                        opacity: 0.5,
                      }}
                    />
                  ))}
                </div>
              )}

              {!isBundleLoading && bundles.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
                  <p style={{ fontSize: 14 }}>No bundles available</p>
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {bundles.map((bundle: any) => (
                  <div
                    key={bundle.id}
                    onClick={() => addBundleToCart(bundle)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      background: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--accent-light)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--border)')
                    }
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--accent-light-bg)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        alignSelf: 'flex-start',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Bundle
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>
                      {bundle.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {bundle.code}
                    </span>
                    {bundle.details && bundle.details.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                        {bundle.details.length} item(s) included
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        marginTop: 4,
                      }}
                    >
                      Rp {Number(bundle.price).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
          {cart.length === 0 && bundleCart.length === 0 ? (
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
                {item.price_editable && (
                  <div style={{ marginTop: 6 }}>
                    <label
                      style={{
                        fontSize: 11,
                        color: 'var(--foreground-muted)',
                        display: 'block',
                        marginBottom: 2,
                      }}
                    >
                      Custom Price (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((c) =>
                            c.product_inventory_id === item.product_inventory_id
                              ? { ...c, price: Number(e.target.value) }
                              : c
                          )
                        )
                      }
                      style={{
                        width: '100%',
                        height: 32,
                        border: '1px solid var(--accent-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 8px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--accent)',
                        background: 'var(--accent-light-bg)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Bundle cart items */}
          {bundleCart.map((item) => (
            <div
              key={`bundle-${item.bundle_id}`}
              style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 4,
                }}
              >
                <div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}
                  >
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
                    <span
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}
                    >
                      {item.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                    {item.code}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                  Rp {(item.price * item.qty).toLocaleString('id-ID')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    setBundleCart((prev) =>
                      prev
                        .map((c) =>
                          c.bundle_id === item.bundle_id
                            ? { ...c, qty: Math.max(1, c.qty - 1) }
                            : c
                        )
                        .filter((c) => c.qty > 0)
                    )
                  }
                  style={{
                    width: 28,
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setBundleCart((prev) =>
                      prev.map((c) =>
                        c.bundle_id === item.bundle_id ? { ...c, qty: c.qty + 1 } : c
                      )
                    )
                  }
                  style={{
                    width: 28,
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBundleCart((prev) =>
                      prev.filter((c) => c.bundle_id !== item.bundle_id)
                    )
                  }
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: 'var(--destructive)',
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
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

        <div style={{ padding: '0 16px 8px' }}>
          <label
            style={{
              fontSize: 12,
              color: 'var(--foreground-muted)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            Fulfillment Date & Time
          </label>
          <input
            type="datetime-local"
            value={fulfillmentDate}
            onChange={(e) => setFulfillmentDate(e.target.value)}
            style={{
              width: '100%',
              height: 36,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 10px',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              color: 'var(--foreground)',
              background: 'var(--surface)',
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

      {showPayment && !showReceipt && (
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
              width: 380,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  color: 'var(--accent)',
                  margin: 0,
                }}
              >
                Payment
              </h2>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}
              >
                ×
              </button>
            </div>

            {/* Total due */}
            <div
              style={{
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Total Due</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                Rp {total.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Payment method toggle */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 8 }}
              >
                Payment Method
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['cash', 'transfer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m)
                      setCashTendered('')
                    }}
                    style={{
                      flex: 1,
                      height: 40,
                      border: '1px solid',
                      borderColor: paymentMethod === m ? 'var(--accent)' : 'var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: paymentMethod === m ? 'var(--accent)' : 'var(--surface)',
                      color: paymentMethod === m ? 'white' : 'var(--foreground)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {m === 'cash' ? '💵 Cash' : '🏦 Transfer'}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash tendered section */}
            {paymentMethod === 'cash' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Cash Tendered
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter amount..."
                    value={
                      cashTendered
                        ? `Rp ${Number(cashTendered.replace(/\D/g, '')).toLocaleString('id-ID')}`
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setCashTendered(raw)
                    }}
                    style={{
                      width: '100%',
                      height: 44,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 14px',
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      background: 'var(--surface)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Quick amount buttons */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered(String(amt))}
                      style={{
                        flex: '1 1 auto',
                        height: 34,
                        fontSize: 12,
                        fontWeight: 500,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          cashTendered === String(amt)
                            ? 'var(--accent-light-bg)'
                            : 'var(--background)',
                        color: 'var(--foreground)',
                        cursor: 'pointer',
                      }}
                    >
                      Rp {amt.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>

                {/* Change */}
                {Number(cashTendered) >= total && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--success-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 16px',
                      marginBottom: 20,
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 500 }}>
                      Change
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                      Rp {change.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Transfer info */}
            {paymentMethod === 'transfer' && (
              <div
                style={{
                  background: 'var(--info-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: 13,
                  color: 'var(--info)',
                }}
              >
                Ask customer to transfer Rp {total.toLocaleString('id-ID')} and confirm receipt
                before completing.
              </div>
            )}

            {/* Confirm button */}
            <button
              type="button"
              onClick={() => {
                if (
                  paymentMethod === 'cash' &&
                  Number(cashTendered.replace(/\D/g, '')) < total
                ) {
                  toast.error('Cash tendered is less than total')
                  return
                }
                setShowPayment(false)
                handleConfirmPayment()
              }}
              disabled={isPending}
              style={{
                width: '100%',
                height: 48,
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
                fontWeight: 700,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}

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
            <div className="row">
              <span>Payment</span>
              <span>{receiptData.paymentMethod}</span>
            </div>
            {receiptData.paymentMethod === 'cash' && (
              <>
                <div className="row">
                  <span>Cash</span>
                  <span>Rp {receiptData.cashTendered.toLocaleString('id-ID')}</span>
                </div>
                <div className="row">
                  <span>Change</span>
                  <span>Rp {receiptData.change.toLocaleString('id-ID')}</span>
                </div>
              </>
            )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0, color: 'var(--accent)' }}>
                Order Complete
              </h2>
              <button
                onClick={resetCart}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>
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
                marginBottom: 16,
              }}
            >
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>
                Rp {receiptData.total.toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ fontSize: 13, color: 'var(--foreground-muted)', marginBottom: 16 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
              >
                <span>Payment</span>
                <span style={{ textTransform: 'capitalize' }}>{receiptData.paymentMethod}</span>
              </div>
              {receiptData.paymentMethod === 'cash' && (
                <>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                  >
                    <span>Cash</span>
                    <span>Rp {receiptData.cashTendered.toLocaleString('id-ID')}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--success)',
                      fontWeight: 500,
                    }}
                  >
                    <span>Change</span>
                    <span>Rp {receiptData.change.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
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

      {showHistory && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowHistory(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              background: 'rgba(0,0,0,0.35)',
            }}
          />

          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 90,
              width: 480,
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 56,
                padding: '0 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--accent)',
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
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 6px',
                    fontSize: 12,
                    color: 'var(--foreground)',
                    background: 'var(--background)',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>–</span>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => {
                    setHistoryDateTo(e.target.value)
                    setHistoryPage(1)
                  }}
                  style={{
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 6px',
                    fontSize: 12,
                    color: 'var(--foreground)',
                    background: 'var(--background)',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
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
                  width: '100%',
                  height: 36,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  background: 'var(--background)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Orders list */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {isHistoryLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 80,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--border)',
                      opacity: 0.5,
                    }}
                  />
                ))}

              {!isHistoryLoading && orders.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                  <p style={{ fontSize: 14 }}>No transactions today</p>
                </div>
              )}

              {orders.map((order: any) => (
                <div
                  key={order.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    background: 'var(--background)',
                  }}
                >
                  {/* Order header row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>
                      {order.code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background:
                          order.status === 'final' ? 'var(--success-bg)' : 'var(--warning-bg)',
                        color: order.status === 'final' ? 'var(--success)' : 'var(--warning)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Customer + date row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {order.customer_name || order.customer?.name || 'Walk-in'}
                      {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                      {new Date(order.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Items summary */}
                  {order.sales_order_details && order.sales_order_details.length > 0 && (
                    <div
                      style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 8 }}
                    >
                      {order.sales_order_details.length} item(s)
                    </div>
                  )}

                  {/* Total */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                      Rp {Number(order.total_price).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {historyMeta && historyMeta.last_page > 1 && (
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    color:
                      historyPage === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
                    cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  ← Prev
                </button>

                <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                  Page {historyPage} of {historyMeta.last_page}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage((p) => Math.min(historyMeta.last_page, p + 1))
                  }
                  disabled={historyPage === historyMeta.last_page}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    color:
                      historyPage === historyMeta.last_page
                        ? 'var(--foreground-subtle)'
                        : 'var(--foreground)',
                    cursor:
                      historyPage === historyMeta.last_page ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  Next →
                </button>
              </div>
            )}

            {/* Summary footer */}
            {!isHistoryLoading && orders.length > 0 && (
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--accent-light-bg)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {historyMeta?.total ?? orders.length} transactions
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Page total</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                      Rp{' '}
                      {orders
                        .reduce((sum: number, o: any) => sum + Number(o.total_price), 0)
                        .toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
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
