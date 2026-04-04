'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { productionsService } from '@/services/productions.service'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Factory,
} from 'lucide-react'

interface Production {
  id: number
  code: string
  date: string
  status: 'pending' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  production_details?: Array<{ id: number }>
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

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

export default function ProductionsView() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['productions', page, debouncedSearch, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      productionsService
        .list({
          page,
          per_page: 15,
          include: 'branch',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[start_date]': dateFrom || undefined,
          'filter[end_date]': dateTo || undefined,
        })
        .then((r) => r.data),
  })

  const items: Production[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      toast.success('Production deleted')
      setDeleteConfirmId(null)
    },
    onError: () => toast.error('Failed to delete'),
  })

  const anyFilter = !!(debouncedSearch || statusFilter || dateFrom || dateTo)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Productions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Manage factory production orders
          </p>
        </div>
        <button
          onClick={() => router.push('/production/create')}
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
          New Production
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 280 }}>
          <Search
            size={14}
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
            placeholder="Search productions..."
            style={{
              ...inputStyle,
              paddingLeft: 32,
              width: 280,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any)
            setPage(1)
          }}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Final</option>
        </select>

        {/* Date from */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            style={inputStyle}
          />
        </div>

        {/* Date to */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            style={inputStyle}
          />
        </div>

        {/* Clear */}
        {anyFilter && (
          <button
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
            style={{
              padding: '7px 12px',
              background: 'var(--surface)',
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
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
            >
              {(
                [
                  { label: 'Code', width: 160 },
                  { label: 'Branch', width: 160 },
                  { label: 'Date', width: 130 },
                  { label: 'Status', width: 110 },
                  { label: 'Items', width: 80 },
                  { label: 'Created', width: 140 },
                  { label: '', width: 100 },
                ] as const
              ).map(({ label, width }, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    width,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    {[60, 40, 80, 50, 70].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 14,
                          borderRadius: 4,
                          background: 'var(--border)',
                          width: `${w}%`,
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--destructive)' }}
                >
                  Failed to load productions
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Factory size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No productions found
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                return (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                    }}
                  >
                    {/* Code */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          fontSize: 13,
                        }}
                      >
                        {item.code}
                      </span>
                    </td>

                    {/* Branch */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground)' }}>
                      {item.branch?.name ?? '—'}
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.date
                        ? new Date(item.date).toLocaleDateString('id-ID')
                        : '—'}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 700,
                          background: statusMeta.bg,
                          color: statusMeta.color,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>

                    {/* Items */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                        textAlign: 'center',
                      }}
                    >
                      {item.production_details?.length ?? 0}
                    </td>

                    {/* Created */}
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('id-ID')
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => router.push(`/production/${item.id}/detail`)}
                          title="View"
                          style={{
                            padding: 6,
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--foreground-muted)',
                            display: 'flex',
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => router.push(`/production/${item.id}/edit`)}
                          title="Edit"
                          style={{
                            padding: 6,
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--foreground-muted)',
                            display: 'flex',
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          title="Delete"
                          style={{
                            padding: 6,
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--destructive)',
                            display: 'flex',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, meta.total)} of {meta.total}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={13} />
              Prev
            </button>
            <span
              style={{
                fontSize: 12,
                color: 'var(--foreground)',
                padding: '0 8px',
                fontWeight: 500,
              }}
            >
              {page} / {meta.last_page}
            </span>
            <button
              disabled={page === meta.last_page}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                cursor: page === meta.last_page ? 'not-allowed' : 'pointer',
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: page === meta.last_page ? 0.5 : 1,
              }}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}
            >
              Delete Production
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              This will permanently remove the production order and all its details.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '8px 16px',
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
                  padding: '8px 16px',
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
