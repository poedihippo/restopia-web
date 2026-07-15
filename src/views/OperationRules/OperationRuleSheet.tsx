'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { operationRulesService } from '@/services/operation-rules.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { branchesService } from '@/services/branches.service'

const schema = z.object({
  branch_id: z.coerce.number().optional(),
  operation_mode: z.string().optional(),
  shift_mode: z.string().optional(),
  auto_open_cron: z.string().optional(),
  auto_close_cron: z.string().optional()
})
type FormValues = z.infer<typeof schema>

interface OperationRuleSheetProps {
  open: boolean
  onClose: () => void
  editData?: any | null
}

export default function OperationRuleSheet({ open, onClose, editData }: OperationRuleSheetProps) {
  const qc = useQueryClient()

  const { data: branchData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches-select'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  
  const { data: opRulesData, isLoading: isLoadingRules } = useQuery({
    queryKey: ['operationrules'], // Use the same key used for listing
    queryFn: () => operationRulesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const existingBranchIds = new Set(((opRulesData as any)?.data ?? []).map((r: any) => r.branch_id))

  const branchOptions = ((branchData as any)?.data ?? [])
    .filter((b: any) => !existingBranchIds.has(b.id) || (editData && editData.branch_id === b.id))
    .map((b: any) => ({
      value: b.id,
      label: b.name,
    }))



  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      branch_id: 0,
      operation_mode: '',
      shift_mode: '',
      auto_open_cron: '',
      auto_close_cron: '',
    },
  })

  useEffect(() => {
    if (editData) {
      reset({
        branch_id: editData.branch_id ?? 0,
        operation_mode: editData.operation_mode ?? '',
        shift_mode: editData.shift_mode ?? '',
        auto_open_cron: editData.auto_open_cron ?? '',
        auto_close_cron: editData.auto_close_cron ?? '',
      })
    } else {
      reset({
        branch_id: 0,
        operation_mode: '',
        shift_mode: '',
        auto_open_cron: '',
        auto_close_cron: '',
      })
    }
  }, [editData, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => operationRulesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operationrules'] })
      toast.success('OperationRule created')
      onClose()
    },
    onError: () => toast.error('Failed to create OperationRule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => operationRulesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operationrules'] })
      toast.success('OperationRule updated')
      onClose()
    },
    onError: () => toast.error('Failed to update OperationRule'),
  })

  const onSubmit = (data: FormValues) => {
    if (editData) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 440, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {editData ? 'Edit OperationRule' : 'New OperationRule'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Branch ID</label>
              
              <Controller
                name="branch_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={branchOptions}
                    placeholder="Select branch..."
                    loading={isLoadingBranches}
                  />
                )}
              />
    
              {errors.branch_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.branch_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Operation Mode (auto/manual)</label>
              <input
                {...register('operation_mode')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.operation_mode && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.operation_mode.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Shift Mode (auto/manual)</label>
              <input
                {...register('shift_mode')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.shift_mode && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.shift_mode.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Auto Open Cron</label>
              <input
                {...register('auto_open_cron')}
                placeholder="0 0 9 * * * (09:00 every day)"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Templates:</span>
                {[
                  { label: '07:00', value: '0 0 7 * * *' },
                  { label: '08:00', value: '0 0 8 * * *' },
                  { label: '09:00', value: '0 0 9 * * *' },
                  { label: '10:00', value: '0 0 10 * * *' },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setValue('auto_open_cron', t.value)}
                    style={{ padding: '2px 8px', fontSize: 11, background: 'var(--accent-subtle)', color: 'var(--accent)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {errors.auto_open_cron && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.auto_open_cron.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Auto Close Cron</label>
              <input
                {...register('auto_close_cron')}
                placeholder="0 0 22 * * * (22:00 every day)"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Templates:</span>
                {[
                  { label: '21:00', value: '0 0 21 * * *' },
                  { label: '22:00', value: '0 0 22 * * *' },
                  { label: '23:00', value: '0 0 23 * * *' },
                  { label: '23:59', value: '0 59 23 * * *' },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setValue('auto_close_cron', t.value)}
                    style={{ padding: '2px 8px', fontSize: 11, background: 'var(--accent-subtle)', color: 'var(--accent)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {errors.auto_close_cron && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.auto_close_cron.message as string}</span>}
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