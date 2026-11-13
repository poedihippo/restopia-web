'use client'
// Shared bits for the Operations and Shifts views. Both resources are
// branch-tenanted (the API only returns the ACTIVE branch's rows) and read-only.
import React from 'react'
import { useRouter } from 'next/router'
import { X } from 'lucide-react'
import { formatDateTime } from '@/utils/date'

// opened_at / closed_at / started_at / ended_at come back as
// "YYYY-MM-DD HH:mm:ss" in UTC (helper_time.TimeToString on a timestamptz),
// unlike the audit timestamps, which are already in the branch's timezone.
// A bare "YYYY-MM-DD" (operation.date) is a calendar day, read as local.
export function parseApiTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
  return isNaN(d.getTime()) ? null : d
}

export const fmtTime = (d: Date | null) =>
  d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtDay = (d: Date | null) =>
  d ? d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const fmtDateTimeLocal = (d: Date | null) => (d ? `${fmtDay(d)}, ${fmtTime(d)}` : '—')

export function durationLabel(from: Date | null, to: Date | null): string {
  if (!from) return '—'
  const ms = (to ?? new Date()).getTime() - from.getTime()
  if (ms < 0) return '—'
  const mins = Math.round(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return `${d}d ${h}h`
  return h ? `${h}h ${m}m` : `${m}m`
}

// enums: operation_open_trigger / shift_start_trigger (+ close/end) share these values.
const TRIGGER_LABEL: Record<string, string> = {
  auto: 'Automatic',
  auto_rollover: 'Auto rollover',
  manual: 'Manual',
  manual_rollover: 'Manual rollover',
  system: 'System',
}

export function TriggerChip({ value }: { value?: string | null }) {
  if (!value) return null
  const auto = value.startsWith('auto') || value === 'system'
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 500,
        padding: '1px 6px',
        borderRadius: 99,
        background: auto ? 'var(--info-bg)' : 'var(--surface-muted)',
        color: auto ? 'var(--info)' : 'var(--foreground-muted)',
        border: '1px solid var(--border)',
        whiteSpace: 'nowrap',
      }}
    >
      {TRIGGER_LABEL[value] ?? value}
    </span>
  )
}

export function StatusBadge({ open, openLabel = 'Open', closedLabel = 'Closed' }: { open: boolean; openLabel?: string; closedLabel?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 99,
        background: open ? 'var(--success-bg)' : 'var(--surface-muted)',
        color: open ? 'var(--success)' : 'var(--foreground-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: open ? 'var(--success)' : 'var(--foreground-subtle)' }} />
      {open ? openLabel : closedLabel}
    </span>
  )
}

/** A user from an include (created_by, opened_by, …). */
export function personName(user: any, id?: number | null): string {
  if (user?.name) return user.name
  // The user row is gone (or hidden from this tenant): say so rather than print an id.
  return id ? 'Unknown user' : '—'
}

/** The rule copied onto the record when it started — later rule edits don't change it. */
export function readSnapshot(raw: unknown): Record<string, any> {
  let snap: Record<string, any> = {}
  if (typeof raw === 'string') {
    try {
      snap = JSON.parse(raw) ?? {}
    } catch {
      snap = {}
    }
  } else if (raw && typeof raw === 'object') {
    snap = raw as Record<string, any>
  }
  // Snapshots taken before migration 000084 have one `operation_mode` for both
  // opening and closing instead of open_mode / close_mode.
  if (snap.operation_mode) {
    snap = { open_mode: snap.operation_mode, close_mode: snap.operation_mode, ...snap }
  }
  return snap
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'baseline', padding: '7px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--foreground)', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--foreground-subtle)', marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

/** Who did it, with the trigger and when. */
export function ActorLine({ user, id, trigger, at }: { user: any; id?: number | null; trigger?: string | null; at?: Date | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {at !== undefined && <span>{fmtDateTimeLocal(at)}</span>}
      <span style={{ color: 'var(--foreground-muted)' }}>by {personName(user, id)}</span>
      <TriggerChip value={trigger} />
    </span>
  )
}

/** created_by / updated_by block shared by both drawers. */
export function AuditSection({ item }: { item: any }) {
  return (
    <Section title="Record">
      <Field label="Created">
        {item.created_at ? formatDateTime(item.created_at) : '—'}
        <span style={{ color: 'var(--foreground-muted)' }}> · {personName(item.created_by, item.created_by_id)}</span>
      </Field>
      <Field label="Last updated">
        {item.updated_at ? formatDateTime(item.updated_at) : '—'}
        <span style={{ color: 'var(--foreground-muted)' }}> · {personName(item.updated_by, item.updated_by_id)}</span>
      </Field>
    </Section>
  )
}

export function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="v2-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <div
        className="v2-sheet"
        style={{ position: 'relative', zIndex: 50, width: 480, maxWidth: '100vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button type="button" className="v2-icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

export const modeLabel = (v?: string | null) => (v === 'auto' ? 'Automatic' : v === 'manual' ? 'Manual' : '—')

/**
 * `?id=` deep link (from ReferenceLink): the record to open on arrival, and a
 * function that drops the param again when its drawer closes.
 */
export function useDeepLinkId(): [number | null, () => void] {
  const router = useRouter()
  const raw = router.query.id
  const id = Number(Array.isArray(raw) ? raw[0] : raw)
  const clear = () => {
    if (router.query.id == null) return
    const { id: _drop, ...rest } = router.query
    router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
  }
  return [Number.isFinite(id) && id > 0 ? id : null, clear]
}
