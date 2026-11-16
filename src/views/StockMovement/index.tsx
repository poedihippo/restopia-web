'use client'
import { formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { deliveriesService } from '@/services/deliveries.service'
import { stockMovementsService } from '@/services/stock-movements.service'
import { getProductUomName } from '@/utils/productUomName'
import { productInventoriesService } from '@/services/product-inventories.service'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { useBranchUomDisplay } from '@/hooks/useBranchUomDisplay'
import { useAuth } from '@/hooks/useAuth'
import StockMovementSheet from './StockMovementSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
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
  const { hasPermission } = useAuth()
  // Balance follows Stock's "Branch Type" unit (e.g. 2.400 GR → 2,4 KG).
  const { toBranchUnit } = useBranchUomDisplay()
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
  // One inventory row / batch (filter[product_inventory_id]): picked in
  // Filters, or set from the URL (Stock → "Show Stock Movement").
  const [productInventoryId, setProductInventoryId] = useState<number>(0)
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventorySearchDebounced, setInventorySearchDebounced] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Filter tipe produk — dipakai menu "Stock Movements Raw"/"WIP".
  // Backend belum punya filter[product_types]; parameter sudah dikirim dari FE.
  const [productTypes, setProductTypes] = useState('')
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
    const timer = setTimeout(() => setInventorySearchDebounced(inventorySearch), 400)
    return () => clearTimeout(timer)
  }, [inventorySearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, directionFilter, refTypeFilter, productId, productInventoryId, startDate, endDate])


  // Product Inventory picker: 20 rows a page, server-side search, more on
  // scroll. Limited to the menu's product type when it is a single one (the
  // inventory API only takes one filter[product_type] value).
  const singleMenuType = productTypes && !productTypes.includes(',') ? productTypes : undefined
  const inventoryOpts = useInfiniteOptions<any>({
    queryKey: ['stock-movements-inventory-options', inventorySearchDebounced, singleMenuType],
    fetchPage: (p) =>
      productInventoriesService
        .list({
          page: p,
          per_page: 20,
          sort: '-id',
          include: 'product_uom_batch,product_uom,product,uom',
          'filter[search]': inventorySearchDebounced || undefined,
          'filter[product_type]': singleMenuType,
        } as any)
        .then((r) => r.data),
  })
  // The picked row (e.g. from the URL) may not be on the loaded pages.
  const { data: pickedInventoryData } = useQuery({
    queryKey: ['stock-movements-inventory-picked', productInventoryId],
    enabled: productInventoryId > 0,
    queryFn: () =>
      productInventoriesService
        .findById(productInventoryId, { include: 'product_uom_batch,product_uom,product,uom' })
        .then((r) => r.data),
  })
  const pickedInventory = (pickedInventoryData as any)?.data?.data ?? (pickedInventoryData as any)?.data
  const inventoryOption = (row: any) => {
    const pu = row?.product_uom_batch?.product_uom ?? row?.product_uom
    const name = getProductUomName(pu, pu?.product?.name) || `Inventory #${row?.id}`
    const batch = row?.product_uom_batch?.batch_code ?? row?.batch_code ?? row?.code
    const stock = Number(row?.stock ?? row?.qty)
    return {
      value: Number(row.id),
      label: name,
      sublabel: [
        `#${row.id}`,
        batch,
        row?.stage && row.stage !== 'GENERAL' ? row.stage : null,
        Number.isFinite(stock) ? `Stok ${stock.toLocaleString('id-ID', { maximumFractionDigits: 2 })}` : null,
      ].filter(Boolean).join(' · '),
    }
  }
  const inventoryOptions = [
    { value: 0, label: 'Semua Product Inventory' },
    ...(pickedInventory?.id && !inventoryOpts.items.some((r: any) => Number(r.id) === Number(pickedInventory.id))
      ? [inventoryOption(pickedInventory)]
      : []),
    ...inventoryOpts.items.map(inventoryOption),
  ]

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['stock-movements', page, perPage, debouncedSearch, directionFilter, refTypeFilter, productId, productInventoryId, productTypes, startDate, endDate],
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
          // Date range on the server (YYYY-MM-DD; the API covers the whole day).
          'filter[created_at_gte]': startDate || undefined,
          'filter[created_at_lte]': endDate || undefined,
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

  // Dates are filtered by the API (filter[created_at_gte|lte]), so every page
  // and meta.total already match the range.
  const filteredItems = items

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
          directionFilter, refTypeFilter, productId, productInventoryId, startDate, endDate,
        )}
        onClear={() => {
          setDirectionFilter('')
          setRefTypeFilter('')
          setProductId(0)
          clearProductInventoryFilter()
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
          <FilterField label="Product Inventory">
            <SearchableSelect
              value={productInventoryId}
              onChange={(v) => {
                const id = Number(v) || 0
                if (id === 0) clearProductInventoryFilter()
                else setProductInventoryId(id)
              }}
              options={inventoryOptions}
              placeholder="Semua Product Inventory"
              searchPlaceholder="Cari produk / batch..."
              loading={inventoryOpts.loading}
              {...inventoryOpts.selectProps}
              onSearchChange={setInventorySearch}
              triggerStyle={{ height: 36, padding: '0 12px', fontSize: 13, borderRadius: 'var(--radius-md)' }}
            />
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Dates">
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
                          (() => {
                            if (item.stock_after == null) return <StockValueCell />
                            const productId =
                              item.product_inventory?.product_uom_batch?.product_uom?.product?.id ??
                              item.product_inventory?.product_uom?.product?.id
                            const bal = toBranchUnit(
                              Number(item.stock_after),
                              getBaseUomCode(item),
                              productId,
                              getConversions(item),
                            )
                            return <StockValueCell value={bal.qty} uomCode={bal.unit} />
                          })()
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
