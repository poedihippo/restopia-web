import React, { useEffect,  useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { ReceiptData } from '@/components/PosReceipt'
import PosPreordersModal from './PosPreordersModal'
import PosHistoryModal from './PosHistoryModal'
import { formatCurrency } from '@/utils/price';
import SearchableSelect from '@/components/SearchableSelect'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { parseNumberId } from '@/utils/numberFormat'

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
  isSplitPayment?: boolean
  setIsSplitPayment?: (val: boolean) => void
  splitPayments?: Array<{ paymentMethodId: number, amount: number, cashTendered?: string, creditByUserId?: number | null }>
  setSplitPayments?: (val: Array<{ paymentMethodId: number, amount: number, cashTendered?: string, creditByUserId?: number | null }>) => void
  paymentMethods: any[]
  selectedMethod: any
  quickAmounts: number[]
  change: number
  handleConfirmPayment: () => void
  isPending: boolean
  isCreditMethod: boolean
  creditByUserId: number | null
  setCreditByUserId: (val: number | null) => void
  creditUsers: any[]
  receiptData: any
  resetCart: () => void
  printReceipt: ReceiptData | null
  triggerPrint: (receipt: ReceiptData) => void

  salesChannelId: number | null
  setSalesChannelId: (val: number | null) => void
  salesChannels: any[]

  // Preorders
  preorderSearch: string
  setPreorderSearch: (val: string) => void
  preorderDateFrom: string
  setPreorderDateFrom: (val: string) => void
  preorderDateTo: string
  setPreorderDateTo: (val: string) => void
  preorderPage: number
  setPreorderPage: (val: number | ((prev: number) => number)) => void
  preorders: any[]
  preorderMeta: any
  isPreordersLoading: boolean
  loadPreorderToCart: (order: any) => void

  // History
  historySearch: string
  setHistorySearch: (val: string) => void
  historyDateFrom: string
  setHistoryDateFrom: (val: string) => void
  historyDateTo: string
  setHistoryDateTo: (val: string) => void
  historyPage: number
  setHistoryPage: (val: number | ((prev: number) => number)) => void
  historyOrders: any[]
  historyMeta: any
  isHistoryLoading: boolean
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
  isSplitPayment = false,
  setIsSplitPayment,
  splitPayments = [],
  setSplitPayments,
  paymentMethods,
  selectedMethod,
  quickAmounts,
  change,
  handleConfirmPayment,
  isCreditMethod,
  creditByUserId,
  setCreditByUserId,
  creditUsers,
  isPending,
  receiptData,
  resetCart,
  printReceipt,
  triggerPrint,
  salesChannelId,
  setSalesChannelId,
  salesChannels,

  preorderSearch,
  setPreorderSearch,
  preorderDateFrom,
  setPreorderDateFrom,
  preorderDateTo,
  setPreorderDateTo,
  preorderPage,
  setPreorderPage,
  preorders,
  preorderMeta,
  isPreordersLoading,
  loadPreorderToCart,

  historySearch,
  setHistorySearch,
  historyDateFrom,
  setHistoryDateFrom,
  historyDateTo,
  setHistoryDateTo,
  historyPage,
  setHistoryPage,
  historyOrders,
  historyMeta,
  isHistoryLoading,
}: PosModalsProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const [splitMethodId, setSplitMethodId] = React.useState<number | null>(null)
  const [splitAmount, setSplitAmount] = React.useState<string>('')
  
  const remainingSplitBalance = React.useMemo(() => {
    const paid = (splitPayments || []).reduce((sum, p) => sum + p.amount, 0)
    return Math.max(0, total - paid)
  }, [total, splitPayments])

  React.useEffect(() => {
    if (remainingSplitBalance > 0 && !splitAmount) {
      setSplitAmount(remainingSplitBalance.toString())
    }
  }, [remainingSplitBalance, splitAmount])

  const canConfirm = isSplitPayment 
    ? remainingSplitBalance === 0 
    : (paymentMethodId !== null && (!isCreditMethod || creditByUserId !== null))

  const handleAddSplit = () => {
    if (!splitMethodId) return toast.error('Select payment method')
    const amt = Number(splitAmount.replace(/\D/g, ''))
    if (amt <= 0) return toast.error('Enter a valid amount')
    
    const method = paymentMethods.find((pm: any) => pm.id === splitMethodId)
    const isCredit = method?.name?.toLowerCase().includes('credit')
    
    if (isCredit && !creditByUserId) return toast.error('Select credit user')
    
    if (setSplitPayments && splitPayments) {
      setSplitPayments([...splitPayments, {
        paymentMethodId: splitMethodId,
        amount: amt,
        creditByUserId: isCredit ? creditByUserId : null
      }])
    }
    setSplitMethodId(null)
    setSplitAmount('')
  }

  const handleRemoveSplit = (index: number) => {

    if (setSplitPayments && splitPayments) {
      const updated = [...splitPayments]
      updated.splice(index, 1)
      setSplitPayments(updated)
    }
  }

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
                {formatCurrency(total)}
              </span>
            </div>

            {/* Sales Channel (Required) */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Sales Channel <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                value={salesChannelId || ''}
                onChange={(e) => setSalesChannelId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--background)',
                }}
              >
                <option value="">Select sales channel...</option>
                {salesChannels.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Split Payment Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                id="split-payment"
                checked={isSplitPayment}
                onChange={(e) => setIsSplitPayment?.(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <label htmlFor="split-payment" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Split Payment (Multiple Methods)
              </label>
            </div>

            {isSplitPayment ? (
              <div style={{ marginBottom: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Added Payments</h4>
                {splitPayments.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--foreground-muted)', fontStyle: 'italic', marginBottom: 12 }}>
                    No payments added yet.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0' }}>
                    {splitPayments.map((sp, idx) => {
                      const method = paymentMethods.find(pm => pm.id === sp.paymentMethodId)
                      const user = creditUsers.find(u => u.id === sp.creditByUserId)
                      return (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                          <span style={{ fontSize: 13 }}>
                            {method?.name} {user ? `(Credit: ${user.name})` : ''}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{formatCurrency(sp.amount)}</span>
                            <button
                              onClick={() => handleRemoveSplit(idx)}
                              style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer', fontSize: 16, padding: 0 }}
                            >×</button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: remainingSplitBalance === 0 ? 'var(--success-bg)' : 'var(--accent-light-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 13, color: remainingSplitBalance === 0 ? 'var(--success)' : 'var(--accent)' }}>Remaining Balance</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: remainingSplitBalance === 0 ? 'var(--success)' : 'var(--accent)' }}>{formatCurrency(remainingSplitBalance)}</span>
                </div>

                {remainingSplitBalance > 0 && (
                  <div style={{ background: 'var(--background)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add Payment</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Method</label>
                        <select
                          value={splitMethodId ?? ''}
                          onChange={(e) => {
                            setSplitMethodId(e.target.value ? Number(e.target.value) : null)
                            setCreditByUserId(null)
                            setSplitAmount(remainingSplitBalance.toString())
                          }}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                        >
                          <option value="">Select...</option>
                          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Amount</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={splitAmount ? formatCurrency(Number(splitAmount.replace(/\D/g, ''))) : ''}
                          onChange={(e) => setSplitAmount(e.target.value.replace(/\D/g, ''))}
                          disabled={Boolean(splitMethodId && paymentMethods.find(pm => pm.id === splitMethodId)?.name?.toLowerCase().includes('credit'))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            background: splitMethodId && paymentMethods.find(pm => pm.id === splitMethodId)?.name?.toLowerCase().includes('credit') ? 'var(--surface)' : 'var(--background)',
                            opacity: splitMethodId && paymentMethods.find(pm => pm.id === splitMethodId)?.name?.toLowerCase().includes('credit') ? 0.7 : 1,
                            cursor: splitMethodId && paymentMethods.find(pm => pm.id === splitMethodId)?.name?.toLowerCase().includes('credit') ? 'not-allowed' : 'text'
                          }}
                        />
                      </div>
                    </div>
                    {splitMethodId && paymentMethods.find(pm => pm.id === splitMethodId)?.name?.toLowerCase().includes('credit') && (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Credit User</label>
                        <SearchableSelect
                          value={creditByUserId ?? 0}
                          onChange={(v) => {
                            const val = v > 0 ? v : null
                            setCreditByUserId(val)
                            if (val) {
                              const user = creditUsers.find((u: any) => u.id === val)
                              if (user) {
                                const userCredit = Number(user.credit ?? 0)
                                const amountToUse = Math.min(userCredit, remainingSplitBalance)
                                setSplitAmount(amountToUse.toString())
                              }
                            } else {
                              setSplitAmount(remainingSplitBalance.toString())
                            }
                          }}
                          options={[
                            { value: 0, label: 'Select user...' },
                            ...creditUsers.map((u: any) => ({
                              value: u.id as number,
                              label: (u.name as string) ?? '',
                              sublabel: u.credit
                                ? 'Credit: Rp ' +
                                Number(u.credit ?? 0).toLocaleString('id-ID')
                                : 'No credit set',
                            })),
                          ]}
                          placeholder="Search user..."
                          searchPlaceholder="Search users..."
                          onSearchChange={setDropdownSearch}
/>
                      </div>
                    )}
                    <button
                      onClick={handleAddSplit}
                      style={{ width: '100%', padding: '8px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add to Split
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                }}
              >
                {paymentMethods.map((pm: any) => {
                  const isSelected = paymentMethodId === pm.id
                  const typeLabel =
                    pm.type === 'sales_orders'
                      ? 'Sales'
                      : pm.type === 'purchase_orders'
                        ? 'Purchase'
                        : 'All'
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethodId(pm.id)
                        setCashTendered('')
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        gap: 3,
                        padding: '10px 12px',
                        minHeight: 56,
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--accent-light-bg)' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {pm.name}
                        </span>
                        {isSelected && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 99,
                              background: 'var(--accent)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          color: isSelected
                            ? 'var(--accent)'
                            : 'var(--foreground-muted)',
                        }}
                      >
                        {typeLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {isCreditMethod && paymentMethodId && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  Credit User <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <SearchableSelect
                  value={creditByUserId ?? 0}
                  onChange={(v) => setCreditByUserId(v > 0 ? v : null)}
                  options={[
                    { value: 0, label: 'Select user...' },
                    ...creditUsers.map((u: any) => ({
                      value: u.id as number,
                      label: (u.name as string) ?? '',
                      sublabel: u.credit
                        ? 'Credit: Rp ' +
                        Number(u.credit ?? 0).toLocaleString('id-ID')
                        : 'No credit set',
                    })),
                  ]}
                  placeholder="Search user..."
                  searchPlaceholder="Search users..."
                  onSearchChange={setDropdownSearch}
/>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--warning)',
                    display: 'block',
                    marginTop: 6,
                  }}
                >
                  ⚠ Select the user whose credit will be used for this transaction.
                </span>
              </div>
            )}

            {!isCashMethod && !isCreditMethod && paymentMethodId && (
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
                Confirm receipt of {formatCurrency(total)} via {selectedMethod?.name}.
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
                  <LocalizedNumberInput
                    value={parseNumberId(cashTendered)}
                    onChange={(val) => setCashTendered(String(Math.round(val)))}
                    decimals={0}
                    placeholder="Enter amount..."
                    style={{
                      width: '100%',
                      height: 44,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 14px',
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      background: 'var(--surface-raised)',
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
                      {formatCurrency(amt)}
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
                      {formatCurrency(change)}
                    </span>
                  </div>
                )}
              </>
            )}
              </>
            )}

            {/* Confirm button */}
            <button
              type="button"
              onClick={() => {
                // Pre-check logic moved to button interaction
                if (!salesChannelId) {
                  toast.error('Please select a sales channel')
                  return
                }
                
                if (isSplitPayment) {
                  if (remainingSplitBalance > 0) {
                    toast.error('Payment does not cover total due')
                    return
                  }
                } else {
                  if (!paymentMethodId) {
                    toast.error('Select a payment method')
                    return
                  }
                  if (isCreditMethod && !creditByUserId) {
                    toast.error('Please select a credit user')
                    return
                  }
                  if (
                    isCashMethod &&
                    Number(cashTendered.replace(/\D/g, '')) < total
                  ) {
                    toast.error('Cash tendered is less than total')
                    return
                  }
                }
                setShowPayment(false)
                handleConfirmPayment()
              }}
              disabled={isPending || !salesChannelId || (isSplitPayment && remainingSplitBalance > 0)}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: (isPending || !salesChannelId || (isSplitPayment && remainingSplitBalance > 0)) ? 'var(--foreground-subtle)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
                fontWeight: 700,
                cursor: (isPending || !salesChannelId || (isSplitPayment && remainingSplitBalance > 0)) ? 'not-allowed' : 'pointer',
                opacity: (isPending || !salesChannelId || (isSplitPayment && remainingSplitBalance > 0)) ? 0.7 : 1,
              }}
            >
              {isPending ? 'Processing...' : (!salesChannelId ? 'Select Sales Channel' : 'Confirm Payment')}
            </button>
          </div>
        </div>
      )}

      <PosPreordersModal
        showPreorders={showPreorders}
        setShowPreorders={setShowPreorders}
        preorderSearch={preorderSearch}
        setPreorderSearch={setPreorderSearch}
        preorderDateFrom={preorderDateFrom}
        setPreorderDateFrom={setPreorderDateFrom}
        preorderPage={preorderPage}
        setPreorderPage={setPreorderPage}
        preorders={preorders}
        preorderMeta={preorderMeta}
        isPreordersLoading={isPreordersLoading}
        loadPreorderToCart={loadPreorderToCart}
      />

      <PosHistoryModal
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        historySearch={historySearch}
        setHistorySearch={setHistorySearch}
        historyDateFrom={historyDateFrom}
        setHistoryDateFrom={setHistoryDateFrom}
        historyDateTo={historyDateTo}
        setHistoryDateTo={setHistoryDateTo}
        historyPage={historyPage}
        setHistoryPage={setHistoryPage}
        historyOrders={historyOrders}
        historyMeta={historyMeta}
        isHistoryLoading={isHistoryLoading}
      />
    </>
  )
}
