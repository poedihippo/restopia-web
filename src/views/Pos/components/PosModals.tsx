import React, { useEffect,  useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check, X } from 'lucide-react'
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
  /** Returns to the order review step (customer, voucher, note). */
  onBackToReview?: () => void
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
  /** Tender/change 422 from the server, shown above the confirm button. */
  paymentError?: string | null
  setCashTendered: (val: string) => void
  isSplitPayment?: boolean
  setIsSplitPayment?: (val: boolean) => void
  splitPayments?: Array<{ paymentMethodId: number, amount: number, cashTendered?: string, creditByUserId?: number | null }>
  setSplitPayments?: (val: Array<{ paymentMethodId: number, amount: number, cashTendered?: string, creditByUserId?: number | null }>) => void
  paymentMode?: 'full' | 'partial'
  setPaymentMode?: (val: 'full' | 'partial') => void
  partialAmount?: string
  setPartialAmount?: (val: string) => void
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
  /** Server-side search for the credit-user picker. */
  setCreditUserSearch?: (val: string) => void
  creditType?: 'user' | 'customer'
  setCreditType?: (val: 'user' | 'customer') => void
  /** Kredit Customer picked in the credit section (no tender, or a DP). */
  customerCredit?: boolean
  setCustomerCredit?: (val: boolean) => void
  selectedCustomerId?: number | null
  /** Picked customer OR typed name — both satisfy customer credit. */
  manualCustomerName?: string
  /** Manual customer fields — shared with the cart sidebar. */
  guestName?: string
  setGuestName?: (val: string) => void
  guestPhone?: string
  setGuestPhone?: (val: string) => void
  /** Name of the customer picked in the cart sidebar. */
  customerSearch?: string
  setCustomerSearch?: (val: string) => void
  clearSelectedCustomer?: () => void
  setSelectedCustomerId?: (val: number | null) => void
  customers?: any[]
  showCustomerDropdown?: boolean
  setShowCustomerDropdown?: (val: boolean) => void
  receiptData: any
  resetCart: () => void
  printReceipt: ReceiptData | null
  triggerPrint: (receipt: ReceiptData) => void

  salesChannelId: number | null
  /** Online (marketplace) orders are paid out later — no tenders at checkout. */
  orderType?: 'offline' | 'online'
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
  onBackToReview,
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
  paymentError,
  setCashTendered,
  isSplitPayment = false,
  setIsSplitPayment,
  splitPayments = [],
  setSplitPayments,
  paymentMode = 'full',
  setPaymentMode,
  partialAmount = '',
  setPartialAmount,
  paymentMethods,
  selectedMethod,
  quickAmounts,
  change,
  handleConfirmPayment,
  isCreditMethod,
  creditByUserId,
  setCreditByUserId,
  creditUsers,
  setCreditUserSearch,
  creditType = 'user',
  setCreditType,
  customerCredit = false,
  setCustomerCredit = () => {},
  selectedCustomerId = null,
  manualCustomerName = '',
  guestName = '',
  setGuestName = () => {},
  guestPhone = '',
  setGuestPhone = () => {},
  customerSearch = '',
  setCustomerSearch = () => {},
  clearSelectedCustomer,
  setSelectedCustomerId = () => {},
  customers = [],
  showCustomerDropdown = false,
  setShowCustomerDropdown = () => {},
  isPending,
  receiptData,
  resetCart,
  printReceipt,
  triggerPrint,
  salesChannelId,
  setSalesChannelId,
  salesChannels,
  orderType = 'offline',

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

  const [splitMethodId, setSplitMethodId] = React.useState<number | null>(null)
  const [splitAmount, setSplitAmount] = React.useState<string>('')
  // The split row being typed belongs to the open payment: clear it when the
  // payment closes or the split list is reset (new order).
  React.useEffect(() => {
    if (!showPayment || !isSplitPayment || (splitPayments ?? []).length === 0) {
      setSplitMethodId(null)
      setSplitAmount('')
    }
  }, [showPayment, isSplitPayment, splitPayments])

  const customerFieldLabel: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--foreground-muted)',
    display: 'block',
    marginBottom: 6,
  }
  const customerFieldInput: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }
  const customerDropdownBox: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    zIndex: 60,
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--foreground-muted)',
    boxShadow: 'var(--shadow-md)',
  }
  const customerDropdownItem: React.CSSProperties = {
    padding: '9px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
    color: 'var(--foreground)',
  }

  // Registered-customer search lives in this modal (the cart sidebar no longer
  // shows customer/guest fields).
  const customerDropdownRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [setShowCustomerDropdown])

  const pickRegisteredCustomer = (c: any) => {
    setSelectedCustomerId(Number(c.id))
    setCustomerSearch(String(c.name ?? ''))
    setGuestName('')
    setShowCustomerDropdown(false)
  }
  
  const remainingSplitBalance = React.useMemo(() => {
    const paid = (splitPayments || []).reduce((sum, p) => sum + p.amount, 0)
    return Math.max(0, total - paid)
  }, [total, splitPayments])

  React.useEffect(() => {
    if (remainingSplitBalance > 0 && !splitAmount) {
      setSplitAmount(remainingSplitBalance.toString())
    }
  }, [remainingSplitBalance, splitAmount])

  // Customer credit needs a real customer: a registered one, or a typed name +
  // phone (the POS registers it — the API requires a phone for a new customer).
  const hasCustomerForCredit = !!(
    (selectedCustomerId && selectedCustomerId > 0) ||
    (manualCustomerName.trim() && guestPhone.trim())
  )

  const isOnline = orderType === 'online'
  // Credit has its own section; the method grid only lists money tenders.
  const creditMethod = paymentMethods.find((pm: any) => pm.name?.toLowerCase().includes('credit'))
  const moneyMethods = paymentMethods.filter((pm: any) => pm !== creditMethod)
  const staffCreditPicked = isCreditMethod && !customerCredit
  // "Bayar dengan Kredit" vs "Bayar Langsung". Kredit Customer exists only on
  // the DP tab (pay part now — or 0 — and the rest later); Kredit Karyawan on both.
  const [payWithCredit, setPayWithCredit] = React.useState(false)
  React.useEffect(() => {
    if (staffCreditPicked || customerCredit) setPayWithCredit(true)
  }, [staffCreditPicked, customerCredit])
  React.useEffect(() => {
    if (!showPayment) setPayWithCredit(false)
  }, [showPayment])
  const dpValue = Number(partialAmount.replace(/\D/g, '')) || 0
  const creditNoDp = customerCredit && dpValue === 0
  const pickStaffCredit = () => {
    if (staffCreditPicked) {
      setPaymentMethodId(null)
      return
    }
    if (!creditMethod) return toast.error('Credit payment method not found')
    setCustomerCredit(false)
    setCreditType?.('user')
    setPaymentMethodId(creditMethod.id)
    setCashTendered('')
  }
  const choosePayNow = () => {
    setPayWithCredit(false)
    if (customerCredit) {
      setCustomerCredit(false)
      setCreditType?.('user')
    }
    if (isCreditMethod) setPaymentMethodId(null)
  }
  const choosePayWithCredit = () => {
    setPayWithCredit(true)
    if (!isCreditMethod) setPaymentMethodId(null)
    setCashTendered('')
    // Full Payment only offers Kredit Karyawan: pick it straight away.
    if (paymentMode !== 'partial' && !staffCreditPicked && creditMethod) {
      setCustomerCredit(false)
      setCreditType?.('user')
      setPaymentMethodId(creditMethod.id)
    }
  }
  // Back on Full Payment, Kredit Customer no longer applies.
  React.useEffect(() => {
    if (paymentMode !== 'partial' && customerCredit) {
      setCustomerCredit(false)
      setCreditType?.('user')
    }
  }, [paymentMode, customerCredit, setCustomerCredit, setCreditType])
  const pickCustomerCredit = () => {
    if (customerCredit) {
      setCustomerCredit(false)
      setCreditType?.('user')
      return
    }
    setCustomerCredit(true)
    setCreditType?.('customer')
    setCreditByUserId(null)
    setPaymentMethodId(null)
  }
  const selectedChannelName =
    salesChannels.find((c: any) => c.id === salesChannelId)?.name ?? 'marketplace'

  // Staff credit draws on users.credit: the amount charged to it (the total, or
  // the DP amount) can't exceed the user's balance — the API refuses it too
  // ("Insufficient credit"). Users are cached by id so a search that filters the
  // picked user out of the list does not lose its balance.
  const seenCreditUsersRef = React.useRef(new Map<number, any>())
  for (const u of creditUsers) seenCreditUsersRef.current.set(Number(u.id), u)
  const creditBalanceOf = (userId: number | null | undefined) =>
    userId ? Number(seenCreditUsersRef.current.get(Number(userId))?.credit ?? 0) : 0
  const creditCharge = paymentMode === 'partial' ? Number(partialAmount.replace(/\D/g, '')) || 0 : total
  const creditBalance = creditBalanceOf(creditByUserId)
  const creditShort =
    !isOnline && !isSplitPayment && isCreditMethod && creditType === 'user' &&
    creditByUserId !== null && creditCharge > creditBalance

  const canConfirm = isOnline
    ? true
    : isSplitPayment
    ? remainingSplitBalance === 0
    : customerCredit
    ? hasCustomerForCredit && paymentMode === 'partial' && dpValue < total &&
      (dpValue === 0 || (paymentMethodId !== null && !isCreditMethod))
    : (paymentMethodId !== null &&
       (!isCreditMethod ||
         (creditType === 'customer'
           ? hasCustomerForCredit
           : creditByUserId !== null)) &&
       (paymentMode !== 'partial' || (Number(partialAmount.replace(/\D/g, '')) > 0 && Number(partialAmount.replace(/\D/g, '')) < total)) &&
       !creditShort)

  const handleAddSplit = () => {
    if (!splitMethodId) return toast.error('Select payment method')
    const amt = Number(splitAmount.replace(/\D/g, ''))
    if (amt <= 0) return toast.error('Enter a valid amount')
    
    const method = paymentMethods.find((pm: any) => pm.id === splitMethodId)
    const isCredit = method?.name?.toLowerCase().includes('credit')
    
    if (isCredit && !creditByUserId) return toast.error('Select credit user')
    if (isCredit) {
      // The same user's credit across every split line can't exceed the balance.
      const alreadyUsed = (splitPayments || [])
        .filter((p) => p.creditByUserId === creditByUserId)
        .reduce((sum, p) => sum + p.amount, 0)
      const balance = creditBalanceOf(creditByUserId)
      if (alreadyUsed + amt > balance) {
        return toast.error(`Kredit tidak cukup: sisa Rp ${Math.max(0, balance - alreadyUsed).toLocaleString('id-ID')}`)
      }
    }
    
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
            background: 'rgba(17, 17, 20, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <style>{`
            .pos-pay-seg, .pos-pay-method, .pos-pay-secondary, .pos-pay-primary, .pos-pay-icon {
              transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
            }
            .pos-pay-seg[aria-checked="false"]:hover { background: var(--accent-light-bg) !important; color: var(--accent) !important; }
            .pos-pay-method[aria-checked="false"]:hover { border-color: var(--accent-light) !important; box-shadow: var(--shadow-sm); }
            .pos-pay-method:active { transform: scale(0.98); }
            .pos-pay-secondary:not(:disabled):hover { background: var(--accent-light-bg) !important; border-color: var(--accent-light) !important; color: var(--accent) !important; }
            .pos-pay-primary:not(:disabled):hover { background: var(--accent-hover) !important; box-shadow: var(--shadow-md); transform: translateY(-1px); }
            .pos-pay-primary:not(:disabled):active { transform: none; box-shadow: none; }
            .pos-pay-icon:hover { background: var(--destructive-bg) !important; color: var(--destructive) !important; }
          `}</style>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 28,
              width: 'min(400px, 100%)',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Payment
              </h2>
              <button
                type="button"
                aria-label="Close"
                className="pos-pay-icon"
                onClick={() => setShowPayment(false)}
                style={{
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Total due */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                {paymentMode === 'partial' ? 'Total (Full)' : 'Total'}
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(total)}
              </span>
            </div>
            {paymentMode === 'partial' && Number(partialAmount.replace(/\D/g, '')) > 0 && (
              <div
                style={{
                  background: 'var(--warning-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--warning)' }}>DP Amount</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>
                  {formatCurrency(Number(partialAmount.replace(/\D/g, '')))}
                </span>
              </div>
            )}

            {/* Payment Mode: Full vs Partial (DP) */}
            {!isOnline && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Payment Mode
              </label>
              <div
                role="radiogroup"
                aria-label="Payment mode"
                style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
              >
                {([['full', 'Full Payment'], ['partial', 'Down Payment (DP)']] as const).map(([mode, label], i) => {
                  const selected = paymentMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className="pos-pay-seg"
                      onClick={() => setPaymentMode?.(mode)}
                      style={{
                        flex: 1,
                        height: 40,
                        border: 'none',
                        borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                        background: selected ? 'var(--accent)' : 'var(--surface)',
                        color: selected ? '#fff' : 'var(--foreground-muted)',
                        fontSize: 13,
                        fontWeight: selected ? 600 : 500,
                        fontFamily: 'var(--font-sans)',
                        cursor: selected ? 'default' : 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {paymentMode === 'partial' && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                    DP Amount (must be less than {formatCurrency(total)}){customerCredit ? ' — boleh 0 untuk Kredit Customer' : ''}
                  </label>
                  <LocalizedNumberInput
                    value={partialAmount ? Number(partialAmount) : undefined}
                    onChange={(val) => setPartialAmount?.(val !== undefined && val !== null ? String(val) : '')}
                    decimals={2}
                    padDecimals={false}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            )}

            {/* Sales Channel (Required). An online order already picked it on the
                review step (needed for its voucher) — don't ask twice; "Back" changes it. */}
            {!(isOnline && salesChannelId) && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Sales Channel <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                value={salesChannelId || ''}
                onChange={(e) => setSalesChannelId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  fontSize: 13.5,
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
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
            )}

            {isOnline ? (
              <div
                style={{
                  background: 'var(--info-bg)',
                  color: 'var(--info)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Dibayar via {selectedChannelName}, menunggu pencairan. Pembayaran dicatat saat
                payout marketplace di-settle.
              </div>
            ) : (
            <>
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
                            {method && method === creditMethod ? 'Kredit Karyawan' : method?.name} {user ? `(${user.name})` : ''}
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
                          {/* Money tenders and credit are listed apart, as in the single-payment view. */}
                          <optgroup label="Metode Pembayaran">
                            {moneyMethods.map((pm: any) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          </optgroup>
                          {creditMethod && (
                            <optgroup label="Bayar Nanti (Kredit)">
                              <option value={creditMethod.id}>Kredit Karyawan</option>
                            </optgroup>
                          )}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Amount</label>
                        <LocalizedNumberInput
                          value={splitAmount ? Number(splitAmount) : undefined}
                          onChange={(val) => setSplitAmount(val !== undefined && val !== null ? String(val) : '')}
                          decimals={2}
                          padDecimals={false}
                          disabled={Boolean(splitMethodId && paymentMethods.find(pm => pm.id === splitMethodId)?.name?.toLowerCase().includes('credit'))}
                          placeholder="0"
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
                          onSearchChange={setCreditUserSearch}
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
            {/* Pay now (money tenders) or pay with credit — one or the other. */}
            <div role="tablist" aria-label="Cara bayar" style={{ display: 'flex', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3, marginBottom: 16 }}>
              {([
                { key: 'now', label: 'Bayar Langsung', active: !payWithCredit, onPick: choosePayNow },
                { key: 'credit', label: 'Bayar dengan Kredit', active: payWithCredit, onPick: choosePayWithCredit },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={t.active}
                  onClick={t.onPick}
                  style={{
                    flex: 1,
                    height: 34,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: t.active ? 'var(--surface)' : 'transparent',
                    color: t.active ? 'var(--foreground)' : 'var(--foreground-muted)',
                    boxShadow: t.active ? 'var(--shadow-sm)' : 'none',
                    fontSize: 13,
                    fontWeight: t.active ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {payWithCredit && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>Jenis Kredit</label>
                <div role="radiogroup" aria-label="Jenis kredit" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {([
                    { key: 'user', label: 'Kredit Karyawan', hint: 'Potong kredit karyawan', selected: staffCreditPicked, onPick: pickStaffCredit, show: true },
                    { key: 'customer', label: 'Kredit Customer', hint: 'DP sekarang (boleh 0), sisa nanti', selected: customerCredit, onPick: pickCustomerCredit, show: paymentMode === 'partial' },
                  ] as const).filter((o) => o.show).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={opt.selected}
                      onClick={opt.onPick}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        gap: 2,
                        padding: '8px 12px',
                        minHeight: 52,
                        border: '1px solid',
                        borderColor: opt.selected ? 'var(--accent)' : 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: opt.selected ? 'var(--accent-light-bg)' : 'var(--surface)',
                        color: opt.selected ? 'var(--accent)' : 'var(--foreground)',
                        boxShadow: opt.selected ? '0 0 0 1px var(--accent)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <span style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 13, fontWeight: 600 }}>
                        {opt.label}
                        {opt.selected && <Check size={14} />}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 400 }}>{opt.hint}</span>
                    </button>
                  ))}
                </div>
                {paymentMode !== 'partial' && (
                  <span style={{ fontSize: 11.5, color: 'var(--foreground-muted)', display: 'block', marginTop: 6 }}>
                    Kredit Customer tersedia di tab <b>Down Payment (DP)</b>.
                  </span>
                )}
              </div>
            )}

            {/* Money tenders: shown for "Bayar Langsung", or for a Kredit Customer DP. */}
            {payWithCredit && !(customerCredit && dpValue > 0) ? (
              customerCredit ? (
                <div style={{ marginBottom: 20, fontSize: 12.5, color: 'var(--foreground-muted)', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', padding: '10px 12px', lineHeight: 1.5 }}>
                  DP Rp 0 — tidak ada pembayaran sekarang, order disimpan sebagai <b>Kredit Customer</b> (Belum Dibayar). Isi DP bila customer membayar sebagian.
                </div>
              ) : null
            ) : (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                {customerCredit ? 'Metode untuk DP' : 'Payment Method'}
              </label>
              {moneyMethods.length === 0 && (
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
                {moneyMethods.map((pm: any) => {
                  const isSelected = paymentMethodId === pm.id
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className="pos-pay-method"
                      onClick={() => {
                        setPaymentMethodId(pm.id)
                        setCashTendered('')
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: '0 12px',
                        height: 46,
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--accent-light-bg)' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                        fontWeight: 600,
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        textAlign: 'left',
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
                            aria-hidden
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 99,
                              background: 'var(--accent)',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            )}

            {(staffCreditPicked || customerCredit) && (
              <div style={{ marginBottom: 16 }}>
                {staffCreditPicked && (
                  <>
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
                      onSearchChange={setCreditUserSearch}
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
                    {creditShort && (
                      <span style={{ fontSize: 12, color: 'var(--destructive)', display: 'block', marginTop: 6, lineHeight: 1.5 }}>
                        Kredit tidak cukup: sisa Rp {creditBalance.toLocaleString('id-ID')}, dibutuhkan Rp {creditCharge.toLocaleString('id-ID')}.
                        Gunakan <b>Down Payment (DP)</b> maksimal Rp {creditBalance.toLocaleString('id-ID')}, atau <b>Split Payment</b> dengan metode lain.
                      </span>
                    )}
                  </>
                )}
                {customerCredit && (
                  <div style={{ marginTop: 4 }}>
                    {selectedCustomerId ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--success-bg)',
                          color: 'var(--success)',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          ✓ {customerSearch?.trim() || 'Selected customer'} — customer credit applies to this customer.
                        </span>
                        {clearSelectedCustomer && (
                          <button
                            type="button"
                            title="Clear customer"
                            onClick={clearSelectedCustomer}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 16,
                              color: 'inherit',
                              padding: 0,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ position: 'relative' }} ref={customerDropdownRef}>
                          <label style={customerFieldLabel}>
                            Registered Customer <span style={{ color: 'var(--foreground-subtle)' }}>— optional</span>
                          </label>
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onFocus={() => setShowCustomerDropdown(true)}
                            placeholder="Search registered customer (min. 2 characters)..."
                            style={customerFieldInput}
                          />
                          {showCustomerDropdown &&
                            customerSearch.trim().length >= 2 &&
                            customers.length === 0 && (
                              <div style={customerDropdownBox}>No customers found</div>
                            )}
                          {showCustomerDropdown && customers.length > 0 && (
                            <div
                              style={{
                                ...customerDropdownBox,
                                padding: 0,
                                maxHeight: 180,
                                overflowY: 'auto',
                              }}
                            >
                              {customers.map((c: any) => (
                                <div
                                  key={c.id}
                                  onClick={() => pickRegisteredCustomer(c)}
                                  style={customerDropdownItem}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = 'var(--background)')
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = 'transparent')
                                  }
                                >
                                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                                  {c.phone && (
                                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                                      {c.phone}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <label style={{ ...customerFieldLabel, marginTop: 12 }}>
                          Customer Name <span style={{ color: 'var(--destructive)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g. Budi (GoFood order)"
                          style={customerFieldInput}
                        />
                        <label style={{ ...customerFieldLabel, marginTop: 10 }}>
                          Customer Phone{' '}
                          {customerCredit
                            ? <span style={{ color: 'var(--destructive)' }}>*</span>
                            : <span style={{ color: 'var(--foreground-subtle)' }}>— optional</span>}
                        </label>
                        <input
                          type="text"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="e.g. 081234567890"
                          style={customerFieldInput}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--foreground-muted)',
                            display: 'block',
                            marginTop: 8,
                          }}
                        >
                          Search a registered customer above, or type a name below — a customer
                          with the same name is reused, otherwise a new one is created automatically.
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* {!isCashMethod && !isCreditMethod && paymentMethodId && (
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
            )} */}

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
            </>
            )}

            {paymentError && (
              <div
                role="alert"
                style={{
                  marginBottom: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive-bg)',
                  color: 'var(--destructive)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {paymentError}
              </div>
            )}

            {/* Back + Confirm */}
            <div style={{ display: 'flex', gap: 10 }}>
            {onBackToReview && (
              <button
                type="button"
                onClick={onBackToReview}
                disabled={isPending}
                className="pos-pay-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 18px',
                  height: 48,
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // Pre-check logic moved to button interaction
                if (!salesChannelId) {
                  toast.error('Please select a sales channel')
                  return
                }

                if (isOnline) {
                  // no tenders for marketplace orders
                } else if (isSplitPayment) {
                  if (remainingSplitBalance > 0) {
                    toast.error('Payment does not cover total due')
                    return
                  }
                } else {
                  if (!paymentMethodId && !creditNoDp) {
                    toast.error(customerCredit ? 'Pilih metode untuk DP' : 'Select a payment method')
                    return
                  }
                  if (staffCreditPicked && !creditByUserId) {
                    toast.error('Please select a credit user')
                    return
                  }
                  if (customerCredit && !hasCustomerForCredit) {
                    toast.error('Pilih customer terdaftar, atau isi nama + no. HP customer untuk kredit customer')
                    return
                  }
                  if (paymentMode === 'partial') {
                    const dpAmt = Number(partialAmount.replace(/\D/g, ''))
                    if (dpAmt <= 0 && !customerCredit) {
                      toast.error('Enter a valid DP amount')
                      return
                    }
                    if (dpAmt >= total) {
                      toast.error('DP amount must be less than total')
                      return
                    }
                  }
                  if (
                    isCashMethod &&
                    paymentMode !== 'partial' &&
                    Number(cashTendered.replace(/\D/g, '')) < total
                  ) {
                    toast.error('Cash tendered is less than total')
                    return
                  }
                  if (
                    isCashMethod &&
                    paymentMode === 'partial' &&
                    Number(cashTendered.replace(/\D/g, '')) < Number(partialAmount.replace(/\D/g, ''))
                  ) {
                    toast.error('Cash tendered is less than DP amount')
                    return
                  }
                }
                setShowPayment(false)
                handleConfirmPayment()
              }}
              disabled={isPending || !salesChannelId || !canConfirm}
              className="pos-pay-primary"
              style={{
                flex: 1,
                height: 48,
                padding: '0 24px',
                background: (isPending || !salesChannelId || !canConfirm) ? 'var(--foreground-subtle)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: (isPending || !salesChannelId || !canConfirm) ? 'not-allowed' : 'pointer',
                opacity: (isPending || !salesChannelId || !canConfirm) ? 0.7 : 1,
              }}
            >
              {isPending
                ? 'Processing...'
                : !salesChannelId
                  ? 'Select Sales Channel'
                  : isOnline
                    ? 'Place Online Order'
                  : customerCredit && !hasCustomerForCredit
                    ? 'Enter Customer First'
                    : creditNoDp
                      ? 'Simpan Kredit Customer'
                    : isCreditMethod && creditType === 'user' && !creditByUserId
                      ? 'Select Credit User First'
                      : creditShort
                        ? 'Kredit Tidak Cukup'
                      : paymentMode === 'partial'
                        ? 'Confirm DP'
                        : 'Confirm Payment'}
            </button>
            </div>
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
