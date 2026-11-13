'use client'

import React, { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import SearchableSelect from '@/components/SearchableSelect'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { bankReconciliationsService } from '@/services/bank-reconciliations.service'
import type { BankAccount } from '@/services/bank-accounts.service'
import { toastMutationApiError } from '@/utils/apiError'
import { formatDate } from '@/utils/date'
import { Sheet, labelStyle } from './shared'

export interface PeriodOption {
  id: number
  name: string
  start_date?: string
  end_date?: string
  is_closed?: boolean
}

export default function NewReconciliationSheet({
  bankAccounts,
  periods,
  initialBankAccountId,
  onClose,
  onCreated,
}: {
  bankAccounts: BankAccount[]
  periods: PeriodOption[]
  initialBankAccountId?: number
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const qc = useQueryClient()
  const [bankAccountId, setBankAccountId] = useState<number>(initialBankAccountId ?? 0)
  const [periodId, setPeriodId] = useState<number>(0)
  const [opening, setOpening] = useState<number>(0)
  const [closing, setClosing] = useState<number>(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Active accounts that are linked to a chart of account — the ledger side needs it.
  const eligibleBanks = useMemo(
    () => bankAccounts.filter((b) => b.is_active && b.chart_of_account_id),
    [bankAccounts],
  )
  const openPeriods = useMemo(
    () => periods.filter((p) => !p.is_closed).sort((a, b) => String(b.start_date ?? '').localeCompare(String(a.start_date ?? ''))),
    [periods],
  )
  const period = openPeriods.find((p) => p.id === periodId)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      bankReconciliationsService.create({
        bank_account_id: bankAccountId,
        period_id: periodId,
        statement_opening_balance: opening || 0,
        statement_closing_balance: closing || 0,
      } as any),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      toast.success('Reconciliation draft created')
      const id = Number((res.data as any)?.data?.id ?? (res.data as any)?.id)
      if (id) onCreated(id)
      else onClose()
    },
    onError: (err: any) => {
      const fe = err?.response?.data?.errors
      if (fe && typeof fe === 'object') {
        const mapped: Record<string, string> = {}
        Object.entries(fe).forEach(([k, v]) => {
          mapped[k] = String(Array.isArray(v) ? v[0] : v)
        })
        setErrors(mapped)
      }
      toastMutationApiError(err, 'Failed to create the reconciliation')
    },
  })

  const submit = () => {
    const next: Record<string, string> = {}
    if (!bankAccountId) next.bank_account_id = 'Pick a bank account'
    if (!periodId) next.period_id = 'Pick a period'
    setErrors(next)
    if (Object.keys(next).length) return
    mutate()
  }

  const errorText = (k: string) =>
    errors[k] ? <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{errors[k]}</span> : null

  return (
    <Sheet
      title="New reconciliation"
      subtitle="Match one bank statement period against the books"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="v2-btn v2-btn-primary" disabled={isPending} onClick={submit}>
            {isPending ? 'Creating…' : 'Create draft'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>Bank account *</span>
        <SearchableSelect
          value={bankAccountId}
          onChange={(v) => setBankAccountId(Number(v) || 0)}
          options={eligibleBanks.map((b) => ({
            value: Number(b.id),
            label: `${b.bank_name} · ${b.account_number}`,
            sublabel: b.account_name,
          }))}
          placeholder="-- Select bank account --"
          searchPlaceholder="Search bank / account number…"
          error={errors.bank_account_id}
        />
        {errorText('bank_account_id')}
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
          Only active accounts linked to a chart of account are listed.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>Period *</span>
        <SearchableSelect
          value={periodId}
          onChange={(v) => setPeriodId(Number(v) || 0)}
          options={openPeriods.map((p) => ({
            value: Number(p.id),
            label: p.name,
            sublabel: p.start_date && p.end_date ? `${formatDate(p.start_date)} – ${formatDate(p.end_date)}` : undefined,
          }))}
          placeholder="-- Select open period --"
          searchPlaceholder="Search period…"
          error={errors.period_id}
        />
        {errorText('period_id')}
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
          {period?.start_date && period?.end_date
            ? `Statement dates: ${formatDate(period.start_date)} – ${formatDate(period.end_date)}`
            : 'The statement covers the whole period. Closed periods are not listed.'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>Statement opening balance (saldo awal)</span>
        <LocalizedNumberInput value={opening} onChange={(v) => setOpening(v || 0)} error={!!errors.statement_opening_balance} />
        {errorText('statement_opening_balance')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>Statement closing balance (saldo akhir)</span>
        <LocalizedNumberInput value={closing} onChange={(v) => setClosing(v || 0)} error={!!errors.statement_closing_balance} />
        {errorText('statement_closing_balance')}
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
          Copy both balances from the bank statement (rekening koran) of this period.
        </span>
      </div>
    </Sheet>
  )
}
