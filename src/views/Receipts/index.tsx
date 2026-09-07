'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { receiptsService } from '@/services/receipts.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  ReceiptText,
  CheckCircle,
  RotateCcw,
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
  const { hasPermission } = useAuth()
  const canRead = hasPermission("receipt.read");
  const canCreate = hasPermission('receipt.create')
  const canEdit = hasPermission('receipt.update')
  const canDelete = hasPermission('receipt.delete')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['receipts', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      receiptsService
        .list({
          page,
          per_page: perPage,
          include: 'branch,delivery,delivery.branch,delivery.purchase_order,delivery.purchase_order.supplier',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[start_date]': dateFrom || undefined,
          'filter[end_date]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: Receipt[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

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
    mutationFn: ({ id, status }: { id: number; status: 'pending' | 'final' }) =>
      receiptsService.update(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Status updated')
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ?? 'Failed to update status'
      toast.error(msg)
    },
  })

  const hasFilters = !!(
    (statusFilter && statusFilter !== 'final') ||
    dateFrom ||
    dateTo ||
    debouncedSearch
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

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
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
        {canCreate && (<button
          onClick={() => router.push('/transfer/receipts/create')}
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
          <Plus size={15} />New Receipt
        </button>)}
      </div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ position: 'relative', maxWidth: 280 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipts..."
            style={{
              ...inputBase,
              width: 280,
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | 'pending' | 'final')
            setPage(1)
          }}
          style={{
            ...inputBase,
            padding: '8px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Final</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            style={{ ...inputBase, padding: '7px 10px', fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            style={{ ...inputBase, padding: '7px 10px', fontSize: 12 }}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setStatusFilter('final')
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
            style={{
              padding: '7px 12px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--foreground-muted)',
              cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>
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
