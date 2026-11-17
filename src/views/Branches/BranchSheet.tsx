'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchesService } from '@/services/branches.service'
import { priceListsService } from '@/services/price-lists.service'
import { BranchOptionGroups } from '@/lib/branchOptions'
import { X, Loader2 } from 'lucide-react'
import { toastMutationApiError } from '@/utils/apiError';

const schema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .refine((v) => !v.includes('/'), 'Code cannot contain "/"'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['warehouse', 'production', 'outlet', 'other']).default('outlet'),
  timezone: z.string().optional(),
  price_list_id: z.number().optional().nullable(),
  is_default: z.boolean().default(false),
  format: z.enum(['premiere', 'pickup_point']).default('premiere'),
  parent_id: z.coerce.number().optional().nullable(),
  address: z.string().optional(),
  stock_display_mode: z.enum(['base', 'purchase']).default('base'),
})
type FormValues = z.infer<typeof schema>

interface BranchSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    code: string
    name: string
    type?: 'warehouse' | 'production' | 'outlet' | 'other'
    is_default?: boolean
    timezone?: string
    price_list_id?: number | null
    format?: 'premiere' | 'pickup_point'
    parent_id?: number | null
    address?: string | null
    stock_display_mode?: 'base' | 'purchase' | null
  } | null
}

export default function BranchSheet({ open, onClose, editData }: BranchSheetProps) {
  const qc = useQueryClient()
  
  const { data: priceListsData, isLoading: isLoadingPriceLists } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => priceListsService.list({ include: '' }),
    enabled: open
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'with-company'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name', include: 'company' } as any).then(r => r.data),
    enabled: open,
  })
  const allBranches: any[] = (branchesData as any)?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { code: '', name: '',
      type: 'outlet', timezone: 'Asia/Jakarta', is_default: false, format: 'premiere', parent_id: null,
      address: '', stock_display_mode: 'base' },
  })

  useEffect(() => {
    if (editData) {
      reset({
        code: editData.code,
        name: editData.name,
        type: editData.type ?? 'outlet',
        timezone: editData.timezone ?? 'Asia/Jakarta',
        price_list_id: editData.price_list_id ?? null,
        is_default: editData.is_default ?? false,
        format: editData.format ?? 'premiere',
        parent_id: editData.parent_id ?? null,
        address: editData.address ?? '',
        stock_display_mode: editData.stock_display_mode ?? 'base',
      })
    } else {
      reset({ code: '', name: '',
        type: 'outlet',
        timezone: 'Asia/Jakarta',
        price_list_id: null,
        is_default: false,
        format: 'premiere',
        parent_id: null,
        address: '',
        stock_display_mode: 'base' })
    }
  }, [editData, open, reset])

  // 422 (code contains "/") and 409 (code already used by an active branch)
  // are shown under the Code field as well as in the toast.
  const showCodeError = (err: any) => {
    const codeErr = err?.response?.data?.errors?.code
    if (codeErr) {
      setError('code', { message: String(Array.isArray(codeErr) ? codeErr[0] : codeErr) })
    } else if (err?.response?.status === 409) {
      setError('code', { message: err?.response?.data?.message ?? 'Code is already used by another branch' })
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => branchesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      qc.invalidateQueries({ queryKey: ['branches-all'] })
      toast.success('Branch created')
      onClose()
    },
    onError: (err: any) => {
      showCodeError(err)
      toastMutationApiError(err, 'Failed to create branch')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => branchesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      qc.invalidateQueries({ queryKey: ['branches-all'] })
      toast.success('Branch updated')
      onClose()
    },
    onError: (err: any) => {
      showCodeError(err)
      toastMutationApiError(err, 'Failed to update branch')
    },
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
  const hintStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--foreground-subtle)',
    marginTop: 4,
  }

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
          width: 420,
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
              {editData ? 'Edit Branch' : 'New Branch'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {editData ? 'Update branch details' : 'Create a new branch location'}
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
            {/* Code + Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Branch Code
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('code')}
                  placeholder="e.g. CGK-001"
                  style={errors.code ? inputErrorStyle : inputStyle}
                />
                {errors.code && <div style={errorStyle}>{errors.code.message}</div>}
                <div style={hintStyle}>Short identifier used across the system</div>
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Branch Name
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Alam Sutera"
                  style={errors.name ? inputErrorStyle : inputStyle}
                />
                {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
              </div>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Address</label>
              <textarea
                {...register('address')}
                rows={3}
                placeholder="e.g. Jl. Ir. H. Juanda No. 26, Depok"
                style={{ ...(errors.address ? inputErrorStyle : inputStyle), resize: 'vertical', minHeight: 72 }}
              />
              {errors.address && <div style={errorStyle}>{errors.address.message}</div>}
              <div style={hintStyle}>Printed on POS receipts for this branch</div>
            </div>

            {/* Timezone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Timezone</label>
              <select
                {...register('timezone')}
                style={errors.timezone ? inputErrorStyle : inputStyle}
              >
                <option value="UTC">UTC</option>
                <option value="Asia/Jakarta">Asia/Jakarta</option>
                <option value="Asia/Makassar">Asia/Makassar</option>
                <option value="Asia/Jayapura">Asia/Jayapura</option>
              </select>
              {errors.timezone && <div style={errorStyle}>{errors.timezone.message}</div>}
            </div>

            {/* Branch Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Branch Type
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <select
                {...register('type')}
                style={errors.type ? inputErrorStyle : inputStyle}
              >
                <option value="outlet">Outlet</option>
                <option value="warehouse">Warehouse</option>
                <option value="production">Production</option>
                <option value="other">Other</option>
              </select>
              {errors.type && <div style={errorStyle}>{errors.type.message}</div>}
              <div style={hintStyle}>Warehouse can only hold WIP, Production can manufacture, Outlet sells to customers</div>
            </div>

            {/* Format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Format</label>
              <select
                {...register('format')}
                style={errors.format ? inputErrorStyle : inputStyle}
              >
                <option value="premiere">Premiere</option>
                <option value="pickup_point">Pickup Point</option>
              </select>
              <div style={hintStyle}>Pickup points inherit account settings from their parent outlet</div>
            </div>

            {/* Parent Branch (only for pickup_point) */}
            {watch('format') === 'pickup_point' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Parent Branch
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <Controller
                  control={control}
                  name="parent_id"
                  render={({ field }) => (
                    <select
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      style={errors.parent_id ? inputErrorStyle : inputStyle}
                    >
                      <option value="">Select parent outlet...</option>
                      <BranchOptionGroups
                        branches={allBranches.filter((b: any) => b.format !== 'pickup_point')}
                        label={(b: any) => `${b.code} - ${b.name}`}
                        getValue={(b: any) => b.id}
                      />
                    </select>
                  )}
                />
                {errors.parent_id && <div style={errorStyle}>{errors.parent_id.message}</div>}
                <div style={hintStyle}>Must be a premiere (non-pickup-point) branch in the same company</div>
              </div>
            )}

            {/* Stock display mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Stock Display</label>
              <select
                {...register('stock_display_mode')}
                style={errors.stock_display_mode ? inputErrorStyle : inputStyle}
              >
                <option value="base">Base unit</option>
                <option value="purchase">Purchase unit</option>
              </select>
              <div style={hintStyle}>Unit used when showing stock quantities for this branch</div>
            </div>

            {/* Price List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Price List</label>
              <Controller
                control={control}
                name="price_list_id"
                render={({ field }) => (
                  <select
                    disabled={isLoadingPriceLists}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    style={inputStyle}
                  >
                    <option value="">No Price List</option>
                    {priceListsData?.data?.data?.data?.map((pl: any) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.price_list_id && <div style={errorStyle}>{errors.price_list_id.message}</div>}
            </div>

            {/* is_default */}
            <div>
              <label style={labelStyle}>Default Branch</label>
              <Controller
                control={control}
                name="is_default"
                render={({ field }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      style={{
                        position: 'relative',
                        width: 36,
                        height: 20,
                        borderRadius: 99,
                        border: 'none',
                        cursor: 'pointer',
                        background: field.value ? 'var(--accent)' : 'var(--border)',
                        transition: 'background 150ms',
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: field.value ? 18 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: 99,
                          background: 'white',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'left 150ms',
                        }}
                      />
                    </button>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--foreground-subtle)',
                      }}
                    >
                      Set as the default branch for new sessions
                    </span>
                  </div>
                )}
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
              {editData ? 'Save Changes' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
