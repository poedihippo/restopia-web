'use client'

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import SearchableSelect from '@/components/SearchableSelect'
import { chartOfAccountsService } from '@/services/accounting.service'
import { bankReconciliationsService, type BankStatementLine } from '@/services/bank-reconciliations.service'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/utils/date'
import { toastMutationApiError } from '@/utils/apiError'
import { Sheet, inputStyle, labelStyle, money, num } from './shared'

/**
 * Books a bank-only statement line (admin fee, interest, tax on interest) as a
 * Cash Transaction against the chosen account; the API matches it right away.
 */
export default function BookLineSheet({
  reconciliationId,
  line,
  onClose,
}: {
  reconciliationId: number
  line: BankStatementLine
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isIn = num(line.amount_in) > 0
  const amount = isIn ? num(line.amount_in) : num(line.amount_out)
  const [accountId, setAccountId] = useState(0)
  const [description, setDescription] = useState(line.description ?? '')
  const [error, setError] = useState('')

  const [accountSearch, setAccountSearch] = useState('')
  const debouncedAccountSearch = useDebounce(accountSearch, 400)
  const accountOpts = useInfiniteOptions<any>({
    queryKey: ['chart-of-accounts-all', 'postable-active', debouncedAccountSearch],
    staleTime: 5 * 60_000,
    fetchPage: (page) =>
      chartOfAccountsService
        .list({ page, per_page: 20, sort: 'code,id', 'filter[is_header]': false, 'filter[is_active]': true, 'filter[search]': debouncedAccountSearch || undefined } as any)
        .then((r) => r.data),
  })
  const accounts = accountOpts.items

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      bankReconciliationsService.bookLine(reconciliationId, line.id, {
        chart_of_account_id: accountId,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliation', reconciliationId] })
      qc.invalidateQueries({ queryKey: ['bank-reconciliation-ledger', reconciliationId] })
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      qc.invalidateQueries({ queryKey: ['cash-transactions'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success(`Booked as ${isIn ? 'cash in' : 'cash out'} and matched`)
      onClose()
    },
    onError: (err) => toastMutationApiError(err, 'Failed to book the line'),
  })

  return (
    <Sheet
      title="Book statement line"
      subtitle="Creates a cash transaction for a bank-only line and matches it"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="v2-btn v2-btn-primary"
            disabled={isPending}
            onClick={() => {
              if (!accountId) {
                setError('Pick the account to book against')
                return
              }
              mutate()
            }}
          >
            {isPending ? 'Booking…' : 'Book & match'}
          </button>
        </>
      }
    >
      <div
        style={{
          background: 'var(--surface-muted, var(--background))', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 13, display: 'grid',
          gridTemplateColumns: 'auto 1fr', gap: '6px 14px',
        }}
      >
        <span style={{ color: 'var(--foreground-muted)' }}>Date</span>
        <span>{formatDate(line.date)}</span>
        <span style={{ color: 'var(--foreground-muted)' }}>Description</span>
        <span>{line.description || '—'}</span>
        {line.reference && (
          <>
            <span style={{ color: 'var(--foreground-muted)' }}>Reference</span>
            <span>{line.reference}</span>
          </>
        )}
        <span style={{ color: 'var(--foreground-muted)' }}>Amount</span>
        <span style={{ fontWeight: 600, color: isIn ? 'var(--success)' : 'var(--destructive)' }}>
          {isIn ? '+' : '−'} {money(amount)} <span style={{ fontWeight: 400, color: 'var(--foreground-muted)' }}>({isIn ? 'cash in' : 'cash out'})</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>{isIn ? 'Income account (e.g. interest income) *' : 'Expense account (e.g. bank charges) *'}</span>
        <SearchableSelect
          value={accountId}
          onChange={(v) => {
            setAccountId(Number(v) || 0)
            setError('')
          }}
          options={accounts.map((a) => ({ value: Number(a.id), label: a.name, sublabel: a.code }))}
          loading={accountOpts.loading}
          onSearchChange={setAccountSearch}
          {...accountOpts.selectProps}
          placeholder="-- Select account --"
          searchPlaceholder="Cari kode / nama akun..."
          error={error || undefined}
        />
        {error && <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{error}</span>}
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
          The other side is this reconciliation&apos;s bank account, dated {formatDate(line.date)}.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} maxLength={255} />
      </div>
    </Sheet>
  )
}
