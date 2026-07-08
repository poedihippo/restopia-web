import React from 'react'
import PrinterStatusBar from '@/components/pos/PrinterStatusBar'

interface PosHeaderProps {
  search: string
  setSearch: (val: string) => void
  setProductPage: (val: number) => void
  setShowHistory: (val: boolean) => void
  setShowPreorder: (val: boolean) => void
  setShowPreorders: (val: boolean) => void
}

export default function PosHeader({
  search,
  setSearch,
  setProductPage,
  setShowHistory,
  setShowPreorder,
  setShowPreorders,
}: PosHeaderProps) {
  return (
    <>
      <div
        style={{
          height: 56,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface)',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            height: 36,
            padding: '0 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⬅ Back
        </button>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
          }}
        >
          Dapur Coklat POS
        </span>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setProductPage(1)
          }}
          placeholder="Search products..."
          style={{
            flex: 1,
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            fontSize: 14,
            color: 'var(--foreground)',
            background: 'var(--background)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          style={{
            marginLeft: 'auto',
            height: 36,
            padding: '0 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          🧾 History
        </button>
        <button
          type="button"
          onClick={() => setShowPreorder(true)}
          style={{
            height: 36,
            padding: '0 14px',
            border: '1px solid var(--accent-light)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-light-bg)',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          📋 Pre-order
        </button>
        <button
          type="button"
          onClick={() => setShowPreorders(true)}
          style={{
            height: 36,
            padding: '0 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          🗂 Pending
        </button>
      </div>
      <PrinterStatusBar />
    </>
  )
}
