'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import { salesOrdersService as salesOrderService } from '@/services/sales-orders.service'
import { customersService as customerService } from '@/services/customers.service'
import { bundlesService as bundleService } from '@/services/bundles.service'
import { paymentMethodsService as paymentMethodService } from '@/services/payment-methods.service'
import { paymentsService as paymentService } from '@/services/payments.service'
import { vouchersService } from '@/services/vouchers.service'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react'
import type { PosCartItem, PosCartBundle } from '@/types/api'
import type { ReceiptData } from '@/components/PosReceipt'

const generateKey = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36)

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
  const { user } = useAuth()

  const todayISO = () => {
    const now = new Date()
    const offset = now.getTimezoneOffset() * 60000
    return new Date(now.getTime() - offset).toISOString().slice(0, 16)
  }

  // Product grid state
  const [activeTab, setActiveTab] = useState<'products' | 'bundles'>('products')
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [bundleCart, setBundleCart] = useState<PosCartBundle[]>([])
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleSearchDebounced, setBundleSearchDebounced] = useState('')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [lotPickerFor, setLotPickerFor] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('code')
  const [productPage, setProductPage] = useState(1)
  const [inStockOnly, setInStockOnly] = useState<boolean>(false)
  // Cart / order state
  const [orderType, setOrderType] = useState<'offline' | 'online'>('offline')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const [cashTendered, setCashTendered] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string
    discount_amount: number
    voucher_id: number | null
  } | null>(null)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const discountAmount = appliedVoucher?.discount_amount ?? 0
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [orderNote, setOrderNote] = useState('')
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toLocaleDateString('en-CA')
  )
  const [fulfillmentDate, setFulfillmentDate] = useState<string>(todayISO())
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false)
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
  // Editing existing order state
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [editingOrderCode, setEditingOrderCode] = useState<string | null>(null)

  // Pre-orders panel state
  const [showPreorders, setShowPreorders] = useState(false)
  const [preorderSearch, setPreorderSearch] = useState('')
  const [preorderSearchDebounced, setPreorderSearchDebounced] = useState('')
  const [preorderDateFrom, setPreorderDateFrom] = useState('')
  const [preorderDateTo, setPreorderDateTo] = useState('')
  const [preorderPage, setPreorderPage] = useState(1)

  // Pre-order modal state
  const [showPreorder, setShowPreorder] = useState(false)
  const [poCustomerId, setPoCustomerId] = useState<number | null>(null)
  const [poCustomerSearch, setPoCustomerSearch] = useState('')
  const [poCustomerSearchDebounced, setPoCustomerSearchDebounced] = useState('')
  const [poShowCustomerDrop, setPoShowCustomerDrop] = useState(false)
  const [poGuestName, setPoGuestName] = useState('')
  const [poGuestPhone, setPoGuestPhone] = useState('')
  const [poFulfillmentDate, setPoFulfillmentDate] = useState('')
  const [poNote, setPoNote] = useState('')
  const [poItems, setPoItems] = useState<PosCartItem[]>([])
  const [poProductSearch, setPoProductSearch] = useState('')
  const [poProductSearchDebounced, setPoProductSearchDebounced] = useState('')
  const [poShowProductDrop, setPoShowProductDrop] = useState(false)

  const [receiptData, setReceiptData] = useState<{
    cart: PosCartItem[]
    subtotal: number
    discount: number
    total: number
    customerName: string
    code: string
    date: string
    paymentMethod: string
    cashTendered: number
    change: number
  } | null>(null)
  const [printReceipt, setPrintReceipt] = useState<ReceiptData | null>(null)

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

  // Pre-orders panel search debounce
  useEffect(() => {
    const t = setTimeout(() => setPreorderSearchDebounced(preorderSearch), 400)
    return () => clearTimeout(t)
  }, [preorderSearch])

  // Pre-order customer search debounce
  useEffect(() => {
    const t = setTimeout(() => setPoCustomerSearchDebounced(poCustomerSearch), 400)
    return () => clearTimeout(t)
  }, [poCustomerSearch])

  // Pre-order product search debounce
  useEffect(() => {
    const t = setTimeout(() => setPoProductSearchDebounced(poProductSearch), 400)
    return () => clearTimeout(t)
  }, [poProductSearch])

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
        include: 'branch,product_uom_batch',
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

  // Product UOMs lookup so we can resolve product/category/uom names without
  // relying on deep includes on the inventory list.
  const { data: puData } = useQuery({
    queryKey: ['product-uoms-pos'],
    queryFn: () =>
      productUomsService
        .list({
          per_page: 500,
          include: 'product,product.product_category,uom',
          'filter[status]': 'active',
        } as any)
        .then((r) => r.data),
  })
  const productUomsList: any[] = (puData as any)?.data ?? []
  const getProductUom = (id: number | null | undefined) =>
    id != null ? productUomsList.find((pu: any) => pu.id === id) : undefined

  const getItemCategory = (item: any): string => {
    // Path 1: look up via productUomsList — the only query that
    // explicitly includes product.product_category, so this resolves
    // the category even when the inventory row's nested chain stops
    // at product_uom (the inventory include is just product_uom_batch).
    const puid =
      item.product_uom_batch?.product_uom_id
      ?? item.product_uom_batch?.product_uom?.id
      ?? item.product_uom_id
    const pu = getProductUom(puid)
    if (pu?.product?.product_category?.name) {
      return pu.product.product_category.name
    }
    // Path 2: fall back to whatever the inventory row carries inline.
    return (
      item.product_uom_batch?.product_uom?.product?.product_category?.name
      ?? item.product_uom?.product?.product_category?.name
      ?? ''
    )
  }

  const filteredItems = useMemo(() => {
    if (selectedCategory === null) return items
    return items.filter(
      (item: any) => getItemCategory(item) === selectedCategory,
    )
  }, [items, selectedCategory, productUomsList])

  // Sort lots earliest-expiring-first-out: non-expired by expiry ASC, then
  // undated, then expired last. Undefined/null expiry sorts after all dated
  // future lots.
  const fefoCompare = (a: any, b: any) => {
    const now = Date.now()
    const ae = a.expiry_date ? new Date(a.expiry_date).getTime() : null
    const be = b.expiry_date ? new Date(b.expiry_date).getTime() : null
    const aExpired = ae !== null && ae < now
    const bExpired = be !== null && be < now
    if (aExpired !== bExpired) return aExpired ? 1 : -1
    if (ae === null && be === null) return 0
    if (ae === null) return 1
    if (be === null) return -1
    return ae - be
  }

  // Group inventory rows by product_uom_id so multiple batches/lots of the
  // same product collapse into one tile. Each group carries its FEFO-sorted
  // lot list, summed stock, and a default lot for add-to-cart.
  const groupedItems = useMemo(() => {
    type Group = {
      key: string
      product_uom_id: number | null
      representative: any
      lots: any[]
      totalStock: number
      defaultLot: any
    }
    const map = new Map<string, Group>()
    for (const row of filteredItems as any[]) {
      const puid =
        row.product_uom_id
        ?? row.product_uom_batch?.product_uom?.id
        ?? row.product_uom?.id
        ?? null
      const key = puid !== null ? `uom:${puid}` : `id:${row.id}`
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          product_uom_id: puid,
          representative: row,
          lots: [],
          totalStock: 0,
          defaultLot: row,
        }
        map.set(key, g)
      }
      g.lots.push(row)
      g.totalStock += Number(row.stock ?? 0)
    }
    for (const g of map.values()) {
      g.lots.sort(fefoCompare)
      const firstStocked = g.lots.find((l) => Number(l.stock ?? 0) > 0)
      g.defaultLot = firstStocked ?? g.lots[0]
      g.representative = g.defaultLot
    }
    return Array.from(map.values())
  }, [filteredItems])

  // Unique category names derived from productUomsList — using inventory
  // items would only surface categories present on the current page (20).
  const categories = useMemo<string[]>(() => {
    const cats = new Set<string>()
    for (const pu of productUomsList as any[]) {
      const name = pu?.product?.product_category?.name
      if (name) cats.add(name)
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b))
  }, [productUomsList])

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
  const customers: any[] = (customerData as any)?.data ?? []

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

  // Pre-order customer search query
  const { data: poCustomerData } = useQuery({
    queryKey: ['po-customers', poCustomerSearchDebounced],
    enabled: showPreorder && poCustomerSearchDebounced.length >= 2,
    queryFn: () =>
      customerService
        .list({
          per_page: 10,
          'filter[search]': poCustomerSearchDebounced,
        })
        .then((r) => r.data),
  })
  const poCustomers: any[] = (poCustomerData as any)?.data ?? []

  // Pre-order product search query
  const { data: poProductData } = useQuery({
    queryKey: ['po-products', poProductSearchDebounced],
    enabled: showPreorder && poShowProductDrop,
    queryFn: () => {
      const params: Record<string, any> = {
        per_page: 15,
        'filter[product_type]': 'final',
        'filter[status]': 'active',
        include: 'branch,product_uom_batch',
      }
      if (poProductSearchDebounced) params['filter[search]'] = poProductSearchDebounced
      return productInventoriesService.list(params).then((r) => r.data)
    },
  })
  const poProducts: any[] = (poProductData as any)?.data ?? []

  // Pending pre-orders panel query
  const { data: preorderData, isLoading: isPreordersLoading } = useQuery({
    queryKey: ['pos-preorders', preorderPage, preorderSearchDebounced, preorderDateFrom, preorderDateTo],
    enabled: showPreorders,
    queryFn: () => {
      const params: Record<string, any> = {
        page: preorderPage,
        per_page: 20,
        sort: 'fulfillment_date',
        'filter[status]': 'pending',
        include: 'sales_order_details,customer',
      }
      if (preorderSearchDebounced) params['filter[search]'] = preorderSearchDebounced
      if (preorderDateFrom) params['filter[fulfillment_date_gte]'] = preorderDateFrom
      if (preorderDateTo) params['filter[fulfillment_date_lte]'] = preorderDateTo
      return salesOrderService.list(params).then((r) => r.data)
    },
  })
  const preorders: any[] = (preorderData as any)?.data ?? []
  const preorderMeta = (preorderData as any)?.meta

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

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['payment-methods-all'],
    queryFn: () =>
      paymentMethodService.list({ per_page: 50, sort: 'id' }).then((r) => r.data),
  })
  const paymentMethods: any[] = (paymentMethodsData as any)?.data ?? []

  // Totals
  const subtotal =
    cart.reduce((s, c) => s + c.price * c.qty, 0) +
    bundleCart.reduce((s, c) => s + c.price * c.qty, 0)
  const total = Math.max(0, subtotal - discountAmount)

  const selectedMethod = paymentMethods.find((pm: any) => pm.id === paymentMethodId)
  const isCashMethod = selectedMethod?.name?.toLowerCase().includes('cash') ?? false

  // Payment modal derived values
  const change =
    isCashMethod
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

  const qc = useQueryClient()

  // Pre-order mutation
  const { mutate: poMutate, isPending: poIsPending } = useMutation({
    mutationFn: () => {
      const subtotal = poItems.reduce((s, i) => s + i.price * i.qty, 0)
      const payload = {
        code: `PO-${Date.now()}`,
        type: 'offline' as const,
        customer_id: poCustomerId ?? null,
        customer_name: poCustomerId ? undefined : poGuestName || undefined,
        customer_phone: poCustomerId ? undefined : poGuestPhone || undefined,
        date: transactionDate,
        fulfillment_date: new Date(poFulfillmentDate).toISOString(),
        subtotal_price: subtotal,
        discount_price: 0,
        total_price: subtotal,
        status: 'pending' as const,
        settlement_status: 'pending' as const,
        description: poNote || undefined,
        details: poItems.map((i) => ({
          product_inventory_id: i.product_inventory_id,
          bundle_id: null,
          bundle_details: null,
          qty: i.qty,
          price: i.price,
          status: 'pending' as const,
        })),
      }
      return api.post('/sales-orders', payload, {
        headers: { 'Idempotency-Key': generateKey() },
      })
    },
    onSuccess: () => {
      toast.success('Pre-order created')
      resetPreorder()
      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error'),
  })

  const resetPreorder = () => {
    setShowPreorder(false)
    setPoCustomerId(null)
    setPoCustomerSearch('')
    setPoGuestName('')
    setPoGuestPhone('')
    setPoFulfillmentDate('')
    setPoNote('')
    setPoItems([])
    setPoProductSearch('')
    setPoShowProductDrop(false)
    setPoShowCustomerDrop(false)
  }

  const poSubtotal = poItems.reduce((s, i) => s + i.price * i.qty, 0)

  const loadPreorderToCart = (order: any) => {
    setCart([])
    setBundleCart([])

    const details = order.sales_order_details ?? []
    const newCart: PosCartItem[] = details
      .filter((d: any) => !d.bundle_id)
      .map((d: any) => ({
        product_inventory_id: d.product_inventory_id,
        name:
          d.product_inventory_snapshot?.product_uom?.product?.name ??
          d.description ??
          `Item #${d.product_inventory_id}`,
        code: d.product_inventory_snapshot?.code ?? '',
        price: Number(d.price),
        qty: Number(d.qty),
        price_editable: d.product_inventory_snapshot?.price_editable ?? false,
      }))
    setCart(newCart)

    if (order.customer_id) {
      setSelectedCustomerId(order.customer_id)
      setCustomerSearch(order.customer?.name ?? '')
    } else {
      setSelectedCustomerId(null)
      setGuestName(order.customer_name ?? '')
      setGuestPhone(order.customer_phone ?? '')
    }

    setFulfillmentDate(
      order.fulfillment_date
        ? new Date(order.fulfillment_date).toISOString().slice(0, 16)
        : todayISO()
    )
    setOrderNote(order.description ?? '')
    setEditingOrderId(order.id)
    setEditingOrderCode(order.code)
    setShowPreorders(false)
    setActiveTab('products')
    toast.success(`Pre-order ${order.code} loaded into cart`)
  }

  // Sales order mutation — creates new order or updates a pre-order
  const { mutate, isPending } = useMutation({
    mutationFn: (payload: any) =>
      editingOrderId
        ? salesOrderService.update(editingOrderId, payload as any)
        : api.post('/sales-orders', payload, {
            headers: { 'Idempotency-Key': generateKey() },
          }),
    onSuccess: async (res: any, variables: any) => {
      const salesOrderId = res?.data?.data?.id ?? editingOrderId ?? null
      const salesOrderCode =
        res?.data?.data?.code ?? variables?.code ?? editingOrderCode ?? ''
      const paidAmount = isCashMethod
        ? Number(cashTendered.replace(/\D/g, ''))
        : variables.total_price
      if (salesOrderId && paymentMethodId) {
        try {
          await paymentService.create({
            sales_order_id: salesOrderId,
            payment_method_id: paymentMethodId,
            amount: paidAmount,
            description: orderNote || undefined,
          })
        } catch (err: any) {
          toast.error(
            'Order created but payment recording failed: ' +
              (err?.response?.data?.message ?? 'Unknown error'),
          )
        }
      }

      // Build the thermal receipt before the cart is cleared.
      const now = new Date()
      const receipt: ReceiptData = {
        companyName: 'Dapur Cokelat Indonesia',
        branchName: (user as any)?.branch?.name ?? 'Dapur Cokelat',
        branchAddress: (user as any)?.branch?.address ?? '',
        branchPhone: (user as any)?.branch?.phone ?? '',
        invoiceNo: salesOrderCode,
        date: now
          .toLocaleDateString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
          .replace(/\//g, '-'),
        time: now.toLocaleTimeString('id-ID'),
        cashierName: (user as any)?.name ?? 'Kasir',
        customerName: selectedCustomerId
          ? customerSearch || undefined
          : guestName || undefined,
        orderType: orderType,
        items: [
          ...cart.map((c) => ({
            name: c.name ?? '',
            qty: c.qty,
            price: c.price,
            subtotal: c.qty * c.price,
          })),
          ...bundleCart.map((c) => ({
            name: c.name ?? '',
            qty: c.qty,
            price: c.price,
            subtotal: c.qty * c.price,
          })),
        ],
        grossAmount: variables.subtotal_price ?? 0,
        discountAmount: variables.discount_price ?? 0,
        totalAmount: variables.total_price ?? 0,
        payments: [
          {
            method: selectedMethod?.name ?? 'Cash',
            amount: paidAmount,
          },
        ],
        changeAmount: isCashMethod
          ? Math.max(0, paidAmount - (variables.total_price ?? 0))
          : 0,
        isPrinted: false,
      }
      setPrintReceipt(receipt)
      triggerPrint(receipt)

      setShowReceipt(true)
      toast.success('Order placed!')
      if (editingOrderId) {
        qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      }
    },
    onError: (err: any) => {
      setReceiptData(null)
      toast.error(err?.response?.data?.message ?? 'Failed to place order')
    },
  })

  // Park the current cart as a pending order (no payment, no receipt).
  // Updates the existing sales order when editingOrderId is set, otherwise
  // creates a new one.
  const { mutate: holdMutate, isPending: isHoldPending } = useMutation({
    mutationFn: (payload: any) =>
      editingOrderId
        ? salesOrderService.update(editingOrderId, payload as any)
        : api.post('/sales-orders', payload, {
            headers: { 'Idempotency-Key': generateKey() },
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      toast.success(editingOrderId ? 'Order updated (held)' : 'Order held as pending')
      resetCart()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to hold order'),
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
    setAppliedVoucher(null)
    setVoucherLoading(false)
    setOrderNote('')
    setTransactionDate(new Date().toLocaleDateString('en-CA'))
    setFulfillmentDate(todayISO())
    setOrderType('offline')
    setShowPayment(false)
    setPaymentMethodId(null)
    setCashTendered('')
    setShowReceipt(false)
    setReceiptData(null)
    setPrintReceipt(null)
    setEditingOrderId(null)
    setEditingOrderCode(null)
  }, [])

  // Pick a concrete lot + add it to the cart. Used for both single-row
  // adds (legacy) and grouped adds (preferred). Carries lot_options when
  // available so the cart line can offer a "change lot" picker.
  const addLotToCart = useCallback(
    (lot: any, lotOptions?: any[]) => {
      if ((lot.stock ?? 0) <= 0) {
        toast.error('Item is out of stock')
        return
      }
      const linePrice =
        orderType === 'online'
          ? (lot.online_price ?? lot.base_price ?? 0)
          : (lot.base_price ?? 0)
      const options = (lotOptions ?? [lot]).map((l: any) => ({
        product_inventory_id: l.id,
        stock: Number(l.stock ?? 0),
        expiry_date: l.expiry_date ?? null,
        base_price: Number(l.base_price ?? 0),
        online_price: l.online_price ?? null,
      }))
      setCart((prev) => {
        const existing = prev.find((c) => c.product_inventory_id === lot.id)
        if (existing) {
          return prev.map((c) =>
            c.product_inventory_id === lot.id ? { ...c, qty: c.qty + 1 } : c
          )
        }
        return [
          ...prev,
          {
            product_inventory_id: lot.id,
            name:
              lot.product_uom_batch?.product_uom?.product?.name ??
              lot.product_uom?.product?.name ??
              lot.code ??
              `Item #${lot.id}`,
            code:
              lot.product_uom_batch?.product_uom?.code ??
              lot.product_uom?.code ??
              lot.code,
            price: linePrice,
            qty: 1,
            price_editable: lot.price_editable ?? false,
            expiry_date: lot.expiry_date ?? null,
            lot_options: options,
          },
        ]
      })
    },
    [orderType]
  )

  // Back-compat wrapper: add a single inventory row (no group context).
  const addToCart = useCallback(
    (item: any) => addLotToCart(item),
    [addLotToCart]
  )

  // Preferred entry for the product grid: take a group, pick the FEFO lot.
  const addGroupToCart = useCallback(
    (group: { defaultLot: any; lots: any[] }) => {
      if (!group.defaultLot) return
      addLotToCart(group.defaultLot, group.lots)
    },
    [addLotToCart]
  )

  // Change a cart line's selected lot. If the target lot is already a
  // separate line, merge quantities and drop the old line.
  const changeCartLot = useCallback(
    (currentInventoryId: number, targetLot: any) => {
      const lot = {
        product_inventory_id: Number(targetLot.product_inventory_id),
        expiry_date: targetLot.expiry_date ?? null,
        base_price: Number(targetLot.base_price ?? 0),
        online_price: targetLot.online_price ?? null,
      }
      const nextPrice =
        orderType === 'online'
          ? (lot.online_price ?? lot.base_price)
          : lot.base_price
      setCart((prev) => {
        const source = prev.find((c) => c.product_inventory_id === currentInventoryId)
        if (!source) return prev
        if (source.product_inventory_id === lot.product_inventory_id) return prev
        const merged = prev.find(
          (c) => c.product_inventory_id === lot.product_inventory_id
        )
        if (merged) {
          return prev
            .map((c) =>
              c.product_inventory_id === lot.product_inventory_id
                ? { ...c, qty: c.qty + source.qty }
                : c
            )
            .filter((c) => c.product_inventory_id !== currentInventoryId)
        }
        return prev.map((c) =>
          c.product_inventory_id === currentInventoryId
            ? {
                ...c,
                product_inventory_id: lot.product_inventory_id,
                price: c.price_editable ? c.price : nextPrice,
                expiry_date: lot.expiry_date,
              }
            : c
        )
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

  // Build a printable HTML string mirroring PosReceipt's layout. Used by the
  // hidden-iframe printer below.
  const buildReceiptHtml = (r: ReceiptData): string => {
    const divider = '--------------------------------------'
    const thin = '- - - - - - - - - - - - - - - - - - - -'
    const fmt = (n: number) => n.toLocaleString('id-ID')
    const row = (left: string, right: string) =>
      `<div style="display:flex;justify-content:space-between;"><span>${left}</span><span>${right}</span></div>`
    const paymentTotal = r.payments.reduce((s, p) => s + p.amount, 0)

    return `
      <div style="text-align:center;margin-bottom:6px;font-size:11px;">
        PT. Sumber Cemerlang Mandiri<br>
        Ruko Golden Boulevard, J, 9, Lengkong Karya, Serpong Utara, Kota Tangerang Selatan, Banten, 15331<br>
        NPWP: 71.008.539.0-411.000
      </div>
      <div style="text-align:center;margin-bottom:6px;">
        <strong style="font-size:14px;">DAPUR COKELAT</strong><br>
        <strong>${r.branchName.toUpperCase()}</strong><br>
        ${r.branchAddress ? `<span style="font-size:11px;">${r.branchAddress}</span><br>` : ''}
        ${r.branchPhone ?? ''}
      </div>
      <div>${divider}</div>
      <div style="margin:4px 0;">
        ${r.date} ${r.time}<br>
        ${r.invoiceNo}<br>
        ${r.cashierName}
        ${r.customerName ? `<br>${r.customerName}` : ''}
      </div>
      <div>${divider}</div>
      ${
        r.isPrinted && r.reprintBy
          ? `<div style="margin:4px 0;">Reprint by ${r.reprintBy} on<br>${r.reprintAt ?? ''}</div><div>${divider}</div>`
          : ''
      }
      <div style="margin:4px 0;">
        ${r.items
          .map(
            (item) => `
              <div>${item.name}</div>
              <div style="display:flex;justify-content:space-between;">
                <span>${item.qty} x ${fmt(item.price)}</span>
                <span>${fmt(item.subtotal)}</span>
              </div>`,
          )
          .join('')}
      </div>
      <div>${thin}</div>
      <div style="margin:4px 0;">
        ${row('GROSS', fmt(r.grossAmount))}
        ${r.discountAmount > 0 ? row('DISCOUNT', fmt(r.discountAmount)) : ''}
      </div>
      <div>${thin}</div>
      <div style="margin:4px 0;">
        <div style="display:flex;justify-content:space-between;font-weight:bold;">
          <span>TOTAL</span><span>${fmt(r.totalAmount)}</span>
        </div>
        ${r.payments.map((p) => row(p.method.toUpperCase(), fmt(p.amount))).join('')}
        ${r.changeAmount && r.changeAmount > 0 ? row('KEMBALI', fmt(r.changeAmount)) : ''}
      </div>
      <div>${thin}</div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;margin:4px 0;">
        <span>PAYMENT</span><span>${fmt(paymentTotal)}</span>
      </div>
      <div style="margin:4px 0;">${r.branchName.toUpperCase()} – ${r.orderType.toUpperCase()}</div>
      <div>${divider}</div>
      <div style="text-align:center;font-size:11px;margin:6px 0;">
        ChocoCall : 0811-1920-9900<br>
        ALL ABOUT CHOCOLATES &amp; CAKES
      </div>
      <div>${divider}</div>
      <div style="text-align:center;font-size:11px;margin:4px 0;">Harga sudah termasuk pajak</div>
      <div>${divider}</div>
      <div style="text-align:center;font-size:11px;margin:4px 0;">
        Keluhan mengenai produk dapat diterima maksimal 1x24 jam sejak tanggal pembelian
      </div>
    `
  }

  // Open the system print dialog with the receipt rendered into a hidden
  // iframe sized for an 80mm thermal roll. Does not affect the POS UI.
  const triggerPrint = (receipt: ReceiptData) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return
    }

    const receiptHtml = buildReceiptHtml(receipt)

    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: 76mm auto; margin: 2mm; }
          body {
            margin: 0;
            padding: 4mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.3;
            width: 70mm;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>
        ${receiptHtml}
      </body>
      </html>
    `)
    iframeDoc.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 1000)
  }

  // Voucher apply — looks the voucher up directly and computes the discount
  // locally. The /sales-orders/apply-voucher endpoint isn't used because it
  // requires a fully-formed order body and its response shape isn't reliable.
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return
    setVoucherLoading(true)
    try {
      const voucherRes = await vouchersService.list({
        'filter[code]': voucherCode,
        'filter[status]': 'active',
        per_page: 1,
      } as any)
      const voucher = (voucherRes.data as any)?.data?.[0]
      if (!voucher) {
        toast.error('Voucher not found or inactive')
        return
      }
      if (
        voucher.min_subtotal_price &&
        subtotal < voucher.min_subtotal_price
      ) {
        toast.error(
          `Minimum purchase Rp ${Number(voucher.min_subtotal_price).toLocaleString('id-ID')} required`,
        )
        return
      }
      let discountAmount = 0
      if (voucher.discount_type === 'percent') {
        const rawDiscount =
          (subtotal * Number(voucher.discount_value ?? 0)) / 100
        const maxCap =
          Number(voucher.max_discount_price ?? 0) > 0
            ? Number(voucher.max_discount_price)
            : Infinity
        discountAmount = Math.min(rawDiscount, maxCap)
      } else {
        discountAmount = Number(voucher.discount_value ?? 0)
      }
      setAppliedVoucher({
        code: voucherCode,
        discount_amount: discountAmount,
        voucher_id: voucher.id,
      })
      toast.success('Voucher applied')
    } catch {
      toast.error('Failed to apply voucher')
    } finally {
      setVoucherLoading(false)
    }
  }

  // Payment gate — opens payment modal
  const handleCharge = () => {
    if (cart.length === 0 && bundleCart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    if (!paymentMethodsLoading && paymentMethods.length === 0) {
      toast.error('No payment methods found. Add one in Settings first.')
      return
    }
    setShowPayment(true)
  }

  // Hold — save the current cart as a pending order with no payment.
  const handleHold = () => {
    if (cart.length === 0 && bundleCart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    const cartSubtotal =
      cart.reduce((s, c) => s + c.price * c.qty, 0) +
      bundleCart.reduce((s, c) => s + c.price * c.qty, 0)
    const orderTotal = Math.max(0, cartSubtotal - discountAmount)
    const payload = {
      code: editingOrderCode ?? `POS-${Date.now()}`,
      type: orderType,
      customer_id: selectedCustomerId ?? null,
      customer_name: selectedCustomerId ? undefined : guestName || undefined,
      customer_phone: selectedCustomerId ? undefined : guestPhone || undefined,
      date: transactionDate,
      fulfillment_date: new Date(fulfillmentDate).toISOString(),
      voucher_id: appliedVoucher?.voucher_id ?? undefined,
      subtotal_price: cartSubtotal,
      discount_price: discountAmount,
      total_price: orderTotal,
      status: 'pending' as const,
      settlement_status: 'pending' as const,
      description: orderNote || undefined,
      details: [
        ...cart.map((c) => ({
          product_inventory_id: c.product_inventory_id,
          bundle_id: null,
          bundle_details: null,
          qty: c.qty,
          price: c.price,
          status: 'pending' as const,
        })),
        ...bundleCart.map((c) => ({
          product_inventory_id: null,
          bundle_id: c.bundle_id,
          bundle_details: c.bundle_details,
          qty: c.qty,
          price: c.price,
          status: 'pending' as const,
        })),
      ],
    }
    holdMutate(payload)
  }

  // Confirm payment — submits order after payment modal confirms
  const handleConfirmPayment = () => {
    const cartSubtotal =
      cart.reduce((s, c) => s + c.price * c.qty, 0) +
      bundleCart.reduce((s, c) => s + c.price * c.qty, 0)
    const orderTotal = Math.max(0, cartSubtotal - discountAmount)
    const tendered =
      isCashMethod ? Number(cashTendered.replace(/\D/g, '')) : orderTotal
    const orderChange = isCashMethod ? Math.max(0, tendered - orderTotal) : 0
    const payload = {
      code: editingOrderCode ?? `POS-${Date.now()}`,
      type: orderType,
      customer_id: selectedCustomerId ?? null,
      customer_name: selectedCustomerId ? undefined : guestName || undefined,
      customer_phone: selectedCustomerId ? undefined : guestPhone || undefined,
      date: transactionDate,
      fulfillment_date: new Date(fulfillmentDate).toISOString(),
      voucher_id: appliedVoucher?.voucher_id ?? undefined,
      subtotal_price: cartSubtotal,
      discount_price: discountAmount,
      total_price: orderTotal,
      status: 'final' as const,
      settlement_status: 'pending' as const,
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
      subtotal: cartSubtotal,
      discount: discountAmount,
      total: orderTotal,
      customerName: selectedCustomerId ? customerSearch : guestName || 'Walk-in',
      code: payload.code,
      date: payload.date,
      paymentMethod: selectedMethod?.name ?? 'Unknown',
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
          <button
            type="button"
            onClick={() => setShowPreorder(true)}
            style={{
              height: 36,
              padding: '0 14px',
              border: '1px solid var(--accent-light)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-light-bg)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            📋 Pre-order
          </button>
          <button
            type="button"
            onClick={() => setShowPreorders(true)}
            style={{
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
            🗂 Pending
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
            onClick={() => { setSelectedCategory(null); setProductPage(1) }}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid',
              borderColor: selectedCategory === null ? 'var(--accent)' : 'var(--border)',
              background: selectedCategory === null ? 'var(--accent)' : 'var(--surface)',
              color: selectedCategory === null ? 'white' : 'var(--foreground)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            All
          </button>
          {categories.map((name: string) => (
            <button
              key={name}
              type="button"
              onClick={() => { setSelectedCategory(name); setProductPage(1) }}
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid',
                borderColor: selectedCategory === name ? 'var(--accent)' : 'var(--border)',
                background: selectedCategory === name ? 'var(--accent)' : 'var(--surface)',
                color: selectedCategory === name ? 'white' : 'var(--foreground)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {name}
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
              {groupedItems.map((group) => {
                const item = group.defaultLot
                const isHovered = hoveredCard === group.key
                const lotCount = group.lots.length
                const outOfStock = group.totalStock <= 0
                return (
                  <div
                    key={group.key}
                    onClick={() => addGroupToCart(group)}
                    onMouseEnter={() => setHoveredCard(group.key)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${isHovered ? 'var(--accent-light)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: 12,
                      opacity: outOfStock ? 0.45 : 1,
                      cursor: outOfStock ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: isHovered ? 'var(--shadow-sm)' : 'none',
                      transition: 'border-color 120ms ease, box-shadow 120ms ease',
                      position: 'relative',
                    }}
                  >
                    {lotCount > 1 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 99,
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                        }}
                      >
                        {lotCount} lots
                      </span>
                    )}
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
                        paddingRight: lotCount > 1 ? 52 : 0,
                      }}
                    >
                      {item.product_uom_batch?.product_uom?.product?.name ??
                        item.product_uom?.product?.name ??
                        getProductUom(item.product_uom_id)?.product?.name ??
                        item.productUom?.product?.name ??
                        item.product?.name ??
                        item.code ??
                        `#${item.id}`}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.product_uom_batch?.product_uom?.code
                        ?? item.product_uom?.code
                        ?? item.code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: group.totalStock > 0 ? 'var(--success)' : 'var(--destructive)',
                        fontWeight: 500,
                      }}
                    >
                      Stock: {group.totalStock}
                    </span>
                    {item.expiry_date && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color:
                            new Date(item.expiry_date) < new Date()
                              ? 'var(--destructive)'
                              : new Date(item.expiry_date) <
                                  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                ? 'var(--warning)'
                                : 'var(--foreground-muted)',
                        }}
                      >
                        Exp:{' '}
                        {new Date(item.expiry_date).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {lotCount > 1 && ' (earliest)'}
                      </span>
                    )}
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

        {/* Editing pre-order banner */}
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
                {/* Name + code */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.code}</div>
                  {(item.expiry_date ||
                    (item.lot_options && item.lot_options.length > 1)) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {item.expiry_date && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 99,
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            color:
                              new Date(item.expiry_date) < new Date()
                                ? 'var(--destructive)'
                                : new Date(item.expiry_date) <
                                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                  ? 'var(--warning)'
                                  : 'var(--foreground-muted)',
                          }}
                        >
                          Exp{' '}
                          {new Date(item.expiry_date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {item.lot_options && item.lot_options.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLotPickerFor(
                              lotPickerFor === item.product_inventory_id
                                ? null
                                : item.product_inventory_id
                            )
                          }
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 8px',
                            borderRadius: 99,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                          }}
                        >
                          Change lot
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {lotPickerFor === item.product_inventory_id &&
                  item.lot_options &&
                  item.lot_options.length > 1 && (
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          color: 'var(--foreground-muted)',
                          padding: '2px 6px',
                        }}
                      >
                        Select lot
                      </div>
                      {item.lot_options.map((opt) => {
                        const isCurrent =
                          opt.product_inventory_id === item.product_inventory_id
                        const expDate = opt.expiry_date ? new Date(opt.expiry_date) : null
                        const expired = expDate !== null && expDate < new Date()
                        const outOfStock = opt.stock <= 0
                        const optPrice =
                          orderType === 'online'
                            ? (opt.online_price ?? opt.base_price)
                            : opt.base_price
                        return (
                          <button
                            key={opt.product_inventory_id}
                            type="button"
                            disabled={isCurrent || outOfStock || expired}
                            onClick={() => {
                              changeCartLot(item.product_inventory_id, opt)
                              setLotPickerFor(null)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${
                                isCurrent ? 'var(--accent)' : 'var(--border)'
                              }`,
                              background: isCurrent
                                ? 'var(--accent-light-bg)'
                                : 'var(--background)',
                              cursor:
                                isCurrent || outOfStock || expired
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity: outOfStock || expired ? 0.55 : 1,
                              textAlign: 'left',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: expired
                                  ? 'var(--destructive)'
                                  : 'var(--foreground)',
                              }}
                            >
                              {expDate
                                ? expDate.toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'No expiry'}
                              {expired && ' (expired)'}
                              {outOfStock && !expired && ' (no stock)'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--foreground-muted)',
                              }}
                            >
                              Stock {opt.stock} · Rp{' '}
                              {Number(optPrice).toLocaleString('id-ID')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

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
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value))
                        setCart((prev) =>
                          prev.map((c) =>
                            c.product_inventory_id === item.product_inventory_id
                              ? { ...c, qty: val }
                              : c
                          )
                        )
                      }}
                      style={{
                        width: 48,
                        height: 28,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'center',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        background: 'var(--surface)',
                      }}
                    />
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
                <input
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value))
                    setBundleCart((prev) =>
                      prev.map((c) =>
                        c.bundle_id === item.bundle_id ? { ...c, qty: val } : c
                      )
                    )
                  }}
                  style={{
                    width: 48,
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    background: 'var(--surface)',
                  }}
                />
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

        {/* Totals (always visible) */}
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
            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>

          {appliedVoucher && discountAmount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: 'var(--destructive)',
                padding: '2px 0',
              }}
            >
              <span>Diskon ({appliedVoucher.code})</span>
              <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
              Rp {total.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Order Details accordion header */}
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
            {(selectedCustomerId
              ? customerSearch
              : guestName || guestPhone || '') && (
              <span
                style={{
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedCustomerId
                  ? customerSearch
                  : [guestName, guestPhone].filter(Boolean).join(' · ')}
              </span>
            )}
            {orderDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* Order Details accordion body */}
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
        {/* Customer section */}
        <div
          style={{
            padding: '10px 16px 8px',
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
              onClick={handleApplyVoucher}
              disabled={voucherLoading}
              style={{
                padding: '7px 12px',
                background: 'var(--accent-light-bg)',
                color: 'var(--accent)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 500,
                cursor: voucherLoading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: voucherLoading ? 0.7 : 1,
              }}
            >
              {voucherLoading ? 'Applying...' : 'Apply'}
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
            Transaction Date
          </label>
          <input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
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
        </div>
        )}

        {/* Bottom action buttons (always visible) */}
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
          {(() => {
            const cartEmpty = cart.length === 0 && bundleCart.length === 0
            const noMethods = !paymentMethodsLoading && paymentMethods.length === 0
            const busy = isPending || isHoldPending
            const holdDisabled = busy || cartEmpty
            const chargeDisabled = busy || cartEmpty || noMethods
            return (
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
                    color: holdDisabled
                      ? 'var(--foreground-muted)'
                      : 'var(--foreground)',
                    border: `1px solid ${holdDisabled ? 'var(--border)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: holdDisabled ? 'not-allowed' : 'pointer',
                    opacity: isHoldPending ? 0.7 : 1,
                    transition: 'background 150ms ease',
                  }}
                  title="Save as pending order"
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
                    transition: 'background 150ms ease',
                  }}
                >
                  {isPending
                    ? 'Processing...'
                    : `Charge Rp ${total.toLocaleString('id-ID')}`}
                </button>
              </div>
            )
          })()}
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

            {/* Payment method selection */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Payment Method
              </label>
              {paymentMethods.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--destructive)' }}>
                  No payment methods found. Add one in Settings first.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {paymentMethods.map((pm: any) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethodId(pm.id)
                      setCashTendered('')
                    }}
                    style={{
                      flex: '1 1 auto',
                      height: 42,
                      border: '1px solid',
                      borderColor: paymentMethodId === pm.id ? 'var(--accent)' : 'var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: paymentMethodId === pm.id ? 'var(--accent)' : 'var(--surface)',
                      color: paymentMethodId === pm.id ? 'white' : 'var(--foreground)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {pm.name}
                  </button>
                ))}
              </div>
            </div>

            {!isCashMethod && paymentMethodId && (
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
                Confirm receipt of Rp {total.toLocaleString('id-ID')} via {selectedMethod?.name}.
              </div>
            )}

            {/* Cash tendered section */}
            {isCashMethod && (
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

            {/* Confirm button */}
            <button
              type="button"
              onClick={() => {
                if (!paymentMethodId) {
                  toast.error('Select a payment method')
                  return
                }
                if (
                  isCashMethod &&
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
            {receiptData.paymentMethod.toLowerCase().includes('cash') && (
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
              {receiptData.paymentMethod.toLowerCase().includes('cash') && (
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
                onClick={() => printReceipt && triggerPrint(printReceipt)}
                disabled={!printReceipt}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: printReceipt ? 'pointer' : 'not-allowed',
                  opacity: printReceipt ? 1 : 0.6,
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

      {showPreorder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)',
            width: 560, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0, color: 'var(--accent)' }}>
                  New Pre-order
                </h2>
                <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  Creates a pending order — no payment yet
                </p>
              </div>
              <button onClick={resetPreorder} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--foreground-muted)' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Fulfillment date */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Fulfillment Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  value={poFulfillmentDate}
                  onChange={e => setPoFulfillmentDate(e.target.value)}
                  style={{
                    width: '100%', height: 40,
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    padding: '0 12px', fontSize: 14,
                    color: 'var(--foreground)', background: 'var(--surface)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Customer */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Customer (optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={poCustomerSearch}
                    onChange={e => { setPoCustomerSearch(e.target.value); setPoShowCustomerDrop(true); if (!e.target.value) setPoCustomerId(null) }}
                    onFocus={() => setPoShowCustomerDrop(true)}
                    placeholder="Search registered customer..."
                    style={{
                      width: '100%', height: 38,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      padding: '0 12px', fontSize: 14,
                      color: 'var(--foreground)', background: 'var(--surface)',
                      boxSizing: 'border-box',
                    }}
                  />
                  {poShowCustomerDrop && poCustomers.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
                      maxHeight: 160, overflowY: 'auto',
                    }}>
                      {poCustomers.map((c: any) => (
                        <div key={c.id}
                          onClick={() => { setPoCustomerId(c.id); setPoCustomerSearch(c.name); setPoShowCustomerDrop(false) }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--background)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                        >
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                          {c.phone && <span style={{ color: 'var(--foreground-muted)', marginLeft: 8, fontSize: 12 }}>{c.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {!poCustomerId && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                    <input
                      value={poGuestName}
                      onChange={e => setPoGuestName(e.target.value)}
                      placeholder="Guest name"
                      style={{
                        height: 38, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface)',
                      }}
                    />
                    <input
                      value={poGuestPhone}
                      onChange={e => setPoGuestPhone(e.target.value)}
                      placeholder="Guest phone"
                      style={{
                        height: 38, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Items (optional — add later)</label>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setPoShowProductDrop(v => !v)}
                      style={{
                        height: 30, padding: '0 12px', background: 'var(--accent)', color: 'white',
                        border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12,
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >+ Add Item</button>
                    {poShowProductDrop && (
                      <div style={{
                        position: 'absolute', top: '110%', right: 0, width: 300, zIndex: 20,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                      }}>
                        <div style={{ padding: 8 }}>
                          <input
                            autoFocus
                            value={poProductSearch}
                            onChange={e => setPoProductSearch(e.target.value)}
                            placeholder="Search products..."
                            style={{
                              width: '100%', height: 34, border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', padding: '0 10px', fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {poProducts.map((p: any) => (
                            <div key={p.id}
                              onClick={() => {
                                setPoItems(prev => {
                                  const exists = prev.findIndex(i => i.product_inventory_id === p.id)
                                  if (exists >= 0) return prev.map((i, idx) => idx === exists ? { ...i, qty: i.qty + 1 } : i)
                                  return [...prev, {
                                    product_inventory_id: p.id,
                                    name:
                                      p.product_uom_batch?.product_uom?.product?.name
                                      ?? p.product_uom?.product?.name
                                      ?? p.code
                                      ?? `INV-${p.id}`,
                                    code: p.code,
                                    price: p.base_price ?? 0,
                                    qty: 1,
                                  }]
                                })
                                setPoShowProductDrop(false)
                                setPoProductSearch('')
                              }}
                              style={{
                                padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--background)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.product_uom_batch?.product_uom?.product?.name ?? p.product_uom?.product?.name ?? p.code}</div>
                                <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{p.code}</div>
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                                Rp {Number(p.base_price).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                          {poProducts.length === 0 && (
                            <p style={{ padding: 12, fontSize: 13, color: 'var(--foreground-muted)' }}>
                              {poProductSearchDebounced ? 'No products found' : 'Type to search...'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {poItems.length === 0 ? (
                  <div style={{
                    padding: '16px', border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-md)', textAlign: 'center',
                    fontSize: 13, color: 'var(--foreground-subtle)',
                  }}>
                    No items added — you can add items when the customer comes to pick up
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {poItems.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', background: 'var(--background)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{item.code}</div>
                        </div>
                        <input
                          type="number" min={1} value={item.qty}
                          onChange={e => setPoItems(prev => prev.map((i, ix) => ix === idx ? { ...i, qty: Math.max(1, Number(e.target.value)) } : i))}
                          style={{ width: 48, height: 30, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontSize: 13 }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', minWidth: 90, textAlign: 'right' }}>
                          Rp {(item.price * item.qty).toLocaleString('id-ID')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPoItems(prev => prev.filter((_, ix) => ix !== idx))}
                          style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                {poItems.length > 0 && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      marginTop: 12,
                      paddingTop: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                      }}
                    >
                      Total
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      Rp{' '}
                      {(
                        poSubtotal ??
                        poItems.reduce(
                          (s, item) => s + item.qty * item.price,
                          0,
                        )
                      ).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Deposit Note
                </label>
                <textarea
                  value={poNote}
                  onChange={e => setPoNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Paid deposit Rp 100.000 cash..."
                  style={{
                    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px', fontSize: 14, resize: 'none',
                    color: 'var(--foreground)', background: 'var(--surface)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: 12, flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={resetPreorder}
                style={{
                  flex: 1, height: 44, border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--surface)',
                  cursor: 'pointer', fontSize: 14, color: 'var(--foreground)',
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={() => {
                  if (!poFulfillmentDate) { toast.error('Fulfillment date is required'); return }
                  if (!poCustomerId && !poGuestName) { toast.error('Customer name or registered customer is required'); return }
                  poMutate()
                }}
                disabled={poIsPending}
                style={{
                  flex: 2, height: 44, border: 'none',
                  borderRadius: 'var(--radius-md)', background: 'var(--accent)',
                  color: 'white', cursor: poIsPending ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 700, opacity: poIsPending ? 0.7 : 1,
                }}
              >
                {poIsPending ? 'Saving...' : '📋 Save Pre-order (Pending)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreorders && (
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
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>–</span>
                <input
                  type="date" value={preorderDateTo}
                  onChange={e => { setPreorderDateTo(e.target.value); setPreorderPage(1) }}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 12, color: 'var(--foreground)', background: 'var(--background)' }}
                />
              </div>
            </div>

            {/* Orders list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isPreordersLoading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 100, borderRadius: 'var(--radius-md)', background: 'var(--border)', opacity: 0.4 }} />
              ))}

              {!isPreordersLoading && preorders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--foreground-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <p style={{ fontSize: 14 }}>No pending pre-orders</p>
                </div>
              )}

              {preorders.map((order: any) => (
                <div key={order.id} style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  padding: '14px 16px', background: 'var(--background)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{order.code}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      borderRadius: 'var(--radius-xl)',
                      background: 'var(--warning-bg)', color: 'var(--warning)',
                    }}>Pending</span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 4 }}>
                    👤 {order.customer?.name ?? order.customer_name ?? 'Walk-in'}
                    {(order.customer?.phone ?? order.customer_phone) && (
                      <span style={{ color: 'var(--foreground-muted)', marginLeft: 6 }}>
                        · {order.customer?.phone ?? order.customer_phone}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 8 }}>
                    📅 Pickup:{' '}
                    {order.fulfillment_date
                      ? new Date(order.fulfillment_date).toLocaleString('id-ID', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
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
                    ✓ Complete Order — Load to Cart
                  </button>
                </div>
              ))}
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
                >← Prev</button>
                <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                  {preorderPage} / {preorderMeta.last_page ?? preorderMeta.total_pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPreorderPage(p => Math.min(preorderMeta.last_page ?? preorderMeta.total_pages, p + 1))}
                  disabled={preorderPage === (preorderMeta.last_page ?? preorderMeta.total_pages)}
                  style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: preorderPage === (preorderMeta.last_page ?? preorderMeta.total_pages) ? 'not-allowed' : 'pointer', color: preorderPage === (preorderMeta.last_page ?? preorderMeta.total_pages) ? 'var(--foreground-subtle)' : 'var(--foreground)', fontSize: 13 }}
                >Next →</button>
              </div>
            )}
          </div>
        </>
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
