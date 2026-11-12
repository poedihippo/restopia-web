'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, User, X } from 'lucide-react'
import { formatCurrency } from '@/utils/price'
import type { PosCartItem, PosCartBundle } from '@/types/api'
import SearchableSelect from '@/components/SearchableSelect'
import { vouchersService } from '@/services/vouchers.service'
import { customersService } from '@/services/customers.service'
import { useDebounce } from '@/hooks/useDebounce'

interface PosOrderReviewModalProps {
  open: boolean
  onBack: () => void
  onProceed: () => void
  cart: PosCartItem[]
  bundleCart: PosCartBundle[]
  subtotal: number
  discountAmount: number
  /** Server PPN (after the voucher discount); 0 hides the line. */
  taxAmount?: number
  taxIncluded?: boolean
  total: number
  orderType: 'offline' | 'online'
  salesChannelName?: string
  // An online order picks its sales channel here: vouchers are validated
  // against the channel, so apply-voucher needs it first.
  salesChannelId?: number | null
  setSalesChannelId?: (val: number | null) => void
  salesChannels?: any[]
  editingOrderCode?: string | null

  // Editable order details (moved here from the cart sidebar)
  selectedCustomerName?: string
  onClearCustomer: () => void
  /** Pick an existing customer from the suggestions (sets customer_id). */
  onSelectCustomer: (c: { id: number; name: string; phone?: string | null }) => void
  guestName: string
  setGuestName: (v: string) => void
  guestPhone: string
  setGuestPhone: (v: string) => void
  orderNote: string
  setOrderNote: (v: string) => void
  /** Order date, YYYY-MM-DD. */
  transactionDate: string
  setTransactionDate: (v: string) => void
  /** Fulfillment date (YYYY-MM-DD; only the date part is sent). */
  fulfillmentDate: string
  setFulfillmentDate: (v: string) => void
  appliedVoucher: { code: string; voucher_id: number | null } | null
  voucherCode: number | ''
  setVoucherCode: (v: number | '') => void
  voucherLoading: boolean
  onApplyVoucher: (voucher?: { id: number; code: string }) => void
  onClearVoucher: () => void
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
  marginBottom: 6,
  display: 'block',
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 22,
  padding: '0 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: 'var(--accent-light-bg)',
  color: 'var(--accent)',
  whiteSpace: 'nowrap',
}

/**
 * Customer name + phone with suggestions from existing customers. Picking a
 * suggestion links the order to that customer (customer_id); otherwise the
 * typed name/phone are sent as free text.
 */
function CustomerField({
  open,
  selectedName,
  onClear,
  onSelect,
  name,
  setName,
  phone,
  setPhone,
}: {
  open: boolean
  selectedName?: string
  onClear: () => void
  onSelect: (c: { id: number; name: string; phone?: string | null }) => void
  name: string
  setName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
}) {
  const [focused, setFocused] = useState<'name' | 'phone' | null>(null)
  const [highlight, setHighlight] = useState(0)
  const term = (focused === 'phone' ? phone : name).trim()
  const termDebounced = useDebounce(term, 300)
  const { data, isFetching } = useQuery({
    queryKey: ['pos-customer-suggest', termDebounced],
    enabled: open && !selectedName && termDebounced.length >= 2,
    staleTime: 30_000,
    queryFn: () =>
      customersService
        .list({ per_page: 8, 'filter[search]': termDebounced } as any)
        .then((r) => r.data),
  })
  const suggestions: any[] = termDebounced.length >= 2 ? (data as any)?.data ?? [] : []
  const showList = !!focused && term.length >= 2 && (suggestions.length > 0 || isFetching)

  const pick = (c: any) => {
    onSelect({ id: Number(c.id), name: String(c.name ?? ''), phone: c.phone ?? null })
    setFocused(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(suggestions[Math.min(highlight, suggestions.length - 1)])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setFocused(null)
    }
  }

  if (selectedName) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--accent-light-bg)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <User size={14} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
            {phone ? `${phone} · ` : ''}Customer terdaftar
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Ganti customer"
          title="Ganti customer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex', padding: 4 }}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Same 1:1 split as the date row below, so the columns line up. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)', pointerEvents: 'none' }} />
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setHighlight(0)
            }}
            onFocus={() => setFocused('name')}
            onBlur={() => setTimeout(() => setFocused((f) => (f === 'name' ? null : f)), 150)}
            onKeyDown={onKeyDown}
            placeholder="Cari / ketik nama customer"
            autoComplete="off"
            style={{ ...fieldStyle, paddingLeft: 30 }}
          />
        </div>
        <input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setHighlight(0)
          }}
          onFocus={() => setFocused('phone')}
          onBlur={() => setTimeout(() => setFocused((f) => (f === 'phone' ? null : f)), 150)}
          onKeyDown={onKeyDown}
          placeholder="No. HP"
          inputMode="tel"
          autoComplete="off"
          style={fieldStyle}
        />
      </div>

      {showList && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 240,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {isFetching && suggestions.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} className="animate-spin" /> Mencari customer…
            </div>
          ) : (
            suggestions.map((c: any, i: number) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(c)}
                style={{
                  display: 'flex',
                  width: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: i === highlight ? 'var(--accent-light-bg)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)', flexShrink: 0 }}>{c.phone || c.code || ''}</span>
              </button>
            ))
          )}
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--foreground-subtle)', background: 'var(--background)' }}>
            Tidak ada di daftar? Lanjut ketik — disimpan sebagai teks bebas.
          </div>
        </div>
      )}
    </div>
  )
}

const fmtQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

/**
 * Step 1 of checkout: read the order back to the customer before taking
 * money — every line, qty, price, discount and total — so mistakes are fixed
 * in the cart, not refunded later. Enter = continue to payment, Esc = back.
 */
export default function PosOrderReviewModal({
  open,
  onBack,
  onProceed,
  cart,
  bundleCart,
  subtotal,
  discountAmount,
  taxAmount,
  taxIncluded,
  total,
  orderType,
  salesChannelName,
  salesChannelId,
  setSalesChannelId,
  salesChannels = [],
  editingOrderCode,
  selectedCustomerName,
  onClearCustomer,
  onSelectCustomer,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  orderNote,
  setOrderNote,
  transactionDate,
  setTransactionDate,
  fulfillmentDate,
  setFulfillmentDate,
  appliedVoucher,
  voucherCode,
  setVoucherCode,
  voucherLoading,
  onApplyVoucher,
  onClearVoucher,
}: PosOrderReviewModalProps) {
  // Voucher picker searches on the server; the picked voucher is kept in the
  // list even when a later search no longer returns it.
  const [voucherSearch, setVoucherSearch] = useState('')
  const voucherSearchDebounced = useDebounce(voucherSearch, 400)
  const { data: vouchersData, isFetching: vouchersLoading } = useQuery({
    queryKey: ['pos-vouchers', voucherSearchDebounced],
    enabled: open,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      vouchersService
        .list({ 'filter[search]': voucherSearchDebounced || undefined, 'filter[status]': 'active', per_page: 20 } as any)
        .then((r) => r.data),
  })
  const [pickedVoucher, setPickedVoucher] = useState<any>(null)
  const vouchers: any[] = useMemo(() => {
    const results: any[] = (vouchersData as any)?.data ?? []
    const picked = pickedVoucher && pickedVoucher.id === voucherCode ? pickedVoucher : null
    return picked && !results.some((v) => v.id === picked.id) ? [picked, ...results] : results
  }, [vouchersData, voucherCode, pickedVoucher])
  const voucherOptions = useMemo(
    () =>
      // Name first (what the cashier recognises), code underneath.
      vouchers.map((v: any) => ({
        label: v.name || v.code,
        value: v.id,
        sublabel: v.name ? v.code : '',
      })),
    [vouchers],
  )

  // A voucher picked but never applied (Terapkan) gives no discount. Block
  // "Charge Now" once and ask the cashier to apply it or drop it.
  const [voucherWarn, setVoucherWarn] = useState(false)
  const needsChannelForVoucher = orderType === 'online' && !salesChannelId
  const voucherPending =
    !needsChannelForVoucher && !appliedVoucher && typeof voucherCode === 'number' && voucherCode > 0
  const showVoucherWarn = voucherWarn && voucherPending
  const pendingVoucher = voucherPending ? vouchers.find((x: any) => x.id === voucherCode) : undefined
  const applyPendingVoucher = () => {
    if (pendingVoucher) onApplyVoucher({ id: pendingVoucher.id, code: pendingVoucher.code })
    setVoucherWarn(false)
  }
  // An online order belongs to a marketplace: no channel, no order.
  const missingChannel = orderType === 'online' && !salesChannelId
  const handleProceed = () => {
    if (missingChannel) return
    if (voucherPending) {
      setVoucherWarn(true)
      return
    }
    setVoucherWarn(false)
    onProceed()
  }
  const proceedWithoutVoucher = () => {
    setVoucherCode('')
    setVoucherWarn(false)
    onProceed()
  }
  const handleProceedRef = useRef(handleProceed)
  useEffect(() => {
    handleProceedRef.current = handleProceed
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Typing in a field (customer, note, voucher search) must not
      // trigger the step shortcuts.
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleProceedRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onBack])

  if (!open) return null

  const lineCount = cart.length + bundleCart.length
  const totalQty =
    cart.reduce((s, c) => s + Number(c.qty || 0), 0) +
    bundleCart.reduce((s, c) => s + Number(c.qty || 0), 0)


  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Konfirmasi Pesanan"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          width: 520,
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--accent)', margin: 0 }}>
              Konfirmasi Pesanan
            </h2>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              Bacakan ulang pesanan ke customer sebelum pembayaran
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {editingOrderCode && <span style={chipStyle}>{`${editingOrderCode} · pending`}</span>}
              <span style={chipStyle}>
                {orderType === 'online' ? 'Online' : 'Offline'}
              </span>
              {orderType !== 'online' && salesChannelName && (
                <span style={chipStyle}>
                  {salesChannelName}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            aria-label="Close"
            className="pos-rv-close"
            style={{
              width: 32, height: 32, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--foreground-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Order details */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'var(--background)',
          }}
        >
          {orderType === 'online' && setSalesChannelId && (
            <div>
              <span style={fieldLabel}>
                Sales Channel <span style={{ color: 'var(--destructive)' }}>*</span>
              </span>
              <select
                value={salesChannelId ?? ''}
                onChange={(e) => setSalesChannelId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  ...fieldStyle,
                  borderColor: salesChannelId ? 'var(--border)' : 'var(--warning)',
                }}
              >
                <option value="">Pilih sales channel...</option>
                {salesChannels.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!salesChannelId && (
                <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>
                  Pilih sales channel (GoFood, GrabFood, …) untuk membuat order.
                </div>
              )}
            </div>
          )}

          {/* Customer */}
          <div>
            <span style={fieldLabel}>Customer</span>
            <CustomerField
              open={open}
              selectedName={selectedCustomerName}
              onClear={onClearCustomer}
              onSelect={onSelectCustomer}
              name={guestName}
              setName={setGuestName}
              phone={guestPhone}
              setPhone={setGuestPhone}
            />
          </div>

          {/* Dates — both default to today */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'block' }}>
              <span style={fieldLabel}>Tanggal order</span>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => {
                  const v = e.target.value
                  setTransactionDate(v)
                  // Fulfillment can't be before the order date.
                  if (v && fulfillmentDate.slice(0, 10) < v) setFulfillmentDate(v)
                }}
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span style={fieldLabel}>Tanggal fulfillment</span>
              <input
                type="date"
                value={fulfillmentDate.slice(0, 10)}
                min={transactionDate || undefined}
                onChange={(e) => setFulfillmentDate(e.target.value)}
                style={fieldStyle}
              />
            </label>
          </div>

          {/* Note */}
          <div>
            <span style={fieldLabel}>Catatan order</span>
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Catatan untuk order ini (opsional)"
              rows={2}
              style={{ ...fieldStyle, height: 'auto', padding: '8px 10px', resize: 'none' }}
            />
          </div>
        </div>

        {/* Lines */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Item', 'Qty', 'Harga', 'Subtotal'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 0 ? 'left' : 'right',
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--foreground-subtle)',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cart.map((c, i) => (
                <tr key={`p-${c.product_inventory_id}-${i}`}>
                  <td style={{ padding: '8px 8px 8px 0', fontSize: 13, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>
                    <div>{c.name}</div>
                    {c.code && <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>{c.code}</div>}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 400, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {fmtQty(c.qty)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, textAlign: 'right', color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(c.price)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 400, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(c.price * c.qty)}
                  </td>
                </tr>
              ))}
              {bundleCart.map((b, i) => (
                <tr key={`b-${b.bundle_id}-${i}`}>
                  <td style={{ padding: '8px 8px 8px 0', fontSize: 13, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--accent)',
                          background: 'var(--accent-light-bg)',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        Bundle
                      </span>
                      {b.name}
                    </div>
                    {Array.isArray((b as any).bundle_details) && (b as any).bundle_details.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 2 }}>
                        {(b as any).bundle_details
                          .map((d: any) => d.product_name)
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 400, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {fmtQty(b.qty)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, textAlign: 'right', color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(b.price)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 400, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(b.price * b.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Items subtotal: the sum of the table above */}
        <div style={{ padding: '4px 24px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--foreground-muted)' }}>
            <span>
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>Subtotal</span>{' '}
              <span style={{ color: 'var(--foreground-subtle)' }}>· {lineCount} item · {fmtQty(totalQty)} qty</span>
            </span>
            <span style={{ fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotal)}</span>
          </div>
        </div>

        {/* Voucher — its own band, tinted like the order details above */}
        <div style={{ padding: '16px 24px 18px', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
          <div>
            <span style={{ ...fieldLabel, fontWeight: 600, color: 'var(--foreground)' }}>Voucher</span>
            {appliedVoucher ? (
              <div
                style={{
                  ...fieldStyle,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--success-bg)',
                  borderColor: 'var(--success)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {appliedVoucher.code || 'Voucher'} · - {formatCurrency(discountAmount)}
                </span>
                <button
                  type="button"
                  onClick={onClearVoucher}
                  aria-label="Hapus voucher"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : needsChannelForVoucher ? (
              <div
                style={{
                  ...fieldStyle,
                  height: 40,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--foreground-subtle)',
                  background: 'var(--surface)',
                  borderStyle: 'dashed',
                }}
              >
                Pilih sales channel dulu untuk memakai voucher
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 'var(--radius-md)',
                    boxShadow: voucherPending ? '0 0 0 1px var(--warning)' : undefined,
                  }}
                >
                  <SearchableSelect
                    options={voucherOptions}
                    value={voucherCode}
                    onChange={(val) => {
                      setPickedVoucher(vouchers.find((x: any) => x.id === val) ?? null)
                      setVoucherCode(val as number)
                    }}
                    placeholder="Select a voucher"
                    searchPlaceholder="Search voucher..."
                    loading={vouchersLoading}
                    onSearchChange={setVoucherSearch}
                    triggerStyle={{ height: 38, fontSize: 13, borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const v = vouchers.find((x: any) => x.id === voucherCode)
                    if (v) onApplyVoucher({ id: v.id, code: v.code })
                  }}
                  disabled={voucherLoading || !voucherCode}
                  className="pos-rv-primary"
                  style={{
                    height: 38,
                    minWidth: 76,
                    padding: '0 16px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: voucherLoading || !voucherCode ? 'not-allowed' : 'pointer',
                    opacity: voucherLoading || !voucherCode ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {voucherLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                </button>
              </div>
            )}
            {voucherPending && !showVoucherWarn && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                Voucher not applied yet — click Apply to include the discount.
              </div>
            )}
            {showVoucherWarn && (
              <div
                role="alert"
                style={{
                  marginTop: 6,
                  padding: '10px 12px',
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--foreground)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>
                  Voucher {pendingVoucher?.name || pendingVoucher?.code || ''} is not applied
                </div>
                <div style={{ marginBottom: 8 }}>
                  The discount is not in the total yet. Apply the voucher, or continue without it.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={applyPendingVoucher}
                    disabled={voucherLoading || !pendingVoucher}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Apply voucher
                  </button>
                  <button
                    type="button"
                    onClick={proceedWithoutVoucher}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--surface)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Continue without voucher
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div style={{ padding: '18px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--success)' }}>
              <span>Discount{appliedVoucher?.code ? ` (${appliedVoucher.code})` : ''}</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
          )}
          {(taxAmount ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--foreground-muted)' }}>
              <span>{taxIncluded ? 'PPN (termasuk)' : 'PPN'}</span>
              <span>{formatCurrency(taxAmount ?? 0)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              ...(discountAmount > 0 || (taxAmount ?? 0) > 0
                ? { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 6 }
                : {}),
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <style>{`
          .pos-rv-primary, .pos-rv-secondary {
            transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
          }
          .pos-rv-primary:not(:disabled):hover { background: var(--accent-hover) !important; box-shadow: var(--shadow-md); transform: translateY(-1px); }
          .pos-rv-primary:not(:disabled):active { transform: none; box-shadow: none; }
          .pos-rv-close { transition: background-color 150ms ease, color 150ms ease; }
          .pos-rv-close:hover { background: var(--destructive-bg) !important; color: var(--destructive) !important; }
          .pos-rv-secondary:not(:disabled):hover { background: var(--accent-light-bg) !important; border-color: var(--accent-light) !important; color: var(--accent) !important; }
        `}</style>
        <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            className="pos-rv-secondary"
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            Cancel <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>(Esc)</span>
          </button>
          <button
            type="button"
            onClick={handleProceed}
            autoFocus
            disabled={missingChannel}
            title={missingChannel ? 'Pilih sales channel dulu' : undefined}
            className="pos-rv-primary"
            style={{
              flex: 2,
              padding: '12px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 15,
              fontWeight: 700,
              color: 'white',
              cursor: missingChannel ? 'not-allowed' : 'pointer',
              opacity: missingChannel ? 0.5 : 1,
            }}
          >
            {orderType === 'online' ? 'Create Order' : 'Charge Now'}{' '}
            <span style={{ fontSize: 11, opacity: 0.8 }}>(Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
