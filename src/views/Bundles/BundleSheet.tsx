'use client'

import React, { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { bundlesService } from '@/services/bundles.service'
import { productUomsService } from '@/services/product-uoms.service'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

import { getCanReadPrice } from '@/utils/price'

const formatNumber = (n: number | undefined): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!getCanReadPrice()) return '***'
  return Number(n).toLocaleString('id-ID')
}

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Please select a product'),
  qty: z.coerce.number().min(0.001, 'Quantity must be greater than 0'),
})

const schema = z.object({
  code: z.string().min(1, 'Bundle code is required'),
  name: z.string().min(1, 'Bundle name is required'),
  price: z.coerce
    .number({ message: 'Bundle price is required' })
    .min(0, 'Price cannot be negative'),
  status: z.enum(['active', 'inactive'], { message: 'Status is required' }),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'Please add at least one bundle item'),
})
type FormValues = z.infer<typeof schema>

interface BundleDetail {
  id: number
  product_uom_id: number
  qty: number
  product_uom?: {
    id: number
    code?: string
    product?: { name: string }
    uom?: { name: string; code: string }
  }
}

interface BundleSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    code: string
    name: string
    price: number
    status: 'active' | 'inactive'
    description?: string
    bundle_details?: BundleDetail[]
  } | null
}

interface ProductUomOption {
  id: number
  code?: string
  product?: { name?: string }
  uom?: { name?: string; code?: string }
}

export default function BundleSheet({ open, onClose, editData }: BundleSheetProps) {
  const qc = useQueryClient()

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
      code: '',
      name: '',
      price: 0,
      status: 'active',
      description: '',
      details: [{ product_uom_id: 0, qty: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

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

  const productUoms: ProductUomOption[] = (productUomsData as any)?.data ?? []

  const productUomOptions = productUoms.map((pu) => ({
    value: pu.id,
    label: pu.product?.name ?? `Product UOM #${pu.id}`,
    sublabel: pu.uom?.name ?? pu.code ?? undefined,
  }))

  useEffect(() => {
    if (editData) {
      reset({
        code: editData.code,
        name: editData.name,
        price: editData.price,
        status: editData.status,
        description: editData.description ?? '',
        details:
          editData.bundle_details && editData.bundle_details.length > 0
            ? editData.bundle_details.map((d) => ({
                product_uom_id: d.product_uom_id,
                qty: d.qty,
              }))
            : [{ product_uom_id: 0, qty: 1 }],
      })
    } else {
      reset({
        code: '',
        name: '',
        price: 0,
        status: 'active',
        description: '',
        details: [{ product_uom_id: 0, qty: 1 }],
      })
    }
  }, [editData, open, reset])

  const buildPayload = (data: FormValues) => {
    const cleanDetails = (data.details ?? [])
      .filter((d) => Number(d.product_uom_id) > 0 && Number(d.qty) > 0)
      .map((d) => ({
        product_uom_id: Number(d.product_uom_id),
        qty: Number(d.qty),
      }))
    return {
      code: data.code,
      name: data.name,
      price: Number(data.price),
      status: data.status,
      description: data.description || undefined,
      details: cleanDetails,
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      bundlesService.create(buildPayload(data) as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Bundle created')
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to create bundle'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      bundlesService.update(editData!.id, buildPayload(data) as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Bundle updated')
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update bundle'
      toast.error(msg)
    },
  })

  const onSubmit = (data: FormValues) => {
    const payload = buildPayload(data)
    if (payload.details.length === 0) {
      toast.error('Please add at least one bundle item with a selected product and qty > 0')
      return
    }
    if (editData) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as { message?: string } | undefined
    toast.error(first?.message ?? 'Please fill in all required fields')
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

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
  const smallInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    background: 'var(--surface)',
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  const pillButton = (
    selected: boolean,
    activeBg: string,
    activeColor: string,
    activeBorder: string
  ): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    background: selected ? activeBg : 'var(--background)',
    color: selected ? activeColor : 'var(--foreground-muted)',
    border: selected ? `1px solid ${activeBorder}` : '1px solid var(--border)',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          width: 520,
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
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 600,
                margin: 0,
                color: 'var(--foreground)',
              }}
            >
              {editData ? 'Edit Bundle' : 'New Bundle'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {editData ? 'Update bundle details' : 'Create a new product bundle'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
              <span style={{ color: 'var(--destructive)' }}>*</span>
              <span>Required fields</span>
            </div>
            {/* Row 1: code + name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Bundle Code
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('code')}
                  placeholder="e.g. PARCEL0001"
                  style={errors.code ? inputErrorStyle : inputStyle}
                />
                {errors.code && <div style={errorStyle}>{errors.code.message}</div>}
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Bundle Name
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Parsel Lebaran 2026"
                  style={errors.name ? inputErrorStyle : inputStyle}
                />
                {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
              </div>
            </div>

            {/* Row 2: price + status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Bundle Price (Rp)
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(watch('price'))}
                  disabled={!getCanReadPrice()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '')
                    setValue('price', raw === '' ? 0 : parseInt(raw, 10) || 0)
                  }}
                  placeholder="0"
                  style={{...(errors.price ? inputErrorStyle : inputStyle), ...( !getCanReadPrice() ? { background: 'var(--surface)', cursor: 'not-allowed' } : {} )}}
                />
                {errors.price && <div style={errorStyle}>{errors.price.message}</div>}
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Status
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => field.onChange('active')}
                        style={pillButton(
                          field.value === 'active',
                          'var(--success-bg)',
                          'var(--success)',
                          'var(--success)'
                        )}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('inactive')}
                        style={pillButton(
                          field.value === 'inactive',
                          'var(--destructive-bg)',
                          'var(--destructive)',
                          'var(--destructive)'
                        )}
                      >
                        Inactive
                      </button>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional description"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              />
            </div>

            {/* Bundle items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  Bundle Items
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ product_uom_id: 0, qty: 1 })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    background: 'var(--accent-light-bg)',
                    color: 'var(--accent)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} />
                  Add Item
                </button>
              </div>

              {fields.map((field, index) => {
                const detailError = errors.details?.[index]
                return (
                  <div
                    key={field.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 32px',
                      gap: 8,
                      alignItems: 'start',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Controller
                        control={control}
                        name={`details.${index}.product_uom_id` as const}
                        render={({ field: selectField }) => (
                          <SearchableSelect
                            value={selectField.value ?? 0}
                            onChange={selectField.onChange}
                            options={productUomOptions}
                            placeholder="Select product..."
                            searchPlaceholder="Search..."
                            loading={productUomsLoading}
                            error={detailError?.product_uom_id?.message as string | undefined}
                          />
                        )}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <input
                        type="number"
                        min={0.001}
                        step={0.001}
                        {...register(`details.${index}.qty` as const, { valueAsNumber: true })}
                        style={smallInputStyle}
                      />
                      {detailError?.qty && (
                        <span style={{ fontSize: 10, color: 'var(--destructive)' }}>
                          {detailError.qty.message}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      style={{
                        padding: 6,
                        background: 'none',
                        border: 'none',
                        cursor: fields.length === 1 ? 'not-allowed' : 'pointer',
                        color:
                          fields.length === 1 ? 'var(--border)' : 'var(--destructive)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}

              {errors.details && !Array.isArray(errors.details) && (errors.details as any).message && (
                <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                  {(errors.details as any).message}
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
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
                padding: '8px 18px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'white',
                cursor: isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: isPending ? 0.75 : 1,
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {editData ? 'Save Changes' : 'Create Bundle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
