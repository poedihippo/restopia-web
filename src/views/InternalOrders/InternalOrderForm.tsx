'use client'

import React, { useState,  useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import RecipeImportModal from '@/views/PurchaseOrders/RecipeImportModal'
import { getProductUomName } from '@/utils/productUomName'

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(0.01, 'Qty must be > 0'),
  description: z.string().optional(),
})

const schema = z.object({
  supplier_branch_id: z.coerce.number().min(1, 'Source branch is required'),
  date: z.string().min(1, 'Date is required'),
  fulfillment_date: z.string().min(1, 'Fulfillment Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
})

type FormValues = z.infer<typeof schema>

interface InternalOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  orderId?: number
}

export default function InternalOrderForm(props: InternalOrderFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { mode, initialData, orderId } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const { user } = useAuth()
  const myBranchId = (user as any)?.branch?.id
  const [showRecipeModal, setShowRecipeModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplier_branch_id: 0,
      date: new Date().toISOString().split('T')[0],
      fulfillment_date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      details: [{ product_uom_id: 0, qty: 1, description: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const [focusNewRowIndex, setFocusNewRowIndex] = useState<number | null>(null)

  const handleAddItem = () => {
    append({ product_uom_id: 0, qty: 1, description: '' })
    setFocusNewRowIndex(fields.length)
  }

  useFormKeyboardNavigation({
    onAddItem: handleAddItem,
  })

  useEffect(() => {
    if (focusNewRowIndex !== null) {
      const timer = setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-io-row-index="${focusNewRowIndex}"] [data-focus-first="true"], [data-io-row-index="${focusNewRowIndex}"] button, [data-io-row-index="${focusNewRowIndex}"] input`
        )
        if (el) {
          el.focus()
        }
        setFocusNewRowIndex(null)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [focusNewRowIndex, fields.length])

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', debouncedDropdownSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  // Filter branch_type dari auth/me (user.branch.type) agar SKU sesuai tipe branch.
  // Pengecualian: branch type "outlet" tidak perlu difilter — tampilkan semua product-UOM.
  const branchTypeRaw = ((user as any)?.branch?.type as string | undefined) || ''
  const activeBranchType = branchTypeRaw && branchTypeRaw !== 'outlet' ? branchTypeRaw : undefined
  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', activeBranchType, debouncedDropdownSearch],
    queryFn: () =>
      productUomsService
        .list({
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 1000,
          include: 'product,uom',
          'filter[product_types]': 'wip,raw,supply',
          'filter[branch_type]': activeBranchType,
          'filter[is_active]': true,
        } as any)
        .then((r) => r.data),
  })
  const allProductUoms = (productUomsData as any)?.data ?? []
  const productUoms = allProductUoms

  // Internal-source branches: every branch except our own.
  const sourceBranchOptions = branches
    .filter((b: any) => b.id !== myBranchId)
    .map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Branch #${b.id}`,
      sublabel: b.code as string | undefined,
    }))
  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: getProductUomName(pu, pu.product?.name) || '',
    sublabel: (pu.uom?.name as string) ?? '',
    description: (pu.code as string) ?? undefined,
    price: pu.base_price ?? 0,
  }))

  const handleImportRecipes = (selectedRecipes: any[]) => {
    const currentDetails = watch('details')
    const newItems: Record<number, number> = {}

    selectedRecipes.forEach((recipe) => {
      recipe.recipe_materials?.forEach((material: any) => {
        const uomId = material.product_uom_id
        if (!uomId) return
        if (newItems[uomId]) {
          newItems[uomId] += Number(material.qty) || 0
        } else {
          newItems[uomId] = Number(material.qty) || 0
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
        finalDetails.push({ product_uom_id: id, qty, description: '' })
      }
    })

    const cleanedDetails = finalDetails.filter(
      (d) => d.product_uom_id !== 0 || d.qty !== 1 || (d.description && d.description !== '')
    )

    setValue(
      'details',
      cleanedDetails.length > 0
        ? cleanedDetails
        : [{ product_uom_id: 0, qty: 1, description: '' }],
      { shouldDirty: true, shouldValidate: true }
    )
    setShowRecipeModal(false)
    toast.success(`Successfully imported materials from ${selectedRecipes.length} recipe(s)`)
  }

  useEffect(() => {
    if (initialData && mode === 'edit') {
      reset({
        ...initialData,
        date: initialData.date?.split('T')[0],
        fulfillment_date: initialData.fulfillment_date?.split('T')[0],
      })
    }
  }, [initialData, mode])

  // Internal orders are always type 'branch'; supplier_id is never sent.
  const watchDetails = watch('details')

  const buildPayload = (values: FormValues) => ({
    ...values,
    fulfillment_date: values.fulfillment_date ? new Date(values.fulfillment_date).toISOString().split('T')[0] : undefined,
    type: 'branch',
    supplier_branch_id: values.supplier_branch_id || undefined,
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        description: d.description || undefined,
      })),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.create(buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-orders'] })
      toast.success('Internal order created')
      router.push('/purchase/internal-orders')
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create internal order'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.update(orderId!, buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-orders'] })
      queryClient.invalidateQueries({ queryKey: ['internal-order-detail', orderId] })
      toast.success('Internal order updated')
      router.push(`/purchase/internal-orders/${orderId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update internal order'),
  })

  const onSubmit = (values: FormValues) => {
    if (mode === 'edit' && orderId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isDelivered = mode === 'edit' && initialData?.status === 'delivered'

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

  const lineGridCols = '36px minmax(280px, 3fr) 110px 140px minmax(180px, 2fr) 40px'

  return (
    <div
      className="io-form-container"
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
          flexWrap: 'wrap',
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
            {mode === 'edit' ? 'Edit Internal Order' : 'New Internal Order'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit'
              ? 'Update the details of this internal order'
              : 'Order stock from another branch'}
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
            className="io-order-details-grid"
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
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('fulfillment_date')}
                style={errors.fulfillment_date ? inputErrorStyle : inputStyle}
              />
              {errors.fulfillment_date && <span style={errorStyle}>{errors.fulfillment_date.message}</span>}
            </div>

            {/* Source Branch (internal) — always shown; type is locked to branch. */}
            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Order From
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                Branch that will supply the stock
              </span>
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
                      const isPendingStatus = s === 'pending'
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
                              ? isPendingStatus
                                ? 'var(--warning-bg)'
                                : 'var(--success-bg)'
                              : 'var(--background)',
                            color: isSelected
                              ? isPendingStatus
                                ? 'var(--warning)'
                                : 'var(--success)'
                              : 'var(--foreground-muted)',
                            border: isSelected
                              ? isPendingStatus
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
        <div style={cardStyle} className="io-form-responsive">
          {/* Section header */}
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={sectionLabelStyle}>Line Items</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  background: 'var(--accent-light-bg)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                Add Item
                <kbd style={{ fontSize: 10, opacity: 0.7, background: 'var(--muted)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>
                  Ctrl+B
                </kbd>
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: lineGridCols,
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
              alignItems: 'center',
            }}
          >
            {['#', 'Product / UOM', 'Qty', 'Subtotal', 'Notes', ''].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  textAlign: h === 'Subtotal' ? 'right' : h === '#' || h === '' ? 'center' : 'left',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Line item rows */}
          {(() => {
            // Single useWatch for the whole array — keeps the hook count
            // stable across renders (rules of hooks friendly).
            const watchedDetails = (useWatch({ control, name: 'details' }) ?? []) as any[]
            return fields.map((field, index) => {
              const rowQty = watchedDetails?.[index]?.qty
              return (
            <div
              key={field.id}
              data-io-row-index={index}
              style={{
                display: 'grid',
                gridTemplateColumns: lineGridCols,
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
                        const opt = productUomOptions.find((o: any) => o.value === val)
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
                  min={0.01}
                  step={0.01}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={lineInputStyle}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                />
              </div>

              {/* Subtotal (qty — internal orders have no per-item price) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: 38,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  whiteSpace: 'nowrap',
                }}
              >
                {Number(rowQty ?? 0).toLocaleString('id-ID')}
              </div>

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
              )
            })
          })()}

          {/* Array-level error */}
          {errors.details && typeof (errors.details as any).message === 'string' && (
            <div style={{ padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            </div>
          )}

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

          </div>
        </div>

        {/* Form actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 4,
            flexWrap: 'wrap',
          }}
        >
          {isDelivered && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--warning)',
                background: 'var(--warning-bg)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                alignSelf: 'center',
              }}
            >
              This order is delivered — editing is disabled.
            </span>
          )}
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
            disabled={isPending || isDelivered}
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
              cursor: isPending || isDelivered ? 'not-allowed' : 'pointer',
              opacity: isPending || isDelivered ? 0.5 : 1,
            }}
          >
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            <Save size={14} />
            {mode === 'edit'
              ? isPending ? 'Saving...' : 'Save Changes'
              : isPending ? 'Creating...' : 'Create Internal Order'}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .io-form-responsive { overflow-x: auto; }
        .io-form-responsive > * { min-width: 720px; }
        @media (max-width: 900px) {
          .io-order-details-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .io-form-container { padding: 16px 12px 48px !important; }
        }
      `}</style>
    </div>
  )
}
