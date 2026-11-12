'use client'
import { formatCurrency } from '@/utils/price';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { bundlesService } from '@/services/bundles.service'
import { useAuth } from '@/hooks/useAuth'
import BundleSheet from './BundleSheet'
import { toastMutationApiError } from '@/utils/apiError';
import { CustomPagination } from '@/components/ui/CustomPagination'
import { ActiveSegment, FilterBar, countActive } from '@/components/ListFilters'
import { getProductUomName } from '@/utils/productUomName'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface BundleItem {
  id: number
  product_uom_id: number
  qty: number
  product_uom?: {
    id: number
    code?: string
    product?: { name: string }
    uom?: { name: string; code: string }
  }
}

interface BundleDetail {
  id: number
  sort_order?: number
  items?: BundleItem[]
  product_uom_id?: number
  qty?: number
  product_uom?: BundleItem['product_uom']
}

interface Bundle {
  id: number
  code: string
  name: string
  price: number
  status: 'active' | 'inactive'
  description?: string
  created_at?: string
  bundle_details?: BundleDetail[]
}

function flattenBundleItems(details?: BundleDetail[]): BundleItem[] {
  if (!details?.length) return []
  return details.flatMap((d) => {
    if (d.items?.length) return d.items
    if (d.product_uom_id != null) {
      return [{ id: d.id, product_uom_id: d.product_uom_id, qty: d.qty ?? 0, product_uom: d.product_uom }]
    }
    return []
  })
}

const STATUS_META: Record<
  'active' | 'inactive',
  { label: string; color: string; bg: string }
> = {
  active: { label: 'Active', color: 'var(--success)', bg: 'var(--success-bg)' },
  inactive: {
    label: 'Inactive',
    color: 'var(--foreground-muted)',
    bg: 'var(--background)',
  },
}

export default function BundlesView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("bundle.read");
  const canCreate = hasPermission('bundle.create')
  const canEdit = hasPermission('bundle.update')
  const canDelete = hasPermission('bundle.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('active')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Bundle | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['bundles', page, perPage, debouncedSearch, statusFilter],
    queryFn: () =>
      bundlesService
        .list({
          page,
          per_page: perPage,
          include: 'bundle_details',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Bundle[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bundlesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Bundle deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete bundle'),
  })

  const actionBtnStyle: React.CSSProperties = {
    padding: 6,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    display: 'flex',
  }

  const badge = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color,
  })

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
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
            Bundles
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage product bundles and packages
          </p>
        </div>
        {canCreate && (<button
          onClick={() => {
            setEditData(null)
            setSheetOpen(true)
          }}
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
          <Plus size={15} />New Bundle
                              </button>)}
      </div>
      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bundles..."
        activeCount={countActive(statusFilter !== 'active')}
        onClear={() => {
          setStatusFilter('active')
          setPage(1)
        }}
        quick={
          <ActiveSegment
            value={statusFilter}
            onChange={setStatusFilter}
            active="active"
            inactive="inactive"
            label="Bundle status"
          />
        }
      />
      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 80,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))
        ) : isError ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
              Failed to load bundles.
            </span>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: '64px 16px',
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              color: 'var(--foreground-muted)',
            }}
          >
            <Tag size={32} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>No bundles found</span>
          </div>
        ) : (
          items.map((item) => {
            const isExpanded = expandedId === item.id
            const statusMeta = STATUS_META[item.status] ?? STATUS_META.inactive
            const details = flattenBundleItems(item.bundle_details)
            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Card header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {item.code}
                      </span>
                      <span style={badge(statusMeta.bg, statusMeta.color)}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        marginTop: 4,
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {formatCurrency((item.price ?? 0))}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        {details.length} item(s)
                      </span>
                    </div>
                  </div>

                  <div
                    style={{ display: 'flex', gap: 4 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEdit && (<button
                      onClick={() => {
                        setEditData(item)
                        setSheetOpen(true)
                      }}
                      style={actionBtnStyle}
                      title="Edit">
                      <Pencil size={14} />
                    </button>)}
                    {canDelete && (<button
                      onClick={() => setDeleteConfirmId(item.id)}
                      style={{ ...actionBtnStyle, color: 'var(--destructive)' }}
                      title="Delete">
                      <Trash2 size={14} />
                    </button>)}
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={15} color="var(--foreground-muted)" />
                  ) : (
                    <ChevronDown size={15} color="var(--foreground-muted)" />
                  )}
                </div>
                {/* Expanded details */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      padding: '12px 20px',
                      background: 'var(--background)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--foreground-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        display: 'block',
                        marginBottom: 8,
                      }}
                    >
                      Items in this bundle
                    </span>

                    {details.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {details.map((detail, idx) => (
                          <div
                            key={detail.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '6px 10px',
                              background: 'var(--surface)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <span
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 99,
                                background: 'var(--accent-light-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--accent)',
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--foreground)',
                              }}
                            >
                              {getProductUomName(detail.product_uom, detail.product_uom?.product?.name) || '—'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: 'var(--foreground-muted)',
                                padding: '1px 6px',
                                background: 'var(--background)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {detail.product_uom?.uom?.code ?? ''}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--foreground)',
                                minWidth: 60,
                                textAlign: 'right',
                              }}
                            >
                              {(detail.qty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
                        No items defined
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm */}
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
              width: 380,
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
              Delete Bundle
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently remove the bundle.
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
      {/* Sheet */}
      <BundleSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditData(null)
        }}
        editData={editData}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
