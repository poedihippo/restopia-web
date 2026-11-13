'use client'

import React from 'react'
import { X } from 'lucide-react'
import { formatAmount } from '@/utils/price'
import type { BankReconciliationStatus, MatchGroupId } from '@/services/bank-reconciliations.service'

export const num = (v: unknown) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
export const round2 = (n: number) => Math.round(n * 100) / 100
export const money = (v: unknown) => formatAmount(num(v))

export const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none',
  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
export const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
}
export const numCell: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

export function StatusChip({ status }: { status: BankReconciliationStatus }) {
  const done = status === 'completed'
  return (
    <span
      style={{
        padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, display: 'inline-block',
        background: done ? 'var(--success-bg)' : 'var(--warning-bg)',
        color: done ? 'var(--success)' : 'var(--warning)',
      }}
    >
      {done ? 'Completed' : 'Draft'}
    </span>
  )
}

/** Small chip naming a match group; hovering it highlights the group in both panes. */
export function GroupChip({
  id,
  active,
  onHover,
}: {
  id: MatchGroupId
  active?: boolean
  onHover?: (id: MatchGroupId | null) => void
}) {
  return (
    <span
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      title="Match group — hover to see its counterpart"
      style={{
        padding: '1px 7px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
        background: active ? 'var(--info)' : 'var(--info-bg)', color: active ? '#fff' : 'var(--info)',
        fontVariantNumeric: 'tabular-nums', cursor: 'default',
      }}
    >
      #{String(id)}
    </span>
  )
}

/** Right-hand side sheet (backdrop + panel), as on the other v2 screens. */
export function Sheet({
  title,
  subtitle,
  onClose,
  footer,
  width = 460,
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  width?: number
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="v2-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <div
        className="v2-sheet"
        style={{
          position: 'relative', zIndex: 50, width, maxWidth: '100vw', height: '100%', background: 'var(--surface)',
          borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button type="button" className="v2-icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Centered confirm dialog. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  onClose,
  width = 420,
}: {
  title: string
  children: React.ReactNode
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
  width?: number
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="v2-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={onClose} />
      <div
        className="v2-dialog"
        style={{
          position: 'relative', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24,
          width, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>{title}</h3>
        <div style={{ fontSize: 13, color: 'var(--foreground-muted)', marginBottom: 20 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`v2-btn ${danger ? 'v2-btn-danger' : 'v2-btn-primary'}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
