'use client'
import React, { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, Loader2, Plus, Store } from 'lucide-react'
import { operationRulesService } from '@/services/operation-rules.service'
import { shiftRulesService } from '@/services/shift-rules.service'
import { useAuth } from '@/hooks/useAuth'
import CronPicker from '@/components/CronPicker'
import { toastMutationApiError } from '@/utils/apiError'
import { formatDateTime } from '@/utils/date'

// A branch has at most ONE operation rule, always written for the ACTIVE
// branch (operation-rules/.../create_usecase.go), so this page is a single
// settings card instead of a list: empty state → create, otherwise edit in place.
// There is no delete: the API has no DELETE route for operation rules.

const MODES = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto', label: 'Automatic' },
] as const

const schema = z
  .object({
    open_mode: z.enum(['auto', 'manual']),
    close_mode: z.enum(['auto', 'manual']),
    shift_mode: z.enum(['auto', 'manual']),
    auto_open_cron: z.string().optional(),
    auto_close_cron: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    // The scheduler opens/closes on these crons, so an automatic mode needs one.
    if (v.open_mode === 'auto' && !v.auto_open_cron?.trim())
      ctx.addIssue({ code: 'custom', path: ['auto_open_cron'], message: 'Set when the branch opens' })
    if (v.close_mode === 'auto' && !v.auto_close_cron?.trim())
      ctx.addIssue({ code: 'custom', path: ['auto_close_cron'], message: 'Set when the branch closes' })
  })
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  open_mode: 'manual',
  close_mode: 'manual',
  shift_mode: 'manual',
  auto_open_cron: '',
  auto_close_cron: '',
}

const toForm = (rule: any): FormValues => ({
  open_mode: rule?.open_mode === 'auto' ? 'auto' : 'manual',
  close_mode: rule?.close_mode === 'auto' ? 'auto' : 'manual',
  shift_mode: rule?.shift_mode === 'auto' ? 'auto' : 'manual',
  auto_open_cron: rule?.auto_open_cron ?? '',
  auto_close_cron: rule?.auto_close_cron ?? '',
})

export default function OperationRulesView() {
  const qc = useQueryClient()
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('operation-rule.create')
  const canEdit = hasPermission('operation-rule.update')

  const branch = user?.branch
  const branchId = branch?.id

  const { data, isLoading, isError } = useQuery({
    queryKey: ['operationrules', 'active-branch', branchId],
    queryFn: () =>
      operationRulesService.list({ page: 1, per_page: 1, 'filter[branch_id]': branchId } as any).then((r) => r.data),
    enabled: !!branchId,
  })
  const rule = ((data as any)?.data ?? [])[0] ?? null

  // Starting a shift needs a shift rule covering the current time, whatever the
  // shift mode (shifts/.../start_usecase.go: "no active shift rule found").
  const { data: shiftRulesData, isLoading: shiftRulesLoading } = useQuery({
    queryKey: ['shift-rules', 'active-branch-count', branchId],
    queryFn: () =>
      shiftRulesService.list({ page: 1, per_page: 1, 'filter[branch_id]': branchId } as any).then((r) => r.data),
    enabled: !!branchId,
  })
  const shiftRuleCount = Number((shiftRulesData as any)?.meta?.total ?? ((shiftRulesData as any)?.data ?? []).length)
  const missingShiftRules = !!branchId && !shiftRulesLoading && !!shiftRulesData && shiftRuleCount === 0

  // With no rule yet the form stays hidden behind the empty state until asked for.
  const [creating, setCreating] = useState(false)
  const showForm = !!rule || creating
  const readOnly = rule ? !canEdit : !canCreate

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: EMPTY,
  })

  useEffect(() => {
    reset(rule ? toForm(rule) : EMPTY)
  }, [rule, reset])

  const openMode = watch('open_mode')
  const closeMode = watch('close_mode')

  const onSaved = (msg: string) => {
    qc.invalidateQueries({ queryKey: ['operationrules'] })
    toast.success(msg)
    setCreating(false)
  }

  const saveMutation = useMutation({
    mutationFn: (v: FormValues) => {
      // A manual mode ignores its cron; send '' so a stale schedule is cleared.
      const payload = {
        open_mode: v.open_mode,
        close_mode: v.close_mode,
        shift_mode: v.shift_mode,
        auto_open_cron: v.open_mode === 'auto' ? v.auto_open_cron : '',
        auto_close_cron: v.close_mode === 'auto' ? v.auto_close_cron : '',
      }
      return rule ? operationRulesService.update(rule.id, payload as any) : operationRulesService.create(payload as any)
    },
    onSuccess: () => onSaved(rule ? 'Operation rule updated' : 'Operation rule created'),
    onError: (err: any) => toastMutationApiError(err, 'Failed to save operation rule'),
  })

  const isPending = saveMutation.isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
          Operation Rule
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
          How the active branch opens, closes and runs its shifts
        </p>
      </div>

      {missingShiftRules && (
        <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>This branch has no shift rules yet</div>
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', marginTop: 2 }}>
              Shifts can’t start without at least one shift rule — in both manual and automatic shift mode.
            </div>
          </div>
          <Link href="/settings/shift-rules" className="v2-btn v2-btn-ghost" style={{ flexShrink: 0 }}>
            Add shift rule
          </Link>
        </div>
      )}

      <div className="v2-card" style={{ overflow: 'hidden' }}>
        {/* Branch strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-light-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Store size={15} style={{ color: 'var(--accent)' }} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--foreground)' }}>
              {branch?.name ?? 'No active branch'}
              {branch?.code && <span style={{ color: 'var(--foreground-subtle)', fontWeight: 400 }}> · {branch.code}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Each branch has one rule. Switch the active branch to manage another.
            </div>
          </div>
          {rule && (
            <span style={{ fontSize: 11.5, color: 'var(--foreground-subtle)', whiteSpace: 'nowrap' }}>
              Updated {formatDateTime(rule.updated_at ?? rule.created_at)}
            </span>
          )}
        </div>

        {!branchId ? (
          <EmptyState title="No active branch" text="Pick a branch from the top bar to see its operation rule." />
        ) : isLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div className="v2-skeleton" style={{ height: 12, width: '35%' }} />
                <div className="v2-skeleton" style={{ height: 24, width: 150 }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState title="Couldn’t load the operation rule" text="Refresh the page to try again." tone="error" />
        ) : !showForm ? (
          <EmptyState
            title="No operation rule yet"
            text="Without a rule this branch can’t open an operation or start shifts."
            action={
              canCreate && (
                <button type="button" className="v2-btn v2-btn-primary" onClick={() => { reset(EMPTY); setCreating(true) }}>
                  <Plus size={14} /> Create rule
                </button>
              )
            }
          />
        ) : (
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
            <ModeRow
              title="Opening"
              hint="Manual: staff open the day. Automatic: opens on a schedule."
              name="open_mode"
              control={control}
              disabled={readOnly || isPending}
            />
            {openMode === 'auto' && (
              <CronRow name="auto_open_cron" label="Opens at" control={control} disabled={readOnly || isPending} error={errors.auto_open_cron?.message} />
            )}
            <ModeRow
              title="Closing"
              hint="Manual: staff close the day. Automatic: closes on a schedule."
              name="close_mode"
              control={control}
              disabled={readOnly || isPending}
            />
            {closeMode === 'auto' && (
              <CronRow name="auto_close_cron" label="Closes at" control={control} disabled={readOnly || isPending} error={errors.auto_close_cron?.message} />
            )}
            <ModeRow
              title="Shifts"
              hint="Manual: staff start and close shifts. Automatic: shifts follow the shift rules."
              name="shift_mode"
              control={control}
              disabled={readOnly || isPending}
              last
            />

            {!readOnly && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
                <div style={{ flex: 1 }} />
                {rule ? (
                  <button type="button" className="v2-btn v2-btn-ghost" disabled={!isDirty || isPending} onClick={() => reset(toForm(rule))}>
                    Discard
                  </button>
                ) : (
                  <button type="button" className="v2-btn v2-btn-ghost" disabled={isPending} onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="v2-btn v2-btn-primary" disabled={isPending || (!!rule && !isDirty)}>
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  {rule ? 'Save changes' : 'Create rule'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

    </div>
  )
}

function ModeRow({
  title,
  hint,
  name,
  control,
  disabled,
  last,
}: {
  title: string
  hint: string
  name: 'open_mode' | 'close_mode' | 'shift_mode'
  control: any
  disabled: boolean
  last?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: last ? 'none' : '1px solid var(--border)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--foreground)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>{hint}</div>
      </div>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="v2-seg" role="tablist" aria-label={title} style={disabled ? { opacity: 0.6 } : undefined}>
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={field.value === m.value}
                disabled={disabled}
                onClick={() => field.onChange(m.value)}
                style={disabled ? { cursor: 'not-allowed' } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      />
    </div>
  )
}

function CronRow({
  name,
  label,
  control,
  disabled,
  error,
}: {
  name: 'auto_open_cron' | 'auto_close_cron'
  label: string
  control: any
  disabled: boolean
  error?: string
}) {
  return (
    <div style={{ padding: '0 20px 18px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CalendarClock size={14} style={{ color: 'var(--foreground-muted)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--foreground)' }}>{label}</span>
        </div>
        <div style={{ maxWidth: 440 }}>
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <CronPicker value={field.value ?? ''} onChange={field.onChange} disabled={disabled} error={error} />
            )}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  title,
  text,
  action,
  tone,
}: {
  title: string
  text: string
  action?: React.ReactNode
  tone?: 'error'
}) {
  return (
    <div style={{ padding: '44px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: tone === 'error' ? 'var(--destructive-bg)' : 'var(--surface-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <CalendarClock size={18} style={{ color: tone === 'error' ? 'var(--destructive)' : 'var(--foreground-muted)' }} />
      </span>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', maxWidth: 360 }}>{text}</div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  )
}
