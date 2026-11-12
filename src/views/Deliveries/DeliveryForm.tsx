'use client'

import { formatDateShort } from '@/utils/date'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { salesOrdersService } from '@/services/sales-orders.service'
import { companiesService } from '@/services/companies.service'
import { dimensionTransferRequestsService } from '@/services/dimension-transfer-requests.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import api from '@/hooks/useApi'
import { Plus, Trash2, Loader2, Save, ArrowRightLeft } from 'lucide-react'
import BackLink from '@/components/BackLink'
import SearchableSelect from '@/components/SearchableSelect'

import { getCanReadPrice } from '@/utils/price'
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import { convertUp, convertDown, type ConversionEntry } from '@/utils/unitDisplay'

const fmtQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

const formatNumber = (n: number | undefined): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!getCanReadPrice()) return '***'
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

const detailSchema = z.object({
  // Existing row id (edit only) — sent back so the backend updates the row in
  // place instead of recreating it (receipts reference delivery_detail_id).
  id: z.coerce.number().optional(),
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  product_uom_batch_id: z.coerce.number().optional(),
  purchase_order_detail_id: z.coerce.number().optional(),
  sales_order_detail_id: z.coerce.number().optional(),
  qty: z.coerce.number().min(0.001, 'Qty must be > 0'),
  price: z.coerce.number().min(0, 'Price required'),
  status: z.enum(['pending', 'packaging', 'packed']),
  description: z.string().optional(),
})

const schema = z
  .object({
    source_type: z.enum([
      'po_from_supplier',
      'po_from_branch',
      'transfer_to_branch',
      'so_to_branch',
    ]),
    target_branch_id: z.coerce.number().min(0, 'Target branch required'),
    purchase_order_id: z.coerce.number().optional(),
    sales_order_id: z.coerce.number().optional(),
    date: z.string().min(1, 'Date required'),
    // New deliveries are always created final; an edited delivery keeps its
    // stored status (a pending transfer is finalized from the detail page).
    status: z.enum(['pending', 'final']),
    description: z.string().optional(),
    source_owner_ref: z.string().min(1, 'Owner sumber wajib diisi'),
    source_stage: z.string().min(1, 'Stage sumber wajib diisi'),
    source_location_ref: z.string().optional(),
    details: z.array(detailSchema).min(1, 'At least one item required'),
  })
  .superRefine((data, ctx) => {
    if (data.source_type === 'transfer_to_branch' && !(Number(data.target_branch_id) > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['target_branch_id'],
        message: 'Target branch required',
      })
    }
    if (data.source_type !== 'po_from_supplier') {
      data.details.forEach((d, i) => {
        if (!d.product_uom_batch_id) {
          ctx.addIssue({
            code: 'custom',
            path: ['details', i, 'product_uom_batch_id'],
            message: 'Batch is required',
          })
        }
      })
    }
  })

type FormValues = z.infer<typeof schema>

interface DeliveryFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  deliveryId?: number
  prefill?: {
    source_type?:
    | 'po_from_supplier'
    | 'po_from_branch'
    | 'transfer_to_branch'
    | 'so_to_branch'
    purchase_order_id?: number
    sales_order_id?: number
    target_branch_id?: number
  }
}

export default function DeliveryForm(props: DeliveryFormProps) {

  // Per-dropdown search states — keeping them separate prevents the
  // "type in product dropdown → /v1/companies & /v1/branches get hit"
  // cross-fire that happens when one global search state is shared by all
  // SearchableSelect components and all queries.
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const productSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleProductSearchChange = React.useCallback((value: string) => {
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current)
    productSearchTimer.current = setTimeout(() => setProductSearchDebounced(value.trim()), 400)
  }, [])
  useEffect(() => () => {
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current)
  }, [])

  const [branchSearch, setBranchSearch] = useState('')
  const [branchSearchDebounced, setBranchSearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBranchSearchDebounced(branchSearch), 400)
    return () => clearTimeout(t)
  }, [branchSearch])

  const [companySearch, setCompanySearch] = useState('')
  const [companySearchDebounced, setCompanySearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setCompanySearchDebounced(companySearch), 400)
    return () => clearTimeout(t)
  }, [companySearch])

  const [poSearch, setPoSearch] = useState('')
  const [poSearchDebounced, setPoSearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setPoSearchDebounced(poSearch), 400)
    return () => clearTimeout(t)
  }, [poSearch])

  const [soSearch, setSoSearch] = useState('')
  const [soSearchDebounced, setSoSearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSoSearchDebounced(soSearch), 400)
    return () => clearTimeout(t)
  }, [soSearch])

  const { mode, initialData, deliveryId, prefill } = props
  const router = useRouter()
  const isFulfillRoute = router.pathname.startsWith('/purchase/requested-orders')
  const listHref = isFulfillRoute ? '/purchase/requested-orders' : '/transfer/deliveries'
  const listLabel = isFulfillRoute ? 'Incoming PO Requests' : 'Deliveries'
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const myBranchId = (user as any)?.branch?.id ?? (user as any)?.branch_id

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      source_type: prefill?.source_type ?? 'po_from_supplier',
      target_branch_id: prefill?.target_branch_id ?? 0,
      purchase_order_id: prefill?.purchase_order_id ?? undefined,
      sales_order_id: prefill?.sales_order_id ?? undefined,
      date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      source_owner_ref: 'GENERAL',
      source_stage: 'GENERAL',
      source_location_ref: 'GENERAL',
      details: [
        {
          product_uom_id: 0,
          product_uom_batch_id: undefined,
          purchase_order_detail_id: undefined,
          sales_order_detail_id: undefined,
          qty: 1,
          price: 0,
          status: 'packed',
          description: '',
        },
      ],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const watchSourceOwnerRef = watch('source_owner_ref')
  const watchSourceStage = watch('source_stage')

  // Outlet branch (auth/me): its stock always sits in the GENERAL owner, so
  // the consumption owner is locked to GENERAL and the stage is prefilled
  // with "finished" (create only — never overwrites a saved delivery).
  const isOutletBranch = (user as any)?.branch?.type === 'outlet'
  const didPrefillOutletStage = useRef(false)
  useEffect(() => {
    if (!isOutletBranch) return
    setValue('source_owner_ref', 'GENERAL')
    if (mode !== 'create' || didPrefillOutletStage.current) return
    didPrefillOutletStage.current = true
    setValue('source_stage', 'finished')
  }, [isOutletBranch, mode, setValue])

  const totalPrice = watchDetails.reduce(
    (sum, d) => sum + Number(d.qty ?? 0) * Number(d.price ?? 0),
    0
  )

  // Dimension transfer state
  const [enableDimensionTransfer, setEnableDimensionTransfer] = useState(false)
  const [dimTransferToOwner, setDimTransferToOwner] = useState('')
  const [dimTransferToStage, setDimTransferToStage] = useState('')
  const [dimTransferToLocation, setDimTransferToLocation] = useState('GENERAL')
  const [dimTransferDescription, setDimTransferDescription] = useState('')

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', branchSearchDebounced],
    queryFn: () => branchesService.list({ 'filter[search]': branchSearchDebounced || undefined,  per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  // Dimension picker: owner (company) + stage — source only, deliveries have
  // no output dimension.
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all', companySearchDebounced],
    queryFn: () => companiesService.list({ 'filter[search]': companySearchDebounced || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []

  // "Owner Tujuan" (dimension transfer) searches on its own so typing there
  // doesn't narrow the source-owner list, and vice versa.
  const [targetCompanySearch, setTargetCompanySearch] = useState('')
  const [targetCompanySearchDebounced, setTargetCompanySearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTargetCompanySearchDebounced(targetCompanySearch), 400)
    return () => clearTimeout(t)
  }, [targetCompanySearch])
  const { data: targetCompaniesData, isFetching: targetCompaniesLoading } = useQuery({
    queryKey: ['companies-all', targetCompanySearchDebounced],
    enabled: enableDimensionTransfer,
    placeholderData: (prev: any) => prev,
    queryFn: () => companiesService.list({ 'filter[search]': targetCompanySearchDebounced || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const targetCompanies: { id: number; name: string }[] = (targetCompaniesData as any)?.data ?? []

  // Remember every company name seen so a selected owner keeps its label
  // after the search narrows the result set.
  const companyLabelsRef = useRef(new Map<string, string>())
  for (const c of [...companies, ...targetCompanies]) companyLabelsRef.current.set(String(c.id), c.name)
  const buildCompanyOptions = (list: { id: number; name: string }[], selected?: string) => {
    const opts = [GENERAL_OWNER_OPTION, ...list.map((c) => ({ value: String(c.id), label: c.name }))]
    if (selected && !opts.some((o) => o.value === selected) && companyLabelsRef.current.has(selected)) {
      opts.push({ value: selected, label: companyLabelsRef.current.get(selected)! })
    }
    return opts
  }

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.map((s: any) => ({ value: s.code, label: s.name }))

  // When creating from a linked branch-PO (the Fulfill flow), the PO's own
  // supplier_branch_id is the actual fulfilling/source branch — it does NOT
  // necessarily equal myBranchId. A user can be assigned to more than one
  // branch (branch_ids, plural) or otherwise act on a PO that isn't
  // specifically theirs, so "whoever is fulfilling" isn't a reliable proxy
  // for "which branch this PO is being fulfilled from". Fetched as its own
  // lightweight lookup (rather than reordering the larger
  // po-detail-for-delivery query below, which doesn't request this field).
  const watchPurchaseOrderIdForSource = watch('purchase_order_id')
  const { data: poSourceBranchData, isLoading: poSourceBranchLoading } = useQuery({
    queryKey: ['po-supplier-branch-for-delivery', watchPurchaseOrderIdForSource],
    queryFn: () =>
      purchaseOrdersService
        .findById(watchPurchaseOrderIdForSource as number, { include: 'supplier_branch' })
        .then((r) => r.data),
    enabled:
      !!watchPurchaseOrderIdForSource && (watchPurchaseOrderIdForSource as number) > 0,
  })
  const poSourceBranchId =
    (poSourceBranchData as any)?.data?.supplier_branch_id ??
    (poSourceBranchData as any)?.data?.supplier_branch?.id

  // The branch stock/batches are sourced from for this delivery.
  // - Edit: the delivery's own branch_id (read off initialData, since
  //   DeliveryForm has no branch_id form field) is the real source — it may
  //   differ from whoever happens to be editing the delivery, e.g. an admin
  //   or the receiving branch's own staff. Without this, editing fell back
  //   to the editor's own branch and showed "No stock available" even when
  //   the delivery's actual source branch had plenty.
  // - Create from a linked branch-PO (Fulfill): the PO's own
  //   supplier_branch_id, per above.
  // - Any other create (manual transfer, supplier delivery, no PO yet): the
  //   creating user's own branch, since they ARE the source.
  const sourceBranchId =
    mode === 'edit'
      ? (initialData?.branch_id ?? myBranchId)
      : (poSourceBranchId ?? myBranchId)

  // Source-branch inventory — the batch picker must show only batches that
  // actually have stock at the supplying branch, with the REAL per-branch
  // quantity (not the global batch stock). Per-branch stock lives in
  // product_inventory, so we source the picker from there.
  //
  // Instead of loading EVERY inventory row for the branch (page-loop with
  // per_page=100), use filter[product_ids] (OpenAPI: plural) to fetch
  // only inventories for the products currently on form lines.
  const lineProductUomIds = useMemo(() => {
    const ids = new Set<number>()
    for (const d of watchDetails ?? []) {
      const id = d?.product_uom_id
      if (typeof id === 'number' && id > 0) ids.add(id)
    }
    return Array.from(ids)
  }, [watchDetails])

  // Resolve product_uom_ids → product_ids via a lightweight product_uoms fetch
  const { data: linePuomsData } = useQuery({
    queryKey: ['line-product-uoms-for-inv', lineProductUomIds.slice().sort((a, b) => a - b).join(',')],
    enabled: lineProductUomIds.length > 0,
    placeholderData: (prev: any) => prev,
    staleTime: 60_000,
    queryFn: () =>
      productUomsService
        .list({
          'filter[ids]': lineProductUomIds.join(','),
          include: 'product,uom',
          per_page: lineProductUomIds.length,
        } as any)
        .then((r) => r.data),
  })
  const lineProductIds = useMemo(() => {
    const puoms: any[] = (linePuomsData as any)?.data ?? []
    const ids = new Set<number>()
    for (const pu of puoms) {
      const pid = pu?.product_id ?? pu?.product?.id
      if (typeof pid === 'number' && pid > 0) ids.add(pid)
    }
    return Array.from(ids)
  }, [linePuomsData])

  const { data: inventoryData, isLoading: inventoryLoading, isFetching: inventoryFetching, isFetched: inventoryFetched } = useQuery({
    queryKey: ['source-branch-inventory', sourceBranchId, lineProductIds.slice().sort((a, b) => a - b).join(','), watchSourceOwnerRef, watchSourceStage],
    enabled: !!sourceBranchId && lineProductIds.length > 0,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          'filter[product_ids]': lineProductIds.join(','),
          'filter[branch_id]': sourceBranchId,
          'filter[owner_ref]': watchSourceOwnerRef || undefined,
          'filter[stage]': watchSourceStage || undefined,
          include: 'product_uom_batch,product_uom_batch.product_uom',
        } as any)
        .then((r) => r.data),
  })
  const sourceInventory: any[] = useMemo(() => (inventoryData as any)?.data ?? [], [inventoryData])

  // Available qty shown in the batch picker must be in the LINE's own uom
  // (e.g. "240 PACK"), but the matched batch row is the BASE-uom row (e.g.
  // GR) — its display_qty/base_stock are in the base uom, not the line's.
  // The backend now accepts display_in_product_uom_id on this same
  // endpoint and returns converted_qty/converted_uom_code per row. A
  // single fetch can only carry one target uom, and different lines can
  // use different uoms, so — rather than one fetch per line (N+1) or one
  // fetch per render — we fetch once per DISTINCT uom actually present
  // across the form's lines (deduped), and only refetch when that set of
  // uoms changes. Each fetch still covers the whole branch (like
  // sourceInventory above), so results are merged back onto the matching
  // rows by product_inventory id.
  // Batches already committed to this delivery's lines when it was
  // created — a delivery ALREADY shipped a specific batch, so editing must
  // show that stored batch regardless of current live stock (its stock may
  // since be fully consumed, which is normal for a fulfilled shipment).
  // Mirrors the product-option seeding fix (5524569): seed from the stored
  // nested product_uom_batch object rather than depending on a requery.
  const storedBatchesByUomId = new Map<
    number,
    { batchId: number; code?: string; expiry_date?: string }[]
  >()
  if (mode === 'edit') {
    ;(initialData?.details ?? []).forEach((d: any) => {
      const pub = d.product_uom_batch
      if (!pub?.id || !d.product_uom_id) return
      const list = storedBatchesByUomId.get(d.product_uom_id) ?? []
      list.push({
        batchId: pub.id,
        code: pub.batch_code ?? pub.code,
        expiry_date: pub.expiry_date,
      })
      storedBatchesByUomId.set(d.product_uom_id, list)
    })
  }

  // Batch options for a line's product UOM: batches with stock > 0 at the
  // source branch (real per-branch quantity), merged with this delivery's
  // own already-committed batches so a stored batch always has a matching
  // option to display even when it's no longer in live stock. Live-stock
  // data wins when the same batch appears in both.
  //
  // product_id resolution uses scalar FKs + puomToProduct map instead of
  // relying on nested includes (product_uom_batch.product_uom.product.id
  // can be null when the include is missing).
  // Cache of computed batch options per product uom. Rebuilt only when the
  // underlying data changes (see batchOptionsCache below) — with ~100 rows
  // the old per-render full scan of sourceInventory froze the page.
  const batchOptionsCacheRef = useRef<Map<number, any[]>>(new Map())
  const getBatchOptionsForUom = (productUomId: number): any[] => {
    const cached = batchOptionsCacheRef.current.get(productUomId)
    if (cached) return cached
    const result = computeBatchOptionsForUom(productUomId)
    batchOptionsCacheRef.current.set(productUomId, result)
    return result
  }

  const computeBatchOptionsForUom = (productUomId: number) => {
    const lineProductId = puomToProduct.get(productUomId)

    const stockBatches = sourceInventory
      .filter((inv: any) => {
        const hasBatch = !!inv.product_uom_batch?.id
        if (!hasBatch) return false

        // Match by product_uom_id first (scalar FK on inventory or batch)
        const invUomId =
          inv.product_uom_id ??
          inv.product_uom_batch?.product_uom_id ??
          inv.product_uom_batch?.product_uom?.id
        if (invUomId === productUomId) {
          const stock = inv.display_qty ?? inv.stock ?? inv.qty ?? 0
          return stock > 0
        }

        // Fallback: match by product_id when scalar UOM IDs differ
        // (stock lives on the base-uom batch, not the line's own uom).
        // Resolve the batch row's product_id from its own nested product_uom
        // first (the API nests it), only then via the puomToProduct map.
        if (lineProductId != null) {
          const batchPu =
            inv.product_uom_batch?.product_uom ??
            null
          const batchPuomId =
            inv.product_uom_batch?.product_uom_id ??
            batchPu?.id
          const invProductId =
            batchPu?.product_id ??
            batchPu?.product?.id ??
            (batchPuomId ? puomToProduct.get(batchPuomId) : undefined)
          if (invProductId === lineProductId) {
            const stock = inv.display_qty ?? inv.stock ?? inv.qty ?? 0
            return stock > 0
          }
        }

        return false
      })
      .map((inv: any) => {
        const rawStock = Number(inv.display_qty ?? inv.stock ?? inv.qty ?? 0)
        const baseStock = inv.base_stock !== undefined && inv.base_stock !== null ? Number(inv.base_stock) : undefined
        const baseUom: string =
          inv.base_uom_code ??
          inv.product_uom_batch?.product_uom?.uom?.code ??
          ''
        const line = lineUomInfo(productUomId)
        // Convert base stock -> line uom; null when the chain can't reach it.
        const converted =
          baseStock !== undefined && baseUom && line.code
            ? convertUp(baseStock, baseUom, line.code, line.conversions)
            : null
        return {
          batchId: inv.product_uom_batch.id as number,
          code: (inv.product_uom_batch.batch_code || inv.product_uom_batch.code) as string | undefined,
          expiry_date: inv.product_uom_batch.expiry_date as string | undefined,
          stock: converted ?? (baseStock ?? rawStock),
          unit: converted !== null ? line.code : baseUom || undefined,
          baseStock,
          baseUom: baseUom || undefined,
        }
      })

    const stored = storedBatchesByUomId.get(productUomId) ?? []
    const merged = new Map<number, { batchId: number; code?: string; expiry_date?: string; stock?: number; unit?: string; baseStock?: number; baseUom?: string }>()
    for (const b of stored) merged.set(b.batchId, { ...b, stock: undefined })
    for (const b of stockBatches) merged.set(b.batchId, { ...merged.get(b.batchId), ...b })

    return Array.from(merged.values())
  }

  const sourceTypeForPickers = watch('source_type')
  const purchaseOrderOpts = useInfiniteOptions<any>({
    queryKey: ['purchase-orders-linkable', poSearchDebounced],
    enabled:
      sourceTypeForPickers === 'po_from_supplier' || sourceTypeForPickers === 'po_from_branch',
    staleTime: 60_000,
    fetchPage: (page) =>
      purchaseOrdersService
        .list({
          page,
          'filter[search]': poSearchDebounced || undefined,
          per_page: 50,
          include: 'supplier,supplier_branch',
          sort: '-id',
        } as any)
        .then((r) => r.data),
  })
  const allPurchaseOrders: any[] = purchaseOrderOpts.items
  const purchaseOrders = allPurchaseOrders
    .filter((po: any) => ['accepted', 'final'].includes(po?.status))
    .sort((a: any, b: any) => b.id - a.id)

  const { data: salesOrdersData, isLoading: salesOrdersLoading } = useQuery({
    queryKey: ['sales-orders-pending', soSearchDebounced],
    enabled: sourceTypeForPickers === 'so_to_branch',
    staleTime: 60_000,
    queryFn: () =>
      salesOrdersService
        .list({
          'filter[search]': soSearchDebounced || undefined,
          per_page: 1000,
          'filter[status]': 'final',
          'filter[has_delivery]': 'false',
        } as any)
        .then((r) => r.data),
  })
  const salesOrders = (salesOrdersData as any)?.data ?? []

  const watchPurchaseOrderId = watch('purchase_order_id')
  const watchSalesOrderId = watch('sales_order_id')
  const watchSourceType = watch('source_type')

  useEffect(() => {
    if (watchSourceType === 'po_from_supplier' && myBranchId) {
      setValue('target_branch_id', myBranchId)
    }
  }, [watchSourceType, myBranchId, setValue])

  // Internal-branch deliveries/transfers are price-free — hide all price UI
  // and don't submit computed prices. Supplier/SO deliveries keep price.
  const isInternal =
    watchSourceType === 'po_from_branch' ||
    watchSourceType === 'transfer_to_branch'

  const showLinkedPO =
    watchSourceType === 'po_from_supplier' || watchSourceType === 'po_from_branch'
  const showLinkedSO = watchSourceType === 'so_to_branch'

  // Track whether the linked order's line items have been loaded into the
  // form. Without this, the batch selector flashes "No stock" between the
  // PO/SO query finishing and the form's replace() taking effect.
  const hasLinkedOrder = !!(prefill?.purchase_order_id || prefill?.sales_order_id)
  const [linkedOrderFormReady, setLinkedOrderFormReady] = useState(!hasLinkedOrder)
  const targetBranchReadonly =
    watchSourceType === 'po_from_supplier' ||
    watchSourceType === 'po_from_branch' ||
    watchSourceType === 'so_to_branch'
  const requiresBatch = watchSourceType !== 'po_from_supplier'

  const { data: poData } = useQuery({
    queryKey: ['po-detail-for-delivery', watchPurchaseOrderId],
    queryFn: () =>
      purchaseOrdersService
        .findById(watchPurchaseOrderId as number, {
          include: 'supplier,supplier_branch,purchase_order_details,purchase_order_details.product_uom',
        })
        .then((r) => r.data),
    enabled: !!watchPurchaseOrderId && (watchPurchaseOrderId as number) > 0,
  })
  const poDetail = (poData as any)?.data

  const { data: soData } = useQuery({
    queryKey: ['so-detail-for-delivery', watchSalesOrderId],
    queryFn: () =>
      salesOrdersService
        .findById(watchSalesOrderId as number, {
          include: 'buyer_branch,sales_order_details',
        })
        .then((r) => r.data),
    enabled: !!watchSalesOrderId && (watchSalesOrderId as number) > 0,
  })
  const soDetail = (soData as any)?.data

  // Targeted fetch via the new `filter[ids]` when a PO/SO is linked —
  // replaces the previous 10x page-loop by resolving every product_uom
  // referenced by the already-loaded PO/SO details in a single call.
  const linkedProductUomIds = useMemo(() => {
    const ids = new Set<number>()
    const collect = (details: any[] | undefined) => {
      if (!Array.isArray(details)) return
      for (const d of details) {
      const id = d?.product_uom_id
        if (typeof id === 'number' && id > 0) ids.add(id)
      }
    }
    collect(poDetail?.purchase_order_details)
    collect(soDetail?.sales_order_details)
    return Array.from(ids)
  }, [poDetail?.id, soDetail?.id])

  // Dropdown options for product picker — always fetched so user can search
  // and add products whether creating manually or fulfilling from a PO/SO.
  // (Earlier this was gated on `linkedProductUomIds.length === 0`, which
  // disabled the search during the Fulfill flow even though users still
  // needed to look up additional items beyond the PO's pre-filled list.)
  const productUomOpts = useInfiniteOptions<any>({
    queryKey: ['product-uoms-all', productSearchDebounced],
    staleTime: 60_000,
    fetchPage: (page) =>
      productUomsService
        .list({
          page,
          'filter[search]': productSearchDebounced || undefined,
          per_page: 100,
          include: 'product,uom',
          'filter[is_active]': true,
        } as any)
        .then((r) => r.data),
  })

  const { data: linkedProductUomsData } = useQuery({
    queryKey: ['product-uoms-by-ids', linkedProductUomIds.slice().sort((a, b) => a - b).join(',')],
    enabled: linkedProductUomIds.length > 0,
    queryFn: () =>
      productUomsService
        .list({
          'filter[ids]': linkedProductUomIds.join(','),
          include: 'product,uom',
          per_page: linkedProductUomIds.length,
        } as any)
        .then((r) => r.data),
  })

  const linkedProductUoms: any[] = useMemo(() => (linkedProductUomsData as any)?.data ?? [], [linkedProductUomsData])
  // Keyed on the query data so the flattened list keeps a stable identity between renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dropdownProductUoms: any[] = useMemo(() => productUomOpts.items, [productUomOpts.data])
  // Loading = either query is still resolving. Both run in parallel.
  const productUomsLoading =
    (linkedProductUomIds.length > 0 && linkedProductUomsData === undefined) ||
    productUomOpts.data === undefined

  // Merge for the puomToProduct lookup + dropdown options
  const lineProductUoms: any[] = useMemo(() => (linePuomsData as any)?.data ?? [], [linePuomsData])
  const productUoms = useMemo(() => {
    const map = new Map<number, any>()
    for (const pu of linkedProductUoms) {
      if (pu?.id && !map.has(pu.id)) map.set(pu.id, pu)
    }
    for (const pu of lineProductUoms) {
      if (pu?.id && !map.has(pu.id)) map.set(pu.id, pu)
    }
    for (const pu of dropdownProductUoms) {
      if (pu?.id && !map.has(pu.id)) map.set(pu.id, pu)
    }
    return Array.from(map.values())
  }, [linkedProductUoms, dropdownProductUoms, lineProductUoms])

  // Authoritative lookup: product_uom_id -> product_id, built from the
  // productUoms list which is already loaded with include 'product,uom'.
  // This avoids relying on fragile 3-level nested includes on inventory rows.
  //
  // Also enrich from source-branch inventory rows: the batch's product_uom
  // (e.g. the base-uom SKU like "xxx-GR") may not be in the product-uoms
  // dropdown page at all (pagination / active search replacing the list),
  // which made the product_id fallback miss real batches → "No stock".
  // Each inventory row carries product_uom_batch.product_uom(.product_id).
  const puomToProduct = useMemo(() => {
    const map = new Map<number, number>()
    for (const pu of productUoms) {
      if (pu?.id && (pu.product_id ?? pu.product?.id)) {
        map.set(pu.id, pu.product_id ?? pu.product.id)
      }
    }
    for (const inv of sourceInventory) {
      const pub = (inv as any)?.product_uom_batch
      const puId = pub?.product_uom_id ?? pub?.product_uom?.id
      const pid = pub?.product_uom?.product_id ?? pub?.product_uom?.product?.id
      if (puId && pid && !map.has(Number(puId))) {
        map.set(Number(puId), Number(pid))
      }
    }
    return map
  }, [productUoms, sourceInventory])

  // product_uom_id -> product uom (with product.conversions + uom), used to
  // show batch stock in the LINE's unit (e.g. 20.420 GR -> 9 CAN), the same
  // way the Product Inventory page converts base stock.
  const productUomById = useMemo(() => {
    const map = new Map<number, any>()
    for (const pu of productUoms) if (pu?.id) map.set(Number(pu.id), pu)
    return map
  }, [productUoms])

  // Reset the batch-options cache during render when any input changes, so
  // the first lookup after a change recomputes with fresh data.
  const batchCacheDeps = useRef<unknown[]>([])
  {
    const deps = [sourceInventory, puomToProduct, productUomById, initialData, mode]
    if (deps.some((d, i) => d !== batchCacheDeps.current[i])) {
      batchCacheDeps.current = deps
      batchOptionsCacheRef.current = new Map()
    }
  }

  const lineUomInfo = (productUomId: number) => {
    const pu = productUomById.get(Number(productUomId))
    return {
      code: (pu?.uom?.code ?? '') as string,
      conversions: (pu?.product?.conversions ?? undefined) as ConversionEntry[] | undefined,
    }
  }

  useEffect(() => {
    if (!poDetail?.purchase_order_details?.length) return
    // Editing: the saved lines (with their ids/batches) are already loaded —
    // never replace them with the linked PO's lines.
    if (mode === 'edit' && Number(watchPurchaseOrderId) === Number(initialData?.purchase_order_id)) return

    // source_type must match the PO's own type — a branch PO needs
    // po_from_branch, not po_from_supplier, or the backend wrongly demands
    // a supplier_id that doesn't apply to it.
    const derivedSourceType = poDetail?.type === 'branch' ? 'po_from_branch' : 'po_from_supplier'
    setValue('source_type', derivedSourceType)

    // purchase_order_details rows don't reliably carry a flat product_uom_id
    // FK — fall back to the nested product_uom.id (requested via the
    // purchase_order_details.product_uom include above), same as
    // PurchaseOrderEdit's initialData mapping. Without this every row
    // resolved to product_uom_id: 0, so the product dropdown showed
    // "Select product..." and, since the batch picker is keyed off the
    // selected product_uom_id, its options list was empty too.
    const isBatchRequired = derivedSourceType !== 'po_from_supplier'
    // Follow-up deliveries: only what is still left to deliver on each line;
    // fully delivered lines are skipped.
    const remainingQty = (d: any) =>
      d.remaining_qty != null
        ? Number(d.remaining_qty)
        : Number(d.qty ?? 0) - Number(d.delivered_qty ?? 0)
    const openLines = poDetail.purchase_order_details.filter((d: any) => remainingQty(d) > 0)
    if (!openLines.length) {
      toast.info('All Purchase Order lines are already delivered')
      setTimeout(() => setLinkedOrderFormReady(true), 0)
      return
    }
    const newDetails = openLines.map((d: any) => {
      const uomId = d.product_uom_id ?? d.product_uom?.id ?? 0
      const batches = isBatchRequired ? getBatchOptionsForUom(uomId) : []
      return {
        product_uom_id: uomId,
        product_uom_batch_id: batches.length === 1 ? batches[0].batchId : undefined,
        purchase_order_detail_id: d.id,
        sales_order_detail_id: undefined,
        qty: remainingQty(d),
        price: d.price ?? d.product_uom?.franchise_price ?? 0,
        status: 'packed' as const,
        description: d.description ?? '',
      }
    })

    replace(newDetails)
    // Mark form as ready AFTER replace() so the batch selector doesn't
    // flash "No stock" before the form values are actually set. Using
    // setTimeout(0) ensures React has flushed the replace() and painted.
    setTimeout(() => {
      setLinkedOrderFormReady(true)
    }, 0)

    if (
      (watchSourceType === 'po_from_supplier' ||
        watchSourceType === 'po_from_branch') &&
      poDetail?.branch_id
    ) {
      setValue('target_branch_id', poDetail.branch_id)
    }

    // Carry the PO's own note across as the delivery note. Without this the
    // header description stayed empty and the printed Surat Jalan had no
    // "Catatan" line, even though the operator had already written it on the
    // PO. Never clobber text the user typed themselves.
    if (poDetail?.description && !getValues('description')) {
      setValue('description', poDetail.description)
    }

    toast.info('Line items loaded from Purchase Order')
  }, [poDetail?.id])

  useEffect(() => {
    if (!soDetail) return
    if (mode === 'edit' && Number(watchSalesOrderId) === Number(initialData?.sales_order_id)) return

    if (soDetail.buyer_branch_id) {
      setValue('target_branch_id', soDetail.buyer_branch_id)
    }

    if (soDetail.sales_order_details?.length) {
      const newDetails = soDetail.sales_order_details.map((d: any) => {
        const uomId = d.product_uom_id ?? 0
        const batches = requiresBatch ? getBatchOptionsForUom(uomId) : []
        return {
          product_uom_id: uomId,
          product_uom_batch_id: batches.length === 1 ? batches[0].batchId : undefined,
          purchase_order_detail_id: undefined,
          sales_order_detail_id: d.id,
          qty: d.qty ?? 1,
          price: d.price ?? 0,
          status: 'packed' as const,
          description: d.description ?? '',
        }
      })
      replace(newDetails)
      setTimeout(() => setLinkedOrderFormReady(true), 0)

      // Same as the PO path: reuse the SO's note as the delivery note, but
      // never overwrite something the user already typed.
      if (soDetail?.description && !getValues('description')) {
        setValue('description', soDetail.description)
      }

      toast.info('Items loaded from Sales Order')
    }
  }, [soDetail?.id])

  useEffect(() => {
    if (!showLinkedPO) {
      setValue('purchase_order_id', undefined)
    }
    setLinkedOrderFormReady(false)
  }, [showLinkedPO, watchPurchaseOrderId])

  useEffect(() => {
    if (!showLinkedSO) {
      setValue('sales_order_id', undefined)
    }
    // No linked order → form is immediately ready
    if (!showLinkedPO && !showLinkedSO) {
      setLinkedOrderFormReady(true)
    }
  }, [showLinkedSO])

  // Auto-select batch if a line has product_uom_id set and there is exactly 1
  // available batch for that UOM. If there are >1 batches, do not auto-select
  // (leave undefined) so user selects manually.
  useEffect(() => {
    if (!requiresBatch || !sourceInventory.length) return
    const currentDetails = getValues('details') || []
    currentDetails.forEach((d, idx) => {
      if (d.product_uom_id) {
        const batches = getBatchOptionsForUom(Number(d.product_uom_id))
        const batchStillValid = batches.some((b) => b.batchId === d.product_uom_batch_id)
        if (!d.product_uom_batch_id || !batchStillValid) {
          if (batches.length === 1) {
            setValue(`details.${idx}.product_uom_batch_id`, batches[0].batchId, {
              shouldValidate: true,
            })
          } else if (!batchStillValid && d.product_uom_batch_id) {
            setValue(`details.${idx}.product_uom_batch_id`, undefined, {
              shouldValidate: true,
            })
          }
        }
      }
    })
  }, [sourceInventory, requiresBatch, puomToProduct])

  const branchOptions = branches.map((b: any) => ({
    value: b.id as number,
    label: (b.name as string) ?? `Branch #${b.id}`,
    sublabel: b.code as string | undefined,
  }))
  const toProductUomOption = (pu: any) => ({
    value: pu.id as number,
    label: withProductType(getProductUomName(pu), pu.product?.type),
    sublabel: (pu.uom?.name as string) ?? '',
    description: (pu.code as string) ?? undefined,
    base_price: pu.base_price ?? 0,
  })
  // The paginated product-uoms query may not (yet, or ever, if a page
  // request fails) contain the products a linked PO/SO already loaded into
  // the delivery-item rows — SearchableSelect can only show a selected
  // value's label if a matching option exists, so seed extra options
  // straight from the PO/SO detail's own nested product_uom object. That
  // way the pre-filled rows always display regardless of what the
  // paginated list returned.
  const poProductUoms = (poDetail?.purchase_order_details ?? [])
    .map((d: any) => d.product_uom)
    .filter(Boolean)
  const soProductUoms = (soDetail?.sales_order_details ?? [])
    .map((d: any) => d.product_uom)
    .filter(Boolean)
  const productUomOptions = useMemo(() => {
    const map = new Map<number, ReturnType<typeof toProductUomOption>>()
    ;[...productUoms, ...poProductUoms, ...soProductUoms].forEach((pu: any) => {
      if (pu?.id && !map.has(pu.id)) map.set(pu.id, toProductUomOption(pu))
    })
    return Array.from(map.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productUoms, poDetail, soDetail])
  // The selected PO stays listed even when the current search result set
  // doesn't contain it (poDetail is fetched by id).
  const purchaseOrderOptions = [
    { value: 0, label: 'No linked PO' },
    ...[
      ...(poDetail && !purchaseOrders.some((po: any) => po.id === poDetail.id) ? [poDetail] : []),
      ...purchaseOrders,
    ].map((po: any) => ({
      value: po.id as number,
      label: `${po.code ?? `PO-${po.id}`} - ${po.supplier?.name ?? po.supplier_branch?.name ?? 'Internal / No Supplier'}`,
      sublabel: po.date ? po.date : undefined,
    })),
  ]
  const salesOrderOptions = [
    { value: 0, label: 'No linked SO' },
    ...salesOrders.map((so: any) => ({
      value: so.id as number,
      label: so.code ?? `SO-${so.id}`,
      sublabel: undefined,
    })),
  ]
  const sourceTypeOptions = [
    { value: 'po_from_supplier', label: 'PO from Supplier' },
    { value: 'po_from_branch', label: 'PO from Branch' },
    { value: 'transfer_to_branch', label: 'Transfer to Branch' },
    { value: 'so_to_branch', label: 'SO to Branch' },
  ] as const

  useEffect(() => {
    if (initialData && mode === 'edit') {
      reset({
        source_owner_ref: 'GENERAL',
        source_stage: 'GENERAL',
        source_location_ref: 'GENERAL',
        ...initialData,
      })
    }
  }, [initialData, mode])

  const buildPayload = (values: FormValues) => ({
    ...values,
    status: mode === 'edit' ? values.status : 'final',
    // Internal deliveries/transfers are price-free — never submit prices.
    total_price: totalPrice,
    purchase_order_id: values.purchase_order_id || undefined,
    sales_order_id: values.sales_order_id || undefined,
    source_owner_ref: values.source_owner_ref,
    source_stage: values.source_stage,
    source_location_ref: values.source_location_ref || 'GENERAL',
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        id: mode === 'edit' ? d.id || undefined : undefined,
        product_uom_id: d.product_uom_id,
        product_uom_batch_id:
          watchSourceType !== 'po_from_supplier'
            ? d.product_uom_batch_id || undefined
            : undefined,
        purchase_order_detail_id: d.purchase_order_detail_id || undefined,
        sales_order_detail_id: d.sales_order_detail_id || undefined,
        qty: d.qty,
        price: d.price,
        status: d.status,
        description: d.description || undefined,
      })),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      deliveriesService.create(buildPayload(values) as any),
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })

      // Create dimension transfer requests if enabled
      if (enableDimensionTransfer && dimTransferToOwner && dimTransferToStage) {
        const details = getValues('details')
        const sourceOwner = getValues('source_owner_ref')
        const sourceStage = getValues('source_stage')
        const sourceLocation = getValues('source_location_ref') || 'GENERAL'
        const branchId = myBranchId

        if (branchId && details?.length > 0) {
          let transferCount = 0
          for (const d of details) {
            if (!d.product_uom_batch_id || !d.qty) continue
            try {
              await dimensionTransferRequestsService.create({
                branch_id: branchId,
                product_uom_batch_id: d.product_uom_batch_id,
                qty: d.qty,
                from: { owner_ref: sourceOwner, stage: sourceStage, location_ref: sourceLocation },
                to: { owner_ref: dimTransferToOwner, stage: dimTransferToStage, location_ref: dimTransferToLocation || 'GENERAL' },
                description: dimTransferDescription || `Dimension transfer dari delivery`,
              })
              transferCount++
            } catch (e) {
              console.error('Dimension transfer request failed for item', d.product_uom_batch_id, e)
            }
          }
          if (transferCount > 0) {
            queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
            toast.success(`${transferCount} permintaan transfer dimensi diajukan`)
          }
        }
      }

      toast.success('Delivery created')
      router.push('/transfer/deliveries')
    },
    onError: (err: any) => {
      console.log('createMutation error', err)
      toastMutationApiError(err, 'Failed to create delivery')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      deliveriesService.update(deliveryId!, buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.removeQueries({ queryKey: ['delivery-detail', deliveryId] })
      toast.success('Delivery updated')
      router.push(`/transfer/deliveries/${deliveryId}/detail`)
    },
    onError: (err: any) => {
      console.log('updateMutation error', err)
      toastMutationApiError(err, 'Failed to update delivery')
    },
  })

  // Frontend stock check (create only — an edited delivery already holds its
  // own stock). Lines sharing a batch are summed in the base unit, so two
  // lines of 5 CAN against a 9 CAN batch are caught too. The server still
  // validates; this only stops an obviously short delivery before submitting.
  const getStockShortages = (details: FormValues['details']) => {
    const shortages = new Map<number, string>()
    if (mode !== 'create' || !requiresBatch) return shortages

    const perBatch = new Map<number, { need: number; available: number; baseUom: string; lines: number[] }>()
    details.forEach((d, i) => {
      const batchId = Number(d?.product_uom_batch_id ?? 0)
      const qty = Number(d?.qty ?? 0)
      if (!batchId || !(qty > 0) || !d?.product_uom_id) return
      const batch: any = getBatchOptionsForUom(Number(d.product_uom_id)).find((b: any) => b.batchId === batchId)
      if (!batch) return

      if (batch.baseStock !== undefined && batch.baseUom) {
        const line = lineUomInfo(Number(d.product_uom_id))
        const needBase = line.code ? convertDown(qty, line.code, batch.baseUom, line.conversions) : null
        if (needBase === null) {
          // Can't reach the base unit — compare in the line's unit directly.
          if (batch.unit && batch.unit === line.code && qty > batch.stock) {
            shortages.set(i, `Stok tidak cukup — tersedia ${fmtQty(batch.stock)} ${batch.unit}`)
          }
          return
        }
        const agg = perBatch.get(batchId) ?? { need: 0, available: batch.baseStock, baseUom: batch.baseUom, lines: [] as number[] }
        agg.need += needBase
        agg.lines.push(i)
        perBatch.set(batchId, agg)
        return
      }

      if (batch.stock !== undefined && qty > batch.stock) {
        shortages.set(i, `Stok tidak cukup — tersedia ${fmtQty(batch.stock)}${batch.unit ? ` ${batch.unit}` : ''}`)
      }
    })

    for (const agg of perBatch.values()) {
      // Small tolerance for float conversion noise.
      if (agg.need <= agg.available + 1e-6) continue
      for (const i of agg.lines) {
        const d = details[i]
        const batch: any = getBatchOptionsForUom(Number(d.product_uom_id)).find(
          (b: any) => b.batchId === Number(d.product_uom_batch_id),
        )
        const shared = agg.lines.length > 1 ? ' (batch dipakai di beberapa baris)' : ''
        shortages.set(
          i,
          `Stok tidak cukup — tersedia ${fmtQty(batch?.stock ?? 0)}${batch?.unit ? ` ${batch.unit}` : ''}${shared}`,
        )
      }
    }
    return shortages
  }

  const stockShortages = getStockShortages(watchDetails ?? [])

  const onSubmit = (values: FormValues) => {
    const shortages = getStockShortages(values.details)
    if (shortages.size > 0) {
      shortages.forEach((message, i) => {
        setError(`details.${i}.qty` as any, { type: 'stock', message })
      })
      const rows = Array.from(shortages.keys()).map((i) => i + 1).join(', ')
      toast.error(`Stok tidak cukup pada baris ${rows}. Kurangi qty atau pilih batch lain.`)
      scrollToRowField('qty', Math.min(...Array.from(shortages.keys())))
      return
    }
    console.log('DeliveryForm onSubmit called', { ...values, total_price: totalPrice })
    if (mode === 'edit' && deliveryId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  // Bring a problem row into view and focus its control, so the user sees
  // why the delivery can't be created (rows can be far down a long list).
  const scrollToRowField = (field: 'batch' | 'qty', index: number) => {
    const el = document.querySelector<HTMLElement>(`[data-${field}-row="${index}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => el.focus({ preventScroll: true }), 300)
  }

  // Add Item button + Ctrl+B / Cmd+B shortcut: append a row and bring it into view.
  const handleAddItem = () => {
    const newIndex = fields.length
    append({
      product_uom_id: 0,
      product_uom_batch_id: undefined,
      purchase_order_detail_id: undefined,
      sales_order_detail_id: undefined,
      qty: 1,
      price: 0,
      status: 'packed',
      description: '',
    })
    setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-qty-row="${newIndex}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  useFormKeyboardNavigation({ onAddItem: handleAddItem })

  const onInvalid = (errs: any) => {
    const detailErrs: any[] = Array.isArray(errs?.details) ? errs.details : []
    const missingBatchRows = detailErrs
      .map((e, i) => (e?.product_uom_batch_id ? i : -1))
      .filter((i) => i >= 0)
    if (missingBatchRows.length > 0) {
      toast.error(
        `Batch belum dipilih pada baris ${missingBatchRows.map((i) => i + 1).join(', ')}`,
      )
      scrollToRowField('batch', missingBatchRows[0])
      return
    }
    const qtyRow = detailErrs.findIndex((e) => e?.qty)
    if (qtyRow >= 0) scrollToRowField('qty', qtyRow)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13.5,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  const inputErrorStyle: React.CSSProperties = {
    ...inputStyle,
    border: '1px solid var(--destructive)',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 6,
    display: 'block',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  const helpStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--foreground-muted)',
    marginTop: 4,
    display: 'block',
  }

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--foreground)',
  }

  const cardStyle: React.CSSProperties = {
    overflow: 'visible',
  }

  const fieldGridStyle: React.CSSProperties = {
    padding: 20,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px 20px',
  }

  const lineInputStyle: React.CSSProperties = {
    width: '100%',
    height: 34,
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  // Trigger sizing for SearchableSelect so it matches the native controls.
  const fieldTriggerStyle: React.CSSProperties = {
    height: 38,
    padding: '0 12px',
    fontSize: 13.5,
    background: 'var(--surface)',
  }
  const lineTriggerStyle: React.CSSProperties = {
    height: 34,
    padding: '0 10px',
    fontSize: 13,
    background: 'var(--surface)',
  }

  // Prefer the backend-converted qty in the LINE's own uom (e.g. "240
  // PACK") when available; otherwise fall back to the batch's own (base)
  // uom qty (e.g. "24,000 GR"). Never pair a base-uom number with a uom
  // label it wasn't converted into.
  // Batch code + expiry date, then the stock: "B2611-07 · Exp 12 Nov 2026 (24 PCS)".
  const batchCodeExpiry = (b: any) => {
    const code = b.code ? String(b.code).trim() : `Batch #${b.batchId}`
    return b.expiry_date ? `${code} · Exp ${formatDateShort(b.expiry_date)}` : code
  }
  const formatBatchOptionLabel = (b: any) => {
    const label = batchCodeExpiry(b)
    if (b.stock !== undefined) {
      return `${label} (${fmtQty(b.stock)}${b.unit ? ` ${b.unit}` : ''})`
    }
    return label
  }

  const deliveryGridCols = requiresBatch
    ? '28px minmax(240px, 3fr) minmax(130px, 1.3fr) 96px 116px minmax(110px, 1.3fr) 32px'
    : '28px minmax(260px, 3.5fr) 96px 116px minmax(130px, 1.6fr) 32px'

  return (
    <div
      className="df-root"
      style={{
        padding: '28px 24px 48px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BackLink href={listHref} label={listLabel} />
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {mode === 'edit' ? 'Edit Delivery' : 'New Delivery'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '6px 0 0' }}>
            {mode === 'edit'
              ? 'Update the details of this delivery'
              : 'Fill in the details below to create a new delivery'}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--foreground-muted)', marginBottom: -4 }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
        {/* Section 1 — Delivery Info */}
        <div className="v2-card" style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Delivery Info</span>
          </div>
          <div className="df-grid" style={fieldGridStyle}>


            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Delivery Date
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Source Type
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="source_type"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    style={{ ...selectStyle }}
                  >
                    {sourceTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Target Branch (Receiving)
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              {targetBranchReadonly ? (
                <div
                  style={{
                    width: '100%',
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-muted)',
                    fontSize: 13.5,
                    boxSizing: 'border-box',
                    color: 'var(--foreground-muted)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {branches.find((b: any) => b.id === watch('target_branch_id'))?.name
                    ?? 'Auto-filled from selection'}
                </div>
              ) : (
                <Controller
                  name="target_branch_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      options={branchOptions.filter(
                        (o: any) => !myBranchId || o.value !== myBranchId,
                      )}
                      placeholder="Select target branch..."
                      triggerStyle={fieldTriggerStyle}
                      searchPlaceholder="Search branches..."
                      loading={branchesLoading}
                      error={errors.target_branch_id?.message as string | undefined}
                      onSearchChange={setBranchSearch}
                    />
                  )}
                />
              )}
            </div>

            {showLinkedPO && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Linked Purchase Order (Optional)</label>
                <Controller
                  name="purchase_order_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v > 0 ? v : undefined)}
                      options={purchaseOrderOptions}
                      placeholder="No linked PO"
                      triggerStyle={fieldTriggerStyle}
                      searchPlaceholder="Search POs..."
                      loading={purchaseOrderOpts.loading}
                      {...purchaseOrderOpts.selectProps}
                      onSearchChange={setPoSearch}
                    />
                  )}
                />
                {!!watchPurchaseOrderId && watchPurchaseOrderId > 0 && poDetail && (
                  <span style={{ ...helpStyle, color: 'var(--success)' }}>
                    ✓ {poDetail.purchase_order_details?.length ?? 0} item(s) loaded from PO
                  </span>
                )}
              </div>
            )}

            {showLinkedSO && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Linked Sales Order (Optional)</label>
                <Controller
                  name="sales_order_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v > 0 ? v : undefined)}
                      options={salesOrderOptions}
                      placeholder="No linked SO"
                      triggerStyle={fieldTriggerStyle}
                      searchPlaceholder="Search SOs..."
                      loading={salesOrdersLoading}
                      onSearchChange={setSoSearch}
                    />
                  )}
                />
                {!!watchSalesOrderId && watchSalesOrderId > 0 && soDetail && (
                  <span style={{ ...helpStyle, color: 'var(--success)' }}>
                    ✓ {soDetail.sales_order_details?.length ?? 0} item(s) loaded from SO
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional delivery notes"
                style={{ ...inputStyle, height: 'auto', padding: '9px 12px', resize: 'vertical', minHeight: 72, lineHeight: 1.5 }}
              />
            </div>
          </div>
        </div>

        {/* Section 1b — Konsumsi Dari */}
        <div className="v2-card" style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Konsumsi Dari</span>
          </div>
          <div className="df-grid" style={fieldGridStyle}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Owner <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              {isOutletBranch ? (
                <>
                  <input
                    type="text"
                    value="GENERAL"
                    readOnly
                    style={{
                      ...inputStyle,
                      background: 'var(--surface-muted)',
                      cursor: 'not-allowed',
                      color: 'var(--foreground-muted)',
                    }}
                  />
                  <span style={helpStyle}>
                    Cabang outlet selalu menggunakan owner GENERAL
                  </span>
                </>
              ) : (
                <Controller
                  name="source_owner_ref"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 'GENERAL'}
                      onChange={field.onChange}
                      options={buildCompanyOptions(companies, field.value)}
                      placeholder="Pilih owner..."
                      triggerStyle={fieldTriggerStyle}
                      searchPlaceholder="Cari perusahaan..."
                      loading={companiesLoading}
                      error={errors.source_owner_ref?.message as string | undefined}
                      onSearchChange={setCompanySearch}
                    />
                  )}
                />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Stage <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <Controller
                name="source_stage"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 'GENERAL'}
                    onChange={field.onChange}
                    options={stageOptions}
                    placeholder="Pilih stage..."
                    triggerStyle={fieldTriggerStyle}
                    searchPlaceholder="Cari stage..."
                    loading={stagesLoading}
                    error={errors.source_stage?.message as string | undefined}
                    // Stage dropdown filters client-side only — no server-side search needed
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* Section 1c — Dimension Transfer (Optional) */}
        <div className="v2-card" style={cardStyle}>
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setEnableDimensionTransfer(!enableDimensionTransfer)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowRightLeft size={15} style={{ color: 'var(--foreground-muted)' }} />
              <span style={sectionLabelStyle}>Dimension Transfer (Opsional)</span>
            </div>
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: enableDimensionTransfer ? 'var(--accent)' : 'var(--border)',
                position: 'relative',
                transition: 'background 0.2s',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 2,
                  left: enableDimensionTransfer ? 18 : 2,
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </div>

          {enableDimensionTransfer && (
            <div className="df-grid" style={fieldGridStyle}>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: 0 }}>
                  Pindahkan stok dari dimensi asal (Owner/Stage di atas) ke dimensi tujuan yang baru.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>
                  Owner Tujuan <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <SearchableSelect
                  value={dimTransferToOwner}
                  onChange={setDimTransferToOwner}
                  options={buildCompanyOptions(targetCompanies, dimTransferToOwner)}
                  placeholder="Pilih owner tujuan..."
                  triggerStyle={fieldTriggerStyle}
                  searchPlaceholder="Cari perusahaan..."
                  loading={targetCompaniesLoading}
                  onSearchChange={setTargetCompanySearch}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>
                  Stage Tujuan <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <SearchableSelect
                  value={dimTransferToStage}
                  onChange={setDimTransferToStage}
                  options={stageOptions}
                  placeholder="Pilih stage tujuan..."
                  triggerStyle={fieldTriggerStyle}
                  searchPlaceholder="Cari stage..."
                  loading={stagesLoading}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Lokasi Tujuan</label>
                <input
                  type="text"
                  value={dimTransferToLocation}
                  onChange={(e) => setDimTransferToLocation(e.target.value)}
                  placeholder="GENERAL"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Catatan Transfer</label>
                <input
                  type="text"
                  value={dimTransferDescription}
                  onChange={(e) => setDimTransferDescription(e.target.value)}
                  placeholder="Opsional"
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2 — Line Items */}
        <div className="v2-card" style={cardStyle}>
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={sectionLabelStyle}>Delivery Items</span>
            <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
              {fields.length} item{fields.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="df-lines" style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: deliveryGridCols,
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-muted)',
              alignItems: 'center',
            }}
          >
            {(requiresBatch
              ? ['#', 'Product', 'Batch', 'Qty', 'Status', 'Notes', '']
              : ['#', 'Product', 'Qty', 'Status', 'Notes', '']
            ).map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  textAlign: h === '#' || h === '' ? 'center' : h === 'Qty' ? 'right' : 'left',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              style={{
                display: 'grid',
                gridTemplateColumns: deliveryGridCols,
                gap: 10,
                padding: '10px 20px',
                borderBottom: index === fields.length - 1 ? 'none' : '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              {/* Row index */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 34,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground-subtle)',
                }}
              >
                {index + 1}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <Controller
                  name={`details.${index}.product_uom_id`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchableSelect
                      value={f.value ?? 0}
                      onChange={(v) => {
                        f.onChange(v)
                        if (requiresBatch) {
                          const batches = getBatchOptionsForUom(Number(v))
                          if (batches.length === 1) {
                            setValue(
                              `details.${index}.product_uom_batch_id`,
                              batches[0].batchId,
                              { shouldValidate: true, shouldDirty: true }
                            )
                          } else {
                            setValue(
                              `details.${index}.product_uom_batch_id`,
                              undefined,
                              { shouldValidate: true, shouldDirty: true }
                            )
                          }
                        } else {
                          setValue(
                            `details.${index}.product_uom_batch_id`,
                            undefined,
                            { shouldValidate: true, shouldDirty: true }
                          )
                        }
                        const opt = productUomOptions.find((o: any) => o.value === v)
                        if (opt && opt.base_price) setValue(`details.${index}.price`, opt.base_price)
                      }}
                      options={productUomOptions}
                      placeholder="Select product..."
                      triggerStyle={lineTriggerStyle}
                      searchPlaceholder="Search products..."
                      loading={productUomsLoading || productUomOpts.loading}
                      {...productUomOpts.selectProps}
                      error={
                        errors.details?.[index]?.product_uom_id?.message as
                        | string
                        | undefined
                      }
                      onSearchChange={handleProductSearchChange}
                    />
                  )}
                />
              </div>

              {requiresBatch && (
                <Controller
                  control={control}
                  name={`details.${index}.product_uom_batch_id`}
                  render={({ field: f }) => {
                    const batches = getBatchOptionsForUom(
                      watchDetails[index]?.product_uom_id ?? 0,
                    )
                    const batchOptions =
                      f.value && !batches.some((b: any) => b.batchId === f.value)
                        ? [...batches, { batchId: f.value, code: undefined, expiry_date: undefined, stock: undefined }]
                        : batches
                    const batchError = f.value
                      ? undefined
                      : (errors.details?.[index]?.product_uom_batch_id?.message as string | undefined)
                    // Show spinner when ANY of these are true:
                    // 1. sourceBranchId not yet resolved (poSourceBranchData still loading for fulfill flow)
                    // 2. inventory query has never fetched or is currently fetching
                    // 3. productUoms not yet loaded (puomToProduct map not ready)
                    // 4. linked order form data not yet applied to form (PO/SO useEffect replace() pending)
                    const sourceBranchPending = showLinkedPO && poSourceBranchLoading
                    const rowHasProduct = Number(watchDetails[index]?.product_uom_id) > 0
                    const inventoryPending =
                      (!inventoryFetched && inventoryData === undefined) ||
                      (inventoryFetching && rowHasProduct && batches.length === 0)
                    const showBatchLoading =
                      sourceBranchPending ||
                      inventoryPending ||
                      (productUomsLoading && rowHasProduct && batches.length === 0) ||
                      !linkedOrderFormReady
                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}
                      >
                        {showBatchLoading ? (
                          <div
                            style={{
                              ...lineInputStyle,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              color: 'var(--foreground-muted)',
                              background: 'var(--surface)',
                            }}
                          >
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 99,
                                border: '2px solid var(--border)',
                                borderTop: '2px solid var(--accent)',
                                animation: 'spin 0.8s linear infinite',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 12 }}>Loading stock...</span>
                          </div>
                        ) : (
                          <select
                            data-batch-row={index}
                            value={f.value ?? 0}
                            onChange={(e) => {
                              const v = Number(e.target.value) || undefined
                              f.onChange(v)
                              if (v) clearErrors(`details.${index}.product_uom_batch_id`)
                            }}
                            style={{
                              ...lineInputStyle,
                              ...(batchError || (!f.value && Number(watchDetails[index]?.product_uom_id) > 0)
                                ? {
                                    border: '1px solid var(--destructive)',
                                    background: 'var(--destructive-bg)',
                                    color: 'var(--destructive)',
                                  }
                                : { border: '1px solid var(--border)' }),
                              cursor: 'pointer',
                            }}
                          >
                            <option value={0}>
                              {batchOptions.length === 0
                                ? 'No stock'
                                : 'Select batch...'}
                            </option>
                            {batchOptions.map((b: any) => {
                              const stockTitle = b.stock !== undefined
                                ? ` | Stock: ${fmtQty(b.stock)}${b.unit ? ` ${b.unit}` : ''}` +
                                  (b.baseStock !== undefined && b.unit !== b.baseUom
                                    ? ` (${fmtQty(b.baseStock)} ${b.baseUom ?? ''})`
                                    : '')
                                : ''
                              return (
                                <option
                                  key={b.batchId}
                                  value={b.batchId}
                                  title={`${b.code ?? `Batch #${b.batchId}`}${b.expiry_date ? ` | Exp: ${String(b.expiry_date).split('T')[0]}` : ''}${stockTitle}`}
                                >
                                  {formatBatchOptionLabel(b)}
                                </option>
                              )
                            })}
                          </select>
                        )}
                        {!showBatchLoading && f.value ? (() => {
                          const sel = batchOptions.find((b: any) => b.batchId === f.value)
                          return sel && (sel.code || sel.expiry_date) ? (
                            <span
                              title={batchCodeExpiry(sel)}
                              style={{
                                fontSize: 11.5,
                                color: 'var(--foreground-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {batchCodeExpiry(sel)}
                            </span>
                          ) : null
                        })() : null}
                        {batchError && (
                          <span
                            style={{ fontSize: 12, color: 'var(--destructive)' }}
                          >
                            {batchError}
                          </span>
                        )}
                      </div>
                    )
                  }}
                />
              )}

              {(() => {
                const shortage = stockShortages.get(index)
                const qtyError = errors.details?.[index]?.qty?.message as string | undefined
                const message = shortage ?? qtyError
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      data-qty-row={index}
                      {...register(`details.${index}.qty`, { valueAsNumber: true })}
                      style={{
                        ...lineInputStyle,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        border: `1px solid ${message ? 'var(--destructive)' : 'var(--border)'}`,
                      }}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                    {message && (
                      <span style={{ fontSize: 12, color: 'var(--destructive)', lineHeight: 1.3 }}>
                        {message}
                      </span>
                    )}
                  </div>
                )
              })()}

              <Controller
                name={`details.${index}.status`}
                control={control}
                render={({ field: f }) => (
                  <select
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    style={{ ...lineInputStyle, cursor: 'pointer' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="packaging">Packaging</option>
                    <option value="packed">Packed</option>
                  </select>
                )}
              />

              <input
                {...register(`details.${index}.description`)}
                placeholder="Optional note"
                style={lineInputStyle}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 34 }}>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="v2-icon-btn"
                  data-tone="danger"
                  aria-label="Remove item"
                  style={fields.length === 1 ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          </div>

          {/* total footer removed */}

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={handleAddItem}
              title="Add Item (Ctrl+B)"
              className="v2-btn v2-btn-outline v2-btn-sm"
            >
              <Plus size={13} />
              Add Item
            </button>
          </div>

          {errors.details && typeof (errors.details as any).message === 'string' && (
            <div style={{ padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            </div>
          )}
        </div>

        {/* Form actions */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 5,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 0',
            marginTop: 8,
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => router.push(listHref)}
            className="v2-btn v2-btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="v2-btn v2-btn-primary"
          >
            {isPending && (
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            <Save size={15} />
            {mode === 'edit'
              ? isPending
                ? 'Saving...'
                : 'Save Changes'
              : isPending
                ? 'Creating...'
                : 'Create Delivery'}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 720px) {
          .df-root .df-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
