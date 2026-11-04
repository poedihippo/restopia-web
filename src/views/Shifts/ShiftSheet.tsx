'use client'

import React, { useState,  useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shiftsService } from '@/services/shifts.service'
import { operationsService } from '@/services/operations.service'
import { shiftRulesService } from '@/services/shift-rules.service'
import { branchesService } from '@/services/branches.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { toastMutationApiError } from '@/utils/apiError';
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  branch_id: z.coerce.number().optional(),
  operation_id: z.coerce.number().optional(),
  shift_rule_id: z.coerce.number().optional()
})
type FormValues = z.infer<typeof schema>

interface ShiftSheetProps {
  open: boolean
  onClose: () => void
  editData?: any | null
}

export default function ShiftSheet({ open, onClose, editData }: ShiftSheetProps) {

  // Each select searches on the server with its own term.
  const [branchSearch, setBranchSearch] = useState('')
  const [debouncedBranchSearch, setDebouncedBranchSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedBranchSearch(branchSearch), 400); return () => clearTimeout(t) }, [branchSearch])
  const [operationSearch, setOperationSearch] = useState('')
  const [debouncedOperationSearch, setDebouncedOperationSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedOperationSearch(operationSearch), 400); return () => clearTimeout(t) }, [operationSearch])
  const [shiftRuleSearch, setShiftRuleSearch] = useState('')
  const [debouncedShiftRuleSearch, setDebouncedShiftRuleSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedShiftRuleSearch(shiftRuleSearch), 400); return () => clearTimeout(t) }, [shiftRuleSearch])
  const qc = useQueryClient()
  const { user, isSuperadmin } = useAuth()

  const myBranchIds = (user?.branches ?? []).map((b: any) => b.id as number)

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', 'options', debouncedBranchSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedBranchSearch || undefined, per_page: 30 } as any).then((r) => r.data),
    enabled: isSuperadmin && open,
    placeholderData: (prev: any) => prev,
  })
  const allBranches = (branchesData as any)?.data ?? []
  // Keep the edited record's relations selectable even when they are not in
  // the current search page.
  const withEdited = (rows: any[], rel: any) =>
    rel?.id && !rows.some((r: any) => r.id === rel.id) ? [rel, ...rows] : rows
  const branchOptions = withEdited(isSuperadmin ? allBranches : user?.branches ?? [], editData?.branch).map((b: any) => ({
    value: b.id as number,
    label: (b.name as string) ?? '',
    sublabel: b.code as string | undefined,
  }))

  const { data: operationsData, isLoading: operationsLoading } = useQuery({
    queryKey: ['operations', 'options', debouncedOperationSearch],
    queryFn: () => operationsService.list({ 'filter[search]': debouncedOperationSearch || undefined, sort: '-id', per_page: 30 } as any).then((r) => r.data),
    enabled: open,
    placeholderData: (prev: any) => prev,
  })
  const allOperations = withEdited((operationsData as any)?.data ?? [], editData?.operation)
  const operationOptions = allOperations
    .filter((o: any) => isSuperadmin || myBranchIds.includes(o.branch_id as number))
    .map((o: any) => ({
      value: o.id as number,
      label: o.date ? `#${o.id} · ${o.date}` : `#${o.id}`,
      sublabel: o.branch?.name as string | undefined,
    }))

  const { data: shiftRulesData, isLoading: shiftRulesLoading } = useQuery({
    queryKey: ['shift-rules', 'options', debouncedShiftRuleSearch],
    queryFn: () => shiftRulesService.list({ 'filter[search]': debouncedShiftRuleSearch || undefined, per_page: 30 } as any).then((r) => r.data),
    enabled: open,
    placeholderData: (prev: any) => prev,
  })
  const allShiftRules = withEdited((shiftRulesData as any)?.data ?? [], editData?.shift_rule)
  const shiftRuleOptions = allShiftRules
    .filter((r: any) => isSuperadmin || myBranchIds.includes(r.branch_id as number))
    .map((r: any) => ({
      value: r.id as number,
      label: (r.name as string) ?? `#${r.id}`,
      sublabel: r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : undefined,
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
      operation_id: 0,
      shift_rule_id: 0,
    },
  })

  useEffect(() => {
    if (editData) {
      reset({
        branch_id: editData.branch_id ?? user?.branch?.id ?? 0,
        operation_id: editData.operation_id ?? 0,
        shift_rule_id: editData.shift_rule_id ?? 0,
      })
    } else {
      reset({
        branch_id: user?.branch?.id ?? 0,
        operation_id: 0,
        shift_rule_id: 0,
      })
    }
  }, [editData, open, reset, user])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => shiftsService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create Shift'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => shiftsService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update Shift'),
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
            {editData ? 'Edit Shift' : 'New Shift'}
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
                    onSearchChange={setBranchSearch}
/>
                )}
              />
              {errors.branch_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.branch_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Operation</label>
              <Controller
                name="operation_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={operationOptions}
                    placeholder="Select operation..."
                    searchPlaceholder="Search operation..."
                    loading={operationsLoading}
                    error={errors.operation_id?.message as string | undefined}
                    onSearchChange={setOperationSearch}
/>
                )}
              />
              {errors.operation_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.operation_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Shift Rule</label>
              <Controller
                name="shift_rule_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={shiftRuleOptions}
                    placeholder="Select shift rule..."
                    searchPlaceholder="Search shift rule..."
                    loading={shiftRulesLoading}
                    error={errors.shift_rule_id?.message as string | undefined}
                    onSearchChange={setShiftRuleSearch}
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
              {editData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
