'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import salesOrderService from '@/services/sales-order.service'

export default function SalesOrdersView() {
  const router = useRouter()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateGte, setDateGte] = useState('')
  const [dateLte, setDateLte] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, searchDebounced, statusFilter, typeFilter, dateGte, dateLte],
    queryFn: () =>
      salesOrderService
        .list({
          page,
          per_page: 15,
          sort: '-created_at',
          include: 'branch,customer',
          'filter[search]': searchDebounced || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[date_gte]': dateGte || undefined,
          'filter[date_lte]': dateLte || undefined,
        })
        .then((r) => r.data),
  })

  const items = (data as any)?.data?.data ?? []
  const meta = (data as any)?.data?.meta

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => salesOrderService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('Order deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error'),
  })

  const statusColor = (s: string) =>
    s === 'final'
      ? { bg: 'var(--success-bg)', color: 'var(--success)' }
      : { bg: 'var(--warning-bg)', color: 'var(--warning)' }

  const typeColor = (t: string) =>
    t === 'online'
      ? { bg: 'var(--info-bg)', color: 'var(--info)' }
      : { bg: 'var(--accent-light-bg)', color: 'var(--accent)' }

  const thStyle = {
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle = {
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Sales Orders
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            All offline and online orders
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/sales-orders/create')}
          style={{
            height: 40,
            padding: '0 20px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + New Order
        </button>
      </div>

      {/* Filters toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search code / customer..."
          style={{
            height: 36,
            width: 260,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Final</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        >
          <option value="">All Types</option>
          <option value="offline">Offline</option>
          <option value="online">Online</option>
        </select>
        <input
          type="date"
          value={dateGte}
          onChange={(e) => {
            setDateGte(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>–</span>
        <input
          type="date"
          value={dateLte}
          onChange={(e) => {
            setDateLte(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        />
        {(search || statusFilter || typeFilter || dateGte || dateLte) && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setTypeFilter('')
              setDateGte('')
              setDateLte('')
              setPage(1)
            }}
            style={{
              height: 36,
              padding: '0 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            Clear
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
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Fulfillment</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 16,
                          background: 'var(--border)',
                          borderRadius: 4,
                          opacity: 0.6,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 48,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No orders found
                </td>
              </tr>
            )}
            {items.map((item: any) => {
              const sc = statusColor(item.status)
              const tc = typeColor(item.type)
              return (
                <tr
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/sales-orders/${item.id}`)}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent)' }}>
                    {item.code}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background: tc.bg,
                        color: tc.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {item.customer?.name ?? item.customer_name ?? '—'}
                  </td>
                  <td style={tdStyle}>{item.date}</td>
                  <td style={tdStyle}>
                    {item.fulfillment_date
                      ? new Date(item.fulfillment_date).toLocaleDateString('id-ID')
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    Rp {Number(item.total_price).toLocaleString('id-ID')}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background: sc.bg,
                        color: sc.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => router.push(`/sales-orders/${item.id}`)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          color: 'var(--foreground)',
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--destructive)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--destructive)',
                        }}
                      >
                        Delete
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
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            {meta.total} orders · Page {page} of {meta.last_page}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                height: 32,
                padding: '0 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
                fontSize: 13,
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={page === meta.last_page}
              style={{
                height: 32,
                padding: '0 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                cursor: page === meta.last_page ? 'not-allowed' : 'pointer',
                color:
                  page === meta.last_page ? 'var(--foreground-subtle)' : 'var(--foreground)',
                fontSize: 13,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                marginBottom: 8,
                color: 'var(--foreground)',
              }}
            >
              Delete Order
            </h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginBottom: 24 }}>
              Delete order <strong>{deleteTarget.code}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  height: 40,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(deleteTarget.id)}
                disabled={deleting}
                style={{
                  flex: 1,
                  height: 40,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive)',
                  color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
