'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, X, Search, ChevronLeft, Loader2 } from 'lucide-react'
import { invoicesService } from '@/services/invoices.service'
import { salesOrdersService } from '@/services/sales-orders.service'
import { PriceDisplay } from '@/components/PriceDisplay'
import { getCanReadPrice } from '@/utils/price'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'

const todayInputDate = () => new Date().toISOString().split('T')[0]

function calculateDueDate(invoiceDateStr: string): string {
  if (!invoiceDateStr) return ''
  const dateObj = new Date(invoiceDateStr)
  if (isNaN(dateObj.getTime())) return ''

  const day = dateObj.getDate()
  let dueDay = 14
  let dueMonth = dateObj.getMonth()
  let dueYear = dateObj.getFullYear()

  if (day >= 1 && day <= 7) {
    dueDay = 14
  } else if (day >= 8 && day <= 14) {
    dueDay = 21
  } else if (day >= 15 && day <= 21) {
    dueDay = 28
  } else {
    dueDay = 7
    dueMonth += 1
    if (dueMonth > 11) {
      dueMonth = 0
      dueYear += 1
    }
  }

  const result = new Date(dueYear, dueMonth, dueDay)
  const yyyy = result.getFullYear()
  const mm = String(result.getMonth() + 1).padStart(2, '0')
  const dd = String(result.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface DetailSelection {
  sales_order_detail_id: number
  qty: number
  description: string
  product_name: string
  max_qty: number
  price: number
}

interface AdditionalChargeSelection {
  sales_order_component_id?: number
  name: string
  amount: number
  max_amount?: number
  description: string
  included: boolean
}

export default function InvoiceForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canReadPrice = getCanReadPrice()

  const [date, setDate] = useState(todayInputDate())
  const [dueDate, setDueDate] = useState(() => calculateDueDate(todayInputDate()))
  const [description, setDescription] = useState('')
  const [selectedSoIds, setSelectedSoIds] = useState<number[]>([])

  // Free-form additional charges
  const [freeCharges, setFreeCharges] = useState<{ id: string, name: string, amount: number, description: string }[]>([])

  // Details tracking
  const [details, setDetails] = useState<Record<number, DetailSelection>>({})

  // SO Component charges tracking
  const [soCharges, setSoCharges] = useState<Record<number, AdditionalChargeSelection>>({})

  // Fetch all final SOs
  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: ['sales-orders', 'final'],
    queryFn: () => salesOrdersService.list({
      per_page: 100,
      'filter[status]': 'final',
      'filter[has_invoice]': 'false',
      include: 'branch,customer,sales_order_details,additional_charges',
      sort: '-created_at'
    } as any).then(res => res.data),
  })

  const availableSOs = (soData as any)?.data || []

  const handleSoSelection = (soId: number) => {
    setSelectedSoIds(prev => {
      if (prev.includes(soId)) {
        // Deselect
        const next = prev.filter(id => id !== soId)
        // Remove related details and charges
        const so = availableSOs.find((s: any) => s.id === soId)
        if (so) {
          setDetails(d => {
            const copy = { ...d }
            so.sales_order_details?.forEach((line: any) => delete copy[line.id])
            return copy
          })
          setSoCharges(c => {
            const copy = { ...c }
            so.additional_charges?.forEach((charge: any) => delete copy[charge.id])
            return copy
          })
        }
        return next
      } else {
        // First check branch rule: all must be same branch
        const newSo = availableSOs.find((s: any) => s.id === soId)
        if (prev.length > 0) {
          const firstSoId = prev[0]
          const firstSo = availableSOs.find((s: any) => s.id === firstSoId)
          if (firstSo && newSo && firstSo.branch_id !== newSo.branch_id) {
            toast.error('All selected Sales Orders must belong to the same branch.')
            return prev
          }
        }

        // Auto-populate details and charges
        if (newSo) {
          setDetails(d => {
            const copy = { ...d }
            newSo.sales_order_details?.forEach((line: any) => {
              const maxQty = line.remaining_qty ?? (line.qty - (line.delivered_qty || 0))
              if (maxQty > 0) {
                const productName = line.product_inventory_snapshot?.product_uom_batch?.product_uom?.product?.name 
                  || line.bundle_snapshot?.name 
                  || `Item #${line.id}`
                  
                copy[line.id] = {
                  sales_order_detail_id: line.id,
                  qty: maxQty,
                  max_qty: maxQty,
                  price: line.price,
                  product_name: productName,
                  description: ''
                }
              }
            })
            return copy
          })

          setSoCharges(c => {
            const copy = { ...c }
            newSo.additional_charges?.forEach((charge: any) => {
              const remaining = charge.amount - (charge.billed_amount || 0)
              if (remaining > 0) {
                copy[charge.id] = {
                  sales_order_component_id: charge.id,
                  name: charge.name,
                  amount: remaining,
                  max_amount: remaining,
                  description: charge.description || '',
                  included: true
                }
              }
            })
            return copy
          })
        }

        return [...prev, soId]
      }
    })
  }

  // Calculations
  const subtotalPrice = useMemo(() => {
    return Object.values(details).reduce((sum, d) => sum + (d.qty * d.price), 0)
  }, [details])

  const additionalChargePrice = useMemo(() => {
    let sum = 0
    Object.values(soCharges).forEach(c => {
      if (c.included) sum += Number(c.amount)
    })
    freeCharges.forEach(c => {
      sum += Number(c.amount)
    })
    return sum
  }, [soCharges, freeCharges])

  // TODO: taxes (assume fetched from SOs or just simple addition for now)
  // For now, total = subtotal + additional charges. Taxes should ideally be computed by server.
  const totalPrice = subtotalPrice + additionalChargePrice

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => {
      const payloadDetails = Object.values(details)
        .filter(d => d.qty > 0)
        .map(d => ({
          sales_order_detail_id: d.sales_order_detail_id,
          qty: Number(d.qty),
          description: d.description || undefined
        }))

      const payloadCharges = [
        ...Object.values(soCharges)
          .filter(c => c.included && c.amount > 0)
          .map(c => ({
            sales_order_component_id: c.sales_order_component_id,
            name: c.name,
            amount: Number(c.amount) === c.max_amount ? undefined : Number(c.amount), // Omit amount if full remaining
            description: c.description || undefined
          })),
        ...freeCharges
          .filter(c => c.amount > 0)
          .map(c => ({
            name: c.name,
            amount: Number(c.amount),
            description: c.description || undefined
          }))
      ]

      return invoicesService.create({
        sales_order_ids: selectedSoIds,
        date: date || undefined,
        due_date: dueDate || undefined,
        description: description || undefined,
        details: payloadDetails,
        additional_charges: payloadCharges.length > 0 ? payloadCharges : undefined
      })
    },
    onSuccess: (res: any) => {
      toast.success('Invoice created')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      const newId = res?.data?.data?.id ?? res?.data?.id
      if (newId) router.push(`/transfer/invoices/${newId}`)
      else router.push('/transfer/invoices')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to create invoice'
      toast.error(msg)
    }
  })

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: 'var(--foreground-muted)',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 20,
          fontSize: 14,
        }}
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            Create Invoice
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            Bill sales orders and additional charges
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Left Col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Data */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>General Info</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => {
                    const val = e.target.value
                    setDate(val)
                    if (val) setDueDate(calculateDueDate(val))
                  }}
                  style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface)', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 10, color: 'var(--foreground-subtle)', marginTop: 4, lineHeight: 1.3 }}>
                  Patokan: Tgl 1-7 (14), 8-14 (21), 15-21 (28), 22-akhir (7 bulan dpn)
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Description</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional note"
                  style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface)', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Sales Orders */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>Sales Orders</h3>
            {soLoading ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading sales orders...</p>
            ) : availableSOs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '12px 0', textAlign: 'center' }}>
                No sales orders available to invoice.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {availableSOs.map((so: any) => {
                  const isSelected = selectedSoIds.includes(so.id)
                  const branchMatched = selectedSoIds.length === 0 || availableSOs.find((s: any) => s.id === selectedSoIds[0])?.branch_id === so.branch_id
                  const disabled = !isSelected && !branchMatched

                  return (
                    <div
                      key={so.id}
                      onClick={() => !disabled && handleSoSelection(so.id)}
                      style={{
                        padding: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--accent-light-bg)' : disabled ? 'var(--background)' : 'var(--surface)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: isSelected ? 'var(--accent)' : 'var(--foreground)' }}>{so.code}</span>
                        <input type="checkbox" readOnly checked={isSelected} style={{ pointerEvents: 'none' }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4 }}>
                        {so.branch?.name} · <PriceDisplay amount={so.total_price} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Details */}
          {selectedSoIds.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>Lines to Bill</h3>
              {Object.values(details).length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>No billable lines remaining in selected orders.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.values(details).map(d => (
                    <div key={d.sales_order_detail_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{d.product_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Max: {d.max_qty} remaining</div>
                      </div>
                      <div>
                        <input
                          type="number"
                          value={d.qty}
                          min="0"
                          max={d.max_qty}
                          onChange={e => setDetails({ ...details, [d.sales_order_detail_id]: { ...d, qty: Number(e.target.value) } })}
                          style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 13 }}
                        />
                      </div>
                      <div style={{ fontSize: 13, textAlign: 'right' }}>
                        <PriceDisplay amount={d.price} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                        <PriceDisplay amount={d.qty * d.price} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Additional Charges */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>Additional Charges</h3>

            {/* SO Charges */}
            {Object.values(soCharges).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', marginBottom: 8 }}>From Sales Orders</h4>
                {Object.values(soCharges).map(c => (
                  <div key={c.sales_order_component_id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={c.included} onChange={e => setSoCharges({ ...soCharges, [c.sales_order_component_id as number]: { ...c, included: e.target.checked } })} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</span>
                      </label>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Max: <PriceDisplay amount={c.max_amount} /></span>
                    </div>
                    {c.included && (
                      <input
                        type="number"
                        value={c.amount}
                        min="0"
                        max={c.max_amount}
                        onChange={e => setSoCharges({ ...soCharges, [c.sales_order_component_id as number]: { ...c, amount: Number(e.target.value) } })}
                        style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 13 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Free form charges */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Custom Charges</h4>
              {freeCharges.map((fc, idx) => (
                <div key={fc.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <input
                      placeholder="Charge Name"
                      value={fc.name}
                      onChange={e => {
                        const copy = [...freeCharges]; copy[idx].name = e.target.value; setFreeCharges(copy)
                      }}
                      style={{ width: '60%', height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 13 }}
                    />
                    <button onClick={() => setFreeCharges(f => f.filter(x => x.id !== fc.id))} style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={fc.amount}
                    onChange={e => {
                      const copy = [...freeCharges]; copy[idx].amount = Number(e.target.value); setFreeCharges(copy)
                    }}
                    style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 13 }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFreeCharges(f => [...f, { id: Math.random().toString(), name: '', amount: 0, description: '' }])}
                style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--foreground-muted)', cursor: 'pointer', fontSize: 13 }}
              >
                <Plus size={14} /> Add Custom Charge
              </button>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--foreground-muted)' }}>Subtotal</span>
              <span><PriceDisplay amount={subtotalPrice} /></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--foreground-muted)' }}>Additional Charges</span>
              <span><PriceDisplay amount={additionalChargePrice} /></span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 18, fontWeight: 700 }}>
              <span>Total</span>
              <span><PriceDisplay amount={totalPrice} /></span>
            </div>

            <button
              onClick={() => {
                if (selectedSoIds.length === 0) return toast.error('Select at least one Sales Order')
                create()
              }}
              disabled={isPending || selectedSoIds.length === 0}
              style={{
                width: '100%',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 600,
                cursor: isPending || selectedSoIds.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isPending || selectedSoIds.length === 0 ? 0.7 : 1
              }}
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              Save Invoice
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
