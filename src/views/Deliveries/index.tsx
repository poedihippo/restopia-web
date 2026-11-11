'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { receiptsService } from '@/services/receipts.service'
import { branchesService } from '@/services/branches.service'
import { useAuth } from '@/hooks/useAuth'
import { canUserCreateReceiptForDelivery } from '@/utils/receiptValidation'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Truck,
  CheckCircle,
  RotateCcw,
  ClipboardList,
} from 'lucide-react'

interface Delivery {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final'
  source_type?:
  | 'po_from_supplier'
  | 'po_from_branch'
  | 'transfer_to_branch'
  | 'so_to_branch'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  target_branch?: { id: number; name: string }
  purchase_order?: { id: number; code: string; supplier?: { id: number; name: string } }
  sales_order?: { id: number; code: string; customer_name?: string }
}

// FROM/TO derivation per source_type — mirrors the delivery detail page's
// branch/target_branch fields, plus the supplier fallback a plain PO
// delivery needs: a po_from_supplier delivery has no distinct "source
// branch" (branch_id defaults server-side to the same receiving branch as
// target_branch_id), so FROM there must come from purchase_order.supplier
// instead, or every supplier delivery shows warehouse -> warehouse.
const getFromTo = (item: Delivery): { from: string; to: string } => {
  if (item.source_type === 'po_from_supplier') {
    return {
      from: item.purchase_order?.supplier?.name ?? 'Supplier',
      to: item.target_branch?.name ?? item.branch?.name ?? '—',
    }
  }
  if (item.source_type === 'so_to_branch') {
    return {
      from: item.branch?.name ?? '—',
      to: item.target_branch?.name ?? item.sales_order?.customer_name ?? '—',
    }
  }
  // po_from_branch / transfer_to_branch (and any other/legacy record):
  // branch = source, target_branch = destination.
  return {
    from: item.branch?.name ?? '—',
    to: item.target_branch?.name ?? '—',
  }
}

const STATUS_META = {
  pending: {
    label: 'Pending',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  final: {
    label: 'Final',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
}

export default function DeliveriesView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isSuperadmin, hasPermission } = useAuth()
  const canRead = hasPermission("delivery.read");
  const canCreate = hasPermission('delivery.create')
  const canEdit = hasPermission('delivery.update')
  const canDelete = hasPermission('delivery.delete')
  const canCreateReceipt = hasPermission('receipt.create')

  // The "New Delivery" button is hidden on request — NOT removed. Flip this to
  // true to bring it back.
  const SHOW_CREATE_BUTTON = false

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final'>('final')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState('')
  const [hasReceiptFilter, setHasReceiptFilter] = useState<'' | 'true' | 'false'>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [targetBranchFilter, setTargetBranchFilter] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, sourceTypeFilter, hasReceiptFilter, branchFilter, targetBranchFilter])

  // Branch options for the From/To filters: superadmin sees every branch,
  // other users only the branches they're assigned to.
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'basic'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
    enabled: !!isSuperadmin,
  })
  const availableBranches: any[] = isSuperadmin
    ? (branchesData as any)?.data ?? []
    : (user as any)?.branches ?? []
  const showBranchFilters = !!isSuperadmin || availableBranches.length > 1

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['deliveries', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, sourceTypeFilter, hasReceiptFilter, branchFilter, targetBranchFilter],
    staleTime: 0,
    queryFn: () =>
      deliveriesService
        .list({
          page,
          per_page: perPage,
          include: 'branch,target_branch,purchase_order,purchase_order.supplier,sales_order',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          // GET /v1/deliveries date filters are date_gte / date_lte.
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
          'filter[source_type]': sourceTypeFilter || undefined,
          'filter[has_receipt]': hasReceiptFilter || undefined,
          'filter[branch_id]': branchFilter || undefined,
          'filter[target_branch_id]': targetBranchFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Delivery[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deliveriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Delivery deleted')
      setDeleteConfirmId(null)
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ?? 'Failed to delete delivery'
      toast.error(msg)
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'pending' | 'final' }) =>
      deliveriesService.update(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Status updated')
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ?? 'Failed to update status'
      toast.error(msg)
    },
  })

  const handleEditReceipt = (deliveryId: number) => {
    router.push(`/transfer/receipts?delivery_id=${deliveryId}`)
  }

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
            Deliveries
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Kelola pengiriman masuk (dari supplier) dan keluar (ke cabang)
          </p>
        </div>
        {SHOW_CREATE_BUTTON && canCreate && (<button
          onClick={() => router.push('/transfer/deliveries/create')}
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
          <Plus size={15} />New Delivery
                              </button>)}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deliveries..."
        activeCount={countActive(
          statusFilter !== 'final' ? statusFilter : '',
          sourceTypeFilter, hasReceiptFilter, branchFilter, targetBranchFilter,
          dateFrom, dateTo,
        )}
        onClear={() => {
          setStatusFilter('final')
          setDateFrom('')
          setDateTo('')
          setSourceTypeFilter('')
          setHasReceiptFilter('')
          setBranchFilter('')
          setTargetBranchFilter('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as '' | 'pending' | 'final')
                setPage(1)
              }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="final">Final</option>
            </FilterSelect>
            <FilterSelect
              value={sourceTypeFilter}
              onChange={(e) => {
                setSourceTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Sources</option>
              <option value="po_from_supplier">PO from Supplier</option>
              <option value="po_from_branch">PO from Branch</option>
              <option value="transfer_to_branch">Transfer to Branch</option>
              <option value="so_to_branch">SO to Branch</option>
            </FilterSelect>
            <FilterSelect
              value={hasReceiptFilter}
              onChange={(e) => {
                setHasReceiptFilter(e.target.value as '' | 'true' | 'false')
                setPage(1)
              }}
            >
              <option value="">Receipt: All</option>
              <option value="true">Has Receipt</option>
              <option value="false">No Receipt</option>
            </FilterSelect>
          </>
        }
      >
        {showBranchFilters && (
          <FilterGroup title="Branches">
            <FilterField label="From branch">
              <FilterSelect
                block
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All From Branches</option>
                {availableBranches.map((b: any) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
            <FilterField label="To branch">
              <FilterSelect
                block
                value={targetBranchFilter}
                onChange={(e) => {
                  setTargetBranchFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All To Branches</option>
                {availableBranches.map((b: any) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
          </FilterGroup>
        )}
        <FilterGroup title="Dates">
          <FilterField label="Delivery date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => { setDateFrom(v); setPage(1) }}
              onToChange={(v) => { setDateTo(v); setPage(1) }}
            />
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
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 160 }}>Code</th>
              <th style={thStyle}>From Branch</th>
              <th style={{ ...thStyle, width: 160 }}>To Branch</th>
              <th style={{ ...thStyle, width: 140 }}>PO</th>
              <th style={{ ...thStyle, width: 120 }}>Date</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 7 ? 60 : j === 6 ? 70 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load deliveries.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <Truck size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No deliveries found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                // Internal deliveries/transfers are price-free.
                const isInternal = ['po_from_branch', 'transfer_to_branch'].includes(
                  (item as any).source_type,
                )
                const { from: fromLabel, to: toLabel } = getFromTo(item)
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
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {(page - 1) * perPage + idx + 1}
                    </td>
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
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {fromLabel}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {toLabel}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.purchase_order?.code ?? '—'}
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
                        {canEdit && (item.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() =>
                              toggleStatusMutation.mutate({ id: item.id, status: 'final' })
                            }
                            disabled={toggleStatusMutation.isPending}
                            title="Finalize"
                            style={{ ...actionBtnStyle, color: 'var(--success)' }}
                          >
                            <CheckCircle size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              toggleStatusMutation.mutate({ id: item.id, status: 'pending' })
                            }
                            disabled={toggleStatusMutation.isPending}
                            title="Revert to Pending"
                            style={{ ...actionBtnStyle, color: 'var(--warning)' }}
                          >
                            <RotateCcw size={14} />
                          </button>
                        ))}
                        {item.status === 'final' &&
                          canCreateReceipt &&
                          canUserCreateReceiptForDelivery(item, user, isSuperadmin) && (
                          <button
                            onClick={() => handleEditReceipt(item.id)}
                            style={actionBtnStyle}
                            title="Process Receipt"
                          >
                            <ClipboardList size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/transfer/deliveries/${item.id}/detail`)}
                          style={actionBtnStyle}
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {canEdit && (<button
                          onClick={() => router.push(`/transfer/deliveries/${item.id}/edit`)}
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
              Delete Delivery
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently remove the delivery and its details.
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
