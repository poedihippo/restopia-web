'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { CSSProperties } from 'react'

interface BackLinkProps {
  /** The module's list page, e.g. "/transfer/invoices". Never history.back(). */
  href: string
  /** The list's name, shown after the arrow, e.g. "Invoices". */
  label: string
  style?: CSSProperties
}

/**
 * The one back control for create / edit / detail pages: "← Invoices", always
 * linking to the module's list (not router.back(), which returns to wherever
 * the user came from — another module, a notification, a fresh tab). Sits
 * above the page title. Because it is a real link, ctrl/cmd-click opens the
 * list in a new tab.
 */
export default function BackLink({ href, label, style }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="back-link"
      aria-label={`Back to ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        width: 'fit-content',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--foreground-muted)',
        textDecoration: 'none',
        ...style,
      }}
    >
      <ArrowLeft size={14} aria-hidden />
      {label}
    </Link>
  )
}
