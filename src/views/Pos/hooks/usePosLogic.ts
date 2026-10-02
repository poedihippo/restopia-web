import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { usePrinter } from '@/hooks/usePrinter'

import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import { salesOrdersService } from '@/services/sales-orders.service'
import { customersService } from '@/services/customers.service'
import { bundlesService } from '@/services/bundles.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { paymentsService } from '@/services/payments.service'
import { vouchersService } from '@/services/vouchers.service'
import { salesChannelsService } from '@/services/sales-channels.service'
import { usersService } from '@/services/users.service'
import api from '@/hooks/useApi'
import { productUomBatchesService } from '@/services/product-uom-batches.service'

import type { PosCartItem, PosCartBundle } from '@/types/api'
import type { ReceiptData } from '@/components/PosReceipt'

const getApiErrorMessage = (err: any, fallback = 'An error occurred'): string => {
  const data = err?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    for (const key in data.errors) {
      if (Array.isArray(data.errors[key]) && data.errors[key].length > 0) {
        return data.errors[key][0]
      }
    }
  }
  return data?.message || fallback
}

// Inventory rows carry expiry on the batch, not on the row itself.
const expiryOf = (row: any): string | null =>
  row?.product_uom_batch?.expiry_date ?? row?.expiry_date ?? null

const parseJson = (v: any) => {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

// Order payloads must only carry fields defined by Create/UpdateSalesOrderRequest:
// totals are computed by the backend, and optional ints must be omitted, not null.
const toApiOrder = (payload: any, opts: { keepNull?: string[] } = {}) => {
  const { code, subtotal_price, discount_price, total_price, ...rest } = payload
  return Object.fromEntries(
    Object.entries(rest).filter(
      ([k, v]) => v !== undefined && (v !== null || opts.keepNull?.includes(k)),
    ),
  )
}

export function usePosLogic() {
  const { user } = useAuth()
  const printer = usePrinter()
  const qc = useQueryClient()

  // One Idempotency-Key per logical submission: retrying the *same* payload
  // (double click, timeout) reuses the key, a changed payload gets a new one.
  const idemRef = useRef<{ sig: string; key: string } | null>(null)
  const idemKeyFor = (scope: string, payload: unknown) => {
    const sig = scope + JSON.stringify(payload)
    if (idemRef.current?.sig !== sig) idemRef.current = { sig, key: crypto.randomUUID() }
    return idemRef.current.key
  }

  // ---------------------------------------------------------------------------
  // 1. STATE DEFINITIONS
  // ---------------------------------------------------------------------------
  // Product Grid State
  const [activeTab, setActiveTab] = useState<'products' | 'bundles'>('products')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('code')
  const [productPage, setProductPage] = useState(1)
  const [inStockOnly, setInStockOnly] = useState<boolean>(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  // Bundle State
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleSearchDebounced, setBundleSearchDebounced] = useState('')

  // Cart State
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [bundleCart, setBundleCart] = useState<PosCartBundle[]>([])
  const [orderType, setOrderType] = useState<'offline' | 'online'>('offline')
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [editingOrderCode, setEditingOrderCode] = useState<string | null>(null)
  const [batchPickerGroup, setBatchPickerGroup] = useState<any | null>(null)
  const [bundlePickerGroup, setBundlePickerGroup] = useState<any | null>(null)
  const [salesChannelId, setSalesChannelId] = useState<number | null>(null)

  // Customer State
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Voucher State
  const [voucherCode, setVoucherCode] = useState<number | ''>('')
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string
    discount_amount: number
    voucher_id: number | null
    subtotal_at_apply: number
  } | null>(null)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const discountAmount = appliedVoucher?.discount_amount ?? 0

  // Payment State
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const [cashTendered, setCashTendered] = useState<string>('')
  const [creditByUserId, setCreditByUserId] = useState<number | null>(null)
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [splitPayments, setSplitPayments] = useState<Array<{ paymentMethodId: number, amount: number, cashTendered?: string, creditByUserId?: number | null }>>([])
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchDebounced, setHistorySearchDebounced] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  const [preorderSearch, setPreorderSearch] = useState('')
  const [preorderSearchDebounced, setPreorderSearchDebounced] = useState('')
  const [preorderDateFrom, setPreorderDateFrom] = useState('')
  const [preorderDateTo, setPreorderDateTo] = useState('')
  const [preorderPage, setPreorderPage] = useState(1)

  // Order Details State
  const [orderNote, setOrderNote] = useState('')
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toLocaleDateString('en-CA')
  )
  const [fulfillmentDate, setFulfillmentDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  )

  // Modals & Panels State
  const [showReceipt, setShowReceipt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showPreorders, setShowPreorders] = useState(false)
  const [showPreorder, setShowPreorder] = useState(false) // For creating Pre-order

  // ---------------------------------------------------------------------------
  // 2. DEBOUNCE EFFECTS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setBundleSearchDebounced(bundleSearch), 400)
    return () => clearTimeout(t)
  }, [bundleSearch])

  useEffect(() => {
    const t = setTimeout(() => setPreorderSearchDebounced(preorderSearch), 400)
    return () => clearTimeout(t)
  }, [preorderSearch])

  useEffect(() => {
    const t = setTimeout(() => setHistorySearchDebounced(historySearch), 400)
    return () => clearTimeout(t)
  }, [historySearch])

  // ---------------------------------------------------------------------------
  // 3. QUERIES (Data Fetching)
  // ---------------------------------------------------------------------------

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
      return salesOrdersService.list(params).then((r) => r.data)
    },
  })
  const preorders: any[] = (preorderData as any)?.data ?? []
  const preorderMeta = (preorderData as any)?.meta

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['pos-history', historyPage, historySearchDebounced, historyDateFrom, historyDateTo],
    enabled: showHistory,
    queryFn: () => {
      const params: Record<string, any> = {
        page: historyPage,
        per_page: 20,
        sort: '-created_at',
        include: 'sales_order_details,customer',
      }
      if (historySearchDebounced) params['filter[search]'] = historySearchDebounced
      if (historyDateFrom) params['filter[date_gte]'] = historyDateFrom
      if (historyDateTo) params['filter[date_lte]'] = historyDateTo
      return salesOrdersService.list(params).then((r) => r.data)
    },
  })
  const historyOrders: any[] = (historyData as any)?.data ?? []
  const historyMeta = (historyData as any)?.meta

  const loadPreorderToCart = (order: any) => {
    if (order.type === 'franchise') {
      toast.error('Order franchise tidak bisa diedit di POS')
      return
    }
    setCart([])
    setBundleCart([])
    const details = order.sales_order_details ?? []
    const newCart: PosCartItem[] = details
      .filter((d: any) => !d.bundle_id)
      .map((d: any) => {
        const snapshot = parseJson(d.product_inventory_snapshot)

        const pu = snapshot?.product_uom_batch?.product_uom ?? snapshot?.product_uom ?? d.product_inventory?.product_uom_batch?.product_uom ?? d.product_inventory?.product_uom

        return {
          detail_id: d.id,
          product_inventory_id: d.product_inventory_id,
          name: pu?.product?.name ?? d.description ?? `Item #${d.product_inventory_id}`,
          code: pu?.code ?? pu?.product?.code ?? '',
          price: Number(d.price),
          qty: Number(d.qty),
          price_editable: snapshot?.price_editable ?? d.product_inventory?.price_editable ?? false,
        }
      })
    const newBundles: PosCartBundle[] = details
      .filter((d: any) => d.bundle_id)
      .map((d: any) => {
        const rawSnap = parseJson(d.bundle_snapshot)
        const snap = Array.isArray(rawSnap) ? rawSnap[0] : rawSnap
        return {
          detail_id: d.id,
          bundle_id: d.bundle_id,
          name: snap?.name ?? d.description ?? `Bundle #${d.bundle_id}`,
          code: snap?.code ?? '',
          price: Number(d.price),
          qty: Number(d.qty),
          bundle_details: (d.sales_order_detail_bundles ?? []).map((b: any) => ({
            bundle_detail_item_id: b.bundle_detail_item_id,
            product_inventory_id: b.product_inventory_id,
          })),
        }
      })
    setCart(newCart)
    setBundleCart(newBundles)
    setOrderType(order.type === 'online' ? 'online' : 'offline')
    if (order.customer_id) {
      setSelectedCustomerId(order.customer_id)
      setCustomerSearch(order.customer?.name ?? '')
    } else {
      setSelectedCustomerId(null)
      setGuestName(order.customer_name ?? '')
      setGuestPhone(order.customer_phone ?? '')
    }

    if (order.sales_channel_id) {
      setSalesChannelId(order.sales_channel_id)
    } else {
      setSalesChannelId(null)
    }

    // Keep the voucher the order was saved with, otherwise the next PATCH drops it.
    if (order.voucher_id) {
      const vSnap = parseJson(order.voucher_snapshot)
      const loadedSubtotal =
        newCart.reduce((sum, c) => sum + c.price * c.qty, 0) +
        newBundles.reduce((sum, c) => sum + c.price * c.qty, 0)
      setVoucherCode(order.voucher_id)
      setAppliedVoucher({
        code: vSnap?.code ?? '',
        discount_amount: Number(order.discount_price ?? 0),
        voucher_id: order.voucher_id,
        subtotal_at_apply: loadedSubtotal,
      })
    } else {
      setVoucherCode('')
      setAppliedVoucher(null)
    }

    setOrderNote(order.description ?? '')
    setEditingOrderId(order.id)
    setEditingOrderCode(order.code)
    setShowPreorders(false)
    toast.success('Pending order loaded to cart')
  }

  // Customer search query
  const { data: customerData } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: () =>
      customersService
        .list({
          per_page: 10,
          'filter[search]': customerSearch,
        } as any)
        .then((r) => r.data),
    enabled: customerSearch.length >= 2,
  })
  const customers: any[] = (customerData as any)?.data ?? []

  // Bundles query
  const { data: bundleData, isLoading: isBundleLoading } = useQuery({
    queryKey: ['pos-bundles', bundleSearchDebounced],
    queryFn: () =>
      bundlesService
        .list({
          per_page: 60,
          'filter[status]': 'active',
          'filter[search]': bundleSearchDebounced || undefined,
          include: 'bundle_details,bundle_details.items,bundle_details.items.product_uom,bundle_details.items.product_uom.product',
        } as any)
        .then((r) => r.data),
  })
  const bundles: any[] = (bundleData as any)?.data ?? []

  // Payment methods query
  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['payment-methods-all'],
    queryFn: () =>
      paymentMethodsService.list({ per_page: 50, sort: 'id', 'filter[type]': 'sales_orders' } as any).then((r) => r.data),
  })
  const paymentMethods: any[] = (paymentMethodsData as any)?.data ?? []

  // Sales channels query — filtered by selected sales order type
  const { data: salesChannelsData } = useQuery({
    queryKey: ['pos-sales-channels', orderType],
    queryFn: () =>
      salesChannelsService.list({
        per_page: 100,
        sort: 'name',
        'filter[sales_order_type]': orderType,
      } as any).then((r) => r.data),
  })
  const salesChannels: any[] = useMemo(() => {
    const raw: any[] = (salesChannelsData as any)?.data ?? []
    return raw.filter((c: any) => !c.sales_order_type || c.sales_order_type === orderType)
  }, [salesChannelsData, orderType])

  // Reset sales channel when it is no longer valid for the selected order type
  useEffect(() => {
    if (salesChannelId != null && salesChannels.length > 0) {
      const stillValid = salesChannels.some((c: any) => Number(c.id) === Number(salesChannelId))
      if (!stillValid) setSalesChannelId(null)
    }
  }, [salesChannels, salesChannelId])

  // Auto-default to "Walk-in" sales channel when channels first load (type-matched list)
  useEffect(() => {
    if (salesChannelId === null && salesChannels.length > 0) {
      const walkIn = salesChannels.find((c: any) => {
        const name = (c.name ?? '').toLowerCase().trim()
        const code = (c.code ?? '').toLowerCase().trim()
        return (
          name === 'walk-in' ||
          name === 'walk in' ||
          name === 'walkin' ||
          code === 'walk-in' ||
          code === 'walkin' ||
          code === 'walk_in'
        )
      })
      if (walkIn) setSalesChannelId(walkIn.id)
    }
  }, [salesChannels, salesChannelId])

  const { data: puData } = useQuery({
    queryKey: ['product-uoms-pos'],
    queryFn: () =>
      productUomsService
        .list({
          per_page: 500,
          include: 'product,uom',
          'filter[status]': 'active',
        } as any)
        .then((r) => r.data)
  })

  const productUomsList: any[] = (puData as any)?.data ?? [];

  const categories = useMemo<string[]>(() => {
    const cats = new Set<string>()
    for (const pu of productUomsList) {
      const name = pu?.product?.product_category?.name
      if (name) cats.add(name)
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b))
  }, [productUomsList]);

  const categoryIdMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const pu of productUomsList) {
      const cat = pu?.product?.product_category;
      if (cat?.name && cat?.id) map[cat.name] = cat.id
    }
    return map
  }, [productUomsList]);

  const selectedCategoryId = selectedCategory === null ? undefined : categoryIdMap[selectedCategory]

  const { data: piData, isLoading } = useQuery({
    queryKey: [
      'product-inventories-pos',
      productPage,
      searchDebounced,
      sortBy,
      inStockOnly,
      selectedCategoryId,
    ],
    queryFn: () => {
      const params: Record<string, any> = {
        page: productPage,
        per_page: 50,
        'filter[product_type]': 'final',
        'filter[status]': 'active',
        'filter[stage]': 'finished',
        include:
          'branch,product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
      }

      if (selectedCategoryId) params['filter[product_category_id]'] = selectedCategoryId
      if (searchDebounced) params['filter[search]'] = searchDebounced
      if (inStockOnly) params['filter[stock_gte]'] = 1

      // The API only sorts inventories by id/branch_id/product_uom_batch_id/stock/
      // status/created_at/updated_at. Price and name ordering happens client-side
      // (see groupedItems).
      if (sortBy === 'stock_desc') params['sort'] = '-stock'

      return productInventoriesService.list(params as any).then((r) => r.data)
    },
  })

  const items: any[] = (piData as any)?.data ?? []
  const productMeta = (piData as any)?.meta

  const fefoCompare = (a: any, b: any) => {
    const now = Date.now()
    const ae = expiryOf(a) ? new Date(expiryOf(a) as string).getTime() : null
    const be = expiryOf(b) ? new Date(expiryOf(b) as string).getTime() : null
    const aExpired = ae !== null && ae < now
    const bExpired = be !== null && be < now
    if (aExpired !== bExpired) return aExpired ? 1 : -1
    if (ae === null && be === null) return 0
    if (ae === null) return 1
    if (be === null) return -1
    return ae - be
  }

  const groupedItems = useMemo(() => {
    const map = new Map<string, any>()
    for (const row of items) {
      const puid = row.product_uom_id ?? row.product_uom_batch?.product_uom?.id ?? row.product_uom?.id ?? null
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
      // All lots in a group share one product_uom, so summing display_qty
      // (on-hand in that uom) across them is safe — no cross-unit mixing.
      g.totalStock += Number(row.display_qty ?? row.stock ?? 0)
    }

    for (const g of map.values()) {
      g.lots.sort(fefoCompare)
      const firstStocked = g.lots.find((l: any) => Number(l.display_qty ?? l.stock ?? 0) > 0)
      g.defaultLot = firstStocked ?? g.lots[0]
      g.representative = g.defaultLot
    }
    const groups: any[] = Array.from(map.values())

    const uomOf = (g: any) => g.defaultLot?.product_uom_batch?.product_uom ?? g.defaultLot?.product_uom
    const priceOf = (g: any) => Number(uomOf(g)?.base_price ?? 0)
    const nameOf = (g: any) =>
      String(uomOf(g)?.code ?? uomOf(g)?.product?.code ?? uomOf(g)?.product?.name ?? '')
    if (sortBy === 'price_asc') groups.sort((a, b) => priceOf(a) - priceOf(b))
    else if (sortBy === 'price_desc') groups.sort((a, b) => priceOf(b) - priceOf(a))
    else if (sortBy !== 'stock_desc') groups.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    return groups
  }, [items, sortBy])

  // ---------------------------------------------------------------------------
  // 4. COMPUTED VALUES
  // ---------------------------------------------------------------------------
  const subtotal = cart.reduce((s: number, c: any) => s + c.price * c.qty, 0) + bundleCart.reduce((s: number, c: any) => s + c.price * c.qty, 0)
  const total = Math.max(0, subtotal - (discountAmount ?? 0))

  const selectedMethod = paymentMethods.find((pm) => pm.id === paymentMethodId)
  const isCashMethod = selectedMethod?.name?.toLowerCase().includes('cash') ?? false;
  const isCreditMethod = selectedMethod?.name?.toLowerCase().includes('credit') ?? false;
  const change = isCashMethod ? Math.max(0, Number(cashTendered.replace(/\D/g, '')) - total) : 0;

  const { data: creditUsersData } = useQuery({
    queryKey: ['pos-credit-users'],
    queryFn: () =>
      usersService
        .list({ per_page: 100, 'filter[type]': 'user' } as any)
        .then((r) => r.data),
  })
  const creditUsers: any[] = (creditUsersData as any)?.data ?? []

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

  // ---------------------------------------------------------------------------
  // 5. EVENT HANDLERS & MUTATIONS
  // ---------------------------------------------------------------------------
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
    setFulfillmentDate(new Date().toISOString().slice(0, 16))
    setOrderType('offline')
    setSalesChannelId(null)
    setShowPayment(false)
    setPaymentMethodId(null)
    setCashTendered('')
    setShowReceipt(false)
    setEditingOrderId(null)
    setEditingOrderCode(null)
    idemRef.current = null
  }, [])

  const addLotToCart = useCallback((lot: any) => {
    if (!lot) return

    if ((lot.display_qty ?? lot.stock ?? 0) <= 0) {
      toast.error('Item is out of stock')
      return
    }

    setCart((prev: any[]) => {
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
          name: lot.product_uom_batch?.product_uom?.product?.name ?? lot.code,
          code: lot.product_uom_batch?.product_uom?.code ?? lot.product_uom_batch?.product_uom?.product?.code
            ?? '',
          price: (() => {
            const uom = lot.product_uom_batch?.product_uom ?? lot.product_uom ?? lot.productUom;
            return orderType === 'online' ? (uom?.online_price ?? uom?.base_price ?? 0) : (uom?.base_price ?? 0);
          })(),
          qty: 1,
        },
      ]
    })

    setBatchPickerGroup(null)
  }, [orderType])

  const addBundleToCart = useCallback((bundle: any) => {
    setBundlePickerGroup(bundle)
  }, [])

  const addConfiguredBundleToCart = useCallback((bundle: any, selectedBatches: Record<number, any>, selectedItems?: Record<number, number>) => {
    try {
      const details = bundle.bundle_details || bundle.details || []
      const processedDetails = details.map((bd: any) => {
        const itemId = selectedItems?.[bd.id]
        const item = bd.items?.find((i: any) => i.id === itemId) || bd.items?.[0] || bd
        const inventory = selectedBatches[bd.id] || selectedBatches[item.id]
        return {
          ...bd,
          qty: item.qty ?? bd.qty ?? 1,
          product_name: item.product_uom?.product?.name || item.product?.name || inventory?.product_uom_batch?.product_uom?.product?.name || 'Item',
          bundle_detail_item_id: item.id,
          product_inventory_id: inventory?.id || inventory,
        }
      })

      setBundleCart((prev: any[]) => {
        return [
          ...prev,
          {
            bundle_id: bundle.id,
            name: bundle.name,
            code: bundle.code,
            price: bundle.price ?? 0,
            qty: 1,
            bundle_details: processedDetails,
          },
        ]
      })
      toast.success('Bundle added')
      setBundlePickerGroup(null)
    } catch (error) {
      toast.error('Failed to add bundle')
    }
  }, [])

  // A voucher discount is only valid for the cart it was calculated on.
  useEffect(() => {
    if (appliedVoucher && appliedVoucher.subtotal_at_apply !== subtotal) {
      setAppliedVoucher(null)
      setVoucherCode('')
      toast.info('Keranjang berubah, voucher direset. Terapkan ulang voucher.')
    }
  }, [subtotal, appliedVoucher])

  // Order lines in API shape. Optional ints are omitted (never null); `id` is only
  // sent when updating a held order so existing lines are matched, not recreated.
  const buildDetails = (status: 'pending' | 'completed', withIds = false) => [
    ...cart.map((c: any) => ({
      ...(withIds && c.detail_id ? { id: c.detail_id } : {}),
      product_inventory_id: c.product_inventory_id,
      qty: c.qty,
      price: c.price,
      status,
    })),
    ...bundleCart.map((c: any) => ({
      ...(withIds && c.detail_id ? { id: c.detail_id } : {}),
      bundle_id: c.bundle_id,
      qty: c.qty,
      price: c.price,
      status,
      bundle_details:
        c.bundle_details?.map((bd: any) => ({
          product_inventory_id: bd.product_inventory_id,
          bundle_detail_item_id: bd.bundle_detail_item_id,
        })) || [],
    })),
  ]

  const getSettlement = () => {
    const splitCreditUser = isSplitPayment
      ? splitPayments.find((sp) => sp.creditByUserId)?.creditByUserId
      : null
    const creditById = isSplitPayment
      ? splitCreditUser || undefined
      : isCreditMethod
        ? creditByUserId
        : undefined
    const settlementStatus = isSplitPayment
      ? splitCreditUser
        ? 'credit'
        : 'pending'
      : isCreditMethod
        ? 'credit'
        : 'pending'
    return { creditById, settlementStatus }
  }

  const handleApplyVoucher = async (selectedVoucher?: { id: number; code: string }) => {
    if (!selectedVoucher) return
    setVoucherLoading(true)
    try {
      const voucher = selectedVoucher

      const payload = toApiOrder({
        type: orderType,
        customer_id: selectedCustomerId ?? undefined,
        date: transactionDate,
        fulfillment_date: fulfillmentDate.slice(0, 10),
        sales_channel_id: salesChannelId,
        voucher_id: voucher.id,
        status: 'pending',
        settlement_status: 'pending',
        details: buildDetails('pending'),
      })

      const applyRes = await salesOrdersService.applyVoucher(payload)
      const data = (applyRes.data as any)?.data

      if (data?.discount_price !== undefined) {
        setAppliedVoucher({
          code: voucher.code,
          discount_amount: Number(data.discount_price),
          voucher_id: voucher.id,
          subtotal_at_apply: subtotal,
        })
        toast.success('Voucher applied')
      } else {
        toast.error('Failed to apply voucher')
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to apply voucher'))
    } finally {
      setVoucherLoading(false)
    }
  }

  const handleCharge = () => {
    if (cart.length === 0 && bundleCart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setShowPayment(true)
  }

  const { mutate: holdMutate, isPending: isHoldPending } = useMutation({
    mutationFn: (payload: any) => {
      if (editingOrderId) {
        return salesOrdersService.update(
          editingOrderId,
          toApiOrder(payload, { keepNull: ['customer_id'] }) as any,
        )
      }
      const body = toApiOrder(payload)
      return api
        .post('/sales-orders', body, { headers: { 'Idempotency-Key': idemKeyFor('hold', body) } })
        .then((r) => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      toast.success('Order held as pending')
      resetCart()
    },
    onError: (err: any) =>
      toast.error(getApiErrorMessage(err, 'Failed to hold order')),
  })

  const handleHold = () => {
    if (cart.length === 0 && bundleCart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    if (!salesChannelId) {
      toast.error('Please select a Sales Channel first')
      return
    }

    const { creditById, settlementStatus } = getSettlement()

    const payload = {
      type: orderType,
      customer_id: selectedCustomerId ?? null,
      customer_name: selectedCustomerId ? undefined : guestName || undefined,
      customer_phone: selectedCustomerId ? undefined : guestPhone || undefined,
      date: transactionDate,
      fulfillment_date: fulfillmentDate.slice(0, 10),
      sales_channel_id: salesChannelId,
      voucher_id: appliedVoucher?.voucher_id ?? undefined,
      status: 'pending',
      settlement_status: settlementStatus,
      credit_by_id: creditById,
      description: orderNote || undefined,
      details: buildDetails('pending', !!editingOrderId),
    }

    holdMutate(payload)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: any) => {
      if (editingOrderId) {
        return salesOrdersService.update(
          editingOrderId,
          toApiOrder(payload, { keepNull: ['customer_id'] }) as any,
        )
      }
      // Payment amount always equals the sale total; cashTendered is only
      // used for change calculation in the UI, not sent as the payment amount.
      const paidAmount = payload.total_price
      let checkoutPayments: {
        payment_method_id: number
        amount: number
        description?: string
      }[] = []
      if (isSplitPayment) {
        checkoutPayments = splitPayments.map((sp) => ({
          payment_method_id: sp.paymentMethodId,
          amount: sp.amount,
          description: orderNote || undefined,
        }))
      } else if (paymentMethodId) {
        checkoutPayments = [{
          payment_method_id: paymentMethodId,
          amount: paidAmount,
          description: orderNote || undefined,
        }]
      }
      const body = {
        type: payload.type,
        sales_channel_id: payload.sales_channel_id,
        date: payload.date,
        fulfillment_date: payload.fulfillment_date,
        status: payload.status,
        settlement_status: payload.settlement_status,
        customer_id: payload.customer_id ?? undefined,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        credit_by_id: payload.credit_by_id,
        voucher_id: payload.voucher_id,
        description: payload.description,
        details: payload.details,
        payments: checkoutPayments,
      }
      return salesOrdersService.checkout(body, idemKeyFor('checkout', body))
    },
    onSuccess: async (res: any, variables: any) => {
      // Checkout is atomic — payment already created by the backend.
      // Only create payments separately for edited (held) orders.
      if (editingOrderId) {
        const salesOrderId = editingOrderId
        const paidAmount = variables.total_price

        const dateStr = new Date().toISOString().split('T')[0]
        let paymentsPayload: any[] = []

        if (isSplitPayment) {
          paymentsPayload = splitPayments.map(sp => ({
            payment_method_id: sp.paymentMethodId,
            amount: sp.amount,
            description: orderNote || undefined,
            allocations: [{ sales_order_id: salesOrderId, amount: sp.amount }]
          }))
        } else if (paymentMethodId) {
          paymentsPayload = [{
            payment_method_id: paymentMethodId,
            amount: paidAmount,
            description: orderNote || undefined,
            allocations: [{ sales_order_id: salesOrderId, amount: paidAmount }]
          }]
        }

        if (paymentsPayload.length > 0) {
          try {
            const paymentBody = {
              type: 'receive',
              date: dateStr,
              payments: paymentsPayload
            }
            await paymentsService.create(
              paymentBody as any,
              idemKeyFor(`pay:${salesOrderId}`, paymentBody),
            )
          } catch (err: any) {
            toast.error(
              'Order updated but payment recording failed: ' +
              (err?.response?.data?.message ?? 'Unknown error'),
            )
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      qc.invalidateQueries({ queryKey: ['pos-history'] })
      qc.invalidateQueries({ queryKey: ['product-inventories-pos'] })
      qc.invalidateQueries({ queryKey: ['pos-bundles'] })
      toast.success(editingOrderId ? 'Order updated!' : 'Order placed!')
      resetCart()
      
      // Full page refresh after 1.5 seconds so user can read the success toast
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, 'Failed to place order'))
    },
  })

  const handleConfirmPayment = () => {
    if (isSplitPayment ? splitPayments.length === 0 : !paymentMethodId) {
      toast.error('Select a payment method')
      return
    }

    const { creditById, settlementStatus } = getSettlement()

    // subtotal_price / discount_price / total_price stay local (used for the
    // payment amount) and are stripped before anything is sent to the API.
    const payload = {
      type: orderType,
      customer_id: selectedCustomerId ?? null,
      customer_name: selectedCustomerId ? undefined : guestName || undefined,
      customer_phone: selectedCustomerId ? undefined : guestPhone || undefined,
      date: transactionDate,
      fulfillment_date: fulfillmentDate.slice(0, 10),
      sales_channel_id: salesChannelId,
      voucher_id: appliedVoucher?.voucher_id ?? undefined,
      subtotal_price: subtotal,
      discount_price: discountAmount,
      total_price: total,
      status: 'final',
      settlement_status: settlementStatus,
      credit_by_id: creditById,
      description: orderNote || undefined,
      details: buildDetails('completed', !!editingOrderId),
    }

    mutate(payload)
  }

  // ---------------------------------------------------------------------------
  // 6. RETURN OBJECT
  // ---------------------------------------------------------------------------
  return {
    activeTab, setActiveTab,
    search, setSearch,
    selectedCategory, setSelectedCategory,
    sortBy, setSortBy,
    productPage, setProductPage,
    inStockOnly, setInStockOnly,
    hoveredCard, setHoveredCard,
    bundleSearch, setBundleSearch,
    cart, setCart,
    bundleCart, setBundleCart,
    orderType, setOrderType,
    customerSearch, setCustomerSearch,
    selectedCustomerId, setSelectedCustomerId,
    salesChannelId, setSalesChannelId,
    guestName, setGuestName,
    guestPhone, setGuestPhone,
    showCustomerDropdown, setShowCustomerDropdown,
    voucherCode, setVoucherCode,
    appliedVoucher,
    voucherLoading,
    discountAmount,
    showPayment, setShowPayment,
    paymentMethodId, setPaymentMethodId,
    cashTendered, setCashTendered,
    isSplitPayment, setIsSplitPayment,
    splitPayments, setSplitPayments,
    orderNote, setOrderNote,
    transactionDate, setTransactionDate,
    fulfillmentDate, setFulfillmentDate,
    showReceipt, setShowReceipt,
    showHistory, setShowHistory,
    showPreorders, setShowPreorders,
    preorderSearch, setPreorderSearch, preorderDateFrom, setPreorderDateFrom, preorderDateTo, setPreorderDateTo, preorderPage, setPreorderPage,
    preorders, preorderMeta, isPreordersLoading, loadPreorderToCart,
    historySearch, setHistorySearch, historyDateFrom, setHistoryDateFrom, historyDateTo, setHistoryDateTo, historyPage, setHistoryPage,
    historyOrders, historyMeta, isHistoryLoading,
    showPreorder, setShowPreorder,

    isLoading, items, productMeta, groupedItems, categories,
    bundles, isBundleLoading,
    paymentMethods, paymentMethodsLoading,
    salesChannels,
    customers,
    subtotal, total, change, quickAmounts,
    selectedMethod, isCashMethod, isCreditMethod,
    creditByUserId, setCreditByUserId, creditUsers,
    isPending, isHoldPending,

    resetCart,
    addLotToCart,
    addBundleToCart,
    addConfiguredBundleToCart,
    handleApplyVoucher,
    handleHold,
    handleCharge,
    handleConfirmPayment,
    batchPickerGroup, setBatchPickerGroup,
    bundlePickerGroup, setBundlePickerGroup,
  }
}
