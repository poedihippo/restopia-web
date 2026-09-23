'use client'

import React, { useEffect } from 'react'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsService } from '@/services/products.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { uomsService } from '@/services/uoms.service'
import { parseApiError, toastMutationApiError } from '@/utils/apiError'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import { X, Loader2, Plus, Trash2, Repeat } from 'lucide-react'

const conversionSchema = z.object({
  id: z.coerce.number().min(0),
  target_uom_id: z.coerce.number().min(1, 'Target unit is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
})

const uomSchema = z.object({
  id: z.coerce.number().min(0),
  uom_id: z.coerce.number().min(1, 'Unit is required'),
  code: z.string().min(1, 'Code is required'),
  base_price: z.coerce.number().min(0),
  online_price: z.coerce.number().min(0),
  franchise_price: z.coerce.number().min(0),
  price_editable: z.boolean(),
  is_default: z.boolean(),
  is_active: z.boolean(),
  uom_name: z.string().optional(),
  uom_code: z.string().optional(),
  conversions: z.array(conversionSchema),
})

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  product_category_id: z.coerce.number().min(1, 'Category is required'),
  type: z.string().min(1, 'Type is required'),
  description: z.string().optional(),
  is_active: z.boolean(),
  base_uom_id: z.coerce.number().optional().nullable(),
  reorder_point: z.coerce.number().int().min(0).nullable().optional(),
  uoms: z
    .array(uomSchema)
    .superRefine((uoms, ctx) => {
      const uomIds = uoms.map((u) => u.uom_id)
      uomIds.forEach((uid, i) => {
        if (uomIds.indexOf(uid) !== i) {
          ctx.addIssue({ code: 'custom', path: [i, 'uom_id'], message: 'Each unit may only appear once per product' })
        }
      })
      const codes = uoms.map((u) => u.code.trim().toLowerCase())
      codes.forEach((c, i) => {
        if (codes.indexOf(c) !== i) {
          ctx.addIssue({ code: 'custom', path: [i, 'code'], message: 'Duplicate unit code' })
        }
      })
      if (uoms.filter((u) => u.is_default).length > 1) {
        uoms.forEach((u, i) => {
          if (u.is_default) {
            ctx.addIssue({ code: 'custom', path: [i, 'is_default'], message: 'Only one unit can be marked as default' })
          }
        })
      }
      const pairSet = new Set<string>()
      uoms.forEach((u, i) => {
        u.conversions.forEach((c, j) => {
          if (c.target_uom_id === u.uom_id) {
            ctx.addIssue({ code: 'custom', path: [i, 'conversions', j, 'target_uom_id'], message: 'A unit cannot have a conversion to itself' })
            return
          }
          if (!uomIds.includes(c.target_uom_id)) {
            ctx.addIssue({ code: 'custom', path: [i, 'conversions', j, 'target_uom_id'], message: 'Target unit must be one of this product\'s units' })
            return
          }
          const key = `${u.uom_id}->${c.target_uom_id}`
          if (pairSet.has(key)) {
            ctx.addIssue({ code: 'custom', path: [i, 'conversions', j, 'target_uom_id'], message: 'A conversion for this unit pair already exists' })
          } else {
            pairSet.add(key)
          }
        })
      })
    }),
})
type FormValues = z.infer<typeof schema>

const emptyUom = {
  id: 0,
  uom_id: 0,
  code: '',
  base_price: 0,
  online_price: 0,
  franchise_price: 0,
  price_editable: false,
  is_default: false,
  is_active: true,
  uom_name: '',
  uom_code: '',
  conversions: [] as { id: number; target_uom_id: number; amount: number }[],
}

const emptyConversion = { id: 0, target_uom_id: 0, amount: 0 }

// Helper: find conversion path from a source uom_id to target base_uom_id
// through the graph of product-UOM conversions. Returns null if no path.
function findConversionPath(
  sourceUomId: number,
  targetUomId: number,
  uoms: any[],
  visited = new Set<number>()
): { uomId: number; amount: number; code?: string; name?: string }[] | null {
  if (sourceUomId === targetUomId) {
    const u = uoms.find((x) => x.uom_id === sourceUomId)
    return [{ uomId: sourceUomId, amount: 1, code: u?.uom_code, name: u?.uom_name }]
  }
  if (visited.has(sourceUomId)) return null
  visited.add(sourceUomId)

  const sourceUom = uoms.find((u) => u.uom_id === sourceUomId)
  if (!sourceUom) return null

  for (const c of sourceUom.conversions ?? []) {
    const targetId = Number(c.target_uom_id)
    if (targetId === targetUomId) {
      const targetUom = uoms.find((u) => u.uom_id === targetId)
      return [
        { uomId: sourceUomId, amount: 1, code: sourceUom?.uom_code, name: sourceUom?.uom_name },
        { uomId: targetId, amount: Number(c.amount), code: targetUom?.uom_code, name: targetUom?.uom_name },
      ]
    }
    const subPath = findConversionPath(targetId, targetUomId, uoms, new Set(visited))
    if (subPath) {
      const multiplier = Number(c.amount)
      return [
        { uomId: sourceUomId, amount: 1, code: sourceUom?.uom_code, name: sourceUom?.uom_name },
        ...subPath.map((step) => ({ ...step, amount: step.amount * multiplier })),
      ]
    }
  }
  return null
}

const GUARD_MESSAGES: { match: RegExp; message: string }[] = [
  { match: /product uom has product inventories/i, message: 'This unit has stock / inventory batches. Clear its inventory before changing or removing it.' },
  { match: /product uom has recipes/i, message: 'This unit is used in recipes. Remove those recipes first.' },
  { match: /product uom has voucher product uoms/i, message: 'This unit is linked to vouchers. Unlink those vouchers first.' },
  { match: /cannot change conversion factor/i, message: 'The conversion factor cannot be changed because this product has stock movement history. Create a stock adjustment instead.' },
]

const showError = (err: any, fallback: string) => {
  const msg = parseApiError(err)
  const guard = GUARD_MESSAGES.find((g) => g.match.test(msg))
  if (guard) {
    toast.error(guard.message)
    return
  }
  toastMutationApiError(err, fallback)
}

interface ProductSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    name: string
    code?: string
    product_category_id: number
    type?: 'raw' | 'wip' | 'final' | 'supply'
    description?: string
    is_active: boolean
    base_uom_id?: number | null
    reorder_point?: number | null
  } | null
}

export default function ProductSheet({ open, onClose, editData }: ProductSheetProps) {
  const queryClient = useQueryClient()
  const activeProductTypes = useActiveBranchProductTypes()
  const allowedTypes = activeProductTypes
    ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
    : null

  const allTypeOptions = [
    { value: 'raw', label: 'Raw' },
    { value: 'wip', label: 'WIP' },
    { value: 'final', label: 'Final' },
    { value: 'supply', label: 'Supply' },
  ]

  const availableTypeOptions = allowedTypes
    ? allTypeOptions.filter(
        (o) =>
          allowedTypes.includes(o.value) ||
          (o.value === 'supply' && allowedTypes.includes('supplies')),
      )
    : allTypeOptions

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      code: '',
      product_category_id: 0,
      type: '',
      description: '',
      is_active: true,
      base_uom_id: null,
      reorder_point: null,
      uoms: [],
    },
  })

  const { fields: uomFields, append: appendUom, remove: removeUom } = useFieldArray({ control, name: 'uoms' })
  const watchedUoms: any[] = useWatch({ control, name: 'uoms' }) ?? []
  const productCode = watch('code')
  const baseUomId = watch('base_uom_id')

  const { data: catData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService
        .list({ per_page: 100 })
        .then((r) => r.data),
  })
  const categories = (catData as any)?.data ?? []

  const { data: uomsData } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: () =>
      uomsService
        .list({ per_page: 1000 } as any)
        .then((r) => r.data),
  })
  const uoms: any[] = (uomsData as any)?.data ?? []

  // In edit mode, load the full product (with nested UOMs + conversions)
  const detailQuery = useQuery({
    queryKey: ['product-detail', editData?.id],
    queryFn: () => productsService.findById(editData!.id).then((r) => r.data),
    enabled: open && !!editData,
  })
  const detail = (detailQuery.data as any)?.data

  useEffect(() => {
    if (!open) return
    if (!editData) {
      reset({
        name: '',
        code: '',
        product_category_id: 0,
        type: '',
        description: '',
        is_active: true,
        base_uom_id: null,
        reorder_point: null,
        uoms: [],
      })
      return
    }
    if (!detail) return
    reset({
      name: detail.name ?? editData.name ?? '',
      code: detail.code ?? editData.code ?? '',
      product_category_id: detail.product_category_id ?? editData.product_category_id ?? 0,
      type: detail.type ?? editData.type ?? '',
      description: detail.description ?? editData.description ?? '',
      is_active: detail.is_active ?? editData.is_active ?? true,
      base_uom_id: detail.base_uom_id ?? null,
      reorder_point: detail.reorder_point ?? null,
      uoms: (detail.product_uoms ?? []).map((pu: any) => ({
        id: pu.id ?? 0,
        uom_id: pu.uom_id ?? 0,
        code: pu.code ?? '',
        base_price: pu.base_price ?? 0,
        online_price: pu.online_price ?? 0,
        franchise_price: pu.franchise_price ?? 0,
        price_editable: !!pu.price_editable,
        is_default: !!pu.is_default,
        is_active: pu.is_active ?? true,
        uom_name: pu.uom_name ?? pu.uom?.name ?? '',
        uom_code: pu.uom_code ?? pu.uom?.code ?? '',
        conversions: (pu.conversions ?? []).map((c: any) => ({
          id: c.id ?? 0,
          target_uom_id: c.target_uom_id ?? 0,
          amount: c.amount ?? 0,
        })),
      })),
    })
  }, [open, editData, detail, reset])

  const buildPayload = (values: FormValues) => {
    const payload: Record<string, unknown> = {
      product_category_id: values.product_category_id,
      code: values.code ?? '',
      name: values.name,
      type: values.type,
      description: values.description ?? '',
      is_active: values.is_active,
      base_uom_id: values.base_uom_id ?? null,
      reorder_point: values.reorder_point ?? null,
    }
    const uoms = values.uoms.map((u) => ({
      ...(u.id > 0 ? { id: u.id } : {}),
      uom_id: u.uom_id,
      code: u.code.trim(),
      base_price: u.base_price,
      online_price: u.online_price,
      franchise_price: u.franchise_price,
      price_editable: u.price_editable,
      is_default: u.is_default,
      is_active: u.is_active,
      conversions: u.conversions.map((c) => ({
        ...(c.id > 0 ? { id: c.id } : {}),
        target_uom_id: c.target_uom_id,
        amount: c.amount,
      })),
    }))
    // Create: omit `uoms` entirely when none added (header-only).
    // Update: always send the full desired UOM state (replace-by-diff);
    // `uoms: []` means delete all.
    if (editData || uoms.length > 0) payload.uoms = uoms
    return payload
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productsService.create(buildPayload(data) as any),
    onSuccess: async (res: any) => {
      // Reload via GET /products/:id to confirm final state and pick up
      // server-assigned IDs (detail_map) instead of patching local state.
      const newId = res?.data?.data?.id ?? res?.data?.id
      if (newId) {
        try { await productsService.findById(newId) } catch { /* non-fatal */ }
      }
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Product created')
      onClose()
    },
    onError: (err: any) => showError(err, 'Failed to create product'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productsService.update(editData!.id, buildPayload(data) as any),
    onSuccess: async () => {
      // Reload via GET /products/:id to confirm the final saved state.
      try { await productsService.findById(editData!.id) } catch { /* non-fatal */ }
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-detail', editData!.id] })
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Product updated')
      onClose()
    },
    onError: (err: any) => showError(err, 'Failed to update product'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }

  const firstErrorMessage = (e: any): string | undefined => {
    if (!e) return undefined
    if (typeof e.message === 'string') return e.message
    for (const key of Object.keys(e)) {
      const msg = firstErrorMessage(e[key])
      if (msg) return msg
    }
    return undefined
  }

  const onInvalid = (errs: any) => {
    toast.error(firstErrorMessage(errs) ?? 'Please fill in all required fields')
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const editLoading = !!editData && detailQuery.isLoading
  const editError = !!editData && detailQuery.isError && !detail

  const uomLabel = (id: number) => {
    const uom = uoms.find((u) => u.id === id)
    return uom ? `${uom.name} (${uom.code})` : `UOM #${id}`
  }

  const setDefaultUom = (idx: number, value: boolean) => {
    if (value) {
      watchedUoms.forEach((_, i) => setValue(`uoms.${i}.is_default` as any, false))
    }
    setValue(`uoms.${idx}.is_default` as any, value)
  }

  if (!open) return null

  const fieldLabel = (text: string, required = false) => (
    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
      {text}
      {required && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
    </label>
  )

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--foreground-muted)',
    display: 'block',
    marginBottom: 6,
  }

  const inputBase = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${hasError ? 'var(--destructive)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  })

  const selectBase: React.CSSProperties = {
    width: '100%',
    height: 40,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 12px',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    boxSizing: 'border-box' as const,
    fontFamily: 'var(--font-sans)',
  }

  const errorMsg = (msg?: string) =>
    msg ? (
      <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{msg}</span>
    ) : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 520,
          height: '100%',
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
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {editData ? 'Edit Product' : 'New Product'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--foreground-muted)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {editLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 48 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--foreground-muted)' }} />
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading product...</span>
            </div>
          ) : editError ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--destructive)' }}>
              Failed to load product details. Close and try again.
            </div>
          ) : (
            <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Required fields</span>
          </div>
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Product Name', true)}
            <input
              {...register('name')}
              placeholder="e.g. Chocolate Truffle Cake"
              style={inputBase(!!errors.name)}
            />
            {errorMsg(errors.name?.message)}
          </div>

          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Product Code')}
            <input
              {...register('code')}
              placeholder="e.g. CHOC-001 (optional)"
              style={inputBase(false)}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Category
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <select
              {...register('product_category_id', { valueAsNumber: true })}
              style={selectBase}
            >
              <option value={0}>Select category...</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errorMsg(errors.product_category_id?.message)}
          </div>

          {/* Type */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Type
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <select {...register('type')} style={selectBase}>
              <option value="">Select type...</option>
              {availableTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errorMsg(errors.type?.message)}
          </div>

          {/* Base Unit */}
          <div>
            <label style={labelStyle}>Base Unit</label>
            <Controller
              name="base_uom_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  style={selectBase}
                >
                  <option value="">— None —</option>
                  {uoms.map((uom: any) => (
                    <option key={uom.id} value={uom.id}>
                      {uom.name} ({uom.code})
                    </option>
                  ))}
                </select>
              )}
            />
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
              The smallest unit stock is tracked in (e.g. grams, ml)
            </span>
          </div>

          {/* Reorder Point */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Reorder Point')}
            <Controller
              name="reorder_point"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="Kosongkan jika tidak dipakai"
                  style={inputBase(!!errors.reorder_point)}
                />
              )}
            />
            {errorMsg(errors.reorder_point?.message as string | undefined)}
          </div>

          {/* Is Active */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Active', true)}
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => field.onChange(val)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: field.value === val
                          ? val ? 'var(--success-bg)' : 'var(--destructive-bg)'
                          : 'var(--background)',
                        color: field.value === val
                          ? val ? 'var(--success)' : 'var(--destructive)'
                          : 'var(--foreground-muted)',
                        border: field.value === val
                          ? `1px solid ${val ? 'var(--success)' : 'var(--destructive)'}`
                          : '1px solid var(--border)',
                      }}
                    >
                      {val ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Description')}
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Optional notes about this product"
              style={{ ...inputBase(false), resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Units (Product UOMs) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--foreground)' }}>
                  Units &amp; Prices
                </span>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
                  Units this product is sold/tracked in, with prices and conversions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => appendUom({ ...emptyUom, conversions: [] })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Add Unit
              </button>
            </div>

            {editData && (
              <span style={{ fontSize: 11, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                Removing a unit here deletes it. Units with stock, recipes, or vouchers linked cannot be removed.
              </span>
            )}

            {uomFields.map((uf, i) => {
              const uomErr = (errors as any)?.uoms?.[i]
              const usedUomIds = new Set(
                (watchedUoms ?? [])
                  .map((wu: any, idx: number) => (idx !== i ? Number(wu?.uom_id) : 0))
                  .filter((id: number) => id > 0),
              )
              const targetOptions = (watchedUoms ?? [])
                .map((wu: any, idx: number) => ({ wu, idx }))
                .filter(({ wu, idx }: any) => idx !== i && Number(wu?.uom_id) > 0)
                .map(({ wu }: any) => {
                  const fallback = uomLabel(Number(wu.uom_id))
                  const label = wu?.uom_name
                    ? `${wu.uom_name}${wu.uom_code ? ` (${wu.uom_code})` : ''}`
                    : fallback
                  return { value: Number(wu.uom_id), label }
                })

              const currentUomId = Number(watchedUoms[i]?.uom_id)
              const conversionPath = baseUomId && currentUomId > 0
                ? findConversionPath(currentUomId, Number(baseUomId), watchedUoms)
                : null
              const pathMissing = baseUomId && currentUomId > 0 && !conversionPath

              return (
                <div
                  key={uf.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    background: 'var(--background)',
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                      Unit #{i + 1}
                      {watchedUoms[i]?.uom_name && (
                        <span style={{ color: 'var(--foreground-muted)', fontWeight: 400, marginLeft: 6 }}>
                          · {watchedUoms[i].uom_name}
                          {watchedUoms[i]?.uom_code ? ` (${watchedUoms[i].uom_code})` : ''}
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Controller
                        name={`uoms.${i}.is_default` as any}
                        control={control}
                        render={({ field }) => (
                          <button
                            type="button"
                            onClick={() => setDefaultUom(i, !field.value)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 10px',
                              background: field.value ? 'var(--success-bg)' : 'var(--surface)',
                              color: field.value ? 'var(--success)' : 'var(--foreground-muted)',
                              border: `1px solid ${field.value ? 'var(--success)' : 'var(--border)'}`,
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {field.value ? '✓ ' : ''}Default
                          </button>
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => removeUom(i)}
                        style={{
                          padding: 4,
                          background: 'none',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--destructive)',
                          display: 'flex',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* UOM + Code */}
                  <input type="hidden" {...register(`uoms.${i}.id` as any)} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {fieldLabel('Unit', true)}
                      <Controller
                        name={`uoms.${i}.uom_id` as any}
                        control={control}
                        render={({ field }) => (
                          <select
                            value={field.value ?? 0}
                            onChange={(e) => {
                              const uomId = Number(e.target.value)
                              field.onChange(uomId)
                              const selectedUom = uoms.find((u: any) => u.id === uomId)
                              setValue(`uoms.${i}.uom_name` as any, selectedUom?.name ?? '')
                              setValue(`uoms.${i}.uom_code` as any, selectedUom?.code ?? '')

                              // Auto-generate SKU code dari kode produk + kode UOM
                              const currentCode = watchedUoms[i]?.code ?? ''
                              if (selectedUom?.code && !currentCode) {
                                const skuCode = productCode
                                  ? `${productCode}-${selectedUom.code}`
                                  : selectedUom.code
                                setValue(`uoms.${i}.code` as any, skuCode)
                              }
                            }}
                            style={{ ...selectBase, border: `1px solid ${uomErr?.uom_id ? 'var(--destructive)' : 'var(--border)'}` }}
                          >
                            <option value={0}>Select unit...</option>
                            {uoms
                              .filter((u: any) => !usedUomIds.has(u.id))
                              .map((uom: any) => (
                                <option key={uom.id} value={uom.id}>
                                  {uom.name} ({uom.code})
                                </option>
                              ))}
                          </select>
                        )}
                      />
                      {errorMsg(uomErr?.uom_id?.message)}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {fieldLabel('SKU Code', true)}
                      <input
                        {...register(`uoms.${i}.code` as any)}
                        placeholder="e.g. GRM"
                        style={inputBase(!!uomErr?.code)}
                      />
                      {errorMsg(uomErr?.code?.message)}
                    </div>
                  </div>

                  {/* Conversion summary: visual path to base unit */}
                  {currentUomId > 0 && baseUomId && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: pathMissing ? 'var(--destructive-bg)' : 'var(--accent-light-bg)',
                        border: `1px solid ${pathMissing ? 'var(--destructive)' : 'var(--accent-light)'}`,
                        fontSize: 12,
                        color: pathMissing ? 'var(--destructive)' : 'var(--foreground)',
                      }}
                    >
                      {conversionPath ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            Konversi ke Base Unit
                          </span>
                          <span>
                            {conversionPath.map((step, idx) => (
                              <span key={step.uomId}>
                                {idx > 0 && <span style={{ color: 'var(--foreground-muted)', margin: '0 6px' }}>=</span>}
                                <span style={{ fontWeight: 600 }}>{step.amount.toLocaleString('id-ID')}</span>
                                <span style={{ color: 'var(--foreground-muted)', marginLeft: 3 }}>{step.code ?? uomLabel(step.uomId)}</span>
                              </span>
                            ))}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>Tidak ada jalur konversi ke Base Unit.</span>
                          Tambahkan conversion yang merujuk ke {uomLabel(Number(baseUomId))}.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Prices */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {([
                      { name: 'base_price', label: 'Base Price' },
                      { name: 'online_price', label: 'Online Price' },
                      { name: 'franchise_price', label: 'Franchise Price' },
                    ] as const).map((p) => (
                      <div key={p.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>{p.label}</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          {...register(`uoms.${i}.${p.name}` as any)}
                          style={inputBase(false)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Price editable */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      {...register(`uoms.${i}.price_editable` as any)}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer' }}
                    />
                    Price editable (e.g. by cashier)
                  </label>
                  {/* Is Active */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      {...register(`uoms.${i}.is_active` as any)}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer' }}
                    />
                    Unit Aktif
                  </label>

                  {/* Conversions */}
                  <ConversionsSection
                    control={control}
                    uomIndex={i}
                    register={register}
                    errors={errors}
                    targetOptions={targetOptions}
                  />
                </div>
              )
            })}

            {uomFields.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <Repeat size={20} style={{ color: 'var(--foreground-subtle)' }} />
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)', textAlign: 'center' }}>
                  {editData
                    ? 'All units removed — saving will delete every unit of this product.'
                    : 'No units yet. You can save the product header first and add units later.'}
                </span>
              </div>
            )}
          </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
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
            type="button"
            disabled={isPending || editLoading || editError}
            onClick={() => handleSubmit(onSubmit, onInvalid)()}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isPending || editLoading || editError ? 0.7 : 1,
            }}
          >
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            {editData ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ---------- Nested conversions field array ----------

interface ConversionsSectionProps {
  control: any
  uomIndex: number
  register: any
  errors: any
  targetOptions: { value: number; label: string }[]
}

function ConversionsSection({ control, uomIndex, register, errors, targetOptions }: ConversionsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `uoms.${uomIndex}.conversions` as any,
  })

  const selectBase: React.CSSProperties = {
    width: '100%',
    height: 38,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    boxSizing: 'border-box' as const,
    fontFamily: 'var(--font-sans)',
  }

  const inputBase = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${hasError ? 'var(--destructive)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Conversions
        </span>
        <button
          type="button"
          onClick={() => append({ ...emptyConversion })}
          disabled={targetOptions.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: 'var(--surface)',
            color: 'var(--foreground-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11,
            fontWeight: 500,
            cursor: targetOptions.length === 0 ? 'not-allowed' : 'pointer',
            opacity: targetOptions.length === 0 ? 0.6 : 1,
          }}
        >
          <Plus size={11} /> Add Conversion
        </button>
      </div>

      {targetOptions.length === 0 && fields.length === 0 && (
        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
          Add another unit to this product first to define conversions.
        </span>
      )}

      {fields.map((cf, ci) => {
        const convErr = errors?.uoms?.[uomIndex]?.conversions?.[ci]
        return (
          <div key={cf.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="hidden" {...register(`uoms.${uomIndex}.conversions.${ci}.id` as any)} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <select
                {...register(`uoms.${uomIndex}.conversions.${ci}.target_uom_id`, { valueAsNumber: true })}
                style={{ ...selectBase, border: `1px solid ${convErr?.target_uom_id ? 'var(--destructive)' : 'var(--border)'}` }}
              >
                <option value={0}>Converts to...</option>
                {targetOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {convErr?.target_uom_id?.message && (
                <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{convErr.target_uom_id.message}</span>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="Amount (e.g. 0.001)"
                {...register(`uoms.${uomIndex}.conversions.${ci}.amount`, { valueAsNumber: true })}
                style={inputBase(!!convErr?.amount)}
              />
              {convErr?.amount?.message && (
                <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{convErr.amount.message}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(ci)}
              style={{
                padding: 8,
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--destructive)',
                display: 'flex',
                marginTop: 2,
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
