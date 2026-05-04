'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { useAuth } from '@/hooks/useAuth'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Truck,
  CheckCircle,
  RotateCcw,
} from 'lucide-react'

interface Delivery {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  target_branch?: { id: number; name: string }
  purchase_order?: { id: number; code: string }
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
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('delivery.create')
  const canEdit = hasPermission('delivery.update')
  const canDelete = hasPermission('delivery.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final'>('final')
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
    queryKey: ['deliveries', page, debouncedSearch, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      deliveriesService
        .list({
          page,
          per_page: 15,
          include: 'branch,target_branch,purchase_order',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[start_date]': dateFrom || undefined,
          'filter[end_date]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: Delivery[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deliveriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
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
    background: 'var(--surface)',
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
            Track outgoing shipments to other branches
          </p>
        </div>
        {canCreate && (
          <button
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
            }}
          >
            <Plus size={15} />
            New Delivery
          </button>
        )}
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
            placeholder="Search deliveries..."
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
              <th style={{ ...thStyle, width: 160 }}>Code</th>
              <th style={thStyle}>From Branch</th>
              <th style={{ ...thStyle, width: 160 }}>To Branch</th>
              <th style={{ ...thStyle, width: 140 }}>PO</th>
              <th style={{ ...thStyle, width: 120 }}>Date</th>
              <th style={{ ...thStyle, width: 140 }}>Total</th>
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
              items.map((item) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
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
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {item.branch?.name ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.target_branch?.name ?? '—'}
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
                          ? new Date(item.date).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {'Rp ' + (item.total_price ?? 0).toLocaleString('id-ID')}
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
                        <button
                          onClick={() => router.push(`/transfer/deliveries/${item.id}/detail`)}
                          style={actionBtnStyle}
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => router.push(`/transfer/deliveries/${item.id}/edit`)}
                            style={actionBtnStyle}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            style={{ ...actionBtnStyle, color: 'var(--destructive)' }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && (meta.last_page ?? meta.total_pages ?? 1) > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Page {page} of {meta.last_page ?? meta.total_pages ?? 1}
          </span>
          <button
            onClick={() =>
              setPage((p) => Math.min(meta.last_page ?? meta.total_pages ?? 1, p + 1))
            }
            disabled={page === (meta.last_page ?? meta.total_pages ?? 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color:
                page === (meta.last_page ?? meta.total_pages ?? 1)
                  ? 'var(--foreground-subtle)'
                  : 'var(--foreground)',
              cursor:
                page === (meta.last_page ?? meta.total_pages ?? 1) ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

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
  )
}
