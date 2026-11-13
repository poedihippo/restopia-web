'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Plus, Scale, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { bankReconciliationsService, type BankReconciliation } from '@/services/bank-reconciliations.service'
import { bankAccountsService, type BankAccount } from '@/services/bank-accounts.service'
import { periodsService } from '@/services/accounting.service'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import { fetchAllPages } from '@/utils/salesReport'
import { formatDate, formatDateTime } from '@/utils/date'
import { toastMutationApiError } from '@/utils/apiError'
import { bankReconciliationEditBlock } from '@/lib/actionGuards'
import NewReconciliationSheet, { type PeriodOption } from './NewReconciliationSheet'
import Workspace from './Workspace'
import { ConfirmDialog, StatusChip, cardStyle, money, num, numCell } from './shared'

const queryNumber = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function BankReconciliationView() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('bank-reconciliation.read') || hasPermission('bank-reconciliation.menu')
  const canCreate = hasPermission('bank-reconciliation.create')
  const canDelete = hasPermission('bank-reconciliation.delete')

  const openId = queryNumber(router.query.id)
  const presetBankId = queryNumber(router.query.bank_account_id)

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [bankFilter, setBankFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BankReconciliation | null>(null)

  // ?bank_account_id= (from the Bank Accounts "Reconcile" action) → New sheet,
  // preselected; without create permission it filters the list instead.
  const showSheet = canCreate && (sheetOpen || !!presetBankId)
  const bankFilterValue = bankFilter || (!canCreate && presetBankId ? String(presetBankId) : '')
  const changeFilter = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPage(1)
  }

  const setQuery = (patch: Record<string, string | undefined>) => {
    const query: Record<string, any> = { ...router.query, ...patch }
    Object.keys(query).forEach((k) => query[k] === undefined && delete query[k])
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true })
  }

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts-all', 'bank-reconciliation'],
    enabled: canRead,
    staleTime: 5 * 60_000,
    queryFn: () =>
      fetchAllPages((p) =>
        bankAccountsService.list({ page: p, per_page: 100, sort: 'bank_name' } as any).then((r) => r.data),
      ),
  })

  const { data: periods = [] } = useQuery<PeriodOption[]>({
    queryKey: ['periods-all', 'bank-reconciliation'],
    enabled: canRead,
    staleTime: 5 * 60_000,
    queryFn: () =>
      fetchAllPages((p) => periodsService.list({ page: p, per_page: 500, sort: '-start_date' } as any).then((r) => r.data)),
  })

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['bank-reconciliations', page, perPage, bankFilterValue, periodFilter, statusFilter],
    enabled: canRead && !openId,
    queryFn: () =>
      bankReconciliationsService
        .list({
          page,
          per_page: perPage,
          sort: '-id',
          include: 'bank_account,period,created_by,completed_by',
          'filter[bank_account_id]': bankFilterValue || undefined,
          'filter[period_id]': periodFilter || undefined,
          'filter[status]': statusFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  const rows: BankReconciliation[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const loading = isLoading || isFetching

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: (id: number) => bankReconciliationsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      toast.success('Reconciliation deleted')
      setDeleteTarget(null)
    },
    onError: (err) => toastMutationApiError(err, 'Failed to delete the reconciliation'),
  })

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => String(b.start_date ?? '').localeCompare(String(a.start_date ?? ''))),
    [periods],
  )

  if (!canRead) return null

  if (openId) {
    return <Workspace id={openId} onBack={() => setQuery({ id: undefined })} />
  }

  const closeSheet = () => {
    setSheetOpen(false)
    if (presetBankId) setQuery({ bank_account_id: undefined })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Bank Reconciliation
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Match each bank statement (rekening koran) against the bank account&apos;s ledger, period by period
          </p>
        </div>
        {canCreate && (
          <button type="button" className="v2-btn v2-btn-primary" onClick={() => setSheetOpen(true)}>
            <Plus size={14} /> New reconciliation
          </button>
        )}
      </div>

      <FilterBar
        quick={
          <>
            <FilterSelect value={bankFilterValue} onChange={(e) => changeFilter(setBankFilter)(e.target.value)} aria-label="Bank account">
              <option value="">All bank accounts</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} · {b.account_number}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={periodFilter} onChange={(e) => changeFilter(setPeriodFilter)(e.target.value)} aria-label="Period">
              <option value="">All periods</option>
              {sortedPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FilterSelect>
            <div role="tablist" aria-label="Status" className="v2-seg">
              {([['', 'All'], ['draft', 'Draft'], ['completed', 'Completed']] as const).map(([v, t]) => (
                <button key={t} type="button" role="tab" aria-selected={statusFilter === v} onClick={() => changeFilter(setStatusFilter)(v)}>
                  {t}
                </button>
              ))}
            </div>
          </>
        }
        activeCount={countActive(bankFilterValue, periodFilter, statusFilter)}
        onClear={() => {
          setBankFilter('')
          setPeriodFilter('')
          setStatusFilter('')
          setPage(1)
          if (presetBankId) setQuery({ bank_account_id: undefined })
        }}
      />

      <div className="v2-card" style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="v2-table">
            <thead>
              <tr>
                <th>Bank account</th>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>Statement closing</th>
                <th style={{ textAlign: 'right' }}>Difference</th>
                <th>Status</th>
                <th>Completed</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}>
                        <div className="v2-skeleton" style={{ height: 12, background: 'var(--border)' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && isError && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--destructive)' }}>
                    Could not load reconciliations.
                  </td>
                </tr>
              )}
              {!loading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 48, color: 'var(--foreground-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                      <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-light-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Scale size={22} style={{ color: 'var(--accent)' }} />
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>No reconciliations yet</div>
                      <div style={{ fontSize: 12.5, maxWidth: 420, lineHeight: 1.5 }}>
                        Pick a bank account and a month, enter the statement balances, then upload the bank statement to start matching.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => {
                  const diff = (r as any).summary?.difference ?? (r as any).difference
                  const deleteBlock = bankReconciliationEditBlock(r)
                  return (
                    <tr key={r.id} data-row>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.bank_account?.bank_name ?? `#${r.bank_account_id}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                          {r.bank_account?.account_number}
                        </div>
                      </td>
                      <td>
                        <div>{r.period?.name ?? `#${r.period_id}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                          {formatDate(r.statement_start_date)} – {formatDate(r.statement_end_date)}
                        </div>
                      </td>
                      <td style={numCell}>{money(r.statement_closing_balance)}</td>
                      <td
                        style={{
                          ...numCell,
                          fontWeight: 600,
                          color: diff == null ? 'var(--foreground-subtle)' : num(diff) === 0 ? 'var(--success)' : 'var(--destructive)',
                        }}
                      >
                        {diff == null ? '—' : money(diff)}
                      </td>
                      <td>
                        <StatusChip status={r.status} />
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.status === 'completed' ? (
                          <>
                            <div>{r.completed_by?.name ?? '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                              {r.completed_at ? formatDateTime(r.completed_at) : ''}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="v2-row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                          <button type="button" className="v2-icon-btn" title="Open" onClick={() => setQuery({ id: String(r.id) })}>
                            <Eye size={15} />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              className="v2-icon-btn"
                              data-tone="danger"
                              title={deleteBlock ?? 'Delete'}
                              disabled={!!deleteBlock}
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {deleteTarget && (
        <ConfirmDialog
          title="Delete reconciliation?"
          confirmLabel="Delete"
          danger
          pending={removing}
          onConfirm={() => remove(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        >
          The draft for {deleteTarget.bank_account?.bank_name ?? 'this bank account'} · {deleteTarget.period?.name ?? 'this period'} and
          its uploaded statement lines and matches are removed. Journals are not touched.
        </ConfirmDialog>
      )}

      {showSheet && (
        <NewReconciliationSheet
          bankAccounts={bankAccounts}
          periods={periods}
          initialBankAccountId={presetBankId ?? undefined}
          onClose={closeSheet}
          onCreated={(id) => {
            setSheetOpen(false)
            setQuery({ bank_account_id: undefined, id: String(id) })
          }}
        />
      )}
    </div>
  )
}
