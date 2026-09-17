'use client'
import { formatDate } from '@/utils/date'

import React, { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { paymentsService } from '@/services/payments.service'
import { suppliersService } from '@/services/suppliers.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { useAuth } from '@/hooks/useAuth'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import { CreditCard, Loader2, Ban, Wallet } from 'lucide-react'

const rp = (n: number | string | null | undefined) =>
  `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

const todayInputDate = () => new Date().toISOString().split('T')[0]

interface SupplierPO {
  id: number
  code: string
  date: string
  total_price: number
  supplier?: { id: number; name: string }
}

interface DisbursePayment {
  id: number
  payment_number?: string
  amount: number
  date?: string
  created_at?: string
  description?: string
  is_reversed?: boolean
  payment_method?: { id: number; name: string }
  allocations?: { purchase_order_id?: number; amount: number }[]
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 6,
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
  fontSize: 13,
}

export default function POPaymentsView() {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canPay = hasPermission('payment.create')

  const [supplierId, setSupplierId] = useState<number>(0)
  const [allocations, setAllocations] = useState<Record<number, number>>({})
  const [paymentMethodId, setPaymentMethodId] = useState<number>(0)
  const [date, setDate] = useState<string>(todayInputDate())
  const [description, setDescription] = useState('')
  const [voidConfirmId, setVoidConfirmId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')

  // ── Dropdown sources ──────────────────────────────────────────────────────
  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-all', debouncedDropdownSearch],
    queryFn: () => suppliersService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const suppliers: any[] = (suppliersData as any)?.data ?? []
  const supplierOptions = suppliers.map((s: any) => ({
    value: s.id as number,
    label: (s.name as string) ?? `Supplier #${s.id}`,
    sublabel: s.code as string | undefined,
  }))

  const { data: paymentMethodsData } = useQuery({
    queryKey: ['payment-methods-all', debouncedDropdownSearch],
    queryFn: () =>
      paymentMethodsService.list({
        'filter[search]': debouncedDropdownSearch || undefined,
        per_page: 100,
        sort: 'id',
        'filter[type]': 'purchase_orders',
        include: 'bank_account',
      } as any).then((r) => r.data),
  })
  const paymentMethods: any[] = (paymentMethodsData as any)?.data ?? []
  const selectedPaymentMethod = paymentMethods.find((pm: any) => pm.id === paymentMethodId)

  // ── Supplier's POs ────────────────────────────────────────────────────────
  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['po-payments-pos', supplierId],
    enabled: supplierId > 0,
    queryFn: () =>
      purchaseOrdersService
        .list({
          per_page: 100,
          sort: '-created_at',
          'filter[type]': 'supplier',
          'filter[supplier_id]': supplierId,
          include: 'supplier,purchase_order_details',
        } as any)
        .then((r) => r.data),
  })
  const supplierPOs: SupplierPO[] = (posData as any)?.data ?? []

  // ── All disburse payments, fetched once — used to derive paid/outstanding ──
  const { data: disburseData, isLoading: disburseLoading } = useQuery({
    queryKey: ['po-disburse-payments'],
    queryFn: () =>
      paymentsService
        .list({
          per_page: 200,
          include: 'allocations',
          'filter[type]': 'disburse',
        } as any)
        .then((r) => r.data),
  })
  const disbursePayments: DisbursePayment[] = (disburseData as any)?.data ?? []

  const paidByPoId = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of disbursePayments) {
      if (p.is_reversed) continue
      for (const a of p.allocations ?? []) {
        if (a.purchase_order_id == null) continue
        const poId = Number(a.purchase_order_id)
        map.set(poId, (map.get(poId) ?? 0) + Number(a.amount ?? 0))
      }
    }
    return map
  }, [disbursePayments])

  const poRows = useMemo(() => {
    return supplierPOs
      .map((po) => {
        const totalPaid = paidByPoId.get(Number(po.id)) ?? 0
        const outstanding = Number(po.total_price ?? 0) - totalPaid
        return { po, totalPaid, outstanding }
      })
      .filter((row) => row.outstanding > 0)
  }, [supplierPOs, paidByPoId])

  const totalPayment = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + Number(v || 0), 0),
    [allocations],
  )

  const toggleAllocation = (poId: number, outstanding: number, checked: boolean) => {
    setAllocations((prev) => {
      const next = { ...prev }
      if (checked) {
        next[poId] = outstanding
      } else {
        delete next[poId]
      }
      return next
    })
  }

  const setAllocationAmount = (poId: number, outstanding: number, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '')
    let value = digits === '' ? 0 : parseInt(digits, 10)
    if (value > outstanding) {
      value = outstanding
      toast.warning('Amount capped at outstanding balance')
    }
    if (value < 0) value = 0
    setAllocations((prev) => ({ ...prev, [poId]: value }))
  }

  const resetForm = () => {
    setAllocations({})
    setPaymentMethodId(0)
    setDescription('')
    setDate(todayInputDate())
  }

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['po-disburse-payments'] })
    qc.invalidateQueries({ queryKey: ['po-payments-pos', supplierId] })
    qc.invalidateQueries({ queryKey: ['po-payments-history'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      paymentsService.create({
        type: 'disburse',
        date,
        payments: [{
          payment_method_id: paymentMethodId,
          amount: totalPayment,
          description: description || undefined,
          allocations: Object.entries(allocations).map(([poId, amount]) => ({
            purchase_order_id: Number(poId),
            amount,
          })),
        }]
      } as any),
    onSuccess: () => {
      invalidateAll()
      toast.success('Payment recorded')
      resetForm()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to record payment'),
  })

  const allocationEntries = Object.entries(allocations).filter(([, amt]) => amt > 0)
  const canSubmit =
    canPay &&
    allocationEntries.length > 0 &&
    paymentMethodId > 0 &&
    !createMutation.isPending

  const handleSubmit = () => {

    if (allocationEntries.length === 0) {
      toast.error('Select at least one purchase order to pay')
      return
    }
    if (paymentMethodId === 0) {
      toast.error('Select a payment method')
      return
    }
    for (const [poId, amt] of allocationEntries) {
      const row = poRows.find((r) => r.po.id === Number(poId))
      if (!row || amt <= 0 || amt > row.outstanding) {
        toast.error('One or more allocation amounts are invalid')
        return
      }
    }
    createMutation.mutate()
  }

  // ── Past PO payments history ─────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['po-payments-history'],
    queryFn: () =>
      paymentsService
        .list({ 'filter[search]': debouncedDropdownSearch || undefined, 
          per_page: 50,
          sort: '-created_at',
          include: 'payment_method,allocations',
          'filter[type]': 'disburse',
         } as any)
        .then((r) => r.data),
  })
  const history: DisbursePayment[] = (historyData as any)?.data ?? []

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      paymentsService.void(id, { reason }),
    onSuccess: () => {
      invalidateAll()
      toast.success('Payment voided')
      setVoidConfirmId(null)
      setVoidReason('')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to void payment'),
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Payment PO
        </h1>
        <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Record a disbursement to a supplier, allocated across one or more outstanding purchase orders
        </p>
      </div>

      {!canPay && (
        <div
          style={{
            ...sectionStyle,
            borderColor: 'var(--warning)',
            background: 'var(--warning-bg)',
            color: 'var(--warning)',
            fontSize: 13,
          }}
        >
          You do not have permission to record PO payments. Showing payment history only.
        </div>
      )}

      {canPay && (
        <>
          {/* Supplier picker */}
          <div style={sectionStyle}>
            <span style={labelStyle}>Supplier</span>
            <SearchableSelect
              value={supplierId}
              onChange={(v) => {
                setSupplierId(Number(v))
                setAllocations({})
              }}
              options={supplierOptions}
              placeholder="Select supplier..."
              searchPlaceholder="Search suppliers..."
              loading={suppliersLoading}
              onSearchChange={setDropdownSearch}
/>
          </div>

          {/* Outstanding POs */}
          {supplierId > 0 && (
            <div style={sectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                  Outstanding Purchase Orders
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {poRows.length} order(s) with a balance
                </span>
              </div>

              {posLoading || disburseLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                  Loading purchase orders...
                </div>
              ) : poRows.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 13,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No outstanding purchase orders for this supplier
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--background)' }}>
                        <th style={{ ...thStyle, width: 36 }} />
                        <th style={thStyle}>Code</th>
                        <th style={thStyle}>Date</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Paid</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                        <th style={thStyle}>Status</th>
                        <th style={{ ...thStyle, width: 160 }}>Pay Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poRows.map(({ po, totalPaid, outstanding }) => {
                        const checked = po.id in allocations
                        const isPartial = totalPaid > 0
                        const badge = isPartial
                          ? { label: 'Partial', color: 'var(--warning)', bg: 'var(--warning-bg)' }
                          : { label: 'Unpaid', color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
                        return (
                          <tr key={po.id}>
                            <td style={tdStyle}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleAllocation(po.id, outstanding, e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace' }}>{po.code}</td>
                            <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                              {po.date ? formatDate(po.date) : '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{rp(po.total_price)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--success)' }}>{rp(totalPaid)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--destructive)' }}>
                              {rp(outstanding)}
                            </td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 10px',
                                  borderRadius: 99,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: badge.bg,
                                  color: badge.color,
                                }}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={!checked}
                                value={checked ? (allocations[po.id] ?? 0).toLocaleString('id-ID') : ''}
                                placeholder="0"
                                onChange={(e) => setAllocationAmount(po.id, outstanding, e.target.value)}
                                style={{
                                  ...inputBase,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  textAlign: 'right',
                                  background: checked ? 'var(--surface)' : 'var(--background)',
                                  cursor: checked ? 'text' : 'not-allowed',
                                }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payment header + submit */}
          {supplierId > 0 && poRows.length > 0 && (
            <div style={sectionStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 16 }}>
                Payment Details
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <span style={labelStyle}>Payment Method</span>
                  <select
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                    style={{ ...inputBase, cursor: 'pointer' }}
                  >
                    <option value={0} disabled>
                      Select method
                    </option>
                    {paymentMethods.map((pm: any) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.bank_account_id
                          ? `${pm.bank_account?.bank_name ?? pm.name} ${pm.bank_account?.account_number ?? ''}`
                          : pm.name}
                      </option>
                    ))}
                  </select>
                  {selectedPaymentMethod?.bank_account_id && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        Bank: {selectedPaymentMethod.bank_account?.bank_name} ({selectedPaymentMethod.bank_account?.account_number})
                      </span>
                      {!selectedPaymentMethod.chart_of_account_id && (
                        <span style={{ fontSize: 12, color: 'var(--warning)' }}>
                          This bank account has no Chart of Account assigned. Payment cannot proceed until the CoA is set on the bank account.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <span style={labelStyle}>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={inputBase}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={labelStyle}>Description (optional)</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Transfer BCA for June deliveries"
                  style={inputBase}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 16,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wallet size={16} color="var(--accent)" />
                  <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Total Payment:</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                    {rp(totalPayment)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 18px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: canSubmit ? 1 : 0.6,
                  }}
                >
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Create Payment
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* History */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Past PO Payments</span>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{history.length} payment(s)</span>
        </div>

        {historyLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            <CreditCard size={28} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
            <div>No PO payments recorded yet</div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                  <th style={thStyle}>Payment No</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Method</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={thStyle}>Allocated POs</th>
                  <th style={{ ...thStyle, width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {history.map((p, idx) => {
                  const isVoiding = voidMutation.isPending && voidMutation.variables?.id === p.id
                  return (
                    <tr key={p.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>
                        {p.payment_number ?? `PMT-${p.id}`}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                        {formatDate(p.date ?? p.created_at)}
                      </td>
                      <td style={tdStyle}>{p.payment_method?.name ?? '—'}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontWeight: 600,
                          textDecoration: p.is_reversed ? 'line-through' : 'none',
                        }}
                      >
                        {rp(p.amount)}
                      </td>
                      <td style={tdStyle}>
                        {(p.allocations ?? []).filter((a) => a.purchase_order_id != null).length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {(p.allocations ?? [])
                              .filter((a) => a.purchase_order_id != null)
                              .map((a, idx) => (
                                <span key={idx} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)' }}>
                                  PO-{a.purchase_order_id} ({rp(a.amount)})
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--foreground-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {canPay && !p.is_reversed && (
                          <button
                            type="button"
                            onClick={() => setVoidConfirmId(p.id)}
                            title="Void"
                            style={{
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--foreground-muted)',
                              display: 'inline-flex',
                            }}
                          >
                            {isVoiding ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Void confirm dialog */}
      {voidConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => {
              setVoidConfirmId(null)
              setVoidReason('')
            }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 380,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Void Payment
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 16px' }}>
              Are you sure you want to void this payment? This will reverse the journal entries and free up the
              purchase order&apos;s outstanding balance.
            </p>
            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>Reason for voiding</span>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate payment, wrong amount"
                autoFocus
                style={inputBase}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setVoidConfirmId(null)
                  setVoidReason('')
                }}
                style={{
                  padding: '7px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  voidConfirmId !== null &&
                  voidReason.trim() &&
                  voidMutation.mutate({ id: voidConfirmId, reason: voidReason.trim() })
                }
                disabled={voidMutation.isPending || voidReason.trim().length === 0}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor:
                    voidMutation.isPending || voidReason.trim().length === 0 ? 'not-allowed' : 'pointer',
                  opacity: voidMutation.isPending || voidReason.trim().length === 0 ? 0.6 : 1,
                }}
              >
                {voidMutation.isPending ? 'Voiding...' : 'Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
