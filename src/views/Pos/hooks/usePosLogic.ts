import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { usePrinter } from '@/hooks/usePrinter'
import { buildReceiptBytes } from '@/lib/print/receiptBuilder'
import { mapReceiptToBuilder, printReceiptViaIframe } from '../utils/receiptPrint'
import type { CompletedTransaction } from '../components/PosTransactionCompleteModal'

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
import { availableStockOf } from '@/utils/inventoryStock'
import { useDebounce } from '@/hooks/useDebounce'

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

/**
 * A sale can now be refused because a box or knife (or the product itself) is
 * short — the backend answers with a 422 whose text already names what to fix
 * ("... Adjust Box medium stock first."). Show that text as-is and point the
 * operator at the stock-adjust screen.
 */
const isStockShortageError = (msg: string): boolean =>
  /has \d+,\s*needs \d+|only \d+ in stock,\s*needs \d+|Adjust .+ stock first/i.test(msg)

/** Appends an "adjust stock" hint to a stock-shortage 422, else returns it unchanged. */
const withAdjustStockHint = (msg: string): string =>
  isStockShortageError(msg) ? `${msg} — Sesuaikan stok lewat Stock Opname / Product Inventory.` : msg

// Inventory rows carry expiry on the batch, not on the row itself.
const expiryOf = (row: any): string | null =>
  row?.product_uom_batch?.expiry_date ?? row?.expiry_date ?? null

/** Compact quantity for short toasts, e.g. "1,5" / "24". */
const formatQty = (v: number): string =>
  v.toLocaleString('id-ID', { maximumFractionDigits: 2 })

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

// Two requests with the same Idempotency-Key at the same moment: the second
// gets 409 "already in progress". Retrying with the SAME key returns the stored
// response once the first request has answered.
const isIdempotencyInProgress = (err: any): boolean =>
  err?.response?.status === 409 &&
  /already in progress/i.test(String(err?.response?.data?.message ?? ''))

const withIdempotencyRetry = async <T,>(fn: () => Promise<T>, attempts = 5): Promise<T> => {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (!isIdempotencyInProgress(err) || i >= attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
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
  // PATCH refuses a changed settlement_status — the stored one is sent back and
  // any change goes through the bulk settlement endpoint.
  const [editingOrderSettlement, setEditingOrderSettlement] = useState<string | null>(null)
  // Blocks a second submit while the first is still preparing (customer
  // resolve) or in flight.
  const submitLockRef = useRef(false)
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
    // Server figures from the voucher preview: PPN is charged after the
    // discount, so never recompute it on the screen.
    tax_amount?: number
    total_price?: number
  } | null>(null)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const discountAmount = appliedVoucher?.discount_amount ?? 0

  // Payment State
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const [cashTendered, setCashTendered] = useState<string>('')
  const [creditByUserId, setCreditByUserId] = useState<number | null>(null)
  // credit_type: 'user' = staff credit (credit_by_id), 'customer' = customer credit
  const [creditType, setCreditType] = useState<'user' | 'customer'>('user')
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [splitPayments, setSplitPayments] = useState<Array<{ paymentMethodId: number, amount: number, cashTendered?: string, creditByUserId?: number | null }>>([])
  // DP / partial payment: 'full' = pay entire total now, 'partial' = down payment
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full')
  const [partialAmount, setPartialAmount] = useState<string>('')
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
  // Cashier flow: cart -> review (read order back) -> payment -> complete
  // (change, print receipt, new transaction). No page reload in between.
  const [showReview, setShowReview] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState<CompletedTransaction | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
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
        tax_amount: order.tax_amount != null ? Number(order.tax_amount) : undefined,
        total_price: order.total_price != null ? Number(order.total_price) : undefined,
      })
    } else {
      setVoucherCode('')
      setAppliedVoucher(null)
    }

    setOrderNote(order.description ?? '')
    setEditingOrderId(order.id)
    setEditingOrderCode(order.code)
    setEditingOrderSettlement(order.settlement_status ?? null)
    // Restore credit fields when re-opening a held order
    setCreditByUserId(order.credit_by_id ?? null)
    setCreditType(order.credit_type === 'customer' ? 'customer' : 'user')
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

      // No server-side stock filter or sort is used here; both are applied
      // client-side in groupedItems against the row's `stock`.

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
      // All lots in a group share one product_uom, so summing the available
      // quantity across them is safe — no cross-unit mixing.
      g.totalStock += availableStockOf(row)
    }

    for (const g of map.values()) {
      g.lots.sort(fefoCompare)
      const firstStocked = g.lots.find((l: any) => availableStockOf(l) > 0)
      g.defaultLot = firstStocked ?? g.lots[0]
      g.representative = g.defaultLot
    }
    const groups: any[] = Array.from(map.values())

    const uomOf = (g: any) => g.defaultLot?.product_uom_batch?.product_uom ?? g.defaultLot?.product_uom
    const priceOf = (g: any) => Number(uomOf(g)?.base_price ?? 0)
    // Alphabetical key: product name first (what staff actually recognise),
    // then SKU / product code, then a stable id fallback — NEVER empty. An
    // empty key made every localeCompare() return 0, turning the sort into a
    // no-op and leaving the API's stock-correlated row order on screen (which
    // looked like "sorted by stock" and shuffled the grid on every sale).
    const nameOf = (g: any) => {
      const uom = uomOf(g)
      const label = uom?.product?.name ?? uom?.code ?? uom?.product?.code ?? ''
      return String(label || g.product_uom_id || g.key)
    }
    const compareBy = (a: any, b: any): number => {
      if (sortBy === 'price_asc') return priceOf(a) - priceOf(b)
      if (sortBy === 'price_desc') return priceOf(b) - priceOf(a)
      return nameOf(a).localeCompare(nameOf(b))
    }
    // In-stock first, out-of-stock pinned to the very end, then the chosen
    // order. Array.sort is stable, so a card keeps its position across
    // transactions; it only moves when it actually sells out — and then it
    // drops to the bottom instead of leaving a dead card mid-grid.
    groups.sort((a, b) => {
      const aOut = a.totalStock > 0 ? 0 : 1
      const bOut = b.totalStock > 0 ? 0 : 1
      return aOut - bOut || compareBy(a, b)
    })

    // "In stock only" is evaluated client-side against each group's summed
    // available stock.
    return inStockOnly ? groups.filter((g) => g.totalStock > 0) : groups
  }, [items, sortBy, inStockOnly])

  // ---------------------------------------------------------------------------
  // 4. COMPUTED VALUES
  // ---------------------------------------------------------------------------
  const subtotal = cart.reduce((s: number, c: any) => s + c.price * c.qty, 0) + bundleCart.reduce((s: number, c: any) => s + c.price * c.qty, 0)
  // With a voucher, PPN and total come from the server preview (PPN is charged
  // on the price after the voucher discount).
  const taxAmount = appliedVoucher?.tax_amount ?? 0
  const total =
    appliedVoucher?.total_price != null && Number.isFinite(appliedVoucher.total_price)
      ? Math.max(0, appliedVoucher.total_price)
      : Math.max(0, subtotal - (discountAmount ?? 0))
  // PPN either sits inside the prices (total = subtotal − discount) or is added on top.
  const taxIncluded = taxAmount > 0 && Math.abs(subtotal - discountAmount + taxAmount - total) > 1

  const selectedMethod = paymentMethods.find((pm) => pm.id === paymentMethodId)
  const isCashMethod = selectedMethod?.name?.toLowerCase().includes('cash') ?? false;
  const isCreditMethod = selectedMethod?.name?.toLowerCase().includes('credit') ?? false;
  const dueAmount = paymentMode === 'partial' ? (Number(partialAmount.replace(/\D/g, '')) || 0) : total
  const change = isCashMethod ? Math.max(0, Number(cashTendered.replace(/\D/g, '')) - dueAmount) : 0;

  // Credit-user picker searches on the server; users already picked (single
  // or split payment) stay in the list so their name + credit remain known.
  const [creditUserSearch, setCreditUserSearch] = useState('')
  const creditUserSearchDebounced = useDebounce(creditUserSearch, 400)
  const { data: creditUsersData } = useQuery({
    queryKey: ['pos-credit-users', creditUserSearchDebounced],
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      usersService
        .list({ 'filter[search]': creditUserSearchDebounced || undefined, per_page: 20, 'filter[type]': 'user' } as any)
        .then((r) => r.data),
  })
  const seenCreditUsersRef = useRef(new Map<number, any>())
  const creditUsers: any[] = useMemo(() => {
    const results: any[] = (creditUsersData as any)?.data ?? []
    for (const u of results) seenCreditUsersRef.current.set(u.id, u)
    const pickedIds = [creditByUserId, ...splitPayments.map((sp) => sp.creditByUserId)]
      .filter((id): id is number => typeof id === 'number' && id > 0)
    const extra = pickedIds
      .filter((id, i, arr) => arr.indexOf(id) === i && !results.some((u) => u.id === id))
      .map((id) => seenCreditUsersRef.current.get(id))
      .filter(Boolean)
    return [...extra, ...results]
  }, [creditUsersData, creditByUserId, splitPayments])

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
    setPaymentMode('full')
    setPartialAmount('')
    setShowReceipt(false)
    setEditingOrderId(null)
    setEditingOrderCode(null)
    setEditingOrderSettlement(null)
    setShowReview(false)
    setCompletedTransaction(null)
    idemRef.current = null
  }, [])

  const addLotToCart = useCallback((lot: any) => {
    if (!lot) return

    // Availability is the row's stock.
    const available = availableStockOf(lot)

    if (available <= 0) {
      toast.error('Item is out of stock')
      return
    }

    setCart((prev: any[]) => {
      const existing = prev.find((c) => c.product_inventory_id === lot.id)
      if (existing) {
        // Never let the cart exceed what may actually be sold.
        if (existing.qty + 1 > available) {
          toast.error(`Stok tidak mencukupi — tersisa ${formatQty(available)}`)
          return prev
        }
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
          maxQty: available,
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
          _inventory: inventory,
        }
      })

      // A bundle can only be sold as many times as its scarcest ingredient
      // allows. A detail without a resolved inventory row doesn't cap anything
      // client-side — the server still validates at checkout.
      let maxQty: number | undefined
      const fitsByItem: { name: string; available: number; fits: number }[] = []
      for (const d of processedDetails) {
        const perBundle = Number(d.qty) || 1
        const available = availableStockOf(d._inventory)
        if (perBundle <= 0 || available <= 0) continue
        const fits = Math.floor(available / perBundle)
        fitsByItem.push({ name: d.product_name, available, fits })
        maxQty = maxQty === undefined ? fits : Math.min(maxQty, fits)
      }
      // Name the scarcest ingredient(s) so the cashier knows what ran out.
      const limitedBy = maxQty === undefined
        ? undefined
        : fitsByItem
            .filter((f) => f.fits === maxQty)
            .map((f) => `${f.name} (sisa ${formatQty(f.available)})`)
            .join(', ')

      setBundleCart((prev: any[]) => {
        const existing = prev.find((b: any) => b.bundle_id === bundle.id)
        if (existing) {
          if (maxQty !== undefined && existing.qty + 1 > maxQty) {
            toast.error(`Stok ${limitedBy} tidak mencukupi — maksimal ${formatQty(maxQty)} bundle`)
            return prev
          }
          return prev.map((b: any) =>
            b.bundle_id === bundle.id ? { ...b, qty: b.qty + 1 } : b,
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
            maxQty,
            limitedBy,
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

  // ── Settlement rules (POS) ────────────────────────────────────────────────
  // ONLINE orders take no tenders and stay 'pending' until the marketplace
  // payout is settled (Settle payout screen). OFFLINE is 'settled' unless a
  // credit method is picked. The backend derives settlement_status itself; the
  // field is still required, so we keep sending the expected value.
  const baseSettlementStatus = (): 'pending' | 'settled' =>
    orderType === 'online' ? 'pending' : 'settled'

  const getSettlement = () => {
    if (orderType === 'online') {
      return { creditType: null, creditById: null, settlementStatus: 'pending' as const }
    }
    const splitCreditUser = isSplitPayment
      ? splitPayments.find((sp) => sp.creditByUserId)?.creditByUserId
      : null
    // Split with a credit user ⇒ always staff credit
    if (isSplitPayment) {
      if (splitCreditUser) {
        return { creditType: 'user' as const, creditById: splitCreditUser, settlementStatus: 'credit' as const }
      }
      return { creditType: null, creditById: null, settlementStatus: baseSettlementStatus() }
    }
    if (isCreditMethod) {
      if (creditType === 'customer') {
        return { creditType: 'customer' as const, creditById: null, settlementStatus: 'credit' as const }
      }
      return { creditType: 'user' as const, creditById: creditByUserId, settlementStatus: 'credit' as const }
    }
    return { creditType: null, creditById: null, settlementStatus: baseSettlementStatus() }
  }

  // Customer credit can be a picked customer OR a manually typed name (the
  // name/phone inputs live in the Payment modal). The API wants a real
  // customer_id, so a manual name is matched against an existing customer
  // first, then created as a new one.
  const manualCustomerName = guestName.trim()

  const clearSelectedCustomer = () => {
    setSelectedCustomerId(null)
    setCustomerSearch('')
  }

  const resolveCustomerForCredit = async (): Promise<number | null> => {
    if (selectedCustomerId && selectedCustomerId > 0) return selectedCustomerId
    const name = manualCustomerName
    if (!name) return null
    const phone = guestPhone.trim() || undefined

    try {
      const res = await customersService.list({ per_page: 20, 'filter[search]': name } as any)
      const rows: any[] = (res.data as any)?.data ?? []
      const lower = name.toLowerCase()
      const sameName = (c: any) => String(c?.name ?? '').trim().toLowerCase() === lower
      const match =
        (phone ? rows.find((c: any) => sameName(c) && String(c?.phone ?? '').trim() === phone) : null) ??
        rows.find(sameName)
      if (match?.id) {
        setSelectedCustomerId(Number(match.id))
        setCustomerSearch(String(match.name ?? name))
        return Number(match.id)
      }
    } catch {
      // no read access — fall through and try to create
    }

    try {
      const created = await customersService.create({ name, phone } as any)
      const id = Number((created.data as any)?.data?.id ?? 0)
      if (id > 0) {
        setSelectedCustomerId(id)
        setCustomerSearch(name)
        return id
      }
    } catch {
      // e.g. missing customer.create — payload falls back to name/phone only
    }
    return null
  }

  // credit_type=user ⇒ customer_id must be null; non-credit keeps whatever the
  // cart picked; customer credit resolves to a real id (picked or created).
  const resolvePayloadCustomerId = async (
    resolved: 'user' | 'customer' | null,
  ): Promise<number | null> => {
    if (resolved === 'user') return null
    if (resolved === 'customer') return resolveCustomerForCredit()
    return selectedCustomerId ?? null
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
          tax_amount: data.tax_amount != null ? Number(data.tax_amount) : undefined,
          total_price: data.total_price != null ? Number(data.total_price) : undefined,
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
    // Sales channel is chosen inside the payment modal — don't block here.
    setShowReview(true)
  }

  const closeReview = useCallback(() => setShowReview(false), [])
  const clearVoucher = useCallback(() => {
    setAppliedVoucher(null)
    setVoucherCode('')
  }, [])
  const proceedFromReview = useCallback(() => {
    setShowReview(false)
    setShowPayment(true)
  }, [])
  // Payment -> back to the review step (customer / voucher / note edits).
  const backToReview = useCallback(() => {
    setShowPayment(false)
    setShowReview(true)
  }, [])

  // Print a receipt: WebUSB thermal printer when connected, otherwise the
  // browser print dialog (hidden iframe).
  const printTransaction = useCallback(
    async (tx: CompletedTransaction | null) => {
      if (!tx) return
      setIsPrinting(true)
      try {
        let printed = false
        if (printer.status === 'connected') {
          try {
            await printer.print(buildReceiptBytes(mapReceiptToBuilder(tx.receipt)))
            printed = true
          } catch (e) {
            console.error('[Print] WebUSB failed, falling back to browser print', e)
          }
        }
        if (!printed) printReceiptViaIframe(tx.receipt)
        setCompletedTransaction((prev) =>
          prev && prev.receipt.invoiceNo === tx.receipt.invoiceNo
            ? { ...prev, printedCount: prev.printedCount + 1 }
            : prev,
        )
      } finally {
        setIsPrinting(false)
      }
    },
    [printer],
  )

  const handlePrintCompleted = useCallback(() => {
    void printTransaction(completedTransaction)
  }, [printTransaction, completedTransaction])

  const startNewTransaction = useCallback(() => {
    resetCart()
  }, [resetCart])

  const { mutate: holdMutate, isPending: isHoldPending } = useMutation({
    mutationFn: (payload: any) => {
      if (editingOrderId) {
        return salesOrdersService.update(
          editingOrderId,
          toApiOrder(
            { ...payload, settlement_status: editingOrderSettlement ?? payload.settlement_status },
            { keepNull: ['customer_id', 'credit_type', 'credit_by_id'] },
          ) as any,
        )
      }
      const body = toApiOrder(payload)
      const key = idemKeyFor('hold', body)
      return withIdempotencyRetry(() =>
        api.post('/sales-orders', body, { headers: { 'Idempotency-Key': key } }),
      ).then((r) => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      toast.success('Order held as pending')
      resetCart()
    },
    onError: (err: any) =>
      toast.error(withAdjustStockHint(getApiErrorMessage(err, 'Failed to hold order'))),
  })

  const handleHold = async () => {
    if (submitLockRef.current || isHoldPending || isPending) return
    submitLockRef.current = true
    let dispatched = false
    try {
      dispatched = await prepareHold()
    } finally {
      if (!dispatched) submitLockRef.current = false
    }
  }

  // Returns true once the mutation was dispatched (its onSettled releases the lock).
  const prepareHold = async (): Promise<boolean> => {
    if (cart.length === 0 && bundleCart.length === 0) {
      toast.error('Cart is empty')
      return false
    }

    if (!salesChannelId) {
      toast.error('Please select a Sales Channel first')
      return false
    }

    const { creditById, settlementStatus, creditType: resolvedCreditType } = getSettlement()

    if (resolvedCreditType === 'user' && !creditById) {
      toast.error('Select a credit user')
      return false
    }
    if (
      resolvedCreditType === 'customer' &&
      !(selectedCustomerId && selectedCustomerId > 0) &&
      !manualCustomerName
    ) {
      toast.error('Select a customer or type a customer name for customer credit')
      return false
    }

    const payloadCustomerId = await resolvePayloadCustomerId(resolvedCreditType)
    const fallbackCustomerName =
      resolvedCreditType === 'customer' ? manualCustomerName : guestName

    const payload = {
      type: orderType,
      customer_id: payloadCustomerId,
      customer_name: payloadCustomerId ? undefined : fallbackCustomerName || undefined,
      customer_phone: payloadCustomerId ? undefined : guestPhone || undefined,
      date: transactionDate,
      fulfillment_date: fulfillmentDate.slice(0, 10),
      sales_channel_id: salesChannelId,
      voucher_id: appliedVoucher?.voucher_id ?? undefined,
      status: 'pending',
      settlement_status: settlementStatus,
      credit_type: resolvedCreditType,
      credit_by_id: creditById,
      description: orderNote || undefined,
      details: buildDetails('pending', !!editingOrderId),
    }

    holdMutate(payload, { onSettled: () => { submitLockRef.current = false } })
    return true
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: any) => {
      if (editingOrderId) {
        // Send the stored settlement_status back unchanged — PATCH refuses a
        // change (422); onSuccess moves it through the bulk endpoint instead.
        return salesOrdersService.update(
          editingOrderId,
          toApiOrder(
            { ...payload, settlement_status: editingOrderSettlement ?? payload.settlement_status },
            { keepNull: ['customer_id', 'credit_type', 'credit_by_id'] },
          ) as any,
        )
      }
      // Payment amount: full = sale total; partial (DP) = user-entered amount.
      // cashTendered is only used for change calculation in the UI.
      const paidAmount = paymentMode === 'partial'
        ? Number(partialAmount.replace(/\D/g, '')) || 0
        : payload.total_price
      const isOnline = payload.type === 'online'
      const paymentStatus = isOnline ? 'pending' : paymentMode === 'partial' ? 'partial' : 'paid'
      let checkoutPayments: {
        payment_method_id: number
        amount: number
        description?: string
      }[] = []
      if (isOnline) {
        // An online order is paid to the marketplace — the API refuses tenders.
        checkoutPayments = []
      } else if (isSplitPayment) {
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
        credit_type: payload.credit_type ?? null,
        payment_status: paymentStatus,
        customer_id: payload.customer_id ?? undefined,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        credit_by_id: payload.credit_by_id,
        voucher_id: payload.voucher_id,
        description: payload.description,
        details: payload.details,
        payments: checkoutPayments,
      }
      const key = idemKeyFor('checkout', body)
      return withIdempotencyRetry(() => salesOrdersService.checkout(body, key))
    },
    onSuccess: async (res: any, variables: any) => {
      // Checkout is atomic — payment already created by the backend.
      // Only create payments separately for edited (held) orders. Online
      // orders never get a payment here: the marketplace payout settles them.
      if (editingOrderId && variables.type !== 'online') {
        const salesOrderId = editingOrderId
        // Pay the server's total (voucher discount is rounded server-side), not a local recompute.
        const serverTotal = Number(res?.data?.data?.total_price)
        const paidAmount = paymentMode === 'partial'
          ? Number(partialAmount.replace(/\D/g, '')) || 0
          : Number.isFinite(serverTotal) ? serverTotal : variables.total_price

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
            const payKey = idemKeyFor(`pay:${salesOrderId}`, paymentBody)
            await withIdempotencyRetry(() => paymentsService.create(paymentBody as any, payKey))
          } catch (err: any) {
            toast.error(
              'Order updated but payment recording failed: ' +
              getApiErrorMessage(err, 'Unknown error'),
            )
          }
        }
      }

      // A held order's settlement can't change through PATCH. If the payment
      // didn't already move it to the target status, use the bulk endpoint.
      // A partial (DP) payment never settles the order.
      const wantsChange =
        !!variables.settlement_status &&
        variables.settlement_status !== editingOrderSettlement &&
        !(paymentMode === 'partial' && variables.settlement_status === 'settled')
      if (editingOrderId && wantsChange) {
        try {
          const fresh = await salesOrdersService.findById(editingOrderId)
          const current = (fresh.data as any)?.data?.settlement_status
          if (current !== variables.settlement_status) {
            await salesOrdersService.bulkUpdateSettlement({
              items: [{ sales_order_id: editingOrderId, settlement_status: variables.settlement_status }],
            })
          }
        } catch (err: any) {
          toast.error(
            'Order updated but settlement status could not be changed: ' +
            getApiErrorMessage(err, 'Unknown error'),
          )
        }
      }

      qc.invalidateQueries({ queryKey: ['pos-preorders'] })
      qc.invalidateQueries({ queryKey: ['pos-history'] })
      qc.invalidateQueries({ queryKey: ['product-inventories-pos'] })
      qc.invalidateQueries({ queryKey: ['pos-bundles'] })
      qc.invalidateQueries({ queryKey: ['pos-credit-users'] })

      // ── Transaction complete screen (replaces the old page reload) ──
      // Totals come from the server response (voucher rounding is server-side).
      const order = res?.data?.data ?? {}
      const num = (v: any, fallback: number) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : fallback
      }
      const isOnline = variables.type === 'online'
      const serverTotal = num(order.total_price, variables.total_price)
      const serverSubtotal = num(order.subtotal_price, variables.subtotal_price)
      const serverDiscount = num(order.discount_price, variables.discount_price)
      const serverTax = num(order.tax_amount, taxAmount)
      const isPartial = !isOnline && paymentMode === 'partial'
      const dueNow = isPartial ? Number(partialAmount.replace(/\D/g, '')) || 0 : serverTotal
      const methodName = (id: number | null | undefined) =>
        paymentMethods.find((pm: any) => pm.id === id)?.name ?? 'Payment'

      let payments: { method: string; amount: number }[] = []
      if (!isOnline) {
        if (isSplitPayment) {
          payments = splitPayments.map((sp) => ({ method: methodName(sp.paymentMethodId), amount: Number(sp.amount) || 0 }))
        } else if (paymentMethodId) {
          payments = [{ method: methodName(paymentMethodId), amount: dueNow }]
        }
      }
      const tenderedCash = Number(cashTendered.replace(/\D/g, '')) || 0
      const tendered = !isOnline && !isSplitPayment && isCashMethod && tenderedCash > 0 ? tenderedCash : dueNow
      const change = !isOnline && !isSplitPayment && isCashMethod ? Math.max(0, tendered - dueNow) : 0

      const now = new Date()
      const branch = (user as any)?.branch ?? {}
      const tx: CompletedTransaction = {
        orderId: order.id ?? editingOrderId ?? null,
        receipt: {
          companyName: 'Dapur Cokelat Indonesia',
          branchName: branch.name ?? 'Dapur Cokelat',
          branchAddress: branch.address ?? '',
          branchPhone: branch.phone ?? '',
          invoiceNo: order.code ?? editingOrderCode ?? '',
          date: now
            .toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })
            .replace(/\//g, '-'),
          time: now.toLocaleTimeString('id-ID'),
          cashierName: (user as any)?.name ?? 'Kasir',
          customerName: (selectedCustomerId ? customerSearch : variables.customer_name || guestName) || undefined,
          orderType: variables.type,
          items: [
            ...cart.map((c: any) => ({ name: c.name ?? '', qty: c.qty, price: c.price, subtotal: c.qty * c.price })),
            ...bundleCart.map((c: any) => ({ name: c.name ?? '', qty: c.qty, price: c.price, subtotal: c.qty * c.price })),
          ],
          grossAmount: serverSubtotal,
          discountAmount: serverDiscount,
          taxAmount: serverTax,
          taxIncluded:
            serverTax > 0 && Math.abs(serverSubtotal - serverDiscount + serverTax - serverTotal) > 1,
          totalAmount: serverTotal,
          payments,
          changeAmount: change,
          isPrinted: false,
        },
        tendered,
        change,
        isOnline,
        isPartial,
        remaining: isPartial ? Math.max(0, serverTotal - dueNow) : 0,
        printedCount: 0,
      }

      setShowPayment(false)
      setCompletedTransaction(tx)
      toast.success(editingOrderId ? 'Order updated!' : 'Order placed!')

      // A connected thermal printer prints straight away (like a real till);
      // without one the cashier prints from the complete screen.
      if (printer.status === 'connected' && !isOnline) {
        void printTransaction(tx)
      }
    },
    onError: (err: any) => {
      toast.error(withAdjustStockHint(getApiErrorMessage(err, 'Failed to place order')))
      // Keep the cart and reopen payment so the cashier can fix and retry.
      setShowPayment(true)
    },
  })

  const handleConfirmPayment = async () => {
    if (submitLockRef.current || isPending || isHoldPending) return
    submitLockRef.current = true
    let dispatched = false
    try {
      dispatched = await prepareCheckout()
    } finally {
      if (!dispatched) submitLockRef.current = false
    }
  }

  // Returns true once the mutation was dispatched (its onSettled releases the lock).
  const prepareCheckout = async (): Promise<boolean> => {
    if (orderType !== 'online' && (isSplitPayment ? splitPayments.length === 0 : !paymentMethodId)) {
      toast.error('Select a payment method')
      return false
    }

    const { creditById, settlementStatus, creditType: resolvedCreditType } = getSettlement()

    // credit_type guards (API): user ⇒ credit_by_id required + customer_id null;
    // customer ⇒ a real customer_id (picked or created from a manual name).
    if (resolvedCreditType === 'user' && !creditById) {
      toast.error('Please select a credit user')
      return false
    }
    if (
      resolvedCreditType === 'customer' &&
      !(selectedCustomerId && selectedCustomerId > 0) &&
      !manualCustomerName
    ) {
      toast.error('Please select a customer or type a customer name for customer credit')
      return false
    }

    const payloadCustomerId = await resolvePayloadCustomerId(resolvedCreditType)
    const fallbackCustomerName =
      resolvedCreditType === 'customer' ? manualCustomerName : guestName

    // subtotal_price / discount_price / total_price stay local (used for the
    // payment amount) and are stripped before anything is sent to the API.
    const payload = {
      type: orderType,
      customer_id: payloadCustomerId,
      customer_name: payloadCustomerId ? undefined : fallbackCustomerName || undefined,
      customer_phone: payloadCustomerId ? undefined : guestPhone || undefined,
      date: transactionDate,
      fulfillment_date: fulfillmentDate.slice(0, 10),
      sales_channel_id: salesChannelId,
      voucher_id: appliedVoucher?.voucher_id ?? undefined,
      subtotal_price: subtotal,
      discount_price: discountAmount,
      total_price: total,
      status: 'final',
      settlement_status: settlementStatus,
      credit_type: resolvedCreditType,
      credit_by_id: creditById,
      description: orderNote || undefined,
      details: buildDetails('completed', !!editingOrderId),
    }

    mutate(payload, { onSettled: () => { submitLockRef.current = false } })
    return true
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
    manualCustomerName,
    clearSelectedCustomer,
    salesChannelId, setSalesChannelId,
    guestName, setGuestName,
    guestPhone, setGuestPhone,
    showCustomerDropdown, setShowCustomerDropdown,
    voucherCode, setVoucherCode,
    appliedVoucher,
    voucherLoading,
    discountAmount,
    taxAmount,
    taxIncluded,
    showPayment, setShowPayment,
    paymentMethodId, setPaymentMethodId,
    cashTendered, setCashTendered,
    isSplitPayment, setIsSplitPayment,
    splitPayments, setSplitPayments,
    paymentMode, setPaymentMode,
    partialAmount, setPartialAmount,
    orderNote, setOrderNote,
    transactionDate, setTransactionDate,
    fulfillmentDate, setFulfillmentDate,
    showReceipt, setShowReceipt,
    showReview, closeReview, proceedFromReview, backToReview, clearVoucher,
    completedTransaction, isPrinting, printerConnected: printer.status === 'connected',
    handlePrintCompleted, startNewTransaction,
    editingOrderCode,
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
    creditByUserId, setCreditByUserId, creditUsers, setCreditUserSearch,
    creditType, setCreditType,
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
