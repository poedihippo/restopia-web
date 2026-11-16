'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentsService } from '@/services/payments.service'
import { X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/utils/price'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { parseNumberId } from '@/utils/numberFormat'
import SearchableSelect from '@/components/SearchableSelect'
import { salesOrdersService } from '@/services/sales-orders.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { invoicesService } from '@/services/invoices.service'

interface AllocateModalProps {
  payment: any
  onClose: () => void
}

export default function AllocateModal({ payment, onClose }: AllocateModalProps) {
  const qc = useQueryClient()
  const [orderType, setOrderType] = useState<'so' | 'po' | 'invoice'>('so')
  const [orderId, setOrderId] = useState('')
  const [amount, setAmount] = useState(() => parseNumberId(payment.amount))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setOrderId(''); setSearch('') }, [orderType])

  // Pick the document by its number (filter[search] matches `code`) instead of
  // typing a raw database id.
  const { data: docsData, isFetching: docsLoading } = useQuery({
    queryKey: ['allocate-documents', orderType, debouncedSearch],
    queryFn: () => {
      const include = orderType === 'po' ? 'supplier,supplier_branch' : orderType === 'invoice' ? 'billed_branch' : undefined
      const params = { per_page: 20, sort: '-id', include, 'filter[search]': debouncedSearch || undefined } as any
      const svc: any = orderType === 'so' ? salesOrdersService : orderType === 'po' ? purchaseOrdersService : invoicesService
      return svc.list(params).then((r: any) => r.data)
    },
  })
  const docOptions = useMemo(() => {
    const rows: any[] = (docsData as any)?.data ?? []
    return rows.map((d) => {
      const party = d.customer_name ?? d.customer?.name ?? d.supplier?.name ?? d.supplier_branch?.name ?? d.billed_branch?.name
      const outstanding = Number(d.total_price ?? 0) - Number(d.total_payment ?? 0)
      return {
        value: String(d.id),
        label: d.code || `#${d.id}`,
        sublabel: [party, `Outstanding ${formatCurrency(outstanding)}`].filter(Boolean).join(' · '),
      }
    })
  }, [docsData])

  const allocateMutation = useMutation({
    mutationFn: () => {
      const payload = {
        allocations: [
          {
            amount: Number(amount) || 0,
            sales_order_id: orderType === 'so' ? Number(orderId) : undefined,
            purchase_order_id: orderType === 'po' ? Number(orderId) : undefined,
            invoice_id: orderType === 'invoice' ? Number(orderId) : undefined,
          }
        ]
      }
      return paymentsService.allocate(payment.id, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['sales-order-payment-allocations'] })
      qc.invalidateQueries({ queryKey: ['sales-order-detail'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['unpaid-offline-orders'] })
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
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Document</label>
            <SearchableSelect
              value={orderId}
              onChange={(v) => setOrderId(String(v ?? ''))}
              options={docOptions}
              placeholder="Select document..."
              searchPlaceholder="Search by number..."
              loading={docsLoading}
              onSearchChange={setSearch}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Amount to Allocate</label>
            <LocalizedNumberInput
              value={amount}
              onChange={setAmount}
              decimals={2}
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
