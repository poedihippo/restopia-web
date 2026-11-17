'use client'

import HeaderCheckbox from '@/components/HeaderCheckbox'
import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, BookPlus, CheckCircle2, Download, Link2, Lock, RotateCcw, Trash2, Unlink, Wand2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  bankReconciliationsService,
  type BankLedgerLine,
  type BankReconciliation,
  type BankStatementLine,
  type MatchGroupId,
} from '@/services/bank-reconciliations.service'
import ReferenceLink from '@/components/ReferenceLink'
import { bankReconciliationEditBlock } from '@/lib/actionGuards'
import { toastMutationApiError } from '@/utils/apiError'
import { formatDate, formatDateTime } from '@/utils/date'
import { downloadFileFromResponse } from '@/utils/file'
import StatementUpload from './StatementUpload'
import BookLineSheet from './BookLineSheet'
import { ConfirmDialog, GroupChip, StatusChip, cardStyle, money, num, numCell, round2 } from './shared'

type View = 'unmatched' | 'matched' | 'all'

const paneStyle: React.CSSProperties = { ...cardStyle, flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
const paneHead: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
}
const scrollBox: React.CSSProperties = { overflow: 'auto', maxHeight: '62vh' }
const checkCell: React.CSSProperties = { width: 32, paddingRight: 0 }
const isMatched = (g: MatchGroupId | null | undefined) => g !== null && g !== undefined && g !== ''

export default function Workspace({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canUpdate = hasPermission('bank-reconciliation.update')
  const canDelete = hasPermission('bank-reconciliation.delete')
  const canComplete = hasPermission('bank-reconciliation.complete')

  const [view, setView] = useState<View>('unmatched')
  const [selStatement, setSelStatement] = useState<Map<number, BankStatementLine>>(new Map())
  const [selLedger, setSelLedger] = useState<Map<number, BankLedgerLine>>(new Map())
  const [hoverGroup, setHoverGroup] = useState<MatchGroupId | null>(null)
  const [bookLine, setBookLine] = useState<BankStatementLine | null>(null)
  const [confirm, setConfirm] = useState<'complete' | 'reopen' | 'delete' | null>(null)

  const { data: rec, isLoading, isError } = useQuery<BankReconciliation>({
    queryKey: ['bank-reconciliation', id],
    queryFn: () =>
      bankReconciliationsService
        .findById(id, { include: 'bank_account,period,created_by,completed_by' })
        .then((r) => ((r.data as any)?.data ?? r.data) as BankReconciliation),
  })

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery<BankLedgerLine[]>({
    queryKey: ['bank-reconciliation-ledger', id],
    enabled: !!rec,
    queryFn: () =>
      bankReconciliationsService.ledgerLines(id, 'all').then((r) => {
        const body: any = r.data
        return Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.data) ? body.data.data : []
      }),
  })

  const editBlock = bankReconciliationEditBlock(rec)
  const canEdit = canUpdate && !editBlock
  const summary = rec?.summary
  const statementLines = useMemo(
    () => [...(rec?.statement_lines ?? [])].sort((a, b) => a.line_no - b.line_no),
    [rec?.statement_lines],
  )

  const filterView = <T extends { match_group_id: MatchGroupId | null }>(rows: T[]) =>
    view === 'all' ? rows : rows.filter((r) => (view === 'matched' ? isMatched(r.match_group_id) : !isMatched(r.match_group_id)))
  const shownStatement = filterView(statementLines)
  const shownLedger = filterView(ledger)

  const stmtTotal = round2(Array.from(selStatement.values()).reduce((s, l) => s + num(l.amount_in) - num(l.amount_out), 0))
  const ledgerTotal = round2(Array.from(selLedger.values()).reduce((s, l) => s + num(l.debit) - num(l.credit), 0))
  const selDiff = round2(stmtTotal - ledgerTotal)
  const canMatch = canEdit && selStatement.size > 0 && selLedger.size > 0 && selDiff === 0

  const clearSelection = () => {
    setSelStatement(new Map())
    setSelLedger(new Map())
  }

  const toggleStatement = (l: BankStatementLine) => {
    if (!canEdit || isMatched(l.match_group_id)) return
    setSelStatement((prev) => {
      const next = new Map(prev)
      if (next.has(l.id)) next.delete(l.id)
      else next.set(l.id, l)
      return next
    })
  }
  const toggleLedger = (l: BankLedgerLine) => {
    if (!canEdit || isMatched(l.match_group_id)) return
    setSelLedger((prev) => {
      const next = new Map(prev)
      if (next.has(l.journal_detail_id)) next.delete(l.journal_detail_id)
      else next.set(l.journal_detail_id, l)
      return next
    })
  }

  // Check-all acts on the shown, still-unmatched lines only (matched ones can't be selected).
  const selectableStatement = canEdit ? shownStatement.filter((l) => !isMatched(l.match_group_id)) : []
  const selectableLedger = canEdit ? shownLedger.filter((l) => !isMatched(l.match_group_id)) : []
  const toggleAllStatement = (checkAll: boolean) =>
    setSelStatement((prev) => {
      const next = new Map(prev)
      for (const l of selectableStatement) checkAll ? next.set(l.id, l) : next.delete(l.id)
      return next
    })
  const toggleAllLedger = (checkAll: boolean) =>
    setSelLedger((prev) => {
      const next = new Map(prev)
      for (const l of selectableLedger) checkAll ? next.set(l.journal_detail_id, l) : next.delete(l.journal_detail_id)
      return next
    })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bank-reconciliation', id] })
    qc.invalidateQueries({ queryKey: ['bank-reconciliation-ledger', id] })
    qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
  }

  const autoMatch = useMutation({
    mutationFn: () => bankReconciliationsService.autoMatch(id),
    onSuccess: (res) => {
      invalidate()
      clearSelection()
      const n = Number((res.data as any)?.data?.matched ?? (res.data as any)?.matched ?? 0)
      toast.success(n ? `${n} line(s) auto-matched` : 'No unique matches found — match the rest manually')
    },
    onError: (err) => toastMutationApiError(err, 'Auto-match failed'),
  })

  const match = useMutation({
    mutationFn: () =>
      bankReconciliationsService.match(id, {
        statement_line_ids: Array.from(selStatement.keys()),
        journal_detail_ids: Array.from(selLedger.keys()),
      }),
    onSuccess: () => {
      invalidate()
      toast.success(`Matched ${selStatement.size} statement line(s) with ${selLedger.size} ledger line(s)`)
      clearSelection()
    },
    onError: (err) => toastMutationApiError(err, 'Failed to match'),
  })

  const unmatch = useMutation({
    mutationFn: (groupId: MatchGroupId) => bankReconciliationsService.unmatch(id, groupId),
    onSuccess: () => {
      invalidate()
      clearSelection()
      toast.success('Unmatched')
    },
    onError: (err) => toastMutationApiError(err, 'Failed to unmatch'),
  })

  const complete = useMutation({
    mutationFn: () => bankReconciliationsService.complete(id),
    onSuccess: () => {
      invalidate()
      setConfirm(null)
      clearSelection()
      toast.success('Reconciliation completed and locked')
    },
    onError: (err) => toastMutationApiError(err, 'Failed to complete'),
  })

  const reopen = useMutation({
    mutationFn: () => bankReconciliationsService.reopen(id),
    onSuccess: () => {
      invalidate()
      setConfirm(null)
      toast.success('Reconciliation reopened')
    },
    onError: (err) => toastMutationApiError(err, 'Failed to reopen'),
  })

  const remove = useMutation({
    mutationFn: () => bankReconciliationsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      qc.removeQueries({ queryKey: ['bank-reconciliation', id] })
      toast.success('Reconciliation deleted')
      setConfirm(null)
      onBack()
    },
    onError: (err) => toastMutationApiError(err, 'Failed to delete'),
  })

  const exportXlsx = useMutation({
    mutationFn: () => bankReconciliationsService.exportExcel(id),
    onSuccess: (res) => {
      const bank = rec?.bank_account?.bank_name ?? 'bank'
      downloadFileFromResponse(res as any, `bank-reconciliation_${bank}_${rec?.period?.name ?? id}.xlsx`)
    },
    onError: (err) => toastMutationApiError(err, 'Export failed'),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[60, 80, 320].map((h, i) => (
          <div key={i} className="v2-skeleton" style={{ height: h, background: 'var(--border)', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    )
  }
  if (isError || !rec) {
    return (
      <div style={{ ...cardStyle, padding: 32, textAlign: 'center', color: 'var(--foreground-muted)' }}>
        Reconciliation not found.{' '}
        <button type="button" className="v2-btn v2-btn-ghost" onClick={onBack}>Back to list</button>
      </div>
    )
  }

  const isCompleted = rec.status === 'completed'
  const reopenBlock = rec.period?.is_closed ? 'Period closed' : null
  const completeBlock = editBlock ?? (summary && !summary.can_complete ? completeReason(summary) : null)
  const diff = num(summary?.difference)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <button type="button" className="v2-icon-btn" onClick={onBack} title="Back to list" style={{ marginTop: 2 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                {rec.bank_account?.bank_name ?? 'Bank'} · {rec.bank_account?.account_number ?? `#${rec.bank_account_id}`}
              </h1>
              <StatusChip status={rec.status} />
              {rec.period?.is_closed && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-muted)' }}>
                  <Lock size={12} /> Period closed
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {rec.period?.name ?? `Period #${rec.period_id}`} · {formatDate(rec.statement_start_date)} – {formatDate(rec.statement_end_date)}
              {rec.bank_account?.account_name ? ` · ${rec.bank_account.account_name}` : ''}
              {isCompleted && rec.completed_at
                ? ` · completed ${formatDateTime(rec.completed_at)}${rec.completed_by?.name ? ` by ${rec.completed_by.name}` : ''}`
                : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="v2-btn v2-btn-ghost" disabled={exportXlsx.isPending} onClick={() => exportXlsx.mutate()}>
            <Download size={14} /> {exportXlsx.isPending ? 'Exporting…' : 'Export'}
          </button>
          {canDelete && !isCompleted && (
            <button
              type="button"
              className="v2-btn v2-btn-ghost"
              style={{ color: 'var(--destructive)' }}
              disabled={!!editBlock || remove.isPending}
              title={editBlock ?? undefined}
              onClick={() => setConfirm('delete')}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          {canComplete && isCompleted && (
            <button
              type="button"
              className="v2-btn v2-btn-ghost"
              disabled={!!reopenBlock || reopen.isPending}
              title={reopenBlock ?? undefined}
              onClick={() => setConfirm('reopen')}
            >
              <RotateCcw size={14} /> Reopen
            </button>
          )}
          {canComplete && !isCompleted && (
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              disabled={!!completeBlock || complete.isPending}
              title={completeBlock ?? undefined}
              onClick={() => setConfirm('complete')}
            >
              <CheckCircle2 size={14} /> Complete
            </button>
          )}
        </div>
      </div>

      <StatementUpload rec={rec} editBlock={editBlock} canUpdate={canUpdate} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Matching area */}
        <div style={{ flex: '1 1 760px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div role="tablist" aria-label="Show" className="v2-seg">
              {(['unmatched', 'matched', 'all'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
                  {v === 'unmatched' ? 'Unmatched' : v === 'matched' ? 'Matched' : 'All'}
                </button>
              ))}
            </div>
            {canUpdate && (
              <button
                type="button"
                className="v2-btn v2-btn-ghost"
                disabled={!!editBlock || autoMatch.isPending}
                title={editBlock ?? 'Pair lines with the same amount and direction, dated within ±3 days'}
                onClick={() => autoMatch.mutate()}
              >
                <Wand2 size={14} /> {autoMatch.isPending ? 'Matching…' : 'Auto-match'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {/* Statement lines */}
            <div className="v2-card" style={paneStyle}>
              <div style={paneHead}>
                <span>Bank statement</span>
                <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--foreground-muted)' }}>{shownStatement.length} line(s)</span>
              </div>
              <div style={scrollBox}>
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th style={checkCell}>
                        <HeaderCheckbox
                          total={selectableStatement.length}
                          checkedCount={selectableStatement.filter((l) => selStatement.has(l.id)).length}
                          onToggleAll={toggleAllStatement}
                          title="Check all unmatched statement lines"
                        />
                      </th>
                      <th>Date</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>In</th>
                      <th style={{ textAlign: 'right' }}>Out</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {shownStatement.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--foreground-muted)' }}>
                          {statementLines.length === 0 ? 'Upload the bank statement to start.' : 'Nothing here.'}
                        </td>
                      </tr>
                    )}
                    {shownStatement.map((l) => {
                      const matched = isMatched(l.match_group_id)
                      const checked = selStatement.has(l.id)
                      const hl = matched && hoverGroup != null && String(hoverGroup) === String(l.match_group_id)
                      return (
                        <tr
                          key={l.id}
                          data-row
                          onClick={() => toggleStatement(l)}
                          style={{
                            cursor: canEdit && !matched ? 'pointer' : 'default',
                            background: checked ? 'var(--accent-light-bg)' : hl ? 'var(--info-bg)' : undefined,
                          }}
                        >
                          <td style={checkCell}>
                            {!matched && canEdit && (
                              <input type="checkbox" checked={checked} onChange={() => toggleStatement(l)} onClick={(e) => e.stopPropagation()} />
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(l.date)}</td>
                          <td style={{ minWidth: 160 }}>
                            <div style={{ lineHeight: 1.35, padding: '4px 0' }}>
                              {l.description}
                              {l.reference && <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{l.reference}</div>}
                            </div>
                          </td>
                          <td style={{ ...numCell, color: 'var(--success)' }}>{num(l.amount_in) ? money(l.amount_in) : ''}</td>
                          <td style={{ ...numCell, color: 'var(--destructive)' }}>{num(l.amount_out) ? money(l.amount_out) : ''}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                              {matched ? (
                                <>
                                  <GroupChip id={l.match_group_id!} active={hl} onHover={setHoverGroup} />
                                  {canUpdate && (
                                    <button
                                      type="button"
                                      className="v2-icon-btn"
                                      title={editBlock ?? 'Unmatch'}
                                      disabled={!!editBlock || unmatch.isPending}
                                      onClick={() => unmatch.mutate(l.match_group_id!)}
                                    >
                                      <Unlink size={14} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                canUpdate && (
                                  <button
                                    type="button"
                                    className="v2-icon-btn"
                                    title={editBlock ?? 'Book (fee, interest…) as a cash transaction'}
                                    disabled={!!editBlock}
                                    onClick={() => setBookLine(l)}
                                  >
                                    <BookPlus size={14} />
                                  </button>
                                )
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

            {/* Ledger lines */}
            <div className="v2-card" style={paneStyle}>
              <div style={paneHead}>
                <span>Ledger (buku besar)</span>
                <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--foreground-muted)' }}>
                  {ledgerLoading ? 'Loading…' : `${shownLedger.length} line(s)`}
                </span>
              </div>
              <div style={scrollBox}>
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th style={checkCell}>
                        <HeaderCheckbox
                          total={selectableLedger.length}
                          checkedCount={selectableLedger.filter((l) => selLedger.has(l.journal_detail_id)).length}
                          onToggleAll={toggleAllLedger}
                          title="Check all unmatched ledger lines"
                        />
                      </th>
                      <th>Date</th>
                      <th>Journal / source</th>
                      <th style={{ textAlign: 'right' }}>Debit (in)</th>
                      <th style={{ textAlign: 'right' }}>Credit (out)</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLoading &&
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <td key={j}>
                              <div className="v2-skeleton" style={{ height: 12, background: 'var(--border)' }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    {!ledgerLoading && shownLedger.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--foreground-muted)' }}>
                          {ledger.length === 0 ? 'No posted journal lines on this bank account in the period.' : 'Nothing here.'}
                        </td>
                      </tr>
                    )}
                    {!ledgerLoading &&
                      shownLedger.map((l) => {
                        const matched = isMatched(l.match_group_id)
                        const checked = selLedger.has(l.journal_detail_id)
                        const hl = matched && hoverGroup != null && String(hoverGroup) === String(l.match_group_id)
                        const desc = l.line_description || l.description
                        return (
                          <tr
                            key={l.journal_detail_id}
                            data-row
                            onClick={() => toggleLedger(l)}
                            style={{
                              cursor: canEdit && !matched ? 'pointer' : 'default',
                              background: checked ? 'var(--accent-light-bg)' : hl ? 'var(--info-bg)' : undefined,
                            }}
                          >
                            <td style={checkCell}>
                              {!matched && canEdit && (
                                <input type="checkbox" checked={checked} onChange={() => toggleLedger(l)} onClick={(e) => e.stopPropagation()} />
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(l.date)}</td>
                            <td style={{ minWidth: 170 }}>
                              <div style={{ lineHeight: 1.35, padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <ReferenceLink type="journals" id={l.journal_id} newTab style={{ fontSize: 12 }}>
                                    {l.journal_number}
                                  </ReferenceLink>
                                  {l.reference_type && l.reference_id ? (
                                    <ReferenceLink type={l.reference_type} id={l.reference_id} newTab style={{ fontSize: 11.5 }} />
                                  ) : null}
                                </span>
                                {desc && <span style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{desc}</span>}
                              </div>
                            </td>
                            <td style={{ ...numCell, color: 'var(--success)' }}>{num(l.debit) ? money(l.debit) : ''}</td>
                            <td style={{ ...numCell, color: 'var(--destructive)' }}>{num(l.credit) ? money(l.credit) : ''}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {matched && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                                  <GroupChip id={l.match_group_id!} active={hl} onHover={setHoverGroup} />
                                  {canUpdate && (
                                    <button
                                      type="button"
                                      className="v2-icon-btn"
                                      title={editBlock ?? 'Unmatch'}
                                      disabled={!!editBlock || unmatch.isPending}
                                      onClick={() => unmatch.mutate(l.match_group_id!)}
                                    >
                                      <Unlink size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky side: selection + summary */}
        <div style={{ flex: '0 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 16 }}>
          {canEdit && (
            <div className="v2-card" style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Selection</div>
              <Row label={`Statement (${selStatement.size})`} value={money(stmtTotal)} />
              <Row label={`Ledger (${selLedger.size})`} value={money(ledgerTotal)} />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <Row
                  label="Difference"
                  value={money(selDiff)}
                  color={selDiff === 0 ? 'var(--success)' : 'var(--destructive)'}
                  bold
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  disabled={!canMatch || match.isPending}
                  title={
                    selStatement.size === 0 || selLedger.size === 0
                      ? 'Select lines on both sides'
                      : selDiff !== 0
                        ? 'Totals must be equal'
                        : undefined
                  }
                  onClick={() => match.mutate()}
                >
                  <Link2 size={14} /> {match.isPending ? 'Matching…' : 'Match'}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-ghost"
                  disabled={selStatement.size === 0 && selLedger.size === 0}
                  onClick={clearSelection}
                >
                  Clear
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Money in on the statement (Kredit) pairs with ledger debits; money out (Debet) with ledger credits. Many-to-one is fine.
              </div>
            </div>
          )}

          <div className="v2-card" style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 2 }}>Rekonsiliasi</div>
            {!summary ? (
              <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Summary not available.</div>
            ) : (
              <>
                <Row label="Saldo rekening koran" value={money(summary.statement_closing_balance)} bold />
                <Row label="+ Setoran dalam perjalanan" value={money(summary.deposits_in_transit)} hint="Ledger debits not on the statement yet" />
                <Row label="− Pembayaran belum dicairkan" value={money(summary.outstanding_payments)} hint="Ledger credits not on the statement yet" />
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <Row label="= Saldo bank disesuaikan" value={money(summary.adjusted_bank_balance)} bold />
                </div>
                <Row label="Saldo buku besar" value={money(summary.ledger_balance)} bold />
                <div
                  style={{
                    borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2,
                  }}
                >
                  <Row label="Selisih" value={money(diff)} bold color={diff === 0 ? 'var(--success)' : 'var(--destructive)'} />
                </div>

                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
                  <Check ok={summary.statement_movement_ok}>
                    Statement: {money(summary.statement_opening_balance)} + {money(summary.statement_total_in)} − {money(summary.statement_total_out)}
                    {summary.statement_movement_ok ? ' = closing' : ' ≠ closing balance'}
                  </Check>
                  <Check ok={summary.unmatched_statement_lines === 0}>
                    {summary.unmatched_statement_lines === 0
                      ? 'Every statement line is matched'
                      : `${summary.unmatched_statement_lines} statement line(s) still unmatched`}
                  </Check>
                  <Check ok={diff === 0}>{diff === 0 ? 'Adjusted bank balance = ledger' : 'Difference must be 0'}</Check>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {bookLine && <BookLineSheet reconciliationId={id} line={bookLine} onClose={() => setBookLine(null)} />}

      {confirm === 'complete' && (
        <ConfirmDialog
          title="Complete reconciliation?"
          confirmLabel="Complete"
          pending={complete.isPending}
          onConfirm={() => complete.mutate()}
          onClose={() => setConfirm(null)}
        >
          The reconciliation is locked: matches can&apos;t change and the matched journal lines can&apos;t be deleted. You can
          reopen it while {rec.period?.name ?? 'the period'} is still open.
        </ConfirmDialog>
      )}
      {confirm === 'reopen' && (
        <ConfirmDialog
          title="Reopen reconciliation?"
          confirmLabel="Reopen"
          pending={reopen.isPending}
          onConfirm={() => reopen.mutate()}
          onClose={() => setConfirm(null)}
        >
          It goes back to draft so lines can be uploaded, matched or unmatched again.
        </ConfirmDialog>
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete reconciliation?"
          confirmLabel="Delete"
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirm(null)}
        >
          The statement lines and matches of this draft are removed. Journals and cash transactions booked from it stay.
        </ConfirmDialog>
      )}
    </div>
  )
}

function completeReason(s: NonNullable<BankReconciliation['summary']>): string {
  if (!s.statement_movement_ok) return 'Statement lines don’t add up to the closing balance'
  if (s.unmatched_statement_lines > 0) return `${s.unmatched_statement_lines} statement line(s) still unmatched`
  if (num(s.difference) !== 0) return 'Difference must be 0'
  return 'Not ready to complete'
}

function Row({ label, value, hint, bold, color }: { label: string; value: string; hint?: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }} title={hint}>
      <span style={{ color: bold ? 'var(--foreground)' : 'var(--foreground-muted)', fontWeight: bold ? 500 : 400 }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 600 : 500, color: color ?? 'var(--foreground)', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 6, color: ok ? 'var(--success)' : 'var(--foreground-muted)' }}>
      <span style={{ fontWeight: 700 }}>{ok ? '✓' : '•'}</span>
      <span>{children}</span>
    </div>
  )
}
