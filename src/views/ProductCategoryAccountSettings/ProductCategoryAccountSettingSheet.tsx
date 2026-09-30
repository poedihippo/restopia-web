'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productCategoryAccountSettingsService } from '@/services/product-category-account-settings.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select'
import { X, Loader2, Check } from 'lucide-react'
import { toastMutationApiError } from '@/utils/apiError'

const createSchema = z.object({
  product_category_id: z.coerce.number().min(1, 'Product category is required'),
  chart_of_account_id: z.coerce.number().min(1, 'Chart of Account is required'),
  description: z.string().optional(),
})
const editSchema = z.object({
  product_category_id: z.coerce.number().optional(),
  chart_of_account_id: z.coerce.number().optional(),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof createSchema>

interface Props {
  open: boolean
  onClose: () => void
  editData?: any | null
}

export default function ProductCategoryAccountSettingSheet({ open, onClose, editData }: Props) {
  const qc = useQueryClient()
  const isEdit = !!editData

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as any,
    defaultValues: { product_category_id: 0, chart_of_account_id: 0, description: '' },
  })

  const productCategoryId = watch('product_category_id')
  const chartOfAccountId = watch('chart_of_account_id')

  useEffect(() => {
    if (editData) {
      reset({
        product_category_id: editData.product_category_id ?? 0,
        chart_of_account_id: editData.chart_of_account_id ?? 0,
        description: editData.description ?? '',
      })
    } else {
      reset({ product_category_id: 0, chart_of_account_id: 0, description: '' })
    }
  }, [editData, open, reset])

  const [catSearch, setCatSearch] = useState('')
  const [coaSearch, setCoaSearch] = useState('')

  const { data: catData } = useQuery({
    queryKey: ['product-categories-all', catSearch],
    queryFn: () => productCategoriesService.list({ per_page: 50, 'filter[search]': catSearch || undefined } as any).then(r => r.data),
    enabled: open,
  })
  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-all', coaSearch],
    queryFn: () => chartOfAccountsService.list({ per_page: 50, 'filter[search]': coaSearch || undefined } as any).then(r => r.data),
    enabled: open,
  })

  const catOptions: SelectOption[] = ((catData as any)?.data ?? []).map((c: any) => ({ value: c.id, label: c.name }))
  const coaOptions: SelectOption[] = ((coaData as any)?.data ?? []).filter((c: any) => !c.is_header && c.is_active !== false && c.normal_balance === 'debit').map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` }))

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productCategoryAccountSettingsService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-category-account-settings'] })
      toast.success('Account setting created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create account setting'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productCategoryAccountSettingsService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-category-account-settings'] })
      toast.success('Account setting updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update account setting'),
  })

  const onSubmit = (data: FormValues) => {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--foreground)', marginBottom: 4, display: 'block' }
  const errorStyle: React.CSSProperties = { fontSize: 12, color: 'var(--destructive)', marginTop: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 440, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {isEdit ? 'Edit Account Setting' : 'New Account Setting'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Product Category <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <SearchableSelect
                value={catOptions.find(o => o.value === productCategoryId) || null}
                options={catOptions}
                onChange={(val: any) => setValue('product_category_id', val?.value || 0, { shouldValidate: true })}
                onInputChange={(val, { action }) => { if (action === 'input-change') setCatSearch(val) }}
                placeholder="Search category..."
                isClearable
              />
              {errors.product_category_id && <span style={errorStyle}>{errors.product_category_id.message as string}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Chart of Account (Debit Normal) <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <SearchableSelect
                value={coaOptions.find(o => o.value === chartOfAccountId) || null}
                options={coaOptions}
                onChange={(val: any) => setValue('chart_of_account_id', val?.value || 0, { shouldValidate: true })}
                onInputChange={(val, { action }) => { if (action === 'input-change') setCoaSearch(val) }}
                placeholder="Search account..."
                isClearable
              />
              {errors.chart_of_account_id && <span style={errorStyle}>{errors.chart_of_account_id.message as string}</span>}
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Only active, non-header, debit-normal accounts are shown</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea {...register('description')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
