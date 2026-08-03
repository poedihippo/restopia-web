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

const schema = z.object({
  name: z.string().min(1, 'Company name is required'),
  credit_reset_cron: z.string().optional(),
  credit_reset_amount: z.coerce.number().min(0).optional(),
})
type FormValues = z.infer<typeof schema>

interface CompanySheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    name: string
    credit_reset_cron?: string
    credit_reset_amount?: number
  } | null
}

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Monthly (1st)', value: '0 0 1 * *' },
  { label: 'Weekly (Mon)', value: '0 0 * * 1' },
  { label: 'Daily', value: '0 0 * * *' },
]

export default function CompanySheet({ open, onClose, editData }: CompanySheetProps) {
  const qc = useQueryClient()

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
      credit_reset_cron: '',
      credit_reset_amount: 0,
    },
  })

  const watchedCron = watch('credit_reset_cron') ?? ''

  useEffect(() => {
    if (editData) {
      reset({
        name: editData.name,
        credit_reset_cron: editData.credit_reset_cron ?? '',
        credit_reset_amount: editData.credit_reset_amount ?? 0,
      })
    } else {
      reset({
        name: '',
        credit_reset_cron: '',
        credit_reset_amount: 0,
      })
    }
  }, [editData, open, reset])

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
                    placeholder="e.g. 0 0 1 * * (monthly)"
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
