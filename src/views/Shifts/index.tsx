'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight } from 'lucide-react'
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
  parseApiTime,
  personName,
  readSnapshot,
  useDeepLinkId,
} from '@/views/Operations/shared'

// Read-only board: shifts grouped under the operation (business day) they ran
// in. The page is paged by operation; every shift of those operations is
// fetched in one call (filter[operation_id] takes a comma list).

// Each shift rule keeps the same colour across days.
const PALETTE = [
  { bg: 'var(--accent-light-bg)', fg: 'var(--accent)' },
  { bg: 'var(--info-bg)', fg: 'var(--info)' },
  { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  { bg: 'var(--success-bg)', fg: 'var(--success)' },
]
const colorFor = (ruleId: number) => PALETTE[Math.abs(Number(ruleId) || 0) % PALETTE.length]

export default function ShiftsView() {
  const { user } = useAuth()
  const branch = user?.branch

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(7)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [deepId, clearDeepId] = useDeepLinkId()
  // Arriving from a "Go to shift" link opens that shift's drawer.
  useEffect(() => {
    if (deepId) setSelected((cur: any) => (cur?.id === deepId ? cur : { id: deepId }))
  }, [deepId])
  const closeDrawer = () => {
    setSelected(null)
    clearDeepId()
  }

  useEffect(() => setPage(1), [dateFrom, dateTo])

  const { data: opsData, isLoading: opsLoading, isFetching: opsFetching, isError: opsError } = useQuery({
    queryKey: ['operations', 'shift-board', page, perPage, dateFrom, dateTo, branch?.id],
    queryFn: () =>
      operationsService
        .list({
          page,
          per_page: perPage,
          sort: '-opened_at',
          include: 'opened_by,closed_by',
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
  })
  const operations: any[] = (opsData as any)?.data ?? []
  const meta = (opsData as any)?.meta
  const opIds = operations.map((o) => o.id).join(',')

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', 'board', opIds],
    queryFn: () =>
      shiftsService
        .list({
          per_page: 500,
          sort: 'started_at',
          'filter[operation_id]': opIds,
          include: 'started_by,ended_by,created_by,updated_by',
        } as any)
        .then((r) => r.data),
    enabled: !!opIds,
  })

  const shiftsByOp = useMemo(() => {
    const map = new Map<number, any[]>()
    for (const s of ((shiftsData as any)?.data ?? []) as any[]) {
      const list = map.get(s.operation_id) ?? []
      list.push(s)
      map.set(s.operation_id, list)
    }
    return map
  }, [shiftsData])

  const loading = opsLoading || opsFetching

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Shifts</h1>
        <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
          Shifts per business day at {branch?.name ?? 'the active branch'}
        </p>
      </div>

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

      {loading ? (
        [0, 1].map((i) => (
          <div key={i} className="v2-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="v2-skeleton" style={{ height: 12, width: 220 }} />
            <div className="v2-skeleton" style={{ height: 44 }} />
            <div className="v2-skeleton" style={{ height: 12, width: '70%' }} />
          </div>
        ))
      ) : opsError ? (
        <div className="v2-card" style={{ padding: 40, textAlign: 'center', color: 'var(--destructive)', fontSize: 13 }}>Couldn’t load shifts.</div>
      ) : operations.length === 0 ? (
        <div className="v2-card" style={{ padding: 44, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
          No business days {dateFrom || dateTo ? 'in this date range' : 'yet'} — shifts appear once an operation is opened.
        </div>
      ) : (
        operations.map((op) => (
          <OperationGroup
            key={op.id}
            operation={op}
            shifts={shiftsByOp.get(op.id) ?? []}
            shiftsLoading={shiftsLoading}
            onSelect={setSelected}
          />
        ))
      )}

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {selected && <ShiftDrawer shift={selected} onClose={closeDrawer} />}
    </div>
  )
}

function OperationGroup({
  operation: op,
  shifts,
  shiftsLoading,
  onSelect,
}: {
  operation: any
  shifts: any[]
  shiftsLoading: boolean
  onSelect: (s: any) => void
}) {
  const opStart = parseApiTime(op.opened_at)
  const opEnd = parseApiTime(op.closed_at)

  // Timeline window: the operation's span (or its shifts', if wider), widened
  // to whole hours, at least 6 hours.
  const range = useMemo(() => {
    const times: number[] = []
    if (opStart) times.push(opStart.getTime())
    times.push((opEnd ?? new Date()).getTime())
    for (const s of shifts) {
      const a = parseApiTime(s.started_at)
      const b = parseApiTime(s.ended_at) ?? new Date()
      if (a) times.push(a.getTime())
      times.push(b.getTime())
    }
    const hour = 3600000
    let from = Math.floor(Math.min(...times) / hour) * hour
    let to = Math.ceil(Math.max(...times) / hour) * hour
    if (to - from < 6 * hour) to = from + 6 * hour
    return { from, to }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op.opened_at, op.closed_at, shifts])

  const span = range.to - range.from
  const pct = (t: number) => `${((t - range.from) / span) * 100}%`
  const hours = Math.round(span / 3600000)
  const tickEvery = hours > 16 ? 3 : hours > 8 ? 2 : 1
  const ticks = Array.from({ length: Math.floor(hours / tickEvery) + 1 }, (_, i) => range.from + i * tickEvery * 3600000)

  return (
    <div className="v2-card" style={{ overflow: 'hidden' }}>
      {/* Operation header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{fmtDay(parseApiTime(op.date) ?? opStart)}</div>
        <StatusBadge open={!op.closed_at} />
        <div style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(opStart)} – {op.closed_at ? fmtTime(opEnd) : 'now'}</span>
          <span>· opened by {personName(op.opened_by, op.opened_by_id)}</span>
          <TriggerChip value={op.open_trigger} />
          {op.closed_at && (
            <>
              <span>· closed by {personName(op.closed_by, op.closed_by_id)}</span>
              <TriggerChip value={op.close_trigger} />
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
          {shifts.length} shift{shifts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Timeline */}
      <div style={{ padding: '14px 18px 6px' }}>
        <div style={{ position: 'relative', height: 16, fontSize: 10.5, color: 'var(--foreground-subtle)', fontVariantNumeric: 'tabular-nums' }}>
          {ticks.map((t, i) => (
            <span key={t} style={{ position: 'absolute', left: pct(t), transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
              {fmtTime(new Date(t))}
            </span>
          ))}
        </div>
        <div style={{ position: 'relative', height: 44, borderRadius: 'var(--radius-md)', background: 'var(--surface-muted)', overflow: 'hidden' }}>
          {ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', top: 0, bottom: 0, left: pct(t), width: 1, background: 'var(--border)' }} />
          ))}
          {/* the operation's own window */}
          {opStart && (
            <span
              title="Operation open"
              style={{ position: 'absolute', top: 0, bottom: 0, left: pct(opStart.getTime()), width: `calc(${pct((opEnd ?? new Date()).getTime())} - ${pct(opStart.getTime())})`, background: 'var(--surface)', borderLeft: '2px solid var(--success)', borderRight: op.closed_at ? '2px solid var(--foreground-subtle)' : 'none', opacity: 0.9 }}
            />
          )}
          {shifts.map((s) => {
            const a = parseApiTime(s.started_at)
            if (!a) return null
            const b = parseApiTime(s.ended_at) ?? new Date()
            const snap = readSnapshot(s.shift_rule_snapshot)
            const c = colorFor(s.shift_rule_id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s)}
                title={`${snap.name ?? 'Shift'} · ${fmtTime(a)} – ${s.ended_at ? fmtTime(b) : 'now'}`}
                style={{
                  position: 'absolute',
                  top: 6,
                  bottom: 6,
                  left: pct(a.getTime()),
                  width: `max(6px, calc(${pct(b.getTime())} - ${pct(a.getTime())}))`,
                  background: c.bg,
                  border: `1px solid ${c.fg}`,
                  borderStyle: s.ended_at ? 'solid' : 'dashed',
                  borderRadius: 6,
                  color: c.fg,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '0 6px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {snap.name ?? 'Shift'} · {fmtTime(a)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Shift rows */}
      <div style={{ padding: '8px 18px 14px' }}>
        {shiftsLoading ? (
          <div className="v2-skeleton" style={{ height: 34 }} />
        ) : shifts.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', padding: '6px 0' }}>No shifts were started in this operation.</div>
        ) : (
          shifts.map((s) => {
            const a = parseApiTime(s.started_at)
            const b = parseApiTime(s.ended_at)
            const snap = readSnapshot(s.shift_rule_snapshot)
            const c = colorFor(s.shift_rule_id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s)}
                style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(140px,1.2fr) minmax(110px,0.8fr) minmax(170px,1.4fr) minmax(170px,1.4fr) auto 16px', gap: 12, alignItems: 'center', padding: '9px 4px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer', fontSize: 12.5, color: 'var(--foreground)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: c.fg, flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snap.name ?? 'Shift'}</span>
                    {(snap.start_time || snap.end_time) && (
                      <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Planned {snap.start_time ?? '?'} – {snap.end_time ?? '?'}</span>
                    )}
                  </span>
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtTime(a)} – {s.ended_at ? fmtTime(b) : 'now'}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--foreground-subtle)' }}>{durationLabel(a, b)}</span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', display: 'block' }}>Started by</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{personName(s.started_by, s.started_by_id)} <TriggerChip value={s.start_trigger} /></span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', display: 'block' }}>Ended by</span>
                  {s.ended_at ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{personName(s.ended_by, s.ended_by_id)} <TriggerChip value={s.end_trigger} /></span>
                  ) : (
                    <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                  )}
                </span>
                <StatusBadge open={!s.ended_at} openLabel="Running" closedLabel="Ended" />
                <ChevronRight size={14} style={{ color: 'var(--foreground-subtle)' }} />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function ShiftDrawer({ shift, onClose }: { shift: any; onClose: () => void }) {
  // Reload in full: a deep link only knows the id.
  const { data } = useQuery({
    queryKey: ['shifts', 'detail', shift.id],
    queryFn: () => shiftsService.findById(shift.id, { include: 'started_by,ended_by,created_by,updated_by' }).then((r) => r.data),
  })
  const s = (data as any)?.data ?? shift
  const snap = readSnapshot(s.shift_rule_snapshot)
  const a = parseApiTime(s.started_at)
  const b = parseApiTime(s.ended_at)
  return (
    <Drawer
      title={snap.name ?? 'Shift'}
      subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{s.branch?.name ?? 'Shift'} <StatusBadge open={!s.ended_at} openLabel="Running" closedLabel="Ended" /></span>}
      onClose={onClose}
    >
      <Section title="Shift">
        <Field label="Started"><ActorLine at={a} user={s.started_by} id={s.started_by_id} trigger={s.start_trigger} /></Field>
        <Field label="Ended">
          {s.ended_at ? <ActorLine at={b} user={s.ended_by} id={s.ended_by_id} trigger={s.end_trigger} /> : <span style={{ color: 'var(--foreground-subtle)' }}>Still running</span>}
        </Field>
        <Field label="Duration">{durationLabel(a, b)}{!s.ended_at && ' so far'}</Field>
        <Field label="Operation"><ReferenceLink type="operations" id={s.operation_id} /></Field>
      </Section>

      <Section title="Shift rule at the time">
        <Field label="Name">{snap.name ?? '—'}</Field>
        <Field label="Planned">{snap.start_time ?? '?'} – {snap.end_time ?? '?'}</Field>
        <Field label="Rule"><ReferenceLink type="shift_rules" id={s.shift_rule_id} /></Field>
      </Section>

      <AuditSection item={s} />
    </Drawer>
  )
}
