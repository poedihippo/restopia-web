'use client'

import React, { useState,  useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { operationRulesService } from '@/services/operation-rules.service'
import { branchesService } from '@/services/branches.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import CronPicker from '@/components/CronPicker'
import { useAuth } from '@/hooks/useAuth'
import { toastMutationApiError } from '@/utils/apiError';

const schema = z.object({
  branch_id: z.coerce.number().min(1, 'Branch is required'),
  open_mode: z.string().min(1, 'Open mode is required'),
  close_mode: z.string().min(1, 'Close mode is required'),
  shift_mode: z.string().min(1, 'Shift mode is required'),
  auto_open_cron: z.string().optional(),
  auto_close_cron: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface OperationRuleSheetProps {
  open: boolean
  onClose: () => void
  editData?: any | null
}

export default function OperationRuleSheet({ open, onClose, editData }: OperationRuleSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { user, isSuperadmin } = useAuth()
  const qc = useQueryClient()

  
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', 'options', debouncedDropdownSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedDropdownSearch || undefined, per_page: 30 } as any).then((r) => r.data),
    enabled: isSuperadmin && open,
    placeholderData: (prev: any) => prev,
  })
  const allBranches = (branchesData as any)?.data ?? []
  // Keep the edited record's branch selectable even when it is not in the
  // current search page.
  const branchSource = isSuperadmin ? allBranches : user?.branches ?? []
  const branchRows =
    editData?.branch?.id && !branchSource.some((b: any) => b.id === editData.branch.id)
      ? [editData.branch, ...branchSource]
      : branchSource
  const branchOptions = branchRows.map((b: any) => ({
    value: b.id as number,
    label: (b.name as string) ?? '',
    sublabel: b.code as string | undefined,
  }))

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      branch_id: 0,
      open_mode: undefined,
      close_mode: undefined,
      shift_mode: undefined,
      auto_open_cron: '',
      auto_close_cron: '',
    },
  })

  useEffect(() => {
    if (editData) {
      reset({
        branch_id: editData.branch_id ?? user?.branch?.id ?? 0,
        open_mode: editData.open_mode ?? undefined,
        close_mode: editData.close_mode ?? undefined,
        shift_mode: editData.shift_mode ?? undefined,
        auto_open_cron: editData.auto_open_cron ?? '',
        auto_close_cron: editData.auto_close_cron ?? '',
      })
    } else {
      reset({
        branch_id: user?.branch?.id ?? 0,
        open_mode: undefined,
        close_mode: undefined,
        shift_mode: undefined,
        auto_open_cron: '',
        auto_close_cron: '',
      })
    }
  }, [editData, open, reset, user])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => operationRulesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operationrules'] })
      toast.success('Operation Rule created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create Operation Rule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => operationRulesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operationrules'] })
      toast.success('Operation Rule updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update Operation Rule'),
  })

  const onSubmit = (data: FormValues) => {
    if (editData) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', background: 'var(--surface)',
    color: 'var(--foreground)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', cursor: 'pointer',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 440, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {editData ? 'Edit Operation Rule' : 'New Operation Rule'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Branch</label>
              <Controller
                name="branch_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={branchOptions}
                    placeholder="Select branch..."
                    searchPlaceholder="Search branch..."
                    loading={branchesLoading}
                    error={errors.branch_id?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
              {errors.branch_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.branch_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Open Mode <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                {...register('open_mode')}
                style={selectStyle}
              >
                <option value="">Select mode...</option>
                <option value="auto">auto</option>
                <option value="manual">manual</option>
              </select>
              {errors.open_mode && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.open_mode.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Close Mode <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                {...register('close_mode')}
                style={selectStyle}
              >
                <option value="">Select mode...</option>
                <option value="auto">auto</option>
                <option value="manual">manual</option>
              </select>
              {errors.close_mode && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.close_mode.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Shift Mode <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                {...register('shift_mode')}
                style={selectStyle}
              >
                <option value="">Select mode...</option>
                <option value="auto">auto</option>
                <option value="manual">manual</option>
              </select>
              {errors.shift_mode && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.shift_mode.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Auto Open Cron</label>
              <Controller
                name="auto_open_cron"
                control={control}
                render={({ field }) => (
                  <CronPicker
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    disabled={isPending}
                    error={errors.auto_open_cron?.message as string | undefined}
                  />
                )}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Auto Close Cron</label>
              <Controller
                name="auto_close_cron"
                control={control}
                render={({ field }) => (
                  <CronPicker
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    disabled={isPending}
                    error={errors.auto_close_cron?.message as string | undefined}
                  />
                )}
              />
            </div>
          </div>
          
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isPending ? 0.7 : 1 }}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {editData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
