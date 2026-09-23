'use client'
import { formatDateShort, formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsService } from '@/services/products.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import ProductSheet from './ProductSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Search,
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
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'code'>('id')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Product | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<Product | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, categoryFilter])

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService
        .list({ per_page: perPage })
        .then((r) => r.data),
  })
  const categories = (categoriesData as any)?.data ?? []

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', page, perPage, debouncedSearch, typeFilter, categoryFilter, activeProductTypes, sortParam],
    queryFn: () =>
      productsService
        .list({
          page,
          per_page: perPage,
          sort: sortParam,
          include: 'product_category',
          'filter[search]': debouncedSearch || undefined,
          'filter[types]': typeFilter === '' ? 'raw,supply,wip' : String(typeFilter),
          'filter[product_category_id]': categoryFilter === '' ? undefined : String(categoryFilter),
        } as any)
        .then((r) => r.data),
  })

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
    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500 }
    if (type === 'raw') return { ...base, background: 'var(--info-bg)', color: 'var(--info)' }
    if (type === 'wip') return { ...base, background: 'var(--warning-bg)', color: 'var(--warning)' }
    if (type === 'final') return { ...base, background: 'var(--success-bg)', color: 'var(--success)' }
    if (type === 'supply') return { ...base, background: 'var(--accent-light-bg)', color: 'var(--accent)' }
    return { ...base, background: 'var(--border)', color: 'var(--foreground-muted)' }
  }

  const codePill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    background: 'var(--accent-light-bg)',
    color: 'var(--accent)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  }

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
            Products
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Manage your product catalogue
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
          <Plus size={15} />New Product
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
            placeholder="Search products..."
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
          }}
        >
          <option value="">All Types</option>
          {availableTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
            maxWidth: 200,
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              {[
                { label: 'No.', width: 65, sortKey: 'id' as const },
                { label: 'Name', width: undefined, sortKey: 'name' as const },
                { label: 'Code', width: 120, sortKey: 'code' as const },
                { label: 'Category', width: 160 },
                { label: 'Type', width: 100 },
                { label: 'Created', width: 140 },
                { label: '', width: 80 },
              ].map((col, i) => {
                const isSortable = !!col.sortKey
                const isActive = sortBy === col.sortKey
                return (
                  <th
                    key={i}
                    onClick={isSortable ? () => handleSort(col.sortKey!) : undefined}
                    style={{
                      padding: col.label === 'No.' ? '10px 8px' : '10px 16px',
                      textAlign: col.label === 'No.' ? 'center' : 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      width: col.width,
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: col.label === 'No.' ? 'center' : 'flex-start',
                        gap: 4,
                      }}
                    >
                      <span>{col.label}</span>
                      {isSortable && (
                        isActive ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp size={12} style={{ color: 'var(--accent)' }} />
                          ) : (
                            <ArrowDown size={12} style={{ color: 'var(--accent)' }} />
                          )
                        ) : (
                          <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                        )
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                  Failed to load products
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Package size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No products found
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item, idx) => (
                <tr
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 65 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {canRead ? item.name : "***"}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {canRead ? item.code ? (
                      <span style={codePill}>{item.code}</span>
                    ) : (
                      <span style={{ color: 'var(--foreground-subtle)', fontSize: 13 }}>—</span>
                    ) : "***"}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.product_category?.name ?? '—' : "***"}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={typePillStyle(item.type)}>
                      {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '—'}
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
              Delete Product
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              This will permanently remove the product and may affect related records.
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
                Product Detail
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
                { label: 'Code', value: selectedItem.code },
                { label: 'Name', value: selectedItem.name },
                { label: 'Type', value: selectedItem.type },
                { label: 'Category', value: selectedItem.product_category?.name },
                { label: 'Description', value: selectedItem.description },
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
                  {f.label === 'Type' && selectedItem.type ? (
                    <span style={typePillStyle(selectedItem.type)}>
                      {selectedItem.type.charAt(0).toUpperCase() +
                        selectedItem.type.slice(1)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                      {f.value ?? '—'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <ProductSheet
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
