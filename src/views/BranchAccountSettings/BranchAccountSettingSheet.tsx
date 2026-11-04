'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchAccountSettingsService } from '@/services/branch-account-settings.service'
import { accountSettingsService } from '@/services/account-settings.service'
import { branchesService } from '@/services/branches.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select'
import { X, Loader2, Check, AlertTriangle } from 'lucide-react'
import { toastMutationApiError } from '@/utils/apiError'
import { useDebounce } from '@/hooks/useDebounce'

const createSchema = z.object({
  branch_id: z.coerce.number().min(1, 'Branch is required'),
  account_setting_key_id: z.coerce.number().min(1, 'Account key is required'),
  chart_of_account_id: z.coerce.number().min(1, 'Chart of Account is required'),
  description: z.string().optional(),
})
const editSchema = z.object({
  branch_id: z.coerce.number().optional(),
  account_setting_key_id: z.coerce.number().optional(),
  chart_of_account_id: z.coerce.number().optional(),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof createSchema>

interface AccountSettingKey {
  id: number
  key: string
  label: string
  expected_normal_balance: string
  module: string
}

interface Props {
  open: boolean
  onClose: () => void
  editData?: any | null
}

const PICKUP_POINT_DISABLED_KEYS = ['ar_trade', 'ar_trade_customer', 'ap_trade']

export default function BranchAccountSettingSheet({ open, onClose, editData }: Props) {
  const qc = useQueryClient()
  const isEdit = !!editData

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as any,
    defaultValues: { branch_id: 0, account_setting_key_id: 0, chart_of_account_id: 0, description: '' },
  })

  const branchId = watch('branch_id')
  const keyId = watch('account_setting_key_id')
  const chartOfAccountId = watch('chart_of_account_id')

  useEffect(() => {
    if (editData) {
      reset({
        branch_id: editData.branch_id ?? 0,
        account_setting_key_id: editData.account_setting_key_id ?? 0,
        chart_of_account_id: editData.chart_of_account_id ?? 0,
        description: editData.description ?? '',
      })
    } else {
      reset({ branch_id: 0, account_setting_key_id: 0, chart_of_account_id: 0, description: '' })
    }
  }, [editData, open, reset])

  // Branch + COA selects search on the server; each has its own term.
  const [branchSearch, setBranchSearch] = useState('')
  const [coaSearch, setCoaSearch] = useState('')
  const debouncedBranchSearch = useDebounce(branchSearch, 400)
  const debouncedCoaSearch = useDebounce(coaSearch, 400)

  const { data: branchesData, isFetching: branchesLoading } = useQuery({
    queryKey: ['branch-account-branch-options', debouncedBranchSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedBranchSearch || undefined, per_page: 30, sort: 'name' } as any).then(r => r.data),
    enabled: open,
    placeholderData: (prev: any) => prev,
  })

  const { data: accountSettingsData } = useQuery({
    queryKey: ['account-settings'],
    queryFn: () => accountSettingsService.list({ per_page: 100, include: 'account_setting_key' } as any).then(r => r.data),
    enabled: open,
  })

  // Every branch / COA seen so far, so the selected value keeps its label
  // (and pickup-point flag) when a new search page doesn't contain it.
  const seenBranchesRef = useRef(new Map<number, any>())
  const seenCoaRef = useRef(new Map<number, any>())
  if (editData?.branch?.id) seenBranchesRef.current.set(editData.branch.id, editData.branch)
  if (editData?.chart_of_account?.id) seenCoaRef.current.set(editData.chart_of_account.id, editData.chart_of_account)

  const allBranches: any[] = (branchesData as any)?.data ?? []
  for (const b of allBranches) seenBranchesRef.current.set(b.id, b)
  const selectedBranch = seenBranchesRef.current.get(branchId)
  const isPickupPoint = selectedBranch?.format === 'pickup_point'

  const accountKeys: AccountSettingKey[] = useMemo(() => {
    const settings: any[] = (accountSettingsData as any)?.data ?? []
    const keyMap = new Map<number, AccountSettingKey>()
    for (const s of settings) {
      const entity = s.account_setting_key_entity
      if (entity && !keyMap.has(entity.id)) {
        keyMap.set(entity.id, {
          id: entity.id,
          key: entity.key,
          label: entity.label,
          expected_normal_balance: entity.expected_normal_balance,
          module: entity.module,
        })
      }
    }
    return Array.from(keyMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [accountSettingsData])

  const availableKeys = useMemo(() => {
    return accountKeys.filter(k => !isPickupPoint || !PICKUP_POINT_DISABLED_KEYS.includes(k.key))
  }, [accountKeys, isPickupPoint])

  const selectedKeyInfo = accountKeys.find(k => k.id === keyId)

  const { data: coaData, isFetching: coaLoading } = useQuery({
    queryKey: ['branch-account-coa-options', debouncedCoaSearch, selectedKeyInfo?.expected_normal_balance ?? ''],
    queryFn: () => chartOfAccountsService.list({
      per_page: 30,
      'filter[search]': debouncedCoaSearch || undefined,
      'filter[is_header]': 'false',
      'filter[is_active]': 'true',
      'filter[normal_balance]': selectedKeyInfo?.expected_normal_balance || undefined,
    } as any).then(r => r.data),
    enabled: open,
    placeholderData: (prev: any) => prev,
  })

  const branchLabel = (b: any) => `${b.code} - ${b.name}${b.format === 'pickup_point' ? ' (Pickup Point)' : ''}`
  const branchOptions: SelectOption[] = allBranches.map((b: any) => ({ value: b.id, label: branchLabel(b) }))
  const selectedBranchOption: SelectOption | null = selectedBranch ? { value: selectedBranch.id, label: branchLabel(selectedBranch) } : null

  const coaOptions: SelectOption[] = useMemo(() => {
    const accounts = ((coaData as any)?.data ?? []).filter((c: any) => !c.is_header && c.is_active !== false)
    for (const c of accounts) seenCoaRef.current.set(c.id, c)
    if (!selectedKeyInfo) return accounts.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.normal_balance})` }))
    return accounts
      .filter((c: any) => c.normal_balance === selectedKeyInfo.expected_normal_balance)
      .map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` }))
  }, [coaData, selectedKeyInfo])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => branchAccountSettingsService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-account-settings'] })
      toast.success('Account setting created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create account setting'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => branchAccountSettingsService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-account-settings'] })
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
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 480, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {isEdit ? 'Edit Branch Account Setting' : 'New Branch Account Setting'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Branch <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <SearchableSelect
                value={selectedBranchOption}
                options={branchOptions}
                filterOption={null}
                isLoading={branchesLoading}
                onChange={(val: any) => {
                  setValue('branch_id', val?.value || 0, { shouldValidate: true })
                }}
                onInputChange={(val, { action }) => { if (action === 'input-change') setBranchSearch(val) }}
                placeholder="Search branch..."
                isClearable
              />
              {errors.branch_id && <span style={errorStyle}>{errors.branch_id.message as string}</span>}
              {isPickupPoint && (
                <span style={{ fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> Pickup point: AR Trade, AR Trade Customer, and AP Trade keys are hidden
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Account Setting Key <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                value={keyId || ''}
                onChange={(e) => {
                  const newKeyId = e.target.value ? Number(e.target.value) : 0
                  setValue('account_setting_key_id', newKeyId, { shouldValidate: true })
                  setValue('chart_of_account_id', 0, { shouldValidate: true })
                }}
                style={inputStyle}
              >
                <option value="">Select key...</option>
                {availableKeys.map(k => (
                  <option key={k.id} value={k.id}>{k.label} ({k.key})</option>
                ))}
              </select>
              {errors.account_setting_key_id && <span style={errorStyle}>{errors.account_setting_key_id.message as string}</span>}
              {selectedKeyInfo && (
                <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                  Expected normal balance: <strong>{selectedKeyInfo.expected_normal_balance}</strong> | Module: {selectedKeyInfo.module}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Chart of Account {selectedKeyInfo ? `(${selectedKeyInfo.expected_normal_balance}-normal)` : ''} <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <SearchableSelect
                value={coaOptions.find(o => o.value === chartOfAccountId) || (seenCoaRef.current.has(chartOfAccountId) ? { value: chartOfAccountId, label: `${seenCoaRef.current.get(chartOfAccountId).code} - ${seenCoaRef.current.get(chartOfAccountId).name}` } : null)}
                options={coaOptions}
                filterOption={null}
                isLoading={coaLoading}
                onChange={(val: any) => setValue('chart_of_account_id', val?.value || 0, { shouldValidate: true })}
                onInputChange={(val, { action }) => { if (action === 'input-change') setCoaSearch(val) }}
                placeholder="Search account..."
                isClearable
              />
              {errors.chart_of_account_id && <span style={errorStyle}>{errors.chart_of_account_id.message as string}</span>}
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                {selectedKeyInfo
                  ? `Only active, non-header, ${selectedKeyInfo.expected_normal_balance}-normal accounts are shown`
                  : 'Select a key first to filter by normal balance'}
              </span>
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
