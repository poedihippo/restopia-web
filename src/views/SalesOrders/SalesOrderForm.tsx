'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { parseApiDate } from '@/utils/date';

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastMutationApiError } from '@/utils/apiError'
import { customersService as customerService } from '@/services/customers.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomBatchesService } from '@/services/product-uom-batches.service'
import { bundlesService as bundleService } from '@/services/bundles.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { branchesService } from '@/services/branches.service'
import { usersService } from '@/services/users.service'
import { salesChannelsService } from '@/services/sales-channels.service'
import { taxesService } from '@/services/taxes.service'
import SearchableSelect from '@/components/SearchableSelect'
import api from '@/hooks/useApi'
import { PriceDisplay } from '@/components/PriceDisplay'

const generateKey = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36)

const formatNumber = (n: number | undefined, canReadPrice: boolean): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!canReadPrice) return '***'
  return Number(n).toLocaleString('id-ID')
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  type: 'product' | 'bundle'
  product_inventory_id?: number | null
  bundle_id?: number | null
  bundle_details?: { product_inventory_id: number; qty: number }[] | null
  purchase_order_detail_id?: number
  name: string
  code: string
  qty: number
  price: number
  status: 'pending' | 'process' | 'completed'
  description: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SalesOrderForm({ editingOrder }: { editingOrder?: any }): React.ReactElement {
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = !!editingOrder

  // ── Header state ───────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)

  const [code, setCode] = useState(editingOrder?.code ?? `SO-${Date.now()}`)
  const [type, setType] = useState<'offline' | 'online'>(editingOrder?.type ?? 'offline')
  const [date, setDate] = useState(editingOrder?.date ?? today)
  const [fulfillmentDate, setFulfillmentDate] = useState(
    editingOrder?.fulfillment_date ?? today
  )
  const [salesChannelId, setSalesChannelId] = useState<number | undefined>(
    editingOrder?.sales_channel_id ?? undefined
  )
  const [status, setStatus] = useState<'pending' | 'final'>(editingOrder?.status ?? 'pending')
  const [settlementStatus, setSettlementStatus] = useState<
    'pending' | 'credit' | 'settled' | 'cancelled'
  >(editingOrder?.settlement_status ?? 'pending')
  const [description, setDescription] = useState(editingOrder?.description ?? '')
  const [discountPrice, setDiscountPrice] = useState<number>(editingOrder?.discount_price ?? 0)
  const [voucherId] = useState<number | null>(editingOrder?.voucher_id ?? null)

  // ── Customer state ─────────────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState<number | null>(editingOrder?.customer_id ?? null)
  const [customerSearch, setCustomerSearch] = useState(editingOrder?.customer?.name ?? '')
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [customerName, setCustomerName] = useState(editingOrder?.customer_name ?? '')
  const [customerPhone, setCustomerPhone] = useState(editingOrder?.customer_phone ?? '')

  // ── Inter-branch / PO reference state ──────────────────────────────────────
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | undefined>(
    editingOrder?.purchase_order_id ?? undefined,
  )
  const [buyerBranchId, setBuyerBranchId] = useState<number | undefined>(
    editingOrder?.buyer_branch_id ?? undefined,
  )

  // ── Credit (settlement_status === 'credit') ────────────────────────────────
  const [creditById, setCreditById] = useState<number | undefined>(
    editingOrder?.credit_by_id ?? editingOrder?.credit_by?.id ?? undefined,
  )

  // ── Additional Charges state ───────────────────────────────────────────────
  const [additionalCharges, setAdditionalCharges] = useState<{
    name: string
    amount: number
    tax_id?: number
    description?: string
  }[]>(() => {
    return editingOrder?.additional_charges?.map((c: any) => ({
      name: c.name,
      amount: c.amount,
      tax_id: c.tax_id,
      description: c.description
    })) ?? []
  })

  // ── Line items state ───────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>(() => {
    if (!editingOrder?.sales_order_details) return []
    return editingOrder.sales_order_details.map((d: any) => {
      let snap = d.product_inventory_snapshot
      if (typeof snap === 'string') {
        try { snap = JSON.parse(snap) } catch (e) { }
      }
      return {
        type: d.bundle_id ? 'bundle' : 'product',
        product_inventory_id: d.product_inventory_id ?? null,
        bundle_id: d.bundle_id ?? null,
        bundle_details: d.bundle_details ?? null,
        name:
          snap?.product_uom?.product?.name ??
          snap?.name ??
          d.product_inventory?.product_uom_batch?.product_uom?.product?.name ??
          d.product_inventory?.product_uom?.product?.name ??
          d.bundle?.name ??
          d.description ??
          '—',
        code: snap?.code ?? d.product_inventory?.code ?? d.bundle?.code ?? '',
        qty: d.qty,
        price: d.price,
        status: d.status,
        description: d.description ?? '',
      }
    })
  })

  // ── Product search state ───────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [showProductDrop, setShowProductDrop] = useState(false)
  const [itemTab, setItemTab] = useState<'products' | 'bundles'>('products')

  useEffect(() => {
    const t = setTimeout(() => setProductSearchDebounced(productSearch), 400)
    return () => clearTimeout(t)
  }, [productSearch])

  // ── Customer search debounce ───────────────────────────────────────────────
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setCustomerSearchDebounced(customerSearch), 400)
    return () => clearTimeout(t)
  }, [customerSearch])

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: customerData } = useQuery({
    queryKey: ['so-customers', customerSearchDebounced],
    enabled: customerSearchDebounced.length >= 2,
    queryFn: () =>
      customerService
        .list({ per_page: 10, 'filter[search]': customerSearchDebounced })
        .then((r) => r.data),
  })
  const customers = (customerData as any)?.data ?? []

  const { data: salesChannelsData } = useQuery({
    queryKey: ['so-sales-channels'],
    queryFn: () => salesChannelsService.list({ per_page: 100, sort: 'name' } as any).then((r) => r.data),
  })
  const salesChannels = (salesChannelsData as any)?.data ?? []

  const { data: productData } = useQuery({
    queryKey: ['so-products', productSearchDebounced],
    enabled: showProductDrop && itemTab === 'products',
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 20,
          'filter[search]': productSearchDebounced || undefined,
          'filter[product_type]': 'final',
          'filter[status]': 'active',
          include: 'branch,product_uom_batch',
        })
        .then((r) => r.data),
  })
  const products = (productData as any)?.data ?? []

  const { data: purchaseOrdersData } = useQuery({
    queryKey: ['so-purchase-orders'],
    queryFn: () =>
      purchaseOrdersService.list({ per_page: 50, sort: '-created_at' } as any).then((r) => r.data),
  })
  const purchaseOrders = (purchaseOrdersData as any)?.data ?? []

  const { data: branchesData } = useQuery({
    queryKey: ['so-branches'],
    queryFn: () => branchesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []


  const { data: creditUsersData } = useQuery({
    queryKey: ['users-credit'],
    enabled: settlementStatus === 'credit',
    queryFn: () =>
      usersService
        .list({ per_page: 100, 'filter[type]': 'user' } as any)
        .then((r) => r.data),
  })
  const creditUsers: any[] = (creditUsersData as any)?.data ?? []

  const { data: bundleData } = useQuery({
    queryKey: ['so-bundles', productSearchDebounced],
    enabled: showProductDrop && itemTab === 'bundles',
    queryFn: () =>
      bundleService
        .list({
          per_page: 20,
          'filter[status]': 'active',
          'filter[search]': productSearchDebounced || undefined,
          include: 'bundle_details',
        })
        .then((r) => r.data),
  })
  const bundles = (bundleData as any)?.data ?? []

  const { data: taxesData } = useQuery({
    queryKey: ['taxes-all'],
    queryFn: () => taxesService.list({ per_page: 50 }).then((r) => r.data),
  })
  const taxes = (taxesData as any)?.data ?? []

  // ── Prepopulate from PO (if ?po_id=... is in query) ──────────────────────
  useEffect(() => {
    if (router.isReady && router.query.po_id && !isEdit) {
      setPurchaseOrderId(Number(router.query.po_id))
    }
  }, [router.isReady, router.query.po_id, isEdit])

  const { data: poDetailData } = useQuery({
    queryKey: ['po-detail-for-so', purchaseOrderId],
    enabled: !!purchaseOrderId && !isEdit,
    queryFn: () =>
      purchaseOrdersService
        .findById(purchaseOrderId as number, {
          include: 'purchase_order_details,purchase_order_details.product_uom,purchase_order_details.product_uom.product,purchase_order_details.product_uom.product_inventory',
        })
        .then((r) => r.data),
  })

  useEffect(() => {
    const po = (poDetailData as any)?.data
    if (!po || isEdit) return

    setBuyerBranchId(po.branch_id)
    const parsedDate = po.date ? parseApiDate(po.date) : null
    setDate(parsedDate ? parsedDate.toISOString().substring(0, 10) : today)
    
    const parsedFulfillment = po.fulfillment_date ? parseApiDate(po.fulfillment_date) : null
    setFulfillmentDate(parsedFulfillment ? parsedFulfillment.toISOString().substring(0, 10) : today)
    
    setStatus('final')

    const poDetails = po.purchase_order_details ?? []
    if (poDetails.length === 0) return

    const fetchAndMap = async () => {
      try {
        const uomIds = Array.from(new Set(poDetails.map((d: any) => d.product_uom_id).filter(Boolean)))
        if (!uomIds.length) return

        // 1. Fetch batches for these UOMs
        const batchPromises = uomIds.map(id =>
          productUomBatchesService.list({
            'filter[product_uom_id]': id,
            per_page: 100,
          } as any)
        )
        const batchResponses = await Promise.all(batchPromises)
        const batches = batchResponses.flatMap(res => (res.data as any)?.data ?? [])

        // 2. Fetch inventories for these batches
        let inventories: any[] = []
        if (batches.length > 0) {
          const invPromises = batches.map((b: any) =>
            productInventoriesService.list({
              'filter[product_uom_batch_id]': b.id,
              'filter[branch_id]': po.branch_id,
              'filter[status]': 'active',
              include: 'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
              per_page: 1,
            } as any)
          )
          const invResponses = await Promise.all(invPromises)
          inventories = invResponses.flatMap(res => (res.data as any)?.data ?? [])
        }

        const newItems = poDetails.map((d: any) => {
          const inv = inventories.find((i: any) => i.product_uom_batch?.product_uom_id === d.product_uom_id)

          return {
            type: 'product' as const,
            product_inventory_id: inv?.id ?? d.product_uom?.product_inventory?.id ?? null,
            bundle_id: null,
            bundle_details: null,
            purchase_order_detail_id: d.id,
            name: inv
              ? inv.product_uom_batch?.product_uom?.product?.name ??
              inv.product_uom?.product?.name ??
              inv.code
              : d.product_uom?.product?.name ?? 'Unknown Product',
            code: inv?.code ?? d.product_uom?.code ?? '',
            qty: d.qty,
            price: d.price,
            status: 'completed' as const,
            description: d.description ?? '',
          }
        })

        setItems(newItems)
        toast.info('PO items loaded into Sales Order')
      } catch (err) {
        console.error(err)
      }
    }

    fetchAndMap()
  }, [poDetailData, isEdit])

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const additionalChargesTotal = additionalCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  const total = Math.max(0, subtotal + additionalChargesTotal - discountPrice)

  // ── Line item helpers ─────────────────────────────────────────────────────
  const addProduct = useCallback(
    (p: any) => {
      const price =
        type === 'online' ? (p.online_price ?? p.base_price ?? 0) : (p.base_price ?? 0)
      setItems((prev) => {
        const exists = prev.findIndex((i) => i.product_inventory_id === p.id)
        if (exists >= 0)
          return prev.map((i, idx) => (idx === exists ? { ...i, qty: i.qty + 1 } : i))
        return [
          ...prev,
          {
            type: 'product',
            product_inventory_id: p.id,
            bundle_id: null,
            bundle_details: null,
            name:
              p.product_uom_batch?.product_uom?.product?.name
              ?? p.product_uom?.product?.name
              ?? p.code,
            code: p.code,
            qty: 1,
            price,
            status: 'pending',
            description: '',
          },
        ]
      })
      setShowProductDrop(false)
      setProductSearch('')
    },
    [type]
  )

  const addBundle = useCallback((b: any) => {
    setItems((prev) => {
      const exists = prev.findIndex((i) => i.bundle_id === b.id)
      if (exists >= 0)
        return prev.map((i, idx) => (idx === exists ? { ...i, qty: i.qty + 1 } : i))
      return [
        ...prev,
        {
          type: 'bundle',
          product_inventory_id: null,
          bundle_id: b.id,
          bundle_details: (b.bundle_details ?? []).map((d: any) => {
            const item = d.items?.[0] || d
            // The POS/SO expects product_inventory_id, we map it from the item's product_uom_id
            return {
              bundle_detail_item_id: item.id,
              product_inventory_id: item.product_uom_id, 
            }
          }),
          name: b.name,
          code: b.code,
          qty: 1,
          price: b.price ?? 0,
          status: 'pending',
          description: '',
        },
      ]
    })
    setShowProductDrop(false)
    setProductSearch('')
  }, [])

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  // ── Mutation ──────────────────────────────────────────────────────────────
  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        code,
        type,
        date,
        fulfillment_date: fulfillmentDate,
        customer_id: customerId ?? null,
        customer_name: customerId ? undefined : customerName || undefined,
        customer_phone: customerId ? undefined : customerPhone || undefined,
        voucher_id: voucherId,
        purchase_order_id: purchaseOrderId || undefined,
        buyer_branch_id: buyerBranchId || undefined,
        sales_channel_id: salesChannelId || undefined,
        credit_by_id:
          settlementStatus === 'credit' ? creditById || undefined : undefined,
        subtotal_price: subtotal,
        discount_price: discountPrice,
        total_price: total,
        status,
        settlement_status: settlementStatus,
        description: description || undefined,
        additional_charges: additionalCharges,
        details: items.map((i) => ({
          product_inventory_id: i.product_inventory_id ?? null,
          bundle_id: i.bundle_id ?? null,
          bundle_details: i.bundle_details ?? null,
          purchase_order_detail_id: i.purchase_order_detail_id || undefined,
          qty: i.qty,
          price: i.price,
          status: i.status,
          description: i.description || undefined,
        })),
      }
      const headers = { 'Idempotency-Key': generateKey() }
      return isEdit
        ? api.patch(`/sales-orders/${editingOrder.id}`, payload, { headers })
        : api.post('/sales-orders', payload, { headers })
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(isEdit ? 'Order updated' : 'Order created')
      const id = res?.data?.data?.id ?? editingOrder?.id
      router.push(id ? `/sales/sales-orders/${id}/detail` : '/sales/sales-orders')
    },
    onError: (err: any) => toastMutationApiError(err),
  })

  // ── Styles ────────────────────────────────────────────────────────────────
  const fieldStyle = {
    width: '100%',
    height: 38,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 12px',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontSize: 13,
    color: 'var(--foreground-muted)',
    display: 'block',
    marginBottom: 4,
  }
  const sectionStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    marginBottom: 20,
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)', maxWidth: 960, margin: '0 auto' }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            {isEdit ? `Edit Order · ${editingOrder.code}` : 'New Sales Order'}
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            {isEdit
              ? 'Update the order details below'
              : 'Fill in the order details and add line items'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            height: 38,
            padding: '0 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--foreground)',
          }}
        >
          ← Back
        </button>
      </div>

      {/* ── Section 1: Order Info ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 20,
            color: 'var(--foreground)',
          }}
        >
          Order Info
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Type
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'offline' | 'online')}
              style={fieldStyle}
            >
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Sales Channel
            </label>
            <select
              value={salesChannelId ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value)
                setSalesChannelId(v > 0 ? v : undefined)
              }}
              style={fieldStyle}
            >
              <option value={0}>No Sales Channel</option>
              {salesChannels.map((sc: any) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Status
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'pending' | 'final')}
              style={fieldStyle}
            >
              <option value="pending">Pending</option>
              <option value="final">Final</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Settlement Status</label>
            <select
              value={settlementStatus}
              onChange={(e) =>
                setSettlementStatus(
                  e.target.value as 'pending' | 'credit' | 'settled' | 'cancelled'
                )
              }
              style={fieldStyle}
            >
              <option value="pending">Pending</option>
              <option value="credit">Credit</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {settlementStatus === 'credit' && (
            <div
              style={{
                gridColumn: 'span 3',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <label
                style={{
                  ...labelStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                Credit User
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--foreground-subtle)',
                  marginBottom: 2,
                }}
              >
                Select the user whose credit will be used
              </span>
              <SearchableSelect
                value={creditById ?? 0}
                onChange={(v) => setCreditById(v > 0 ? v : undefined)}
                options={[
                  { value: 0, label: 'Select user...' },
                  ...creditUsers.map((u: any) => ({
                    value: u.id as number,
                    label: (u.name as string) ?? '',
                    sublabel: u.credit
                      ? 'Credit: Rp ' +
                      Number(u.credit ?? 0).toLocaleString('id-ID')
                      : 'No credit set',
                  })),
                ]}
                placeholder="Search user..."
                searchPlaceholder="Search users..."
              />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--warning)',
                  display: 'block',
                  marginTop: 4,
                }}
              >
                ⚠ To apply credit, also record a payment using the &apos;Credit&apos; payment method after saving.
              </span>
            </div>
          )}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Order Date
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Fulfillment Date
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              type="date"
              value={fulfillmentDate}
              onChange={(e) => setFulfillmentDate(e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Discount (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              value={formatNumber(discountPrice, getCanReadPrice())}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '')
                setDiscountPrice(raw === '' ? 0 : parseInt(raw, 10) || 0)
              }}
              style={fieldStyle}
            />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ ...fieldStyle, height: 'auto', padding: '8px 12px', resize: 'none' }}
          />
        </div>
      </div>

      {/* ── Section 2: Customer ── */}
      <div style={sectionStyle}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 20,
            color: 'var(--foreground)',
          }}
        >
          Customer
        </h2>
        <div style={{ position: 'relative', marginBottom: customerId ? 0 : 16 }}>
          <label style={labelStyle}>Search Customer (optional)</label>
          <input
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value)
              setShowCustomerDrop(true)
              if (!e.target.value) setCustomerId(null)
            }}
            onFocus={() => setShowCustomerDrop(true)}
            placeholder="Type to search registered customers..."
            style={fieldStyle}
          />
          {showCustomerDrop && customers.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 30,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {customers.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setCustomerId(c.id)
                    setCustomerSearch(c.name)
                    setShowCustomerDrop(false)
                  }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 14,
                    background: 'var(--surface)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                >
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  {c.phone && (
                    <span style={{ color: 'var(--foreground-muted)', marginLeft: 8, fontSize: 12 }}>
                      {c.phone}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {customerId && (
            <button
              type="button"
              onClick={() => {
                setCustomerId(null)
                setCustomerSearch('')
              }}
              style={{
                position: 'absolute',
                right: 10,
                top: 30,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--foreground-muted)',
                fontSize: 18,
              }}
            >
              ×
            </button>
          )}
        </div>
        {!customerId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Guest Name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in customer name"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Guest Phone</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
                style={fieldStyle}
              />
            </div>
          </div>
        )}
      </div>


      {/* ── Section 2b: Inter-branch / PO Reference ── */}
      <div style={sectionStyle}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 20,
            color: 'var(--foreground)',
          }}
        >
          Inter-branch / PO Reference (Optional)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Linked Purchase Order</label>
            <select
              value={purchaseOrderId ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value)
                setPurchaseOrderId(v > 0 ? v : undefined)
              }}
              style={fieldStyle}
            >
              <option value={0}>No linked PO</option>
              {purchaseOrders.map((po: any) => (
                <option key={po.id} value={po.id}>
                  {po.code ?? `PO-${po.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Buyer Branch (if inter-branch)</label>
            <select
              value={buyerBranchId ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value)
                setBuyerBranchId(v > 0 ? v : undefined)
              }}
              style={fieldStyle}
            >
              <option value={0}>No buyer branch</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.code ? ` (${b.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Line Items ── */}
      <div style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Line Items
          </h2>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowProductDrop((v) => !v)}
              style={{
                height: 36,
                padding: '0 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Add Item
            </button>
            {showProductDrop && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: 360,
                  zIndex: 30,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
                }}
              >
                {/* Tab */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  {(['products', 'bundles'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setItemTab(tab)}
                      style={{
                        flex: 1,
                        height: 38,
                        border: 'none',
                        background: 'none',
                        borderBottom:
                          itemTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                        color: itemTab === tab ? 'var(--accent)' : 'var(--foreground-muted)',
                        fontWeight: itemTab === tab ? 600 : 400,
                        fontSize: 13,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {tab === 'products' ? '🛍 Products' : '🎁 Bundles'}
                    </button>
                  ))}
                </div>
                <div style={{ padding: 10 }}>
                  <input
                    autoFocus
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={`Search ${itemTab}...`}
                    style={{ ...fieldStyle, marginBottom: 0 }}
                  />
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {itemTab === 'products' &&
                    products.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => addProduct(p)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--surface)',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--background)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = 'var(--surface)')
                        }
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, paddingRight: 8 }}>
                            {p.product_uom_batch?.product_uom?.product?.name
                              ?? p.product_uom?.product?.name
                              ?? p.code}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                            {formatCurrency(
                              type === 'online'
                                ? (p.online_price ?? p.base_price)
                                : p.base_price
                            )}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-muted)', background: 'var(--background)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            Code: {p.product_uom_batch?.product_uom?.code ?? p.product_uom?.code ?? p.code ?? '-'}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-muted)', background: 'var(--background)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            Stock: {p.stock ?? 0}
                          </span>
                          {p.product_uom_batch?.batch_code && (
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-muted)', background: 'var(--background)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                              Batch: {p.product_uom_batch.batch_code}
                            </span>
                          )}
                          {p.product_uom_batch?.expiry_date && (
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-muted)', background: 'var(--background)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                              Exp: {p.product_uom_batch.expiry_date}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  {itemTab === 'bundles' &&
                    bundles.map((b: any) => (
                      <div
                        key={b.id}
                        onClick={() => addBundle(b)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--surface)',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--background)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = 'var(--surface)')
                        }
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, paddingRight: 8 }}>{b.name}</div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                            {formatCurrency(Number(b.price))}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-muted)', background: 'var(--background)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            Code: {b.code ?? '-'}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-muted)', background: 'var(--background)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            Items: {b.details?.length ?? 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  {itemTab === 'products' && products.length === 0 && (
                    <p style={{ padding: 16, fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No products found
                    </p>
                  )}
                  {itemTab === 'bundles' && bundles.length === 0 && (
                    <p style={{ padding: 16, fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No bundles found
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Line items table */}
        {items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: 'var(--foreground-muted)',
              fontSize: 14,
            }}
          >
            No items added yet. Click &quot;+ Add Item&quot; to begin.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Item', 'Code', 'Qty', 'Unit Price', 'Status', 'Subtotal', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: 14,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.type === 'bundle' && (
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
                      )}
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: 13,
                      color: 'var(--foreground-muted)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {item.code}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(idx, 'qty', Math.max(1, Number(e.target.value)))
                      }
                      style={{
                        width: 64,
                        height: 32,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 8px',
                        fontSize: 13,
                        textAlign: 'center',
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(item.price, getCanReadPrice())}
                      disabled={!getCanReadPrice()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, '')
                        updateItem(idx, 'price', raw === '' ? 0 : parseInt(raw, 10) || 0)
                      }}
                      style={{
                        width: 110,
                        height: 32,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 8px',
                        fontSize: 13,
                        background: !getCanReadPrice() ? 'var(--surface)' : undefined,
                        cursor: !getCanReadPrice() ? 'not-allowed' : undefined,
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <select
                      value={item.status}
                      onChange={(e) => updateItem(idx, 'status', e.target.value)}
                      style={{
                        height: 32,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 8px',
                        fontSize: 12,
                        color: 'var(--foreground)',
                        background: 'var(--surface)',
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="process">Process</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <PriceDisplay amount={item.price * item.qty} />
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={{
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Additional Charges ── */}
      <div style={{ ...sectionStyle, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>
          Additional Charges
        </h3>
        {additionalCharges.map((charge, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 40px', gap: 10, marginBottom: 8, alignItems: 'start' }}>
            <input
              type="text"
              value={charge.name}
              onChange={(e) => {
                const newCharges = [...additionalCharges]
                newCharges[idx].name = e.target.value
                setAdditionalCharges(newCharges)
              }}
              placeholder="Charge Name *"
              style={fieldStyle}
            />
            <input
              type="number"
              min="0"
              value={charge.amount}
              onChange={(e) => {
                const newCharges = [...additionalCharges]
                newCharges[idx].amount = Number(e.target.value) || 0
                setAdditionalCharges(newCharges)
              }}
              placeholder="Amount *"
              style={fieldStyle}
            />
            <select
              value={charge.tax_id || ''}
              onChange={(e) => {
                const newCharges = [...additionalCharges]
                newCharges[idx].tax_id = e.target.value ? Number(e.target.value) : undefined
                setAdditionalCharges(newCharges)
              }}
              style={fieldStyle}
            >
              <option value="">No Tax</option>
              {taxes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
              ))}
            </select>
            <input
              type="text"
              value={charge.description || ''}
              onChange={(e) => {
                const newCharges = [...additionalCharges]
                newCharges[idx].description = e.target.value
                setAdditionalCharges(newCharges)
              }}
              placeholder="Optional Note"
              style={fieldStyle}
            />
            <button
              type="button"
              onClick={() => setAdditionalCharges(prev => prev.filter((_, i) => i !== idx))}
              style={{ padding: 8, background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAdditionalCharges(prev => [...prev, { name: '', amount: 0 }])}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--foreground-muted)',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 8
          }}
        >
          Add Charge
        </button>
      </div>

      {/* ── Section 4: Totals + Submit ── */}
      <div style={{ ...sectionStyle, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 320 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>Subtotal</span>
            <PriceDisplay amount={subtotal} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>Additional Charges</span>
            <PriceDisplay amount={additionalChargesTotal} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>Discount</span>
            <span style={{ color: 'var(--success)' }}>
              - <PriceDisplay amount={discountPrice} prefix="Rp " />
            </span>
          </div>
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
              <PriceDisplay amount={total} />
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                flex: 1,
                height: 44,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const missingStockItems = items.filter(i => !i.product_inventory_id && !i.bundle_id)
                if (missingStockItems.length > 0) {
                  const names = missingStockItems.map(i => i.name).join(', ')
                  toast.error(`Produk ${names} belum ada stocknya`)
                  return
                }
                mutate()
              }}
              disabled={isPending || items.length === 0}
              style={{
                flex: 1,
                height: 44,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent)',
                color: 'white',
                cursor: isPending || items.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: isPending || items.length === 0 ? 0.7 : 1,
              }}
            >
              {isPending ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
