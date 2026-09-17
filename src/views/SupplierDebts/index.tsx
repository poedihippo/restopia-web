'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { suppliersService } from '@/services/suppliers.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { paymentsService } from '@/services/payments.service'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'
import { Search, ArrowRight, Building2, FileText, AlertCircle, Loader2 } from 'lucide-react'

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
  is_reversed?: boolean
  allocations?: { purchase_order_id?: number; amount: number }[]
}

interface SupplierDebt {
  supplier: Supplier
  totalOutstanding: number
  unpaidCount: number
  oldestDate?: string
  purchaseOrders: Array<PurchaseOrder & { totalPaid: number; outstanding: number }>
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

export default function SupplierDebtsView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read') || hasPermission('purchase-order.read')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['supplier-debts-suppliers'],
    enabled: canRead,
    queryFn: () =>
      suppliersService
        .list({ per_page: 1000, sort: 'name', 'filter[is_active]': '1' } as any)
        .then((r) => r.data),
  })

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['supplier-debts-pos'],
    enabled: canRead,
    queryFn: () =>
      purchaseOrdersService
        .list({
          per_page: 1000,
          sort: '-created_at',
          'filter[type]': 'supplier',
          include: 'supplier,purchase_order_details',
        } as any)
        .then((r) => r.data),
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['supplier-debts-payments'],
    enabled: canRead,
    queryFn: () =>
      paymentsService
        .list({
          per_page: 2000,
          'filter[type]': 'disburse',
          include: 'allocations',
        } as any)
        .then((r) => r.data),
  })

  const suppliers: Supplier[] = (suppliersData as any)?.data ?? []
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

  const supplierDebts: SupplierDebt[] = useMemo(() => {
    const supplierMap = new Map<number, SupplierDebt>()
    const supplierLookup = new Map(suppliers.map((s) => [s.id, s]))

    for (const po of pos) {
      const supplierId = po.supplier?.id
      if (!supplierId) continue

      const totalPaid = paidByPoId.get(po.id) ?? 0
      const outstanding = Number(po.total_price ?? 0) - totalPaid
      if (outstanding <= 0) continue

      const supplier = supplierLookup.get(supplierId) ?? po.supplier
      if (!supplier) continue
      const existing = supplierMap.get(supplierId)
      const enrichedPo = { ...po, totalPaid, outstanding }

      if (existing) {
        existing.totalOutstanding += outstanding
        existing.unpaidCount += 1
        existing.purchaseOrders.push(enrichedPo)
        if (po.date && (!existing.oldestDate || po.date < existing.oldestDate)) {
          existing.oldestDate = po.date
        }
      } else {
        supplierMap.set(supplierId, {
          supplier,
          totalOutstanding: outstanding,
          unpaidCount: 1,
          oldestDate: po.date,
          purchaseOrders: [enrichedPo],
        })
      }
    }

    return Array.from(supplierMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding)
  }, [pos, payments, suppliers, paidByPoId])

  const filteredDebts = useMemo(() => {
    if (!debouncedSearch.trim()) return supplierDebts
    const q = debouncedSearch.toLowerCase()
    return supplierDebts.filter(
      (d) =>
        d.supplier.name.toLowerCase().includes(q) ||
        d.supplier.code.toLowerCase().includes(q)
    )
  }, [supplierDebts, debouncedSearch])

  const grandTotal = useMemo(
    () => filteredDebts.reduce((sum, d) => sum + d.totalOutstanding, 0),
    [filteredDebts]
  )

  const totalUnpaidInvoices = useMemo(
    () => filteredDebts.reduce((sum, d) => sum + d.unpaidCount, 0),
    [filteredDebts]
  )

  const isLoading = suppliersLoading || posLoading || paymentsLoading

  if (!canRead) {
    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view supplier debt cards.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Kartu Hutang Supplier
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Rekap supplier yang memiliki hutang belum lunas. Klik kartu untuk melihat rincian per invoice.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Hutang Belum Lunas
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(grandTotal)}
          </div>
        </div>
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Supplier Berhutang
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            {filteredDebts.length}
          </div>
        </div>
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Invoice Belum Lunas
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            {totalUnpaidInvoices}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 320 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari supplier atau kode..."
            style={{ ...inputStyle, paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 10, color: 'var(--foreground-muted)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Memuat data hutang supplier...</span>
        </div>
      ) : filteredDebts.length === 0 ? (
        <div
          style={{
            ...sectionStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 64,
            gap: 12,
            textAlign: 'center',
          }}
        >
          <AlertCircle size={40} style={{ opacity: 0.4, color: 'var(--foreground-muted)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
              Tidak ada hutang supplier
            </div>
            <div style={{ fontSize: 13, color: 'var(--foreground-muted)', marginTop: 4 }}>
              Semua purchase order sudah lunas atau belum ada data.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {filteredDebts.map((debt) => (
            <Link
              key={debt.supplier.id}
              href={`/accounting/reports/supplier-debts/${debt.supplier.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'box-shadow 150ms ease, border-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  e.currentTarget.style.borderColor = 'var(--accent-light)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--accent-light-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
                        {debt.supplier.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                        {debt.supplier.code}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--foreground-muted)" />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Hutang
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(debt.totalOutstanding)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} color="var(--warning)" />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {debt.unpaidCount} invoice belum lunas
                    </span>
                  </div>
                </div>

                {debt.oldestDate && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      Invoice terlama: <strong style={{ color: 'var(--foreground)' }}>{formatDate(debt.oldestDate)}</strong>
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
