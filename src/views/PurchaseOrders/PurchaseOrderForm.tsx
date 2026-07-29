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
import { useAuth } from '@/hooks/useAuth'
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Save,
} from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { PriceDisplay } from '@/components/PriceDisplay'
import RecipeImportModal from './RecipeImportModal'

const formatNumber = (n: number | undefined, canReadPrice: boolean): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!canReadPrice) return '***'
  return Number(n).toLocaleString('id-ID')
}

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(0.01, 'Qty must be > 0'),
  price: z.coerce.number().min(0, 'Price required'),
  description: z.string().optional(),
})

const schema = z.object({
  // supplier_id / supplier_branch_id are mutually exclusive — required-ness is
  // enforced in onSubmit based on the poSourceType toggle, so both stay optional
  // at the schema level.
  supplier_id: z.coerce.number().optional(),
  supplier_branch_id: z.coerce.number().optional(),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
  type: z.string().optional(),
  total_price: z.coerce.number().optional(),
})

type FormValues = z.infer<typeof schema>

interface PurchaseOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  orderId?: number
}

export default function PurchaseOrderForm(props: PurchaseOrderFormProps) {
  const { mode, initialData, orderId } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const { user } = useAuth()
  const currentBranchId = (user as any)?.branch?.id

  const [showRecipeModal, setShowRecipeModal] = useState(false)

  // Order source: external Supplier (default) or internal Branch — mutually
  // exclusive.
  const [poSourceType, setPoSourceType] = useState<'supplier' | 'branch'>('supplier')

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
      status: 'pending',
      description: '',
      details: [{ product_uom_id: 0, qty: 1, price: 0, description: '' }],
      type: 'standard',
      total_price: 0,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const watchSupplierId = watch('supplier_id')
  const totalPrice = watchDetails.reduce(
    (sum, d) => sum + Number(d.qty) * Number(d.price),
    0
  )

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersService.list({ per_page: 100 }).then((r) => r.data),
  })
  const suppliers = (suppliersData as any)?.data ?? []

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: async () => {
      let allProductUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ page, per_page: 100, include: 'product,uom' } as any)
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
        finalDetails.push({ product_uom_id: id, qty, price, description: '' })
      }
    })

    const cleanedDetails = finalDetails.filter(
      (d) => d.product_uom_id !== 0 || d.qty !== 1 || d.price !== 0 || d.description !== ''
    )
    
    if (cleanedDetails.length === 0) {
      cleanedDetails.push({ product_uom_id: 0, qty: 1, price: 0, description: '' })
    }

    setValue('details', cleanedDetails, { shouldDirty: true, shouldValidate: true })
  }
  const productUoms = (productUomsData as any)?.data ?? []

  // Last-purchase-price history for the selected supplier. Reads existing POs;
  // no backend change. Newest entry per product_uom_id (POs sorted -date).
  const { data: historyData } = useQuery({
    queryKey: ['po-supplier-history', watchSupplierId],
    enabled:
      poSourceType === 'supplier' && !!watchSupplierId && watchSupplierId > 0,
    queryFn: () =>
      purchaseOrdersService
        .list({
          'filter[supplier_id]': watchSupplierId,
          include: 'purchase_order_details,purchase_order_details.product_uom',
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
  }))

  useEffect(() => {
    if (initialData && mode === 'edit') {
      // branch_id (the old destination-branch field) is intentionally dropped
      // here so it never re-enters the form / payload.
      reset({ ...initialData, branch_id: undefined })
      if (initialData.supplier_branch_id) setPoSourceType('branch')
    }
  }, [initialData, mode])

  const buildPayload = (values: FormValues) => ({
    ...values,
    total_price: totalPrice,
    type: poSourceType === 'branch' ? 'branch' : 'supplier',
    supplier_id:
      poSourceType === 'supplier' ? values.supplier_id || undefined : undefined,
    supplier_branch_id:
      poSourceType === 'branch' ? values.supplier_branch_id || undefined : undefined,
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        price: d.price,
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
    if (poSourceType === 'supplier' && !values.supplier_id) {
      setError('supplier_id', { message: 'Supplier is required' })
      return
    }
    if (poSourceType === 'branch' && !values.supplier_branch_id) {
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
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 960,
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
                Order From:
              </label>
              {([
                { key: 'supplier', label: 'Supplier' },
                { key: 'branch', label: 'Internal Branch' },
              ] as const).map(({ key, label }) => {
                const selected = poSourceType === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPoSourceType(key)
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
            {poSourceType === 'supplier' && (
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
                    />
                  )}
                />
              </div>
            )}

            {/* Source Branch (internal) — only when source is "branch"; spans
                the full row now that the destination "Branch" field is gone. */}
            {poSourceType === 'branch' && (
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
              <div style={{ display: 'flex', gap: 8 }}>
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
                  onClick={() =>
                    append({ product_uom_id: 0, qty: 1, price: 0, description: '' })
                  }
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
                </button>
              </div>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 100px 130px 1fr 40px',
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            {['Product / UOM', 'Qty', 'Unit Price', 'Notes', ''].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
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
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 100px 130px 1fr 40px',
                gap: 10,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              {/* Product UOM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Controller
                  name={`details.${index}.product_uom_id`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchableSelect
                      value={f.value ?? 0}
                      onChange={(val) => {
                        f.onChange(val)

                        const matchingUom = productUoms.find((pu: any) => pu.id === val)
                        if (matchingUom) {
                          setValue(`details.${index}.price`, matchingUom.base_price ?? 0)
                        }
                      }}
                      options={productUomOptions}
                      placeholder="Select product..."
                      searchPlaceholder="Search products..."
                      loading={productUomsLoading}
                      error={
                        errors.details?.[index]?.product_uom_id?.message as
                        | string
                        | undefined
                      }
                    />
                  )}
                />
              </div>

              {/* Qty */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={lineInputStyle}
                />
              </div>

              {/* Price */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(watch(`details.${index}.price`), getCanReadPrice())}
                  disabled={!getCanReadPrice()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '')
                    setValue(
                      `details.${index}.price`,
                      raw === '' ? 0 : parseInt(raw, 10) || 0,
                    )
                  }}
                  style={lineInputStyle}
                />
                {(() => {
                  if (poSourceType !== 'supplier') return null
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

              {/* Description */}
              <input
                {...register(`details.${index}.description`)}
                placeholder="Optional note"
                style={lineInputStyle}
              />

              {/* Delete */}
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
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Total row */}
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              borderTop: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Total</span>
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
