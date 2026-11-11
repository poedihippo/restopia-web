import React, { useEffect, useState } from 'react'
import { CakeSlice, ChefHat, Cookie, Croissant, ShoppingCart, X } from 'lucide-react'
import { formatCurrency } from '@/utils/price'
import { usePosLogic } from './hooks/usePosLogic'
import DatePopover from '@/components/DatePopover'
import PosHeader from './components/PosHeader'
import PosProductGrid from './components/PosProductGrid'
import PosCartSidebar from './components/PosCartSidebar'
import PosModals from './components/PosModals'
import PosShiftBlockerModal from './components/PosShiftBlockerModal'
import PosOrderReviewModal from './components/PosOrderReviewModal'
import PosTransactionCompleteModal from './components/PosTransactionCompleteModal'
// TODO: You might want to extract PosPreorderModal and PosHistoryModal later.

export default function PosView() {
  const logic = usePosLogic()

  // Phones / narrow tablets: the cart is a drawer, closed by default, opened
  // from the floating bar. Desktop keeps the side-by-side layout (the wrapper
  // is display: contents there).
  const [cartOpen, setCartOpen] = useState(false)
  const itemCount =
    logic.cart.reduce((s: number, c: any) => s + (Number(c.qty) || 0), 0) +
    logic.bundleCart.reduce((s: number, c: any) => s + (Number(c.qty) || 0), 0)
  useEffect(() => {
    if (itemCount === 0) setCartOpen(false)
  }, [itemCount])

  // While an order is submitting (or being held) the whole POS is locked:
  // an overlay takes every click/tap, and keys are swallowed so shortcuts
  // (Enter, Esc, Ctrl+F…) can't act on a half-sent order.
  // Ends as soon as the completion screen is up (the mutation can still be
  // settling its callbacks while that screen is already showing).
  const posBusy = !!(logic.isPending || logic.isHoldPending) && !logic.completedTransaction
  useEffect(() => {
    if (!posBusy) return
    const block = (e: KeyboardEvent) => {
      // Browser escape hatches stay usable: reload (F5, Ctrl/Cmd+R) and the
      // developer tools (F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C).
      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      const isReload = key === 'f5' || (mod && key === 'r')
      const isDevTools = key === 'f12' || (mod && (e.shiftKey || e.altKey) && ['i', 'j', 'c'].includes(key))
      if (isReload || isDevTools) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', block, true)
    return () => window.removeEventListener('keydown', block, true)
  }, [posBusy])

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: 'var(--background)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      {/* ─── LEFT — Product Grid Panel ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <PosHeader
          search={logic.search}
          setSearch={logic.setSearch}
          setProductPage={logic.setProductPage}
          setShowHistory={logic.setShowHistory}
          setShowPreorders={logic.setShowPreorders}
        />

        <PosProductGrid
          activeTab={logic.activeTab}
          setActiveTab={logic.setActiveTab}
          selectedCategory={logic.selectedCategory}
          setSelectedCategory={logic.setSelectedCategory}
          categories={logic.categories}
          sortBy={logic.sortBy}
          setSortBy={logic.setSortBy}
          inStockOnly={logic.inStockOnly}
          setInStockOnly={logic.setInStockOnly}
          productPage={logic.productPage}
          setProductPage={logic.setProductPage}
          productMeta={logic.productMeta}
          items={logic.items}
          groupedItems={logic.groupedItems}
          isLoading={logic.isLoading}
          hoveredCard={logic.hoveredCard}
          setHoveredCard={logic.setHoveredCard}
          addLotToCart={logic.addLotToCart}
          batchPickerGroup={logic.batchPickerGroup}
          setBatchPickerGroup={logic.setBatchPickerGroup}
          orderType={logic.orderType}
          bundleSearch={logic.bundleSearch}
          setBundleSearch={logic.setBundleSearch}
          isBundleLoading={logic.isBundleLoading}
          bundles={logic.bundles}
          addBundleToCart={logic.addBundleToCart}
          addConfiguredBundleToCart={logic.addConfiguredBundleToCart}
          bundlePickerGroup={logic.bundlePickerGroup}
          setBundlePickerGroup={logic.setBundlePickerGroup}
        />
      </div>

      <style>{`
        .pos-cart-wrap { display: contents; }
        .pos-cart-mobilebar, .pos-cart-backdrop, .pos-cart-fab { display: none; }
        @media (max-width: 900px) {
          .pos-cart-wrap {
            display: flex; flex-direction: column;
            position: fixed; top: 0; right: 0; bottom: 0; z-index: 50;
            width: min(420px, 100vw); background: var(--surface);
            box-shadow: var(--shadow-lg);
            transform: translateX(100%); transition: transform 240ms ease;
          }
          .pos-cart-wrap[data-open="true"] { transform: none; }
          .pos-cart-wrap > .pos-cart-panel { width: 100% !important; flex: 1; min-height: 0; box-shadow: none !important; border-left: none !important; }
          .pos-cart-mobilebar { display: flex; }
          .pos-cart-backdrop[data-open="true"] { display: block; }
          .pos-cart-fab { display: flex; }
          .pos-grid-scroll { padding-bottom: 92px !important; }
        }
        @media (prefers-reduced-motion: reduce) { .pos-cart-wrap { transition: none; } }
        .pos-drawer-close { transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease; }
        .pos-drawer-close:hover { background: var(--destructive-bg) !important; border-color: var(--destructive) !important; color: var(--destructive) !important; }
      `}</style>

      {/* Same styled calendar as the rest of the app (GlobalLayout mounts it
          there; POS renders outside that layout). */}
      <DatePopover />

      {/* ─── RIGHT — Cart Panel (a drawer on narrow screens) ─── */}
      <div
        className="pos-cart-backdrop"
        data-open={cartOpen}
        onClick={() => setCartOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(17, 17, 20, 0.32)' }}
      />
      <div className="pos-cart-wrap" data-open={cartOpen}>
        <div
          className="pos-cart-mobilebar"
          style={{ alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
            Cart{itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
          </span>
          <button
            type="button"
            aria-label="Close cart"
            className="pos-drawer-close"
            onClick={() => setCartOpen(false)}
            style={{
              width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)',
              color: 'var(--foreground)', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      <PosCartSidebar
        orderType={logic.orderType}
        setOrderType={logic.setOrderType}
        cart={logic.cart}
        setCart={logic.setCart}
        bundleCart={logic.bundleCart}
        setBundleCart={logic.setBundleCart}
        editingOrderId={logic.editingOrderId}
        editingOrderCode={logic.editingOrderCode}
        onCancelEdit={logic.resetCart}
        subtotal={logic.subtotal}
        total={logic.total}
        discountAmount={logic.discountAmount}
        taxAmount={logic.taxAmount}
        taxIncluded={logic.taxIncluded}
        appliedVoucher={logic.appliedVoucher}
        voucherCode={logic.voucherCode}
        setVoucherCode={logic.setVoucherCode}
        voucherLoading={logic.voucherLoading}
        handleApplyVoucher={logic.handleApplyVoucher}
        salesChannelId={logic.salesChannelId}
        setSalesChannelId={logic.setSalesChannelId}
        salesChannels={logic.salesChannels}
        orderNote={logic.orderNote}
        setOrderNote={logic.setOrderNote}
        transactionDate={logic.transactionDate}
        setTransactionDate={logic.setTransactionDate}
        fulfillmentDate={logic.fulfillmentDate}
        setFulfillmentDate={logic.setFulfillmentDate}
        handleHold={logic.handleHold}
        handleCharge={logic.handleCharge}
        isHoldPending={logic.isHoldPending}
        isPending={logic.isPending}
        paymentMethodsLoading={logic.paymentMethodsLoading}
        paymentMethods={logic.paymentMethods}
      />
      </div>

      {posBusy && (
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label="Processing order"
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(253, 253, 252, 0.6)',
            backdropFilter: 'blur(1.5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'progress',
          }}
        >
          <BakingLoader holding={!!logic.isHoldPending} />
        </div>
      )}

      {/* Floating cart bar (narrow screens): opens the cart drawer */}
      <button
        type="button"
        className="pos-cart-fab"
        onClick={() => setCartOpen(true)}
        style={{
          position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 40,
          height: 56, padding: '0 18px', alignItems: 'center', gap: 12,
          border: 'none', borderRadius: 'var(--radius-lg)',
          background: 'var(--accent)', color: '#fff',
          boxShadow: '0 10px 24px -8px rgba(42, 26, 19, 0.55)',
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}
      >
        <ShoppingCart size={18} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          {itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart is empty'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(Number(logic.total) || 0)}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.16)' }}>
          View cart
        </span>
      </button>

      {/* ─── MODALS ─── */}
      <PosModals
        showPayment={logic.showPayment}
        setShowPayment={logic.setShowPayment}
        onBackToReview={logic.backToReview}
        showReceipt={logic.showReceipt}
        setShowReceipt={logic.setShowReceipt}
        showPreorder={logic.showPreorder}
        setShowPreorder={logic.setShowPreorder}
        showPreorders={logic.showPreorders}
        setShowPreorders={logic.setShowPreorders}
        showHistory={logic.showHistory}
        setShowHistory={logic.setShowHistory}
        total={logic.total}
        isCashMethod={logic.isCashMethod}
        paymentMethodId={logic.paymentMethodId}
        setPaymentMethodId={logic.setPaymentMethodId}
        cashTendered={logic.cashTendered}
        paymentError={logic.paymentError}
        setCashTendered={logic.setCashTendered}
        isSplitPayment={logic.isSplitPayment}
        setIsSplitPayment={logic.setIsSplitPayment}
        splitPayments={logic.splitPayments}
        setSplitPayments={logic.setSplitPayments}
        paymentMode={logic.paymentMode}
        setPaymentMode={logic.setPaymentMode}
        partialAmount={logic.partialAmount}
        setPartialAmount={logic.setPartialAmount}
        paymentMethods={logic.paymentMethods}
        selectedMethod={logic.selectedMethod}
        quickAmounts={logic.quickAmounts}
        change={logic.change}
        handleConfirmPayment={logic.handleConfirmPayment}
        isCreditMethod={logic.isCreditMethod}
        creditByUserId={logic.creditByUserId}
        setCreditByUserId={logic.setCreditByUserId}
        creditUsers={logic.creditUsers}
        setCreditUserSearch={logic.setCreditUserSearch}
        creditType={logic.creditType}
        setCreditType={logic.setCreditType}
        selectedCustomerId={logic.selectedCustomerId}
        manualCustomerName={logic.manualCustomerName}
        guestName={logic.guestName}
        setGuestName={logic.setGuestName}
        guestPhone={logic.guestPhone}
        setGuestPhone={logic.setGuestPhone}
        customerSearch={logic.customerSearch}
        setCustomerSearch={logic.setCustomerSearch}
        clearSelectedCustomer={logic.clearSelectedCustomer}
        setSelectedCustomerId={logic.setSelectedCustomerId}
        customers={logic.customers}
        showCustomerDropdown={logic.showCustomerDropdown}
        setShowCustomerDropdown={logic.setShowCustomerDropdown}
        isPending={logic.isPending}
        receiptData={null} // Replace with actual state
        resetCart={logic.resetCart}
        printReceipt={null} // Replace with actual state
        triggerPrint={() => {}}
        salesChannelId={logic.salesChannelId}
        setSalesChannelId={logic.setSalesChannelId}
        salesChannels={logic.salesChannels}
        orderType={logic.orderType}

        preorderSearch={logic.preorderSearch}
        setPreorderSearch={logic.setPreorderSearch}
        preorderDateFrom={logic.preorderDateFrom}
        setPreorderDateFrom={logic.setPreorderDateFrom}
        preorderDateTo={logic.preorderDateTo}
        setPreorderDateTo={logic.setPreorderDateTo}
        preorderPage={logic.preorderPage}
        setPreorderPage={logic.setPreorderPage}
        preorders={logic.preorders}
        preorderMeta={logic.preorderMeta}
        isPreordersLoading={logic.isPreordersLoading}
        loadPreorderToCart={logic.loadPreorderToCart}

        historySearch={logic.historySearch}
        setHistorySearch={logic.setHistorySearch}
        historyDateFrom={logic.historyDateFrom}
        setHistoryDateFrom={logic.setHistoryDateFrom}
        historyDateTo={logic.historyDateTo}
        setHistoryDateTo={logic.setHistoryDateTo}
        historyPage={logic.historyPage}
        setHistoryPage={logic.setHistoryPage}
        historyOrders={logic.historyOrders}
        historyMeta={logic.historyMeta}
        isHistoryLoading={logic.isHistoryLoading}
      />
      
      {/* Cashier flow: review -> payment (PosModals) -> complete */}
      <PosOrderReviewModal
        open={logic.showReview}
        onBack={logic.closeReview}
        onProceed={logic.proceedFromReview}
        cart={logic.cart}
        bundleCart={logic.bundleCart}
        subtotal={logic.subtotal}
        discountAmount={logic.discountAmount}
        taxAmount={logic.taxAmount}
        taxIncluded={logic.taxIncluded}
        total={logic.total}
        orderType={logic.orderType}
        salesChannelId={logic.salesChannelId}
        setSalesChannelId={logic.setSalesChannelId}
        salesChannels={logic.salesChannels}
        salesChannelName={
          logic.salesChannels.find((sc: any) => sc.id === logic.salesChannelId)?.name
        }
        editingOrderCode={logic.editingOrderCode}
        selectedCustomerName={logic.selectedCustomerId ? logic.customerSearch || 'Customer' : undefined}
        onClearCustomer={() => {
          logic.clearSelectedCustomer()
          logic.setGuestName('')
          logic.setGuestPhone('')
        }}
        onSelectCustomer={(c) => {
          logic.setSelectedCustomerId(c.id)
          logic.setCustomerSearch(c.name)
          logic.setGuestName(c.name)
          logic.setGuestPhone(c.phone ?? '')
        }}
        guestName={logic.guestName}
        setGuestName={logic.setGuestName}
        guestPhone={logic.guestPhone}
        setGuestPhone={logic.setGuestPhone}
        orderNote={logic.orderNote}
        setOrderNote={logic.setOrderNote}
        transactionDate={logic.transactionDate}
        setTransactionDate={logic.setTransactionDate}
        fulfillmentDate={logic.fulfillmentDate}
        setFulfillmentDate={logic.setFulfillmentDate}
        appliedVoucher={logic.appliedVoucher}
        voucherCode={logic.voucherCode}
        setVoucherCode={logic.setVoucherCode}
        voucherLoading={logic.voucherLoading}
        onApplyVoucher={logic.handleApplyVoucher}
        onClearVoucher={logic.clearVoucher}
      />

      <PosTransactionCompleteModal
        transaction={logic.completedTransaction}
        isPrinting={logic.isPrinting}
        printerConnected={logic.printerConnected}
        onPrint={logic.handlePrintCompleted}
        onNewTransaction={logic.startNewTransaction}
      />

      <PosShiftBlockerModal />
    </div>
  )
}

// A little bakery while the order goes through: a hopping pastry that changes
// every beat and a rotating line of kitchen chatter. Respects reduced motion.
const BAKE_ICONS = [CakeSlice, Cookie, Croissant, ChefHat]
const BAKE_LINES = [
  'Whisking up your order…',
  'Melting the chocolate…',
  'Dusting on some cocoa…',
  'Boxing it up nicely…',
  'Almost out of the oven…',
]
const HOLD_LINES = ['Putting it on the cooling rack…', 'Saving it for later…', 'Wrapping it up…']

function BakingLoader({ holding }: { holding: boolean }) {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setBeat((b) => b + 1), 1300)
    return () => window.clearInterval(t)
  }, [])
  const Icon = BAKE_ICONS[beat % BAKE_ICONS.length]
  const lines = holding ? HOLD_LINES : BAKE_LINES
  const line = lines[beat % lines.length]

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        padding: '40px 48px 34px', width: 'min(400px, calc(100vw - 32px))', borderRadius: 'var(--radius-xl)',
        background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
        fontFamily: 'var(--font-sans)', textAlign: 'center',
      }}
    >
      <style>{`
        @keyframes pos-bake-hop {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-16px) rotate(-8deg); }
          55% { transform: translateY(0) rotate(4deg); }
          70% { transform: translateY(-3px) rotate(0deg); }
        }
        @keyframes pos-bake-shadow {
          0%, 100% { transform: scaleX(1); opacity: 0.35; }
          30% { transform: scaleX(0.6); opacity: 0.18; }
        }
        @keyframes pos-bake-line { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes pos-bake-dot { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        .pos-bake-icon { animation: pos-bake-hop 1.3s ease-in-out infinite; }
        .pos-bake-shadow { animation: pos-bake-shadow 1.3s ease-in-out infinite; }
        .pos-bake-line { animation: pos-bake-line 260ms ease-out; }
        .pos-bake-dot { animation: pos-bake-dot 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pos-bake-icon, .pos-bake-shadow, .pos-bake-line, .pos-bake-dot { animation: none; }
        }
      `}</style>
      <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          className="pos-bake-icon"
          style={{
            width: 84, height: 84, borderRadius: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent-light-bg)', color: 'var(--accent)',
          }}
        >
          <Icon size={44} strokeWidth={1.6} />
        </span>
        <span
          className="pos-bake-shadow"
          aria-hidden
          style={{ position: 'absolute', bottom: -10, width: 56, height: 8, borderRadius: '50%', background: 'rgba(74, 46, 33, 0.35)' }}
        />
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--foreground)', marginTop: 6 }}>
        {holding ? 'Holding order' : 'Processing order'}
      </div>
      <div key={line} className="pos-bake-line" style={{ fontSize: 15, color: 'var(--foreground-muted)', minHeight: 22 }}>
        {line}
      </div>
      <div aria-hidden style={{ display: 'flex', gap: 7, marginTop: 2 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="pos-bake-dot"
            style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent-light)', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
