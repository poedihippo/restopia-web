'use client'
import { formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { stockMovementsService } from '@/services/stock-movements.service'
import { productsService } from '@/services/products.service'
import { useAuth } from '@/hooks/useAuth'
import StockMovementSheet from './StockMovementSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import SearchableSelect from '@/components/SearchableSelect'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react'

export interface StockMovement {
  id: number
  qty: number
  base_qty?: number | null
  base_uom_code?: string | null
  direction: 'in' | 'out'
  product_inventory_id?: number
  branch_id?: number
  description?: string
  created_at?: string
  reference_type?: string
  reference_id?: number | string
  reference_code?: string
  reference?: { code?: string }
  stock_before?: number
  stock_after?: number
  product_inventory?: {
    code?: string
    owner_ref?: string
    owner_display?: string
    owner_company_name?: string
    stage?: string
    location_ref?: string
    product_uom_batch?: {
      product_uom?: {
        product?: { name: string }
        uom?: { name: string; code?: string }
      }
    }
    product_uom?: {
      product?: { name: string }
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

// Shared qty +/- formatting: prefers base_qty/base_uom_code (the movement's
// base-UOM figure) and falls back to the raw qty + the product's UOM code.
export function formatMovementQty(item: StockMovement): string {
  const sign = item.direction === 'out' ? '−' : '+'
  if (item.base_qty != null && item.base_uom_code) {
    return `${sign}${Number(item.base_qty)} ${item.base_uom_code}`
  }
  const uomCode =
    item.product_inventory?.product_uom_batch?.product_uom?.uom?.code ??
    item.product_inventory?.product_uom?.uom?.code
  return `${sign}${(item.qty ?? 0).toLocaleString('id-ID')}${uomCode ? ` ${uomCode}` : ''}`
}

// Shared "Document" cell content: links to the source document's detail page
// via REFERENCE_ROUTES when resolvable, otherwise a plain (possibly
// truncated) label built from REFERENCE_LABELS.
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

export default function StockMovementView() {
  const { hasPermission } = useAuth()
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

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
  }, [debouncedSearch, directionFilter, productId])

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
            Stock Movements
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Riwayat semua pergerakan stok
          </p>
        </div>

        {canCreate && (<button
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
          }}>
          <Plus size={15} />Record Movement
                              </button>)}
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
            placeholder="Search movements..."
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

        {/* Direction filter */}
        <select
          value={directionFilter}
          onChange={(e) => {
            setDirectionFilter(e.target.value as '' | 'in' | 'out')
            setPage(1)
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <option value="">All Directions</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
        </select>

        {/* Product filter */}
        <div style={{ width: 260 }}>
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
                  { label: 'Type', width: 140 },
                  { label: 'Document', width: 160 },
                  { label: 'Product', width: undefined },
                  { label: 'Branch', width: 160 },
                  { label: 'Qty', width: 100 },
                  { label: 'Notes', width: 200 },
                  { label: 'Date', width: 160 },
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
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load stock movements
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={8}>
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
                      No stock movements recorded
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item: any) => {
                const typeMeta =
                  TYPE_META[item.direction as keyof typeof TYPE_META] ??
                  TYPE_META['in']
                const Icon = typeMeta.icon

                return (
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
                  {/* Type */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: typeMeta.bg,
                          color: typeMeta.color,
                        }}
                      >
                        <Icon size={11} />
                        {typeMeta.label}
                      </span>
                      {item.reference_type && (
                        <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                          <span style={{ textTransform: 'capitalize' }}>
                            {item.reference_type.replace(/_/g, ' ')}
                          </span>
                          {item.reference?.code && (
                            <>
                              {' · '}
                              <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                                {item.reference.code}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Document */}
                  <td style={{ padding: '12px 16px' }}>
                    <MovementDocumentLink item={item} />
                  </td>
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
                        {item.product_inventory?.product_uom_batch?.product_uom?.product?.name ??
                          item.product_inventory?.product_uom?.product?.name ??
                          item.product_inventory?.code ??
                          `INV-${item.product_inventory_id ?? '?'}`}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.product_inventory?.code ?? ''}
                        {item.product_inventory?.product_uom_batch?.product_uom?.uom?.code || item.product_inventory?.product_uom?.uom?.code ? (
                          <>
                            {item.product_inventory?.code ? ' · ' : ''}
                            {item.product_inventory?.product_uom_batch?.product_uom?.uom?.code ?? item.product_inventory?.product_uom?.uom?.code}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </td>
                    {/* Branch */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {canRead ? item.branch?.name ?? item.branch_id ?? '—' : "***"}
                    </td>
                    {/* Qty */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: item.direction === 'out'
                            ? 'var(--destructive)' : 'var(--success)',
                        }}
                      >
                        {formatMovementQty(item)}
                      </span>
                    </td>
                    {/* Notes */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'var(--foreground-muted)',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {canRead ? item.description ?? '—' : "***"}
                    </td>
                    {/* Date */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {canRead ? item.created_at
                        ? formatDateTime(item.created_at)
                        : '—' : "***"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Sheet */}
      <StockMovementSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
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
