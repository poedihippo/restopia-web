'use client'

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentsService } from '@/services/payments.service'
import { X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/utils/price'

interface AllocateModalProps {
  payment: any
  onClose: () => void
}

export default function AllocateModal({ payment, onClose }: AllocateModalProps) {
  const qc = useQueryClient()
  const [orderType, setOrderType] = useState<'so' | 'po' | 'invoice'>('so')
  const [orderId, setOrderId] = useState('')
  const [amount, setAmount] = useState(payment.amount.toString())

  const allocateMutation = useMutation({
    mutationFn: () => {
      const payload = {
        allocations: [
          {
            amount: parseFloat(amount),
            sales_order_id: orderType === 'so' ? parseInt(orderId) : undefined,
            purchase_order_id: orderType === 'po' ? parseInt(orderId) : undefined,
            invoice_id: orderType === 'invoice' ? parseInt(orderId) : undefined,
          }
        ]
      }
      return paymentsService.allocate(payment.id, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment allocated')
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to allocate payment')
    },
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', zIndex: 110, width: 440, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: 0 }}>Allocate Payment</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}>
            <X size={18} />
          </button>
        </div>
        
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: 'var(--foreground-muted)' }}>Payment Amount:</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as 'so' | 'po' | 'invoice')}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', fontSize: 14 }}
            >
              <option value="so">Sales Order</option>
              <option value="po">Purchase Order</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Order ID</label>
            <input
              type="number"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. 1"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Amount to Allocate</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--background)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button
            type="button"
            onClick={() => allocateMutation.mutate()}
            disabled={allocateMutation.isPending || !orderId}
            style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (allocateMutation.isPending || !orderId) ? 0.7 : 1 }}
          >
            {allocateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Allocate
          </button>
        </div>
      </div>
    </div>
  )
}
