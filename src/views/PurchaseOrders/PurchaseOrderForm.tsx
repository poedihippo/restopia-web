'use client'
import HeaderCheckbox from '@/components/HeaderCheckbox'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { getProductUomName, withProductType } from '@/utils/productUomName';
import { packagingChains } from '@/utils/unitDisplay';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { suppliersService } from '@/services/suppliers.service'
import { buyersService } from '@/services/buyers.service'
import { branchesService } from '@/services/branches.service'
import { branchSelectOptions } from '@/lib/branchOptions'
import { productUomsService } from '@/services/product-uoms.service'
import { taxesService } from '@/services/taxes.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  Save,
  Lock,
  Unlock,
} from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import BackLink from '@/components/BackLink'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import { PriceDisplay } from '@/components/PriceDisplay'
import RecipeImportModal from './RecipeImportModal'
import { SalesOrderType } from '@/constants/global'

const formatNumber = (n: number | undefined, canReadPrice: boolean): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!canReadPrice) return '***'
  return Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const detailSchema = z.object({
  // Existing row id (edit only) — sent back so the backend updates the row in
  // place instead of recreating it.
  id: z.coerce.number().optional(),
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty must be > 0'),
  price: z.coerce.number().min(0, 'Price required'),
  description: z.string().optional(),
  is_price_locked: z.boolean().optional(),
  is_taxable: z.boolean().optional(),
  discount_type: z.enum(['percent', 'nominal']).nullable().optional(),
  discount_value: z.coerce.number().min(0).nullable().optional(),
  // Read-only, from the API: qty already delivered/received on this row.
  delivered_qty: z.coerce.number().optional(),
})

const schema = z.object({
  // supplier_id / supplier_branch_id are mutually exclusive — required-ness is
  // enforced in onSubmit based on the watchType toggle, so both stay optional
  // at the schema level.
  supplier_id: z.coerce.number().optional(),
  supplier_branch_id: z.coerce.number().optional(),
  // Buyer (opsional) — hanya untuk PO external (type = supplier).
  buyer_id: z.coerce.number().min(0).optional(),
  date: z.string().min(1, 'Date is required'),
  fulfillment_date: z.string().min(1, 'Fulfillment Date is required'),
  // Only pending/final are offered as choices, but an edited PO keeps its
  // stored status (accepted, partially_delivered, …) so it must validate.
  status: z.enum(['pending', 'final', 'accepted', 'rejected', 'partially_delivered', 'delivered']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
  additional_charges: z.array(z.object({
    name: z.string().min(1, 'Name required'),
    chart_of_account_id: z.coerce.number().min(1, 'Account is required'),
    // Amount may be positive, zero or negative (negative = deduction).
    // Omitted / cleared input is treated as 0.
    amount: z.coerce.number().catch(0),
    description: z.string().optional(),
  })).optional(),
  type: z.string().min(1, 'Type is required'),
  tax_id: z.coerce.number().optional(),
  total_price: z.coerce.number().optional(),
})

type FormValues = z.infer<typeof schema>

interface PurchaseOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  orderId?: number
}

// Order types offered on the form (see the hidden "Type" toggle).
const PO_TYPE_OPTIONS = [{ key: 'supplier', label: 'Supplier' }] as const

export default function PurchaseOrderForm(props: PurchaseOrderFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { mode, initialData, orderId } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const { user, hasPermission } = useAuth()
  const currentBranchId = (user as any)?.branch?.id

  const canEditExternalPrice = hasPermission('purchase-order.edit-price')
  const canEditInternalPrice = hasPermission('internal-purchase-order.edit-price')

  const [showRecipeModal, setShowRecipeModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplier_id: 0,
      supplier_branch_id: undefined,
      buyer_id: 0,
      date: new Date().toISOString().split('T')[0],
      fulfillment_date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      details: [{ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: false }],
      additional_charges: [],
      type: 'supplier',
      tax_id: undefined,
      total_price: 0,
    },
  })

  const watchType = watch('type')

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })
  const { fields: chargeFields, append: appendCharge, remove: removeCharge } = useFieldArray({ control, name: 'additional_charges' })

  const [focusNewRowIndex, setFocusNewRowIndex] = useState<number | null>(null)

  const handleAddItem = () => {
    append({ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: false })
    setFocusNewRowIndex(fields.length)
  }

  useFormKeyboardNavigation({
    onAddItem: handleAddItem,
  })

  useEffect(() => {
    if (focusNewRowIndex !== null) {
      const timer = setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-po-row-index="${focusNewRowIndex}"] [data-focus-first="true"], [data-po-row-index="${focusNewRowIndex}"] button, [data-po-row-index="${focusNewRowIndex}"] input`
        )
        if (el) {
          el.focus()
        }
        setFocusNewRowIndex(null)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [focusNewRowIndex, fields.length])

  const watchDetails = watch('details')
  const watchSupplierId = watch('supplier_id')
  const watchAdditionalCharges = watch('additional_charges') || []
  const watchTaxId = watch('tax_id')

  const { data: taxesData } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => taxesService.list({ per_page: 50 }).then((r) => r.data),
  })
  const taxes = (taxesData as any)?.data ?? []

  // Chart of accounts for additional charges — every charge needs one
  // (required by the API), searched on the server by name or code.
  const [coaSearch, setCoaSearch] = useState('')
  const coaSearchDebounced = useDebounce(coaSearch, 400)
  const coaOpts = useInfiniteOptions<any>({
    queryKey: ['chart-of-accounts-options', 'charges', coaSearchDebounced],
    staleTime: 60_000,
    fetchPage: (page) =>
      chartOfAccountsService
        .list({
          page,
          per_page: 50,
          sort: 'code',
          'filter[is_active]': 'true',
          'filter[search]': coaSearchDebounced || undefined,
        } as any)
        .then((r) => r.data),
  })
  const coaData = coaOpts.items
  const toCoaOption = (coa: any) => ({
    value: coa.id as number,
    label: (coa.name as string) ?? `COA #${coa.id}`,
    sublabel: (coa.code as string) ?? undefined,
  })
  // Accounts already on the PO (edit mode) may fall outside the current
  // result set; /chart-of-accounts has no filter[ids], so fetch them by id.
  const selectedCoaIds: number[] = Array.from(
    new Set(watchAdditionalCharges.map((c: any) => Number(c?.chart_of_account_id) || 0).filter((id: number) => id > 0)),
  )
  const missingCoaIds = selectedCoaIds.filter(
    (id) => !coaData.some((c: any) => c.id === id),
  )
  const missingCoaQueries = useQueries({
    queries: missingCoaIds.map((id) => ({
      queryKey: ['chart-of-account', id],
      staleTime: 300_000,
      queryFn: () => chartOfAccountsService.findById(id).then((r) => (r.data as any)?.data),
    })),
  })
  // Already-fetched by-id results come from the query cache (staleTime).
  const coaChargeOptions = [
    ...coaData.map(toCoaOption),
    ...missingCoaQueries.filter((q) => (q.data as any)?.id).map((q) => toCoaOption(q.data)),
  ]

  const selectedTax = taxes.find((t: any) => t.id === watchTaxId)
  const taxRate = selectedTax?.rate ?? 0

  const taxableSubtotal = watchDetails.reduce((sum, d) => sum + (d.is_taxable ? Number(d.qty || 0) * Number(d.price || 0) : 0), 0)
  const nonTaxableSubtotal = watchDetails.reduce((sum, d) => sum + (!d.is_taxable ? Number(d.qty || 0) * Number(d.price || 0) : 0), 0)
  const subtotal = taxableSubtotal + nonTaxableSubtotal
  const taxAmount = Math.round((taxableSubtotal * taxRate) / 100)
  const additionalChargesTotal = watchAdditionalCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0)
  const totalPrice = subtotal + taxAmount + additionalChargesTotal

  const activeProductTypes = useActiveBranchProductTypes()




  const supplierOpts = useInfiniteOptions<any>({
    queryKey: ['suppliers-all', debouncedDropdownSearch],
    fetchPage: (page) => suppliersService.list({ page, 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const suppliers = supplierOpts.items

  // Buyer punya search sendiri supaya tidak ikut tersaring oleh ketikan
  // di dropdown supplier/branch (yang berbagi dropdownSearch).
  const [buyerSearch, setBuyerSearch] = useState('')
  const [debouncedBuyerSearch, setDebouncedBuyerSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedBuyerSearch(buyerSearch), 400); return () => clearTimeout(t) }, [buyerSearch])
  const buyerOpts = useInfiniteOptions<any>({
    queryKey: ['buyers-all', debouncedBuyerSearch],
    fetchPage: (page) => buyersService.list({ page, 'filter[search]': debouncedBuyerSearch || undefined, per_page: 100, sort: 'name' } as any).then((r) => r.data),
  })
  const buyers = buyerOpts.items

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    // Whole list (small) with company so the selector can group company → premiere → pickup points;
    // the select filters client-side.
    queryKey: ['branches-all', 'with-company'],
    queryFn: () => branchesService.list({ per_page: 100, include: 'company' } as any).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  // Query utama: hanya aktif + default — single call, no loop.
  // Filter branch_type dari auth/me (user.branch.type) agar SKU sesuai tipe branch.
  // Berlaku untuk semua tipe branch, termasuk "outlet" (product-UOM kini punya
  // branch_types "outlet", jadi tidak perlu lagi pengecualian).
  const activeBranchType = ((user as any)?.branch?.type as string | undefined) || undefined
  // Product-UOM selector: 20 per page, server-side search, next page on
  // scroll (same pattern as other paged selects).
  const productUomOpts = useInfiniteOptions<any>({
    queryKey: ['po-product-uom-options', activeProductTypes, activeBranchType, debouncedDropdownSearch],
    staleTime: 60_000,
    fetchPage: (page) =>
      productUomsService
        .list({
          page,
          per_page: 20,
          'filter[search]': debouncedDropdownSearch || undefined,
          include: 'product,uom',
          'filter[product_types]': activeProductTypes,
          'filter[branch_type]': activeBranchType,
          'filter[is_active]': true,
        } as any)
        .then((r) => r.data),
  })
  const productUomsLoading = productUomOpts.loading

  // A line's product-UOM is often not in the current page (edit rows,
  // recipe imports, after a new search), so each picked id is fetched once
  // by id and cached. Rows picked from the dropdown are seeded on select.
  const productUomByIdKey = (id: number) => ['product-uom-by-id', id]
  const fetchProductUomById = (id: number) =>
    queryClient.fetchQuery({
      queryKey: productUomByIdKey(id),
      staleTime: 5 * 60_000,
      queryFn: () =>
        productUomsService.findById(id, { include: 'product,uom' }).then((r) => (r.data as any)?.data ?? null),
    })

  const handleImportRecipes = async (selectedRecipes: any[]) => {
    const currentDetails = watch('details')
    const newItems: Record<number, number> = {}

    selectedRecipes.forEach((recipe) => {
      recipe.recipe_materials?.forEach((material: any) => {
        const uomId = material.product_uom_id
        if (newItems[uomId]) {
          newItems[uomId] += material.qty
        } else {
          newItems[uomId] = material.qty
        }
      })
    })

    const finalDetails = [...currentDetails]
    for (const [productUomId, qty] of Object.entries(newItems)) {
      const id = Number(productUomId)
      const existingIndex = finalDetails.findIndex((d) => d.product_uom_id === id)

      if (existingIndex >= 0) {
        finalDetails[existingIndex].qty += qty
      } else {
        const product =
          mergedProductUoms.find((p: any) => p.id === id) ??
          (await fetchProductUomById(id).catch(() => null))
        const price = product?.base_price ?? 0
        finalDetails.push({ product_uom_id: id, qty, price, description: '', is_price_locked: true, is_taxable: false })
      }
    }

    const cleanedDetails = finalDetails.filter(
      (d) => d.product_uom_id !== 0 || d.qty !== 1 || d.price !== 0 || d.description !== ''
    )

    if (cleanedDetails.length === 0) {
      cleanedDetails.push({ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: false })
    }

    setValue('details', cleanedDetails, { shouldDirty: true, shouldValidate: true })
  }

  const allProductUoms: any[] = productUomOpts.items
  const activeDetailUomIds = new Set(
    (initialData?.details ?? [])
      .map((d: any) => d.product_uom_id)
      .filter(Boolean),
  )

  // Track ALL product_uom_ids currently in form details (including imports)
  const currentDetails = useWatch({ control, name: 'details' }) ?? []
  const formDetailUomIds = new Set(
    currentDetails.map((d: any) => d.product_uom_id).filter(Boolean),
  )

  const productUoms = allProductUoms.filter((pu: any) => {
    if (!isProductTypeAllowed(pu.product, activeProductTypes)) return false
    const productIsActive = pu.product?.is_active !== false
    if (productIsActive) return true
    return activeDetailUomIds.has(pu.id) || formDetailUomIds.has(pu.id)
  })

  // Rows used on the form's lines, fetched by id (see fetchProductUomById),
  // so their label / price / packaging survive paging and searching —
  // inactive ones included.
  const lineUomIds = Array.from(
    new Set<number>([...formDetailUomIds, ...activeDetailUomIds].map(Number).filter((n) => n > 0)),
  )
  const lineUomQueries = useQueries({
    queries: lineUomIds.map((id) => ({
      queryKey: productUomByIdKey(id),
      staleTime: 5 * 60_000,
      queryFn: () =>
        productUomsService.findById(id, { include: 'product,uom' }).then((r) => (r.data as any)?.data ?? null),
    })),
  })
  const lineUomRows: any[] = lineUomQueries.map((q) => q.data).filter(Boolean)

  // Merge: current page + line rows not in it (shown first so the trigger
  // label of every line resolves).
  const mergedProductUoms = [
    ...lineUomRows.filter((row: any) => !productUoms.some((pu: any) => pu.id === row.id)),
    ...productUoms,
  ]

  // Last-purchase-price history for the selected supplier. Reads existing POs;
  // no backend change. Newest entry per product_uom_id (POs sorted -date).
  const { data: historyData } = useQuery({
    queryKey: ['po-supplier-history', watchSupplierId],
    enabled:
      watchType === 'supplier' && !!watchSupplierId && watchSupplierId > 0,
    queryFn: () =>
      purchaseOrdersService
        .list({ 'filter[search]': debouncedDropdownSearch || undefined, 
          'filter[supplier_id]': watchSupplierId,
          include: 'purchase_order_details',
          sort: '-date',
          per_page: 50,
         } as any)
        .then((r) => r.data),
  })
  const supplierPOs = (historyData as any)?.data ?? []

  const lastPriceByUom = React.useMemo(() => {
    const map = new Map<number, { price: number; date: string }>()
    for (const po of supplierPOs as any[]) {
      // Don't let the PO being edited reference itself.
      if (mode === 'edit' && orderId && po?.id === orderId) continue
      for (const d of po?.purchase_order_details ?? []) {
        const uomId = Number(d?.product_uom_id)
        const price = Number(d?.price)
        if (!uomId || !(price > 0)) continue
        if (map.has(uomId)) continue // first-seen = newest (sorted -date)
        map.set(uomId, { price, date: po?.date })
      }
    }
    return map
  }, [supplierPOs, mode, orderId])

  const supplierOptions = suppliers.map((s: any) => ({
    value: s.id as number,
    label: (s.name as string) ?? `Supplier #${s.id}`,
    sublabel: s.code as string | undefined,
  }))
  const buyerOptions = [
    { value: 0, label: 'Tanpa Buyer' },
    ...buyers.map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Buyer #${b.id}`,
      sublabel: b.code as string | undefined,
    })),
  ]
  // Saat edit, buyer terpilih mungkin tidak ada di 100 hasil pertama.
  if (initialData?.buyer?.id && !buyerOptions.some((o) => o.value === initialData.buyer.id)) {
    buyerOptions.push({
      value: initialData.buyer.id,
      label: initialData.buyer.name ?? `Buyer #${initialData.buyer.id}`,
      sublabel: initialData.buyer.code,
    })
  }
  // Internal-source branches: every branch except our own.
  // (plus the saved source branch on edit, so its label shows even if it is not listed)
  const sourceBranchRows = branches.filter((b: any) => b.id !== currentBranchId)
  if (
    initialData?.supplier_branch?.id &&
    !sourceBranchRows.some((b: any) => b.id === initialData.supplier_branch.id)
  ) {
    sourceBranchRows.push(initialData.supplier_branch)
  }
  const sourceBranchOptions = branchSelectOptions(
    sourceBranchRows,
    (b: any) => (b.name as string) ?? `Branch #${b.id}`,
    (b: any) => ({ sublabel: b.code as string | undefined }),
  )
  const productUomOptions = mergedProductUoms.map((pu: any) => ({
    value: pu.id as number,
    label: withProductType(getProductUomName(pu, pu.product?.name), pu.product?.type),
    sublabel: (pu.uom?.name as string) ?? '',
    description: (pu.code as string) ?? undefined,
    meta: packagingChains(pu.product?.conversions).join(' · ') || undefined,
    base_price: pu.base_price ?? 0,
  }))

  // Packaging chain of the product-UOM picked on a line (e.g. "1 PACK →
  // 300 GR"). Looks in every loaded list, since the dropdown list is
  // narrowed by search and edit rows carry their own product_uom.
  const packagingFor = (productUomId: number): string => {
    if (!productUomId) return ''
    const pu = mergedProductUoms.find((x: any) => x.id === productUomId)
    return packagingChains(pu?.product?.conversions).join(' · ')
  }

  // A row that has already been (partly) delivered/received keeps its qty.
  const isRowQtyLocked = (index: number) =>
    mode === 'edit' && Number(watchDetails?.[index]?.delivered_qty ?? 0) > 0
  const isDelivered = mode === 'edit' && initialData?.status === 'delivered'

  useEffect(() => {
    if (initialData && mode === 'edit') {
      // branch_id (the old destination-branch field) is intentionally dropped
      // here so it never re-enters the form / payload.
      reset({
        ...initialData,
        date: initialData.date?.split('T')[0],
        fulfillment_date: initialData.fulfillment_date?.split('T')[0],
        branch_id: undefined,
      })
      if (initialData.type) {
        setValue('type', initialData.type)
      } else if (initialData.supplier_branch_id) {
        setValue('type', 'branch')
      } else {
        setValue('type', 'supplier')
      }
    }
  }, [initialData, mode])

  const buildPayload = (values: FormValues) => ({
    ...values,
    fulfillment_date: values.fulfillment_date ? new Date(values.fulfillment_date).toISOString().split('T')[0] : undefined,
    total_price: totalPrice,
    type: values.type,
    tax_id: values.tax_id,
    supplier_id:
      values.type === 'supplier' ? values.supplier_id || undefined : undefined,
    supplier_branch_id:
      values.type === 'branch' ? values.supplier_branch_id || undefined : undefined,
    buyer_id:
      values.type === 'supplier' ? values.buyer_id || undefined : undefined,
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        id: mode === 'edit' ? d.id || undefined : undefined,
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        price: d.price,
        is_taxable: Boolean(d.is_taxable),
        discount_type: d.discount_type || undefined,
        discount_value: d.discount_type ? Number(d.discount_value ?? 0) : undefined,
        description: d.description || undefined,
      })),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.create(buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created')
      router.push('/purchase/purchase-orders')
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create purchase order'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.update(orderId!, buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.removeQueries({ queryKey: ['purchase-order-detail', orderId] })
      toast.success('Purchase order updated')
      router.push(`/purchase/purchase-orders/${orderId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update purchase order'),
  })

  // Never let a rejected submit be silent — surface the first error message
  // (including nested details.N.field errors).
  const onInvalid = (errs: any) => {
    const findMessage = (e: any): string | undefined => {
      if (!e || typeof e !== 'object') return undefined
      if (typeof e.message === 'string') return e.message
      for (const [k, v] of Object.entries(e)) {
        if (k === 'ref') continue
        const m = findMessage(v)
        if (m) return m
      }
      return undefined
    }
    toast.error(findMessage(errs) ?? 'Please review the form')
  }

  const onSubmit = (values: FormValues) => {
    if (values.type === 'supplier' && !values.supplier_id) {
      setError('supplier_id', { message: 'Supplier is required' })
      return
    }
    if (values.type === 'branch' && !values.supplier_branch_id) {
      setError('supplier_branch_id', { message: 'Source branch is required' })
      return
    }
    if (mode === 'edit' && orderId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // ── Shared styles ───────────────────────────────────────────────────────────

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

  const requiredMark = <span style={{ color: 'var(--destructive)' }}> *</span>

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 }

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
  }

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: 0,
  }

  const hintStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: 'var(--foreground-muted)',
  }

  const triggerStyle: React.CSSProperties = {
    height: 38,
    padding: '0 12px',
    fontSize: 13.5,
    background: 'var(--surface)',
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

  const lineTriggerStyle: React.CSSProperties = {
    height: 34,
    padding: '0 10px',
    fontSize: 13,
    background: 'var(--surface)',
  }

  const thStyle: React.CSSProperties = {
    height: 36,
    padding: '0 10px',
    fontSize: 11.5,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    background: 'var(--surface-muted)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px',
    verticalAlign: 'top',
    height: 'auto',
  }

  const totalsRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    fontSize: 13,
    color: 'var(--foreground-muted)',
  }

  const totalsValueStyle: React.CSSProperties = {
    fontWeight: 500,
    color: 'var(--foreground)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      className="po-form-container"
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <BackLink href="/purchase/purchase-orders" label="Purchase Orders" />
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {mode === 'edit' ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit'
              ? 'Update the details of this purchase order'
              : 'Fill in the details below to create a new purchase order'}
          </p>
        </div>
      </div>

      <RecipeImportModal
        open={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        onImport={handleImportRecipes}
      />

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Section 1 — Order Details */}
        <div className="v2-card">
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Order details</h2>
            <span style={hintStyle}>
              <span style={{ color: 'var(--destructive)' }}>*</span> Required fields
            </span>
          </div>
          <div
            className="po-order-details-grid"
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '16px 20px',
            }}
          >
            {/* Left column: all fields stacked. Right column: Notes, full height. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Order Date + Fulfillment Date share one row */}
            <div className="po-date-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 20px' }}>
            {/* Date */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Order Date{requiredMark}
              </label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
            </div>

            {/* Fulfillment Date */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Fulfillment Date</label>
              <input
                type="date"
                {...register('fulfillment_date')}
                style={errors.fulfillment_date ? inputErrorStyle : inputStyle}
              />
              {errors.fulfillment_date && <span style={errorStyle}>{errors.fulfillment_date.message}</span>}
            </div>
            </div>

            {/* Order source toggle — external Supplier or internal Branch.
                Kept in the form but hidden while there is only one choice;
                it shows again as soon as a second type is listed. */}
            <div
              className="po-span-2"
              style={{ ...fieldStyle, gridColumn: 'span 2', display: PO_TYPE_OPTIONS.length > 1 ? fieldStyle.display : 'none' }}
            >
              <label style={labelStyle}>Type</label>
              <div className="v2-seg" style={{ alignSelf: 'flex-start' }}>
                {PO_TYPE_OPTIONS.map(({ key, label }) => {
                  const selected = watchType === key
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-selected={selected}
                      onClick={() => {
                        setValue('type', key)
                        setValue('supplier_id', undefined)
                        setValue('supplier_branch_id', undefined)
                        setValue('buyer_id', 0)
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Supplier (external) — only when source is "supplier" */}
            {watchType === 'supplier' && (
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Supplier{requiredMark}
                </label>
                <Controller
                  name="supplier_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      options={supplierOptions}
                      placeholder="Select supplier..."
                      searchPlaceholder="Search suppliers..."
                      loading={supplierOpts.loading}
                      {...supplierOpts.selectProps}
                      error={errors.supplier_id?.message as string | undefined}
                      onSearchChange={setDropdownSearch}
                      triggerStyle={triggerStyle}
                    />
                  )}
                />
              </div>
            )}

            {/* Buyer (external) — opsional, hanya saat source "supplier" */}
            {watchType === 'supplier' && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Buyer</label>
                <Controller
                  name="buyer_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      options={buyerOptions}
                      placeholder="Select buyer..."
                      searchPlaceholder="Search buyers..."
                      loading={buyerOpts.loading}
                      {...buyerOpts.selectProps}
                      error={errors.buyer_id?.message as string | undefined}
                      onSearchChange={setBuyerSearch}
                      triggerStyle={triggerStyle}
                    />
                  )}
                />
              </div>
            )}

            {/* Source Branch (internal) — only when source is "branch"; spans
                the full row now that the destination "Branch" field is gone. */}
            {watchType === 'branch' && (
              <div className="po-span-2" style={{ ...fieldStyle, gridColumn: 'span 2' }}>
                <label style={labelStyle}>
                  Source Branch{requiredMark}
                </label>
                <Controller
                  name="supplier_branch_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      options={sourceBranchOptions}
                      placeholder="Select source branch..."
                      searchPlaceholder="Search branches..."
                      loading={branchesLoading}
                      error={errors.supplier_branch_id?.message as string | undefined}
                      triggerStyle={triggerStyle}
                    />
                  )}
                />
              </div>
            )}

            {/* Status */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Status{requiredMark}
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="v2-seg">
                      {(['pending', 'final'] as const).map((s) => {
                        const isSelected = field.value === s
                        const isPending = s === 'pending'
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-selected={isSelected}
                            onClick={() => field.onChange(s)}
                            style={
                              isSelected
                                ? { color: isPending ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }
                                : undefined
                            }
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                    {field.value && field.value !== 'pending' && field.value !== 'final' && (
                      <span
                        title="Current status — kept when saving"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: 'var(--info-bg)',
                          color: 'var(--info)',
                        }}
                      >
                        {field.value.charAt(0).toUpperCase() + field.value.slice(1).replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>

            </div>

            {/* Notes — right column, fills the height of the fields */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional order notes"
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', minHeight: 112, lineHeight: 1.5 }}
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Line Items */}
        <div className="v2-card" style={{ overflow: 'hidden' }}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h2 style={cardTitleStyle}>Line items</h2>
              <span style={hintStyle}>
                {fields.length} item{fields.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRecipeModal(true)}
              className="v2-btn v2-btn-outline v2-btn-sm"
            >
              Load from Recipes
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="v2-table" style={{ minWidth: 760, tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44, paddingLeft: 16, textAlign: 'center' }}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Product / UOM</th>
                  <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>Qty</th>
                  {watchType !== 'branch' && (
                    <th style={{ ...thStyle, width: 170, textAlign: 'right' }}>Unit Price</th>
                  )}
                  {watchType !== 'branch' && (
                    <th style={{ ...thStyle, width: 112, textAlign: 'left', verticalAlign: 'middle' }}>
                      {/* "check all" + label; left-aligned so this box sits on the
                          same vertical line as every row checkbox below it. */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 16, lineHeight: 1, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <HeaderCheckbox
                          style={{ margin: 0 }}
                          total={watchDetails.length}
                          checkedCount={watchDetails.filter((d) => d.is_taxable).length}
                          onToggleAll={(checkAll) =>
                            watchDetails.forEach((_, i) =>
                              setValue(`details.${i}.is_taxable`, checkAll, { shouldDirty: true }),
                            )
                          }
                          title="Mark all lines taxable"
                        />
                        <span>Taxable</span>
                      </label>
                    </th>
                  )}
                  <th style={{ ...thStyle, width: 120, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ ...thStyle, width: 150, textAlign: 'left' }}>Notes</th>
                  <th style={{ ...thStyle, width: 44, paddingRight: 16 }} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Single useWatch for the whole array — keeps the hook count
                  // stable across renders (rules of hooks friendly).
                  const watchedDetails = (useWatch({ control, name: 'details' }) ?? []) as any[]
                  const canReadPrice = getCanReadPrice()
                  return fields.map((field, index) => {
                    // Per-row subtotal: qty × price, computed reactively.
                    // For branch-type POs (no price column) it falls back to qty.
                    const rowQty = watchedDetails?.[index]?.qty
                    const rowPrice = watchedDetails?.[index]?.price
                    const rowSubtotal =
                      watchType === 'branch'
                        ? Number(rowQty ?? 0)
                        : Number(rowQty ?? 0) * Number(rowPrice ?? 0)
                    const priceLocked =
                      watch(`details.${index}.is_price_locked`) !== false ||
                      !getCanReadPrice() ||
                      (watchType === 'supplier' ? !canEditExternalPrice : !canEditInternalPrice)
                    return (
                      <tr key={field.id} data-po-row-index={index}>
                        {/* Row index */}
                        <td
                          style={{
                            ...tdStyle,
                            paddingLeft: 16,
                            textAlign: 'center',
                            lineHeight: '34px',
                            fontSize: 12.5,
                            color: 'var(--foreground-subtle)',
                          }}
                        >
                          {index + 1}
                        </td>

                        {/* Product UOM */}
                        <td style={{ ...tdStyle, minWidth: 220 }}>
                          <Controller
                            name={`details.${index}.product_uom_id`}
                            control={control}
                            render={({ field: f }) => (
                              <SearchableSelect
                                dataFocusFirst={true}
                                value={f.value ?? 0}
                                onChange={(val) => {
                                  f.onChange(val)

                                  const matchingUom = mergedProductUoms.find((pu: any) => pu.id === val)
                                  if (matchingUom) {
                                    // Seed the by-id cache so the line keeps its row after the search changes.
                                    queryClient.setQueryData(productUomByIdKey(Number(val)), matchingUom)
                                    setValue(`details.${index}.price`, matchingUom.base_price ?? 0)
                                  }
                                }}
                                options={productUomOptions}
                                placeholder="Select product..."
                                searchPlaceholder="Search products..."
                                loading={productUomsLoading}
                                {...productUomOpts.selectProps}
                                error={
                                  errors.details?.[index]?.product_uom_id?.message as
                                  | string
                                  | undefined
                                }
                                onSearchChange={setDropdownSearch}
                                triggerStyle={lineTriggerStyle}
                              />
                            )}
                          />
                          {packagingFor(Number(currentDetails[index]?.product_uom_id)) && (
                            <div
                              style={{ marginTop: 4, fontSize: 11, color: 'var(--foreground-muted)' }}
                              title="Packaging (largest - smallest)"
                            >
                              {packagingFor(Number(currentDetails[index]?.product_uom_id))}
                            </div>
                          )}
                        </td>

                        {/* Qty */}
                        <td style={tdStyle}>
                          <Controller
                            name={`details.${index}.qty`}
                            control={control}
                            render={({ field }) => (
                              <LocalizedNumberInput
                                value={field.value}
                                onChange={field.onChange}
                                decimals={2}
                                padDecimals={false}
                                disabled={isRowQtyLocked(index)}
                                style={{
                                  ...lineInputStyle,
                                  textAlign: 'right',
                                  ...(isRowQtyLocked(index) ? { background: 'var(--surface-muted)', cursor: 'not-allowed' } : {})
                                }}
                              />
                            )}
                          />
                        </td>

                        {/* Price */}
                        {watchType !== 'branch' && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <LocalizedNumberInput
                                value={(() => {
                                  if (!getCanReadPrice()) return 0
                                  return watch(`details.${index}.price`) ?? 0
                                })()}
                                onChange={(val) => {
                                  setValue(`details.${index}.price`, Math.max(0, val))
                                }}
                                decimals={2}
                                disabled={priceLocked}
                                style={{
                                  ...lineInputStyle,
                                  textAlign: 'right',
                                  flex: 1,
                                  minWidth: 0,
                                  ...(priceLocked ? { background: 'var(--surface-muted)', cursor: 'not-allowed' } : {}),
                                }}
                              />
                              <button
                                type="button"
                                className="v2-icon-btn"
                                onClick={() => {
                                  const currentLocked = watch(`details.${index}.is_price_locked`)
                                  setValue(`details.${index}.is_price_locked`, currentLocked === false ? true : false)
                                }}
                                title={watch(`details.${index}.is_price_locked`) !== false ? "Unlock price" : "Lock price"}
                                style={{
                                  flexShrink: 0,
                                  color: watch(`details.${index}.is_price_locked`) !== false ? 'var(--foreground-muted)' : 'var(--accent)',
                                }}
                              >
                                {watch(`details.${index}.is_price_locked`) !== false ? <Lock size={14} /> : <Unlock size={14} />}
                              </button>
                            </div>
                            {(() => {
                              if (watchType !== 'supplier') return null
                              const uomId = Number(watch(`details.${index}.product_uom_id`))
                              const last = uomId ? lastPriceByUom.get(uomId) : undefined
                              if (!last) return null
                              return (
                                <span
                                  role="button"
                                  title="Tap to use this price"
                                  onClick={() =>
                                    setValue(`details.${index}.price`, last.price)
                                  }
                                  style={{
                                    display: 'block',
                                    marginTop: 4,
                                    fontSize: 11.5,
                                    color: 'var(--foreground-muted)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {getCanReadPrice()
                                    ? `Last: Rp ${formatCurrency(last.price, '')}`
                                    : `Last: Rp ***`}
                                  {last.date ? ` · ${String(last.date).slice(0, 10)}` : ''}
                                </span>
                              )
                            })()}
                          </td>
                        )}

                        {/* Taxable Checkbox */}
                        {watchType !== 'branch' && (
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            {/* Same left edge as the header checkbox; 34px tall = the qty / price inputs. */}
                            <label
                              title="Taxable"
                              style={{ display: 'flex', alignItems: 'center', height: 34, cursor: 'pointer' }}
                            >
                              <input
                                type="checkbox"
                                aria-label="Taxable"
                                {...register(`details.${index}.is_taxable`)}
                                style={{ width: 16, height: 16, margin: 0, cursor: 'pointer', accentColor: 'var(--accent)' }}
                              />
                            </label>
                          </td>
                        )}

                        {/* Subtotal (qty × price, or qty for branch-type POs) */}
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: 'right',
                            lineHeight: '34px',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {watchType === 'branch'
                            ? Number(rowQty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
                            : canReadPrice
                              ? `Rp ${rowSubtotal.toLocaleString('id-ID')}`
                              : 'Rp ***'}
                        </td>

                        {/* Description */}
                        <td style={tdStyle}>
                          <input
                            {...register(`details.${index}.description`)}
                            placeholder="Optional note"
                            style={lineInputStyle}
                          />
                        </td>

                        {/* Delete */}
                        <td style={{ ...tdStyle, paddingRight: 16, textAlign: 'center' }}>
                          <button
                            type="button"
                            className="v2-icon-btn"
                            data-tone="danger"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            title="Remove item"
                            style={{
                              marginTop: 3,
                              ...(fields.length === 1 ? { color: 'var(--border-strong)', cursor: 'not-allowed', background: 'transparent' } : {}),
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleAddItem}
              className="v2-btn v2-btn-outline v2-btn-sm"
            >
              <Plus size={14} /> Add item
              <kbd
                style={{
                  fontSize: 10,
                  opacity: 0.7,
                  background: 'var(--surface-muted)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Ctrl+B
              </kbd>
            </button>
            {/* Array-level error */}
            {errors.details && typeof (errors.details as any).message === 'string' && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            )}
          </div>
        </div>

        {/* Section 3 — Additional charges + totals */}
        <div className="v2-card">
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h2 style={cardTitleStyle}>Additional charges</h2>
              <span style={hintStyle}>Optional</span>
            </div>
            <button
              type="button"
              onClick={() => appendCharge({ name: '', amount: 0, chart_of_account_id: 0 })}
              className="v2-btn v2-btn-outline v2-btn-sm"
            >
              <Plus size={14} /> Add charge
            </button>
          </div>

          {chargeFields.length > 0 ? (
            // Same table treatment as "Line items": header row + numbering.
            <div style={{ overflowX: 'auto' }}>
              <table className="v2-table" style={{ minWidth: 760, tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 44, paddingLeft: 16, textAlign: 'center' }}>#</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>
                      Charge<span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                    </th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>
                      Account<span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                    </th>
                    <th style={{ ...thStyle, width: 170, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Notes</th>
                    <th style={{ ...thStyle, width: 44, paddingRight: 16 }} />
                  </tr>
                </thead>
                <tbody>
                  {chargeFields.map((field, index) => (
                    <tr key={field.id}>
                      <td
                        style={{
                          ...tdStyle,
                          paddingLeft: 16,
                          textAlign: 'center',
                          lineHeight: '34px',
                          fontSize: 12.5,
                          color: 'var(--foreground-subtle)',
                        }}
                      >
                        {index + 1}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 180 }}>
                        <input
                          {...register(`additional_charges.${index}.name`)}
                          placeholder="e.g. Shipping"
                          style={errors.additional_charges?.[index]?.name ? { ...lineInputStyle, border: '1px solid var(--destructive)' } : lineInputStyle}
                        />
                        {errors.additional_charges?.[index]?.name && (
                          <span style={{ ...errorStyle, display: 'block' }}>{errors.additional_charges[index].name.message}</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 200 }}>
                        <Controller
                          name={`additional_charges.${index}.chart_of_account_id`}
                          control={control}
                          render={({ field: coaField }) => (
                            <SearchableSelect
                              value={coaField.value ?? 0}
                              onChange={coaField.onChange}
                              options={coaChargeOptions}
                              placeholder="Select account..."
                              searchPlaceholder="Search account name or code..."
                              loading={coaOpts.loading}
                              {...coaOpts.selectProps}
                              onSearchChange={setCoaSearch}
                              error={errors.additional_charges?.[index]?.chart_of_account_id?.message}
                              triggerStyle={{ ...lineTriggerStyle, borderRadius: 'var(--radius-md)' }}
                            />
                          )}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--foreground-muted)' }}>Rp</span>
                          <input
                            type="number"
                            step="any"
                            {...register(`additional_charges.${index}.amount`, { valueAsNumber: true })}
                            placeholder="0"
                            style={{ ...lineInputStyle, paddingLeft: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        {errors.additional_charges?.[index]?.amount && (
                          <span style={{ ...errorStyle, display: 'block' }}>{errors.additional_charges[index].amount.message}</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 160 }}>
                        <input
                          {...register(`additional_charges.${index}.description`)}
                          placeholder="Optional note"
                          style={lineInputStyle}
                        />
                      </td>
                      <td style={{ ...tdStyle, paddingRight: 16, textAlign: 'center' }}>
                        <button
                          type="button"
                          className="v2-icon-btn"
                          data-tone="danger"
                          onClick={() => removeCharge(index)}
                          title="Remove charge"
                          style={{ marginTop: 3 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '16px 20px' }}>
              <span style={hintStyle}>No additional charges.</span>
            </div>
          )}

          {/* Totals */}
          {watchType !== 'branch' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '16px 20px 20px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={totalsRowStyle}>
                  <span>Subtotal</span>
                  <span style={totalsValueStyle}><PriceDisplay amount={subtotal} prefix="Rp " /></span>
                </div>
                <div style={totalsRowStyle}>
                  <span>Tax</span>
                  <Controller
                    name="tax_id"
                    control={control}
                    render={({ field }) => (
                      <select
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        className="v2-select"
                        style={{ ...selectStyle, height: 32, width: 'auto', minWidth: 170, fontSize: 13 }}
                      >
                        <option value="">No Tax</option>
                        {taxes.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                        ))}
                      </select>
                    )}
                  />
                </div>
                <div style={totalsRowStyle}>
                  <span>Tax amount</span>
                  <span style={totalsValueStyle}><PriceDisplay amount={taxAmount} prefix="Rp " /></span>
                </div>
                {additionalChargesTotal !== 0 && (
                  <div style={totalsRowStyle}>
                    <span>Additional charges</span>
                    <span style={totalsValueStyle}><PriceDisplay amount={additionalChargesTotal} prefix="Rp " /></span>
                  </div>
                )}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--foreground)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <PriceDisplay amount={totalPrice} prefix="Rp " />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form actions — sticky footer */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 0',
            marginTop: 8,
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          {isDelivered && (
            <span
              style={{
                marginRight: 'auto',
                fontSize: 12.5,
                color: 'var(--warning)',
                background: 'var(--warning-bg)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              This order is delivered — editing is disabled.
            </span>
          )}
          <button
            type="button"
            onClick={() => router.push('/purchase/purchase-orders')}
            className="v2-btn v2-btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isDelivered}
            className="v2-btn v2-btn-primary"
          >
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            <Save size={14} />
            {mode === 'edit'
              ? isPending ? 'Saving...' : 'Save Changes'
              : isPending ? 'Creating...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 720px) {
          .po-order-details-grid { grid-template-columns: 1fr !important; }
          .po-date-row { grid-template-columns: 1fr !important; }
          .po-order-details-grid > .po-span-2 { grid-column: span 1 !important; }
        }
        @media (max-width: 640px) {
          .po-form-container { padding: 16px 12px 48px !important; }
        }
      `}</style>
    </div>
  )
}
