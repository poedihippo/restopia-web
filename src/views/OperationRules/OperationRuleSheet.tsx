'use client'

import React, { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { operationRulesService } from '@/services/operation-rules.service'
import { branchesService } from '@/services/branches.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'
import { toastMutationApiError } from '@/utils/apiError';

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
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', 'list-all'],
    queryFn: () => branchesService.list({ limit: 1000 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []
  const branchOptions = branches.map((b: any) => ({
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
      operation_mode: '',
      shift_mode: '',
      auto_open_cron: '',
      auto_close_cron: '',
    },
  })

  useEffect(() => {
    if (editData) {
      reset({
        branch_id: editData.branch_id ?? (user as any)?.employee?.branch_id ?? 0,
        operation_mode: editData.operation_mode ?? '',
        shift_mode: editData.shift_mode ?? '',
        auto_open_cron: editData.auto_open_cron ?? '',
        auto_close_cron: editData.auto_close_cron ?? '',
      })
    } else {
      reset({
        branch_id: (user as any)?.employee?.branch_id ?? 0,
        operation_mode: '',
        shift_mode: '',
        auto_open_cron: '',
        auto_close_cron: '',
      })
    }
  }, [editData, open, reset, user])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => operationRulesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operationrules'] })
      toast.success('OperationRule created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create OperationRule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => operationRulesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operationrules'] })
      toast.success('OperationRule updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update OperationRule'),
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
                    searchPlaceholder="Search branch..."
                    loading={branchesLoading}
                    error={errors.branch_id?.message as string | undefined}
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
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.auto_open_cron && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.auto_open_cron.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Auto Close Cron</label>
              <input
                {...register('auto_close_cron')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
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