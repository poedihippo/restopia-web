'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsService } from '@/services/products.service'
import { uomsService } from '@/services/uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import api from '@/hooks/useApi'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  product_category_id: z.coerce.number().min(1, 'Category is required'),
  type: z.string().min(1, 'Type is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  base_uom_id: z.coerce.number().optional().nullable(),
  reorder_point: z.coerce.number().int().min(0).nullable().optional(),
})
type FormValues = z.infer<typeof schema>

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
    status: 'active' | 'inactive'
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      code: '',
      product_category_id: editData?.product_category_id ?? 0,
      type: '',
      description: '',
      status: 'active',
      base_uom_id: null,
      reorder_point: null,
    },
  })

  const { data: catData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      api
        .get('/product-categories', {
          params: { per_page: 100 },
        })
        .then((r) => r.data),
  })
  const categories = (catData as any)?.data ?? []

  // Mirrors ProductConversionSheet's UOM-fetching pattern for the Base Unit options.
  const { data: uomsData } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: () => uomsService.list({ per_page: 200 } as any).then((r) => r.data),
  })
  const uoms = (uomsData as any)?.data ?? []

  useEffect(() => {
    if (open) {
      if (editData) {
        reset({
          name: editData.name,
          code: editData.code ?? '',
          product_category_id: editData.product_category_id ?? 0,
          type: editData.type ?? '',
          description: editData.description ?? '',
          status: editData.status ?? 'active',
          base_uom_id: editData.base_uom_id ?? null,
          reorder_point: editData.reorder_point ?? null,
        })
      } else {
        reset({
          name: '',
          code: '',
          product_category_id: 0,
          type: '',
          description: '',
          status: 'active',
          base_uom_id: null,
          reorder_point: null,
        })
      }
    }

  }, [open, editData, reset, categories.length]) // categories.length memastikan reset dijalankan ulang setelah list kategori berhasil di-fetch

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create product'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productsService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update product'),
  })

  const onSubmit = (values: FormValues) => {
    console.log('[ProductSheet] onSubmit called with:', values)
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const onInvalid = (errors: any) => {
    console.log('[ProductSheet] Validation errors:', errors)
    const firstError = Object.values(errors)[0] as any
    toast.error(firstError?.message ?? 'Please fill in all required fields')
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  })

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
          width: 460,
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
          onSubmit={handleSubmit(onSubmit)}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
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
              style={{
                width: '100%',
                height: 40,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 12px',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                boxSizing: 'border-box' as const,
              }}
            >
              <option value={0}>Select category...</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.product_category_id && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--destructive)',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {errors.product_category_id.message}
              </span>
            )}
          </div>

          {/* Type */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Type
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <select
              {...register('type')}
              style={{
                width: '100%',
                height: 40,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 12px',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                boxSizing: 'border-box' as const,
              }}
            >
              <option value="">Select type...</option>
              {availableTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.type && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--destructive)',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {errors.type.message}
              </span>
            )}
          </div>

          {/* Base Unit */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Base Unit
            </label>
            <Controller
              name="base_uom_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    width: '100%',
                    height: 40,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 12px',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    background: 'var(--surface)',
                    boxSizing: 'border-box' as const,
                  }}
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
            <span
              style={{
                fontSize: 12,
                color: 'var(--foreground-muted)',
                marginTop: 4,
                display: 'block',
              }}
            >
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
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? null : Number(e.target.value))
                  }
                  placeholder="Kosongkan jika tidak dipakai"
                  style={inputBase(!!errors.reorder_point)}
                />
              )}
            />
            {errorMsg(errors.reorder_point?.message as string | undefined)}
          </div>

          {/* Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Status', true)}
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['active', 'inactive'] as const).map((s) => {
                    const isSelected = field.value === s
                    const isActive = s === 'active'
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
                            ? isActive
                              ? 'var(--success-bg)'
                              : 'var(--destructive-bg)'
                            : 'var(--background)',
                          color: isSelected
                            ? isActive
                              ? 'var(--success)'
                              : 'var(--destructive)'
                            : 'var(--foreground-muted)',
                          border: isSelected
                            ? `1px solid ${isActive ? 'var(--success)' : 'var(--destructive)'}`
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

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Description')}
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Optional notes about this product"
              style={{
                ...inputBase(false),
                resize: 'vertical',
                minHeight: 80,
              }}
            />
          </div>
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
            disabled={isPending}
            onClick={handleSubmit(onSubmit, onInvalid)}
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
              opacity: isPending ? 0.7 : 1,
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
