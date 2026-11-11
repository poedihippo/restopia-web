'use client'
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { branchesService } from '@/services/branches.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  PackageSearch,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface InternalOrder {
  id: number
  code: string
  date: string
  type?: string
  status: 'pending' | 'accepted' | 'rejected' | 'fulfilled' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  supplier_branch_id?: number
  supplier_branch?: { id: number; name: string; code?: string }
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

export default function InternalOrdersView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, user } = useAuth()
  const canRead = hasPermission("internal-purchase-order.read");
  const myBranchId = user?.branch?.id
  const canCreate = hasPermission('internal-purchase-order.create')
  const canEdit = hasPermission('internal-purchase-order.update')
  const canDelete = hasPermission('internal-purchase-order.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final' | 'accepted' | 'rejected' | 'partially_delivered' | 'delivered'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'' | 'pending' | 'partial' | 'paid'>('')
  const [remainingQtyFilter, setRemainingQtyFilter] = useState<'' | 'true' | 'false'>('')
  const [supplierBranchFilter, setSupplierBranchFilter] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, paymentStatusFilter, remainingQtyFilter, supplierBranchFilter])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Internal orders are purchase orders sourced from another branch (type
  // 'branch' / supplier_branch_id present).
  const { data, isLoading: isFirstLoad, isFetching, isError } = useQuery({
    queryKey: ['internal-orders', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, paymentStatusFilter, remainingQtyFilter, supplierBranchFilter, myBranchId],
    enabled: !!myBranchId,
    queryFn: () =>
      purchaseOrdersService
        .list({
          page,
          per_page: perPage,
          include: 'supplier_branch,supplier_branch.company,branch',
          sort: '-created_at',
          'filter[branch_id]': myBranchId || undefined,
          'filter[type]': 'branch',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
          'filter[payment_status]': paymentStatusFilter || undefined,
          'filter[has_remaining_qty]': remainingQtyFilter || undefined,
          'filter[supplier_branch_id]': supplierBranchFilter || undefined,
        })
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = isFirstLoad || isFetching

  const items: InternalOrder[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-orders'] })
      toast.success('Internal order deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  // Source-branch options (the PO's supplier_branch_id). branch_id is pinned
  // to my branch and type to 'branch', so neither is exposed.
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'basic'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
    enabled: !!myBranchId,
  })
  const sourceBranches: any[] = ((branchesData as any)?.data ?? []).filter(
    (b: any) => b.id !== myBranchId,
  )

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }

  const actionBtnStyle: React.CSSProperties = {
    padding: 6,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    display: 'flex',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
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
            Internal Orders
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage stock orders sourced from another branch
          </p>
        </div>
        {canCreate && (<button
          onClick={() => router.push('/purchase/internal-orders/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
          <Plus size={15} />New Order
        </button>)}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search orders..."
        activeCount={countActive(
          statusFilter, paymentStatusFilter, remainingQtyFilter, supplierBranchFilter, dateFrom, dateTo,
        )}
        onClear={() => {
          setStatusFilter('')
          setDateFrom('')
          setDateTo('')
          setPaymentStatusFilter('')
          setRemainingQtyFilter('')
          setSupplierBranchFilter('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="final">Final</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="partially_delivered">Partially Delivered</option>
              <option value="delivered">Delivered</option>
            </FilterSelect>
            <FilterSelect value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as any)}>
              <option value="">All Payment Status</option>
              <option value="pending">Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Paid</option>
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Location">
          <FilterField label="Source branch">
            <FilterSelect block value={supplierBranchFilter} onChange={(e) => setSupplierBranchFilter(e.target.value)}>
              <option value="">All Source Branches</option>
              {sourceBranches.map((b: any) => (
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
              onFromChange={(v) => setDateFrom(v)}
              onToChange={(v) => setDateTo(v)}
            />
          </FilterField>
          <FilterField label="Remaining qty">
            <FilterSelect block value={remainingQtyFilter} onChange={(e) => setRemainingQtyFilter(e.target.value as any)}>
              <option value="">Remaining Qty: All</option>
              <option value="true">Has Remaining Qty</option>
              <option value="false">Fully Delivered</option>
            </FilterSelect>
          </FilterField>
        </FilterGroup>
      </FilterBar>
      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 160 }}>Code</th>
              <th style={thStyle}>Source Branch</th>
              <th style={{ ...thStyle, width: 160 }}>Branch</th>
              <th style={{ ...thStyle, width: 130 }}>Date</th>
              <th style={{ ...thStyle, width: 110 }}>Status</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 5 ? 60 : j === 4 ? 70 : '75%',
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
                  colSpan={7}
                  style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}
                >
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load internal orders.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                    <span style={{ fontSize: 14 }}>No internal orders found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                const po = item as any
                const branchName = po?.supplier_branch?.name
                const branchCode = po?.supplier_branch?.code
                const sourceLabel = branchName
                  ? `${branchName}${branchCode ? ` (${branchCode})` : ''}`
                  : '—'
                return (
                  <tr
                    key={item.id}
                    style={{ transition: 'background 120ms' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--background)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent)',
                        }}
                      >
                        {item.code}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                        }}
                      >
                        {sourceLabel}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.branch?.name ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.date
                          ? item.date
                          : '—'}
                      </span>
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
                          background: statusMeta.bg,
                          color: statusMeta.color,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          onClick={() =>
                            router.push(`/purchase/internal-orders/${item.id}/detail`)
                          }
                          style={actionBtnStyle}
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {canEdit && (<button
                          onClick={() =>
                            router.push(`/purchase/internal-orders/${item.id}/edit`)
                          }
                          style={actionBtnStyle}
                          title="Edit">
                          <Pencil size={14} />
                        </button>)}
                        {canDelete && (<button
                          onClick={() => setDeleteConfirmId(item.id)}
                          style={{ ...actionBtnStyle, color: 'var(--destructive)' }}
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
              Delete Internal Order
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
