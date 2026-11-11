'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Loader2, Check } from 'lucide-react'
import { enumsService } from '@/services/enums.service'
import {
  COMPANY_SETTING_KEYS,
  companySettingsService,
  type CompanySetting,
} from '@/services/company-settings.service'

const HANDLING_FEE_KEY = 'invoice_cross_company_handling_fee_percent'

/** Friendly label + hint per known CompanySettingKey. */
const KEY_META: Record<string, { label: string; hint: string; unit?: string }> = {
  [HANDLING_FEE_KEY]: {
    label: 'Cross-company invoice handling fee (%)',
    hint: 'Added to invoices billed to a branch of another company. 0 or empty = off.',
    unit: '%',
  },
}

export function companySettingLabel(key: string | null | undefined): string | undefined {
  return key ? KEY_META[key]?.label : undefined
}

const schema = z
  .object({
    key: z.string().min(1, 'Key is required'),
    value: z.string(),
    description: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.key === HANDLING_FEE_KEY) {
      const raw = v.value.trim()
      if (raw === '') return // empty = off
      const n = Number(raw)
      if (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(n) || n < 0 || n > 100) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a number between 0 and 100 (max 2 decimals)' })
      }
    }
  })
type FormValues = z.infer<typeof schema>

interface CompanySettingSheetProps {
  open: boolean
  onClose: () => void
  editData?: CompanySetting | null
  /** Keys already set on the visible page — hidden from the create select. */
  existingKeys?: string[]
}

/** GET /v1/enums may return the map directly or inside the { data } envelope. */
function readEnumKeys(raw: any): string[] {
  const map = raw && typeof raw === 'object' && raw.data && !Array.isArray(raw.data) ? raw.data : raw
  const list = map?.CompanySettingKey
  if (!Array.isArray(list) || list.length === 0) return [...COMPANY_SETTING_KEYS]
  return list
    .map((v: any) => (typeof v === 'string' ? v : v?.value ?? v?.key ?? ''))
    .filter(Boolean)
}

export default function CompanySettingSheet({ open, onClose, editData, existingKeys = [] }: CompanySettingSheetProps) {
  const qc = useQueryClient()
  const isEdit = !!editData

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { key: '', value: '', description: '' },
  })

  const { data: enumsData } = useQuery({
    queryKey: ['enums'],
    queryFn: () => enumsService.getAll().then((r) => r.data),
    enabled: open && !isEdit,
  })
  const keyOptions = readEnumKeys(enumsData).filter((k) => !existingKeys.includes(k))

  useEffect(() => {
    if (!open) return
    if (editData) {
      reset({ key: editData.key, value: editData.value ?? '', description: editData.description ?? '' })
    } else {
      reset({ key: keyOptions.length === 1 ? keyOptions[0] : '', value: '', description: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData, open, reset])

  const selectedKey = watch('key')
  const meta = KEY_META[selectedKey]

  const handleApiError = (err: any, fallback: string) => {
    const resp = err?.response?.data
    const fieldErrors = resp?.errors as Record<string, string[] | string> | undefined
    let shown = false
    if (fieldErrors && typeof fieldErrors === 'object') {
      for (const [field, msgs] of Object.entries(fieldErrors)) {
        const msg = Array.isArray(msgs) ? msgs[0] : msgs
        if (field === 'key' || field === 'value' || field === 'description') {
          setError(field, { type: 'server', message: String(msg) })
          shown = true
        }
      }
    }
    toast.error(resp?.message ?? fallback)
    return shown
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: (v: FormValues) => {
      // The API needs a value; an empty fee means off, which is 0.
      const value = v.value.trim() || (v.key === HANDLING_FEE_KEY || editData?.key === HANDLING_FEE_KEY ? '0' : '')
      const description = v.description?.trim() ? v.description.trim() : null
      return isEdit
        ? companySettingsService.update(editData!.id, { value, description })
        : companySettingsService.create({ key: v.key, value, description })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] })
      toast.success(isEdit ? 'Setting updated' : 'Setting created')
      onClose()
    },
    onError: (err: any) => handleApiError(err, isEdit ? 'Failed to update setting' : 'Failed to create setting'),
  })

  if (!open) return null

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface)',
    color: 'var(--foreground)',
    fontSize: 14,
    outline: 'none',
  }
  const errStyle: React.CSSProperties = { fontSize: 12, color: 'var(--destructive)' }
  const hintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--foreground-muted)', lineHeight: 1.45 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div role="presentation" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: '100%',
          maxWidth: 440,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
            {isEdit ? 'Edit Company Setting' : 'Add Company Setting'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit((v) => save(v))} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Setting</label>
              {isEdit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--background)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{meta?.label ?? editData!.key}</span>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{editData!.key}</span>
                </div>
              ) : (
                <select {...register('key')} style={inputStyle}>
                  <option value="">Select a setting…</option>
                  {keyOptions.map((k) => (
                    <option key={k} value={k}>
                      {KEY_META[k]?.label ?? k}
                    </option>
                  ))}
                </select>
              )}
              {!isEdit && keyOptions.length === 0 && (
                <span style={hintStyle}>All available settings are already configured.</span>
              )}
              {errors.key && <span style={errStyle}>{errors.key.message as string}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>{meta?.label ?? 'Value'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  {...register('value')}
                  inputMode={meta?.unit === '%' ? 'decimal' : undefined}
                  placeholder={meta?.unit === '%' ? 'e.g. 3 or 2.5' : ''}
                  style={{ ...inputStyle, paddingRight: meta?.unit ? 32 : 12 }}
                />
                {meta?.unit && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {meta.unit}
                  </span>
                )}
              </div>
              {meta?.hint && <span style={hintStyle}>{meta.hint}</span>}
              {errors.value && <span style={errStyle}>{errors.value.message as string}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                {...register('description')}
                rows={3}
                style={{ ...inputStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
              />
              {errors.description && <span style={errStyle}>{errors.description.message as string}</span>}
            </div>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
