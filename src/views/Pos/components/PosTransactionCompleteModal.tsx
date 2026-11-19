'use client'

import React, { useEffect } from 'react'
import { Check, Printer, X } from 'lucide-react'
import { formatCurrency } from '@/utils/price'
import type { ReceiptData } from '@/components/PosReceipt'

export interface CompletedTransaction {
  orderId: number | null
  receipt: ReceiptData
  /** Amount the customer handed over (cash tendered, or total for non-cash). */
  tendered: number
  change: number
  isOnline: boolean
  isPartial: boolean
  /** Kredit Customer saved with nothing paid now. */
  isCustomerCredit?: boolean
  /** Remaining balance after a DP / partial payment. */
  remaining: number
  printedCount: number
}

interface PosTransactionCompleteModalProps {
  transaction: CompletedTransaction | null
  isPrinting: boolean
  printerConnected: boolean
  onPrint: () => void
  onNewTransaction: () => void
}

const fmtQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

/**
 * Step 3 of checkout: the sale is saved. Instead of reloading the page, the
 * cashier sees the order number, what was paid and the change to hand back,
 * can (re)print the receipt, and only clears the screen with "Close" (or ✕).
 * Shortcuts: P = print, Enter = new transaction.
 */
export default function PosTransactionCompleteModal({
  transaction,
  isPrinting,
  printerConnected,
  onPrint,
  onNewTransaction,
}: PosTransactionCompleteModalProps) {
  useEffect(() => {
    if (!transaction) return
    // Don't let the Enter that confirmed payment immediately close this screen.
    const armedAt = Date.now()
    const onKey = (e: KeyboardEvent) => {
      if (Date.now() - armedAt < 600) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onNewTransaction()
      } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        onPrint()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [transaction, onNewTransaction, onPrint])

  if (!transaction) return null

  const { receipt, tendered, change, isOnline, isPartial, remaining, printedCount, isCustomerCredit } = transaction
  const totalQty = receipt.items.reduce((s, i) => s + Number(i.qty || 0), 0)

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: 13 }}>
      <span style={{ color: strong ? 'var(--foreground)' : 'var(--foreground-muted)', fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ color: 'var(--foreground)', fontWeight: strong ? 600 : 400, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
  const title = isOnline
    ? 'Online Order Created'
    : isCustomerCredit
      ? 'Kredit Customer Disimpan'
      : isPartial
        ? 'Down Payment Received'
        : 'Payment Successful'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(17, 17, 20, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <style>{`
        .pos-done-btn { transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        .pos-done-btn[data-tone="hold"]:not(:disabled):hover { background: #F1E2D2 !important; box-shadow: var(--shadow-sm); transform: translateY(-1px); }
        .pos-done-btn[data-tone="hold"]:not(:disabled):active { transform: none; box-shadow: none; }
        .pos-done-btn[data-tone="secondary"]:not(:disabled):hover { background: var(--accent-light-bg) !important; border-color: var(--accent-light) !important; color: var(--accent) !important; }
        .pos-done-close { transition: background-color 150ms ease, color 150ms ease; }
        .pos-done-close:hover { background: var(--destructive-bg) !important; color: var(--destructive) !important; }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          width: 480,
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)' }}>
          <span
            aria-hidden
            style={{
              width: 40, height: 40, flexShrink: 0, borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--success-bg)', color: 'var(--success)',
            }}
          >
            <Check size={22} strokeWidth={2.6} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--foreground)' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', marginTop: 1 }}>
              {receipt.invoiceNo || 'Order'} · {receipt.date} {receipt.time}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close (Enter)"
            className="pos-done-close"
            onClick={onNewTransaction}
            style={{
              width: 32, height: 32, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--foreground-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Change — the number the cashier needs most */}
        {!isOnline && (
          <div
            style={{
              margin: '22px 32px 0',
              padding: '16px 18px',
              borderRadius: 'var(--radius-md)',
              background: change > 0 ? 'var(--success-bg)' : 'var(--surface)',
              border: `1px solid ${change > 0 ? 'transparent' : 'var(--border)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: change > 0 ? 'var(--success)' : 'var(--foreground)' }}>Change</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: change > 0 ? 'var(--success)' : 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(change)}
            </span>
          </div>
        )}

        {/* Summary */}
        <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {row('Total', formatCurrency(receipt.totalAmount), true)}
          {receipt.discountAmount > 0 && row('Discount', `- ${formatCurrency(receipt.discountAmount)}`)}
          {(receipt.taxAmount ?? 0) > 0 &&
            row(receipt.taxIncluded ? 'PPN (included)' : 'PPN', formatCurrency(receipt.taxAmount ?? 0))}
          {!isOnline &&
            receipt.payments.map((p, i) => (
              <React.Fragment key={`${p.method}-${i}`}>{row(p.method, formatCurrency(p.amount))}</React.Fragment>
            ))}
          {!isOnline && receipt.payments.length <= 1 && tendered > 0 && tendered !== receipt.payments[0]?.amount &&
            row('Cash received', formatCurrency(tendered))}
          {isPartial && row('Remaining balance', formatCurrency(remaining), true)}
          {receipt.customerName && row('Customer', receipt.customerName)}
          {row('Cashier', receipt.cashierName)}
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--foreground)',
              padding: '16px 0 8px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>Items</span>
            <span style={{ fontWeight: 400, color: 'var(--foreground-subtle)' }}>
              {receipt.items.length} item · {fmtQty(totalQty)} qty
            </span>
          </div>
          {receipt.items.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '5px 0' }}
            >
              <span style={{ color: 'var(--foreground)', minWidth: 0 }}>
                <span style={{ color: 'var(--foreground-muted)' }}>{fmtQty(item.qty)}×</span> {item.name}
              </span>
              <span style={{ color: 'var(--foreground)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: '18px 32px 26px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--foreground-subtle)', textAlign: 'center' }}>
            {printedCount > 0
              ? `Receipt printed ${printedCount}×`
              : printerConnected
                ? 'Printer connected'
                : 'USB printer not connected — prints through the browser dialog'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onPrint}
              disabled={isPrinting}
              className="pos-done-btn"
              data-tone="secondary"
              style={{
                flex: 1,
                height: 46,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--foreground)',
                cursor: isPrinting ? 'wait' : 'pointer',
                opacity: isPrinting ? 0.7 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Printer size={16} />
              {isPrinting ? 'Printing…' : printedCount > 0 ? 'Reprint' : 'Print Receipt'}
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>(P)</span>
            </button>
            <button
              type="button"
              onClick={onNewTransaction}
              className="pos-done-btn"
              data-tone="hold"
              style={{
                flex: 1,
                height: 46,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                // Same look as the cart's Hold Order button.
                background: 'var(--accent-light-bg)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Close
              <span style={{ fontSize: 11, opacity: 0.75 }}>(Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
