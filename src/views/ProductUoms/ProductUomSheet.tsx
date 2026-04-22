'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { productsService } from '@/services/products.service'
import { uomsService } from '@/services/uoms.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

const schema = z.object({
  product_id: z.coerce.number().min(1, 'Product is required'),
  uom_id: z.coerce.number().min(1, 'UOM is required'),
  code: z.string().optional(),
  base_price: z.coerce.number().min(0).optional(),
  online_price: z.coerce.number().min(0).optional(),
  price_editable: z.boolean().optional(),
  is_default: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

interface ProductUomSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_id: number
    uom_id: number
    code?: string
    base_price?: number
    online_price?: number
    price_editable?: boolean
    is_default?: boolean
    product?: { id?: number; name?: string; code?: string }
    uom?: { id?: number; name?: string; code?: string }
  } | null
}

export default function ProductUomSheet({ open, onClose, editData }: ProductUomSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      product_id: editData?.product_id ?? 0,
      uom_id: editData?.uom_id ?? 0,
      code: '',
      base_price: 0,
      online_price: 0,
      price_editable: false,
      is_default: false,
    },
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsService.list({ per_page: 50 }).then((r) => r.data),
  })
  const products = (productsData as any)?.data ?? []

  const { data: uomsData, isLoading: uomsLoading } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: () => uomsService.list({ per_page: 100 }).then((r) => r.data),
  })
  const uoms = (uomsData as any)?.data ?? []

  // When editing, ensure the currently-selected product/uom is present in
  // the options list even if it lies beyond the first page.
  const productOptions = React.useMemo(() => {
    const base = products.map((p: any) => ({
      value: p.id as number,
      label: (p.name as string) ?? '',
      sublabel: p.code as string | undefined,
    }))
    if (
      editData?.product_id &&
      editData.product &&
      !base.find((o: any) => o.value === editData.product_id)
    ) {
      base.unshift({
        value: editData.product_id,
        label: editData.product.name ?? 'Product',
        sublabel: editData.product.code,
      })
    }
    return base
  }, [products, editData])

  const uomOptions = React.useMemo(() => {
    const base = uoms.map((u: any) => ({
      value: u.id as number,
      label: (u.name as string) ?? '',
      sublabel: u.code as string | undefined,
    }))
    if (
      editData?.uom_id &&
      editData.uom &&
      !base.find((o: any) => o.value === editData.uom_id)
    ) {
      base.unshift({
        value: editData.uom_id,
        label: editData.uom.name ?? 'UOM',
        sublabel: editData.uom.code,
      })
    }
    return base
  }, [uoms, editData])

  useEffect(() => {
    if (editData) {
      reset({
        product_id: editData.product_id ?? 0,
        uom_id: editData.uom_id ?? 0,
        code: editData.code ?? '',
        base_price: editData.base_price ?? 0,
        online_price: editData.online_price ?? 0,
        price_editable: editData.price_editable ?? false,
        is_default: editData.is_default ?? false,
      })
    } else {
      reset({
        product_id: 0,
        uom_id: 0,
        code: '',
        base_price: 0,
        online_price: 0,
        price_editable: false,
        is_default: false,
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productUomsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      toast.success('Product UOM created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create product UOM'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productUomsService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      toast.success('Product UOM updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update product UOM'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box' as const,
  }

  if (!open) return null

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
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 480,
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
            {editData ? 'Edit Product UOM' : 'New Product UOM'}
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
          {/* Product */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Product
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              control={control}
              name="product_id"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={productOptions}
                  placeholder="Select product..."
                  searchPlaceholder="Search products..."
                  loading={productsLoading}
                  error={errors.product_id?.message as string | undefined}
                />
              )}
            />
          </div>

          {/* UOM */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Unit of Measure
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              control={control}
              name="uom_id"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={uomOptions}
                  placeholder="Select UOM..."
                  searchPlaceholder="Search UOMs..."
                  loading={uomsLoading}
                  error={errors.uom_id?.message as string | undefined}
                />
              )}
            />
          </div>

          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              Code
            </label>
            <input
              {...register('code')}
              placeholder="e.g. CHOC-KG (optional)"
              style={inputStyle}
            />
          </div>

          {/* Base Price / Online Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Base Price
              </label>
              <input
                {...register('base_price', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Online Price
              </label>
              <input
                {...register('online_price', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Price Editable */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Price Editable
              </label>
              <Controller
                name="price_editable"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([true, false] as const).map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => field.onChange(val)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
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

            {/* Is Default */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Is Default
              </label>
              <Controller
                name="is_default"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([true, false] as const).map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => field.onChange(val)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
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
            onClick={handleSubmit(onSubmit)}
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
            {editData ? 'Save Changes' : 'Create Product UOM'}
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
