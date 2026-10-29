'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companiesService } from '@/services/companies.service'
import { X, Loader2 } from 'lucide-react'
import { toastMutationApiError } from '@/utils/apiError';
import {
  PRODUCT_TYPE_OPTIONS,
  useProductTypes,
  type ProductTypeValue,
} from '@/hooks/useProductTypes';

const schema = z.object({
  name: z.string().min(1, 'Company name is required'),
  address: z.string().optional(),
  credit_reset_cron: z.string().optional(),
  credit_reset_amount: z.coerce.number().min(0).optional(),
  product_types: z.array(z.string()).optional(),
})
type FormValues = z.infer<typeof schema>

interface CompanySheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    name: string
    address?: string | null
    credit_reset_cron?: string
    credit_reset_amount?: number
    product_types?: string | null
  } | null
}

function parseProductTypes(value?: string | null): ProductTypeValue[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => (PRODUCT_TYPE_OPTIONS as readonly string[]).includes(v)) as ProductTypeValue[]
}

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Monthly (1st)', value: '0 0 0 1 * *' },
  { label: 'Weekly (Mon)', value: '0 0 0 ? * MON' },
  { label: 'Daily', value: '0 0 0 * * ?' },
]

export default function CompanySheet({ open, onClose, editData }: CompanySheetProps) {
  const qc = useQueryClient()
  const { options: productTypes, isLoading: productTypesLoading } = useProductTypes()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      address: '',
      credit_reset_cron: '',
      credit_reset_amount: 0,
      product_types: [],
    },
  })

  const watchedCron = watch('credit_reset_cron') ?? ''
  const watchedProductTypes = watch('product_types') ?? []
  const allChecked =
    productTypes.length > 0 &&
    productTypes.every((t) => watchedProductTypes.includes(t))

  useEffect(() => {
    if (productTypesLoading || productTypes.length === 0) return

    if (editData) {
      const parsed = parseProductTypes(editData.product_types)
      const isFullSet =
        parsed.length === productTypes.length &&
        productTypes.every((t) => parsed.includes(t))
      reset({
        name: editData.name,
        address: editData.address ?? '',
        credit_reset_cron: editData.credit_reset_cron ?? '',
        credit_reset_amount: editData.credit_reset_amount ?? 0,
        product_types: isFullSet ? productTypes : parsed,
      })
    } else {
      reset({
        name: '',
        address: '',
        credit_reset_cron: '',
        credit_reset_amount: 0,
        product_types: productTypes,
      })
    }
  }, [editData, open, productTypes, productTypesLoading, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => companiesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create company'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => companiesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update company'),
  })

  const onSubmit = (data: FormValues) => {
    const selected = data.product_types ?? []
    const allSelected =
      productTypes.length > 0 &&
      productTypes.every((t) => selected.includes(t))
    const payload = {
      name: data.name,
      address: (data.address ?? '').trim(),
      credit_reset_cron: data.credit_reset_cron || undefined,
      credit_reset_amount: data.credit_reset_amount,
      product_types: allSelected ? null : selected.join(','),
    }
    if (editData) updateMutation.mutate(payload as any)
    else createMutation.mutate(payload as any)
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
          width: 400,
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
              {editData ? 'Edit Company' : 'New Company'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {editData ? 'Update company details' : 'Add a new company to the system'}
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
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Company Name
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                {...register('name')}
                placeholder="e.g. PT Dapur Cokelat Indonesia"
                style={errors.name ? inputErrorStyle : inputStyle}
              />
              {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
            </div>

            <div>
              <label style={labelStyle}>Address</label>
              <textarea
                {...register('address')}
                rows={3}
                placeholder="Street, district, city…"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Product Types
              </label>
              <p style={{ fontSize: 12, color: 'var(--foreground-subtle)', margin: '0 0 8px' }}>
                Select which product types are available. All are selected by default (allows all types).
              </p>
              {productTypesLoading ? (
                <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading product types…</div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {productTypes.map((type) => {
                    const isChecked = watchedProductTypes.includes(type)
                    return (
                      <button
                        key={type}
                        type="button"
                                                onClick={() => {
                          const isPresent = watchedProductTypes.includes(type)
                          if (isPresent) {
                            setValue(
                              'product_types',
                              watchedProductTypes.filter((t) => t !== type),
                              { shouldDirty: true },
                            )
                          } else {
                            setValue(
                              'product_types',
                              [...watchedProductTypes, type],
                              { shouldDirty: true },
                            )
                          }
                        }}
                        style={{
                          padding: '5px 12px',
                          background: allChecked || isChecked
                            ? 'var(--accent-light-bg)'
                            : 'var(--background)',
                          border: allChecked || isChecked
                            ? '1px solid var(--accent)'
                            : '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          color: allChecked || isChecked ? 'var(--accent)' : 'var(--foreground-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {(allChecked || isChecked) && (
                          <span
                            style={{


                              width: 5,
                              height: 5,
                              borderRadius: 99,
                              background: 'var(--accent)',
                            }}
                          />
                        )}
                        {type}
                      </button>
                    )
                  })}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--foreground-subtle)', margin: '8px 0 0' }}>
                {allChecked
                  ? 'All product types allowed (no restriction)'
                  : `Restricted to: ${watchedProductTypes.join(', ') || '—'}`}
              </p>
            </div>

            <div style={{ marginTop: 4 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  display: 'block',
                  marginBottom: 10,
                }}
              >
                Credit Settings
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    Monthly Credit Limit (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    {...register('credit_reset_amount', { valueAsNumber: true })}
                    placeholder="e.g. 150000"
                    style={inputStyle}
                  />
                  <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                    Credit given to each user per reset cycle
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    Reset Schedule (Cron)
                  </label>
                  <input
                    type="text"
                    {...register('credit_reset_cron')}
                    placeholder="e.g. 0 0 0 1 * * (monthly, Quartz 6-field)"
                    style={inputStyle}
                  />
                  <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                    When to reset user credits automatically
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                    display: 'block',
                    width: '100%',
                  }}
                >
                  Quick presets:
                </span>
                {CRON_PRESETS.map((preset) => {
                  const active = watchedCron === preset.value
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() =>
                        setValue('credit_reset_cron', preset.value, {
                          shouldDirty: true,
                        })
                      }
                      style={{
                        padding: '3px 8px',
                        background: active
                          ? 'var(--accent-light-bg)'
                          : 'var(--background)',
                        border: active
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        color: active ? 'var(--accent)' : 'var(--foreground-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
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
              {editData ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
