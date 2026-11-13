'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateShort, formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productConversionsService } from '@/services/product-conversions.service'
import { productsService } from '@/services/products.service'
import { uomsService } from '@/services/uoms.service'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import ProductConversionSheet from './ProductConversionSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, FilterGroup, FilterField, FilterSelect, countActive } from '@/components/ListFilters'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ArrowRight,
  Eye,
  X,
} from 'lucide-react'

interface ProductConversion {
  id: number
  product_id: number
  uom_id: number
  target_uom_id: number
  amount: number
  created_at?: string
  product?: { id: number; name: string }
  uom?: { id: number; name: string; code: string }
  target_uom?: { id: number; name: string; code: string }
}

export default function ProductConversionsView() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("product-conversion.read");
  const canCreate = hasPermission('product-conversion.create')
  const canEdit = hasPermission('product-conversion.update')
  const canDelete = hasPermission('product-conversion.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductConversion | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<ProductConversion | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [productFilter, setProductFilter] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [uomFilter, setUomFilter] = useState<number | ''>('')
  const [targetUomFilter, setTargetUomFilter] = useState<number | ''>('')
  const canReadProducts = hasPermission('product.read')
  const canReadUoms = hasPermission('uom.read')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProductSearch(productSearch), 400)
    return () => clearTimeout(timer)
  }, [productSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, productFilter, uomFilter, targetUomFilter])

  const productsOpts = useInfiniteOptions<any>({
    queryKey: ['products-all', debouncedProductSearch],
    fetchPage: (page) =>
      productsService
        .list({ page, per_page: 50, sort: 'name', 'filter[search]': debouncedProductSearch || undefined } as any)
        .then((r) => r.data),
    enabled: canReadProducts,
  })
  const productOptions = [
    { value: 0, label: 'All products' },
    ...(productsOpts.items as any[]).map((p) => ({
      value: p.id as number,
      label: (p.name as string) ?? '',
      sublabel: p.code as string | undefined,
    })),
  ]

  const { data: uomsData } = useQuery({
    queryKey: ['uoms-all'],
    queryFn: () => uomsService.list({ per_page: 1000 } as any).then((r) => r.data),
    enabled: canReadUoms,
  })
  const uoms: any[] = (uomsData as any)?.data ?? []

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['product-conversions', page, perPage, debouncedSearch, productFilter, uomFilter, targetUomFilter],
    queryFn: () =>
      productConversionsService
        .list({
          page,
          per_page: perPage,
          include: 'product,uom,target_uom',
          'filter[search]': debouncedSearch || undefined,
          'filter[product_id]': productFilter ? String(productFilter) : undefined,
          'filter[uom]': uomFilter === '' ? undefined : String(uomFilter),
          'filter[target_uom]': targetUomFilter === '' ? undefined : String(targetUomFilter),
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: ProductConversion[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productConversionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Conversion deleted')
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
            Product Conversions
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Define unit conversion factors between UOMs per product
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
          <Plus size={15} />New Conversion
                              </button>)}
      </div>
      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search conversions..."
        activeCount={countActive(productFilter, uomFilter, targetUomFilter)}
        onClear={() => {
          setProductFilter(0)
          setUomFilter('')
          setTargetUomFilter('')
          setPage(1)
        }}
        quick={
          canReadProducts ? (
            <div style={{ width: 240 }}>
              <SearchableSelect
                value={productFilter}
                onChange={(val) => setProductFilter(Number(val) || 0)}
                options={productOptions}
                placeholder="All products"
                searchPlaceholder="Search products..."
                loading={productsOpts.loading}
                {...productsOpts.selectProps}
                onSearchChange={setProductSearch}
              />
            </div>
          ) : undefined
        }
      >
        {canReadUoms && (
          <FilterGroup title="Units">
            <FilterField label="From UOM">
              <FilterSelect
                block
                value={uomFilter}
                onChange={(e) => setUomFilter(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">All from UOMs</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.code ? ` (${u.code})` : ''}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
            <FilterField label="To UOM">
              <FilterSelect
                block
                value={targetUomFilter}
                onChange={(e) => setTargetUomFilter(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">All to UOMs</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.code ? ` (${u.code})` : ''}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
          </FilterGroup>
        )}
      </FilterBar>
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
                  { label: 'Product', width: undefined },
                  { label: 'From', width: 140 },
                  { label: '', width: 40 },
                  { label: 'To', width: 140 },
                  { label: 'Amount', width: 120 },
                  { label: 'Created', width: 140 },
                  { label: '', width: 80 },
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  colSpan={9}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load conversions
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <ArrowLeftRight size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No conversions defined
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
                    background:
                      hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)', textAlign: 'center' }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  {/* Product */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--foreground)',
                    }}
                  >
                    {canRead ? item.product?.name ?? '—' : "***"}
                  </td>

                  {/* From */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                        }}
                      >
                        {item.uom?.name ?? '—'}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.uom?.code ?? ''}
                      </span>
                    </div>
                  </td>

                  {/* Arrow */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <ArrowRight size={13} style={{ color: 'var(--foreground-subtle)' }} />
                  </td>

                  {/* To */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                        }}
                      >
                        {item.target_uom?.name ?? '—'}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.target_uom?.code ?? ''}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {canRead ? formatCurrency(item.amount ?? 0, '') : "***"}
                  </td>

                  {/* Created */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {canRead ? item.created_at
                      ? formatDateShort(item.created_at)
                      : '—' : "***"}
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
              ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
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
              Delete Conversion
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
              }}
            >
              Removing this conversion may affect recipe calculations that depend on it.
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
                Conversion Detail
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
                { label: 'Product', value: selectedItem.product?.name },
                {
                  label: 'From UOM',
                  value: selectedItem.uom
                    ? `${selectedItem.uom.name} (${selectedItem.uom.code})`
                    : undefined,
                },
                {
                  label: 'To UOM',
                  value: selectedItem.target_uom
                    ? `${selectedItem.target_uom.name} (${selectedItem.target_uom.code})`
                    : undefined,
                },
                { label: 'Amount', value: selectedItem.amount },
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
      <ProductConversionSheet
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
