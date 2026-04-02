'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productConversionsService } from '@/services/product-conversions.service'
import { productsService } from '@/services/products.service'
import { uomsService } from '@/services/uoms.service'
import { X, Loader2, ArrowRight } from 'lucide-react'

const schema = z.object({
  product_id: z.coerce.number()
    .min(1, 'Product is required'),
  from_uom_id: z.coerce.number()
    .min(1, 'From UOM is required'),
  to_uom_id: z.coerce.number()
    .min(1, 'To UOM is required'),
  conversion_factor: z.coerce.number()
    .min(0.0001, 'Must be greater than 0'),
})
type FormValues = z.infer<typeof schema>

interface ProductConversionSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_id: number
    from_uom_id: number
    to_uom_id: number
    conversion_factor: number
  } | null
}

export default function ProductConversionSheet({
  open,
  onClose,
  editData,
}: ProductConversionSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: undefined,
      from_uom_id: undefined,
      to_uom_id: undefined,
      conversion_factor: 1,
    },
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () =>
      productsService
        .list({ per_page: 200, 'filter[status]': 'active' })
        .then((r) => r.data.data),
  })
  const products = (productsData as any)?.data ?? []

  const { data: uomsData } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: () =>
      uomsService.list({ per_page: 100 }).then((r) => r.data.data),
  })
  const uoms = (uomsData as any)?.data ?? []

  useEffect(() => {
    if (editData) {
      reset({
        product_id: editData.product_id,
        from_uom_id: editData.from_uom_id,
        to_uom_id: editData.to_uom_id,
        conversion_factor: editData.conversion_factor,
      })
    } else {
      reset({
        product_id: undefined,
        from_uom_id: undefined,
        to_uom_id: undefined,
        conversion_factor: 1,
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productConversionsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Conversion created')
      onClose()
    },
    onError: () => toast.error('Failed to create conversion'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      productConversionsService.update(editData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Conversion updated')
      onClose()
    },
    onError: () => toast.error('Failed to update conversion'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const watchedValues = watch([
    'product_id',
    'from_uom_id',
    'to_uom_id',
    'conversion_factor',
  ])
  const [watchedProductId, watchedFromUomId, watchedToUomId, watchedFactor] =
    watchedValues

  const showPreview =
    watchedProductId !== undefined &&
    watchedFromUomId !== undefined &&
    watchedToUomId !== undefined &&
    watchedFactor !== undefined &&
    !isNaN(watchedFactor) &&
    watchedFactor >= 0.0001

  const fromUomName = uoms.find((u: any) => u.id === watchedFromUomId)?.name ?? ''
  const toUomName = uoms.find((u: any) => u.id === watchedToUomId)?.name ?? ''

  const selectStyle = {
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
    cursor: 'pointer',
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
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
        }}
      />

      {/* Sheet panel */}
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
            {editData ? 'Edit Conversion' : 'New Conversion'}
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
          {/* Product field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Product
            </label>
            <Controller
              name="product_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  style={{
                    ...selectStyle,
                    border: `1px solid ${errors.product_id ? 'var(--destructive)' : 'var(--border)'}`,
                  }}
                >
                  <option value="" disabled>
                    Select product
                  </option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.product_id && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.product_id.message}
              </span>
            )}
          </div>

          {/* Conversion row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Conversion
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* From UOM */}
              <Controller
                name="from_uom_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    style={{
                      ...selectStyle,
                      border: `1px solid ${errors.from_uom_id ? 'var(--destructive)' : 'var(--border)'}`,
                    }}
                  >
                    <option value="" disabled>
                      From UOM
                    </option>
                    {uoms.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                )}
              />

              {/* Arrow */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowRight size={16} style={{ color: 'var(--foreground-muted)' }} />
              </div>

              {/* To UOM */}
              <Controller
                name="to_uom_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    style={{
                      ...selectStyle,
                      border: `1px solid ${errors.to_uom_id ? 'var(--destructive)' : 'var(--border)'}`,
                    }}
                  >
                    <option value="" disabled>
                      To UOM
                    </option>
                    {uoms.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
            {(errors.from_uom_id || errors.to_uom_id) && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.from_uom_id?.message || errors.to_uom_id?.message}
              </span>
            )}
          </div>

          {/* Conversion factor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Conversion Factor
            </label>
            <input
              {...register('conversion_factor', { valueAsNumber: true })}
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="e.g. 1000"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.conversion_factor ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            {errors.conversion_factor && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.conversion_factor.message}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                color: 'var(--foreground-subtle)',
              }}
            >
              1 [{watchedFromUomId ? fromUomName || 'From UOM' : 'From UOM'}] ={' '}
              {watchedFactor || '?'} [{watchedToUomId ? toUomName || 'To UOM' : 'To UOM'}]
            </span>
          </div>

          {/* Live preview */}
          {showPreview && (
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Preview
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  1 {fromUomName}
                </span>
                <ArrowRight size={14} style={{ color: 'var(--foreground-muted)' }} />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {watchedFactor} {toUomName}
                </span>
              </div>
            </div>
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
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            )}
            {editData ? 'Save Changes' : 'Create Conversion'}
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
