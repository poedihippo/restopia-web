'use client'
import React from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { referenceHref, referenceLabel } from '@/lib/references'

/**
 * Link to another record instead of printing its raw id ("#12").
 *
 * Shows `children` (a code or name) when the caller knows one, otherwise
 * "Go to <type>". Falls back to plain text when the type has no page.
 */
export default function ReferenceLink({
  type,
  id,
  children,
  newTab,
  style,
}: {
  type: string
  id?: number | null
  children?: React.ReactNode
  /** Open in a new tab (e.g. from a ledger the user is reconciling). */
  newTab?: boolean
  style?: React.CSSProperties
}) {
  if (!id) return <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
  const href = referenceHref(type, id)
  const text = children ?? `Go to ${referenceLabel(type).toLowerCase()}`
  if (!href) return <span style={style}>{children ?? referenceLabel(type)}</span>
  return (
    <Link
      href={href}
      className="v2-link"
      onClick={(e) => e.stopPropagation()}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{ textDecorationLine: 'underline', ...style }}
    >
      {text}
      <ArrowUpRight size={12} />
    </Link>
  )
}
