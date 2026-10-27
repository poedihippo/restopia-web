'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productUomsService } from '@/services/product-uoms.service'
import { productsService } from '@/services/products.service'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { withProductType } from '@/utils/productUomName'
import { LayoutGrid, Search } from 'lucide-react'

interface BranchStock {
  id: number
  code?: string
  name?: string
  type?: string
  total_stock?: number
}

interface StockPositionItem {
  id: number
  code?: string
  name?: string
  product_id: number
  uom_id: number
  stock?: number
  total_incoming_po?: number
  total_delivered?: number
  total_received?: number
  total_in_branches?: BranchStock[]
  product?: { id: number; name: string; code?: string; type?: string }
  uom?: { id: number; name: string; code?: string }
}

const getToday = () => new Date().toISOString().slice(0, 10)

const getMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatQty(n: number | null | undefined, mask = false): string {
  if (mask) return '***'
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 })
}

// ── Sticky table helpers ─────────────────────────────────────────────────────
// The matrix scrolls on BOTH axes inside its scroll box:
//   • <thead> sticks to the top     → branch names stay visible while scrolling rows
//   • <tfoot> sticks to the bottom  → per-branch totals stay visible (also labels each column)
//   • product-identity columns stick to the left → know which product while scrolling branches
// Corner cells (sticky on two axes) get the highest z-index so a single-axis
// cell can never paint over them.
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

const stickyBottomTf: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
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

const tfStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderTop: '1px solid var(--border)',
  verticalAlign: 'middle',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--foreground)',
}

// Opaque accent tint. `--accent-light-bg` is rgba(...,0.12) — translucent, so on
// a sticky header/footer cell the rows beneath bleed through and look broken.
// Layering the tint over a solid base via a gradient makes the cell opaque
// while keeping the same accent look, and still uses only CSS variables.
const ACCENT_CELL_BG =
  'linear-gradient(var(--accent-light-bg), var(--accent-light-bg)), var(--surface-raised)'

export default function StockPositionView() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('stock-movement.read') || hasPermission('product-inventory.read')
  const activeProductTypes = useActiveBranchProductTypes()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productId, setProductId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [startDate, setStartDate] = useState(getMonthStart)
  const [endDate, setEndDate] = useState(getToday)
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
  }, [debouncedSearch, productId, startDate, endDate])

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['stock-position-product-search', productSearchDebounced],
    enabled: productSearchDebounced.length >= 2,
    queryFn: () =>
      productsService
        .list({ per_page: 50, sort: 'name', 'filter[search]': productSearchDebounced } as any)
        .then((r) => r.data),
  })
  const products: any[] = (productsData as any)?.data ?? []
  const productOptions = [
    { value: 0, label: 'Semua Produk' },
    ...products.map((p: any) => ({
      value: p.id as number,
      label: withProductType((p.name as string) ?? `Product #${p.id}`, p.type),
      sublabel: p.code as string | undefined,
    })),
  ]

  const hasDateRange = !!startDate && !!endDate

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'stock-position',
      page,
      perPage,
      debouncedSearch,
      productId,
      startDate,
      endDate,
      activeProductTypes,
    ],
    enabled: hasDateRange,
    queryFn: () =>
      productUomsService
        .stockPosition({
          page,
          per_page: perPage,
          sort: 'name:product_uoms.name',
          include: 'product,uom',
          'filter[search]': debouncedSearch || undefined,
          'filter[product_id]': productId > 0 ? productId : undefined,
          'filter[start_date]': startDate,
          'filter[end_date]': endDate,
          'filter[product_types]': activeProductTypes,
        } as any)
        .then((r) => r.data),
  })

  const items: StockPositionItem[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Union of every branch that appears on the current page, sorted by name.
  const branchColumns = useMemo(() => {
    const map = new Map<number, { id: number; label: string; type?: string }>()
    for (const item of items) {
      for (const b of item.total_in_branches ?? []) {
        if (!map.has(b.id)) {
          map.set(b.id, {
            id: b.id,
            label: b.name || b.code || `Branch #${b.id}`,
            type: b.type,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const branchStockOf = (item: StockPositionItem, branchId: number): number | null => {
    const found = (item.total_in_branches ?? []).find((b) => b.id === branchId)
    return found && found.total_stock != null ? found.total_stock : null
  }

  const totalAcrossBranches = (item: StockPositionItem): number | null => {
    const list = item.total_in_branches ?? []
    if (list.length === 0) return null
    return list.reduce((s, b) => s + (Number(b.total_stock) || 0), 0)
  }

  // Column totals shown in the frozen footer. Aggregate columns sum their own
  // value; each branch column sums that branch's stock across visible rows.
  const totals = useMemo(() => {
    let incoming = 0
    let delivered = 0
    let received = 0
    let stock = 0
    const perBranch = new Map<number, number>()
    for (const item of items) {
      incoming += Number(item.total_incoming_po) || 0
      delivered += Number(item.total_delivered) || 0
      received += Number(item.total_received) || 0
      const rowTotal = totalAcrossBranches(item)
      stock += Number(rowTotal ?? item.stock) || 0
      for (const b of item.total_in_branches ?? []) {
        perBranch.set(b.id, (perBranch.get(b.id) ?? 0) + (Number(b.total_stock) || 0))
      }
    }
    return { incoming, delivered, received, stock, perBranch }
  }, [items])

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

  return (
    <div style={{ padding: '32px 32px 64px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            Stock Position
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Sebaran stok product UOM per cabang pada rentang tanggal tertentu
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
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <label style={labelStyle}>Cari</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
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
          <label style={labelStyle}>Dari Tanggal <span style={{ color: 'var(--destructive)' }}>*</span></label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Sampai Tanggal <span style={{ color: 'var(--destructive)' }}>*</span></label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {!hasDateRange && (
        <div style={{ fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Rentang tanggal wajib diisi (Dari Tanggal & Sampai Tanggal) untuk memuat data.
        </div>
      )}

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
        {/* Fixed-height scroll box so the header can stick to the top and the
            totals footer to the bottom while the body scrolls vertically, and
            the whole matrix still scrolls horizontally. The .stock-scroll class
            renders a prominent, always-visible horizontal scrollbar right below
            the frozen footer so users can pan branches left/right. */}
        <div className="stock-scroll" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                {/* Corner cells (sticky top + left) get the highest z-index */}
                <th style={{ ...thStyle, ...stickyTopTh, ...stickyLeft(0, HEAD_BG, Z_CORNER), width: 44, textAlign: 'center' }}>#</th>
                <th style={{ ...thStyle, ...stickyTopTh, ...stickyLeft(44, HEAD_BG, Z_CORNER), minWidth: 200 }}>Produk</th>
                <th style={{ ...thStyle, ...stickyTopTh, minWidth: 140 }}>UOM</th>
                <th style={{ ...thStyle, ...stickyTopTh, minWidth: 110 }}>Kode</th>
                <th style={{ ...thStyle, ...stickyTopTh, width: 90, textAlign: 'right' }}>PO Masuk</th>
                <th style={{ ...thStyle, ...stickyTopTh, width: 90, textAlign: 'right' }}>Dikirim</th>
                <th style={{ ...thStyle, ...stickyTopTh, width: 90, textAlign: 'right' }}>Diterima</th>
                <th style={{ ...thStyle, ...stickyTopTh, width: 100, textAlign: 'right', background: ACCENT_CELL_BG, color: 'var(--accent)' }}>Total Stok</th>
                {branchColumns.map((b) => (
                  <th
                    key={b.id}
                    style={{ ...thStyle, ...stickyTopTh, minWidth: 110, textAlign: 'right' }}
                    title={b.type ? `${b.label} (${b.type})` : b.label}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                      <span>{b.label}</span>
                      {b.type && (
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-subtle)', textTransform: 'capitalize' }}>
                          {b.type}
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
                  <td colSpan={8 + branchColumns.length} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  <td colSpan={8 + branchColumns.length} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                    Gagal memuat data stock position
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={8 + branchColumns.length}>
                    <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <LayoutGrid size={32} style={{ color: 'var(--foreground-subtle)' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        Tidak ada data stock position
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                items.map((item, idx) => {
                  const rowTotal = totalAcrossBranches(item)
                  return (
                    <tr key={item.id}>
                      <td style={{ ...tdStyle, ...stickyLeft(0, BODY_BG, Z_BODY_LEFT), textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 12 }}>
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
                      <td style={{ ...tdStyle, ...numStyle, color: 'var(--foreground-muted)' }}>
                        {formatQty(item.total_incoming_po, !canRead)}
                      </td>
                      <td style={{ ...tdStyle, ...numStyle, color: 'var(--foreground-muted)' }}>
                        {formatQty(item.total_delivered, !canRead)}
                      </td>
                      <td style={{ ...tdStyle, ...numStyle, color: 'var(--foreground-muted)' }}>
                        {formatQty(item.total_received, !canRead)}
                      </td>
                      <td style={{ ...tdStyle, ...numStyle, fontWeight: 600, background: 'var(--accent-light-bg)', color: 'var(--accent)' }}>
                        {formatQty(rowTotal ?? item.stock, !canRead)}
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
            {/* Frozen totals footer — sticks to the bottom of the scroll box so
                branch totals stay visible while scrolling long lists. */}
            <tfoot>
              <tr>
                <td style={{ ...tfStyle, ...stickyBottomTf, ...stickyLeft(0, HEAD_BG, Z_CORNER), textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 12 }}>
                  Σ
                </td>
                <td style={{ ...tfStyle, ...stickyBottomTf, ...stickyLeft(44, HEAD_BG, Z_CORNER) }}>
                  Total ({items.length} product UOM)
                </td>
                <td style={{ ...tfStyle, ...stickyBottomTf }} />
                <td style={{ ...tfStyle, ...stickyBottomTf }} />
                <td style={{ ...tfStyle, ...stickyBottomTf, ...numStyle, color: 'var(--foreground-muted)' }}>
                  {formatQty(totals.incoming, !canRead)}
                </td>
                <td style={{ ...tfStyle, ...stickyBottomTf, ...numStyle, color: 'var(--foreground-muted)' }}>
                  {formatQty(totals.delivered, !canRead)}
                </td>
                <td style={{ ...tfStyle, ...stickyBottomTf, ...numStyle, color: 'var(--foreground-muted)' }}>
                  {formatQty(totals.received, !canRead)}
                </td>
                <td style={{ ...tfStyle, ...stickyBottomTf, ...numStyle, background: ACCENT_CELL_BG, color: 'var(--accent)' }}>
                  {formatQty(totals.stock, !canRead)}
                </td>
                {branchColumns.map((b) => (
                  <td
                    key={b.id}
                    style={{ ...tfStyle, ...stickyBottomTf, ...numStyle }}
                  >
                    {formatQty(totals.perBranch.get(b.id) ?? 0, !canRead)}
                  </td>
                ))}
              </tr>
            </tfoot>
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
        /* Prominent, always-visible horizontal scrollbar below the frozen footer
           so the branch columns can be panned left/right. */
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
