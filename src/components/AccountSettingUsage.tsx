'use client'
import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  ACCOUNT_SETTING_USAGE_SIDE_LABEL,
  getAccountSettingUsages,
  type AccountSettingUsage,
  type AccountSettingUsageSide,
} from '@/lib/accountSettingUsages'

const sideColors: Record<AccountSettingUsageSide, { color: string; background: string }> = {
  debit: { color: 'var(--info)', background: 'var(--info-bg)' },
  credit: { color: 'var(--success)', background: 'var(--success-bg)' },
  debit_or_credit: { color: 'var(--warning)', background: 'var(--warning-bg)' },
  report: { color: 'var(--foreground-muted)', background: 'var(--background)' },
}

function SideBadge({ side }: { side: AccountSettingUsageSide }) {
  const c = sideColors[side]
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', color: c.color, background: c.background, border: '1px solid var(--border)' }}>
      {ACCOUNT_SETTING_USAGE_SIDE_LABEL[side]}
    </span>
  )
}

function sentence(u: AccountSettingUsage): string {
  const side = ACCOUNT_SETTING_USAGE_SIDE_LABEL[u.side].toLowerCase()
  return `Digunakan saat ${u.when} → ${side}`
}

/**
 * Table cell content: the first usage of a key inline, and how many more there
 * are. The full list lives in the row's Detail popup (AccountSettingDetailDialog).
 */
export default function AccountSettingUsageCell({ settingKey }: { settingKey?: string | null }) {
  const usages = getAccountSettingUsages(settingKey)

  if (usages.length === 0) {
    return <span style={{ fontSize: 12, color: 'var(--foreground-subtle)', fontStyle: 'italic' }}>Belum digunakan</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--foreground-muted)' }}>{sentence(usages[0])}</span>
      {usages.length > 1 && (
        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>+{usages.length - 1} penggunaan lainnya</span>
      )}
    </div>
  )
}

/** Every usage of a key, for the detail popup. */
function UsageList({ settingKey }: { settingKey?: string | null }) {
  const usages = getAccountSettingUsages(settingKey)
  if (usages.length === 0) {
    return (
      <div style={{ padding: '14px 16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground-subtle)', textAlign: 'center' }}>
        Belum digunakan
      </div>
    )
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {usages.map((u, i) => (
        <li key={i} style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{u.flow}</span>
            <SideBadge side={u.side} />
          </div>
          <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.5, color: 'var(--foreground-muted)' }}>
            {u.when.charAt(0).toUpperCase() + u.when.slice(1)}
          </div>
          {u.note && (
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: 'var(--foreground-subtle)' }}>{u.note}</div>
          )}
        </li>
      ))}
    </ul>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }

export interface AccountSettingDetailField {
  label: string
  value: React.ReactNode
}

interface DetailDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string | null
  fields: AccountSettingDetailField[]
  /** Setting key whose usages are listed at the bottom. */
  settingKey?: string | null
}

/** Popup with every detail of one account-setting row, including where its key is used. */
export function AccountSettingDetailDialog({ open, onClose, title, subtitle, fields, settingKey }: DetailDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const usageCount = getAccountSettingUsages(settingKey).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
            {subtitle && <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--foreground-muted)' }}>{subtitle}</span>}
          </div>
          <button type="button" onClick={onClose} title="Tutup" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', columnGap: 16, rowGap: 12, margin: 0, padding: '14px 16px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {fields.map((f) => (
              <React.Fragment key={f.label}>
                <dt style={{ fontSize: 12, color: 'var(--foreground-muted)', paddingTop: 1 }}>{f.label}</dt>
                <dd style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--foreground)', wordBreak: 'break-word' }}>{f.value ?? '—'}</dd>
              </React.Fragment>
            ))}
          </dl>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={sectionTitle}>Usage</span>
              {usageCount > 0 && <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>· {usageCount}</span>}
            </div>
            <UsageList settingKey={settingKey} />
          </div>
        </div>
      </div>
    </div>
  )
}
