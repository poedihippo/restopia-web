'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { operationsService } from '@/services/operations.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { branchesService } from '@/services/branches.service'
import { operationRulesService } from '@/services/operation-rules.service'

const schema = z.object({
  branch_id: z.coerce.number().optional(),
  date: z.string().optional(),
  operation_rule_id: z.coerce.number().optional()
})
type FormValues = z.infer<typeof schema>

interface OperationSheetProps {
  open: boolean
  onClose: () => void
  mode: "open" | "rollover"
}

export default function OperationSheet({ open, onClose, mode }: OperationSheetProps) {
  const qc = useQueryClient()

  const { data: branchData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches-select'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({
    value: b.id,
    label: b.name,
  }))

  const { data: opRuleData, isLoading: isLoadingOpRules } = useQuery({
    queryKey: ['operation-rules-select'],
    queryFn: () => operationRulesService.list({ per_page: 100, include: 'branch' } as any).then((r) => r.data),
  })
  const operationRuleOptions = ((opRuleData as any)?.data ?? []).map((r: any) => ({
    value: r.id,
    label: r.branch?.name ? `Rule for ${r.branch.name} (ID: ${r.id})` : `Rule #${r.id}`, 
  }))



  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      branch_id: 0,
      date: '',
      operation_rule_id: 0,
    },
  })

  useEffect(() => {
    reset({
      branch_id: 0,
      date: '',
      operation_rule_id: 0,
    })
  }, [open, reset])

  
  const openMutation = useMutation({
    mutationFn: (data: FormValues) => operationsService.open(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] })
      toast.success('Operation opened')
      onClose()
    },
    onError: () => toast.error('Failed to open Operation'),
  })

  const rolloverMutation = useMutation({
    mutationFn: (data: FormValues) => operationsService.rollover(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] })
      toast.success('Operation rolled over')
      onClose()
    },
    onError: () => toast.error('Failed to rollover Operation'),
  })

  const onSubmit = (data: FormValues) => {
    if (mode === 'open') openMutation.mutate(data)
    else rolloverMutation.mutate(data)
  }

  const isPending = openMutation.isPending || rolloverMutation.isPending


  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 440, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {mode === "open" ? "Open Operation" : "Rollover Operation"}
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
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Date (YYYY-MM-DD)</label>
              <input
                {...register('date')} type="date"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.date && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.date.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Operation Rule ID</label>
              
              <Controller
                name="operation_rule_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={operationRuleOptions}
                    placeholder="Select operation rule..."
                    loading={isLoadingOpRules}
                  />
                )}
              />
  
              {errors.operation_rule_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.operation_rule_id.message as string}</span>}
            </div>
          </div>
          
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isPending ? 0.7 : 1 }}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {mode === "open" ? "Open" : "Rollover"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}