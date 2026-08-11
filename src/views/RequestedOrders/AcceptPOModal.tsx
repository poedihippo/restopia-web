import React, { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'

export interface AcceptPODetailPayload {
  id?: number
  product_uom_id: number
  qty: number
  price: number
  description?: string
}

export interface AcceptPOModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: { details: AcceptPODetailPayload[] }) => void
  isSubmitting: boolean
  purchaseOrder: any // RequestedPO object
}

export default function AcceptPOModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  purchaseOrder,
}: AcceptPOModalProps) {
  const [details, setDetails] = useState<AcceptPODetailPayload[]>([])

  useEffect(() => {
    if (isOpen && purchaseOrder?.purchase_order_details) {
      const initialDetails = purchaseOrder.purchase_order_details.map((d: any) => ({
        id: d.id,
        product_uom_id: d.product_uom_id || d.product_uom?.id || 0,
        qty: d.qty,
        price: d.product_uom?.franchise_price || d.price || 0,
        description: '',
      }))
      setDetails(initialDetails)
    } else {
      setDetails([])
    }
  }, [isOpen, purchaseOrder])

  if (!isOpen) return null

  const handlePriceChange = (index: number, value: string) => {
    const newDetails = [...details]
    newDetails[index].price = Number(value)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm({ details })
  }

  const rp = (n: number | string | null | undefined) =>
    `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
              Accept Purchase Order
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
              Review the requested items and adjust prices if necessary before accepting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--foreground-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0 8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>Item</th>
                <th style={{ textAlign: 'center', padding: '0 8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>Qty</th>
                <th style={{ textAlign: 'left', padding: '0 8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>Price per unit</th>
                <th style={{ textAlign: 'left', padding: '0 8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrder?.purchase_order_details?.map((item: any, i: number) => {
                const detail = details[i]
                if (!detail) return null

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                        {item.product_uom?.product?.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        {item.product_uom?.uom?.name}
                      </div>
                    </td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={detail.qty.toString()}
                        onChange={(e) => handleQtyChange(i, e.target.value)}
                        placeholder="Qty..."
                        style={{
                          width: 80,
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          fontSize: 13,
                          color: 'var(--foreground)',
                          outline: 'none',
                          textAlign: 'center'
                        }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4 }}>
                        Req: {item.qty}
                      </div>
                    </td>
                    <td style={{ padding: '16px 8px' }}>
                      <input
                        type="number"
                        value={detail.price.toString()}
                        onChange={(e) => handlePriceChange(i, e.target.value)}
                        placeholder="Price..."
                        style={{
                          width: 120,
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          fontSize: 13,
                          color: 'var(--foreground)',
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4 }}>
                        Default: {rp(item.product_uom?.franchise_price || item.price)}
                      </div>
                    </td>
                    <td style={{ padding: '16px 8px' }}>
                      <input
                        type="text"
                        value={detail.description || ''}
                        onChange={(e) => handleDescriptionChange(i, e.target.value)}
                        placeholder="Optional notes..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          fontSize: 13,
                          color: 'var(--foreground)',
                          outline: 'none',
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 16, textAlign: 'right', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
            Total: {rp(details.reduce((sum, d) => sum + d.qty * d.price, 0))}
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isSubmitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            Accept & Update Prices
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
