'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { suppliersService } from '@/services/suppliers.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { paymentsService } from '@/services/payments.service'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'
import { ArrowLeft, Building2, FileText, AlertCircle, Loader2, ExternalLink } from 'lucide-react'

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

export default function SupplierDebtDetailView() {
  const router = useRouter()
  const supplierId = Number(router.query.id)

  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read') || hasPermission('purchase-order.read')

  const { data: supplierData, isLoading: supplierLoading } = useQuery({
    queryKey: ['supplier-debt-detail-supplier', supplierId],
    enabled: canRead && !!supplierId,
    queryFn: () => suppliersService.findById(supplierId).then((r) => r.data),
  })

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['supplier-debt-detail-pos', supplierId],
    enabled: canRead && !!supplierId,
    queryFn: () =>
      purchaseOrdersService
        .list({
          per_page: 1000,
          sort: '-created_at',
          'filter[type]': 'supplier',
          'filter[supplier_id]': supplierId,
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
        href="/accounting/reports/supplier-debts"
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
                  <th style={thStyle}>No. Invoice / PO</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sudah Dibayar</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sisa Hutang</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, width: 60 }} />
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
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--accent-light-bg)' }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, color: 'var(--foreground)' }}>
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
