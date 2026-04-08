'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockMovementsService } from '@/services/stock-movements.service'
import StockMovementSheet from './StockMovementSheet'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react'

interface StockMovement {
  id: number
  qty: number
  direction: 'in' | 'out'
  product_inventory_id?: number
  branch_id?: number
  description?: string
  created_at?: string
}

const TYPE_META = {
  in: {
    label: 'Stock In',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    icon: TrendingUp,
  },
  out: {
    label: 'Stock Out',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
    icon: TrendingDown,
  },
}

export default function StockMovementView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [directionFilter, setDirectionFilter] = useState<'' | 'in' | 'out'>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, directionFilter])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-movements', page, debouncedSearch, directionFilter],
    queryFn: () =>
      stockMovementsService
        .list({
          page,
          per_page: 20,
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[direction]': directionFilter || undefined,
        })
        .then((r) => r.data),
  })

  const items: StockMovement[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

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
            Stock Movements
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            History of all manual stock adjustments
          </p>
        </div>

        <button
          onClick={() => setSheetOpen(true)}
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
          Record Movement
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
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
            placeholder="Search movements..."
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Direction filter */}
        <select
          value={directionFilter}
          onChange={(e) => {
            setDirectionFilter(e.target.value as '' | 'in' | 'out')
            setPage(1)
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <option value="">All Directions</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
        </select>
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
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              {(
                [
                  { label: 'Type', width: 140 },
                  { label: 'Product', width: undefined },
                  { label: 'Branch', width: 160 },
                  { label: 'Qty', width: 100 },
                  { label: 'Notes', width: 200 },
                  { label: 'Date', width: 160 },
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
                    letterSpacing: 0.6,
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
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {[60, 40, 80, 50, 70].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 16,
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
                  colSpan={6}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load stock movements
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <ArrowUpDown size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No stock movements recorded
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item: any) => {
                const typeMeta =
                  TYPE_META[item.direction as keyof typeof TYPE_META] ??
                  TYPE_META['in']
                const Icon = typeMeta.icon

                return (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background:
                        hoveredRow === item.id ? 'var(--background)' : 'transparent',
                    }}
                  >
                    {/* Type */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: typeMeta.bg,
                          color: typeMeta.color,
                        }}
                      >
                        <Icon size={11} />
                        {typeMeta.label}
                      </span>
                    </td>

                    {/* Product */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--foreground)',
                          }}
                        >
                          {item.product_inventory_id ?? '—'}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: 'var(--foreground-muted)',
                          }}
                        >
                          —
                        </span>
                      </div>
                    </td>

                    {/* Branch */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {item.branch_id ?? '—'}
                    </td>

                    {/* Qty */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: item.direction === 'out'
                            ? 'var(--destructive)' : 'var(--success)',
                        }}
                      >
                        {item.direction === 'out' ? '−' : '+'}
                        {(item.qty ?? 0).toLocaleString('id-ID')}
                      </span>
                    </td>

                    {/* Notes */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'var(--foreground-muted)',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.description ?? '—'}
                    </td>

                    {/* Date */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && (meta.last_page ?? meta.total_pages ?? 1) > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of{' '}
            {meta.total}
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
              {page} / {meta.last_page ?? meta.total_pages ?? 1}
            </span>

            <button
              disabled={page === (meta.last_page ?? meta.total_pages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                cursor: page === (meta.last_page ?? meta.total_pages ?? 1) ? 'not-allowed' : 'pointer',
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: page === (meta.last_page ?? meta.total_pages ?? 1) ? 0.5 : 1,
              }}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Sheet */}
      <StockMovementSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
