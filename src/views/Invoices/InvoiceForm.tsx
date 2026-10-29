'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, X, Search, ChevronLeft, Loader2 } from 'lucide-react'
import { invoicesService } from '@/services/invoices.service'
import { salesOrdersService } from '@/services/sales-orders.service'
import { salesChannelsService } from '@/services/sales-channels.service'
import { branchesService } from '@/services/branches.service'
import { PriceDisplay } from '@/components/PriceDisplay'
import { getCanReadPrice } from '@/utils/price'
import { formatDate } from '@/utils/date'
import SearchableSelect from '@/components/SearchableSelect'
import { chartOfAccountsService } from '@/services/accounting.service'
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

/** Baris Sales Order yang dipakai di halaman create invoice. */
interface InvoiceSoLine {
  id: number
  qty?: number
  price?: number
  received_qty?: number
  invoiced_qty?: number
  billable_qty?: number
  product_uom_snapshot?: { product?: { name?: string }; uom?: { name?: string } } | null
  product_inventory_snapshot?: {
    product_uom_batch?: { product_uom?: { product?: { name?: string } } }
  } | null
  bundle_snapshot?: { name?: string } | null
}

interface InvoiceSoRow {
  id: number
  branch_id?: number
  buyer_branch_id?: number | null
  code?: string
  type?: string
  date?: string
  total_price?: number
  branch?: { id?: number; name?: string; type?: string } | null
  buyer_branch?: { id?: number; name?: string } | null
  sales_channel?: { id?: number; name?: string } | null
  sales_order_details?: InvoiceSoLine[]
  additional_charges?: Array<{
    id: number
    name?: string
    amount?: number
    billed_amount?: number
    description?: string
  }>
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
  const [freeCharges, setFreeCharges] = useState<{ id: string, name: string, chart_of_account_id: number, amount: number, description: string }[]>([])

  // Details tracking
  const [details, setDetails] = useState<Record<number, DetailSelection>>({})

  // SO Component charges tracking
  const [soCharges, setSoCharges] = useState<Record<number, AdditionalChargeSelection>>({})

  // ── Filter Sales Orders (disamakan dengan menu Sales Orders) ───────────────
  const [soSearch, setSoSearch] = useState('')
  const [soSearchDebounced, setSoSearchDebounced] = useState('')
  const [soSettlement, setSoSettlement] = useState('')
  const [soPayment, setSoPayment] = useState('')
  const [soCreditType, setSoCreditType] = useState('')
  const [soType, setSoType] = useState('')
  const [soChannel, setSoChannel] = useState<string | number>('')
  const [soDateGte, setSoDateGte] = useState('')
  const [soDateLte, setSoDateLte] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSoSearchDebounced(soSearch), 400)
    return () => clearTimeout(t)
  }, [soSearch])

  const soFilterControl: React.CSSProperties = {
    height: 36,
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }
  const soFilterLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  }
  const soTh: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
    background: 'var(--background)',
  }
  const soTd: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }

  // Opsi filter & resolver outlet (untuk ditampilkan di kartu SO)
  const { data: channelData } = useQuery({
    queryKey: ['invoice-so-filter-channels'],
    queryFn: () => salesChannelsService.list({ per_page: 100, sort: 'name' }).then((r) => r.data),
  })
  const channelOptions = ((channelData as unknown as { data?: { id: number; name?: string }[] } | undefined)?.data ?? [])

  const { data: branchData } = useQuery({
    queryKey: ['invoice-so-filter-branches'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' }).then((r) => r.data),
  })
  const branchList = ((branchData as unknown as { data?: { id: number; name?: string }[] } | undefined)?.data ?? [])
  // Outlet yang mau di-invoice: buyer_branch (SO dari production/warehouse ke
  // outlet) → fallback resolve via branches endpoint (buyer_branch_id) → bila
  // SO milik outlet, branch-nya sendiri yang menjadi outlet.
  const outletNameOf = (so: {
    buyer_branch?: { name?: string } | null
    buyer_branch_id?: number | null
    branch?: { name?: string; type?: string } | null
  }): string =>
    so?.buyer_branch?.name ??
    branchList.find((b) => b.id === so?.buyer_branch_id)?.name ??
    (String(so?.branch?.type ?? '').toLowerCase() === 'outlet' ? so?.branch?.name : undefined) ??
    '—'

  // Fetch final SOs yang belum di-invoice (filter status/has_invoice dikunci
  // karena aturan bisnis invoice; filter lain menyusul seperti menu Sales Order)
  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: [
      'sales-orders', 'final',
      soSearchDebounced, soSettlement, soPayment, soCreditType, soType,
      soChannel, soDateGte, soDateLte,
    ],
    queryFn: () => salesOrdersService.list({
      per_page: 100,
      'filter[status]': 'final',
      'filter[has_invoice]': 'false',
      'filter[search]': soSearchDebounced || undefined,
      'filter[settlement_status]': soSettlement || undefined,
      'filter[payment_status]': soPayment || undefined,
      'filter[credit_type]': soCreditType || undefined,
      'filter[type]': soType || undefined,
      'filter[sales_channel_id]': soChannel === '' ? undefined : Number(soChannel),
      'filter[date_gte]': soDateGte || undefined,
      'filter[date_lte]': soDateLte || undefined,
      include: 'branch,buyer_branch,customer,sales_channel,sales_order_details,additional_charges',
      sort: '-created_at'
    } as any).then(res => res.data),
  })

  const availableSOs = ((soData as unknown as { data?: InvoiceSoRow[] } | undefined)?.data ?? [])

  // Chart of accounts for standalone (custom) charges — required by the API.
  const { data: coaData, isLoading: coaLoading } = useQuery({
    queryKey: ['chart-of-accounts-all', 'charges'],
    queryFn: () =>
      chartOfAccountsService
        .list({ per_page: 1000, sort: 'code', 'filter[is_active]': 'true' } as any)
        .then(r => (r.data as any)?.data ?? []),
  })
  const coaChargeOptions = ((coaData as any) ?? []).map((coa: any) => ({
    value: coa.id as number,
    label: (coa.name as string) ?? `COA #${coa.id}`,
    sublabel: (coa.code as string) ?? undefined,
  }))

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
              // Kuantitas yang bisa ditagih:
              // 1) pakai billable_qty backend (received - sudah ditagih) bila > 0;
              // 2) bila backend kirim 0 karena penerimaan belum tercatat
              //    (mis. SO franchise / auto-created dari PO), pakai
              //    qty - invoiced_qty supaya qty yang dipesan tetap bisa ditagih;
              // 3) baris yang sudah ditagih penuh tetap 0 → input disabled.
              const orderedQty = Number(line.qty ?? 0)
              const invoicedQty = Number(line.invoiced_qty ?? 0)
              const receivedQty = Number(line.received_qty ?? 0)
              const billableQty = Number(line.billable_qty ?? 0)
              const maxQty =
                billableQty > 0
                  ? billableQty
                  : invoicedQty === 0 && receivedQty === 0
                    ? Math.max(0, orderedQty - invoicedQty)
                    : billableQty
              // Nama produk dari snapshot product-UOM (payload SO selalu
              // membawanya); fallback ke snapshot inventory/bundle lama.
              const productName =
                line.product_uom_snapshot?.product?.name
                || line.product_inventory_snapshot?.product_uom_batch?.product_uom?.product?.name
                || line.bundle_snapshot?.name
                || `Item #${line.id}`
              const uomName = line.product_uom_snapshot?.uom?.name
              const displayName = uomName ? `${productName} (${uomName})` : productName

              copy[line.id] = {
                sales_order_detail_id: line.id,
                qty: maxQty,
                max_qty: maxQty,
                price: line.price,
                product_name: displayName,
                description: ''
              }
            })
            return copy
          })

          setSoCharges(c => {
            const copy = { ...c }
            newSo.additional_charges?.forEach((charge: any) => {
              const amount = Number(charge.amount ?? 0)
              const remaining = amount - Number(charge.billed_amount || 0)
              // Remaining may be positive or negative (deduction); a zero
              // charge stays billable as a zero invoice charge.
              if (remaining !== 0 || amount === 0) {
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
          .filter(c => c.included)
          .map(c => ({
            sales_order_component_id: c.sales_order_component_id,
            name: c.name,
            // Omitting the amount bills the full remaining amount (any sign)
            amount: Number(c.amount) === c.max_amount ? undefined : Number(c.amount),
            description: c.description || undefined
          })),
        ...freeCharges
          .filter(c => c.name.trim())
          .map(c => ({
            name: c.name.trim(),
            chart_of_account_id: c.chart_of_account_id,
            amount: Number(c.amount) || 0,
            description: c.description || undefined
          }))
      ]

      return invoicesService.create({
        sales_order_ids: selectedSoIds,
        // `date` wajib menurut CreateInvoiceRequest (openapi) — jangan pernah kosong
        date: date || todayInputDate(),
        description: description || undefined,
        details: payloadDetails,
        additional_charges: payloadCharges.length > 0 ? payloadCharges : undefined
        // Catatan: `due_date` TIDAK ada di CreateInvoiceRequest (openapi);
        // backend menurunkannya sendiri (lihat field due_date di InvoiceResponse).
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
                  style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box' }}
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
                  style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Sales Orders */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>Sales Orders</h3>

            {/* Filter — disamakan dengan menu Sales Orders */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Search</span>
                <input
                  value={soSearch}
                  onChange={(e) => setSoSearch(e.target.value)}
                  placeholder="Code / customer..."
                  style={{ ...soFilterControl, width: 200 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Settlement</span>
                <select value={soSettlement} onChange={(e) => setSoSettlement(e.target.value)} style={soFilterControl}>
                  <option value="">All Settlements</option>
                  <option value="pending">Pending</option>
                  <option value="credit">Credit</option>
                  <option value="settled">Settled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Payment</span>
                <select value={soPayment} onChange={(e) => setSoPayment(e.target.value)} style={soFilterControl}>
                  <option value="">All Payments</option>
                  <option value="pending">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Credit Type</span>
                <select value={soCreditType} onChange={(e) => setSoCreditType(e.target.value)} style={soFilterControl}>
                  <option value="">All Credit Types</option>
                  <option value="user">Staff (user)</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Type</span>
                <select value={soType} onChange={(e) => setSoType(e.target.value)} style={soFilterControl}>
                  <option value="">All Types</option>
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                  <option value="franchise">Franchise</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Sales Channel</span>
                <select
                  value={soChannel === '' ? '' : String(soChannel)}
                  onChange={(e) => setSoChannel(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...soFilterControl, minWidth: 150 }}
                >
                  <option value="">All Channels</option>
                  {channelOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={soFilterLabel}>Order Date</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" value={soDateGte} onChange={(e) => setSoDateGte(e.target.value)} style={soFilterControl} />
                  <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>–</span>
                  <input type="date" value={soDateLte} onChange={(e) => setSoDateLte(e.target.value)} style={soFilterControl} />
                </div>
              </div>
            </div>

            {soLoading ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading sales orders...</p>
            ) : availableSOs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '12px 0', textAlign: 'center' }}>
                No sales orders available to invoice.
              </p>
            ) : (
              /* List SO berbentuk tabel (bukan kartu) */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th style={{ ...soTh, width: 40 }} />
                      <th style={soTh}>Code</th>
                      <th style={soTh}>Branch</th>
                      <th style={{ ...soTh, width: 210 }}>Outlet</th>
                      <th style={soTh}>Order Date</th>
                      <th style={{ ...soTh, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableSOs.map((so) => {
                      const isSelected = selectedSoIds.includes(so.id)
                      const branchMatched = selectedSoIds.length === 0 || availableSOs.find((s) => s.id === selectedSoIds[0])?.branch_id === so.branch_id
                      const disabled = !isSelected && !branchMatched

                      return (
                        <tr
                          key={so.id}
                          onClick={() => !disabled && handleSoSelection(so.id)}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-light-bg)' : 'transparent',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.5 : 1,
                          }}
                        >
                          <td style={{ ...soTd, textAlign: 'center' }}>
                            <input type="checkbox" readOnly checked={isSelected} style={{ pointerEvents: 'none' }} />
                          </td>
                          <td style={{ ...soTd, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--foreground)' }}>
                            {so.code}
                          </td>
                          <td style={{ ...soTd, color: 'var(--foreground-muted)' }}>{so.branch?.name ?? '—'}</td>
                          {/* Outlet yang mau di-invoice — resolve dari buyer_branch_id */}
                          <td style={{ ...soTd, fontWeight: 600 }}>{outletNameOf(so)}</td>
                          <td style={{ ...soTd, whiteSpace: 'nowrap' }}>{so.date ? formatDate(so.date) : '—' }</td>
                          <td style={{ ...soTd, textAlign: 'right' }}>
                            <PriceDisplay amount={so.total_price} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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
                  {Object.values(details).map(d => {
                    const isBillable = d.max_qty > 0
                    return (
                      <div key={d.sales_order_detail_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{d.product_name}</div>
                          <div style={{ fontSize: 12, color: isBillable ? 'var(--foreground-muted)' : 'var(--foreground-subtle)' }}>
                            {isBillable
                              ? `Max: ${d.max_qty} (diterima, belum ditagih)`
                              : 'Belum bisa ditagih (belum diterima / sudah ditagih penuh)'}
                          </div>
                        </div>
                        <div>
                          <input
                            type="number"
                            value={d.qty}
                            min="0"
                            max={d.max_qty}
                            disabled={!isBillable}
                            onChange={e => setDetails({
                              ...details,
                              [d.sales_order_detail_id]: {
                                ...d,
                                qty: Math.max(0, Math.min(Number(e.target.value), d.max_qty)),
                              },
                            })}
                            style={{
                              width: '100%',
                              height: 32,
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0 8px',
                              fontSize: 13,
                              color: 'var(--foreground)',
                              background: isBillable ? 'var(--surface-raised)' : 'var(--surface)',
                              cursor: isBillable ? 'text' : 'not-allowed',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 13, textAlign: 'right' }}>
                          <PriceDisplay amount={d.price} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                          <PriceDisplay amount={d.qty * d.price} />
                        </div>
                      </div>
                    )
                  })}
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
                        step="any"
                        value={c.amount}
                        onChange={e => {
                          const max = Number(c.max_amount ?? 0)
                          const raw = Number(e.target.value)
                          let v = Number.isFinite(raw) ? raw : 0
                          // Same sign as the remaining amount, never larger
                          if (v !== 0 && max !== 0 && Math.sign(v) !== Math.sign(max)) v = 0
                          if (max !== 0 && Math.abs(v) > Math.abs(max)) v = max
                          setSoCharges({ ...soCharges, [c.sales_order_component_id as number]: { ...c, amount: v } })
                        }}
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
                    step="any"
                    placeholder="Amount (0 = none, negative = deduction)"
                    value={fc.amount}
                    onChange={e => {
                      const copy = [...freeCharges]; copy[idx].amount = Number(e.target.value) || 0; setFreeCharges(copy)
                    }}
                    style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px', fontSize: 13 }}
                  />
                  <div>
                    <SearchableSelect
                      value={fc.chart_of_account_id || 0}
                      onChange={v => {
                        const copy = [...freeCharges]; copy[idx].chart_of_account_id = Number(v) || 0; setFreeCharges(copy)
                      }}
                      options={coaChargeOptions}
                      placeholder="Select account... *"
                      searchPlaceholder="Search account name or code..."
                      loading={coaLoading}
                      triggerStyle={{ height: 32, padding: '0 8px', fontSize: 13, borderRadius: 'var(--radius-sm)' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
                      Required — account used to record this charge.
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFreeCharges(f => [...f, { id: Math.random().toString(), name: '', chart_of_account_id: 0, amount: 0, description: '' }])}
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
                const missingAccount = freeCharges.find(c => c.name.trim() && !(c.chart_of_account_id > 0))
                if (missingAccount) return toast.error(`Custom charge "${missingAccount.name.trim()}" needs a chart of account`)
                // Mirror the billing rules: keep the remaining amount's sign
                // and never exceed it in absolute value.
                const wrongSign = Object.values(soCharges).find(
                  c => c.included && Number(c.amount) !== 0 && Number(c.max_amount ?? 0) !== 0 &&
                    Math.sign(Number(c.amount)) !== Math.sign(Number(c.max_amount))
                )
                if (wrongSign) return toast.error(`Charge "${wrongSign.name}" must keep the sign of the remaining amount`)
                const tooLarge = Object.values(soCharges).find(
                  c => c.included && Math.abs(Number(c.amount)) > Math.abs(Number(c.max_amount ?? 0))
                )
                if (tooLarge) return toast.error(`Charge "${tooLarge.name}" exceeds the remaining amount`)
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
