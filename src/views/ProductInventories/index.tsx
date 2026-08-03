'use client'
import { formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import ProductInventorySheet from './ProductInventorySheet'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Boxes,
  AlertTriangle,
  Eye,
  X,
  Download,
  Loader2,
} from 'lucide-react'

interface ProductInventory {
  id: number
  qty: number
  stock?: number
  min_qty?: number
  code?: string
  expiry_date?: string
  status?: 'active' | 'inactive'
  created_at?: string
  product_uom_id: number
  branch_id: number
  product_uom?: {
    id: number
    code?: string
    product?: { id: number; name: string }
    uom?: { id: number; name: string; code: string }
  }
  product_uom_batch?: {
    id: number
    code?: string
    expiry_date?: string
    product_uom?: {
      id: number
      code?: string
      product?: {
        id: number
        name: string
        product_category?: { id: number; name: string }
      }
      uom?: { id: number; name: string; code: string }
    }
  }
  branch?: { id: number; name: string; code?: string }
}

export default function ProductInventoriesView() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("product-inventory.read");
  const canCreate = hasPermission('product-inventory.create')
  const canEdit = hasPermission('product-inventory.update')
  const canDelete = hasPermission('product-inventory.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [stockGte, setStockGte] = useState<string>('')
  const [stockLte, setStockLte] = useState<string>('')
  const [expiryDateGte, setExpiryDateGte] = useState<string>('')
  const [debouncedStockGte, setDebouncedStockGte] = useState<string>('')
  const [debouncedStockLte, setDebouncedStockLte] = useState<string>('')
  const [debouncedExpiryDateGte, setDebouncedExpiryDateGte] = useState<string>('')
  const [hideEmpty, setHideEmpty] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductInventory | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<ProductInventory | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setDebouncedStockGte(stockGte)
      setDebouncedStockLte(stockLte)
      setDebouncedExpiryDateGte(expiryDateGte)
    }, 500)
    return () => clearTimeout(t)
  }, [search, stockGte, stockLte, expiryDateGte])

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await productInventoriesService.exportExcel({
        'filter[search]': debouncedSearch || undefined,
      })

      const blob = new Blob([response.data], {
        type:
          'application/vnd.openxmlformats-' +
          'officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `product-inventories-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded successfully')
    } catch (err) {
      toast.error('Failed to export')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedStockGte, debouncedStockLte, debouncedExpiryDateGte])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-inventories', page, debouncedSearch, debouncedStockGte, debouncedStockLte, debouncedExpiryDateGte],
    queryFn: () =>
      productInventoriesService
        .list({
          page,
          per_page: 15,
          sort: '-id',
          include: 'branch,product_uom_batch',
          'filter[search]': debouncedSearch || undefined,
          'filter[stock_gte]': debouncedStockGte || undefined,
          'filter[stock_lte]': debouncedStockLte || undefined,
          'filter[expiry_date_gte]': debouncedExpiryDateGte || undefined,
        })
        .then((r) => r.data),
  })

  const items: ProductInventory[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const { data: puData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' } as any)
        .then((r) => r.data),
  })
  const productUomsAll = (puData as any)?.data ?? []
  const getProductUom = (id: number) =>
    productUomsAll.find((pu: any) => pu.id === id)

  const filteredItems = items.filter((i) => {
    if (hideEmpty && (!i.qty || i.qty <= 0)) return false
    return true
  })


  const deleteMutation = useMutation({
    mutationFn: (id: number) => productInventoriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
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
            Product Inventory
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Track stock levels per product and branch
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? (
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <Download size={14} />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

        </div>
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
            placeholder="Search inventory..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            value={stockGte}
            onChange={(e) => setStockGte(e.target.value)}
            placeholder="Min stock"
            style={{
              width: 100,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>-</span>
          <input
            type="number"
            value={stockLte}
            onChange={(e) => setStockLte(e.target.value)}
            placeholder="Max stock"
            style={{
              width: 100,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <input
            type="date"
            value={expiryDateGte}
            onChange={(e) => setExpiryDateGte(e.target.value)}
            placeholder="Min Expiry Date"
            style={{
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
            title="Min Expiry Date"
          />
        </div>

        {/* Hide empty batches toggle */}
        <button
          onClick={() => setHideEmpty(!hideEmpty)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 12px',
            background: hideEmpty ? 'var(--accent-light-bg)' : 'var(--surface)',
            border: `1px solid ${hideEmpty ? 'var(--accent-light)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            fontWeight: 500,
            color: hideEmpty ? 'var(--accent)' : 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          <Boxes size={13} />
          Hide empty batches
        </button>
      </div>
      {/* Summary bar */}
      {meta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 16px',
            background: 'var(--background)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--foreground-muted)',
          }}
        >
          <span>Total items: {meta?.total ?? 0}</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>
            {filteredItems.length} listed
          </span>
        </div>
      )}
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
                  { label: 'Product', width: undefined },
                  { label: 'UOM', width: 100 },
                  { label: 'Branch', width: 160 },
                  { label: 'Qty', width: 100 },
                  { label: 'Min Qty', width: 100 },
                  { label: 'Status', width: 110 },
                  { label: '', width: 80 },
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load inventory
                </td>
              </tr>
            )}

            {!isLoading && !isError && filteredItems.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Boxes size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No inventory items found
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredItems.map((item) => {
                const isLow =
                  item.min_qty !== undefined &&
                  item.min_qty !== null &&
                  (item.stock ?? 0) <= (item.min_qty ?? 0)
                const puFallback = getProductUom(item.product_uom_id)

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
                          : isLow
                            ? 'rgba(146, 96, 10, 0.03)'
                            : 'transparent',
                    }}
                  >
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
                          {item.product_uom_batch?.product_uom?.product?.name
                            ?? item.product_uom?.product?.name
                            ?? puFallback?.product?.name
                            ?? item.product_uom_batch?.product_uom?.code
                            ?? item.product_uom?.code
                            ?? puFallback?.code
                            ?? `Item #${item.id}`}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--foreground-muted)',
                          }}
                        >
                          {item.code}
                        </div>
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
                        {item.product_uom_batch?.product_uom?.uom?.code
                          ?? item.product_uom_batch?.product_uom?.uom?.name
                          ?? item.product_uom?.uom?.code
                          ?? puFallback?.uom?.code
                          ?? puFallback?.uom?.name
                          ?? '—'}
                      </span>
                    </td>
                    {/* Branch */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {canRead ? item.branch?.name ?? '—' : "***"}
                    </td>
                    {/* Qty */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isLow ? 'var(--warning)' : 'var(--foreground)',
                        }}
                      >
                        {(item.stock ?? 0).toLocaleString('id-ID')}
                      </span>
                    </td>
                    {/* Min Qty */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {canRead ? item.min_qty !== undefined && item.min_qty !== null
                        ? (item.min_qty ?? 0).toLocaleString('id-ID')
                        : '—' : "***"}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 500,
                          background: isLow
                            ? 'var(--warning-bg)'
                            : 'var(--success-bg)',
                          color: isLow ? 'var(--warning)' : 'var(--success)',
                        }}
                      >
                        {isLow && <AlertTriangle size={10} />}
                        {isLow ? 'Low Stock' : 'OK'}
                      </span>
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
                          onClick={() => {
                            setEditData(item)
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
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, meta.total)} of{' '}
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
      {/* Delete confirm dialog */}
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
              Delete Inventory Item
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
              }}
            >
              This will remove the stock record for this product at this branch.
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
                Inventory Detail
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
              {(() => {
                const detailPu = getProductUom(selectedItem.product_uom_id)
                const batchPu = (selectedItem as any).product_uom_batch?.product_uom
                const productName =
                  batchPu?.product?.name
                  ?? selectedItem.product_uom?.product?.name
                  ?? detailPu?.product?.name
                const puCode =
                  batchPu?.code ?? selectedItem.product_uom?.code ?? detailPu?.code
                const uom = batchPu?.uom ?? selectedItem.product_uom?.uom ?? detailPu?.uom
                return [
                  { label: 'ID', value: selectedItem.id },
                  { label: 'SKU Code', value: selectedItem.code },
                  { label: 'Product', value: productName },
                  { label: 'Product UOM', value: puCode },
                  {
                    label: 'UOM',
                    value: uom ? `${uom.name} (${uom.code})` : undefined,
                  },
                  { label: 'Branch', value: selectedItem.branch?.name },
                  {
                    label: 'Current Stock',
                    value: (selectedItem.stock ?? 0).toLocaleString('id-ID'),
                  },
                  { label: 'Status', value: selectedItem.status },
                  { label: 'Expiry Date', value: selectedItem.expiry_date },
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
                    {f.label === 'Status' && selectedItem.status ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignSelf: 'flex-start',
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 500,
                          background:
                            selectedItem.status === 'active'
                              ? 'var(--success-bg)'
                              : 'var(--destructive-bg)',
                          color:
                            selectedItem.status === 'active'
                              ? 'var(--success)'
                              : 'var(--destructive)',
                        }}
                      >
                        {selectedItem.status}
                      </span>
                    ) : (
                      <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                        {f.value ?? '—'}
                      </span>
                    )}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <ProductInventorySheet
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
