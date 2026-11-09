'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { formatCurrency } from '@/utils/price'
import type { PosCartItem, PosCartBundle } from '@/types/api'
import SearchableSelect from '@/components/SearchableSelect'
import { vouchersService } from '@/services/vouchers.service'
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
  guestName: string
  setGuestName: (v: string) => void
  guestPhone: string
  setGuestPhone: (v: string) => void
  orderNote: string
  setOrderNote: (v: string) => void
  appliedVoucher: { code: string; voucher_id: number | null } | null
  voucherCode: number | ''
  setVoucherCode: (v: number | '') => void
  voucherLoading: boolean
  onApplyVoucher: (voucher?: { id: number; code: string }) => void
  onClearVoucher: () => void
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
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
  color: 'var(--foreground-muted)',
  marginBottom: 4,
  display: 'block',
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
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  orderNote,
  setOrderNote,
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
  // "Lanjut Bayar" once and ask the cashier to apply it or drop it.
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
  const handleProceed = () => {
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

  const metaRow = (label: string, value?: React.ReactNode) =>
    value ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
        <span style={{ color: 'var(--foreground-muted)' }}>{label}</span>
        <span style={{ color: 'var(--foreground)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
      </div>
    ) : null

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
          </div>
          <button
            type="button"
            onClick={onBack}
            aria-label="Tutup"
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--foreground-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Order meta */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'var(--background)',
          }}
        >
          {metaRow('Order', editingOrderCode ? `${editingOrderCode} (pending)` : 'Baru')}
          {metaRow('Tipe', orderType === 'online' ? 'Online' : 'Offline')}
          {orderType === 'online' && setSalesChannelId ? (
            <div style={{ marginTop: 6 }}>
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
            </div>
          ) : (
            metaRow('Sales Channel', salesChannelName)
          )}

          {/* Customer */}
          <div style={{ marginTop: 6 }}>
            <span style={fieldLabel}>Customer</span>
            {selectedCustomerName ? (
              <div
                style={{
                  ...fieldStyle,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 500 }}>{selectedCustomerName}</span>
                <button
                  type="button"
                  onClick={onClearCustomer}
                  aria-label="Hapus customer"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Nama customer (opsional)"
                  style={{ ...fieldStyle, flex: 3 }}
                />
                <input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="No. HP"
                  inputMode="tel"
                  style={{ ...fieldStyle, flex: 2 }}
                />
              </div>
            )}
          </div>

          {/* Voucher */}
          <div>
            <span style={fieldLabel}>Voucher</span>
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
              <div style={{ ...fieldStyle, color: 'var(--foreground-subtle)', background: 'var(--background)' }}>
                Pilih sales channel dulu untuk memakai voucher
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <div
                  style={{
                    flex: 1,
                    borderRadius: 'var(--radius-sm)',
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
                    placeholder="Pilih voucher..."
                    searchPlaceholder="Cari voucher..."
                    loading={vouchersLoading}
                    onSearchChange={setVoucherSearch}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const v = vouchers.find((x: any) => x.id === voucherCode)
                    if (v) onApplyVoucher({ id: v.id, code: v.code })
                  }}
                  disabled={voucherLoading || !voucherCode}
                  style={{
                    padding: '0 14px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: voucherLoading || !voucherCode ? 'not-allowed' : 'pointer',
                    opacity: voucherLoading || !voucherCode ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {voucherLoading ? <Loader2 size={14} className="animate-spin" /> : 'Terapkan'}
                </button>
              </div>
            )}
            {voucherPending && !showVoucherWarn && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                Voucher belum diterapkan — klik Terapkan agar diskon dihitung.
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
                  Voucher {pendingVoucher?.name || pendingVoucher?.code || ''} belum diterapkan
                </div>
                <div style={{ marginBottom: 8 }}>
                  Diskon belum masuk ke total. Terapkan voucher dulu, atau lanjut tanpa voucher.
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
                    Terapkan voucher
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
                    Lanjut tanpa voucher
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <span style={fieldLabel}>Catatan order</span>
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Catatan untuk order ini (opsional)"
              rows={2}
              style={{ ...fieldStyle, resize: 'none' }}
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
                      fontWeight: 600,
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
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    {c.code && <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>{c.code}</div>}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 14, fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {fmtQty(c.qty)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, textAlign: 'right', color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(c.price)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(c.price * c.qty)}
                  </td>
                </tr>
              ))}
              {bundleCart.map((b, i) => (
                <tr key={`b-${b.bundle_id}-${i}`}>
                  <td style={{ padding: '8px 8px 8px 0', fontSize: 13, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
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
                  <td style={{ padding: '8px 0', fontSize: 14, fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {fmtQty(b.qty)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, textAlign: 'right', color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(b.price)}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(b.price * b.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--foreground-muted)' }}>
            <span>{lineCount} item · {fmtQty(totalQty)} qty</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--success)' }}>
              <span>Diskon{appliedVoucher?.code ? ` (${appliedVoucher.code})` : ''}</span>
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
              background: 'var(--accent-light-bg)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Total</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
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
            Ubah Pesanan <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>(Esc)</span>
          </button>
          <button
            type="button"
            onClick={handleProceed}
            autoFocus
            style={{
              flex: 2,
              padding: '12px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 15,
              fontWeight: 700,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {orderType === 'online' ? 'Lanjut Buat Order' : 'Lanjut Bayar'}{' '}
            <span style={{ fontSize: 11, opacity: 0.8 }}>(Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
