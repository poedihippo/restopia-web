import React from 'react'
import { usePosLogic } from './hooks/usePosLogic'
import PosHeader from './components/PosHeader'
import PosProductGrid from './components/PosProductGrid'
import PosCartSidebar from './components/PosCartSidebar'
import PosModals from './components/PosModals'
import PosShiftBlockerModal from './components/PosShiftBlockerModal'
// TODO: You might want to extract PosPreorderModal and PosHistoryModal later.

export default function PosView() {
  const logic = usePosLogic()

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
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <PosHeader
          search={logic.search}
          setSearch={logic.setSearch}
          setProductPage={logic.setProductPage}
          setShowHistory={logic.setShowHistory}
          setShowPreorder={logic.setShowPreorder}
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

      {/* ─── RIGHT — Cart Panel ─── */}
      <PosCartSidebar
        orderType={logic.orderType}
        setOrderType={logic.setOrderType}
        cart={logic.cart}
        setCart={logic.setCart}
        bundleCart={logic.bundleCart}
        setBundleCart={logic.setBundleCart}
        editingOrderId={null} // Replace with actual states from logic if needed
        editingOrderCode={null}
        setEditingOrderId={() => {}}
        setEditingOrderCode={() => {}}
        subtotal={logic.subtotal}
        total={logic.total}
        discountAmount={logic.discountAmount}
        appliedVoucher={logic.appliedVoucher}
        voucherCode={logic.voucherCode}
        setVoucherCode={logic.setVoucherCode}
        voucherLoading={logic.voucherLoading}
        handleApplyVoucher={logic.handleApplyVoucher}
        customerSearch={logic.customerSearch}
        setCustomerSearch={logic.setCustomerSearch}
        selectedCustomerId={logic.selectedCustomerId}
        setSelectedCustomerId={logic.setSelectedCustomerId}
        customers={logic.customers}
        showCustomerDropdown={logic.showCustomerDropdown}
        setShowCustomerDropdown={logic.setShowCustomerDropdown}
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
        handleHold={logic.handleHold}
        handleCharge={logic.handleCharge}
        paymentMethodsLoading={logic.paymentMethodsLoading}
        paymentMethods={logic.paymentMethods}
      />

      {/* ─── MODALS ─── */}
      <PosModals
        showPayment={logic.showPayment}
        setShowPayment={logic.setShowPayment}
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
        setCashTendered={logic.setCashTendered}
        paymentMethods={logic.paymentMethods}
        selectedMethod={logic.selectedMethod}
        quickAmounts={logic.quickAmounts}
        change={logic.change}
        handleConfirmPayment={logic.handleConfirmPayment}
        isPending={logic.isPending}
        receiptData={null} // Replace with actual state
        resetCart={logic.resetCart}
        printReceipt={null} // Replace with actual state
        triggerPrint={() => {}}

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
      
      <PosShiftBlockerModal />
    </div>
  )
}
