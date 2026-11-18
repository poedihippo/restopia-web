'use client'

import React, { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shiftRulesService } from '@/services/shift-rules.service'
import { branchesService } from '@/services/branches.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'
import { branchSelectOptions, withBranchDetails } from '@/lib/branchOptions'
import { toastMutationApiError } from '@/utils/apiError';

const schema = z.object({
  branch_id: z.coerce.number().optional(),
  name: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional()
})
type FormValues = z.infer<typeof schema>

interface ShiftRuleSheetProps {
  open: boolean
  onClose: () => void
  editData?: any | null
}

export default function ShiftRuleSheet({ open, onClose, editData }: ShiftRuleSheetProps) {

  const { user, isSuperadmin } = useAuth()
  const qc = useQueryClient()

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    // Whole list (~30 branches) so each pickup point sits under its premiere; search is client-side.
    queryKey: ['branches-all', 'with-company'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name', include: 'company' } as any).then((r) => r.data),
    enabled: open,
  })
  const allBranches = (branchesData as any)?.data ?? []
  // Keep the edited record's branch selectable even when it is not in the list.
  const branchSource = isSuperadmin ? allBranches : withBranchDetails((user as any)?.branches, allBranches, (user as any)?.branch?.company)
  const branchRows =
    editData?.branch?.id && !branchSource.some((b: any) => b.id === editData.branch.id)
      ? [editData.branch, ...branchSource]
      : branchSource
  const branchOptions = branchSelectOptions(
    branchRows,
    (b: any) => (b.name as string) ?? '',
    (b: any) => ({ sublabel: b.code as string | undefined }),
  )

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
      name: '',
      start_time: '',
      end_time: '',
    },
  })

  useEffect(() => {
    if (editData) {
      reset({
        branch_id: editData.branch_id ?? user?.branch?.id ?? 0,
        name: editData.name ?? '',
        start_time: editData.start_time ?? '',
        end_time: editData.end_time ?? '',
      })
    } else {
      reset({
        branch_id: user?.branch?.id ?? 0,
        name: '',
        start_time: '',
        end_time: '',
      })
    }
  }, [editData, open, reset, user])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => shiftRulesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shiftrules'] })
      toast.success('ShiftRule created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create ShiftRule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => shiftRulesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shiftrules'] })
      toast.success('ShiftRule updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update ShiftRule'),
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
            {editData ? 'Edit ShiftRule' : 'New ShiftRule'}
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
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Name</label>
              <input
                {...register('name')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.name && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.name.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Start Time (HH:mm)</label>
              <input
                {...register('start_time')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.start_time && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.start_time.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>End Time (HH:mm)</label>
              <input
                {...register('end_time')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.end_time && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.end_time.message as string}</span>}
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