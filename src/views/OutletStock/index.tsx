'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productUomsService } from '@/services/product-uoms.service'
import { productsService } from '@/services/products.service'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, useProductTypes } from '@/hooks/useProductTypes'
import SearchableSelect from '@/components/SearchableSelect'
import MultiSearchableSelect from '@/components/MultiSearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { withProductType, productTypeLabel } from '@/utils/productUomName'
import { LayoutGrid, Search } from 'lucide-react'

interface OutletStockBranch {
  id: number
  code?: string
  name?: string
  type?: string
  total_stock?: number
}

interface OutletStockItem {
  id: number
  code?: string
  name?: string
  product_id: number
  uom_id: number
  total_in_branches?: OutletStockBranch[]
  product?: { id: number; name: string; code?: string; type?: string }
  uom?: { id: number; name: string; code?: string }
}

interface ProductRow {
  id: number
  name?: string
  code?: string
  type?: string
}

/** Bentuk body respons branch-stock: { data: [...], meta: {...} } */
interface BranchStockPayload {
  data?: OutletStockItem[]
  meta?: {
    current_page?: number
    per_page?: number
    total?: number
    last_page?: number
    total_pages?: number
  }
}

function formatQty(n: number | null | undefined, mask = false): string {
  if (mask) return '***'
  if (n == null || !Number.isFinite(n)) return '—'
  return (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

// ── Sticky table helpers (sama seperti Stock Position) ───────────────────────
const HEAD_BG = 'var(--background)'
const BODY_BG = 'var(--surface)'
const Z_BODY_LEFT = 2
const Z_AXIS = 3
const Z_CORNER = 4

const stickyTopTh: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: Z_AXIS,
  background: HEAD_BG,
}

const stickyLeft = (left: number, background: string, z: number): React.CSSProperties => ({
  position: 'sticky',
  left,
  zIndex: z,
  background,
  borderRight: '1px solid var(--border)',
})

export default function OutletStockView() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('stock-movement.read') || hasPermission('product-inventory.read')
  const activeProductTypes = useActiveBranchProductTypes()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productId, setProductId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  // Filter tipe produk (multi) → filter[product_types] dipisah koma.
  const [productTypeFilter, setProductTypeFilter] = useState<(number | string)[]>([])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setProductSearchDebounced(productSearch), 400)
    return () => clearTimeout(t)
  }, [productSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, productId, productTypeFilter])

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['outlet-stock-product-search', productSearchDebounced],
    enabled: productSearchDebounced.length >= 2,
    queryFn: () =>
      productsService
        .list({ per_page: 50, sort: 'name', 'filter[search]': productSearchDebounced })
        .then((r) => r.data),
  })
  const products: ProductRow[] = (productsData?.data?.data as ProductRow[] | undefined) ?? []
  const productOptions = [
    { value: 0, label: 'Semua Produk' },
    ...products.map((p) => ({
      value: p.id,
      label: withProductType(p.name ?? `Product #${p.id}`, p.type),
      sublabel: p.code,
    })),
  ]

  // Opsi tipe produk dibatasi tipe yang dipakai company/branch aktif.
  const { options: allProductTypeOptions, isLoading: isLoadingProductTypes } = useProductTypes()
  const allowedProductTypes = new Set(
    (activeProductTypes ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((t) => (t === 'supplies' ? 'supply' : t)),
  )
  const productTypeOptions = (allProductTypeOptions as readonly string[])
    .filter((t) => allowedProductTypes.size === 0 || allowedProductTypes.has(t.toLowerCase()))
    .map((t) => ({ value: t, label: productTypeLabel(t) }))
  // Kosong = semua tipe company, terpilih = pilihan user.
  const productTypesParam =
    productTypeFilter.length > 0 ? productTypeFilter.join(',') : activeProductTypes

  // API baru /product-uoms/branch-stock: product UOM + stok per branch.
  // total_in_branches hanya memuat branch yang stoknya tidak nol.
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'outlet-stock',
      page,
      perPage,
      debouncedSearch,
      productId,
      productTypesParam,
    ],
    queryFn: () =>
      productUomsService
        .branchStock({
          page,
          per_page: perPage,
          sort: 'name:product_uoms.name',
          include: 'product,uom',
          'filter[search]': debouncedSearch || undefined,
          'filter[product_id]': productId > 0 ? productId : undefined,
          'filter[product_types]': productTypesParam || undefined,
        })
        .then((r) => r.data as unknown as BranchStockPayload),
  })

  const items: OutletStockItem[] = data?.data ?? []
  const meta = data?.meta

  // Kolom cabang: hanya outlet (type === 'outlet') — union dari halaman ini,
  // diurutkan berdasarkan nama, konsisten dengan layar Stock Position.
  const branchColumns = useMemo(() => {
    const map = new Map<number, { id: number; label: string; code?: string; type?: string }>()
    for (const item of items) {
      for (const b of item.total_in_branches ?? []) {
        if (String(b.type ?? '').toLowerCase() !== 'outlet') continue
        if (!map.has(b.id)) {
          map.set(b.id, {
            id: b.id,
            label: b.name || b.code || `Outlet #${b.id}`,
            code: b.code,
            type: b.type,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const branchStockOf = (item: OutletStockItem, branchId: number): number | null => {
    const found = (item.total_in_branches ?? []).find((b) => b.id === branchId)
    return found && found.total_stock != null ? found.total_stock : null
  }

  // Total stok outlet untuk satu baris (null bila tidak ada outlet yang punya stok).
  const outletTotalOf = (item: OutletStockItem): number | null => {
    const vals = (item.total_in_branches ?? [])
      .filter((b) => String(b.type ?? '').toLowerCase() === 'outlet')
      .map((b) => Number(b.total_stock ?? 0))
    if (vals.length === 0) return null
    return vals.reduce((s, v) => s + v, 0)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    marginBottom: 4,
    display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    boxSizing: 'border-box',
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    fontSize: 13,
    color: 'var(--foreground)',
  }

  const numStyle: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }
  const fixedCols = 5 + branchColumns.length

  return (
    <div style={{ padding: '32px 32px 64px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
            Outlet Stock
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Stok product UOM di setiap outlet — dapat dilihat oleh branch produksi
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <label style={labelStyle}>Cari</label>
          <div style={{ position: 'relative' }}>
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
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / kode UOM..."
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Produk</label>
          <SearchableSelect
            value={productId}
            onChange={(val) => setProductId(Number(val) || 0)}
            options={productOptions}
            placeholder="Semua Produk"
            searchPlaceholder="Ketik minimal 2 huruf untuk mencari..."
            loading={productsLoading}
            onSearchChange={setProductSearch}
          />
        </div>

        <div>
          <label style={labelStyle}>Tipe Produk</label>
          <MultiSearchableSelect
            value={productTypeFilter}
            onChange={setProductTypeFilter}
            options={productTypeOptions}
            placeholder="Semua Tipe Produk"
            searchPlaceholder="Cari tipe produk..."
            loading={isLoadingProductTypes}
          />
        </div>
      </div>

      {/* Matrix table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="stock-scroll" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                {/* Sudut (sticky top + left) memakai z-index paling tinggi */}
                <th style={{ ...thStyle, ...stickyTopTh, ...stickyLeft(0, HEAD_BG, Z_CORNER), width: 44, textAlign: 'center' }}>
                  #
                </th>
                <th style={{ ...thStyle, ...stickyTopTh, ...stickyLeft(44, HEAD_BG, Z_CORNER), minWidth: 200 }}>
                  Produk
                </th>
                <th style={{ ...thStyle, ...stickyTopTh, minWidth: 140 }}>UOM</th>
                <th style={{ ...thStyle, ...stickyTopTh, minWidth: 110 }}>Kode</th>
                <th style={{ ...thStyle, ...stickyTopTh, width: 120, textAlign: 'right' }}>
                  Total Outlet
                </th>
                {branchColumns.map((b) => (
                  <th
                    key={b.id}
                    style={{ ...thStyle, ...stickyTopTh, minWidth: 130, textAlign: 'right' }}
                    title={b.code ? `${b.label} (${b.code})` : b.label}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                      <span>{b.label}</span>
                      {b.code && (
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-subtle)', fontFamily: 'monospace' }}>
                          {b.code}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={fixedCols} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  <td
                    colSpan={fixedCols}
                    style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}
                  >
                    Gagal memuat data outlet stock
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={fixedCols}>
                    <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <LayoutGrid size={32} style={{ color: 'var(--foreground-subtle)' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        Tidak ada data outlet stock
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                items.map((item, idx) => {
                  const outletTotal = outletTotalOf(item)
                  return (
                    <tr key={item.id}>
                      <td
                        style={{
                          ...tdStyle,
                          ...stickyLeft(0, BODY_BG, Z_BODY_LEFT),
                          textAlign: 'center',
                          color: 'var(--foreground-muted)',
                          fontSize: 12,
                        }}
                      >
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td style={{ ...tdStyle, ...stickyLeft(44, BODY_BG, Z_BODY_LEFT), fontWeight: 500 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{item.product?.name ?? '—'}</span>
                          {item.product?.code && (
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                              {item.product.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{item.name ?? '—'}</span>
                          {item.code && (
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', fontFamily: 'monospace' }}>
                              {item.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
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
                      <td
                        style={{
                          ...tdStyle,
                          ...numStyle,
                          fontWeight: 600,
                          color: outletTotal == null ? 'var(--foreground-subtle)' : 'var(--foreground)',
                        }}
                      >
                        {formatQty(outletTotal, !canRead)}
                      </td>
                      {branchColumns.map((b) => {
                        const val = branchStockOf(item, b.id)
                        return (
                          <td
                            key={b.id}
                            style={{
                              ...tdStyle,
                              ...numStyle,
                              color: val == null ? 'var(--foreground-subtle)' : 'var(--foreground)',
                            }}
                          >
                            {formatQty(val, !canRead)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <CustomPagination
            page={page}
            setPage={setPage}
            perPage={perPage}
            setPerPage={setPerPage}
            meta={meta}
          />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .stock-scroll::-webkit-scrollbar {
          height: 12px;
        }
        .stock-scroll::-webkit-scrollbar-track {
          background: var(--background);
          border-top: 1px solid var(--border);
        }
        .stock-scroll::-webkit-scrollbar-thumb {
          background: var(--border-strong);
          border-radius: 99px;
          border: 3px solid var(--background);
        }
        .stock-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--foreground-muted);
        }
        .stock-scroll {
          scrollbar-color: var(--border-strong) var(--background);
          scrollbar-width: thin;
        }
      `}</style>
    </div>
  )
}
