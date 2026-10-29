'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productCutsService, type ProductCut, type ProductCutUom } from '@/services/product-cuts.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import ProductCutSheet from './ProductCutSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { Plus, Search, Pencil, Trash2, Scissors, Eye, X } from 'lucide-react'

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

export default function ProductCutsView() {
  const queryClient = useQueryClient()
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('product-cut.read') || hasPermission('product.read')
  const canCreate = hasPermission('product-cut.create')
  const canEdit = hasPermission('product-cut.update')
  const canDelete = hasPermission('product-cut.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductCut | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<ProductCut | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-cuts', page, perPage, debouncedSearch],
    enabled: canRead,
    queryFn: () =>
      productCutsService
        .list({
          page,
          per_page: perPage,
          include: 'parent_product_uom,child_product_uom',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: ProductCut[] = ((data as any)?.data ?? []) as ProductCut[]
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productCutsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-cuts'] })
      toast.success('Cut dihapus')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menghapus cut'),
  })

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product code..."
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              {['No.', 'Parent (Induk)', '', 'Child (Anak)', 'Yield', 'Created', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                  Failed to load product cuts
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Scissors size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      Belum ada cut table — tambahkan baris agar produk bisa dipotong.
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && items.map((item, idx) => {
              return (
                <tr
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ borderBottom: '1px solid var(--border)', background: hoveredRow === item.id ? 'var(--background)' : 'transparent' }}
                >
                  <td style={{ padding: '12px 16px', color: 'var(--foreground-muted)', fontSize: 13 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {canRead ? <ProductCell uom={item.parent_product_uom} /> : '***'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
                      1 → {canRead ? Number(item.yield_qty).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '***'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {canRead ? <ProductCell uom={item.child_product_uom} /> : '***'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                    {canRead ? Number(item.yield_qty).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '***'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {canRead ? (item.created_at ? String(item.created_at).slice(0, 10) : '—') : '***'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
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

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

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
