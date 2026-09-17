'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { suppliersService } from '@/services/suppliers.service'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { taxesService } from '@/services/taxes.service'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Save,
  Lock,
  Unlock,
} from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import { PriceDisplay } from '@/components/PriceDisplay'
import RecipeImportModal from './RecipeImportModal'
import { SalesOrderType } from '@/constants/global'

const formatNumber = (n: number | undefined, canReadPrice: boolean): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!canReadPrice) return '***'
  return Number(n).toLocaleString('id-ID')
}

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(1, 'Qty must be > 0'),
  price: z.coerce.number().min(0, 'Price required'),
  description: z.string().optional(),
  is_price_locked: z.boolean().optional(),
  is_taxable: z.boolean().optional(),
})

const schema = z.object({
  // supplier_id / supplier_branch_id are mutually exclusive — required-ness is
  // enforced in onSubmit based on the watchType toggle, so both stay optional
  // at the schema level.
  supplier_id: z.coerce.number().optional(),
  supplier_branch_id: z.coerce.number().optional(),
  date: z.string().min(1, 'Date is required'),
  fulfillment_date: z.string().min(1, 'Fulfillment Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
  additional_charges: z.array(z.object({
    name: z.string().min(1, 'Name required'),
    amount: z.coerce.number().min(0, 'Amount must be >= 0'),
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

export default function PurchaseOrderForm(props: PurchaseOrderFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const [showAllUoms, setShowAllUoms] = useState(false)
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

  const selectedTax = taxes.find((t: any) => t.id === watchTaxId)
  const taxRate = selectedTax?.rate ?? 0

  const taxableSubtotal = watchDetails.reduce((sum, d) => sum + (d.is_taxable ? Number(d.qty || 0) * Number(d.price || 0) : 0), 0)
  const nonTaxableSubtotal = watchDetails.reduce((sum, d) => sum + (!d.is_taxable ? Number(d.qty || 0) * Number(d.price || 0) : 0), 0)
  const subtotal = taxableSubtotal + nonTaxableSubtotal
  const taxAmount = (taxableSubtotal * taxRate) / 100
  const additionalChargesTotal = watchAdditionalCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0)
  const totalPrice = subtotal + taxAmount + additionalChargesTotal

  const activeProductTypes = useActiveBranchProductTypes()




  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-all', debouncedDropdownSearch],
    queryFn: () => suppliersService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 }).then((r) => r.data),
  })
  const suppliers = (suppliersData as any)?.data ?? []

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', debouncedDropdownSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', activeProductTypes, debouncedDropdownSearch, showAllUoms],
    queryFn: async () => {
      let allProductUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined,
            page,
            per_page: 100,
            include: 'product,uom',
            'filter[product_types]': activeProductTypes,
            'filter[is_default]': showAllUoms ? undefined : true,
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allProductUoms = allProductUoms.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allProductUoms }
    },
  })

  const handleImportRecipes = (selectedRecipes: any[]) => {
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
    Object.entries(newItems).forEach(([productUomId, qty]) => {
      const id = Number(productUomId)
      const existingIndex = finalDetails.findIndex((d) => d.product_uom_id === id)

      if (existingIndex >= 0) {
        finalDetails[existingIndex].qty += qty
      } else {
        const product = productUoms.find((p: any) => p.id === id)
        const price = product?.base_price ?? 0
        finalDetails.push({ product_uom_id: id, qty, price, description: '', is_price_locked: true, is_taxable: false })
      }
    })

    const cleanedDetails = finalDetails.filter(
      (d) => d.product_uom_id !== 0 || d.qty !== 1 || d.price !== 0 || d.description !== ''
    )

    if (cleanedDetails.length === 0) {
      cleanedDetails.push({ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: false })
    }

    setValue('details', cleanedDetails, { shouldDirty: true, shouldValidate: true })
  }

  const allProductUoms = (productUomsData as any)?.data ?? []
  const productUoms = allProductUoms.filter((pu: any) => isProductTypeAllowed(pu.product, activeProductTypes))

  // In edit mode, if an existing detail uses a non-default UOM that is not
  // returned by the default filter, automatically show all UOMs so the
  // selected item remains visible and selectable.
  useEffect(() => {
    if (mode !== 'edit' || !initialData?.details || !allProductUoms.length) return
    const availableIds = new Set(allProductUoms.map((pu: any) => pu.id))
    const hasMissing = initialData.details.some((d: any) => d.product_uom_id && !availableIds.has(d.product_uom_id))
    if (hasMissing) setShowAllUoms(true)
  }, [mode, initialData, allProductUoms])

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
  // Internal-source branches: every branch except our own.
  const sourceBranchOptions = branches
    .filter((b: any) => b.id !== currentBranchId)
    .map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Branch #${b.id}`,
      sublabel: b.code as string | undefined,
    }))
  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: (pu.product?.name as string) ?? '',
    sublabel: (pu.uom?.name as string) ?? (pu.code as string) ?? '',
    base_price: pu.base_price ?? 0,
  }))

  const hasFinalDelivery = initialData?.deliveries?.some((d: any) => d.status === 'final')

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
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        price: d.price,
        is_taxable: Boolean(d.is_taxable),
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
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', orderId] })
      toast.success('Purchase order updated')
      router.push(`/purchase/purchase-orders/${orderId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update purchase order'),
  })

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
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
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
    appearance: 'none' as any,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 4,
    display: 'block',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--background)',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'visible',
    boxShadow: 'var(--shadow-sm)',
  }

  const lineInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 1400,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Back button + title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 500,
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
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
        {/* Section 1 — Order Details */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Order Details</span>
          </div>
          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Order Date
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
            </div>

            {/* Fulfillment Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Fulfillment Date
              </label>
              <input
                type="date"
                {...register('fulfillment_date')}
                style={errors.fulfillment_date ? inputErrorStyle : inputStyle}
              />
              {errors.fulfillment_date && <span style={errorStyle}>{errors.fulfillment_date.message}</span>}
            </div>
            {/* Order source toggle — external Supplier or internal Branch */}
            <div
              style={{
                gridColumn: 'span 2',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground-muted)',
                  marginRight: 8,
                }}
              >
                Type:
              </label>
              {([
                { key: 'supplier', label: 'Supplier' },
              ] as const).map(({ key, label }) => {
                const selected = watchType === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setValue('type', key)
                      setValue('supplier_id', undefined)
                      setValue('supplier_branch_id', undefined)
                    }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: selected ? 'var(--accent)' : 'var(--background)',
                      color: selected ? 'white' : 'var(--foreground-muted)',
                      border: selected
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Supplier (external) — only when source is "supplier" */}
            {watchType === 'supplier' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Supplier
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
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
                      loading={suppliersLoading}
                      error={errors.supplier_id?.message as string | undefined}
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
              </div>
            )}

            {/* Source Branch (internal) — only when source is "branch"; spans
                the full row now that the destination "Branch" field is gone. */}
            {watchType === 'branch' && (
              <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Source Branch
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
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
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
              </div>
            )}

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Status
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['pending', 'final'] as const).map((s) => {
                      const isSelected = field.value === s
                      const isPending = s === 'pending'
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => field.onChange(s)}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: isSelected
                              ? isPending
                                ? 'var(--warning-bg)'
                                : 'var(--success-bg)'
                              : 'var(--background)',
                            color: isSelected
                              ? isPending
                                ? 'var(--warning)'
                                : 'var(--success)'
                              : 'var(--foreground-muted)',
                            border: isSelected
                              ? isPending
                                ? '1px solid var(--warning)'
                                : '1px solid var(--success)'
                              : '1px solid var(--border)',
                          }}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </div>


            {/* Notes — full width */}
            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional order notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Line Items */}
        <div style={cardStyle}>
          {/* Section header */}
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--foreground-muted)',
                letterSpacing: '0.5px',
                margin: 0,
              }}
            >
              LINE ITEMS
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={showAllUoms}
                  onChange={(e) => setShowAllUoms(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                Show all UOMs
              </label>
              <button
                type="button"
                onClick={() => setShowRecipeModal(true)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Load from Recipes
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  padding: '6px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add Item
                <kbd style={{ fontSize: 10, opacity: 0.6, background: 'var(--muted)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>
                  Ctrl+B
                </kbd>
              </button>
            </div>
          </div>

          {/* Column headers */}
          {(() => {
            const poGridCols = watchType === 'branch'
              ? '36px minmax(280px, 3fr) 110px minmax(180px, 2fr) 40px'
              : '36px minmax(280px, 3fr) 110px 160px 80px minmax(180px, 1.5fr) 40px'

            return (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: poGridCols,
                    gap: 10,
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--background)',
                    alignItems: 'center',
                  }}
                >
                  {(watchType === 'branch' ? ['#', 'Product / UOM', 'Qty', 'Notes', ''] : ['#', 'Product / UOM', 'Qty', 'Unit Price', 'Taxable', 'Notes', '']).map((h, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--foreground-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        textAlign: h === 'Taxable' || h === '#' || h === '' ? 'center' : 'left',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Line item rows */}
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    data-po-row-index={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: poGridCols,
                      gap: 10,
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'start',
                    }}
                  >
                    {/* Row index */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 38,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Product UOM */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <Controller
                  name={`details.${index}.product_uom_id`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchableSelect
                      dataFocusFirst={true}
                      value={f.value ?? 0}
                      onChange={(val) => {
                        f.onChange(val)

                        const matchingUom = productUoms.find((pu: any) => pu.id === val)
                        if (matchingUom) {
                          setValue(`details.${index}.price`, matchingUom.base_price ?? 0)
                        }
                      }}
                      options={productUomOptions.filter((o: any) => {
                        const selectedIds = watch('details').map(d => d.product_uom_id).filter(id => id > 0)
                        return !selectedIds.includes(o.value) || o.value === f.value
                      })}
                      placeholder="Select product..."
                      searchPlaceholder="Search products..."
                      loading={productUomsLoading}
                      error={
                        errors.details?.[index]?.product_uom_id?.message as
                        | string
                        | undefined
                      }
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
              </div>

              {/* Qty */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={{
                    ...lineInputStyle,
                    ...(hasFinalDelivery ? { background: 'var(--surface)', cursor: 'not-allowed' } : {})
                  }}
                  disabled={hasFinalDelivery}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
              </div>

              {/* Price */}
              {watchType !== 'branch' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(watch(`details.${index}.price`), getCanReadPrice())}
                      disabled={watch(`details.${index}.is_price_locked`) !== false || !getCanReadPrice() || (watchType === 'supplier' ? !canEditExternalPrice : !canEditInternalPrice)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, '')
                        setValue(
                          `details.${index}.price`,
                          raw === '' ? 0 : parseInt(raw, 10) || 0,
                        )
                      }}
                      style={{
                        ...lineInputStyle,
                        flex: 1,
                        ...((watch(`details.${index}.is_price_locked`) !== false || !getCanReadPrice() || (watchType === 'supplier' ? !canEditExternalPrice : !canEditInternalPrice))
                          ? { background: 'var(--surface)', cursor: 'not-allowed' }
                          : {}),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const currentLocked = watch(`details.${index}.is_price_locked`)
                        setValue(`details.${index}.is_price_locked`, currentLocked === false ? true : false)
                      }}
                      title={watch(`details.${index}.is_price_locked`) !== false ? "Unlock price" : "Lock price"}
                      style={{
                        padding: 6,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        color: watch(`details.${index}.is_price_locked`) !== false ? 'var(--foreground-muted)' : 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
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
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {getCanReadPrice()
                          ? `Last: Rp ${formatCurrency(last.price, '')}`
                          : `Last: Rp ***`}
                        {last.date ? ` · ${String(last.date).slice(0, 10)}` : ''}
                      </span>
                    )
                  })()}
                </div>
              )}

              {/* Taxable Checkbox */}
              {watchType !== 'branch' && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                  <input
                    type="checkbox"
                    {...register(`details.${index}.is_taxable`)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                </div>
              )}

              {/* Description */}
              <input
                {...register(`details.${index}.description`)}
                placeholder="Optional note"
                style={lineInputStyle}
              />

              {/* Delete */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38 }}>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  style={{
                    padding: 6,
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: fields.length === 1 ? 'not-allowed' : 'pointer',
                    color: fields.length === 1 ? 'var(--border)' : 'var(--destructive)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          </>
          )})()}

          {/* Additional Charges */}
          <div style={{ marginTop: 24, marginBottom: 16, padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', letterSpacing: '0.5px', margin: 0, textTransform: 'uppercase' }}>
                Additional Charges
              </h3>
              <button
                type="button"
                onClick={() => appendCharge({ name: '', amount: 0 })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Charge
              </button>
            </div>
            {chargeFields.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {chargeFields.map((field, index) => (
                  <div key={field.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 2 }}>
                      <input
                        {...register(`additional_charges.${index}.name`)}
                        placeholder="Charge Name *"
                        style={lineInputStyle}
                      />
                      {errors.additional_charges?.[index]?.name && (
                        <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{errors.additional_charges[index].name.message}</span>
                      )}
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--foreground-muted)' }}>Rp</span>
                        <input
                          type="number"
                          min="0"
                          {...register(`additional_charges.${index}.amount`, { valueAsNumber: true })}
                          placeholder="Amount *"
                          style={{ ...lineInputStyle, paddingLeft: 32 }}
                        />
                      </div>
                      {errors.additional_charges?.[index]?.amount && (
                        <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{errors.additional_charges[index].amount.message}</span>
                      )}
                    </div>
                    <div style={{ flex: 2 }}>
                      <input
                        {...register(`additional_charges.${index}.description`)}
                        placeholder="Optional Note"
                        style={lineInputStyle}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCharge(index)}
                      style={{ padding: '8px 6px', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total row */}
          {/* Additional Charges and Totals section */}
          {watchType !== 'branch' && (
            <div
              style={{
                padding: '14px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'flex-end',
                gap: 4,
                borderTop: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--foreground-muted)' }}>
                <span>Subtotal:</span>
                <span><PriceDisplay amount={subtotal} prefix="Rp " /></span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--foreground-muted)', alignItems: 'center' }}>
                <span>Tax:</span>
                <Controller
                  name="tax_id"
                  control={control}
                  render={({ field }) => (
                    <select
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      style={{ ...selectStyle, padding: '4px 8px', width: 'auto', flex: 1, minWidth: 150 }}
                    >
                      <option value="">No Tax</option>
                      {taxes.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--foreground-muted)' }}>
                  <span>Tax Amount:</span>
                  <span><PriceDisplay amount={taxAmount} prefix="Rp " /></span>
                </div>
              {additionalChargesTotal > 0 && (
                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--foreground-muted)' }}>
                  <span>Additional Charges:</span>
                  <span><PriceDisplay amount={additionalChargesTotal} prefix="Rp " /></span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  <PriceDisplay amount={totalPrice} prefix="Rp " />
                </span>
              </div>
            </div>
          )}

          {/* Array-level error */}
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
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: '9px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
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
      `}</style>
    </div>
  )
}

