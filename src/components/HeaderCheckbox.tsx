'use client'
import React, { useEffect, useRef } from 'react'

/**
 * "Check all" checkbox for a table header. Checked when every eligible row is
 * checked, indeterminate (dash) when only some are. Clicking it checks all
 * eligible rows, or unchecks them when they are all checked already.
 */
export default function HeaderCheckbox({
  total,
  checkedCount,
  onToggleAll,
  disabled,
  title = 'Check all',
  style,
}: {
  /** Number of rows the header acts on (eligible rows only). */
  total: number
  /** How many of those rows are checked. */
  checkedCount: number
  /** Called with true to check all eligible rows, false to uncheck them. */
  onToggleAll: (checkAll: boolean) => void
  disabled?: boolean
  title?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLInputElement>(null)
  const all = total > 0 && checkedCount >= total
  const some = checkedCount > 0 && !all

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some
  }, [some])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={title}
      title={title}
      checked={all}
      disabled={disabled || total === 0}
      onChange={() => onToggleAll(!all)}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: disabled || total === 0 ? 'not-allowed' : 'pointer', ...style }}
    />
  )
}
