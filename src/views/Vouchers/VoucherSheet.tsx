'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import Select from 'react-select'
import { vouchersService } from '@/services/vouchers.service'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.coerce.number().min(0),
  min_subtotal_price: z.coerce.number().min(0).optional(),
  max_discount_price: z.coerce.number().min(0).optional(),
  scope: z.enum(['company', 'branch']),
  valid_from: z.string().min(1, 'Start date required'),
  valid_until: z.string().min(1, 'End date required'),
  quota: z.coerce.number().min(0).optional(),
  status: z.enum(['active', 'inactive']),
  description: z.string().optional(),
  branches: z.array(z.number()).optional(),
  product_uoms: z.array(z.number()).optional(),
})
type FormValues = z.infer<typeof schema>

interface VoucherSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    code: string
    name: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    min_subtotal_price?: number
    max_discount_price?: number
    scope: 'company' | 'branch'
    valid_from: string
    valid_until: string
    quota?: number
    status: 'active' | 'inactive'
    description?: string
    voucher_branches?: any[]
    voucher_product_uoms?: any[]
  } | null
}

export default function VoucherSheet({ open, onClose, editData }: VoucherSheetProps) {
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      code: '',
      name: '',
      discount_type: 'percent',
      discount_value: 0,
      min_subtotal_price: 0,
      max_discount_price: 0,
      scope: 'branch',
      valid_from: '',
      valid_until: '',
      quota: 0,
      status: 'active',
      description: '',
      branches: [],
      product_uoms: [],
    },
  })

  const watchDiscountType = watch('discount_type')
  const watchScope = watch('scope')

  useEffect(() => {
    if (editData) {
      reset({
        code: editData.code,
        name: editData.name,
        discount_type: editData.discount_type,
        discount_value: editData.discount_value,
        min_subtotal_price: editData.min_subtotal_price ?? 0,
        max_discount_price: editData.max_discount_price ?? 0,
        scope: editData.scope,
        valid_from: editData.valid_from,
        valid_until: editData.valid_until,
        quota: editData.quota ?? 0,
        status: editData.status,
        description: editData.description ?? '',
        branches: editData.voucher_branches?.map((b: any) => b.branch_id || b.id) || [],
        product_uoms: editData.voucher_product_uoms?.map((p: any) => p.product_uom_id || p.id) || [],
      })
    } else {
      reset({
        code: '',
        name: '',
        discount_type: 'percent',
        discount_value: 0,
        min_subtotal_price: 0,
        max_discount_price: 0,
        scope: 'branch',
        valid_from: '',
        valid_until: '',
        quota: 0,
        status: 'active',
        description: '',
        branches: [],
        product_uoms: [],
      })
    }
  }, [editData, open, reset])

  const { data: branchesData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const res = await branchesService.list({ per_page: 100 })
      return (res.data as any)?.data || []
    }
  })
  
  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-list'],
    queryFn: async () => {
      const res = await productUomsService.list({ per_page: 100 })
      return (res.data as any)?.data || []
    }
  })

  const branchOptions = React.useMemo(() => {
    return (branchesData || []).map((b: any) => ({ label: b.name, value: b.id }))
  }, [branchesData])

  const productUomOptions = React.useMemo(() => {
    return (productUomsData || []).map((p: any) => ({ label: p.code || p.id, value: p.id }))
  }, [productUomsData])

  const mapPayload = (data: FormValues) => {
    return {
      ...data,
      branches: data.scope === 'branch' ? data.branches?.map(id => ({ branch_id: id })) : [],
      product_uoms: data.product_uoms?.map(id => ({ product_uom_id: id })) || []
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => vouchersService.create(mapPayload(data) as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      toast.success('Voucher created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create voucher'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => vouchersService.update(editData!.id, mapPayload(data) as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      qc.invalidateQueries({ queryKey: ['voucher-detail'] })
      toast.success('Voucher updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update voucher'),
  })

  const onSubmit = (data: FormValues) => {
    if (editData) updateMutation.mutate(data)
    else createMutation.mutate(data)
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
  const hintStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--foreground-subtle)',
    marginTop: 4,
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
      }}
    >
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
          width: 560,
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
              {editData ? 'Edit Voucher' : 'New Voucher'}
            </h2>
            <p
              style={{
                fontSize: 12,
                color: 'var(--foreground-muted)',
                margin: '4px 0 0',
              }}
            >
              {editData ? 'Update voucher details' : 'Create a new discount voucher'}
            </p>
          </div>
          <button
            type="button"
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

        {/* Form body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
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
            {/* Row 1 — code + name */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Voucher Code
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('code')}
                  placeholder="e.g. PROMO2026"
                  style={errors.code ? inputErrorStyle : inputStyle}
                />
                {errors.code && <span style={errorStyle}>{errors.code.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Voucher Name
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. New Year Promotion"
                  style={errors.name ? inputErrorStyle : inputStyle}
                />
                {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
              </div>
            </div>

            {/* Row 2 — discount_type + scope */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Discount Type
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <Controller
                  name="discount_type"
                  control={control}
                  render={({ field }) => (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => field.onChange('percent')}
                        style={pillButton(
                          field.value === 'percent',
                          'var(--info-bg)',
                          'var(--info)',
                          'var(--info)'
                        )}
                      >
                        Percent
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('fixed')}
                        style={pillButton(
                          field.value === 'fixed',
                          'var(--accent-light-bg)',
                          'var(--accent)',
                          'var(--accent)'
                        )}
                      >
                        Fixed
                      </button>
                    </div>
                  )}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Scope
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <Controller
                  name="scope"
                  control={control}
                  render={({ field }) => (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => field.onChange('company')}
                        style={pillButton(
                          field.value === 'company',
                          'var(--accent-light-bg)',
                          'var(--accent)',
                          'var(--accent)'
                        )}
                      >
                        Company
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('branch')}
                        style={pillButton(
                          field.value === 'branch',
                          'var(--warning-bg)',
                          'var(--warning)',
                          'var(--warning)'
                        )}
                      >
                        Branch
                      </button>
                    </div>
                  )}
                />
              </div>
            </div>

            {watchScope === 'branch' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Branches</label>
                <Controller
                  name="branches"
                  control={control}
                  render={({ field }) => (
                    <Select
                      isMulti
                      options={branchOptions}
                      value={branchOptions.filter((o: any) => field.value?.includes(o.value))}
                      onChange={(selected: any) => field.onChange(selected.map((o: any) => o.value))}
                      styles={{
                        control: (base) => ({
                          ...base,
                          fontSize: 13,
                          borderColor: 'var(--border)',
                          boxShadow: 'none',
                          '&:hover': { borderColor: 'var(--border)' }
                        }),
                        menu: (base) => ({ ...base, fontSize: 13, zIndex: 100 })
                      }}
                      placeholder="Select branches..."
                    />
                  )}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Products</label>
              <Controller
                name="product_uoms"
                control={control}
                render={({ field }) => (
                  <Select
                    isMulti
                    options={productUomOptions}
                    value={productUomOptions.filter((o: any) => field.value?.includes(o.value))}
                    onChange={(selected: any) => field.onChange(selected.map((o: any) => o.value))}
                    styles={{
                      control: (base) => ({
                        ...base,
                        fontSize: 13,
                        borderColor: 'var(--border)',
                        boxShadow: 'none',
                        '&:hover': { borderColor: 'var(--border)' }
                      }),
                      menu: (base) => ({ ...base, fontSize: 13, zIndex: 100 })
                    }}
                    placeholder="Select products (leave empty for all)"
                  />
                )}
              />
            </div>

            {/* Row 3 — discount_value + quota */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  {watchDiscountType === 'percent' ? 'Discount (%)' : 'Discount Amount (Rp)'}
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  {...register('discount_value', { valueAsNumber: true })}
                  style={inputStyle}
                />
                <span style={hintStyle}>
                  {watchDiscountType === 'percent'
                    ? 'Enter 0–100 for percentage off'
                    : 'Fixed amount deducted from total'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Total Quota</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register('quota', { valueAsNumber: true })}
                  style={inputStyle}
                />
                <span style={hintStyle}>Leave 0 for unlimited usage</span>
              </div>
            </div>

            {/* Row 4 — min_subtotal + max_discount */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Min. Purchase (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register('min_subtotal_price', { valueAsNumber: true })}
                  style={inputStyle}
                />
                <span style={hintStyle}>Minimum order value to apply voucher</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Max. Discount (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register('max_discount_price', { valueAsNumber: true })}
                  style={inputStyle}
                />
                <span style={hintStyle}>Cap on discount amount (0 = no cap)</span>
              </div>
            </div>

            {/* Row 5 — valid_from + valid_until */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Valid From
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="date"
                  {...register('valid_from')}
                  style={errors.valid_from ? inputErrorStyle : inputStyle}
                />
                {errors.valid_from && (
                  <span style={errorStyle}>{errors.valid_from.message}</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Valid Until
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="date"
                  {...register('valid_until')}
                  style={errors.valid_until ? inputErrorStyle : inputStyle}
                />
                {errors.valid_until && (
                  <span style={errorStyle}>{errors.valid_until.message}</span>
                )}
              </div>
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

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
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
              background: 'var(--surface)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
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
                padding: '8px 18px',
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
              {editData ? 'Save Changes' : 'Create Voucher'}
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
    </div>
  )
}
