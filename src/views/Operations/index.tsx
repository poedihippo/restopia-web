'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight, Clock } from 'lucide-react'
import { operationsService } from '@/services/operations.service'
import { shiftsService } from '@/services/shifts.service'
import { useAuth } from '@/hooks/useAuth'
import { DateRange } from '@/components/ListFilters'
import { CustomPagination } from '@/components/ui/CustomPagination'
import ReferenceLink from '@/components/ReferenceLink'
import {
  ActorLine,
  AuditSection,
  Drawer,
  Field,
  Section,
  StatusBadge,
  TriggerChip,
  durationLabel,
  fmtDay,
  fmtTime,
  modeLabel,
  parseApiTime,
  personName,
  readSnapshot,
  useDeepLinkId,
} from './shared'

// Read-only: operations are opened/closed from the POS (or by the scheduler);
// the API exposes only GET here.
const INCLUDE = 'opened_by,closed_by,created_by,updated_by'

export default function OperationsView() {
  const { user } = useAuth()
  const branch = user?.branch

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [deepId, clearDeepId] = useDeepLinkId()
  // Arriving from a "Go to operation" link opens that operation's drawer.
  useEffect(() => {
    if (deepId) setSelected((cur: any) => (cur?.id === deepId ? cur : { id: deepId }))
  }, [deepId])
  const closeDrawer = () => {
    setSelected(null)
    clearDeepId()
  }

  useEffect(() => setPage(1), [dateFrom, dateTo])

  // 400 when nothing is open — that just means "closed right now".
  const { data: currentData } = useQuery({
    queryKey: ['operations', 'current', branch?.id],
    queryFn: () => operationsService.current({ include: 'opened_by' }).then((r) => r.data),
    enabled: !!branch?.id,
    retry: false,
  })
  const currentBase = (currentData as any)?.data ?? null
  // /operations/current ignores `include`, so load the people by id.
  const { data: currentFull } = useQuery({
    queryKey: ['operations', 'detail', currentBase?.id],
    queryFn: () => operationsService.findById(currentBase.id, { include: INCLUDE }).then((r) => r.data),
    enabled: !!currentBase?.id,
  })
  const current = (currentFull as any)?.data ?? currentBase

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['operations', page, perPage, dateFrom, dateTo, branch?.id],
    queryFn: () =>
      operationsService
        .list({
          page,
          per_page: perPage,
          sort: '-opened_at',
          include: INCLUDE,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
  })
  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const loading = isLoading || isFetching

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Operations</h1>
        <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
          Daily open / close log for {branch?.name ?? 'the active branch'}
          {meta?.total != null && <span style={{ color: 'var(--foreground-subtle)' }}> · {Number(meta.total).toLocaleString('id-ID')} {Number(meta.total) === 1 ? 'day' : 'days'}</span>}
        </p>
      </div>

      {/* Right now */}
      <div className="v2-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: current ? 'var(--success-bg)' : 'var(--surface-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={16} style={{ color: current ? 'var(--success)' : 'var(--foreground-muted)' }} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--foreground)' }}>
              {current ? 'Branch is open' : 'Branch is closed'}
            </span>
            <StatusBadge open={!!current} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
            {current ? (
              <>
                Since {fmtTime(parseApiTime(current.opened_at))} · {durationLabel(parseApiTime(current.opened_at), null)} · by{' '}
                {personName(current.opened_by, current.opened_by_id)}
              </>
            ) : (
              'No operation is open right now.'
            )}
          </div>
        </div>
        {current && (
          <button type="button" className="v2-btn v2-btn-ghost" onClick={() => setSelected(current)}>
            Details <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <CalendarDays size={14} style={{ color: 'var(--foreground-muted)' }} />
        <div style={{ width: 300 }}>
          <DateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        </div>
        {(dateFrom || dateTo) && (
          <button type="button" className="v2-btn v2-btn-ghost" onClick={() => { setDateFrom(''); setDateTo('') }}>
            Clear
          </button>
        )}
      </div>

      <div className="v2-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="v2-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Duration</th>
                <th>Rule at the time</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r}>
                    {Array.from({ length: 7 }).map((__, c) => (
                      <td key={c}>{c < 6 && <div className="v2-skeleton" style={{ height: 10, width: `${60 - ((r + c) % 3) * 12}%` }} />}</td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--destructive)' }}>Couldn’t load operations.</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--foreground-muted)' }}>
                    No operations {dateFrom || dateTo ? 'in this date range' : 'yet'}.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const openedAt = parseApiTime(item.opened_at)
                  const closedAt = parseApiTime(item.closed_at)
                  const snap = readSnapshot(item.operation_rule_snapshot)
                  return (
                    <tr key={item.id} data-row onClick={() => setSelected(item)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDay(parseApiTime(item.date) ?? openedAt)}</td>
                      <td><StatusBadge open={!item.closed_at} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(openedAt)}</span>
                          <TriggerChip value={item.open_trigger} />
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{personName(item.opened_by, item.opened_by_id)}</div>
                      </td>
                      <td>
                        {item.closed_at ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(closedAt)}</span>
                              <TriggerChip value={item.close_trigger} />
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{personName(item.closed_by, item.closed_by_id)}</div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--foreground-subtle)' }}>Still open</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{durationLabel(openedAt, closedAt)}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                        Open {modeLabel(snap.open_mode)} · Close {modeLabel(snap.close_mode)} · Shift {modeLabel(snap.shift_mode)}
                      </td>
                      <td><ChevronRight size={14} style={{ color: 'var(--foreground-subtle)' }} /></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {selected && <OperationDrawer operation={selected} onClose={closeDrawer} />}
    </div>
  )
}

function OperationDrawer({ operation, onClose }: { operation: any; onClose: () => void }) {
  // The list row may lack includes (e.g. the "current" card), so reload in full.
  const { data } = useQuery({
    queryKey: ['operations', 'detail', operation.id],
    queryFn: () => operationsService.findById(operation.id, { include: INCLUDE }).then((r) => r.data),
  })
  const op = (data as any)?.data ?? operation

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', 'by-operation', op.id],
    queryFn: () =>
      shiftsService
        .list({ per_page: 100, sort: 'started_at', 'filter[operation_id]': op.id, include: 'started_by,ended_by' } as any)
        .then((r) => r.data),
  })
  const shifts: any[] = (shiftsData as any)?.data ?? []

  const openedAt = parseApiTime(op.opened_at)
  const closedAt = parseApiTime(op.closed_at)
  const snap = readSnapshot(op.operation_rule_snapshot)

  return (
    <Drawer
      title={fmtDay(parseApiTime(op.date) ?? openedAt)}
      subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{op.branch?.name ?? 'Operation'} <StatusBadge open={!op.closed_at} /></span>}
      onClose={onClose}
    >
      <Section title="Day">
        <Field label="Opened"><ActorLine at={openedAt} user={op.opened_by} id={op.opened_by_id} trigger={op.open_trigger} /></Field>
        <Field label="Closed">
          {op.closed_at ? <ActorLine at={closedAt} user={op.closed_by} id={op.closed_by_id} trigger={op.close_trigger} /> : <span style={{ color: 'var(--foreground-subtle)' }}>Still open</span>}
        </Field>
        <Field label="Duration">{durationLabel(openedAt, closedAt)}{!op.closed_at && ' so far'}</Field>
      </Section>

      <Section title="Rule at the time">
        <Field label="Opening">{modeLabel(snap.open_mode)}{snap.open_mode === 'auto' && snap.auto_open_cron ? <span style={{ color: 'var(--foreground-muted)' }}> · <code>{snap.auto_open_cron}</code></span> : null}</Field>
        <Field label="Closing">{modeLabel(snap.close_mode)}{snap.close_mode === 'auto' && snap.auto_close_cron ? <span style={{ color: 'var(--foreground-muted)' }}> · <code>{snap.auto_close_cron}</code></span> : null}</Field>
        <Field label="Shifts">{modeLabel(snap.shift_mode)}</Field>
        <Field label="Rule"><ReferenceLink type="operation_rules" id={op.operation_rule_id} /></Field>
      </Section>

      <Section title={`Shifts${shifts.length ? ` · ${shifts.length}` : ''}`}>
        {shiftsLoading ? (
          <div className="v2-skeleton" style={{ height: 34, marginTop: 6 }} />
        ) : shifts.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', padding: '6px 0' }}>No shifts in this operation.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {shifts.map((s) => {
              const sSnap = readSnapshot(s.shift_rule_snapshot)
              const sStart = parseApiTime(s.started_at)
              const sEnd = parseApiTime(s.ended_at)
              return (
                <Link key={s.id} href={`/settings/shifts?id=${s.id}`} data-click style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{sSnap.name ?? 'Shift'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                      {fmtTime(sStart)} – {s.ended_at ? fmtTime(sEnd) : 'now'} · {personName(s.started_by, s.started_by_id)}
                    </div>
                  </div>
                  <StatusBadge open={!s.ended_at} openLabel="Running" closedLabel="Ended" />
                  <ChevronRight size={14} style={{ color: 'var(--foreground-subtle)' }} />
                </Link>
              )
            })}
            <Link href="/settings/shifts" className="v2-btn v2-btn-ghost" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              Open shifts board <ChevronRight size={13} />
            </Link>
          </div>
        )}
      </Section>

      <AuditSection item={op} />
    </Drawer>
  )
}
