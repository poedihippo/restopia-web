'use client'

import { useRouter } from 'next/router'
import SalesOrdersDetail from './Detail/SalesOrdersDetail'

export default function SalesOrderDetail() {
  const router = useRouter()
  const raw = router.query.id
  const id = typeof raw === 'string' ? Number(raw) : Array.isArray(raw) ? Number(raw[0]) : NaN

  if (!router.isReady || Number.isNaN(id) || id < 1) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-sans)', color: 'var(--foreground-muted)' }}>
        Loading…
      </div>
    )
  }

  return <SalesOrdersDetail id={id} />
}
