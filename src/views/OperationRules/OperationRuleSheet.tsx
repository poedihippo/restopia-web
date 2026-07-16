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

const DAYS = [
  { label: 'Sen', value: 'MON' },
  { label: 'Sel', value: 'TUE' },
  { label: 'Rab', value: 'WED' },
  { label: 'Kam', value: 'THU' },
  { label: 'Jum', value: 'FRI' },
  { label: 'Sab', value: 'SAT' },
  { label: 'Min', value: 'SUN' },
]

interface CronState {
  seconds: string
  minutes: string
  hours: string
  mode: 'daily' | 'weekly' | 'monthly' | 'custom'
  weeklyDays: string[]
  monthlyDays: number[]
  customExpression: string
}

function parseCron(cronString: string): CronState {
  const parts = (cronString || '').trim().split(/\s+/)
  const defaultState: CronState = {
    seconds: '0',
    minutes: '0',
    hours: '9',
    mode: 'daily',
    weeklyDays: [],
    monthlyDays: [],
    customExpression: cronString || '',
  }

  if (parts.length !== 6) {
    return {
      ...defaultState,
      mode: 'custom',
    }
  }

  const [s, m, h, dom, mon, dow] = parts

  const isSimpleNumber = (str: string) => /^\d+$/.test(str)
  if (!isSimpleNumber(s) || !isSimpleNumber(m) || !isSimpleNumber(h)) {
    return {
      ...defaultState,
      mode: 'custom',
    }
  }

  if (mon !== '*') {
    return {
      ...defaultState,
      mode: 'custom',
    }
  }

  if (dom === '*' && (dow === '?' || dow === '*')) {
    return {
      seconds: s,
      minutes: m,
      hours: h,
      mode: 'daily',
      weeklyDays: [],
      monthlyDays: [],
      customExpression: cronString,
    }
  }

  if (dom === '?' && dow !== '*' && dow !== '?') {
    const days = dow.split(',')
    const validDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const isValid = days.every(d => validDays.includes(d.toUpperCase()))
    if (isValid) {
      return {
        seconds: s,
        minutes: m,
        hours: h,
        mode: 'weekly',
        weeklyDays: days.map(d => d.toUpperCase()),
        monthlyDays: [],
        customExpression: cronString,
      }
    }
  }

  if (dow === '?' && dom !== '*' && dom !== '?') {
    const dates = dom.split(',').map(Number)
    const isValid = dates.every(d => !isNaN(d) && d >= 1 && d <= 31)
    if (isValid) {
      return {
        seconds: s,
        minutes: m,
        hours: h,
        mode: 'monthly',
        weeklyDays: [],
        monthlyDays: dates,
        customExpression: cronString,
      }
    }
  }

  return {
    ...defaultState,
    mode: 'custom',
  }
}

function generateCron(state: CronState) {
  if (state.mode === 'custom') {
    return state.customExpression.trim()
  }
  const s = state.seconds || '0'
  const m = state.minutes || '0'
  const h = state.hours || '0'
  if (state.mode === 'daily') {
    return `${s} ${m} ${h} * * ?`
  }
  if (state.mode === 'weekly') {
    const days = state.weeklyDays.length > 0 ? state.weeklyDays.join(',') : 'MON'
    return `${s} ${m} ${h} ? * ${days}`
  }
  if (state.mode === 'monthly') {
    const dates = state.monthlyDays.length > 0 ? state.monthlyDays.join(',') : '1'
    return `${s} ${m} ${h} ${dates} * ?`
  }
  return ''
}

interface CronPickerProps {
  value: string
  onChange: (val: string) => void
}

function CronPicker({ value, onChange }: CronPickerProps) {
  const [state, setState] = React.useState(() => parseCron(value))

  React.useEffect(() => {
    const currentGenerated = generateCron(state)
    if (value !== currentGenerated) {
      setState(parseCron(value))
    }
  }, [value])

  const handleStateChange = (updater: Partial<typeof state>) => {
    const newState = { ...state, ...updater }
    setState(newState)
    onChange(generateCron(newState))
  }

  const activeTabStyle = {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const
  }

  const inactiveTabStyle = {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--surface)',
    color: 'var(--foreground-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>Cron Expression:</span>
        <code style={{ fontSize: 12, background: 'var(--background)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
          {value || '0 0 9 * * ?'}
        </code>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['daily', 'weekly', 'monthly', 'custom'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleStateChange({ mode: m })}
            style={state.mode === m ? activeTabStyle : inactiveTabStyle}
          >
            {m === 'daily' ? 'Setiap Hari' : m === 'weekly' ? 'Mingguan' : m === 'monthly' ? 'Bulanan' : 'Custom'}
          </button>
        ))}
      </div>

      {state.mode !== 'custom' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Waktu Mulai:</span>
          <input
            type="time"
            value={`${state.hours.padStart(2, '0')}:${state.minutes.padStart(2, '0')}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':')
              handleStateChange({
                hours: String(Number(h)),
                minutes: String(Number(m))
              })
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 13,
              outline: 'none'
            }}
          />
        </div>
      )}

      {state.mode === 'daily' && (
        <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: 0, lineHeight: '1.5' }}>
          Aksi akan dijalankan setiap hari pada pukul {state.hours.padStart(2, '0')}:{state.minutes.padStart(2, '0')}.
        </p>
      )}

      {state.mode === 'weekly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>Pilih Hari:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DAYS.map((d) => {
              const isSelected = state.weeklyDays.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    const nextDays = isSelected
                      ? state.weeklyDays.filter((x) => x !== d.value)
                      : [...state.weeklyDays, d.value]
                    handleStateChange({ weeklyDays: nextDays })
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    background: isSelected ? 'var(--accent)' : 'var(--background)',
                    color: isSelected ? 'white' : 'var(--foreground)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {state.mode === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>Pilih Tanggal:</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => {
              const isSelected = state.monthlyDays.includes(date)
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    const nextDates = isSelected
                      ? state.monthlyDays.filter((x) => x !== date)
                      : [...state.monthlyDays, date]
                    handleStateChange({ monthlyDays: nextDates })
                  }}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    background: isSelected ? 'var(--accent)' : 'var(--background)',
                    color: isSelected ? 'white' : 'var(--foreground)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s'
                  }}
                >
                  {date}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {state.mode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            value={state.customExpression}
            onChange={(e) => {
              handleStateChange({ customExpression: e.target.value })
            }}
            placeholder="e.g. 0 0 9 * * ?"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: '1.4' }}>
            Format Quartz 6-digit: Detik Menit Jam HariBulan Bulan HariMinggu
          </span>
        </div>
      )}
    </div>
  )
}

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
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Operation Mode</label>
              <Controller
                name="operation_mode"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['auto', 'manual'].map((mode) => (
                      <label
                        key={mode}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '10px 16px',
                          border: `1px solid ${field.value === mode ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)',
                          background: field.value === mode ? 'var(--accent-subtle)' : 'var(--surface)',
                          color: field.value === mode ? 'var(--accent)' : 'var(--foreground)',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'center'
                        }}
                      >
                        <input
                          type="radio"
                          name="operation_mode"
                          value={mode}
                          checked={field.value === mode}
                          onChange={() => field.onChange(mode)}
                          style={{ display: 'none' }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                      </label>
                    ))}
                  </div>
                )}
              />
              {errors.operation_mode && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.operation_mode.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Shift Mode</label>
              <Controller
                name="shift_mode"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['auto', 'manual'].map((mode) => (
                      <label
                        key={mode}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '10px 16px',
                          border: `1px solid ${field.value === mode ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)',
                          background: field.value === mode ? 'var(--accent-subtle)' : 'var(--surface)',
                          color: field.value === mode ? 'var(--accent)' : 'var(--foreground)',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'center'
                        }}
                      >
                        <input
                          type="radio"
                          name="shift_mode"
                          value={mode}
                          checked={field.value === mode}
                          onChange={() => field.onChange(mode)}
                          style={{ display: 'none' }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                      </label>
                    ))}
                  </div>
                )}
              />
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
                  />
                )}
              />
              {errors.auto_open_cron && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.auto_open_cron.message as string}</span>}
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
                  />
                )}
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