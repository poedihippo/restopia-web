'use client'

import React from 'react'

/** Shared bits for the on-screen report tables (cash flow, tax, budget vs actual). */

export const pageStyle: React.CSSProperties = {
  padding: '32px 32px 64px',
  maxWidth: 1100,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

export const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 26,
  fontWeight: 500,
  color: 'var(--foreground)',
  margin: 0,
}

export const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--foreground-muted)',
  margin: '4px 0 0',
}

export const filterLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

export const filterInputStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

export const numTd: React.CSSProperties = {
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

export const totalRowStyle: React.CSSProperties = {
  background: 'var(--accent-light-bg)',
  fontWeight: 700,
}

export const sectionRowStyle: React.CSSProperties = {
  background: 'var(--background)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

/** Money in whole cents, so float noise never decides a sign or a colour. */
export const cents = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100)

/** "operating_expense" → "Operating expense". */
export const humanize = (s: string) => {
  const t = (s || '').replace(/_/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={filterLabelStyle}>{label}</label>
      {children}
    </div>
  )
}

export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`sk-${i}`}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}>
              <div className="v2-skeleton" style={{ height: 12, width: j === 0 ? '70%' : '55%', marginLeft: j > 0 ? 'auto' : undefined }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function MessageRow({
  cols,
  icon,
  children,
  tone = 'muted',
}: {
  cols: number
  icon?: React.ReactNode
  children: React.ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: 'center', padding: '44px 16px', height: 'auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: tone === 'error' ? 'var(--destructive)' : 'var(--foreground-muted)',
          }}
        >
          {icon}
          {children}
        </div>
      </td>
    </tr>
  )
}
