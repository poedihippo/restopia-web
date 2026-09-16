import { useState, useEffect, useCallback, useMemo } from 'react'
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

export function usePosLogic() {
  const { user } = useAuth()
  const printer = usePrinter()
  const qc = useQueryClient()

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
    setCart([])
    setBundleCart([])
    const details = order.sales_order_details ?? []
    const newCart: PosCartItem[] = details
      .filter((d: any) => !d.bundle_id)
      .map((d: any) => {
        let snapshot = d.product_inventory_snapshot
        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot)
          } catch (e) { }
        }

        const pu = snapshot?.product_uom_batch?.product_uom ?? snapshot?.product_uom ?? d.product_inventory?.product_uom_batch?.product_uom ?? d.product_inventory?.product_uom

        return {
          product_inventory_id: d.product_inventory_id,
          name: pu?.product?.name ?? d.description ?? `Item #${d.product_inventory_id}`,
          code: pu?.code ?? pu?.product?.code ?? '',
          price: Number(d.price),
          qty: Number(d.qty),
          price_editable: snapshot?.price_editable ?? d.product_inventory?.price_editable ?? false,
        }
      })
    setCart(newCart)
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

  // Sales channels query
  const { data: salesChannelsData } = useQuery({
    queryKey: ['pos-sales-channels'],
    queryFn: () =>
      salesChannelsService.list({ per_page: 100, sort: 'name' } as any).then((r) => r.data),
  })
  const salesChannels: any[] = (salesChannelsData as any)?.data ?? []

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
        include: 'branch,product_uom_batch',
      }

      if (selectedCategoryId) params['filter[product_category_id]'] = selectedCategoryId
      if (searchDebounced) params['filter[search]'] = searchDebounced
      if (inStockOnly) params['filter[stock_gte]'] = 1

      if (sortBy === 'price_asc') params['sort'] = 'base_price'
      else if (sortBy === 'price_desc') params['sort'] = '-base_price'
      else if (sortBy === 'stock_desc') params['sort'] = '-stock'
      else params['sort'] = 'code'

      return productInventoriesService.list(params as any).then((r) => r.data)
    },
  })

  const items: any[] = (piData as any)?.data ?? []
  const productMeta = (piData as any)?.meta

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
    return Array.from(map.values())
  }, [items])

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

  const handleApplyVoucher = async (selectedVoucher?: { id: number; code: string }) => {
    if (!selectedVoucher) return
    setVoucherLoading(true)
    try {
      const voucher = selectedVoucher

      const mergedDetails = [
        ...cart.map((c: any) => ({
          product_inventory_id: c.product_inventory_id,
          bundle_id: null,
          qty: c.qty,
          price: c.price,
          status: 'pending',
        })),
        ...bundleCart.map((c: any) => ({
          product_inventory_id: null,
          bundle_id: c.bundle_id,
          qty: c.qty,
          price: c.price,
          status: 'pending',
          bundle_details: c.bundle_details?.map((bd: any) => ({
            product_inventory_id: bd.product_inventory_id,
            bundle_detail_item_id: bd.bundle_detail_item_id,
          })) || [],
        })),
      ]

      const payload = {
        code: editingOrderCode ?? `POS-${Date.now()}`,
        type: orderType,
        customer_id: selectedCustomerId ?? null,
        date: transactionDate,
        fulfillment_date: fulfillmentDate.slice(0, 10),
        sales_channel_id: salesChannelId,
        voucher_id: voucher.id,
        subtotal_price: subtotal,
        discount_price: 0,
        total_price: total,
        status: 'pending',
        settlement_status: 'pending',
        details: mergedDetails,
      }

      const applyRes = await salesOrdersService.applyVoucher(payload)
      const data = (applyRes.data as any)?.data

      if (data?.discount_price !== undefined) {
        setAppliedVoucher({
          code: voucher.code,
          discount_amount: data.discount_price,
          voucher_id: voucher.id,
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
    mutationFn: (payload: any) =>
      editingOrderId
        ? salesOrdersService.update(editingOrderId, payload as any)
        : api.post('/sales-orders', payload, { headers: { 'Idempotency-Key': crypto.randomUUID() } }).then(r => r.data),
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

    const mergedDetails = [
      ...cart.map((c: any) => ({
        product_inventory_id: c.product_inventory_id,
        bundle_id: null,
        qty: c.qty,
        price: c.price,
        status: 'pending',
      })),
      ...bundleCart.map((c: any) => ({
        product_inventory_id: null,
        bundle_id: c.bundle_id,
        qty: c.qty,
        price: c.price,
        status: 'pending',
        bundle_details: c.bundle_details?.map((bd: any) => ({
          product_inventory_id: bd.product_inventory_id,
          bundle_detail_item_id: bd.bundle_detail_item_id,
        })) || [],
      })),
    ]

    const splitCreditUser = isSplitPayment
      ? splitPayments.find(sp => sp.creditByUserId)?.creditByUserId
      : null

    const finalCreditById = isSplitPayment 
      ? (splitCreditUser || undefined)
      : (isCreditMethod ? creditByUserId : undefined)
    
    const finalSettlementStatus = isSplitPayment 
      ? (splitCreditUser ? 'credit' : 'pending')
      : (isCreditMethod ? 'credit' : 'pending')

    const payload = {
      code: editingOrderCode ?? `POS-${Date.now()}`,
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
      status: 'pending',
      settlement_status: finalSettlementStatus,
      credit_by_id: finalCreditById,
      description: orderNote || undefined,
      details: mergedDetails,
    }

    holdMutate(payload)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: any) =>
      editingOrderId
        ? salesOrdersService.update(editingOrderId, payload as any)
        : api.post('/sales-orders', payload, { headers: { 'Idempotency-Key': crypto.randomUUID() } }).then(r => r.data),
    onSuccess: async (res: any, variables: any) => {
      const salesOrderId = res?.data?.id ?? editingOrderId ?? null
      const paidAmount = isCashMethod
        ? Number(cashTendered.replace(/\D/g, ''))
        : variables.total_price

      if (salesOrderId) {
        const dateStr = new Date().toISOString().split('T')[0];
        let paymentsPayload: any[] = [];

        if (isSplitPayment) {
          paymentsPayload = splitPayments.map(sp => ({
            payment_method_id: sp.paymentMethodId,
            amount: sp.amount,
            description: orderNote || undefined,
            allocations: [{ sales_order_id: salesOrderId, amount: sp.amount }]
          }));
        } else if (paymentMethodId) {
          paymentsPayload = [{
            payment_method_id: paymentMethodId,
            amount: paidAmount,
            description: orderNote || undefined,
            allocations: [{ sales_order_id: salesOrderId, amount: paidAmount }]
          }];
        }

        if (paymentsPayload.length > 0) {
          try {
            await paymentsService.create({
              type: 'receive',
              date: dateStr,
              payments: paymentsPayload
            } as any);
          } catch (err: any) {
            toast.error(
              'Order created but payment recording failed: ' +
              (err?.response?.data?.message ?? 'Unknown error'),
            )
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      qc.invalidateQueries({ queryKey: ['pos-history'] })
      qc.invalidateQueries({ queryKey: ['product-inventories-pos'] })
      qc.invalidateQueries({ queryKey: ['pos-bundles'] })
      toast.success('Order placed!')
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
    const mergedDetails = [
      ...cart.map((c: any) => ({
        product_inventory_id: c.product_inventory_id,
        bundle_id: null,
        qty: c.qty,
        price: c.price,
        status: 'completed',
      })),
      ...bundleCart.map((c: any) => ({
        product_inventory_id: null,
        bundle_id: c.bundle_id,
        qty: c.qty,
        price: c.price,
        status: 'completed',
        bundle_details: c.bundle_details?.map((bd: any) => ({
          product_inventory_id: bd.product_inventory_id,
          bundle_detail_item_id: bd.bundle_detail_item_id,
        })) || [],
      })),
    ]

    const splitCreditUser = isSplitPayment
      ? splitPayments.find(sp => sp.creditByUserId)?.creditByUserId
      : null

    const finalCreditById = isSplitPayment 
      ? (splitCreditUser || undefined)
      : (isCreditMethod ? creditByUserId : undefined)
    
    const finalSettlementStatus = isSplitPayment 
      ? (splitCreditUser ? 'credit' : 'pending')
      : (isCreditMethod ? 'credit' : 'pending')

    const payload = {
      code: editingOrderCode ?? `POS-${Date.now()}`,
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
      settlement_status: finalSettlementStatus,
      credit_by_id: finalCreditById,
      description: orderNote || undefined,
      details: mergedDetails,
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
