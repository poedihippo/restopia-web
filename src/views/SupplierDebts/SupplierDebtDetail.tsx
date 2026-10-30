'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { suppliersService } from '@/services/suppliers.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { paymentsService } from '@/services/payments.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'
import { ArrowLeft, Building2, FileText, AlertCircle, Loader2, ExternalLink, Wallet, X } from 'lucide-react'

interface Supplier {
  id: number
  code: string
  name: string
  phone?: string
  address?: string
}

interface PurchaseOrder {
  id: number
  code: string
  date?: string
  total_price: number
  status?: string
  supplier?: Supplier
}

interface DisbursePayment {
  id: number
  payment_number?: string
  date?: string
  created_at?: string
  amount: number
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

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
  fontSize: 13,
}

const amountTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const todayInputDate = () => new Date().toISOString().split('T')[0]

const inputStyle: React.CSSProperties = {
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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 6,
}

interface PayTarget {
  id: number
  code: string
  outstanding: number
}

function PayModal({
  targets,
  supplierId,
  onClose,
}: {
  targets: PayTarget[]
  supplierId: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [paymentMethodId, setPaymentMethodId] = useState<number>(0)
  const [amounts, setAmounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(targets.map((t) => [t.id, t.outstanding])),
  )
  const totalAmount = targets.reduce((s, t) => s + Number(amounts[t.id] || 0), 0)
  const [date, setDate] = useState<string>(todayInputDate())
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: pmData, isLoading: pmLoading } = useQuery({
    queryKey: ['payment-methods-all', debouncedSearch],
    queryFn: () =>
      paymentMethodsService
        .list({
          'filter[search]': debouncedSearch || undefined,
          per_page: 100,
          sort: 'id',
          'filter[type]': 'purchase_orders',
          include: 'bank_account',
        } as any)
        .then((r) => r.data),
  })
  const methodOptions = ((pmData as any)?.data ?? []).map((m: any) => ({
    value: m.id as number,
    label: (m.name as string) ?? `Method #${m.id}`,
  }))

  const mutation = useMutation({
    mutationFn: () =>
      paymentsService.create({
        type: 'disburse',
        date,
        payments: [
          {
            payment_method_id: paymentMethodId,
            amount: totalAmount,
            description: description || undefined,
            allocations: targets
              .filter((t) => Number(amounts[t.id] || 0) > 0)
              .map((t) => ({ purchase_order_id: t.id, amount: Number(amounts[t.id]) })),
          },
        ],
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-debt-detail-payments', supplierId] })
      qc.invalidateQueries({ queryKey: ['supplier-debt-detail-pos', supplierId] })
      qc.invalidateQueries({ queryKey: ['po-disburse-payments'] })
      qc.invalidateQueries({ queryKey: ['po-payments-history'] })
      toast.success('Pembayaran berhasil dicatat')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal mencatat pembayaran'),
  })

  const handleSubmit = () => {
    if (paymentMethodId === 0) {
      toast.error('Pilih metode pembayaran')
      return
    }
    if (targets.some((t) => Number(amounts[t.id] || 0) > t.outstanding) || !(totalAmount > 0)) {
      toast.error('Jumlah pembayaran tidak valid')
      return
    }
    mutation.mutate()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={onClose} />
      <div
        style={{
          position: 'relative',
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
              {targets.length > 1 ? `Bayar ${targets.length} Invoice` : 'Bayar Invoice'}
            </div>
            {targets.length === 1 && (
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--foreground-muted)', marginTop: 2 }}>{targets[0].code}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>

          <div>
            <label style={labelStyle}>Metode Pembayaran *</label>
            <SearchableSelect
              value={paymentMethodId}
              onChange={(v) => setPaymentMethodId(Number(v))}
              options={methodOptions}
              placeholder="Pilih metode..."
              searchPlaceholder="Cari metode..."
              loading={pmLoading}
              onSearchChange={setSearch}
            />
          </div>

          <div>
            <label style={labelStyle}>Jumlah per Invoice *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {targets.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--foreground)' }}>{t.code}</div>
                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                      Sisa: {formatCurrency(t.outstanding)}
                    </div>
                  </div>
                  <LocalizedNumberInput
                    value={amounts[t.id] ?? 0}
                    onChange={(v) => {
                      let x = v
                      if (x > t.outstanding) {
                        x = t.outstanding
                        toast.warning('Jumlah dibatasi sampai sisa hutang')
                      }
                      setAmounts((prev) => ({ ...prev, [t.id]: x }))
                    }}
                    decimals={2}
                    padDecimals={false}
                    placeholder="0"
                    style={{ width: 160, background: 'var(--surface-raised)' }}
                  />
                </div>
              ))}
            </div>
            {targets.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
                <span>Total Pembayaran</span>
                <span style={{ color: 'var(--accent)' }}>{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Tanggal *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Keterangan</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer' }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{
              padding: '9px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupplierDebtDetailView() {
  const router = useRouter()
  const supplierId = Number(router.query.id)
  // Filter buyer dari halaman Kartu Hutang (?buyer_id=).
  const buyerId = Number(router.query.buyer_id) || 0
  const [payTargets, setPayTargets] = useState<PayTarget[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read') || hasPermission('purchase-order.read')
  const canPay = isSuperadmin || hasPermission('payment.create')

  const { data: supplierData, isLoading: supplierLoading } = useQuery({
    queryKey: ['supplier-debt-detail-supplier', supplierId],
    enabled: canRead && !!supplierId,
    queryFn: () => suppliersService.findById(supplierId).then((r) => r.data),
  })

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['supplier-debt-detail-pos', supplierId, buyerId],
    enabled: canRead && !!supplierId,
    queryFn: () =>
      purchaseOrdersService
        .list({
          per_page: 1000,
          sort: '-created_at',
          'filter[type]': 'supplier',
          'filter[supplier_id]': supplierId,
          'filter[buyer_id]': buyerId > 0 ? buyerId : undefined,
          include: 'supplier,purchase_order_details',
        } as any)
        .then((r) => r.data),
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['supplier-debt-detail-payments', supplierId],
    enabled: canRead && !!supplierId,
    queryFn: () =>
      paymentsService
        .list({
          per_page: 2000,
          'filter[type]': 'disburse',
          include: 'allocations,payment_method',
        } as any)
        .then((r) => r.data),
  })

  const supplier: Supplier | undefined = (supplierData as any)?.data
  const pos: PurchaseOrder[] = (posData as any)?.data ?? []
  const payments: DisbursePayment[] = (paymentsData as any)?.data ?? []

  const paidByPoId = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of payments) {
      if (p.is_reversed) continue
      for (const a of p.allocations ?? []) {
        if (a.purchase_order_id == null) continue
        const poId = Number(a.purchase_order_id)
        map.set(poId, (map.get(poId) ?? 0) + Number(a.amount ?? 0))
      }
    }
    return map
  }, [payments])

  const poRows = useMemo(() => {
    return pos
      .map((po) => {
        const totalPaid = paidByPoId.get(po.id) ?? 0
        const outstanding = Number(po.total_price ?? 0) - totalPaid
        return { ...po, totalPaid, outstanding }
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
  }, [pos, paidByPoId])

  const supplierPayments = useMemo(() => {
    return payments
      .filter((p) => !p.is_reversed)
      .filter((p) => p.allocations?.some((a) => a.purchase_order_id != null && poRows.some((row) => row.id === a.purchase_order_id)))
      .sort((a, b) => new Date(b.date ?? b.created_at ?? 0).getTime() - new Date(a.date ?? a.created_at ?? 0).getTime())
  }, [payments, poRows])

  const totalOutstanding = useMemo(() => poRows.reduce((sum, row) => sum + row.outstanding, 0), [poRows])

  const selectedRows = poRows.filter((r) => selected.has(r.id))
  const allSelected = poRows.length > 0 && selectedRows.length === poRows.length
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toPayTarget = (r: { id: number; code: string; outstanding: number }): PayTarget => ({
    id: r.id,
    code: r.code,
    outstanding: r.outstanding,
  })

  const isLoading = supplierLoading || posLoading || paymentsLoading

  if (!canRead) {
    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view supplier debt details.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Back link */}
      <Link
        href={{ pathname: '/accounting/reports/supplier-debts', query: buyerId > 0 ? { buyer_id: buyerId } : {} }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'var(--foreground-muted)',
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} />
        Kembali ke Kartu Hutang Supplier
      </Link>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-light-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              {supplier?.name ?? 'Supplier'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {supplier?.code ? `Kode: ${supplier.code}` : '—'}
              {supplier?.phone ? ` · Telp: ${supplier.phone}` : ''}
            </p>
          </div>
        </div>
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Hutang
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalOutstanding)}
          </div>
        </div>
      </div>

      {/* Outstanding invoices table */}
      <div style={{ ...sectionStyle, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--accent)" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
              Invoice Belum Lunas
            </span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            {canPay && selectedRows.length > 0 && (
              <button
                type="button"
                onClick={() => setPayTargets(selectedRows.map(toPayTarget))}
                style={{
                  marginRight: 12,
                  padding: '6px 12px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Bayar Terpilih ({selectedRows.length})
              </button>
            )}
            {poRows.length} invoice
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10, color: 'var(--foreground-muted)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Memuat rincian...</span>
          </div>
        ) : poRows.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              gap: 12,
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <AlertCircle size={36} style={{ opacity: 0.4, color: 'var(--foreground-muted)' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
                Tidak ada invoice belum lunas
              </div>
              <div style={{ fontSize: 13, color: 'var(--foreground-muted)', marginTop: 4 }}>
                Semua purchase order untuk supplier ini sudah lunas.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {canPay && (
                    <th style={{ ...thStyle, width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(poRows.map((r) => r.id)))
                        }
                      />
                    </th>
                  )}
                  <th style={thStyle}>No. Invoice / PO</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sudah Dibayar</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sisa Hutang</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, width: canPay ? 150 : 60 }} />
                </tr>
              </thead>
              <tbody>
                {poRows.map((row) => {
                  const isPartial = row.totalPaid > 0
                  const badge = isPartial
                    ? { label: 'Partial', color: 'var(--warning)', bg: 'var(--warning-bg)' }
                    : { label: 'Unpaid', color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
                  return (
                    <tr key={row.id}>
                      {canPay && (
                        <td style={tdStyle}>
                          <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                        </td>
                      )}
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--foreground)' }}>
                          {row.code}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                        {row.date ? formatDate(row.date) : '—'}
                      </td>
                      <td style={amountTdStyle}>{formatCurrency(row.total_price)}</td>
                      <td style={{ ...amountTdStyle, color: 'var(--success)' }}>{formatCurrency(row.totalPaid)}</td>
                      <td style={{ ...amountTdStyle, fontWeight: 600, color: 'var(--destructive)' }}>
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 10px',
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => setPayTargets([toPayTarget(row)])}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              background: 'var(--accent)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Wallet size={13} />
                            Bayar
                          </button>
                        )}
                        <Link
                          href={`/purchase/purchase-orders/${row.id}/detail`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 6,
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--foreground-muted)',
                          }}
                          title="Lihat PO"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--accent-light-bg)' }}>
                  <td colSpan={canPay ? 5 : 4} style={{ ...tdStyle, fontWeight: 700, color: 'var(--foreground)' }}>
                    Total Sisa Hutang
                  </td>
                  <td style={{ ...amountTdStyle, fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
                    {formatCurrency(totalOutstanding)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--success)" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
              Riwayat Pembayaran
            </span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            {supplierPayments.length} pembayaran
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10, color: 'var(--foreground-muted)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Memuat riwayat pembayaran...</span>
          </div>
        ) : supplierPayments.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              gap: 10,
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--foreground-muted)',
            }}
          >
            <div style={{ fontSize: 14 }}>Belum ada pembayaran untuk invoice-invoice ini</div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Tanggal</th>
                  <th style={thStyle}>No. Pembayaran</th>
                  <th style={thStyle}>Metode</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Jumlah</th>
                  <th style={thStyle}>PO yang Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {supplierPayments.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{p.date ? formatDate(p.date) : formatDate(p.created_at)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                      {p.payment_number ?? `PMT-${p.id}`}
                    </td>
                    <td style={tdStyle}>{p.payment_method?.name ?? '—'}</td>
                    <td style={{ ...amountTdStyle, fontWeight: 600, color: 'var(--success)' }}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(p.allocations ?? [])
                          .filter((a) => a.purchase_order_id != null)
                          .map((a, idx) => (
                            <span key={idx} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)' }}>
                              PO-{a.purchase_order_id} ({formatCurrency(a.amount)})
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payTargets && (
        <PayModal
          targets={payTargets}
          supplierId={supplierId}
          onClose={() => {
            setPayTargets(null)
            setSelected(new Set())
          }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
