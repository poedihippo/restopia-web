'use client'
import { formatDate, formatDateShort } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { productionsService } from '@/services/productions.service'
import { toastMutationApiError } from '@/utils/apiError'
import { withProductType } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import SearchableSelect from '@/components/SearchableSelect'
import { productsService } from '@/services/products.service'
import { CustomPagination } from '@/components/ui/CustomPagination'
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

export default function ProductionsView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("production.read");
  const canCreate = hasPermission('production.create')
  const canEdit = hasPermission('production.update')
  const canDelete = hasPermission('production.delete')
  const activeProductTypes = useActiveBranchProductTypes()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [productFilter, setProductFilter] = useState<number | ''>('')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setDebouncedProductSearch(productSearch)
    }, 400)
    return () => clearTimeout(t)
  }, [search, productSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, productFilter])

  const { data: productsData } = useQuery({
    queryKey: ['products-finished', debouncedProductSearch, activeProductTypes],
    queryFn: () => productsService.list({ per_page: 1000, 'filter[types]': 'final', 'filter[search]': debouncedProductSearch || undefined, 'filter[is_active]': true } as any).then((r) => r.data),
  })
  
  const productOptions = (productsData as any)?.data?.map((p: any) => ({
    value: p.id,
    label: withProductType(p.name, p.type),
  })) ?? []

  const { data, isLoading, isError } = useQuery({
    queryKey: ['productions', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, productFilter],
    queryFn: () =>
      productionsService
        .list({
          page,
          per_page: perPage,
          include: 'branch,production_details',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[start_date]': dateFrom || undefined,
          'filter[end_date]': dateTo || undefined,
          'filter[product_id]': productFilter || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: Production[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['productions'],
      })
      toast.success('Production deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const anyFilter = statusFilter || dateFrom || dateTo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* PAGE HEADER */}
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
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Manage factory production orders
          </p>
        </div>
        {canCreate && (<button
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
          }}>
          <Plus size={15} />New Production
                              </button>)}
      </div>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              width: '100%',
              padding: '8px 10px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface-raised)',
              outline: 'none',
            fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div style={{ width: 220 }}>
          <SearchableSelect
            value={productFilter}
            onChange={(val) => {
              setProductFilter(val)
              setPage(1)
            }}
            onSearchChange={(val) => setProductSearch(val)}
            options={[{ value: '', label: 'All Finished Products' }, ...productOptions]}
            placeholder="Filter by Product"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface-raised)',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Final</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            style={{
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--foreground)',
              background: 'var(--surface-raised)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            style={{
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--foreground)',
              background: 'var(--surface-raised)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {anyFilter && (
          <button
            onClick={() => {
              setStatusFilter('')
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
      {/* TABLE */}
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
              {['No.', 'Code', 'Branch', 'Date', 'Status', 'Items', 'Created', ''].map((h, i) => (
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
                    width: i === 0 ? 50 : i === 1 ? 160
                        : i === 1
                          ? 160
                          : i === 2
                            ? 130
                            : i === 3
                              ? 110
                              : i === 4
                                ? 80
                                : i === 5
                                  ? 140
                                  : 100,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} style={{ padding: '48px 16px', textAlign: 'center' }}>
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
                  colSpan={8}
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load productions
                </td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={8}>
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
            {items.map((item, idx) => {
              const sm = STATUS_META[item.status] ?? STATUS_META.pending
              return (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
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
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.branch?.name ?? '—' : "***"}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.date
                      ? item.date
                      : item.date : "***"}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: sm.bg,
                        color: sm.color,
                      }}
                    >
                      {sm.label}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      textAlign: 'center',
                    }}
                  >
                    {canRead ? item.production_details?.length ?? 0 : "***"}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.created_at ? item.created_at : item.created_at : "***"}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => router.push(`/production/${item.id}/detail`)}
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
                      {canEdit && (<button
                        onClick={() => router.push(`/production/${item.id}/edit`)}
                        style={{
                          padding: 6,
                          background: 'none',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--foreground-muted)',
                          display: 'flex',
                        }}>
                        <Pencil size={14} />
                      </button>)}
                      {canDelete && (<button
                        onClick={() => setDeleteConfirmId(item.id)}
                        style={{
                          padding: 6,
                          background: 'none',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--destructive)',
                          display: 'flex',
                        }}>
                        <Trash2 size={14} />
                      </button>)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* PAGINATION */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* DELETE CONFIRM */}
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
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
            }}
            onClick={() => setDeleteConfirmId(null)}
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
              style={{
                fontSize: 15,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Delete Production
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
              }}
            >
              This will permanently remove the production order and all its details.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
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
    </div>
  );
}
