'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productInventoriesService } from '@/services/product-inventories.service'
import { toastMutationApiError } from '@/utils/apiError'
import { productUomsService } from '@/services/product-uoms.service'
import { X, Loader2 } from 'lucide-react'

const createSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Product UOM is required'),
  code: z.string().min(1, 'SKU Code is required'),
  base_price: z.coerce.number().min(0),
  online_price: z.coerce.number().min(0),
  price_editable: z.boolean().default(false),
  expiry_date: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

const editSchema = z.object({
  code: z.string().optional(),
  base_price: z.coerce.number().min(0).optional(),
  online_price: z.coerce.number().min(0).optional(),
  price_editable: z.boolean().optional(),
  expiry_date: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

const schema = z.object({
  product_uom_id: z.coerce.number().min(0).optional(),
  code: z.string().optional(),
  base_price: z.coerce.number().min(0).optional(),
  online_price: z.coerce.number().min(0).optional(),
  price_editable: z.boolean().optional(),
  expiry_date: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})
type FormValues = z.infer<typeof schema>

interface ProductInventorySheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_uom_id: number
    code?: string
    base_price?: number
    online_price?: number
    price_editable?: boolean
    expiry_date?: string
    status?: 'active' | 'inactive'
  } | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--surface)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 4,
  display: 'block',
}

export default function ProductInventorySheet({
  open,
  onClose,
  editData,
}: ProductInventorySheetProps) {
  const queryClient = useQueryClient()
  const isEditMode = !!editData

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEditMode ? editSchema : createSchema) as any,
    defaultValues: {
      product_uom_id: 0,
      code: '',
      base_price: 0,
      online_price: 0,
      price_editable: false,
      expiry_date: '',
      status: 'active',
    },
  })

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' })
        .then((r) => r.data),
    enabled: !isEditMode,
  })
  const productUoms = (productUomsData as any)?.data ?? []

  useEffect(() => {
    if (editData) {
      reset({
        product_uom_id: editData.product_uom_id,
        code: editData.code ?? '',
        base_price: editData.base_price ?? 0,
        online_price: editData.online_price ?? 0,
        price_editable: editData.price_editable ?? false,
        expiry_date: editData.expiry_date ?? '',
        status: editData.status ?? 'active',
      })
    } else {
      reset({
        product_uom_id: 0,
        code: '',
        base_price: 0,
        online_price: 0,
        price_editable: false,
        expiry_date: '',
        status: 'active',
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      productInventoriesService.create({
        product_uom_id: data.product_uom_id!,
        code: data.code!,
        base_price: data.base_price ?? 0,
        online_price: data.online_price ?? 0,
        price_editable: data.price_editable,
        expiry_date: data.expiry_date || undefined,
        status: data.status ?? 'active',
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create inventory item'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      productInventoriesService.update(editData!.id, {
        code: data.code,
        base_price: data.base_price,
        online_price: data.online_price,
        price_editable: data.price_editable,
        expiry_date: data.expiry_date || undefined,
        status: data.status,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update inventory item'),
  })

  const onSubmit = (values: FormValues) => {
    if (isEditMode) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
        }}
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
            {isEditMode ? 'Edit Inventory Item' : 'New Inventory Item'}
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

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
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
          {/* Create: Product UOM */}
          {!isEditMode && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Product UOM
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="product_uom_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    style={{
                      ...inputStyle,
                      cursor: 'pointer',
                      border: `1px solid ${errors.product_uom_id ? 'var(--destructive)' : 'var(--border)'}`,
                    }}
                  >
                    <option value={0} disabled>
                      Select product UOM
                    </option>
                    {productUoms.map((pu: any) => (
                      <option key={pu.id} value={pu.id}>
                        {pu.product?.name ?? pu.id}
                        {' — '}
                        {pu.uom?.name ?? ''}
                        {pu.code ? ` (${pu.code})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.product_uom_id && (
                <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>
                  {errors.product_uom_id.message}
                </span>
              )}
            </div>
          )}

          {/* SKU Code */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              SKU Code
              {!isEditMode && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
            </label>
            <input
              {...register('code')}
              placeholder="e.g. SK000000001"
              style={{
                ...inputStyle,
                border: `1px solid ${errors.code ? 'var(--destructive)' : 'var(--border)'}`,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
              Unique identifier for this inventory item
            </span>
            {errors.code && (
              <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>
                {errors.code.message}
              </span>
            )}
          </div>

          {/* Prices row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Base Price (Rp)
                {!isEditMode && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
              </label>
              <input
                type="number"
                min={0}
                {...register('base_price', { valueAsNumber: true })}
                placeholder="0"
                style={{
                  ...inputStyle,
                  border: `1px solid ${errors.base_price ? 'var(--destructive)' : 'var(--border)'}`,
                }}
              />
              {errors.base_price && (
                <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>
                  {errors.base_price.message}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Online Price (Rp)
                {!isEditMode && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
              </label>
              <input
                type="number"
                min={0}
                {...register('online_price', { valueAsNumber: true })}
                placeholder="0"
                style={{
                  ...inputStyle,
                  border: `1px solid ${errors.online_price ? 'var(--destructive)' : 'var(--border)'}`,
                }}
              />
              {errors.online_price && (
                <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>
                  {errors.online_price.message}
                </span>
              )}
            </div>
          </div>

          {/* Expiry */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>Expiry Date</label>
            <input type="date" {...register('expiry_date')} style={inputStyle} />
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
              Leave empty if no expiry
            </span>
          </div>

          {/* Status + price_editable */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Status
                {!isEditMode && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['active', 'inactive'] as const).map((s) => {
                      const isSel = field.value === s
                      const isActive = s === 'active'
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => field.onChange(s)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            border: isSel
                              ? isActive
                                ? '1px solid var(--success)'
                                : '1px solid var(--destructive)'
                              : '1px solid var(--border)',
                            background: isSel
                              ? isActive ? 'var(--success-bg)' : 'var(--destructive-bg)'
                              : 'var(--surface)',
                            color: isSel
                              ? isActive ? 'var(--success)' : 'var(--destructive)'
                              : 'var(--foreground-muted)',
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

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Price Editable</label>
              <Controller
                name="price_editable"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      border: 'none',
                      background: field.value ? 'var(--accent)' : 'var(--border)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 150ms ease',
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: field.value ? 19 : 3,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'left 150ms ease',
                      }}
                    />
                  </button>
                )}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 6 }}>
                Allow price editing at point of sale
              </span>
            </div>
          </div>
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              flexShrink: 0,
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
              type="submit"
              disabled={isPending}
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
              {isEditMode ? 'Save Changes' : 'Create Inventory Item'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
