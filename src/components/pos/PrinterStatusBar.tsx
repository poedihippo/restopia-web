'use client'

import { usePrinter } from '@/hooks/usePrinter'

const STATUS_LABEL: Record<string, string> = {
  unsupported: 'WebUSB not supported',
  disconnected: 'Printer disconnected',
  connecting: 'Connecting…',
  connected: 'Printer connected',
  printing: 'Printing…',
  error: 'Printer error',
}

const dotColor = (status: string): string => {
  if (status === 'connected') return 'var(--success)'
  if (status === 'connecting' || status === 'printing') return 'var(--warning)'
  if (status === 'unsupported') return 'var(--foreground-subtle)'
  return 'var(--destructive)'
}

export default function PrinterStatusBar() {
  const { status, device, errorMessage, connect } = usePrinter()
  const label = STATUS_LABEL[status] ?? status
  const showConnect =
    status === 'disconnected' || status === 'error'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: 12,
        color: 'var(--foreground-muted)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor(status),
          flexShrink: 0,
        }}
      />
      <span style={{ color: 'var(--foreground)' }}>{label}</span>
      {device?.productName ? (
        <span style={{ color: 'var(--foreground-subtle)' }}>
          · {device.productName}
        </span>
      ) : null}
      {errorMessage ? (
        <span
          style={{
            color: 'var(--destructive)',
            marginLeft: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={errorMessage}
        >
          {errorMessage}
        </span>
      ) : null}
      {/* Connect sits next to the status, on the left. */}
      {showConnect ? (
        <button
          type="button"
          onClick={() => {
            void connect()
          }}
          style={{
            height: 26,
            padding: '0 12px',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)',
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Connect Printer
        </button>
      ) : null}
    </div>
  )
}
