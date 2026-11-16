'use client'
import { formatDateTime, parseApiDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { deliveriesService } from '@/services/deliveries.service'
import { stockMovementsService } from '@/services/stock-movements.service'
import { productsService } from '@/services/products.service'
import { branchesService } from '@/services/branches.service'
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import StockMovementSheet from './StockMovementSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import {
  formatSignedMovementQty,
  convertUp,
  type ConversionEntry,
  type UnitDisplayMode,
} from '@/utils/unitDisplay'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpDown, ArrowUpRight,
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
    batch_code?: string
    product_uom_batch?: {
      batch_code?: string
      product_uom?: {
        product?: {
          name: string
          type?: string
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
        type?: string
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
        <span className="v2-link">{label}<ArrowUpRight size={12} /></span>
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

const fmtNum = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })

// Rantai konversi dirapikan dengan spasi, mis. "5 CRT = 100 KG = 100.000 GR"
function buildChainText(item: StockMovement): string {
  return getAllConversionQty(item)
    .map((c) => `${fmtNum(c.qty)} ${c.uomCode}`.trim())
    .join(' = ')
}

// Batch: kode batch + dimensi inventori (owner/stage/lokasi) dalam SATU kolom.
function BatchCell({ item }: { item: StockMovement }) {
  const inv = item.product_inventory
  const batchCode =
    inv?.product_uom_batch?.batch_code ?? inv?.batch_code ?? inv?.code ?? ''
  const dims = [
    inv?.owner_ref ? `Owner: ${inv.owner_ref}` : '',
    inv?.stage ? `Stage: ${inv.stage}` : '',
    inv?.location_ref ? `Loc: ${inv.location_ref}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: batchCode ? 'var(--foreground)' : 'var(--foreground-subtle)',
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}
      >
        {batchCode || '—'}
      </span>
      {dims && (
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{dims}</span>
      )}
    </div>
  )
}

// Kolom In / Out: hanya satu yang terisi sesuai arah pergerakan,
// dengan latar lembut (hijau untuk In, merah muda untuk Out) —
// tanpa ikon. Kolom Out diberi tanda minus.
function MovementChainCell({
  item,
  direction,
}: {
  item: StockMovement
  direction: 'in' | 'out'
}) {
  if (item.direction !== direction) {
    return <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
  }
  const bg =
    direction === 'in' ? 'var(--success-bg)' : 'var(--destructive-bg)'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 'var(--radius-sm)',
        background: bg,
        fontSize: 13,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--foreground)',
        whiteSpace: 'nowrap',
      }}
    >
      {direction === 'out' ? '−' : ''}
      {buildChainText(item)}
    </span>
  )
}

// Nilai stok dari response API (stock_before / stock_after), tampil dalam
// satuan baris (uom dasar produk inventori). Null → dash.
function StockValueCell({
  value,
  uomCode,
  color,
}: {
  value?: number
  uomCode?: string
  color?: string
}) {
  if (value == null) {
    return <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'var(--foreground)',
        }}
      >
        {fmtNum(value)}
      </span>
      {uomCode && (
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{uomCode}</span>
      )}
    </div>
  )
}

// Satu kolom "Tanggal / Dokumen":
//   29 Okt 2026 13:29
//   0087/KR/10/2026        (link ke dokumen sumber)
function DateTimeDocCell({ item, subtitle }: { item: StockMovement; subtitle?: string }) {
  const formatted = item.created_at ? String(formatDateTime(item.created_at)) : ''
  const [datePart, timePart] = formatted ? formatted.split(', ') : []
  // id-ID memisahkan jam dengan titik ("13.29") — tampilkan dengan ":".
  const when = datePart ? (timePart ? `${datePart} ${timePart.replace(/\./g, ':')}` : datePart) : '—'

  const refType = item.reference_type
  const refId = item.reference_id
  const code = item.reference_code || item.reference?.code
  // No code on the source document: still link it, without printing its id.
  const label = code || (refId != null ? 'Go to reference' : '')
  const buildHref = refType ? REFERENCE_ROUTES[refType] : undefined
  const docStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.35,
    wordBreak: 'break-all',
    textDecoration: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{when}</span>
      {!label ? (
        <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
      ) : typeof buildHref === 'function' && refId != null ? (
        <Link href={buildHref(refId)} title={label} style={{ ...docStyle, color: 'var(--accent)' }}>
          <span className="v2-link">{label}<ArrowUpRight size={12} /></span>
        </Link>
      ) : (
        <span title={label} style={{ ...docStyle, color: 'var(--foreground-muted)', fontWeight: 400 }}>
          {label}
        </span>
      )}
      {subtitle && (
        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{subtitle}</span>
      )}
    </div>
  )
}

// Sel pemisah baris. Karena tabel memakai borderCollapse: separate,
// garis pemisah harus menempel di <td>, bukan di <tr>.
const cellBase: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
}

const DIRECTION_TABS: { value: '' | 'in' | 'out'; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'in', label: 'Masuk' },
  { value: 'out', label: 'Keluar' },
]

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  raw: 'Raw Material',
  wip: 'WIP',
  final: 'Finish Good',
  supply: 'Supplies',
}

// Opsi filter jenis dokumen sumber (untuk filter reference_type di API).
// Nilai mengikuti enum StockMovementReferenceType (GET /v1/enums) —
// 'purchase_orders' bukan reference_type yang valid, jadi tidak ditawarkan.
const REFERENCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Dokumen' },
  { value: 'productions', label: 'Production' },
  { value: 'deliveries', label: 'Delivery' },
  { value: 'receipts', label: 'Receipt' },
  { value: 'sales_orders', label: 'Sales Order' },
  { value: 'stock_movements', label: 'Stock Movement' },
  { value: 'dimension_transfer', label: 'Dimension Transfer' },
  { value: 'stock_opnames', label: 'Stock Opname' },
  { value: 'conversions', label: 'Conversion' },
  { value: 'portionings', label: 'Portioning' },
  { value: 'stock_reversals', label: 'Stock Reversal' },
  { value: 'stock_cutover', label: 'Stock Cutover' },
]

export default function StockMovementView() {
  const router = useRouter()
  const { hasPermission, isSuperadmin, user } = useAuth()
  const canRead = hasPermission("stock-movement.read");
  const canCreate = hasPermission('stock-movement.create')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [directionFilter, setDirectionFilter] = useState<'' | 'in' | 'out'>('')
  // Filter jenis dokumen sumber (Production/Delivery/Receipt/…) — dipakai
  // terutama di menu Stock Movements Raw & WIP.
  const [refTypeFilter, setRefTypeFilter] = useState('')
  const [productId, setProductId] = useState<number>(0)
  // Set only from the URL (Stock → "Show Stock Movement"): one inventory row / batch.
  const [productInventoryId, setProductInventoryId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Filter tipe produk — dipakai menu "Stock Movements Raw"/"WIP".
  // Backend belum punya filter[product_types]; parameter sudah dikirim dari FE.
  const [productTypes, setProductTypes] = useState('')
  // Single product type (filter[product_type]) — only offered when the menu
  // hasn't already pinned filter[product_types] via the URL.
  const [productTypeFilter, setProductTypeFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  // No., Tanggal/Dokumen, Produk, Batch, In, Out, Balance
  // (kolom dimensi Owner/Stage/Lokasi digabung ke dalam kolom Batch)
  const totalCols = 7

  useEffect(() => {
    if (!router.isReady) return
    const qp = router.query
    // Sinkronkan filter dari URL setiap kali path/query berubah — supaya
    // pindah antar menu (mis. Stock Movements → Stock Movements Raw)
    // tanpa reload halaman tetap terbaca. Filter yang hanya diatur lewat UI
    // tidak tersentuh karena URL-nya tidak berubah.
    if (qp.start_date) setStartDate(String(qp.start_date))
    if (qp.end_date) setEndDate(String(qp.end_date))
    setProductId(qp.product_id ? Number(qp.product_id) || 0 : 0)
    setProductInventoryId(qp.product_inventory_id ? Number(qp.product_inventory_id) || 0 : 0)
    const types = qp.product_types ?? qp.type
    setProductTypes(types ? String(types) : '')
  }, [router.isReady, router.asPath]) // eslint-disable-line react-hooks/exhaustive-deps  react-hooks/set-state-in-effect

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
  }, [debouncedSearch, directionFilter, refTypeFilter, productId, productInventoryId, startDate, endDate, productTypeFilter, branchFilter])

  // Branch filter options: superadmin sees every branch, other users only
  // the branches they're assigned to (filter hidden for single-branch users).
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'basic'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
    enabled: !!isSuperadmin,
  })
  const availableBranches: any[] = isSuperadmin
    ? (branchesData as any)?.data ?? []
    : (user as any)?.branches ?? []
  const showBranchFilter = !!isSuperadmin || availableBranches.length > 1

  const productsOpts = useInfiniteOptions<any>({
    queryKey: ['stock-movements-product-search', productSearchDebounced],
    enabled: productSearchDebounced.length >= 2,
    fetchPage: (page) =>
      productsService
        .list({ page, per_page: 50, sort: 'name', 'filter[search]': productSearchDebounced } as any)
        .then((r) => r.data),
  })
  // Product terpilih lewat URL (tombol "Show Stock Movement" di Product
  // Inventory) belum tentu ada di opsi pencarian, jadi diambil sendiri agar
  // chip filter menampilkan namanya — bukan "Semua Produk".
  const { data: selectedProductData } = useQuery({
    queryKey: ['stock-movements-selected-product', productId],
    enabled: productId > 0,
    queryFn: () => productsService.findById(productId).then((r) => r.data),
  })
  const searchProductList = productsOpts.items as any[]
  const selectedProduct = (selectedProductData as any)?.data
  const selectedInList = searchProductList.some((p: any) => Number(p.id) === productId)
  const productOptions = [
    { value: 0, label: 'Semua Produk' },
    ...searchProductList.map((p: any) => ({
      value: p.id as number,
      label: withProductType((p.name as string) ?? `Product #${p.id}`, p.type),
      sublabel: p.code as string | undefined,
    })),
    ...(productId > 0 && selectedProduct && !selectedInList
      ? [
          {
            value: productId,
            label: withProductType(
              (selectedProduct.name as string) ?? `Product #${productId}`,
              selectedProduct.type,
            ),
            sublabel: selectedProduct.code as string | undefined,
          },
        ]
      : []),
  ]

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['stock-movements', page, perPage, debouncedSearch, directionFilter, refTypeFilter, productId, productInventoryId, productTypes, productTypeFilter, branchFilter],
    queryFn: () =>
      stockMovementsService
        .list({
          page,
          per_page: perPage,
          sort: '-id',
          'filter[search]': debouncedSearch || undefined,
          'filter[direction]': directionFilter || undefined,
          'filter[reference_type]': refTypeFilter || undefined,
          'filter[product_id]': productId || undefined,
          'filter[product_inventory_id]': productInventoryId || undefined,
          // Filter tipe produk untuk menu Stock Movements Raw / WIP
          // (filter[product_types] sudah didukung backend).
          'filter[product_types]': productTypes || undefined,
          'filter[product_type]': (!productTypes && productTypeFilter) || undefined,
          'filter[branch_id]': branchFilter || undefined,
          include:
            'branch,product_inventory,' +
            'product_inventory.product_uom_batch,' +
            'product_inventory.product_uom_batch.product_uom,' +
            'product_inventory.product_uom_batch.product_uom.product,' +
            'product_inventory.product_uom_batch.product_uom.uom',
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: StockMovement[] = (data as any)?.data ?? []

  // Delivery rows with source_type po_from_branch show the delivery's target branch
  // under the document code. Stock movements can't include their reference,
  // so each delivery on this page is fetched once (cached).
  const deliveryIds = Array.from(
    new Set(
      items
        .filter((m) => m.reference_type === 'deliveries' && m.reference_id != null)
        .map((m) => Number(m.reference_id))
        .filter((n) => n > 0),
    ),
  )
  const deliveryQueries = useQueries({
    queries: deliveryIds.map((id) => ({
      queryKey: ['stock-movement-delivery-ref', id],
      staleTime: 5 * 60_000,
      queryFn: () =>
        deliveriesService.findById(id, { include: 'target_branch' }).then((r) => (r.data as any)?.data ?? null),
    })),
  })
  const deliveryTargetById = new Map<number, string>()
  deliveryIds.forEach((id, i) => {
    const d: any = deliveryQueries[i]?.data
    if ((d?.source_type ?? d?.type) === 'po_from_branch' && d?.target_branch?.name) deliveryTargetById.set(id, d.target_branch.name)
  })
  const deliveryTargetLabel = (m: StockMovement): string | undefined => {
    if (m.reference_type !== 'deliveries') return undefined
    const name = deliveryTargetById.get(Number(m.reference_id))
    return name ? `To: ${name}` : undefined
  }

  // Label for the batch filter banner, read from the first returned row.
  const filteredInventory = productInventoryId > 0 ? items[0]?.product_inventory : undefined
  const filteredInventoryLabel = filteredInventory
    ? [
        getProductUomName(
          filteredInventory.product_uom_batch?.product_uom as any,
          filteredInventory.product_uom_batch?.product_uom?.product?.name,
        ),
        filteredInventory.product_uom_batch?.batch_code ?? filteredInventory.batch_code ?? filteredInventory.code,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  // The batch filter lives in the URL — drop it there so the URL sync
  // effect doesn't put it back.
  const clearProductInventoryFilter = () => {
    setProductInventoryId(0)
    if (router.query.product_inventory_id) {
      const { product_inventory_id: _drop, ...rest } = router.query
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
    }
  }
  const meta = (data as any)?.meta

  // Tipe produk dari menu "Stock Movements Raw / WIP". Backend kini mendukung
  // filter[product_types] (nilai berkoma), jadi penyaringan cukup di API saja —
  // daftar baris tidak perlu disaring ulang di FE.
  const requestedTypes = productTypes
    ? productTypes
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : []

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
    { label: 'No.', width: 50 },
    { label: 'Tanggal / Dokumen', width: 220 },
    { label: 'Produk' },
    { label: 'Batch', width: 230 },
    { label: 'In', width: 230 },
    { label: 'Out', width: 230 },
    { label: 'Balance', width: 140 },
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
            {requestedTypes.length
              ? ` · Tipe produk: ${requestedTypes.map((t) => PRODUCT_TYPE_LABELS[t] ?? t.toUpperCase()).join(', ')}`
              : ''}
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
      <FilterBar
        style={{ marginBottom: 0 }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari pergerakan..."
        activeCount={countActive(
          directionFilter, refTypeFilter, productId, productInventoryId, productTypeFilter, branchFilter, startDate, endDate,
        )}
        onClear={() => {
          setDirectionFilter('')
          setRefTypeFilter('')
          setProductId(0)
          clearProductInventoryFilter()
          setProductTypeFilter('')
          setBranchFilter('')
          setStartDate('')
          setEndDate('')
          setPage(1)
        }}
        quick={
          <>
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

            {/* Filter jenis dokumen sumber (reference_type) */}
            <FilterSelect
              value={refTypeFilter}
              onChange={(e) => setRefTypeFilter(e.target.value)}
              title="Filter jenis dokumen"
            >
              {REFERENCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Product">
          <FilterField label="Produk">
            <SearchableSelect
              value={productId}
              onChange={(val) => setProductId(Number(val))}
              options={productOptions}
              placeholder="Semua Produk"
              searchPlaceholder="Ketik minimal 2 huruf untuk mencari..."
              loading={productsOpts.loading}
              {...productsOpts.selectProps}
              onSearchChange={setProductSearch}
            />
          </FilterField>
          {/* Filter tipe produk (filter[product_type]) — disembunyikan bila menu
              sudah mengunci product_types lewat URL (Raw / WIP). */}
          {!productTypes && (
            <FilterField label="Tipe produk">
              <FilterSelect
                block
                value={productTypeFilter}
                onChange={(e) => setProductTypeFilter(e.target.value)}
                title="Filter tipe produk"
              >
                <option value="">Semua Tipe Produk</option>
                {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
          )}
        </FilterGroup>
        <FilterGroup title={showBranchFilter ? 'Branch & dates' : 'Dates'}>
          {/* Filter cabang (filter[branch_id]) */}
          {showBranchFilter && (
            <FilterField label="Cabang">
              <FilterSelect
                block
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                title="Filter cabang"
              >
                <option value="">Semua Cabang</option>
                {availableBranches.map((b: any) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
          )}
          {/* Date range (client-side) */}
          <FilterField label="Tanggal">
            <DateRange
              from={startDate}
              to={endDate}
              onFromChange={(v) => setStartDate(v)}
              onToChange={(v) => setEndDate(v)}
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      {productInventoryId > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--info-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground)',
          }}
        >
          <span style={{ flex: 1 }}>
            Showing movements of one inventory batch only
            {filteredInventoryLabel ? (
              <>
                : <strong>{filteredInventoryLabel}</strong>
              </>
            ) : (
              ` (#${productInventoryId})`
            )}
          </span>
          <button
            type="button"
            onClick={clearProductInventoryFilter}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            Show all
          </button>
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
        {/* Kotak scroll inilah yang membuat <thead> bisa sticky (freeze)
            — sama seperti view StockPosition. Baris isi discroll di dalam kartu. */}
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          <table
            style={{
              width: '100%',
              // borderCollapse: separate — border dipindah ke sel, karena
              // border pada <tr>/<thead> tidak ikut ter-sticky saat scroll.
              borderCollapse: 'separate',
              borderSpacing: 0,
              minWidth: 1240,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--background)' }}>
                {columns.map(({ label, width }, i) => (
                  <th
                    key={i}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      background: 'var(--background)',
                      borderBottom: '1px solid var(--border)',
                      padding: '10px 16px',
                      textAlign: label === 'No.' ? 'center' : 'left',
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
                  <td
                    colSpan={totalCols}
                    style={{ textAlign: 'center', padding: '48px 16px', borderBottom: '1px solid var(--border)' }}
                  >
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
                    style={{
                      textAlign: 'center',
                      padding: 48,
                      fontSize: 13,
                      color: 'var(--destructive)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    Gagal memuat data stock movements
                  </td>
                </tr>
              )}

              {!isLoading && !isError && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={totalCols} style={{ borderBottom: '1px solid var(--border)' }}>
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
                filteredItems.map((item: any, idx: number) => {
                  const uomCode =
                    item.product_inventory?.product_uom_batch?.product_uom?.uom?.code ??
                    item.product_inventory?.product_uom?.uom?.code
                  // Product UoM code (SKU), else the product code.
                  const pu =
                    item.product_inventory?.product_uom_batch?.product_uom ??
                    item.product_inventory?.product_uom
                  const skuCode: string | undefined = pu?.code || pu?.product?.code
                  const productName =
                    getProductUomName(
                      item.product_inventory?.product_uom_batch?.product_uom ??
                        item.product_inventory?.product_uom,
                      item.product_inventory?.product_uom_batch?.product_uom?.product?.name ??
                        item.product_inventory?.product_uom?.product?.name,
                    ) ||
                    item.product_inventory?.code ||
                    `INV-${item.product_inventory_id ?? '?'}`

                  return (
                    <tr
                      key={item.id}
                      onMouseEnter={() => setHoveredRow(item.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                        verticalAlign: 'top',
                      }}
                    >
                      <td style={{ ...cellBase, fontSize: 13, color: 'var(--foreground-muted)', textAlign: 'center' }}>
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      {/* Tanggal + Dokumen digabung */}
                      <td style={cellBase}>
                        {canRead ? <DateTimeDocCell item={item} subtitle={deliveryTargetLabel(item)} /> : '***'}
                      </td>

                      {/* Produk (+ catatan jika ada) */}
                      <td style={cellBase}>
                        <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--foreground)' }}>
                          {productName}
                        </div>
                        {(skuCode || item.product_inventory?.code || uomCode) && (
                          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                            {[
                              skuCode,
                              item.product_inventory?.code !== skuCode ? item.product_inventory?.code : null,
                              uomCode,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
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

                      {/* Batch (kode batch + owner/stage/lokasi) */}
                      <td style={cellBase}>
                        <BatchCell item={item} />
                      </td>

                      {/* In */}
                      <td style={cellBase}>
                        <MovementChainCell item={item} direction="in" />
                      </td>

                      {/* Out */}
                      <td style={cellBase}>
                        <MovementChainCell item={item} direction="out" />
                      </td>

                      {/* Balance (stok sesudah pergerakan) */}
                      <td style={cellBase}>
                        {canRead ? (
                          <StockValueCell value={item.stock_after} uomCode={getBaseUomCode(item)} />
                        ) : (
                          '***'
                        )}
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
