'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort, formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/hooks/useApi'
import { productUomsService } from '@/services/product-uoms.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import ProductUomSheet from './ProductUomSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Tag,
  Eye,
  X,
} from 'lucide-react'

interface ProductUom {
  id: number
  code?: string
  base_price?: number
  online_price?: number
  franchise_price?: number
  price_editable?: boolean
  is_default?: boolean
  created_at?: string
  product_id: number
  uom_id: number
  product?: { id: number; name: string; code?: string; type?: string; product_category?: { name?: string } }
  uom?: { id: number; name: string; code: string }
}

export default function ProductUomsView() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("product-uom.read");
  const canCreate = hasPermission('product-uom.create')
  const canEdit = hasPermission('product-uom.update')
  const canDelete = hasPermission('product-uom.delete')
  const canReadFranchisePrice = hasPermission('common.franchise-price.read')
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

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  const [typeFilter, setTypeFilter] = useState<string | ''>('')
  const [showProductDrop, setShowProductDrop] = useState(false)
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductUom | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<ProductUom | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [resolvePrice, setResolvePrice] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => setProductSearchDebounced(productSearch), 400)
    return () => clearTimeout(timer)
  }, [productSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryFilter, typeFilter, selectedProductId])

  const { data: productSearchData } = useQuery({
    queryKey: ['product-uoms-product-search', productSearchDebounced, activeProductTypes],
    enabled: productSearchDebounced.length >= 2 && !selectedProductId,
    queryFn: () =>
      api
        .get('/products', {
          params: {
            per_page: perPage,
            'filter[search]': productSearchDebounced,
            'filter[product_types]': activeProductTypes,
            sort: 'name',
          },
        })
        .then((r) => r.data),
  })
  const productResults = (productSearchData as any)?.data ?? []

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService
        .list({ per_page: perPage })
        .then((r) => r.data),
  })
  const categories = (categoriesData as any)?.data ?? []

  const { data: categoryProductsData } = useQuery({
    queryKey: ['products-by-category-type', categoryFilter, typeFilter, activeProductTypes],
    enabled: categoryFilter !== '' || typeFilter !== '',
    queryFn: () =>
      api
        .get('/products', {
          params: {
            per_page: perPage,
            'filter[product_types]': typeFilter === '' ? (activeProductTypes || undefined) : String(typeFilter),
            'filter[product_category_id]': categoryFilter === '' ? undefined : String(categoryFilter),
          },
        })
        .then((r) => r.data),
  })
  const categoryProductIds = new Set<number>(
    ((categoryProductsData as any)?.data ?? []).map((p: any) => p.id as number),
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-uoms', page, perPage, debouncedSearch, selectedProductId, resolvePrice, activeProductTypes],
    queryFn: () =>
      productUomsService
        .list({
          page,
          per_page: perPage,
          sort: '-id',
          include: 'product,uom,product.product_category',
          'filter[search]': debouncedSearch || undefined,
          'filter[resolve_price]': resolvePrice ? 'true' : undefined,
          'filter[product_types]': activeProductTypes,
          ...(selectedProductId ? { 'filter[product_id]': selectedProductId } : {}),
        } as any)
        .then((r) => r.data),
  })

  const items: ProductUom[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const filteredItems = items.filter((i) => {
    if (!isProductTypeAllowed(i.product, activeProductTypes)) return false
    if (categoryFilter !== '' || typeFilter !== '') {
      if (!categoryProductIds.has(i.product_id)) return false
    }
    return true
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productUomsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      toast.success('Product UOM deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const boolPill = (val?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 500,
    background: val ? 'var(--success-bg)' : 'var(--destructive-bg)',
    color: val ? 'var(--success)' : 'var(--destructive)',
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
            Product UOMs
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Manage pricing and unit configurations per product
          </p>
        </div>

        {canCreate && (<button
          onClick={() => { setEditData(null); setSheetOpen(true) }}
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
          <Plus size={15} />New Product UOM
                              </button>)}
      </div>
      {/* Toolbar */}
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          {/* Product name search */}
          <div style={{ position: 'relative' }}>
            <input
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setShowProductDrop(true)
                if (!e.target.value) {
                  setSelectedProductId(null)
                  setPage(1)
                }
              }}
              onFocus={() => setShowProductDrop(true)}
              placeholder="Search by product name..."
              style={{
                height: 36,
                width: 240,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--surface)',
              }}
            />
            {selectedProductId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId(null)
                  setProductSearch('')
                  setPage(1)
                }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
            {showProductDrop && productResults.length > 0 && !selectedProductId && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 30,
                  width: 280,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {productResults.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(p.id)
                      setProductSearch(p.name)
                      setShowProductDrop(false)
                      setPage(1)
                    }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--background)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface)'
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span
                      style={{
                        color: 'var(--foreground-muted)',
                        marginLeft: 8,
                        fontSize: 11,
                      }}
                    >
                      {p.code}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Code search — keep existing */}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by code..."
            style={{
              height: 36,
              width: 180,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0 12px',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
            }}
          />

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))
              setPage(1)
            }}
            style={{
              height: 36,
              maxWidth: 200,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0 12px',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
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
              background: 'var(--surface)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {selectedProductId && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--accent)',
                background: 'var(--accent-light-bg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              Filtered by: {productSearch}
            </span>
          )}
          {/* Resolve price toggle */}
          <button
            onClick={() => setResolvePrice(!resolvePrice)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              background: resolvePrice ? 'var(--accent-light-bg)' : 'var(--surface)',
              border: `1px solid ${resolvePrice ? 'var(--accent-light)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 500,
              color: resolvePrice ? 'var(--accent)' : 'var(--foreground-muted)',
              cursor: 'pointer',
            }}
          >
            <Tag size={13} />
            Resolve Franchise Price
          </button>
        </div>
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
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              {[
                { label: 'No.', width: 50 },
                { label: 'Product', width: undefined },
                { label: 'UOM', width: 100 },
                { label: 'Code', width: 120 },
                { label: 'Base Price', width: 140 },
                { label: 'Online Price', width: 140 },
                ...(canReadFranchisePrice ? [{ label: 'Franchise Price', width: 140 }] : []),
                { label: 'Default', width: 90 },
                { label: 'Created', width: 130 },
                { label: '', width: 80 },
              ].map((col, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    textAlign: col.label === 'No.' ? 'center' : 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
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
                <td colSpan={10} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                  Failed to load product UOMs
                </td>
              </tr>
            )}

            {!isLoading && !isError && filteredItems.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Tag size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No product UOMs found
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{item.product?.name ?? '—'}</span>
                      {item.product?.code && (
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--foreground-muted)' }}>
                          {item.product.code}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: 'var(--accent-light-bg)',
                        color: 'var(--accent)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      {item.uom?.code ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {canRead ? item.code ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          background: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.code}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
                    ) : "***"}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground)' }}>
                    {canRead ? formatCurrency(item.base_price) : "***"}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {canRead ? formatCurrency(item.online_price) : "***"}
                  </td>
                  {canReadFranchisePrice && (
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {canRead ? formatCurrency(item.franchise_price) : "***"}
                    </td>
                  )}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={boolPill(item.is_default)}>
                      {item.is_default ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.created_at
                      ? formatDateShort(item.created_at)
                      : '—' : "***"}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setSelectedItem(item)}
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
                        onClick={() => { setEditData(item); setSheetOpen(true) }}
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
              ))}
          </tbody>
        </table>
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
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
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
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Delete Product UOM
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              Removing this may affect orders and recipes that reference it.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
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
      {/* Detail panel */}
      {selectedItem && (
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
            onClick={() => setSelectedItem(null)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.18)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 50,
              width: 420,
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Product UOM Detail
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
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
            <div
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {[
                { label: 'ID', value: selectedItem.id },
                { label: 'SKU Code', value: selectedItem.code },
                { label: 'Product', value: selectedItem.product?.name },
                { label: 'Product Code', value: selectedItem.product?.code },
                { label: 'UOM Code', value: selectedItem.uom?.code },
                { label: 'Base Price', value: formatCurrency(selectedItem.base_price) },
                { label: 'Online Price', value: formatCurrency(selectedItem.online_price) },
                ...(canReadFranchisePrice ? [{ label: 'Franchise Price', value: formatCurrency(selectedItem.franchise_price) }] : []),
                {
                  label: 'Price Editable',
                  value: selectedItem.price_editable ? 'Yes' : 'No',
                },
                {
                  label: 'Is Default',
                  value: selectedItem.is_default ? 'Yes' : 'No',
                },
                {
                  label: 'Created At',
                  value: selectedItem.created_at
                    ? formatDateTime(selectedItem.created_at)
                    : '—',
                },
              ].map((f) => (
                <div
                  key={f.label}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {f.label}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                    {f.value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <ProductUomSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditData(null) }}
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
