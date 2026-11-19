'use client'
import { formatDate } from '@/utils/date'
import React, { useState, useEffect, useMemo } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { stockOpnamesService } from '@/services/stock-opnames.service'
import { branchesService } from '@/services/branches.service'
import { BranchOptionGroups, withBranchDetails } from '@/lib/branchOptions'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Eye,
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
  const { hasPermission, isSuperadmin, user } = useAuth()
  const canCreate = hasPermission('stock-opname.create') || hasPermission('product-inventory.create')
  const canRead = hasPermission('stock-opname.read') || hasPermission('stock-opname.menu') || hasPermission('product-inventory.menu')

  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [branchFilter, setBranchFilter] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, dateFrom, dateTo, branchFilter])

  // Branch filter options: superadmin sees every branch, other users only
  // the branches they're assigned to (filter hidden for single-branch users).
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'with-company'],
    queryFn: () => branchesService.list({ per_page: 100, include: 'company' } as any).then((r) => r.data),
  })
  const availableBranches: any[] = isSuperadmin
    ? (branchesData as any)?.data ?? []
    : withBranchDetails((user as any)?.branches, (branchesData as any)?.data ?? [], (user as any)?.branch?.company)
  const showBranchFilter = !!isSuperadmin || availableBranches.length > 1

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['stock-opnames', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, branchFilter],
    queryFn: () =>
      stockOpnamesService
        .list({
          page,
          per_page: perPage,
          include: 'branch,created_by',
          sort: '-id',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
          'filter[branch_id]': branchFilter || undefined,
        } as any)
        .then((r) => r.data),
    enabled: canRead,
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  // Unwrap list body: { data: [], meta } or { success, data: { data: [], meta } }
  const listBody = useMemo(() => {
    const body = (data as any)?.data ?? (data as any)
    if (Array.isArray(body)) return { items: body, meta: (data as any)?.meta }
    if (body && Array.isArray(body.data)) return { items: body.data, meta: body.meta ?? (data as any)?.meta }
    if (body?.data && Array.isArray(body.data.data)) return { items: body.data.data, meta: body.data.meta }
    return { items: [], meta: undefined }
  }, [data])

  const items = listBody.items
  const meta = listBody.meta

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
      <FilterBar
        style={{ marginBottom: 0 }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code..."
        activeCount={countActive(statusFilter, branchFilter, dateFrom, dateTo)}
        onClear={() => {
          setStatusFilter('')
          setBranchFilter('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="counting">Counting</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </FilterSelect>
            {showBranchFilter && (
              <FilterSelect
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value)
                }}
              >
                <option value="">All Branches</option>
                <BranchOptionGroups branches={availableBranches} label={(b: any) => b.name} getValue={(b: any) => String(b.id)} />
              </FilterSelect>
            )}
          </>
        }
      >
        <FilterGroup title="Dates">
          <FilterField label="Opname date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => setDateFrom(v)}
              onToChange={(v) => setDateTo(v)}
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
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Document Code</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Branch</th>
              <th style={thStyle}>Created By</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
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
                <td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
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
                    <td style={{ ...tdStyle, maxWidth: 320 }}>
                      {item.description?.trim() ? (
                        <span
                          title={item.description}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--foreground-muted)',
                          }}
                        >
                          {item.description}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                      )}
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
