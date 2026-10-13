'use client'
import { formatDateTime, parseApiDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { stockMovementsService } from '@/services/stock-movements.service'
import { productsService } from '@/services/products.service'
import { getProductUomName } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import StockMovementSheet from './StockMovementSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import SearchableSelect from '@/components/SearchableSelect'
import {
  formatSignedMovementQty,
  convertUp,
  type ConversionEntry,
  type UnitDisplayMode,
} from '@/utils/unitDisplay'
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react'

export interface StockMovement {
  id: number
  qty: number
  base_qty?: number
  base_uom_code?: string
  stock_before?: number
  stock_after?: number
  direction: 'in' | 'out'
  product_inventory_id?: number
  branch_id?: number
  description?: string
  created_at?: string
  reference_type?: string
  reference_id?: number | string
  reference_code?: string
  reference?: { code?: string }
  product_inventory?: {
    code?: string
    owner_ref?: string
    owner_display?: string
    owner_company_name?: string
    stage?: string
    location_ref?: string
    product_uom_batch?: {
      product_uom?: {
        product?: {
          name: string
          conversions?: {
            uom_name: string
            uom_code: string
            target_uom_name: string
            target_uom_code: string
            amount: number
          }[]
        }
        uom?: { name: string; code?: string }
      }
    }
    product_uom?: {
      product?: {
        name: string
        conversions?: {
          uom_name: string
          uom_code: string
          target_uom_name: string
          target_uom_code: string
          amount: number
        }[]
      }
      uom?: { name: string; code?: string }
    }
  }
}

// Verified against each module's own detail-route pattern (Productions/Deliveries/Receipts/SalesOrders/PurchaseOrders list views).
export const REFERENCE_ROUTES: Record<string, (id: number | string) => string> = {
  productions: (id) => `/production/${id}/detail`,
  deliveries: (id) => `/transfer/deliveries/${id}/detail`,
  receipts: (id) => `/transfer/receipts/${id}/detail`,
  sales_orders: (id) => `/sales/sales-orders/${id}/detail`,
  purchase_orders: (id) => `/purchase/purchase-orders/${id}/detail`,
}

export const REFERENCE_LABELS: Record<string, string> = {
  productions: 'Production',
  deliveries: 'Delivery',
  receipts: 'Receipt',
  sales_orders: 'Sales Order',
  purchase_orders: 'Purchase Order',
}

export const TYPE_META = {
  in: {
    label: 'Stock In',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    icon: TrendingUp,
  },
  out: {
    label: 'Stock Out',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
    icon: TrendingDown,
  },
}

// conversions.amount paling kecil = satuan terbesar.
// Tampilkan qty dengan uom_name dari conversion tersebut.
function getConversions(item: StockMovement): ConversionEntry[] | undefined {
  return (
    item.product_inventory?.product_uom_batch?.product_uom?.product?.conversions ??
    item.product_inventory?.product_uom?.product?.conversions ??
    undefined
  )
}

function getBaseUomCode(item: StockMovement): string {
  return (
    item.base_uom_code ??
    item.product_inventory?.product_uom_batch?.product_uom?.uom?.code ??
    item.product_inventory?.product_uom?.uom?.code ??
    ''
  )
}

export function formatMovementQty(
  item: StockMovement,
  mode: UnitDisplayMode = 'smallest',
): string {
  const qty = item.qty ?? 0
  const baseQty = item.base_qty ?? qty
  const baseUomCode = getBaseUomCode(item)
  const conversions = getConversions(item)
  return formatSignedMovementQty(baseQty, qty, baseUomCode, item.direction, conversions, mode)
}

// Return every conversion representation of the qty, ordered from
// largest unit → smallest (base) unit, e.g. [1 CRT, 6 PACK, 12 KG, 12000 GR].
export function getAllConversionQty(
  item: StockMovement,
): { qty: number; uomCode: string }[] {
  const qty = item.qty ?? 0
  const baseQty = item.base_qty ?? qty
  const baseUomCode = getBaseUomCode(item)
  const conversions = getConversions(item)

  const results: { qty: number; uomCode: string }[] = []

  if (!conversions || conversions.length === 0) {
    results.push({ qty: baseQty, uomCode: baseUomCode })
    return results
  }

  // Collect every unique uom_code reachable from the chain
  const seen = new Set<string>([baseUomCode])
  for (const c of conversions) {
    if (!seen.has(c.uom_code)) {
      seen.add(c.uom_code)
      const converted = convertUp(baseQty, baseUomCode, c.uom_code, conversions)
      if (converted != null) {
        results.push({ qty: converted, uomCode: c.uom_code })
      }
    }
    if (!seen.has(c.target_uom_code)) {
      seen.add(c.target_uom_code)
      const converted = convertUp(baseQty, baseUomCode, c.target_uom_code, conversions)
      if (converted != null) {
        results.push({ qty: converted, uomCode: c.target_uom_code })
      }
    }
  }

  // Selalu sertakan base unit (satuan terkecil) di akhir rantai
  results.push({ qty: baseQty, uomCode: baseUomCode })

  // Urutkan dari qty terkecil (unit terbesar) → qty terbesar (unit terkecil)
  results.sort((a, b) => a.qty - b.qty)

  return results
}

// Shared "Document" cell content: links to the source document's detail page
// via REFERENCE_ROUTES when resolvable, otherwise a plain (possibly
// truncated) label built from REFERENCE_LABELS.
// (Tetap di-export karena mungkin dipakai view lain — tidak diubah.)
export function MovementDocumentLink({ item }: { item: StockMovement }) {
  const refType = item.reference_type
  const refId = item.reference_id
  if (!refType) {
    return <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
  }
  const code = item.reference_code
  const label =
    code ||
    (refId != null
      ? `${REFERENCE_LABELS[refType] ?? refType.replace(/_/g, ' ')} #${refId}`
      : REFERENCE_LABELS[refType] ?? refType.replace(/_/g, ' '))
  const buildHref = REFERENCE_ROUTES[refType]
  const linkStyle: React.CSSProperties = {
    display: 'inline-block',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'bottom',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
    textDecoration: 'none',
  }
  if (buildHref && refId != null) {
    return (
      <Link href={buildHref(refId)} title={label} style={linkStyle}>
        {label}
      </Link>
    )
  }
  return (
    <span
      title={label}
      style={{ ...linkStyle, color: 'var(--foreground)', fontWeight: 400 }}
    >
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Komponen tampilan baru (khusus view ini)                            */
/* ------------------------------------------------------------------ */

const fmtNum = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 4 })

// Dokumen: label jenis dokumen (kecil) + kode dokumen (link, tidak dipotong).
function DocumentCell({ item }: { item: StockMovement }) {
  const refType = item.reference_type
  const refId = item.reference_id
  if (!refType) {
    return <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
  }
  const typeLabel = REFERENCE_LABELS[refType] ?? refType.replace(/_/g, ' ')
  const code = item.reference_code || item.reference?.code
  const label = code || (refId != null ? `#${refId}` : '—')
  const buildHref = REFERENCE_ROUTES[refType]
  const codeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    wordBreak: 'break-all',
    lineHeight: 1.35,
    textDecoration: 'none',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{typeLabel}</span>
      {typeof buildHref === 'function' && refId != null ? (
        <Link href={buildHref(refId)} title={label} style={{ ...codeStyle, color: 'var(--accent)' }}>
          {label}
        </Link>
      ) : (
        <span title={label} style={{ ...codeStyle, color: 'var(--foreground)', fontWeight: 400 }}>
          {label}
        </span>
      )}
    </div>
  )
}

// Qty: ikon arah + rantai konversi satu baris, mis. +3PACK=0,5CRT=6KG=6000GR
function QtyCell({ item }: { item: StockMovement }) {
  const meta = TYPE_META[item.direction as keyof typeof TYPE_META] ?? TYPE_META['in']
  const Icon = meta.icon
  const chain = getAllConversionQty(item)
  const sign = item.direction === 'out' ? '−' : '+'
  const chainText = chain.map((c) => `${fmtNum(c.qty)}${c.uomCode}`).join('=')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        title={meta.label}
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 6,
          background: meta.bg,
          color: meta.color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={12} />
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
        }}
      >
        {sign}{chainText}
      </span>
    </div>
  )
}

// Tanggal di baris atas, jam di baris bawah.
function DateCell({ value }: { value?: string }) {
  if (!value) return <span>—</span>
  const formatted = formatDateTime(value)
  const [datePart, timePart] = String(formatted).split(', ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{datePart}</span>
      {timePart && (
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{timePart}</span>
      )}
    </div>
  )
}

const controlBase: React.CSSProperties = {
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const DIRECTION_TABS: { value: '' | 'in' | 'out'; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'in', label: 'Masuk' },
  { value: 'out', label: 'Keluar' },
]

export default function StockMovementView() {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const canRead = hasPermission("stock-movement.read");
  const canCreate = hasPermission('stock-movement.create')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [directionFilter, setDirectionFilter] = useState<'' | 'in' | 'out'>('')
  const [productId, setProductId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  // Branch type menentukan kolom dimensi (owner/stage/location):
  // warehouse & production menyembunyikannya.
  const branchType = ((user as any)?.branch?.type as string | undefined) ?? ''
  const hideDimensionCols = branchType.toLowerCase() === 'warehouse' || branchType.toLowerCase() === 'production'
  // Tanggal, Dokumen, Produk, Cabang, (Inventori), Qty
  const totalCols = hideDimensionCols ? 5 : 6

  useEffect(() => {
    if (!router.isReady) return
    const qp = router.query
    if (qp.product_id) setProductId(Number(qp.product_id) || 0)
    if (qp.start_date) setStartDate(String(qp.start_date))
    if (qp.end_date) setEndDate(String(qp.end_date))
  }, [router.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      setProductSearchDebounced(productSearch)
    }, 400)
    return () => clearTimeout(timer)
  }, [productSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, directionFilter, productId, startDate, endDate])

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['stock-movements-product-search', productSearchDebounced],
    enabled: productSearchDebounced.length >= 2,
    queryFn: () =>
      productsService
        .list({ per_page: 50, sort: 'name', 'filter[search]': productSearchDebounced } as any)
        .then((r) => r.data),
  })
  const productOptions = [
    { value: 0, label: 'Semua Produk' },
    ...((productsData as any)?.data ?? []).map((p: any) => ({
      value: p.id as number,
      label: (p.name as string) ?? `Product #${p.id}`,
      sublabel: p.code as string | undefined,
    })),
  ]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-movements', page, perPage, debouncedSearch, directionFilter, productId],
    queryFn: () =>
      stockMovementsService
        .list({
          page,
          per_page: perPage,
          sort: '-id',
          'filter[search]': debouncedSearch || undefined,
          'filter[direction]': directionFilter || undefined,
          'filter[product_id]': productId || undefined,
          include:
            'branch,product_inventory,' +
            'product_inventory.product_uom_batch,' +
            'product_inventory.product_uom_batch.product_uom,' +
            'product_inventory.product_uom_batch.product_uom.product,' +
            'product_inventory.product_uom_batch.product_uom.uom',
        })
        .then((r) => r.data),
  })

  const items: StockMovement[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Client-side date filter — backend /v1/stock-movements doesn't support
  // filter[start_date]/filter[end_date], so we narrow the already-fetched page.
  const filteredItems = items.filter((item) => {
    if (!startDate && !endDate) return true
    const d = parseApiDate(item.created_at)
    if (!d) return true
    if (startDate && d < new Date(startDate + 'T00:00:00')) return false
    if (endDate && d > new Date(endDate + 'T23:59:59')) return false
    return true
  })

  const columns: { label: string; width?: number }[] = [
    { label: 'Tanggal', width: 130 },
    { label: 'Dokumen', width: 230 },
    { label: 'Produk' },
    { label: 'Cabang', width: 170 },
    ...(hideDimensionCols ? [] : [{ label: 'Owner / Stage / Lokasi', width: 170 }]),
    { label: 'Qty', width: 260 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            Stock Movements
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            {startDate || endDate
              ? `Filter tanggal: ${startDate || '...'} s/d ${endDate || '...'}`
              : 'Riwayat semua pergerakan stok'}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setSheetOpen(true)}
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
            }}
          >
            <Plus size={15} />
            Record Movement
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
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
            placeholder="Cari pergerakan..."
            style={{ ...controlBase, width: '100%', padding: '0 10px 0 32px' }}
          />
        </div>

        {/* Direction filter: segmented control */}
        <div
          role="tablist"
          style={{
            display: 'inline-flex',
            padding: 3,
            gap: 2,
            height: 36,
            boxSizing: 'border-box',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--background)',
          }}
        >
          {DIRECTION_TABS.map((t) => {
            const active = directionFilter === t.value
            return (
              <button
                key={t.value || 'all'}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setDirectionFilter(t.value)
                  setPage(1)
                }}
                style={{
                  padding: '0 14px',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  background: active ? 'var(--surface-raised)' : 'transparent',
                  color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Date range (client-side), satu kelompok */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Dari tanggal"
            style={{ ...controlBase, padding: '0 10px' }}
          />
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="Sampai tanggal"
            style={{ ...controlBase, padding: '0 10px' }}
          />
        </div>

        {/* Product filter */}
        <div style={{ width: 240 }}>
          <SearchableSelect
            value={productId}
            onChange={(val) => setProductId(Number(val))}
            options={productOptions}
            placeholder="Semua Produk"
            searchPlaceholder="Ketik minimal 2 huruf untuk mencari..."
            loading={productsLoading}
            onSearchChange={setProductSearch}
          />
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                {columns.map(({ label, width }, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
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
                  <td colSpan={totalCols} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                    colSpan={totalCols}
                    style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}
                  >
                    Gagal memuat data stock movements
                  </td>
                </tr>
              )}

              {!isLoading && !isError && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={totalCols}>
                    <div
                      style={{
                        padding: 48,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <ArrowUpDown size={32} style={{ color: 'var(--foreground-subtle)' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        Belum ada pergerakan stok yang sesuai filter
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                filteredItems.map((item: any) => {
                  const uomCode =
                    item.product_inventory?.product_uom_batch?.product_uom?.uom?.code ??
                    item.product_inventory?.product_uom?.uom?.code
                  const productName =
                    getProductUomName(
                      item.product_inventory?.product_uom_batch?.product_uom ??
                        item.product_inventory?.product_uom,
                      item.product_inventory?.product_uom_batch?.product_uom?.product?.name ??
                        item.product_inventory?.product_uom?.product?.name,
                    ) ||
                    item.product_inventory?.code ||
                    `INV-${item.product_inventory_id ?? '?'}`
                  const dims = [
                    item.product_inventory?.owner_ref,
                    item.product_inventory?.stage,
                    item.product_inventory?.location_ref,
                  ].filter(Boolean)

                  return (
                    <tr
                      key={item.id}
                      onMouseEnter={() => setHoveredRow(item.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                        verticalAlign: 'top',
                      }}
                    >
                      {/* Tanggal */}
                      <td style={{ padding: '14px 16px' }}>
                        {canRead ? <DateCell value={item.created_at} /> : '***'}
                      </td>

                      {/* Dokumen */}
                      <td style={{ padding: '14px 16px' }}>
                        <DocumentCell item={item} />
                      </td>

                      {/* Produk (+ catatan jika ada) */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--foreground)' }}>
                          {productName}
                        </div>
                        {(item.product_inventory?.code || uomCode) && (
                          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                            {[item.product_inventory?.code, uomCode].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {canRead && item.description && (
                          <div
                            title={item.description}
                            style={{
                              marginTop: 6,
                              fontSize: 12,
                              color: 'var(--foreground-muted)',
                              fontStyle: 'italic',
                              maxWidth: 360,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>

                      {/* Cabang */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--foreground)' }}>
                        {canRead ? item.branch?.name ?? item.branch_id ?? '—' : '***'}
                      </td>

                      {/* Owner / Stage / Lokasi */}
                      {!hideDimensionCols && (
                        <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                          {canRead ? (dims.length ? dims.join(' · ') : '—') : '***'}
                        </td>
                      )}

                      {/* Qty */}
                      <td style={{ padding: '14px 16px' }}>
                        <QtyCell item={item} />
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {/* Sheet */}
      <StockMovementSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
