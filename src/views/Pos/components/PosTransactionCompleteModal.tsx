'use client'

import React, { useEffect } from 'react'
import { CheckCircle2, Printer, Plus } from 'lucide-react'
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
 * can (re)print the receipt, and only clears the screen with "Transaksi Baru".
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

  const { receipt, tendered, change, isOnline, isPartial, remaining, printedCount } = transaction
  const totalQty = receipt.items.reduce((s, i) => s + Number(i.qty || 0), 0)

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 15 : 13 }}>
      <span style={{ color: 'var(--foreground-muted)' }}>{label}</span>
      <span style={{ color: 'var(--foreground)', fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transaksi Selesai"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          width: 460,
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Success header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <CheckCircle2 size={44} style={{ color: 'var(--success)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--foreground)', margin: '8px 0 2px' }}>
            {isOnline ? 'Order Online Dibuat' : isPartial ? 'DP Diterima' : 'Pembayaran Berhasil'}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            {receipt.invoiceNo || 'Order'} · {receipt.date} {receipt.time}
          </div>
        </div>

        {/* Change — the number the cashier needs most */}
        {!isOnline && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
              background: change > 0 ? 'var(--success-bg)' : 'var(--background)',
              border: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: change > 0 ? 'var(--success)' : 'var(--foreground-muted)' }}>
              Kembalian
            </span>
            <span style={{ fontSize: 28, fontWeight: 800, color: change > 0 ? 'var(--success)' : 'var(--foreground)' }}>
              {formatCurrency(change)}
            </span>
          </div>
        )}

        {/* Summary */}
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {row('Total', formatCurrency(receipt.totalAmount), true)}
          {receipt.discountAmount > 0 && row('Diskon', `- ${formatCurrency(receipt.discountAmount)}`)}
          {!isOnline &&
            receipt.payments.map((p, i) => (
              <React.Fragment key={`${p.method}-${i}`}>{row(p.method, formatCurrency(p.amount))}</React.Fragment>
            ))}
          {!isOnline && receipt.payments.length <= 1 && tendered > 0 && tendered !== receipt.payments[0]?.amount &&
            row('Uang diterima', formatCurrency(tendered))}
          {isPartial && row('Sisa tagihan', formatCurrency(remaining), true)}
          {receipt.customerName && row('Customer', receipt.customerName)}
          {row('Kasir', receipt.cashierName)}
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 12px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--foreground-subtle)',
              padding: '8px 0',
              borderTop: '1px solid var(--border)',
            }}
          >
            {receipt.items.length} item · {fmtQty(totalQty)} qty
          </div>
          {receipt.items.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0' }}
            >
              <span style={{ color: 'var(--foreground)' }}>
                <strong>{fmtQty(item.qty)}×</strong> {item.name}
              </span>
              <span style={{ color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', textAlign: 'center' }}>
            {printedCount > 0
              ? `Struk sudah dicetak ${printedCount}×`
              : printerConnected
                ? 'Printer terhubung'
                : 'Printer USB tidak terhubung — cetak lewat dialog browser'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onPrint}
              disabled={isPrinting}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong, var(--border))',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--foreground)',
                cursor: isPrinting ? 'not-allowed' : 'pointer',
                opacity: isPrinting ? 0.7 : 1,
              }}
            >
              <Printer size={16} />
              {isPrinting ? 'Mencetak...' : printedCount > 0 ? 'Cetak Ulang' : 'Cetak Struk'}
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>(P)</span>
            </button>
            <button
              type="button"
              onClick={onNewTransaction}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 700,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              Transaksi Baru
              <span style={{ fontSize: 11, opacity: 0.8 }}>(Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
