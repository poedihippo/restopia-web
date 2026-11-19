import React, { useEffect,  useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check, X } from 'lucide-react'
import type { ReceiptData } from '@/components/PosReceipt'
import PosPreordersModal from './PosPreordersModal'
import PosHistoryModal from './PosHistoryModal'
import PaymentMethodIcon from './PaymentMethodIcon'
import { CustomerField } from './PosOrderReviewModal'
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
  // Put the cursor where the cashier types next (DP amount / cash tendered).
  const focusField = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.focus()
    }, 60)
  }
  // Credit has its own section; the method grid only lists money tenders.
  const creditMethod = paymentMethods.find((pm: any) => pm.name?.toLowerCase().includes('credit'))
  const moneyMethods = paymentMethods.filter((pm: any) => pm !== creditMethod)
  // Only the submit button is solid brown. A selected choice uses the soft brand
  // look of the list filters ("More Filters"): peach fill, light-brown border,
  // brown text — on a gray section.
  const sectionStyle: React.CSSProperties = {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 12,
    marginBottom: 14,
  }
  // Joined segments (one bordered strip), the selected one in the soft brand
  // colour — same shape as before, only the colouring changed.
  const segContainerStyle: React.CSSProperties = {
    display: 'flex',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  }
  const segStyle = (active: boolean, index = 0): React.CSSProperties => ({
    flex: 1,
    height: 42,
    border: 'none',
    borderLeft: index > 0 ? '1px solid var(--border)' : 'none',
    background: active ? 'var(--accent-light-bg)' : 'var(--surface)',
    color: active ? 'var(--accent)' : 'var(--foreground-muted)',
    boxShadow: active ? 'inset 0 -2px 0 var(--accent-light)' : 'none',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    fontFamily: 'var(--font-sans)',
    cursor: active ? 'default' : 'pointer',
  })
  const optionCardStyle = (selected: boolean): React.CSSProperties => ({
    border: '1px solid',
    borderColor: selected ? 'var(--accent-light)' : 'var(--border)',
    borderRadius: 'var(--radius-md)',
    background: selected ? 'var(--accent-light-bg)' : 'var(--surface)',
    color: selected ? 'var(--accent)' : 'var(--foreground)',
    boxShadow: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
  })
  const staffCreditPicked = isCreditMethod && !customerCredit
  // Payment tab: Bayar Langsung (money tenders) | Kredit Karyawan | Kredit
  // Customer — the last one only on the DP tab (DP now, possibly 0, rest later).
  const payTab: 'now' | 'staff' | 'customer' = customerCredit ? 'customer' : staffCreditPicked ? 'staff' : 'now'
  const dpValue = Number(partialAmount.replace(/\D/g, '')) || 0
  const creditNoDp = customerCredit && dpValue === 0
  const choosePayNow = () => {
    if (customerCredit) {
      setCustomerCredit(false)
      setCreditType?.('user')
    }
    if (isCreditMethod) setPaymentMethodId(null)
  }
  const chooseStaffCredit = () => {
    if (staffCreditPicked) return
    if (!creditMethod) return toast.error('Credit payment method not found')
    setCustomerCredit(false)
    setCreditType?.('user')
    setPaymentMethodId(creditMethod.id)
    setCashTendered('')
  }
  const chooseCustomerCredit = () => {
    if (customerCredit) return
    setCustomerCredit(true)
    setCreditType?.('customer')
    setCreditByUserId(null)
    setPaymentMethodId(null)
    setCashTendered('')
  }
  // The customer was already filled on Konfirmasi Pesanan: a DP for a known
  // customer is customer credit, so the DP tab hides Bayar Langsung and opens
  // on Kredit Customer (Kredit Karyawan stays available).
  const customerFilled = !!((selectedCustomerId && selectedCustomerId > 0) || manualCustomerName.trim())
  const hidePayNowForDp = paymentMode === 'partial' && customerFilled && !isSplitPayment
  React.useEffect(() => {
    if (showPayment && hidePayNowForDp && payTab === 'now') chooseCustomerCredit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPayment, hidePayNowForDp, payTab])
  // Back on Full Payment, Kredit Customer no longer applies.
  React.useEffect(() => {
    if (paymentMode !== 'partial' && customerCredit) {
      setCustomerCredit(false)
      setCreditType?.('user')
    }
  }, [paymentMode, customerCredit, setCustomerCredit, setCreditType])
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
    if (amt > remainingSplitBalance) {
      return toast.error(`Melebihi sisa tagihan (${formatCurrency(remainingSplitBalance)})`)
    }
    
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
            .pos-pay-seg[aria-checked="false"]:hover { color: var(--foreground) !important; }
            .pos-pay-method[aria-checked="false"]:hover { border-color: var(--accent-light) !important; box-shadow: var(--shadow-sm) !important; transform: translateY(-1px); }
            .pos-pay-method:focus-visible, .pos-pay-seg:focus-visible { outline: 2px solid var(--accent-light); outline-offset: 2px; }
            .pos-pay-method:active { transform: scale(0.98); }
            .pos-pay-secondary:not(:disabled):hover { background: var(--background) !important; border-color: var(--border-strong) !important; color: var(--foreground) !important; }
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
              width: 'min(520px, 100%)',
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

            {/* Total due — one compact row; with a DP, the split shows underneath. */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)' }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(total)}
                </span>
              </div>
              {paymentMode === 'partial' && !isOnline && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <span>DP {formatCurrency(dpValue)}</span>
                  <span>Sisa {formatCurrency(Math.max(0, total - dpValue))}</span>
                </div>
              )}
            </div>

            {/* Payment Mode: Full vs Partial (DP) */}
            {!isOnline && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Payment Mode
              </label>
              <div
                role="radiogroup"
                aria-label="Payment mode"
                style={segContainerStyle}
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
                      onClick={() => {
                        setPaymentMode?.(mode)
                        if (mode === 'partial') {
                          // A split must cover the total; a DP is one tender.
                          if (isSplitPayment) setIsSplitPayment?.(false)
                          focusField('pos-dp-amount')
                        }
                      }}
                      style={segStyle(selected, i)}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {paymentMode === 'partial' && (
                // Highlighted: the DP amount is what the cashier must type here.
                <div style={{ ...sectionStyle, marginTop: 10, marginBottom: 0, background: 'var(--accent-light-bg)', borderColor: 'var(--accent-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <label htmlFor="pos-dp-amount" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                      DP Amount
                    </label>
                    <span style={{ fontSize: 11.5, color: 'var(--foreground-muted)', textAlign: 'right' }}>
                      Kurang dari {formatCurrency(total)}{customerCredit ? ' · boleh 0 untuk Kredit Customer' : ''}
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span
                      aria-hidden
                      style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 600, color: 'var(--foreground-muted)', pointerEvents: 'none' }}
                    >
                      Rp
                    </span>
                    <LocalizedNumberInput
                      id="pos-dp-amount"
                      selectOnFocus
                      maxExclusive={total}
                      value={partialAmount ? Number(partialAmount) : undefined}
                      onChange={(val) => setPartialAmount?.(val !== undefined && val !== null ? String(val) : '')}
                      decimals={2}
                      padDecimals={false}
                      placeholder="0"
                      style={{ height: 52, fontSize: 20, fontWeight: 700, paddingLeft: 44, borderColor: 'var(--accent-light)', background: 'var(--surface)' }}
                    />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Sales Channel (Required). An online order already picked it on the
                review step (needed for its voucher) — don't ask twice; "Back" changes it. */}
            {!salesChannelId && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input
                type="checkbox"
                id="split-payment"
                checked={isSplitPayment}
                onChange={(e) => {
                  setIsSplitPayment?.(e.target.checked)
                  // Split lines must add up to the whole total.
                  if (e.target.checked && paymentMode === 'partial') setPaymentMode?.('full')
                }}
                style={{ width: 16, height: 16, accentColor: 'var(--foreground)', cursor: 'pointer' }}
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
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: remainingSplitBalance === 0 ? 'var(--success-bg)' : 'var(--warning-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 13, color: remainingSplitBalance === 0 ? 'var(--success)' : 'var(--warning)' }}>Remaining Balance</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: remainingSplitBalance === 0 ? 'var(--success)' : 'var(--warning)' }}>{formatCurrency(remainingSplitBalance)}</span>
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
                      className="pos-pay-secondary"
                      style={{ width: '100%', padding: '8px', background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add to Split
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
            {/* Payment Method: pay now (money tenders) or pay with credit — same
                segmented style as Payment Mode above. */}
            <div style={sectionStyle}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              Payment Method
            </label>
            <div role="radiogroup" aria-label="Cara bayar" style={{ ...segContainerStyle, marginBottom: 12 }}>
              {([
                { key: 'now', label: 'Bayar Langsung', onPick: choosePayNow, show: !hidePayNowForDp },
                // Kredit Customer is used far more often than Kredit Karyawan: it comes first.
                { key: 'customer', label: 'Kredit Customer', onPick: chooseCustomerCredit, show: paymentMode === 'partial' },
                { key: 'staff', label: 'Kredit Karyawan', onPick: chooseStaffCredit, show: true },
              ] as const).filter((t) => t.show).map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={payTab === t.key}
                  className="pos-pay-seg"
                  onClick={t.onPick}
                  style={segStyle(payTab === t.key, i)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {payTab === 'staff' && (
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block' }}>
                Dipotong dari kredit karyawan — pilih karyawan di bawah.
                {paymentMode !== 'partial' && <> Kredit Customer tersedia di tab <b>Down Payment (DP)</b>.</>}
              </span>
            )}

            {payTab === 'customer' && dpValue === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', padding: '10px 12px', lineHeight: 1.5 }}>
                DP Rp 0 — tidak ada pembayaran sekarang, order disimpan sebagai <b>Kredit Customer</b> (Belum Dibayar). Isi DP bila customer membayar sebagian.
              </div>
            )}

            {(payTab === 'now' || (payTab === 'customer' && dpValue > 0)) && (
            <div>
              {payTab === 'customer' && (
                <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Metode untuk DP
                </label>
              )}
              {moneyMethods.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--destructive)' }}>
                  No payment methods found. Add one in Settings first.
                </p>
              )}
              <div role="radiogroup" aria-label="Metode pembayaran" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {moneyMethods.map((pm: any) => {
                  const isSelected = paymentMethodId === pm.id
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={pm.name}
                      className="pos-pay-method"
                      onClick={() => {
                        setPaymentMethodId(pm.id)
                        setCashTendered('')
                        if (String(pm.name ?? '').toLowerCase().includes('cash')) focusField('pos-cash-tendered')
                      }}
                      style={{
                        ...optionCardStyle(isSelected),
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 76,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PaymentMethodIcon name={pm.name} />
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pm.name}
                      </span>
                      {isSelected && (
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 18,
                            height: 18,
                            borderRadius: 99,
                            background: 'var(--accent)',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            )}

            {/* Cash tendered — only for CASH, inside the Payment Method card. */}
            {isCashMethod && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Cash Nominal
                  </label>
                  <LocalizedNumberInput
                    id="pos-cash-tendered"
                    value={parseNumberId(cashTendered)}
                    onChange={(val) => setCashTendered(String(Math.round(val)))}
                    selectOnFocus
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
                <div style={{ display: 'flex', gap: 6, marginBottom: Number(cashTendered) >= total ? 12 : 0, flexWrap: 'wrap' }}>
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
                            ? 'var(--surface)'
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
                      marginBottom: 0,
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
              </div>
            )}

            {(staffCreditPicked || customerCredit) && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
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
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                      Customer <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    {/* Same field as Konfirmasi Pesanan: search a registered customer,
                        or type a name + phone (a new customer is created on save). */}
                    <CustomerField
                      open={showPayment}
                      selectedName={selectedCustomerId ? customerSearch || 'Customer' : undefined}
                      onClear={() => {
                        clearSelectedCustomer?.()
                        setGuestName('')
                        setGuestPhone('')
                      }}
                      onSelect={(c) => {
                        setSelectedCustomerId(c.id)
                        setCustomerSearch(c.name)
                        setGuestName(c.name)
                        setGuestPhone(c.phone ?? '')
                      }}
                      name={guestName}
                      setName={setGuestName}
                      phone={guestPhone}
                      setPhone={setGuestPhone}
                    />
                    {!selectedCustomerId && (
                      <span style={{ fontSize: 11.5, color: 'var(--foreground-muted)', display: 'block', marginTop: 6 }}>
                        Pilih customer terdaftar, atau isi nama + no. HP untuk customer baru.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

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
                    toast.error('Cash nominal kurang dari total')
                    return
                  }
                  if (
                    isCashMethod &&
                    paymentMode === 'partial' &&
                    Number(cashTendered.replace(/\D/g, '')) < Number(partialAmount.replace(/\D/g, ''))
                  ) {
                    toast.error('Cash nominal kurang dari DP')
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
