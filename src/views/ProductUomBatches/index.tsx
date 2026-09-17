'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productUomBatchesService } from '@/services/product-uom-batches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import api from '@/hooks/useApi'
import ProductUomBatchSheet from './ProductUomBatchSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react'

const INCLUDE =
  'product_uom,product_uom.product,product_uom.uom,created_by'
const PER_PAGE = 20

function formatDate(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getExpiryDisplay(v?: string | null): {
  text: string
  color: string
  sub?: string
} {
  if (!v) return { text: 'No expiry', color: 'var(--foreground-subtle)' }
  const d = new Date(v)
  if (isNaN(d.getTime()))
    return { text: 'No expiry', color: 'var(--foreground-subtle)' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(d)
  exp.setHours(0, 0, 0, 0)
  const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000)
  const formatted = formatDate(v)

  if (diffDays < 0) {
    const n = Math.abs(diffDays)
    return {
      text: `Expired ${n} day${n === 1 ? '' : 's'} ago`,
      color: 'var(--destructive)',
      sub: formatted,
    }
  }
  if (diffDays <= 14) {
    return {
      text: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      color: 'var(--warning)',
      sub: formatted,
    }
  }
  return { text: formatted, color: 'var(--foreground-muted)' }
}

export default function ProductUomBatchesView() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const activeProductTypes = useActiveBranchProductTypes()
  const allowedTypes = activeProductTypes
    ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
    : null

  const allTypeOptions = [
    { value: 'raw', label: 'Raw' },
    { value: 'wip', label: 'WIP' },
    { value: 'final', label: 'Final' },
    { value: 'supply', label: 'Supply' },
  ]

  const availableTypeOptions = allowedTypes
    ? allTypeOptions.filter(
        (o) =>
          allowedTypes.includes(o.value) ||
          (o.value === 'supply' && allowedTypes.includes('supplies')),
      )
    : allTypeOptions

  const canRead = hasPermission("product-uom-batch.read");
  const canCreate = hasPermission('product-uom-batch.create')
  const canEdit = hasPermission('product-uom-batch.update')
  const canDelete = hasPermission('product-uom-batch.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [productUomFilter, setProductUomFilter] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  const [typeFilter, setTypeFilter] = useState<string | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, productUomFilter, categoryFilter, typeFilter])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-uom-batches', page, perPage, debouncedSearch, productUomFilter, activeProductTypes],
    queryFn: () =>
      productUomBatchesService
        .list({
          page,
          per_page: PER_PAGE,
          sort: '-created_at',
          include: INCLUDE,
          'filter[search]': debouncedSearch || undefined,
          'filter[product_uom_id]': productUomFilter || undefined,
          'filter[product_category_id]': categoryFilter === '' ? undefined : String(categoryFilter),
          'filter[product_types]': typeFilter === '' ? (activeProductTypes || undefined) : String(typeFilter),
        } as any)
        .then((r) => r.data),
  })

  const rawItems: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const items = rawItems.filter((i) => isProductTypeAllowed(i.product_uom?.product, activeProductTypes))

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      api.get('/product-categories', { params: { per_page: perPage } }).then((r) => r.data),
  })
  const categories = (categoriesData as any)?.data ?? []

  // Product UOMs for the filter dropdown (paginate all pages)
  const { data: puData } = useQuery({
    queryKey: ['product-uoms-all', activeProductTypes],
    queryFn: async () => {
      let all: any[] = []
      let p = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ page: p, per_page: perPage, include: 'product,uom', 'filter[product_types]': activeProductTypes, 'filter[is_active]': true } as any)
          .then((r) => r.data)
        all = all.concat((res as any)?.data ?? [])
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        p += 1
      } while (p <= totalPages)
      return { data: all }
    },
  })
  const allProductUoms: any[] = (puData as any)?.data ?? []
  const productUoms = allProductUoms.filter((pu: any) => isProductTypeAllowed(pu.product, activeProductTypes))

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productUomBatchesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uom-batches'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Batch deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete batch'),
  })

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
            Product UOM Batches
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Track production batches and expiry dates
          </p>
        </div>

        {canCreate && (<button
          onClick={() => {
            setEditId(null)
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
          <Plus size={15} />New Batch
                              </button>)}
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
            placeholder="Search batches..."
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
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Product UOM filter */}
        <select
          value={productUomFilter}
          onChange={(e) => setProductUomFilter(Number(e.target.value))}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface-raised)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            maxWidth: 280,
          }}
        >
          <option value={0}>All Product UOMs</option>
          {productUoms.map((pu: any) => (
            <option key={pu.id} value={pu.id}>
              {(pu.product?.name ?? 'Product') +
                ' — ' +
                (pu.uom?.name ?? pu.uom?.code ?? 'UOM') +
                (pu.code ? ` (${pu.code})` : '')}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))
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
            maxWidth: 160,
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
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
            maxWidth: 160,
          }}
        >
          <option value="">All Types</option>
          {availableTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
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
                  { label: 'No.', width: 50 },
                  { label: 'Batch Code', width: 160 },
                  { label: 'Product', width: undefined },
                  { label: 'UOM', width: 110 },
                  { label: 'Expiry Date', width: 170 },
                  { label: 'Reference', width: 130 },
                  { label: 'Created', width: 180 },
                  { label: '', width: 90 },
                ] as const
              ).map(({ label, width }, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    textAlign: label === 'No.' ? 'center' : 'left',
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
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: '48px 16px' }}
                >
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
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load product UOM batches
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
                    <Layers
                      size={32}
                      style={{ color: 'var(--foreground-subtle)' }}
                    />
                    <span
                      style={{ fontSize: 13, color: 'var(--foreground-muted)' }}
                    >
                      No batches found
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item: any, idx: number) => {
                const productName =
                  item.product_uom?.product?.name ?? '—'
                const productCode = item.product_uom?.product?.code
                const uomName =
                  item.product_uom?.uom?.name ??
                  item.product_uom?.uom?.code ??
                  '—'
                const expiry = getExpiryDisplay(item.expiry_date)

                return (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background:
                        hoveredRow === item.id
                          ? 'var(--background)'
                          : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    {/* Batch Code */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          color: 'var(--foreground)',
                        }}
                      >
                        {item.batch_code ?? '—'}
                      </span>
                    </td>
                    {/* Product */}
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 14,
                            color: 'var(--foreground)',
                          }}
                        >
                          {productName}
                        </div>
                        {productCode && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            {productCode}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* UOM */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {uomName}
                      </span>
                    </td>
                    {/* Expiry Date */}
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: expiry.color,
                          }}
                        >
                          {expiry.text}
                        </span>
                        {expiry.sub && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--foreground-subtle)',
                            }}
                          >
                            {expiry.sub}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Reference */}
                    <td style={{ padding: '12px 16px' }}>
                      {canRead ? item.reference_type ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 500,
                            background: 'var(--info-bg)',
                            color: 'var(--info)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {String(item.reference_type).replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 13,
                            color: 'var(--foreground-subtle)',
                          }}
                        >
                          —
                        </span>
                      ) : "***"}
                    </td>
                    {/* Created */}
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--foreground)',
                          }}
                        >
                          {formatDate(item.created_at)}
                        </div>
                        {item.created_by?.name && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            {item.created_by.name}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'flex-end',
                        }}
                      >
                        {canEdit && (<button
                          onClick={() => {
                            setEditId(item.id)
                            setSheetOpen(true)
                          }}
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
                          onClick={() => setDeleteTarget(item)}
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
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm dialog */}
      {deleteTarget !== null && (
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
            onClick={() => setDeleteTarget(null)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 380,
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
              Delete Batch
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
                lineHeight: 1.5,
              }}
            >
              Delete batch{' '}
              <strong style={{ color: 'var(--foreground)' }}>
                {deleteTarget.batch_code ?? `#${deleteTarget.id}`}
              </strong>
              ? This will fail if the batch has inventory or stock movements.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
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
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '8px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: deleteMutation.isPending
                    ? 'not-allowed'
                    : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
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
      <ProductUomBatchSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditId(null)
        }}
        batchId={editId}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
