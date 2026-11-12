'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useBuyerNames } from '@/hooks/useBuyerNames'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { suppliersService } from '@/services/suppliers.service'
import { branchesService } from '@/services/branches.service'
import { buyersService } from '@/services/buyers.service'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  PackageSearch,
  Filter,
  Truck,
} from 'lucide-react'

interface PurchaseOrder {
  id: number
  code: string
  date: string
  type?: string
  total_price: number
  payment_status?: 'pending' | 'partial' | 'paid'
  total_payment?: number
  remaining_payment?: number
  status: 'pending' | 'accepted' | 'rejected' | 'fulfilled' | 'final' | 'partially_delivered' | 'delivered'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  supplier?: { id: number; name: string }
  purchase_order_details?: Array<{
    id: number
    qty: number
    received_qty?: number
    outstanding_qty?: number
  }>
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: {
    label: 'Pending',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  final: {
    label: 'Final',
    color: 'var(--accent)',
    bg: 'var(--accent-bg)',
  },
  accepted: {
    label: 'Accepted',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  rejected: {
    label: 'Rejected',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
  fulfilled: {
    label: 'Fulfilled',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  partially_delivered: {
    label: 'Partially Delivered',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  delivered: {
    label: 'Delivered',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
}

const originTagStyle = (kind: 'supplier' | 'internal'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 7px',
  marginRight: 6,
  borderRadius: 'var(--radius-sm)',
  fontSize: 10.5,
  fontWeight: 500,
  verticalAlign: 'middle',
  background: kind === 'supplier' ? 'var(--accent-light-bg)' : 'var(--info-bg)',
  color: kind === 'supplier' ? 'var(--accent)' : 'var(--info)',
})

const PAYMENT_META: Record<'pending' | 'partial' | 'paid', { label: string; color: string; bg: string }> = {
  pending: { label: 'Unpaid', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
  partial: { label: 'Partially Paid', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
}

// Prefer the API's payment_status; fall back to total/remaining payment.
function paymentStatusOf(po: PurchaseOrder): 'pending' | 'partial' | 'paid' {
  if (po.payment_status) return po.payment_status
  const total = Number(po.total_price ?? 0)
  const paid = Number(po.total_payment ?? 0)
  const remaining = po.remaining_payment != null ? Number(po.remaining_payment) : total - paid
  if (total > 0 && remaining <= 0) return 'paid'
  return paid > 0 ? 'partial' : 'pending'
}

export default function PurchaseOrdersView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, user } = useAuth()
  const canRead = hasPermission("purchase-order.read");
  const canCreate = hasPermission('purchase-order.create')
  const canEdit = hasPermission('purchase-order.update')
  const canDelete = hasPermission('purchase-order.delete')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final' | 'accepted' | 'delivered' | 'rejected' | 'partially_delivered'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'supplier' | 'branch'>('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'' | 'pending' | 'partial' | 'paid'>('')
  const [remainingQtyFilter, setRemainingQtyFilter] = useState<'' | 'true' | 'false'>('')
  const [supplierFilter, setSupplierFilter] = useState<number>(0)
  const [supplierBranchFilter, setSupplierBranchFilter] = useState<number>(0)
  const [buyerFilter, setBuyerFilter] = useState<number>(0)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('')
  const [supplierBranchSearch, setSupplierBranchSearch] = useState('')
  const [debouncedSupplierBranchSearch, setDebouncedSupplierBranchSearch] = useState('')
  const [buyerSearch, setBuyerSearch] = useState('')
  const [debouncedBuyerSearch, setDebouncedBuyerSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSupplierSearch(supplierSearch)
      setDebouncedSupplierBranchSearch(supplierBranchSearch)
      setDebouncedBuyerSearch(buyerSearch)
    }, 400)
    return () => clearTimeout(t)
  }, [supplierSearch, supplierBranchSearch, buyerSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, typeFilter, paymentStatusFilter, remainingQtyFilter, supplierFilter, supplierBranchFilter, buyerFilter])

  // ── Filter dropdown sources ───────────────────────────────────────────────
  // Supplier picker only applies to supplier POs, supplier-branch picker only
  // to branch (internal) POs — each is hidden & not fetched for the other type.
  const showSupplierFilter = typeFilter !== 'branch'
  const showSupplierBranchFilter = typeFilter !== 'supplier'

  const supplierOpts = useInfiniteOptions<any>({
    queryKey: ['suppliers-all', debouncedSupplierSearch],
    fetchPage: (page) =>
      suppliersService
        .list({ page, 'filter[search]': debouncedSupplierSearch || undefined, per_page: 100 } as any)
        .then((r) => r.data),
    enabled: showSupplierFilter,
  })
  const supplierOptions = [
    { value: 0, label: 'All suppliers' },
    ...supplierOpts.items.map((s: any) => ({
      value: s.id as number,
      label: (s.name as string) ?? `Supplier #${s.id}`,
      sublabel: s.code as string | undefined,
    })),
  ]

  const { data: supplierBranchesData, isLoading: supplierBranchesLoading } = useQuery({
    queryKey: ['branches-all', 'po-filter', debouncedSupplierBranchSearch],
    queryFn: () =>
      branchesService
        .list({ 'filter[search]': debouncedSupplierBranchSearch || undefined, per_page: 100 } as any)
        .then((r) => r.data),
    enabled: showSupplierBranchFilter,
  })
  const supplierBranchOptions = [
    { value: 0, label: 'All supplier branches' },
    ...((supplierBranchesData as any)?.data ?? []).map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Branch #${b.id}`,
      sublabel: b.code as string | undefined,
    })),
  ]

  const buyerOpts = useInfiniteOptions<any>({
    queryKey: ['buyers-all', debouncedBuyerSearch],
    fetchPage: (page) =>
      buyersService
        .list({ page, 'filter[search]': debouncedBuyerSearch || undefined, per_page: 100, sort: 'name' } as any)
        .then((r) => r.data),
  })
  const buyerOptions = [
    { value: 0, label: 'All buyers' },
    ...buyerOpts.items.map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Buyer #${b.id}`,
      sublabel: b.code as string | undefined,
    })),
  ]

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['purchase-orders', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, typeFilter, paymentStatusFilter, remainingQtyFilter, supplierFilter, supplierBranchFilter, buyerFilter, (user as any)?.branch?.id],
    queryFn: () =>
      purchaseOrdersService
        .list({
          page,
          per_page: perPage,
          include: 'supplier,supplier_branch,supplier_branch.company,branch,branch.company,purchase_order_details',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
          'filter[branch_id]': (user as any)?.branch?.id || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[payment_status]': paymentStatusFilter || undefined,
          'filter[has_remaining_qty]': remainingQtyFilter || undefined,
          'filter[supplier_id]': (showSupplierFilter && supplierFilter) || undefined,
          'filter[supplier_branch_id]': (showSupplierBranchFilter && supplierBranchFilter) || undefined,
          'filter[buyer_id]': buyerFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: PurchaseOrder[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Buyer: nama dari GET /buyers/{buyer_id} (satu request per buyer unik).
  // Fallback: nama company branch PO → company branch aktif user.
  const buyerNames = useBuyerNames(items.map((po: any) => po?.buyer_id))
  const userCompanyName = (user as any)?.branch?.company?.name as string | undefined
  const buyerLabelOf = (po: any): string =>
    (po?.buyer_id ? buyerNames[po.buyer_id] : undefined) ??
    po?.branch?.company?.name ??
    userCompanyName ??
    '—'

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  // Header/cell look comes from .v2-table; only per-cell extras stay inline.
  const thStyle: React.CSSProperties = { textAlign: 'left' }
  const tdStyle: React.CSSProperties = { paddingTop: 8, paddingBottom: 8 }
  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
            Purchase Orders
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
            Manage procurement orders to suppliers
          </p>
        </div>
        {canCreate && (
          <button className="v2-btn v2-btn-primary" onClick={() => router.push('/purchase/purchase-orders/create')}>
            <Plus size={14} />New Order
          </button>
        )}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search orders..."
        activeCount={countActive(
          statusFilter, typeFilter, paymentStatusFilter, remainingQtyFilter,
          supplierFilter, supplierBranchFilter, buyerFilter, dateFrom, dateTo,
        )}
        onClear={() => {
          setStatusFilter('')
          setDateFrom('')
          setDateTo('')
          setTypeFilter('')
          setPaymentStatusFilter('')
          setRemainingQtyFilter('')
          setSupplierFilter(0)
          setSupplierBranchFilter(0)
          setBuyerFilter(0)
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="final">Final</option>
              <option value="accepted">Accepted</option>
              <option value="delivered">Delivered</option>
              <option value="rejected">Rejected</option>
              <option value="partially_delivered">Partially Delivered</option>
            </FilterSelect>
            <FilterSelect
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Types</option>
              <option value="supplier">Supplier</option>
              <option value="branch">Branch</option>
            </FilterSelect>
            <FilterSelect
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Payment Status</option>
              <option value="pending">Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Paid</option>
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Parties">
          {showSupplierFilter && (
            <FilterField label="Supplier">
              <SearchableSelect
                value={supplierFilter}
                onChange={(v) => {
                  setSupplierFilter(Number(v) || 0)
                  setPage(1)
                }}
                options={supplierOptions}
                placeholder="All suppliers"
                searchPlaceholder="Search suppliers..."
                loading={supplierOpts.loading}
                {...supplierOpts.selectProps}
                onSearchChange={setSupplierSearch}
              />
            </FilterField>
          )}
          {showSupplierBranchFilter && (
            <FilterField label="Supplier branch">
              <SearchableSelect
                value={supplierBranchFilter}
                onChange={(v) => {
                  setSupplierBranchFilter(Number(v) || 0)
                  setPage(1)
                }}
                options={supplierBranchOptions}
                placeholder="All supplier branches"
                searchPlaceholder="Search supplier branches..."
                loading={supplierBranchesLoading}
                onSearchChange={setSupplierBranchSearch}
              />
            </FilterField>
          )}
          <FilterField label="Buyer">
            <SearchableSelect
              value={buyerFilter}
              onChange={(v) => {
                setBuyerFilter(Number(v) || 0)
                setPage(1)
              }}
              options={buyerOptions}
              placeholder="All buyers"
              searchPlaceholder="Search buyers..."
              loading={buyerOpts.loading}
              {...buyerOpts.selectProps}
              onSearchChange={setBuyerSearch}
            />
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Dates & delivery">
          <FilterField label="Order date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => { setDateFrom(v); setPage(1) }}
              onToChange={(v) => { setDateTo(v); setPage(1) }}
            />
          </FilterField>
          <FilterField label="Remaining qty">
            <FilterSelect
              block
              value={remainingQtyFilter}
              onChange={(e) => {
                setRemainingQtyFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">Remaining Qty: All</option>
              <option value="true">Has Remaining Qty</option>
              <option value="false">Fully Delivered</option>
            </FilterSelect>
          </FilterField>
        </FilterGroup>
      </FilterBar>
      {/* Table */}
      <div className="v2-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table className="v2-table">
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 160 }}>Code</th>
              <th style={thStyle}>Order From</th>
              <th style={{ ...thStyle, width: 180 }}>Buyer</th>
              <th style={{ ...thStyle, width: 130 }}>Date</th>
              <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>Total</th>
              <th style={{ ...thStyle, width: 110 }}>Status</th>
              <th style={{ ...thStyle, width: 120 }}>Payment</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 6 ? 60 : j === 5 ? 70 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}
                >
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load purchase orders.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <PackageSearch size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No purchase orders found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                // Order source: external supplier, or internal source branch.
                const po = item as any
                const supplierName = po?.supplier?.name
                const branchName = po?.supplier_branch?.name
                const branchCode = po?.supplier_branch?.code
                const orderFromLabel = supplierName
                  ? supplierName
                  : branchName
                    ? `${branchName}${branchCode ? ` (${branchCode})` : ''}`
                    : '—'
                // Internal PO = ordered from a branch (no supplier) — price-free.
                const isInternal = !!po?.supplier_branch
                // Fulfillment summary — only meaningful for final orders.
                const poDetails = item.purchase_order_details ?? []
                const totalOrdered = poDetails.reduce(
                  (s, d) => s + Number(d.qty ?? 0),
                  0,
                )
                const totalReceived = poDetails.reduce(
                  (s, d) => s + Number(d.received_qty ?? 0),
                  0,
                )
                const showFulfillment =
                  item.status === 'final' && totalReceived > 0
                const fullyReceived = totalReceived >= totalOrdered
                return (
                  <tr
                    key={item.id}
                    data-row
                  >
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ color: 'var(--foreground-subtle)' }}>
                        {(page - 1) * perPage + idx + 1}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: 'var(--accent)',
                        }}
                      >
                        {item.code}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span>
                        {supplierName ? (
                          <span style={originTagStyle('supplier')}>Supplier</span>
                        ) : branchName ? (
                          <span style={originTagStyle('internal')}>Internal</span>
                        ) : null}
                        {orderFromLabel}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span>
                        {buyerLabelOf(po)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                        {item.date}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {isInternal
                          ? ''
                          : getCanReadPrice()
                            ? formatCurrency(item.total_price)
                            : '***'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            ...pillStyle,
                            background: statusMeta.bg,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                        {showFulfillment && (
                          <span
                            style={{
                              ...pillStyle,
                              background: fullyReceived
                                ? 'var(--success-bg)'
                                : 'var(--warning-bg)',
                              color: fullyReceived
                                ? 'var(--success)'
                                : 'var(--warning)',
                            }}
                          >
                            {fullyReceived
                              ? 'Received'
                              : `Partial · ${totalReceived.toLocaleString('id-ID', { maximumFractionDigits: 2 })}/${totalOrdered.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {isInternal || item.status === 'rejected' ? (
                        <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                      ) : (() => {
                        const payStatus = paymentStatusOf(item)
                        const pay = PAYMENT_META[payStatus]
                        const remaining =
                          item.remaining_payment != null
                            ? Number(item.remaining_payment)
                            : Number(item.total_price ?? 0) - Number(item.total_payment ?? 0)
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                          <span
                            style={{
                              ...pillStyle,
                              background: pay.bg,
                              color: pay.color,
                            }}
                          >
                            {pay.label}
                          </span>
                          {payStatus !== 'paid' && (
                            <span style={{ fontSize: 11.5, color: 'var(--foreground-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {getCanReadPrice() ? formatCurrency(remaining) : '***'}
                            </span>
                          )}
                          </div>
                        )
                      })()}
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          justifyContent: 'flex-end',
                        }}
                      >
                        {/* Extra actions go first so View/Edit/Delete stay aligned on the right. */}
                        {(item.status === 'accepted' || item.status === 'final') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const sourceType = item.type === 'branch' ? 'po_from_branch' : 'po_from_supplier'
                              router.push(`/transfer/deliveries/create?po_id=${item.id}&source_type=${sourceType}`)
                            }}
                            className="v2-icon-btn"
                            title="Create Delivery"
                          >
                            <Truck size={14} />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            router.push(`/purchase/purchase-orders/${item.id}/detail`)
                          }
                          className="v2-icon-btn"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {canEdit && (<button
                          onClick={() => {
                            if (item.status === 'delivered') {
                              toast.error('Cannot edit a delivered Purchase Order')
                              return
                            }
                            router.push(`/purchase/purchase-orders/${item.id}/edit`)
                          }}
                          disabled={item.status === 'delivered'}
                          className="v2-icon-btn"
                          style={item.status === 'delivered' ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                          title={
                            item.status === 'delivered'
                              ? 'Delivered — cannot edit'
                              : 'Edit'
                          }
                        >
                          <Pencil size={14} />
                        </button>)}
                        {canDelete && (<button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="v2-icon-btn"
                          data-tone="danger"
                          title="Delete">
                          <Trash2 size={14} />
                        </button>)}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
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
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 360,
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
              Delete Purchase Order
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently remove the order and all its line items.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
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
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
