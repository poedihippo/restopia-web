'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { receiptsService } from '@/services/receipts.service'
import { deliveriesService } from '@/services/deliveries.service'
import { branchesService } from '@/services/branches.service'
import { toastMutationApiError } from '@/utils/apiError'
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
  ReceiptText,
  CheckCircle,
  RotateCcw,
  X,
} from 'lucide-react'

interface Receipt {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  delivery?: {
    id: number
    code: string
    source_type?: string
    branch?: { id: number; name: string }
    purchase_order?: { id: number; code: string; supplier?: { id: number; name: string } }
  }
}

// Source of the received goods: the PO's supplier for vendor receipts, or
// the shipping branch for internal transfer/branch-PO receipts.
function getSupplierName(item: Receipt): string {
  const sourceType = item.delivery?.source_type
  if (sourceType === 'po_from_supplier') {
    return item.delivery?.purchase_order?.supplier?.name ?? '—'
  }
  if (sourceType === 'po_from_branch' || sourceType === 'transfer_to_branch') {
    return item.delivery?.branch?.name ?? '—'
  }
  return '—'
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

export default function ReceiptsView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isSuperadmin, hasPermission } = useAuth()
  const canRead = hasPermission("receipt.read");
  const canCreate = hasPermission('receipt.create')
  const canEdit = hasPermission('receipt.update')
  const canDelete = hasPermission('receipt.delete')

  // The "New Receipt" button is hidden on request — NOT removed. Flip this to
  // true to bring it back.
  const SHOW_CREATE_BUTTON = false
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [targetBranchFilter, setTargetBranchFilter] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const deliveryIdParam = router.query.delivery_id ? String(router.query.delivery_id) : ''

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, deliveryIdParam, branchFilter, targetBranchFilter])

  // Branch options for the branch filters: superadmin sees every branch,
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
    queryKey: ['receipts', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, deliveryIdParam, branchFilter, targetBranchFilter],
    queryFn: () =>
      receiptsService
        .list({
          page,
          per_page: perPage,
          include: 'branch,delivery,delivery.branch,delivery.purchase_order,delivery.purchase_order.supplier',
          sort: '-created_at',
          'filter[delivery_id]': deliveryIdParam || undefined,
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          // GET /v1/receipts date filters are date_gte / date_lte.
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
          'filter[branch_id]': branchFilter || undefined,
          'filter[target_branch_id]': targetBranchFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Receipt[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const { data: filteredDeliveryData } = useQuery({
    queryKey: ['delivery-for-receipt-filter', deliveryIdParam],
    queryFn: () =>
      deliveriesService
        .findById(Number(deliveryIdParam), {
          include: 'branch,target_branch',
        })
        .then((r) => r.data),
    enabled: !!deliveryIdParam && !isNaN(Number(deliveryIdParam)),
  })
  const filteredDelivery = (filteredDeliveryData as any)?.data

  const isSenderOfFilteredDelivery = React.useMemo(() => {
    if (!filteredDelivery) return false
    return !canUserCreateReceiptForDelivery(filteredDelivery, user, isSuperadmin)
  }, [filteredDelivery, user, isSuperadmin])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => receiptsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Receipt deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const toggleStatusMutation = useMutation({
    // PATCH /v1/receipts/{id} (UpdateReceiptRequest) requires `details`, each
    // row with qty + status — a bare { status } is rejected. Load the receipt
    // and send its current lines back unchanged (matched by id) with the new
    // header status.
    mutationFn: async ({ id, status }: { id: number; status: 'pending' | 'final' }) => {
      const res = await receiptsService.findById(id, { include: 'receipt_details' } as any)
      const receipt = (res.data as any)?.data
      const rawDetails: any[] = receipt?.receipt_details ?? receipt?.details ?? []
      if (!rawDetails.length) throw new Error('Receipt has no detail lines to send')
      const details = rawDetails.map((d: any) => ({
        id: d.id ?? undefined,
        delivery_detail_id: d.delivery_detail_id ?? undefined,
        product_uom_id: d.product_uom_id ?? d.product_uom?.id ?? undefined,
        product_uom_batch_id: d.product_uom_batch_id ?? d.product_uom_batch?.id ?? undefined,
        planned_batch_code: d.planned_batch_code || undefined,
        planned_expiry_date: d.planned_expiry_date
          ? String(d.planned_expiry_date).split('T')[0]
          : undefined,
        qty: Number(d.qty ?? 0),
        status: d.status ?? 'success',
        description: d.description || undefined,
        client_ref: d.client_ref || undefined,
      }))
      return receiptsService.update(id, {
        status,
        date: receipt?.date ? String(receipt.date).split('T')[0].split(' ')[0] : undefined,
        description: receipt?.description || undefined,
        details,
      } as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Status updated')
    },
    onError: (error: any) => {
      if (error?.response) {
        toastMutationApiError(error, 'Failed to update status')
        return
      }
      toast.error(error?.message ?? 'Failed to update status')
    },
  })

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

  const deliveryPillStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--foreground-muted)',
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
            Receipts
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Record goods received from deliveries
          </p>
        </div>
        {SHOW_CREATE_BUTTON && canCreate && !isSenderOfFilteredDelivery && (
          <button
            onClick={() =>
              router.push(
                deliveryIdParam
                  ? `/transfer/receipts/create?delivery_id=${deliveryIdParam}`
                  : '/transfer/receipts/create'
              )
            }
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
            }}
          >
            <Plus size={15} />New Receipt
          </button>
        )}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search receipts..."
        activeCount={countActive(
          statusFilter, branchFilter, targetBranchFilter,
          dateFrom, dateTo, deliveryIdParam,
        )}
        onClear={() => {
          setStatusFilter('')
          setDateFrom('')
          setDateTo('')
          setBranchFilter('')
          setTargetBranchFilter('')
          setSearch('')
          setPage(1)
          const query = { ...router.query }
          delete query.delivery_id
          router.push({ pathname: router.pathname, query }, undefined, { shallow: true })
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
            {deliveryIdParam && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-light-bg)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                <span>Delivery #{deliveryIdParam}</span>
                <button
                  type="button"
                  onClick={() => {
                    const query = { ...router.query }
                    delete query.delivery_id
                    router.push({ pathname: router.pathname, query }, undefined, { shallow: true })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear delivery filter"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </>
        }
      >
        {showBranchFilters && (
          <FilterGroup title="Branches">
            <FilterField label="Branch">
              <FilterSelect
                block
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Branches</option>
                {availableBranches.map((b: any) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
            <FilterField label="Target branch">
              <FilterSelect
                block
                value={targetBranchFilter}
                onChange={(e) => {
                  setTargetBranchFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Target Branches</option>
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
          <FilterField label="Receipt date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => { setDateFrom(v); setPage(1) }}
              onToChange={(v) => { setDateTo(v); setPage(1) }}
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      {isSenderOfFilteredDelivery && filteredDelivery && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            color: 'var(--warning)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Pengiriman #{deliveryIdParam} ditujukan ke{' '}
          <strong>{filteredDelivery.target_branch?.name ?? 'Cabang Tujuan'}</strong>.
          Pembuatan receipt hanya dapat dilakukan oleh cabang penerima.
        </div>
      )}
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
              <th style={{ ...thStyle, width: 160 }}>Branch</th>
              <th style={{ ...thStyle, width: 160 }}>Delivery</th>
              <th style={{ ...thStyle, width: 160 }}>Supplier</th>
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
                    Failed to load receipts.
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
                    <ReceiptText size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No receipts found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                // Internal receipts (from internal deliveries) are price-free.
                const isInternal = ['po_from_branch', 'transfer_to_branch'].includes(
                  (item.delivery as any)?.source_type,
                )
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
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {(page - 1) * perPage + idx + 1}
                      </span>
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
                        {item.branch?.name ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {canRead ? item.delivery?.code ? (
                        <span style={deliveryPillStyle}>{item.delivery.code}</span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>—</span>
                      ) : "***"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                        {canRead ? getSupplierName(item) : '***'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.date}
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
                            onClick={() => router.push(`/transfer/receipts/${item.id}/edit`)}
                            title="Edit / Accept"
                            style={{ ...actionBtnStyle, color: 'var(--success)' }}
                          >
                            <Pencil size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Revert receipt to pending?')) {
                                toggleStatusMutation.mutate({ id: item.id, status: 'pending' })
                              }
                            }}
                            title="Revert to Pending"
                            style={{ ...actionBtnStyle, color: 'var(--warning)' }}
                          >
                            <RotateCcw size={14} />
                          </button>
                        ))}
                        <button
                          onClick={() => router.push(`/transfer/receipts/${item.id}/detail`)}
                          style={actionBtnStyle}
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
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
              Delete Receipt
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently remove the receipt and its details.
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
