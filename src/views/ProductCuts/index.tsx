'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productCutsService, type ProductCut, type ProductCutUom } from '@/services/product-cuts.service'
import { productsService } from '@/services/products.service'
import SearchableSelect from '@/components/SearchableSelect'
import { useDebounce } from '@/hooks/useDebounce'
import { productTypeLabel } from '@/utils/productUomName'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import ProductCutSheet from './ProductCutSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, countActive } from '@/components/ListFilters'
import { Plus, Pencil, Trash2, Scissors, Eye, X, ArrowRight } from 'lucide-react'

/** Human label for an embedded product-UOM: product name, falling back to the unit's own name. */
const uomLabel = (uom?: { name?: string; code?: string; product?: { name?: string } }): string =>
  uom?.product?.name ?? uom?.name ?? ''

/** Product name over its SKU code, for the parent/child cells. */
const ProductCell = ({ uom }: { uom?: ProductCutUom }) => {
  const name = uomLabel(uom)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{name || '—'}</span>
      {uom?.code && (
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--foreground-muted)' }}>
          {uom.code}
        </span>
      )}
    </div>
  )
}

type ProductOption = { value: number; label: string; sublabel?: string }

/**
 * Server-searched products for the cut filter. Filtering is by PRODUCT, not
 * product-UOM: a cut is stored on one specific UOM row, so picking another
 * UOM of the same product (Reg / Ind / PCS ...) used to match nothing.
 */
function useProductFilterOptions(search: string, selected: ProductOption | null, enabled: boolean) {
  const { data, isFetching } = useQuery({
    queryKey: ['product-cut-filter-products', search],
    enabled,
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      productsService
        .list({ 'filter[search]': search || undefined, per_page: 20 } as any)
        .then((r) => ((r.data as any)?.data ?? []) as any[]),
  })
  const options = useMemo(() => {
    const opts: ProductOption[] = (data ?? []).map((p: any) => ({
      value: p.id,
      label: p.name || `#${p.id}`,
      sublabel: [p.code, productTypeLabel(p.type)].filter(Boolean).join(' · '),
    }))
    if (selected && !opts.some((o) => o.value === selected.value)) opts.unshift(selected)
    return opts
  }, [data, selected])
  return { options, isFetching }
}

export default function ProductCutsView() {
  const queryClient = useQueryClient()
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('product-cut.read') || hasPermission('product.read')
  const canCreate = hasPermission('product-cut.create')
  const canEdit = hasPermission('product-cut.update')
  const canDelete = hasPermission('product-cut.delete')

  // /v1/product-cuts has no filter[search]. One product picker (searching
  // /v1/products) finds every cut where that product is the parent OR the
  // child, via filter[parent_product_id] + filter[child_product_id].
  const [productSel, setProductSel] = useState<ProductOption | null>(null)
  const productId = productSel?.value ?? 0
  const [productSearch, setProductSearch] = useState('')
  const productSearchDebounced = useDebounce(productSearch, 400)
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductCut | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<ProductCut | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const listParams = {
    // grouped by parent so each parent's cuts render together
    sort: 'parent_product_uom_id,yield_qty',
    include: 'parent_product_uom,child_product_uom',
  }

  // No product picked: normal paginated list.
  const { data, isLoading: listLoadingFirstLoad, isFetching: listLoadingFetching, isError: listError } = useQuery({
    queryKey: ['product-cuts', page, perPage],
    enabled: canRead && !productId,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      productCutsService
        .list({ page, per_page: perPage, ...listParams } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const listLoading = listLoadingFirstLoad || listLoadingFetching

  // Product picked: its cuts as parent and as child, merged (a product has
  // only a handful of cuts, so one page of each is enough).
  const { data: byProduct, isLoading: productLoading, isError: productError } = useQuery({
    queryKey: ['product-cuts', 'by-product', productId],
    enabled: canRead && !!productId,
    queryFn: async () => {
      const [asParent, asChild] = await Promise.all(
        (['filter[parent_product_id]', 'filter[child_product_id]'] as const).map((f) =>
          productCutsService
            .list({ per_page: 100, ...listParams, [f]: productId } as any)
            .then((r) => (((r.data as any)?.data ?? []) as ProductCut[])),
        ),
      )
      const seen = new Set<number>()
      return [...asParent, ...asChild]
        .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
        .sort((a, b) => a.parent_product_uom_id - b.parent_product_uom_id || Number(a.yield_qty) - Number(b.yield_qty))
    },
  })

  const productOpts = useProductFilterOptions(productSearchDebounced, productSel, canRead)

  const items: ProductCut[] = productId ? (byProduct ?? []) : (((data as any)?.data ?? []) as ProductCut[])
  const meta = productId ? undefined : (data as any)?.meta
  const isLoading = productId ? productLoading : listLoading
  const isError = productId ? productError : listError
  const totalCount = productId ? byProduct?.length : meta?.total

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productCutsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-cuts'] })
      toast.success('Cut dihapus')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menghapus cut'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', paddingBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            Product Cuts
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Satu baris = satu unit induk memberi sejumlah unit anak. Menentukan apa yang bisa dipotong.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditData(null); setSheetOpen(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={15} />New Cut
          </button>
        )}
      </div>

      {/* Toolbar */}
      <FilterBar
        activeCount={countActive(productId)}
        onClear={() => { setProductSel(null); setPage(1) }}
        quick={
          <div style={{ width: 360, maxWidth: '100%' }}>
            <SearchableSelect
              value={productId}
              onChange={(v) => { setProductSel(productOpts.options.find((o) => o.value === Number(v)) ?? null); setPage(1) }}
              options={[{ value: 0, label: 'Semua produk' }, ...productOpts.options]}
              placeholder="Cari produk (induk atau anak)..."
              searchPlaceholder="Ketik nama / kode produk..."
              loading={productOpts.isFetching}
              onSearchChange={setProductSearch}
            />
          </div>
        }
        actions={
          totalCount != null ? (
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              {Number(totalCount).toLocaleString('id-ID')} cut{productSel ? ` untuk ${productSel.label}` : ''}
            </span>
          ) : undefined
        }
      />

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              {['Produk Induk', '', 'Produk Anak', 'Hasil Potong', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: i === 3 ? 'center' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: 0.6, width: i === 1 ? 32 : i === 3 ? 140 : i === 4 ? 110 : undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    {[60, 40, 80, 50, 70].map((w, i) => (
                      <div key={i} style={{ height: 16, borderRadius: 4, background: 'var(--border)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                  </div>
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                  Failed to load product cuts
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Scissors size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {productId
                        ? `Belum ada cut untuk ${productSel?.label ?? 'produk ini'} (sebagai induk maupun anak).`
                        : 'Belum ada cut table — tambahkan baris agar produk bisa dipotong.'}
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && items.map((item, idx) => {
              // Rows are sorted by parent: show the parent once per group.
              const firstOfGroup = idx === 0 || items[idx - 1].parent_product_uom_id !== item.parent_product_uom_id
              const yieldText = Number(item.yield_qty).toLocaleString('id-ID', { maximumFractionDigits: 2 })
              return (
                <tr
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderTop: firstOfGroup && idx > 0 ? '1px solid var(--border-strong)' : '1px solid var(--border)',
                    background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 16px' }}>
                    {firstOfGroup ? (canRead ? <ProductCell uom={item.parent_product_uom} /> : '***') : null}
                  </td>
                  <td style={{ padding: '10px 0', color: 'var(--foreground-subtle)' }}>
                    <ArrowRight size={14} />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {canRead ? <ProductCell uom={item.child_product_uom} /> : '***'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span
                      title={`1 unit induk menjadi ${yieldText} unit anak`}
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 99,
                        background: 'var(--accent-light-bg)',
                        color: 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      1 → {canRead ? yieldText : '***'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => setSelectedItem(item)} style={{ padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }} title="View">
                        <Eye size={14} />
                      </button>
                      {canEdit && (
                        <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={{ padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }} title="Edit">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(item.id)} style={{ padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--destructive)', display: 'flex' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!productId && <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />}

      {/* Delete confirm */}
      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
          <div style={{ position: 'relative', zIndex: 51, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 380, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Cut</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              Cut dihapus (soft delete) sehingga pasangan induk→anak bisa didefinisikan ulang. Portioning yang sudah ada tidak terpengaruh.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDeleteConfirmId(null)} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '8px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelectedItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 420, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>Cut Detail</h2>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'ID', value: selectedItem.id },
                { label: 'Parent Product', value: uomLabel(selectedItem.parent_product_uom) || '—' },
                { label: 'Parent SKU', value: selectedItem.parent_product_uom?.code },
                { label: 'Child Product', value: uomLabel(selectedItem.child_product_uom) || '—' },
                { label: 'Child SKU', value: selectedItem.child_product_uom?.code },
                { label: 'Yield (1 → N)', value: selectedItem.yield_qty },
                { label: 'Scrap Rate', value: selectedItem.scrap_rate ?? 0 },
                { label: 'Created At', value: selectedItem.created_at ? String(selectedItem.created_at) : '—' },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {f.label}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>{f.value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ProductCutSheet
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
  )
}
