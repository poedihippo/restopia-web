'use client'
import { formatDate } from '@/utils/date'
import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { stockOpnamesService } from '@/services/stock-opnames.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
} from 'lucide-react'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: {
    label: 'Draft',
    color: 'var(--foreground-muted)',
    bg: 'var(--surface)',
  },
  counting: {
    label: 'Counting',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  completed: {
    label: 'Completed',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

export default function StockOpnamesView() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('product-inventory.create') // Assuming same permission for now
  const canRead = hasPermission('product-inventory.menu')

  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(1000)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['stock-opnames', page, perPage, debouncedSearch],
    queryFn: () =>
      stockOpnamesService
        .list({
          page,
          per_page: perPage,
          include: 'branch,created_by',
          sort: '-id',
          'filter[search]': debouncedSearch || undefined,
        })
        .then((r) => r.data),
    enabled: canRead,
  })

  const items = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
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
            Stock Opnames
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Manage inventory physical counting and adjustments
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => router.push('/products/product-inventory/stock-opname/create')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--primary)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={16} />
            <span>Create Opname</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search by code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          />
        </div>
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
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Document Code</th>
              <th style={thStyle}>Branch</th>
              <th style={thStyle}>Created By</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      border: '2px solid var(--border)',
                      borderTopColor: 'var(--primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto',
                    }}
                  />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                    No stock opnames found.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item: any, idx: number) => {
                const statusMeta = STATUS_META[item.status?.toLowerCase()] || STATUS_META.draft
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>{(page - 1) * perPage + idx + 1}</td>
                    <td style={tdStyle}>{formatDate(item.date)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{item.code}</span>
                    </td>
                    <td style={tdStyle}>{item.branch?.name || '—'}</td>
                    <td style={tdStyle}>{item.created_by?.name || '—'}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: statusMeta.color,
                          backgroundColor: statusMeta.bg,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => router.push(`/products/product-inventory/stock-opname/${item.id}`)}
                        style={{
                          padding: 6,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--foreground-muted)',
                        }}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
}

const tdStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 13,
  color: 'var(--foreground)',
  verticalAlign: 'middle',
}

const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: disabled ? 'var(--background)' : 'var(--surface)',
  color: disabled ? 'var(--foreground-muted)' : 'var(--foreground)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
})
