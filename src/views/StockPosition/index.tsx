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
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { ListParams } from '@/types/api'
import { Download, LayoutGrid, Search } from 'lucide-react'

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
  return (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

/** Angka mentah untuk sel Excel (null → sel kosong). */
function excelQty(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Number(n)
}

type BranchColumn = { id: number; label: string; type?: string }

/** Union semua branch yang muncul pada baris yang diberikan, urut nama. */
function collectBranchColumns(rows: StockPositionItem[]): BranchColumn[] {
  const map = new Map<number, BranchColumn>()
  for (const item of rows) {
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
}

function branchStockAt(item: StockPositionItem, branchId: number): number | null {
  const found = (item.total_in_branches ?? []).find((b) => b.id === branchId)
  return found && found.total_stock != null ? found.total_stock : null
}

// ── Sticky table helpers ─────────────────────────────────────────────────────
// The matrix scrolls on BOTH axes inside its scroll box:
//   • <thead> sticks to the top     → branch names stay visible while scrolling rows
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

const stickyLeft = (left: number, background: string, z: number): React.CSSProperties => ({
  position: 'sticky',
  left,
  zIndex: z,
  background,
  borderRight: '1px solid var(--border)',
})

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
  // Filter tipe produk (multiple) → filter[product_types] (dipisah koma).
  const [productTypeFilter, setProductTypeFilter] = useState<(number | string)[]>([])

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
  }, [debouncedSearch, productId, startDate, endDate, productTypeFilter])

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

  // Opsi tipe produk: enum ProductType, dibatasi tipe yang dipakai company aktif
  // (company.product_types null = semua tipe).
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
  // Kosong = semua tipe company (perilaku lama), terpilih = pilihan user.
  const productTypesParam =
    productTypeFilter.length > 0 ? productTypeFilter.join(',') : activeProductTypes

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'stock-position',
      page,
      perPage,
      debouncedSearch,
      productId,
      startDate,
      endDate,
      productTypesParam,
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
          'filter[product_types]': productTypesParam,
        } as any)
        .then((r) => r.data),
  })

  const items: StockPositionItem[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Union of every branch that appears on the current page, sorted by name.
  const branchColumns = useMemo(() => collectBranchColumns(items), [items])

  const branchStockOf = (item: StockPositionItem, branchId: number): number | null =>
    branchStockAt(item, branchId)

  // ── Export Excel (dikerjakan penuh di frontend dengan paket `xlsx`) ──────
  // Semua baris dengan filter yang sama diambil dulu (bukan cuma halaman ini)
  // supaya hasil ekspor lengkap, lalu matriks cabangnya dibangun dari data itu.
  const [isExporting, setIsExporting] = useState(false)

  const buildExportParams = (): ListParams => ({
    sort: 'name:product_uoms.name',
    include: 'product,uom',
    'filter[search]': debouncedSearch || undefined,
    'filter[product_id]': productId > 0 ? productId : undefined,
    'filter[start_date]': startDate,
    'filter[end_date]': endDate,
    'filter[product_types]': productTypesParam || undefined,
  })

  const fetchAllRows = async (): Promise<StockPositionItem[]> => {
    const pageSize = 1000
    const all: StockPositionItem[] = []
    // Guard: jangan muter tak terbatas kalau backend mengembalikan meta aneh.
    const maxPages = 50
    for (let page = 1; page <= maxPages; page++) {
      const res = await productUomsService
        .stockPosition({ ...buildExportParams(), page, per_page: pageSize })
        .then((r) => r.data)
      all.push(...((res?.data?.data as StockPositionItem[] | undefined) ?? []))
      const info = res?.data?.meta as
        | { last_page?: number; total_pages?: number }
        | undefined
      const totalPages = Number(info?.last_page ?? info?.total_pages ?? 1)
      if (page >= totalPages) break
    }
    return all
  }

  const handleExport = async () => {
    if (!hasDateRange || isExporting) return
    if (!canRead) {
      toast.error('Anda tidak punya akses untuk mengekspor data ini')
      return
    }
    setIsExporting(true)
    try {
      const rows = await fetchAllRows()
      if (rows.length === 0) {
        toast.error('Tidak ada data untuk diekspor')
        return
      }
      const branchCols = collectBranchColumns(rows)
      const header: (string | number)[] = [
        '#',
        'Produk',
        'Kode Produk',
        'UOM',
        'Kode UOM',
        'PO Masuk',
        'Dikirim',
        'Diterima',
        ...branchCols.map((b) => (b.type ? `${b.label} (${b.type})` : b.label)),
      ]
      const body = rows.map((item, idx) => [
        idx + 1,
        item.product?.name ?? '',
        item.product?.code ?? '',
        item.name ?? '',
        item.code ?? '',
        excelQty(item.total_incoming_po),
        excelQty(item.total_delivered),
        excelQty(item.total_received),
        ...branchCols.map((b) => excelQty(branchStockAt(item, b.id))),
      ])
      const ws = XLSX.utils.aoa_to_sheet([header, ...body])
      ws['!cols'] = [
        { wch: 6 },
        { wch: 34 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        ...branchCols.map(() => ({ wch: 18 })),
      ]
      const wb = XLSX.utils.book_new()
      // Nama sheet tidak boleh memuat karakter terlarang ('/' dll).
      XLSX.utils.book_append_sheet(wb, ws, 'SR-DN-Outlet')
      XLSX.writeFile(wb, `stock-position_${startDate}_${endDate}.xlsx`)
      toast.success('Export downloaded successfully')
    } catch {
      toast.error('Gagal mengekspor data')
    } finally {
      setIsExporting(false)
    }
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

        {/* Export Excel — dibangun di frontend dari data yang sudah difilter */}
        <button
          onClick={handleExport}
          disabled={!hasDateRange || isExporting}
          title={
            hasDateRange
              ? 'Ekspor seluruh data sesuai filter ke Excel'
              : 'Isi rentang tanggal terlebih dahulu'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            opacity: hasDateRange && !isExporting && canRead ? 1 : 0.6,
            cursor: hasDateRange && !isExporting && canRead ? 'pointer' : 'not-allowed',
          }}
        >
          <Download size={14} />
          {isExporting ? 'Exporting...' : 'Export Excel'}
        </button>
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
        {/* Fixed-height scroll box so the header can stick to the top while the
            body scrolls vertically, and the whole matrix still scrolls
            horizontally. The .stock-scroll class renders a prominent,
            always-visible horizontal scrollbar so users can pan branches
            left/right. */}
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
                  <td colSpan={7 + branchColumns.length} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  <td colSpan={7 + branchColumns.length} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                    Gagal memuat data stock position
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={7 + branchColumns.length}>
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
