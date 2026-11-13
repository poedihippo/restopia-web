'use client'
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { branchesService } from '@/services/branches.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Truck,
  Package,
  Building2,
  Check,
  X,
} from 'lucide-react'
import AcceptPOModal, { AcceptPODetailPayload } from './AcceptPOModal'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { getProductUomName } from '@/utils/productUomName'

interface RequestedPO {
  id: number
  code: string
  date: string
  fulfillment_date?: string
  total_price: number
  subtotal_price?: number
  additional_charge_price?: number
  tax_amount?: number
  discount_amount?: number
  status: 'pending' | 'accepted' | 'rejected' | 'fulfilled' | 'final' | 'partially_delivered' | 'delivered'
  description?: string
  created_at?: string
  created_by?: { id: number; name: string }
  branch?: { id: number; name: string; code?: string }
  supplier_branch?: { id: number; name: string; code?: string }
  additional_charges?: Array<{
    id: number
    name: string
    chart_of_account_id?: number | null
    amount: number
    description?: string
  }>
  purchase_order_details?: Array<{
    id: number
    qty: number
    price: number
    discount_amount?: number
    product_uom?: {
      id: number
      code?: string
      product?: { name: string }
      uom?: { name: string }
      franchise_price?: number
    }
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

export default function RequestedOrdersView() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const myBranchId = user?.branch?.id
  const canSeeFranchisePrice = hasPermission('common.franchise-price.read')
  const canTransition = hasPermission('purchase-order.update') || hasPermission('internal-purchase-order.update')
  const canDeliver = hasPermission('delivery.create')
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final' | 'accepted' | 'delivered' | 'rejected' | 'partially_delivered'>('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'' | 'pending' | 'partial' | 'paid'>('')
  const [remainingQtyFilter, setRemainingQtyFilter] = useState<'' | 'true' | 'false'>('')
  const [requesterBranchFilter, setRequesterBranchFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [acceptModalPO, setAcceptModalPO] = useState<RequestedPO | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, paymentStatusFilter, remainingQtyFilter, requesterBranchFilter, dateFrom, dateTo])

  // Requesting-branch options (the PO's branch_id). supplier_branch_id is
  // pinned to my branch and type to 'branch', so neither is exposed.
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'basic'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
    enabled: !!myBranchId,
  })
  const requesterBranches: any[] = ((branchesData as any)?.data ?? []).filter(
    (b: any) => b.id !== myBranchId,
  )

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['requested-orders', page, perPage, debouncedSearch, statusFilter, paymentStatusFilter, remainingQtyFilter, requesterBranchFilter, dateFrom, dateTo, myBranchId],
    enabled: !!myBranchId,
    queryFn: () =>
      purchaseOrdersService
        .list({
          page,
          per_page: perPage,
          include:
            'branch,supplier_branch,purchase_order_details,purchase_order_details.product_uom,additional_charges,created_by',
          sort: '-created_at',
          'filter[supplier_branch_id]': myBranchId || undefined,
          'filter[type]': 'branch',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[payment_status]': paymentStatusFilter || undefined,
          'filter[has_remaining_qty]': remainingQtyFilter || undefined,
          'filter[branch_id]': requesterBranchFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: RequestedPO[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

  const actionMutation = useMutation({
    mutationFn: ({ id, action, details, total_price, tax_id, additional_charges }: { id: number; action: 'accept' | 'reject'; details?: AcceptPODetailPayload[], total_price?: number, tax_id?: number, additional_charges?: { name: string; chart_of_account_id?: number; amount: number; description?: string }[] }) =>
      action === 'accept'
        ? purchaseOrdersService.accept(id, { details, total_price, tax_id, additional_charges })
        : purchaseOrdersService.reject(id),
    onSuccess: (_res, vars) => {
      // Refresh the supplier's incoming list AND the requester's PO list.
      queryClient.invalidateQueries({ queryKey: ['requested-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success(vars.action === 'accept' ? 'Order accepted' : 'Order rejected')
      setAcceptModalPO(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Action failed'),
  })

  const handleAction = (item: RequestedPO, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      setAcceptModalPO(item)
    } else {
      if (!window.confirm(`Are you sure you want to ${action} this order?`)) return
      actionMutation.mutate({ id: item.id, action })
    }
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    display: 'block',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
        }}
      >
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
            Requested PO
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Purchase orders from other branches requesting supply from your branch
          </p>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code..."
        activeCount={countActive(
          statusFilter, paymentStatusFilter, remainingQtyFilter, requesterBranchFilter, dateFrom, dateTo,
        )}
        onClear={() => {
          setStatusFilter('')
          setPaymentStatusFilter('')
          setRemainingQtyFilter('')
          setRequesterBranchFilter('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as any)
              }
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="final">Fulfilled</option>
              <option value="accepted">Accepted</option>
              <option value="delivered">Delivered</option>
              <option value="rejected">Rejected</option>
              <option value="partially_delivered">Partially Delivered</option>
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
        <FilterGroup title="Location">
          <FilterField label="Requesting branch">
            <FilterSelect
              block
              value={requesterBranchFilter}
              onChange={(e) => {
                setRequesterBranchFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Requesting Branches</option>
              {requesterBranches.map((b: any) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </FilterSelect>
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

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!myBranchId ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <Package size={32} color="var(--border)" style={{ margin: '0 auto' }} />
            <span
              style={{
                display: 'block',
                marginTop: 8,
                fontSize: 14,
                color: 'var(--foreground-muted)',
              }}
            >
              No branch assigned
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 12,
                color: 'var(--foreground-subtle)',
              }}
            >
              Assign a branch to your account to see incoming requests
            </span>
          </div>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              style={{
                height: 80,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                opacity: 0.6,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))
        ) : isError ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
              Failed to load requested orders.
            </span>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <Package size={32} color="var(--border)" style={{ margin: '0 auto' }} />
            <span
              style={{
                display: 'block',
                marginTop: 8,
                fontSize: 14,
                color: 'var(--foreground-muted)',
              }}
            >
              No incoming requests
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 12,
                color: 'var(--foreground-subtle)',
              }}
            >
              Other branches haven&apos;t requested supply from your branch yet
            </span>
          </div>
        ) : (
          items.map((item) => {
            const isExpanded = expandedId === item.id
            const statusMeta =
              STATUS_META[item.status as keyof typeof STATUS_META] ?? STATUS_META.pending
            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {item.code}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: statusMeta.bg,
                          color: statusMeta.color,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        from
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Building2 size={12} color="var(--foreground-subtle)" />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--accent)',
                          }}
                        >
                          {item.branch?.name ?? '—'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                      >
                        {item.date
                          ? formatDate(item.date)
                          : '—'}
                      </span>
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                      >
                        {item.purchase_order_details?.length ?? 0} item(s)
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', gap: 6 }}
                  >
                    {canTransition && (item.status === 'final' || item.status === 'rejected') && (
                      <button
                        type="button"
                        disabled={actionMutation.isPending}
                        onClick={() => handleAction(item, 'accept')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: 'var(--success)',
                          color: 'white',
                          border: '1px solid var(--success)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: actionMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: actionMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        <Check size={12} />
                        Accept
                      </button>
                    )}
                    {canTransition && (item.status === 'final' || item.status === 'accepted') && (
                      <button
                        type="button"
                        disabled={actionMutation.isPending}
                        onClick={() => handleAction(item, 'reject')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: 'var(--surface)',
                          color: 'var(--destructive)',
                          border: '1px solid var(--destructive)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: actionMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: actionMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        <X size={12} />
                        Reject
                      </button>
                    )}
                    {canDeliver && (item.status === 'accepted' || item.status === 'partially_delivered') && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/purchase/requested-orders/${item.id}/fulfill`,
                          )
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Truck size={12} />
                        Fulfill
                      </button>
                    )}
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={14} color="var(--foreground-muted)" />
                  ) : (
                    <ChevronDown size={14} color="var(--foreground-muted)" />
                  )}
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      padding: '16px 20px 20px',
                      background: 'var(--background)',
                    }}
                  >
                    {/* Info grid */}
                    <span style={{ ...sectionLabelStyle, marginBottom: 8 }}>
                      Order Information
                    </span>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      {[
                        { label: 'Source Branch', value: item.supplier_branch ? `${item.supplier_branch.code ?? ''} ${item.supplier_branch.name}` : '—' },
                        { label: 'Destination Branch', value: item.branch ? `${item.branch.code ?? ''} ${item.branch.name}` : '—' },
                        { label: 'Order Date', value: item.date ?? '—' },
                        { label: 'Fulfillment Date', value: item.fulfillment_date ?? '—' },
                        { label: 'Created By', value: item.created_by?.name ?? '—' },
                        { label: 'Status', value: item.status },
                      ].map((f) => (
                        <div
                          key={f.label}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                            {f.label}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {f.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <span style={{ ...sectionLabelStyle, marginBottom: 8 }}>
                      Requested Items
                    </span>

                    {(item.purchase_order_details?.length ?? 0) > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {(item.purchase_order_details ?? []).map((d, idx) => {
                          const unitPrice = d.price ?? d.product_uom?.franchise_price ?? 0
                          const lineSubtotal = ((d.qty ?? 0) * unitPrice) - (d.discount_amount ?? 0)
                          return (
                            <div
                              key={d.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 99,
                                  background: 'var(--accent-light-bg)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: 'var(--accent)',
                                  flexShrink: 0,
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: 'var(--foreground)',
                                }}
                              >
                                {getProductUomName(d.product_uom, d.product_uom?.product?.name) || '—'}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: 'var(--foreground-muted)',
                                  padding: '1px 6px',
                                  background: 'var(--background)',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {d.product_uom?.uom?.name ?? ''}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: 'var(--foreground)',
                                  minWidth: 30,
                                  textAlign: 'right',
                                }}
                              >
                                {(d.qty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--foreground-muted)',
                                  minWidth: 20,
                                  textAlign: 'center',
                                }}
                              >
                                ×
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: 'var(--accent)',
                                  minWidth: 80,
                                  textAlign: 'right',
                                }}
                              >
                                {canSeeFranchisePrice
                                  ? `Rp ${unitPrice.toLocaleString('id-ID')}`
                                  : '***'}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--foreground)',
                                  minWidth: 90,
                                  textAlign: 'right',
                                }}
                              >
                                {canSeeFranchisePrice
                                  ? `Rp ${lineSubtotal.toLocaleString('id-ID')}`
                                  : '***'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
                        No items loaded
                      </span>
                    )}

                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Subtotal */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontWeight: 500 }}>Subtotal</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                          {canSeeFranchisePrice
                            ? `Rp ${(item.subtotal_price ?? 0).toLocaleString('id-ID')}`
                            : '***'}
                        </span>
                      </div>

                      {/* Additional Charges */}
                      {(item.additional_charges?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(item.additional_charges ?? []).map((c: any) => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
                              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                                {c.name}{c.description ? ` — ${c.description}` : ''}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                                {canSeeFranchisePrice ? `Rp ${(c.amount ?? 0).toLocaleString('id-ID')}` : '***'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!item.additional_charges?.length && (item.additional_charge_price ?? 0) !== 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Additional Charges</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {canSeeFranchisePrice ? `Rp ${(item.additional_charge_price ?? 0).toLocaleString('id-ID')}` : '***'}
                          </span>
                        </div>
                      )}

                      {/* Tax */}
                      {(item.tax_amount ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Tax (PPN)</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {canSeeFranchisePrice ? `Rp ${(item.tax_amount ?? 0).toLocaleString('id-ID')}` : '***'}
                          </span>
                        </div>
                      )}

                      {/* Discount */}
                      {(item.discount_amount ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Discount</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--destructive)' }}>
                            {canSeeFranchisePrice ? `- Rp ${(item.discount_amount ?? 0).toLocaleString('id-ID')}` : '***'}
                          </span>
                        </div>
                      )}

                      {/* Total */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 4,
                          padding: '10px 12px',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Total
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                          {canSeeFranchisePrice
                            ? `Rp ${(item.total_price ?? 0).toLocaleString('id-ID')}`
                            : '***'}
                        </span>
                      </div>
                    </div>

                    {item.description && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--foreground-muted)',
                            display: 'block',
                            marginBottom: 2,
                          }}
                        >
                          NOTES
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                          {item.description}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <AcceptPOModal
        isOpen={!!acceptModalPO}
        onClose={() => setAcceptModalPO(null)}
        purchaseOrder={acceptModalPO}
        isSubmitting={actionMutation.isPending}
        onConfirm={(payload) => {
          if (acceptModalPO) {
            const calcLineSubtotal = (d: any) => {
              const gross = d.qty * d.price
              if (!d.discount_type || !d.discount_value) return gross
              if (d.discount_type === 'percent') return gross - (gross * d.discount_value / 100)
              return gross - d.discount_value
            }
            const subtotal = payload.details.reduce((sum, d) => sum + calcLineSubtotal(d), 0)
            const chargesTotal = (payload.additional_charges ?? []).reduce((sum, c) => sum + (c.amount || 0), 0)
            const total_price = subtotal + chargesTotal
            actionMutation.mutate({ id: acceptModalPO.id, action: 'accept', details: payload.details, total_price, tax_id: payload.tax_id, additional_charges: payload.additional_charges })
          }
        }}
      />
    </div>
  )
}
