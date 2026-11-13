'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { toast } from 'sonner'
import { accountSettingsService } from '@/services/account-settings.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select'
import { X, Loader2, Check } from 'lucide-react'

const schema = z.object({
  chart_of_account_id: z.coerce.number().min(1, 'Chart of Account is required'),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface AccountSettingSheetProps {
  open: boolean
  onClose: () => void
  editData?: any | null
}

export default function AccountSettingSheet({ open, onClose, editData }: AccountSettingSheetProps) {
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      chart_of_account_id: 0,
      description: '',
    },
  })

  const chartOfAccountId = watch('chart_of_account_id')

  useEffect(() => {
    if (editData) {
      reset({
        chart_of_account_id: editData.chart_of_account_id ?? 0,
        description: editData.description ?? '',
      })
    } else {
      reset({ chart_of_account_id: 0, description: '' })
    }
  }, [editData, open, reset])

  const [coaSearch, setCoaSearch] = useState('')

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(coaSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [coaSearch])

  // Same COA rules the API enforces on the branch/buyer overrides: active,
  // non-header, and the key's expected normal balance.
  const expectedNormalBalance: string | undefined = editData?.account_setting_key_entity?.expected_normal_balance
  const coaOpts = useInfiniteOptions<any>({
    queryKey: ['chart-of-accounts-all', 'account-settings', debouncedSearch, debouncedDropdownSearch, expectedNormalBalance ?? ''],
    fetchPage: (page) => chartOfAccountsService.list({
      page,
      per_page: 50,
      'filter[search]': debouncedSearch || undefined,
      'filter[is_header]': 'false',
      'filter[is_active]': 'true',
      'filter[normal_balance]': expectedNormalBalance || undefined,
    } as any).then(r => r.data),
    enabled: open
  })
  
  const coaOptions: any[] = coaOpts.items
  
  const selectOptions: SelectOption[] = coaOptions.map(coa => ({
    value: coa.id,
    label: `${coa.code} - ${coa.name}`
  }))

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => accountSettingsService.update(editData!.id, {
        account_setting_key_id: editData!.account_setting_key_id,
        ...data
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-settings'] })
      toast.success('Account Setting updated')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to update Account Setting'),
  })

  const onSubmit = (data: FormValues) => {

    if (editData) updateMutation.mutate(data)
  }

  const isPending = updateMutation.isPending

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 440, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            Edit Account Setting
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {editData?.account_setting_key_entity && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>Key</span>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                        {editData.account_setting_key_entity.label} ({editData.account_setting_key_entity.key})
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Module: {editData.account_setting_key_entity.module}</span>
                </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Chart of Account</label>
              <SearchableSelect
                value={selectOptions.find(o => o.value === chartOfAccountId) || null}
                options={selectOptions}
                onChange={(val: any) => setValue('chart_of_account_id', val?.value || 0)}
                onInputChange={(val, { action }) => {
                  if (action === 'input-change') {
                    setCoaSearch(val)
                  }
                }}
                placeholder="Search account..."
                isClearable
                isLoading={coaOpts.loading}
                {...coaOpts.selectProps}
                onSearchChange={setDropdownSearch}
/>
              {errors.chart_of_account_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.chart_of_account_id.message as string}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Description</label>
              <textarea
                {...register('description')}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', resize: 'vertical' }}
              />
              {errors.description && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.description.message as string}</span>}
            </div>
          </div>
          
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
