import React from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { ReceiptData } from '@/components/PosReceipt'

interface PosModalsProps {
  showPayment: boolean
  setShowPayment: (val: boolean) => void
  showReceipt: boolean
  setShowReceipt: (val: boolean) => void
  showPreorder: boolean
  setShowPreorder: (val: boolean) => void
  showPreorders: boolean
  setShowPreorders: (val: boolean) => void
  showHistory: boolean
  setShowHistory: (val: boolean) => void
  
  total: number
  isCashMethod: boolean
  paymentMethodId: number | null
  setPaymentMethodId: (val: number | null) => void
  cashTendered: string
  setCashTendered: (val: string) => void
  paymentMethods: any[]
  selectedMethod: any
  quickAmounts: number[]
  change: number
  handleConfirmPayment: () => void
  isPending: boolean
  receiptData: any
  resetCart: () => void
  printReceipt: ReceiptData | null
  triggerPrint: (receipt: ReceiptData) => void

  // ... preorder and history props ...
  // For the sake of learning, you can fill the rest of the modal logic here
  // or split them further into PosPaymentModal.tsx, PosReceiptModal.tsx, etc.
}

export default function PosModals({
  showPayment,
  setShowPayment,
  showReceipt,
  setShowReceipt,
  showPreorder,
  setShowPreorder,
  showPreorders,
  setShowPreorders,
  showHistory,
  setShowHistory,
  
  total,
  isCashMethod,
  paymentMethodId,
  setPaymentMethodId,
  cashTendered,
  setCashTendered,
  paymentMethods,
  selectedMethod,
  quickAmounts,
  change,
  handleConfirmPayment,
  isPending,
  receiptData,
  resetCart,
  printReceipt,
  triggerPrint,
}: PosModalsProps) {
  
  return (
    <>
      {showPayment && !showReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 380,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  color: 'var(--accent)',
                  margin: 0,
                }}
              >
                Payment
              </h2>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}
              >
                ×
              </button>
            </div>

            {/* Total due */}
            <div
              style={{
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Total Due</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                Rp {total.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Payment method selection */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Payment Method
              </label>
              {paymentMethods.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--destructive)' }}>
                  No payment methods found. Add one in Settings first.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {paymentMethods.map((pm: any) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethodId(pm.id)
                      setCashTendered('')
                    }}
                    style={{
                      flex: '1 1 auto',
                      height: 42,
                      border: '1px solid',
                      borderColor: paymentMethodId === pm.id ? 'var(--accent)' : 'var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: paymentMethodId === pm.id ? 'var(--accent)' : 'var(--surface)',
                      color: paymentMethodId === pm.id ? 'white' : 'var(--foreground)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {pm.name}
                  </button>
                ))}
              </div>
            </div>

            {!isCashMethod && paymentMethodId && (
              <div
                style={{
                  background: 'var(--info-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: 13,
                  color: 'var(--info)',
                }}
              >
                Confirm receipt of Rp {total.toLocaleString('id-ID')} via {selectedMethod?.name}.
              </div>
            )}

            {/* Cash tendered section */}
            {isCashMethod && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Cash Tendered
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter amount..."
                    value={
                      cashTendered
                        ? `Rp ${Number(cashTendered.replace(/\D/g, '')).toLocaleString('id-ID')}`
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setCashTendered(raw)
                    }}
                    style={{
                      width: '100%',
                      height: 44,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 14px',
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      background: 'var(--surface)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Quick amount buttons */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered(String(amt))}
                      style={{
                        flex: '1 1 auto',
                        height: 34,
                        fontSize: 12,
                        fontWeight: 500,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          cashTendered === String(amt)
                            ? 'var(--accent-light-bg)'
                            : 'var(--background)',
                        color: 'var(--foreground)',
                        cursor: 'pointer',
                      }}
                    >
                      Rp {amt.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>

                {/* Change */}
                {Number(cashTendered) >= total && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--success-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 16px',
                      marginBottom: 20,
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 500 }}>
                      Change
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                      Rp {change.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Confirm button */}
            <button
              type="button"
              onClick={() => {
                if (!paymentMethodId) {
                  toast.error('Select a payment method')
                  return
                }
                if (
                  isCashMethod &&
                  Number(cashTendered.replace(/\D/g, '')) < total
                ) {
                  toast.error('Cash tendered is less than total')
                  return
                }
                setShowPayment(false)
                handleConfirmPayment()
              }}
              disabled={isPending}
              style={{
                width: '100%',
                height: 48,
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
                fontWeight: 700,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Adding other modals similarly... */}
      {/* For learning purpose, leaving out History and Pre-order as TODOs */}
    </>
  )
}
