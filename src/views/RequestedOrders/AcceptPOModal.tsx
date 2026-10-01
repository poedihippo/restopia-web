import React, { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getCanReadPrice } from '@/utils/price'
import { useQuery } from '@tanstack/react-query'
import { taxesService } from '@/services/taxes.service'
import { getProductUomName } from '@/utils/productUomName'

export interface AcceptPODetailPayload {
  id?: number
  product_uom_id: number
  qty: number
  price: number
  description?: string
  is_taxable?: boolean
  discount_type?: 'percent' | 'nominal' | null
  discount_value?: number | null
}

export interface AcceptPOAdditionalCharge {
  name: string
  amount: number
  description?: string
}

export interface AcceptPOModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: { details: AcceptPODetailPayload[], tax_id?: number, additional_charges?: AcceptPOAdditionalCharge[] }) => void
  isSubmitting: boolean
  purchaseOrder: any
}

export default function AcceptPOModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  purchaseOrder,
}: AcceptPOModalProps) {
  const [details, setDetails] = useState<AcceptPODetailPayload[]>([])
  const [additionalCharges, setAdditionalCharges] = useState<AcceptPOAdditionalCharge[]>([])

  const { hasPermission } = useAuth()
  const canEditExternalPrice = hasPermission('purchase-order.edit-price')
  const canEditInternalPrice = hasPermission('internal-purchase-order.edit-price')
  const canEditPrice = purchaseOrder?.type === 'supplier' ? canEditExternalPrice : canEditInternalPrice

  const [taxId, setTaxId] = useState<number | undefined>(undefined)

  const { data: taxesData } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => taxesService.list().then((r) => r.data),
  })
  const taxes = (taxesData as any)?.data ?? []

  useEffect(() => {
    if (isOpen && purchaseOrder?.purchase_order_details) {
      const initialDetails = purchaseOrder.purchase_order_details.map((d: any) => ({
        id: d.id,
        product_uom_id: d.product_uom_id || d.product_uom?.id || 0,
        qty: d.qty,
        price: d.product_uom?.franchise_price || d.price || 0,
        description: '',
        is_taxable: d.is_taxable || false,
        discount_type: d.discount_type || null,
        discount_value: d.discount_value || null,
      }))
      setDetails(initialDetails)
      setTaxId(purchaseOrder.tax_id || undefined)
      setAdditionalCharges(
        (purchaseOrder.additional_charges ?? []).map((c: any) => ({
          name: c.name || '',
          amount: c.amount || 0,
          description: c.description || '',
        }))
      )
    } else {
      setDetails([])
      setTaxId(undefined)
      setAdditionalCharges([])
    }
  }, [isOpen, purchaseOrder])

  if (!isOpen) return null

  const handlePriceChange = (index: number, value: string) => {
    const newDetails = [...details]
    newDetails[index].price = value === '' ? 0 : Number(value)
    setDetails(newDetails)
  }

  const handleQtyChange = (index: number, value: string) => {
    const newDetails = [...details]
    newDetails[index].qty = Number(value)
    setDetails(newDetails)
  }

  const handleDescriptionChange = (index: number, value: string) => {
    const newDetails = [...details]
    newDetails[index].description = value
    setDetails(newDetails)
  }

  const handleTaxableChange = (index: number, value: boolean) => {
    const newDetails = [...details]
    newDetails[index].is_taxable = value
    setDetails(newDetails)
  }

  const handleDiscountTypeChange = (index: number, value: 'percent' | 'nominal' | null) => {
    const newDetails = [...details]
    newDetails[index].discount_type = value
    if (value === null) newDetails[index].discount_value = null
    setDetails(newDetails)
  }

  const handleDiscountValueChange = (index: number, value: string) => {
    const newDetails = [...details]
    newDetails[index].discount_value = value === '' ? null : Number(value)
    setDetails(newDetails)
  }

  const handleAddCharge = () => {
    setAdditionalCharges([...additionalCharges, { name: '', amount: 0, description: '' }])
  }

  const handleChargeChange = (index: number, field: 'name' | 'amount' | 'description', value: string) => {
    const newCharges = [...additionalCharges]
    newCharges[index] = {
      ...newCharges[index],
      [field]: field === 'amount' ? (value === '' ? 0 : Number(value)) : value,
    }
    setAdditionalCharges(newCharges)
  }

  const handleRemoveCharge = (index: number) => {
    setAdditionalCharges(additionalCharges.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validCharges = additionalCharges.filter(c => c.name.trim() && c.amount > 0)
    onConfirm({ details, tax_id: taxId, additional_charges: validCharges })
  }

  const rp = (n: number | string | null | undefined) =>
    `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

  const calcLineSubtotal = (d: AcceptPODetailPayload) => {
    const gross = d.qty * d.price
    if (!d.discount_type || !d.discount_value) return gross
    if (d.discount_type === 'percent') return gross - (gross * d.discount_value / 100)
    return gross - d.discount_value
  }

  const subtotal = details.reduce((sum, d) => sum + calcLineSubtotal(d), 0)
  const taxableSubtotal = details.reduce((sum, d) => sum + (d.is_taxable ? calcLineSubtotal(d) : 0), 0)
  const selectedTax = taxes.find((t: any) => t.id === taxId)
  const taxRate = selectedTax ? selectedTax.rate : 0
  const taxAmount = taxableSubtotal * taxRate / 100
  const additionalChargesTotal = additionalCharges.reduce((sum, c) => sum + (c.amount || 0), 0)
  const totalPrice = subtotal + taxAmount + additionalChargesTotal

  const TEXT = '#1a1a1a'
  const TEXT_MUTED = '#6b7280'
  const BORDER = '#e5e7eb'
  const BG_INPUT = '#ffffff'
  const BG_WARM = '#fafafa'

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    background: BG_INPUT,
    fontSize: 13,
    color: TEXT,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
  }

  const inputCls = 'accept-po-input'

  const inputDisabled: React.CSSProperties = {
    ...inputBase,
    background: BG_WARM,
    color: TEXT_MUTED,
    cursor: 'not-allowed',
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${BORDER}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, background: '#fff', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TEXT }}>Accept Purchase Order</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: TEXT_MUTED }}>Review items, adjust prices, add charges, then accept.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} style={{ background: 'none', border: 'none', color: TEXT_MUTED, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Items Table */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
              Items ({details.length})
            </div>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: BG_WARM }}>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}` }}>Item</th>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>Qty</th>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}` }}>Unit Price</th>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>Discount</th>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>PPN</th>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}` }}>Notes</th>
                    <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}`, textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrder?.purchase_order_details?.map((item: any, i: number) => {
                    const detail = details[i]
                    if (!detail) return null
                    const lineSubtotal = calcLineSubtotal(detail)
                    const showPrice = getCanReadPrice()

                    return (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {/* Item */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.3 }}>
                            {getProductUomName(item.product_uom, item.product_uom?.product?.name)}
                          </div>
                          <div style={{ fontSize: 11.5, color: TEXT_MUTED, marginTop: 2 }}>
                            {item.product_uom?.uom?.name}
                          </div>
                        </td>
                        {/* Qty */}
                        <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                          <input
                            type="number" min="0"
                            value={detail.qty.toString()}
                            onChange={(e) => handleQtyChange(i, e.target.value)}
                            className={inputCls}
                            style={{ ...inputBase, width: 70, textAlign: 'center', margin: '0 auto', display: 'block' }}
                          />
                          <div style={{ fontSize: 10.5, color: TEXT_MUTED, marginTop: 3 }}>req: {item.qty}</div>
                        </td>
                        {/* Price */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                          <input
                            type="text" inputMode="numeric"
                            value={showPrice ? String(detail.price ?? '') : '***'}
                            disabled={!showPrice || !canEditPrice}
                            onChange={(e) => handlePriceChange(i, e.target.value.replace(/[^\d]/g, ''))}
                            className={inputCls}
                            style={!showPrice || !canEditPrice ? inputDisabled : inputBase}
                          />
                          <div style={{ fontSize: 10.5, color: TEXT_MUTED, marginTop: 3 }}>
                            default: {rp(item.product_uom?.franchise_price || item.price)}
                          </div>
                        </td>
                        {/* Discount */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <select
                              value={detail.discount_type || ''}
                              onChange={(e) => handleDiscountTypeChange(i, (e.target.value || null) as 'percent' | 'nominal' | null)}
                              disabled={!canEditPrice}
                              style={{ ...(!canEditPrice ? inputDisabled : inputBase), width: 72, padding: '6px 6px', fontSize: 12 }}
                            >
                              <option value="">None</option>
                              <option value="percent">%</option>
                              <option value="nominal">Rp</option>
                            </select>
                            <input
                              type="number" min="0"
                              value={detail.discount_value ?? ''}
                              onChange={(e) => handleDiscountValueChange(i, e.target.value)}
                              disabled={!canEditPrice || !detail.discount_type}
                              placeholder="0"
                              className={inputCls}
                              style={!canEditPrice || !detail.discount_type ? { ...inputDisabled, width: 64, padding: '6px 6px', fontSize: 12, textAlign: 'right' } : { ...inputBase, width: 64, padding: '6px 6px', fontSize: 12, textAlign: 'right' }}
                            />
                          </div>
                        </td>
                        {/* Taxable */}
                        <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="checkbox"
                            checked={detail.is_taxable || false}
                            onChange={(e) => handleTaxableChange(i, e.target.checked)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#2C1810' }}
                          />
                        </td>
                        {/* Notes */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                          <input
                            type="text"
                            value={detail.description || ''}
                            onChange={(e) => handleDescriptionChange(i, e.target.value)}
                            placeholder="Optional"
                            className={inputCls}
                            style={inputBase}
                          />
                        </td>
                        {/* Subtotal */}
                        <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: TEXT }}>
                            {showPrice ? rp(lineSubtotal) : '***'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Charges */}
          {getCanReadPrice() && canEditPrice && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Additional Charges
                </div>
                <button
                  type="button"
                  onClick={handleAddCharge}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', border: `1px solid ${BORDER}`,
                    borderRadius: 8, background: '#fff',
                    color: TEXT, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Add Charge
                </button>
              </div>
              {additionalCharges.length > 0 ? (
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: BG_WARM }}>
                        <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}` }}>Name</th>
                        <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}`, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thStyle, borderBottom: `1px solid ${BORDER}` }}>Description</th>
                        <th style={{ width: 44 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {additionalCharges.map((charge, i) => (
                        <tr key={i} style={{ borderBottom: i < additionalCharges.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="text" value={charge.name} onChange={(e) => handleChargeChange(i, 'name', e.target.value)} placeholder="e.g. Shipping" className={inputCls} style={inputBase} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="number" min="0" value={charge.amount} onChange={(e) => handleChargeChange(i, 'amount', e.target.value)} placeholder="0" className={inputCls} style={{ ...inputBase, textAlign: 'right' }} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="text" value={charge.description || ''} onChange={(e) => handleChargeChange(i, 'description', e.target.value)} placeholder="Optional" className={inputCls} style={inputBase} />
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button type="button" onClick={() => handleRemoveCharge(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 12, padding: '16px', textAlign: 'center', fontSize: 12.5, color: TEXT_MUTED }}>
                  No additional charges. Click "Add Charge" to add one.
                </div>
              )}
            </div>
          )}

          {/* Totals */}
          {getCanReadPrice() && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 280, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                {/* Tax selector row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: BG_WARM }}>
                  <span style={{ fontSize: 12.5, color: TEXT_MUTED, fontWeight: 500 }}>Tax (PPN)</span>
                  <select
                    value={taxId || ''}
                    onChange={(e) => setTaxId(e.target.value ? Number(e.target.value) : undefined)}
                    disabled={!canEditPrice}
                    style={{
                      padding: '5px 10px', border: `1px solid ${BORDER}`, borderRadius: 8,
                      background: '#fff', fontSize: 12.5, color: TEXT, outline: 'none',
                      cursor: !canEditPrice ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <option value="">No Tax</option>
                    {taxes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                    ))}
                  </select>
                </div>
                {/* Line items */}
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: TEXT_MUTED }}>Subtotal</span>
                    <span style={{ fontWeight: 500, color: TEXT }}>{rp(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: TEXT_MUTED }}>Tax ({taxRate}%)</span>
                    <span style={{ fontWeight: 500, color: TEXT }}>{rp(taxAmount)}</span>
                  </div>
                  {additionalChargesTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: TEXT_MUTED }}>Additional Charges</span>
                      <span style={{ fontWeight: 500, color: TEXT }}>{rp(additionalChargesTotal)}</span>
                    </div>
                  )}
                </div>
                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: `1px solid ${BORDER}`, background: '#faf6f3' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Total</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#2C1810' }}>{rp(totalPrice)}</span>
                </div>
              </div>
            </div>
          )}
          {!getCanReadPrice() && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_MUTED }}>Total: ***</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${BORDER}`, background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button
            type="button" onClick={onClose} disabled={isSubmitting}
            style={{
              padding: '8px 18px', border: `1px solid ${BORDER}`, borderRadius: 10,
              background: '#fff', color: TEXT, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleSubmit} disabled={isSubmitting}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: 10,
              background: '#2C1810', color: '#fff', fontSize: 13.5, fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            Accept & Update Prices
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; appearance: textfield; }
        input::placeholder { color: #9ca3af; opacity: 1; }
        input:disabled::placeholder { color: #d1d5db; }
        .accept-po-input::placeholder { color: #6b7280; opacity: 1; }
        .accept-po-input:disabled::placeholder { color: #d1d5db; }
      `}</style>
    </div>
  )
}
