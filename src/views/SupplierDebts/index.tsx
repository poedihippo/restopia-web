'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { suppliersService } from '@/services/suppliers.service'
import { buyersService } from '@/services/buyers.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { fetchAllPages } from '@/utils/salesReport'
import { branchesService } from '@/services/branches.service'
import { useCentralCompanyScope } from '@/hooks/useCentralCompanyScope'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'
import { useDebounce } from '@/hooks/useDebounce'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { ArrowUpRight, ChevronRight, Wallet } from 'lucide-react'
import { FilterBar, countActive } from '@/components/ListFilters'

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
  total_payment?: number
  remaining_payment?: number
  supplier?: Supplier
}

// Pending (draft) and rejected POs are never a payable debt.
const NON_PAYABLE_PO_STATUSES = ['pending', 'rejected']

interface SupplierDebt {
  supplier: Supplier
  totalOutstanding: number
  unpaidCount: number
  oldestDate?: string
  purchaseOrders: Array<PurchaseOrder & { totalPaid: number; outstanding: number }>
}

export default function SupplierDebtsView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read') || hasPermission('purchase-order.read')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Filter buyer ikut di URL (?buyer_id=) supaya terbawa ke halaman detail
  // dan tetap ada saat kembali.
  const router = useRouter()
  const buyerId = Number(router.query.buyer_id) || 0
  const setQueryId = (key: 'buyer_id' | 'branch_id', id: number) => {
    const { [key]: _omit, ...rest } = router.query
    router.replace({ pathname: router.pathname, query: id > 0 ? { ...rest, [key]: id } : rest }, undefined, { shallow: true })
  }
  const setBuyerId = (id: number) => setQueryId('buyer_id', id)

  // Warehouse / production see the whole company's supplier debts, narrowed by
  // the Cabang filter (?branch_id=, carried to the detail page like buyer_id).
  // Outlets keep their own branch and get no Cabang filter.
  const { isCentral, scopeParams } = useCentralCompanyScope()
  const branchId = isCentral ? Number(router.query.branch_id) || 0 : 0
  const setBranchId = (id: number) => setQueryId('branch_id', id)

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

  // Buyer filter searches on the server (filter[search]).
  const [buyerSearch, setBuyerSearch] = useState('')
  const debouncedBuyerSearch = useDebounce(buyerSearch, 400)
  const buyerOpts = useInfiniteOptions<any>({
    queryKey: ['supplier-debts-buyer-options', debouncedBuyerSearch],
    enabled: canRead,
    fetchPage: (page) =>
      buyersService
        .list({ page, 'filter[search]': debouncedBuyerSearch || undefined, per_page: 30, sort: 'name' } as any)
        .then((r) => r.data),
  })
  const buyerRows: any[] = buyerOpts.items
  // ?buyer_id= from the URL may not be in the current search page; fetch it
  // so the select still shows its name.
  const { data: selectedBuyerData } = useQuery({
    queryKey: ['buyer', buyerId],
    enabled: canRead && buyerId > 0 && !buyerRows.some((b) => b.id === buyerId),
    staleTime: 5 * 60_000,
    queryFn: () => buyersService.findById(buyerId).then((r) => (r.data as any)?.data),
  })
  const buyerOptions = [
    { value: 0, label: 'Semua Buyer' },
    ...(selectedBuyerData && !buyerRows.some((b) => b.id === selectedBuyerData.id) ? [selectedBuyerData] : []).concat(buyerRows).map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Buyer #${b.id}`,
      sublabel: b.code as string | undefined,
    })),
  ]

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'basic'],
    enabled: canRead && isCentral,
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branchOptions = [
    { value: 0, label: 'Semua Cabang' },
    ...((branchesData as any)?.data ?? []).map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Cabang #${b.id}`,
      sublabel: b.code as string | undefined,
    })),
  ]

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['supplier-debts-pos', buyerId, branchId, scopeParams.scope],
    enabled: canRead,
    // Only unpaid POs, filtered on the server (filter[payment_status] is an exact
    // match, so one request per status) and paged through meta.last_page instead
    // of relying on a per_page cap.
    queryFn: async () => {
      const lists = await Promise.all(
        ['pending', 'partial'].map((paymentStatus) =>
          fetchAllPages((page) =>
            purchaseOrdersService
              .list({
                page,
                per_page: 200,
                sort: '-created_at',
                'filter[type]': 'supplier',
                'filter[payment_status]': paymentStatus,
                'filter[buyer_id]': buyerId > 0 ? buyerId : undefined,
                'filter[branch_id]': branchId > 0 ? branchId : undefined,
                include: 'supplier,purchase_order_details',
                ...scopeParams,
              } as any)
              .then((r) => r.data),
          ),
        ),
      )
      return lists.flat()
    },
  })

  const suppliers: Supplier[] = (suppliersData as any)?.data ?? []
  const pos: PurchaseOrder[] = (posData as any[]) ?? []

  const supplierDebts: SupplierDebt[] = useMemo(() => {
    const supplierMap = new Map<number, SupplierDebt>()
    const supplierLookup = new Map(suppliers.map((s) => [s.id, s]))

    for (const po of pos) {
      const supplierId = po.supplier?.id
      if (!supplierId) continue
      if (NON_PAYABLE_PO_STATUSES.includes(String(po.status ?? ''))) continue

      // Paid / outstanding come straight from the PO (total_payment /
      // remaining_payment) instead of summing a capped payments list.
      const totalPaid = Number(po.total_payment ?? 0)
      const outstanding =
        po.remaining_payment != null
          ? Number(po.remaining_payment)
          : Number(po.total_price ?? 0) - totalPaid
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
  }, [pos, suppliers])

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

  const isLoading = suppliersLoading || posLoading

  if (!canRead) {
    return (
      <div className="v2-card" style={{ padding: 16, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
        You do not have permission to view supplier debt cards.
      </div>
    )
  }

  const detailHref = (id: number) => ({
    pathname: `/accounting/reports/supplier-debts/${id}`,
    query: {
      ...(buyerId > 0 ? { buyer_id: buyerId } : {}),
      ...(branchId > 0 ? { branch_id: branchId } : {}),
    },
  })

  const columns: Array<{ label: string; align?: 'left' | 'right'; width?: number }> = [
    { label: 'No', align: 'right', width: 52 },
    { label: 'Supplier' },
    { label: 'Invoice Belum Lunas', align: 'right', width: 150 },
    { label: 'Invoice Terlama', width: 170 },
    { label: 'Porsi', width: 140 },
    { label: 'Total Hutang', align: 'right', width: 170 },
    { label: '', width: 40 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
          Kartu Hutang Supplier
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
          Rekap hutang supplier yang belum lunas
        </p>
      </div>

      {/* Summary */}
      <div className="v2-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'Total Hutang', value: formatCurrency(grandTotal), color: 'var(--foreground)' },
          { label: 'Supplier', value: filteredDebts.length.toLocaleString('id-ID'), color: 'var(--foreground)' },
          { label: 'Invoice Belum Lunas', value: totalUnpaidInvoices.toLocaleString('id-ID'), color: 'var(--foreground)' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '14px 18px', borderLeft: i > 0 ? '1px solid var(--border)' : undefined }}>
            <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{s.label}</div>
            {isLoading ? (
              <div className="v2-skeleton" style={{ height: 18, width: '55%', marginTop: 8 }} />
            ) : (
              <div style={{ fontSize: 20, fontWeight: 600, color: s.color, marginTop: 4, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari supplier atau kode..."
        activeCount={countActive(buyerId > 0, branchId > 0)}
        onClear={() => {
          const { buyer_id: _b, branch_id: _c, ...rest } = router.query
          router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
        }}
        quick={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isCentral && (
            <div style={{ width: 220 }}>
              <SearchableSelect
                value={branchId}
                onChange={(val) => setBranchId(Number(val) || 0)}
                options={branchOptions}
                placeholder="Semua Cabang"
                searchPlaceholder="Cari cabang..."
                loading={branchesLoading}
              />
            </div>
          )}
          <div style={{ width: 240 }}>
            <SearchableSelect
              value={buyerId}
              onChange={(val) => setBuyerId(Number(val) || 0)}
              options={buyerOptions}
              placeholder="Semua Buyer"
              searchPlaceholder="Cari buyer..."
              loading={buyerOpts.loading}
              {...buyerOpts.selectProps}
              onSearchChange={setBuyerSearch}
            />
          </div>
          </div>
        }
      />

      {/* Table */}
      <div className="v2-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {/* Roomier rows than the default v2 table: name + code stack in one cell. */}
          <style>{`
            :root[data-ui="v2"] .v2-table.sd-table tbody tr[data-row] td {
              height: auto;
              padding-top: 14px;
              padding-bottom: 14px;
            }
          `}</style>
          <table className="v2-table sd-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i} style={{ textAlign: col.align ?? 'left', width: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r}>
                    {columns.map((col, c) => (
                      <td key={c}>
                        {col.label && (
                          <div
                            className="v2-skeleton"
                            style={{ height: 10, width: c === 0 ? `${60 - (r % 3) * 12}%` : '60%', marginLeft: col.align === 'right' ? 'auto' : undefined }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ height: 'auto', padding: '56px 16px', textAlign: 'center' }}>
                    <Wallet size={28} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--foreground-subtle)' }} />
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Tidak ada hutang supplier</div>
                    <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                      Semua purchase order sudah lunas atau belum ada data.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt, index) => {
                  const share = grandTotal > 0 ? (debt.totalOutstanding / grandTotal) * 100 : 0
                  const age = daysSince(debt.oldestDate)
                  return (
                    <tr
                      key={debt.supplier.id}
                      data-row
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(detailHref(debt.supplier.id))}
                    >
                      <td style={{ textAlign: 'right', color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {index + 1}
                      </td>
                      <td>
                        <Link
                          href={detailHref(debt.supplier.id)}
                          className="v2-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {debt.supplier.name}
                          <ArrowUpRight size={12} />
                        </Link>
                        <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 1, fontFamily: 'monospace' }}>
                          {debt.supplier.code}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{debt.unpaidCount}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {debt.oldestDate ? (
                          <>
                            <span>{formatDate(debt.oldestDate)}</span>
                            {age != null && (
                              <span style={{ fontSize: 11.5, marginLeft: 6, color: age > 60 ? 'var(--destructive)' : age > 30 ? 'var(--warning)' : 'var(--foreground-subtle)' }}>
                                {age} hari
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                            <div style={{ width: `${share}%`, height: '100%', background: 'var(--accent-light)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)', width: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(share)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatCurrency(debt.totalOutstanding)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--foreground-subtle)' }}>
                        <ChevronRight size={15} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function daysSince(date?: string): number | null {
  if (!date) return null
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}
