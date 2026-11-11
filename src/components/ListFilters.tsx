'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'

/**
 * Shared list-page filter toolbar.
 *
 *   <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search…"
 *     quick={<FilterSelect …>status</FilterSelect>}
 *     activeCount={countActive(statusFilter, branchFilter, dateFrom, dateTo)}
 *     onClear={clearFilters}>
 *     <FilterGroup title="Location">
 *       <FilterField label="Branch"><FilterSelect …/></FilterField>
 *     </FilterGroup>
 *     <FilterGroup title="Dates">
 *       <FilterField label="Order date"><DateRange …/></FilterField>
 *     </FilterGroup>
 *   </FilterBar>
 *
 * The toolbar row holds search + 1–3 quick filters; everything else lives in
 * a collapsible panel (inline, not floating, so date pickers and searchable
 * selects that portal their own popups keep working inside it).
 */

export const filterControlStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

/** Number of filters that hold a value ('' / 0 / null / undefined / [] are empty). */
export function countActive(...values: unknown[]): number {
  return values.filter((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== 0 && v !== null && v !== undefined && v !== false
  ).length
}

interface FilterBarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Filters shown inline next to search (keep to 1–3). */
  quick?: React.ReactNode
  /** Active filters across quick + panel (exclude search). */
  activeCount?: number
  onClear?: () => void
  /** Extra controls on the right of the toolbar row (e.g. export button). */
  actions?: React.ReactNode
  defaultOpen?: boolean
  /** Outer wrapper overrides, e.g. { marginBottom: 0 } inside a flex column with its own gap. */
  style?: React.CSSProperties
  /** FilterGroup elements rendered in the collapsible panel. */
  children?: React.ReactNode
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  quick,
  activeCount = 0,
  onClear,
  actions,
  defaultOpen = false,
  style,
  children,
}: FilterBarProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasPanel = !!children

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {onSearchChange && (
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--foreground-subtle)',
                pointerEvents: 'none',
              }}
            />
            <input
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ ...filterControlStyle, width: '100%', paddingLeft: 34 }}
            />
          </div>
        )}

        {quick}

        {hasPanel && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={{
              ...filterControlStyle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontWeight: 500,
              background: open ? 'var(--accent-light-bg)' : 'var(--surface-raised)',
              borderColor: open ? 'var(--accent-light)' : 'var(--border)',
            }}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeCount > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        )}

        {activeCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            style={{
              height: 36,
              padding: '0 8px',
              background: 'none',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              color: 'var(--foreground-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <X size={14} />
            Clear
          </button>
        )}

        {actions && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {actions}
          </div>
        )}
      </div>

      {hasPanel && open && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 24,
              padding: 20,
            }}
          >
            {children}
          </div>
          {onClear && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--foreground-muted)',
              }}
            >
              <span>{activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} applied` : 'No filters applied'}</span>
              <button
                type="button"
                onClick={onClear}
                disabled={activeCount === 0}
                style={{
                  padding: '6px 12px',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: activeCount === 0 ? 'var(--foreground-subtle)' : 'var(--foreground)',
                  cursor: activeCount === 0 ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--foreground-subtle)',
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

/** Native select styled for the toolbar (auto width) or panel (full width via `block`). */
export function FilterSelect({
  block,
  style,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { block?: boolean }) {
  return (
    <select
      {...props}
      style={{ ...filterControlStyle, cursor: 'pointer', width: block ? '100%' : undefined, ...style }}
    />
  )
}

export function FilterInput({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...filterControlStyle, width: '100%', ...style }} />
}

/** From – To date pair on one line. */
export function DateRange({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const dateStyle: React.CSSProperties = { ...filterControlStyle, flex: 1, minWidth: 0, padding: '0 8px', fontSize: 12 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} style={dateStyle} />
      <span style={{ color: 'var(--foreground-subtle)', fontSize: 12 }}>–</span>
      <input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} style={dateStyle} />
    </div>
  )
}
