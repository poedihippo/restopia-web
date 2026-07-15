'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shiftsService } from '@/services/shifts.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { branchesService } from '@/services/branches.service'
import { operationsService } from '@/services/operations.service'
import { shiftRulesService } from '@/services/shift-rules.service'

const schema = z.object({
  branch_id: z.coerce.number().optional(),
  operation_id: z.coerce.number().optional(),
  shift_rule_id: z.coerce.number().optional()
})
type FormValues = z.infer<typeof schema>

interface ShiftSheetProps {
  open: boolean
  onClose: () => void
  mode: "start" | "rollover"
}

export default function ShiftSheet({ open, onClose, mode }: ShiftSheetProps) {
  const qc = useQueryClient()

  const { data: branchData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches-select'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({
    value: b.id,
    label: b.name,
  }))

  const { data: opData, isLoading: isLoadingOps } = useQuery({
    queryKey: ['operations-select'],
    queryFn: () => operationsService.list({ per_page: 100, include: 'branch' } as any).then((r) => r.data),
  })
  const operationOptions = ((opData as any)?.data ?? []).map((o: any) => ({
    value: o.id,
    label: (o.branch?.name ? `Operation on ${o.branch.name}` : `Operation #${o.id}`) + (o.date ? ` (${o.date})` : ''),
  }))

  const { data: srData, isLoading: isLoadingSr } = useQuery({
    queryKey: ['shift-rules-select'],
    queryFn: () => shiftRulesService.list({ per_page: 100, include: 'branch' } as any).then((r) => r.data),
  })
  const shiftRuleOptions = ((srData as any)?.data ?? []).map((s: any) => ({
    value: s.id,
    label: s.name ? `${s.name} ${s.branch?.name ? `(${s.branch.name})` : ''}` : `Rule #${s.id}`,
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
      operation_id: 0,
      shift_rule_id: 0,
    },
  })

  useEffect(() => {
    reset({
      branch_id: 0,
      operation_id: 0,
      shift_rule_id: 0,
    })
  }, [open, reset])

  
  const startMutation = useMutation({
    mutationFn: (data: FormValues) => shiftsService.start(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift started')
      onClose()
    },
    onError: () => toast.error('Failed to start Shift'),
  })

  const rolloverMutation = useMutation({
    mutationFn: (data: FormValues) => shiftsService.rollover(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift rolled over')
      onClose()
    },
    onError: () => toast.error('Failed to rollover Shift'),
  })

  const onSubmit = (data: FormValues) => {
    if (mode === 'start') startMutation.mutate(data)
    else rolloverMutation.mutate(data)
  }

  const isPending = startMutation.isPending || rolloverMutation.isPending


  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: '100%', maxWidth: 440, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {mode === "start" ? "Start Shift" : "Rollover Shift"}
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
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Operation ID</label>
              
              <Controller
                name="operation_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={operationOptions}
                    placeholder="Select operation..."
                    loading={isLoadingOps}
                  />
                )}
              />
  
              {errors.operation_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.operation_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Shift Rule ID</label>
              
              <Controller
                name="shift_rule_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={shiftRuleOptions}
                    placeholder="Select shift rule..."
                    loading={isLoadingSr}
                  />
                )}
              />
  
              {errors.shift_rule_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.shift_rule_id.message as string}</span>}
            </div>
          </div>
          
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: isPending ? 0.7 : 1 }}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {mode === "start" ? "Start" : "Rollover"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}