'use client'
import { formatDateShort, formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsService } from '@/services/products.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { uomsService } from '@/services/uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import ProductSheet from './ProductSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { ActiveSegment, FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
} from 'lucide-react'

interface Product {
  id: number
  name: string
  code?: string
  type?: 'raw' | 'wip' | 'final' | 'supply'
  is_active: boolean
  product_category_id: number
  description?: string
  reorder_point?: number | null
  created_at?: string
  product_category?: { id: number; name: string }
}

export default function ProductView() {
  const queryClient = useQueryClient()
  const router = useRouter()
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

  const canRead = hasPermission("product.read");
  const canCreate = hasPermission('product.create')
  const canEdit = hasPermission('product.update')
  const canDelete = hasPermission('product.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  // Active products by default; '' = all.
  const [activeFilter, setActiveFilter] = useState<'true' | 'false' | ''>('true')
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'code'>('id')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Product | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<Product | null>(null)

  const sortParam = sortOrder === 'desc' ? `-${sortBy}` : sortBy

  const handleSort = (field: 'id' | 'name' | 'code') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'id' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  // Deep link: /products?view=<id> opens that product's detail panel (used by the dashboard).
  const viewParam = router.query.view
  useEffect(() => {
    const id = Number(Array.isArray(viewParam) ? viewParam[0] : viewParam)
    if (id > 0) setSelectedItem({ id, name: '', is_active: true, product_category_id: 0 })
  }, [viewParam])

  const closeDetail = () => {
    setSelectedItem(null)
    if (router.query.view) {
      const { view: _view, ...rest } = router.query
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, categoryFilter, activeFilter])

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService
        .list({ per_page: 1000 })
        .then((r) => r.data),
  })
  const categories = (categoriesData as any)?.data ?? []

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['products', page, perPage, debouncedSearch, typeFilter, categoryFilter, activeFilter, activeProductTypes, sortParam],
    queryFn: () =>
      productsService
        .list({
          page,
          per_page: perPage,
          sort: sortParam,
          include: 'product_category,base_uom',
          'filter[search]': debouncedSearch || undefined,
          'filter[types]': typeFilter === '' ? undefined : String(typeFilter),
          'filter[product_category_id]': categoryFilter === '' ? undefined : String(categoryFilter),
          'filter[is_active]': activeFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const rawItems: Product[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const items = rawItems.filter((item) => isProductTypeAllowed(item, activeProductTypes))

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const typePillStyle = (type?: string): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }
    if (type === 'raw') return { ...base, background: 'var(--pastel-blue, var(--info-bg))', color: 'var(--pastel-blue-ink, var(--info))' }
    if (type === 'wip') return { ...base, background: 'var(--pastel-gold, var(--warning-bg))', color: 'var(--pastel-gold-ink, var(--warning))' }
    if (type === 'final') return { ...base, background: 'var(--pastel-mint, var(--success-bg))', color: 'var(--pastel-mint-ink, var(--success))' }
    if (type === 'supply') return { ...base, background: 'var(--pastel-lavender, var(--accent-light-bg))', color: 'var(--pastel-lavender-ink, var(--accent))' }
    return { ...base, background: 'var(--border)', color: 'var(--foreground-muted)' }
  }

  const codePill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    background: 'var(--accent-light-bg)',
    color: 'var(--accent)',
    border: '1px solid rgba(198, 139, 78, 0.18)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  }

  const columns: { label: string; width?: number; sortKey?: 'id' | 'name' | 'code'; align?: 'center' | 'right' }[] = [
    { label: 'No.', width: 56, sortKey: 'id', align: 'center' },
    { label: 'Name', sortKey: 'name' },
    { label: 'Code', width: 130, sortKey: 'code' },
    { label: 'Category', width: 170 },
    { label: 'Type', width: 96 },
    { label: 'Created', width: 120 },
    { label: '', width: 104 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
            Products
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>
            Manage your product catalogue
            {meta?.total != null && (
              <span style={{ color: 'var(--foreground-subtle)' }}> · {Number(meta.total).toLocaleString('id-ID')} items</span>
            )}
          </p>
        </div>

        {canCreate && (
          <button className="v2-btn v2-btn-primary" onClick={() => { setEditData(null); setSheetOpen(true) }}>
            <Plus size={14} />New Product
          </button>
        )}
      </div>

      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products..."
        activeCount={countActive(activeFilter !== 'true', typeFilter, categoryFilter)}
        onClear={() => {
          setActiveFilter('true')
          setTypeFilter('')
          setCategoryFilter('')
          setPage(1)
        }}
        quick={
          <>
            <ActiveSegment value={activeFilter} onChange={setActiveFilter} label="Product status" />
            <FilterSelect
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Types</option>
              {availableTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))
                setPage(1)
              }}
              style={{ maxWidth: 200 }}
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      />

      {/* Table card */}
      <div className="v2-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="v2-table">
            <thead>
              <tr>
                {columns.map((col, i) => {
                  const isSortable = !!col.sortKey
                  const isActive = sortBy === col.sortKey
                  return (
                    <th
                      key={i}
                      onClick={isSortable ? () => handleSort(col.sortKey!) : undefined}
                      style={{
                        textAlign: col.align ?? 'left',
                        width: col.width,
                        color: isActive ? 'var(--foreground)' : undefined,
                        cursor: isSortable ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span>{col.label}</span>
                        {isSortable && (
                          isActive ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp size={12} style={{ color: 'var(--accent-light)' }} />
                            ) : (
                              <ArrowDown size={12} style={{ color: 'var(--accent-light)' }} />
                            )
                          ) : (
                            <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                          )
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, r) => (
                  <tr key={`sk-${r}`}>
                    {columns.map((col, c) => (
                      <td key={c}>
                        {col.label && <div className="v2-skeleton" style={{ height: 10, width: c === 1 ? `${70 - (r % 3) * 15}%` : '60%' }} />}
                      </td>
                    ))}
                  </tr>
                ))}

              {isError && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', height: 96, color: 'var(--destructive)' }}>
                    Failed to load products
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--pastel-lavender)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} style={{ color: 'var(--pastel-lavender-ink)' }} />
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>No products found</span>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: -6 }}>Try a different search or filter</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                items.map((item, idx) => (
                  <tr
                    key={item.id}
                    data-row
                    style={{
                      // Inactive products: tinted row + red edge so they're not mistaken for sellable ones.
                      background: !item.is_active ? 'var(--destructive-bg)' : undefined,
                      boxShadow: !item.is_active ? 'inset 3px 0 0 var(--destructive)' : undefined,
                    }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--foreground-subtle)', fontSize: 12 }}>
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    <td style={{ fontWeight: 500, color: item.is_active ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {canRead ? item.name : "***"}
                        {!item.is_active && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              padding: '1px 7px',
                              borderRadius: 999,
                              background: 'var(--surface)',
                              border: '1px solid var(--destructive)',
                              color: 'var(--destructive)',
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                            }}
                          >
                            Inactive
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      {canRead ? item.code ? (
                        <span style={codePill}>{item.code}</span>
                      ) : (
                        <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                      ) : "***"}
                    </td>
                    <td style={{ color: 'var(--foreground-muted)' }}>
                      {canRead ? item.product_category?.name ?? '—' : "***"}
                    </td>
                    <td>
                      <span style={typePillStyle(item.type)}>
                        {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                      {canRead ? item.created_at
                        ? formatDateShort(item.created_at)
                        : '—' : "***"}
                    </td>
                    <td>
                      <div className="v2-row-actions" style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                        <button className="v2-icon-btn" title="View" onClick={() => setSelectedItem(item)}>
                          <Eye size={14} />
                        </button>
                        {canEdit && (
                          <button className="v2-icon-btn" title="Edit" onClick={() => { setEditData(item); setSheetOpen(true) }}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button className="v2-icon-btn" data-tone="danger" title="Delete" onClick={() => setDeleteConfirmId(item.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm */}
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
            className="v2-overlay"
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
          />
          <div
            className="v2-dialog"
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 20,
              width: 360,
              maxWidth: 'calc(100vw - 32px)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--destructive-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Trash2 size={16} style={{ color: 'var(--destructive)' }} />
            </span>
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 6px', color: 'var(--foreground)' }}>
              Delete Product
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '0 0 18px' }}>
              This will permanently remove the product and may affect related records.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="v2-btn v2-btn-ghost" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button
                className="v2-btn v2-btn-danger"
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Detail panel */}
      {selectedItem && (
        <ProductDetailPanel
          item={selectedItem}
          onClose={closeDetail}
          typePillStyle={typePillStyle}
          onEdit={(item) => { setEditData(item); closeDetail(); setSheetOpen(true) }}
          canEdit={canEdit}
        />
      )}
      {/* Sheet */}
      <ProductSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditData(null) }}
        editData={editData}
      />
    </div>
  );
}

// ── Product Detail Panel ──────────────────────────────────────────────────────

interface ProductDetailPanelProps {
  item: Product
  onClose: () => void
  typePillStyle: (type?: string) => React.CSSProperties
  onEdit: (item: Product) => void
  canEdit: boolean
}

function ProductDetailPanel({ item, onClose, typePillStyle, onEdit, canEdit }: ProductDetailPanelProps) {
  const { data: detailData, isLoading } = useQuery({
    queryKey: ['product-detail', item.id],
    queryFn: () => productsService.findById(item.id, { include: 'product_category,product_uoms,product_uoms.uom,product_uoms.conversions' } as any).then((r) => r.data),
    enabled: !!item.id,
  })
  const detail = (detailData as any)?.data

  const { data: uomsData } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: () => uomsService.list({ per_page: 1000 } as any).then((r) => r.data),
  })
  const allUoms: { id: number; name: string; code: string }[] = (uomsData as any)?.data ?? []
  const uomNameById = (id: number) => allUoms.find((u) => u.id === id)

  const productUoms = detail?.product_uoms ?? []
  const baseUomId = detail?.base_uom_id

  const sectionHeader: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--foreground-subtle)',
  }

  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--foreground)',
  }

  const codePill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    background: 'var(--accent-light-bg)',
    color: 'var(--accent)',
    border: '1px solid rgba(198, 139, 78, 0.18)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="v2-overlay"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />
      <div
        className="v2-sheet"
        style={{
          position: 'relative',
          zIndex: 50,
          width: 520,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Product Detail
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canEdit && (
              <button
                onClick={() => onEdit(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  background: 'var(--accent-light-bg)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Pencil size={12} /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={18} color="var(--foreground-muted)" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 48 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--foreground-muted)' }} />
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading...</span>
            </div>
          ) : (
            <>
              {/* ── General Info ─────────────────────── */}
              <div
                style={{
                  background: 'var(--surface-muted, var(--background))',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <span style={sectionHeader}>Informasi Umum</span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Name</span>
                    <span style={{ ...valueStyle, fontWeight: 500 }}>{detail?.name ?? item.name ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Code</span>
                    {detail?.code ? (
                      <span style={codePill}>{detail.code}</span>
                    ) : (
                      <span style={valueStyle}>—</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Category</span>
                    <span style={valueStyle}>{detail?.product_category?.name ?? item.product_category?.name ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Type</span>
                    <span style={typePillStyle(detail?.type ?? item.type)}>
                      {(detail?.type ?? item.type)
                        ? (detail?.type ?? item.type)!.charAt(0).toUpperCase() + (detail?.type ?? item.type)!.slice(1)
                        : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Base Unit</span>
                    <span style={valueStyle}>
                      {baseUomId
                        ? (() => { const u = uomNameById(baseUomId); return u ? `${u.name} (${u.code})` : `UOM #${baseUomId}` })()
                        : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Reorder Point</span>
                    <span style={valueStyle}>{detail?.reorder_point ?? '—'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={labelStyle}>Active</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 500,
                      width: 'fit-content',
                      background: (detail?.is_active ?? item.is_active) ? 'var(--success-bg)' : 'var(--destructive-bg)',
                      color: (detail?.is_active ?? item.is_active) ? 'var(--success)' : 'var(--destructive)',
                    }}
                  >
                    {(detail?.is_active ?? item.is_active) ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {(detail?.description ?? item.description) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Description</span>
                    <span style={{ ...valueStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {detail?.description ?? item.description}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Units & Prices ─────────────────────── */}
              <div
                style={{
                  background: 'var(--surface-muted, var(--background))',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={sectionHeader}>Units &amp; Prices</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--foreground-muted)',
                      background: 'var(--surface)',
                      padding: '2px 8px',
                      borderRadius: 99,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {productUoms.length} unit{productUoms.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {productUoms.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--foreground-subtle)' }}>
                    No units configured
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {productUoms.map((pu: any, i: number) => {
                      const uomInfo = pu.uom_id ? uomNameById(pu.uom_id) : null
                      const isBase = pu.uom_id === baseUomId
                      return (
                        <div
                          key={pu.id ?? i}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            background: 'var(--surface)',
                          }}
                        >
                          {/* UOM header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                                {pu.name ?? uomInfo?.name ?? `UOM #${pu.uom_id}`}
                              </span>
                              {(pu.uom_code ?? uomInfo?.code) && (
                                <span style={codePill}>{pu.uom_code ?? uomInfo?.code}</span>
                              )}
                              {pu.is_default && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: 'var(--success)',
                                  background: 'var(--success-bg)',
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                }}>
                                  Default
                                </span>
                              )}
                              {isBase && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: 'var(--accent)',
                                  background: 'var(--accent-light-bg)',
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                }}>
                                  Base
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {!pu.is_active && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: 'var(--destructive)',
                                  background: 'var(--destructive-bg)',
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                }}>
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>

                          {/* SKU */}
                          {pu.code && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={labelStyle}>SKU:</span>
                              <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--foreground)' }}>{pu.code}</span>
                            </div>
                          )}

                          {/* Prices */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            {[
                              { label: 'Base Price', value: pu.base_price },
                              { label: 'Online Price', value: pu.online_price },
                              { label: 'Franchise Price', value: pu.franchise_price },
                            ].map((p) => (
                              <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 10, color: 'var(--foreground-subtle)' }}>{p.label}</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                                  {p.value != null && p.value > 0
                                    ? `Rp ${(p.value).toLocaleString('id-ID')}`
                                    : '—'}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Flags */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {pu.price_editable && (
                              <span style={{ fontSize: 11, color: 'var(--info)', background: 'var(--info-bg)', padding: '2px 8px', borderRadius: 99 }}>
                                Price Editable
                              </span>
                            )}
                          </div>

                          {/* Conversions */}
                          {pu.conversions && pu.conversions.length > 0 && (
                            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Conversions
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                                {pu.conversions.map((c: any, ci: number) => {
                                  const targetUom = c.target_uom_id ? uomNameById(c.target_uom_id) : null
                                  return (
                                    <div
                                      key={ci}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 12,
                                        color: 'var(--foreground-muted)',
                                      }}
                                    >
                                      <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                                        1 {pu.uom_code ?? uomInfo?.code ?? '?'}
                                      </span>
                                      <span>=</span>
                                      <span style={{ fontWeight: 500, color: 'var(--accent)' }}>
                                        {c.amount?.toLocaleString('id-ID', { maximumFractionDigits: 2 }) ?? '?'}
                                      </span>
                                      <span>{c.target_uom_code ?? targetUom?.code ?? `UOM #${c.target_uom_id}`}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Audit Info ─────────────────────── */}
              <div
                style={{
                  background: 'var(--surface-muted, var(--background))',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <span style={sectionHeader}>Audit</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Created At</span>
                    <span style={{ ...valueStyle, fontSize: 13 }}>
                      {detail?.created_at ? formatDateTime(detail.created_at) : '—'}
                    </span>
                    {detail?.created_by && (
                      <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                        by {detail.created_by.name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Updated At</span>
                    <span style={{ ...valueStyle, fontSize: 13 }}>
                      {detail?.updated_at ? formatDateTime(detail.updated_at) : '—'}
                    </span>
                    {detail?.updated_by && (
                      <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                        by {detail.updated_by.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
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
