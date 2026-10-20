'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { sellableSettlementsService } from '@/services/sellable-settlements.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'
import { Plus, Search, Eye, PlayCircle } from 'lucide-react'
import RunSettlementModal from './RunSettlementModal'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  final: {
    label: 'Final',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  reversed: {
    label: 'Reversed',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

export default function SellableSettlementsView() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canRun =
    hasPermission('sellable-settlement.create') ||
    hasPermission('sellable-settlement.menu') ||
    hasPermission('product-inventory.create')
  const canRead =
    hasPermission('sellable-settlement.read') ||
    hasPermission('sellable-settlement.menu') ||
    hasPermission('product-inventory.menu')

  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [code, setCode] = useState('')
  const [debouncedCode, setDebouncedCode] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [runOpen, setRunOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCode(code)
      setPage(1)
    }, 500)
    return () => clearTimeout(t)
  }, [code])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, dateFrom, dateTo])

  const { data, isLoading } = useQuery({
    queryKey: [
      'sellable-settlements',
      page,
      perPage,
      debouncedCode,
      statusFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      sellableSettlementsService
        .list({
          page,
          per_page: perPage,
          include: 'created_by,lines',
          sort: '-id',
          'filter[code]': debouncedCode || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        })
        .then((r) => r.data),
    enabled: canRead,
  })

  // Unwrap list body: { data: [], meta } or { success, data: { data: [], meta } }
  const listBody = useMemo(() => {
    const body = (data as any)?.data ?? (data as any)
    if (Array.isArray(body)) return { items: body, meta: (data as any)?.meta }
    if (body && Array.isArray(body.data)) {
      return { items: body.data, meta: body.meta ?? (data as any)?.meta }
    }
    if (body?.data && Array.isArray(body.data.data)) {
      return { items: body.data.data, meta: body.data.meta }
    }
    return { items: [], meta: undefined }
  }, [data])

  const items = listBody.items
  const meta = listBody.meta

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    outline: 'none',
  }

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
          flexWrap: 'wrap',
          gap: 16,
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
            Sellable Settlements
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Settle deferred SKU sales into physical stock deduction and COGS
          </p>
        </div>

        {canRun && (
          <button
            onClick={() => setRunOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={16} />
            <span>Run Settlement</span>
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
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 400 }}>
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
            value={code}
            onChange={(e) => setCode(e.target.value)}
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, minWidth: 140 }}
        >
          <option value="">All Status</option>
          <option value="final">Final</option>
          <option value="reversed">Reversed</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Date from"
          style={inputStyle}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Date to"
          style={inputStyle}
        />
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
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Lines</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total COGS</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Created By</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ padding: 48, textAlign: 'center' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      border: '2px solid var(--border)',
                      borderTopColor: 'var(--accent)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto',
                    }}
                  />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 48, textAlign: 'center' }}>
                  <PlayCircle
                    size={36}
                    style={{
                      color: 'var(--foreground-subtle)',
                      margin: '0 auto 10px',
                      display: 'block',
                    }}
                  />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                    No sellable settlements found.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item: any, idx: number) => {
                const statusMeta =
                  STATUS_META[String(item.status || '').toLowerCase()] ?? STATUS_META.final
                const lineCount = Array.isArray(item.lines) ? item.lines.length : null
                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                  >
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        color: 'var(--foreground-muted)',
                        fontSize: 13,
                        width: 50,
                      }}
                    >
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    <td style={tdStyle}>{formatDate(item.date)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontWeight: 500,
                          fontFamily: 'monospace',
                          fontSize: 12.5,
                          color: 'var(--accent)',
                        }}
                      >
                        {item.code}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                      {item.description || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {lineCount ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(item.total_cogs ?? 0)}
                    </td>
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
                    <td style={tdStyle}>{item.created_by?.name || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => router.push(`/inventory/sellable-settlements/${item.id}`)}
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
        <CustomPagination
          page={page}
          setPage={setPage}
          perPage={perPage}
          setPerPage={setPerPage}
          meta={meta}
        />
      </div>

      {/* Run settlement modal */}
      {runOpen && (
        <RunSettlementModal
          onClose={() => setRunOpen(false)}
          onDone={(id) => {
            setRunOpen(false)
            if (id) router.push(`/inventory/sellable-settlements/${id}`)
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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
