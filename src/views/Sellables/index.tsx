'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { sellablesService } from '@/services/sellables.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { formatDate } from '@/utils/date'
import type { PaginatedMeta, Sellable } from '@/types/api'
import { Search, Eye, PackageOpen } from 'lucide-react'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'var(--success)', bg: 'var(--success-bg)' },
  closed: { label: 'Closed', color: 'var(--info)', bg: 'var(--info-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const fmtQty = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 6 })

/** True when the date string (YYYY-MM-DD) is before today's date. */
function isExpiredDate(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().slice(0, 10)
  return String(dateStr).slice(0, 10) < today
}

/** "Loaf (LAF)" from product_uom.product + uom code; falls back gracefully. */
function sellableLabel(item?: Sellable): string {
  const pu = item?.product_uom
  const product = pu?.product
  const name = product?.name ?? pu?.name ?? 'Unknown product'
  const uom = pu?.uom?.code ?? pu?.code
  return uom ? `${name} (${uom})` : String(name)
}

export default function SellablesView() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canRead =
    hasPermission('sellable.read') ||
    hasPermission('sellable.menu') ||
    hasPermission('product-inventory.menu') ||
    hasPermission('product-inventory.read')

  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [statusFilter, setStatusFilter] = useState(
    typeof router.query.status === 'string' ? router.query.status : '',
  )
  const [expiryTo, setExpiryTo] = useState('')
  const [minRemaining, setMinRemaining] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  // Reset page when a filter changes (done in handlers, not an effect).
  const changeFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      'sellables',
      page,
      perPage,
      debouncedSearch,
      statusFilter,
      expiryTo,
      minRemaining,
    ],
    queryFn: () =>
      sellablesService
        .list({
          page,
          per_page: perPage,
          include: 'product_uom,product_uom.product,product_uom.uom,product_inventory,usages',
          sort: '-id',
          'filter[status]': statusFilter || undefined,
          'filter[expiry_date_lte]': expiryTo || undefined,
          'filter[remaining_gte]': minRemaining || undefined,
        })
        .then((r) => r.data),
    enabled: canRead,
  })

  // Unwrap list body: { data: [], meta } or { success, data: { data: [], meta } }
  const listBody = useMemo(() => {
    const root = (data ?? {}) as Record<string, unknown>
    const body = root.data ?? root
    if (Array.isArray(body)) {
      return { items: body as Sellable[], meta: root.meta as PaginatedMeta | undefined }
    }
    const nested = body as { data?: unknown; meta?: PaginatedMeta } | null | undefined
    if (nested && Array.isArray(nested.data)) {
      return {
        items: nested.data as Sellable[],
        meta: nested.meta ?? (root.meta as PaginatedMeta | undefined),
      }
    }
    const deeper = nested?.data as { data?: Sellable[]; meta?: PaginatedMeta } | null | undefined
    if (deeper && Array.isArray(deeper.data)) {
      return { items: deeper.data, meta: deeper.meta }
    }
    return { items: [] as Sellable[], meta: undefined }
  }, [data])

  const allItems: Sellable[] = listBody.items
  // The API has no free-text search param on /sellables; filter batch code client-side.
  const items = debouncedSearch
    ? allItems.filter((i) =>
        String(i.batch_code ?? '')
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase()),
      )
    : allItems
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
            Sellables
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Portioned lots with trackable remaining stock and expiry
          </p>
        </div>
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
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
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
            placeholder="Search batch code..."
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

        <select
          value={statusFilter}
          onChange={(e) => changeFilter(setStatusFilter)(e.target.value)}
          style={{ ...inputStyle, minWidth: 140 }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          value={expiryTo}
          onChange={(e) => changeFilter(setExpiryTo)(e.target.value)}
          title="Expiry up to"
          style={inputStyle}
        />

        <input
          type="number"
          min={0}
          placeholder="Min remaining"
          value={minRemaining}
          onChange={(e) => changeFilter(setMinRemaining)(e.target.value)}
          style={{ ...inputStyle, minWidth: 130 }}
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
              <th style={thStyle}>Batch Code</th>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Inventory</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Remaining</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Written Off</th>
              <th style={thStyle}>Expiry</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} style={{ padding: 48, textAlign: 'center' }}>
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
                <td colSpan={10} style={{ padding: 48, textAlign: 'center' }}>
                  <PackageOpen
                    size={36}
                    style={{
                      color: 'var(--foreground-subtle)',
                      margin: '0 auto 10px',
                      display: 'block',
                    }}
                  />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                    No sellable lots found.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item: Sellable, idx: number) => {
                const statusMeta =
                  STATUS_META[String(item.status || '').toLowerCase()] ?? STATUS_META.active
                const remaining = Number(item.remaining_qty ?? 0)
                const qty = Number(item.qty ?? 0)
                const isExpired = isExpiredDate(item.expiry_date)
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
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontWeight: 500,
                          fontFamily: 'monospace',
                          fontSize: 12.5,
                          color: 'var(--accent)',
                        }}
                      >
                        {item.batch_code || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{sellableLabel(item)}</div>
                      {item.portioning_id && (
                        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                          Portioning #{item.portioning_id}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)', fontSize: 12.5 }}>
                      {item.product_inventory
                        ? `#${item.product_inventory.id}${
                            item.product_inventory.location_ref
                              ? ` · ${item.product_inventory.location_ref}`
                              : ''
                          }`
                        : item.product_inventory_id
                          ? `#${item.product_inventory_id}`
                          : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtQty(qty)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        fontWeight: 600,
                        color: remaining > 0 ? 'var(--success)' : 'var(--foreground-muted)',
                      }}
                    >
                      {fmtQty(remaining)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--foreground-muted)' }}>
                      {fmtQty(item.written_off_qty ?? 0)}
                    </td>
                    <td style={{ ...tdStyle, color: isExpired ? 'var(--destructive)' : undefined }}>
                      {item.expiry_date ? formatDate(item.expiry_date) : '—'}
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
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => router.push(`/inventory/sellables/${item.id}`)}
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
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 13,
  color: 'var(--foreground)',
  verticalAlign: 'middle',
}
