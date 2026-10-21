'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { productUomsService } from '@/services/product-uoms.service'
import { productsService } from '@/services/products.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import {
  buildConversionChain,
  convertUp,
  type ConversionEntry,
} from '@/utils/unitDisplay'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { LayoutList, Download, Loader2, ExternalLink } from 'lucide-react'

interface CardStockCounter {
  receipt?: number
  production?: number
  conversion?: number
  dimension_transfer?: number
  stock_movement?: number
  stock_opname?: number
  delivery?: number
  sales_order?: number
  total?: number
}

interface CardStock {
  base_uom_code?: string
  in?: CardStockCounter
  out?: CardStockCounter
}

interface BranchConversion extends ConversionEntry {
  id?: number
  branch_types?: string[] | null
}

interface ProductUomCardStock {
  id: number
  name?: string
  code?: string
  product_id: number
  product?: {
    id: number
    name: string
    code?: string
    base_uom_id?: number
    conversions?: BranchConversion[]
  }
  uom_id: number
  uom?: { id: number; name: string; code?: string }
  stock?: number
  card_stock?: CardStock
}

const getToday = () => new Date().toISOString().slice(0, 10)

const MAX_CHAIN_DEPTH = 10

/**
 * Konversi yang berlaku untuk branch type aktif (user.branch.type dari auth/me).
 * - `branch_types` kosong / tidak ada → dianggap berlaku untuk semua branch
 *   (data lama belum punya field ini).
 * - `activeBranchType` kosong (mis. superadmin tanpa branch) → tanpa filter.
 */
function filterConversionsForBranch(
  conversions: BranchConversion[] | undefined | null,
  activeBranchType?: string | null,
): BranchConversion[] {
  if (!conversions || conversions.length === 0) return []
  const t = (activeBranchType ?? '').trim().toLowerCase()
  if (!t) return conversions
  return conversions.filter((c) => {
    const bts = Array.isArray(c.branch_types) ? c.branch_types : []
    if (bts.length === 0) return true
    return bts.some((bt) => String(bt).toLowerCase() === t)
  })
}

/**
 * Naik dari base unit ke unit teratas rantai konversi branch
 * (mis. branch warehouse → BALL saat rantai BALL(50)→KG berlaku).
 * Return null kalau base unit tidak bisa dicapai (rantai tidak tersedia
 * untuk branch type ini) — kolom Setara lalu menampilkan "—".
 */
function resolveBranchUnit(
  baseUomCode: string,
  conversions: BranchConversion[],
): string | null {
  if (!baseUomCode || conversions.length === 0) return null
  const chain = buildConversionChain(conversions)
  let unit = baseUomCode
  let safety = MAX_CHAIN_DEPTH
  while (safety-- > 0) {
    const step = chain.find((c) => c.target_uom_code === unit)
    if (!step) break
    unit = step.uom_code
  }
  return unit === baseUomCode ? null : unit
}

function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 })
}

export default function StockCardView() {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const canRead = hasPermission('stock-movement.read')
  const activeProductTypes = useActiveBranchProductTypes()
  // Konversi di kartu stok selalu mengikuti tipe branch yang sedang aktif
  // (warehouse → konversi branch warehouse, production → production, dst).
  const activeBranchType = ((user as any)?.branch?.type as string | undefined) || ''

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productId, setProductId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [startDate, setStartDate] = useState(getToday)
  const [endDate, setEndDate] = useState(getToday)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)

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
    queryKey: ['stock-card-product-search', productSearchDebounced],
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
      label: (p.name as string) ?? `Product #${p.id}`,
      sublabel: p.code as string | undefined,
    })),
  ]

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'stock-card',
      page,
      perPage,
      debouncedSearch,
      productId,
      startDate,
      endDate,
      activeProductTypes,
    ],
    queryFn: () =>
      productUomsService
        .cardStock({
          page,
          per_page: perPage,
          sort: 'name:product_uoms.name',
          include: 'product,uom',
          'filter[search]': debouncedSearch || undefined,
          'filter[product_id]': productId > 0 ? productId : undefined,
          'filter[start_date]': startDate || undefined,
          'filter[end_date]': endDate || undefined,
          'filter[product_types]': activeProductTypes,
        } as any)
        .then((r) => r.data),
  })

  const items: ProductUomCardStock[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const exportMutation = useMutation({
    mutationFn: () =>
      reportsService.exportStockCards({
        product_id: productId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      } as any),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `stock-card-product-${productId || 'all'}.xlsx`)
      toast.success('Kartu stok berhasil diexport')
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal mengexport kartu stok'),
  })

  const goToMovements = (item: ProductUomCardStock) => {
    const params = new URLSearchParams()
    if (item.product_id) params.set('product_id', String(item.product_id))
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    router.push(`/products/product-inventory/stock-movements?${params.toString()}`)
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
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
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            Kartu Stok
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Ringkasan stok per product UOM dengan counter masuk/keluar per jenis dokumen
            {activeBranchType ? (
              <> · Konversi satuan mengikuti branch type <strong style={{ color: 'var(--foreground)' }}>{activeBranchType}</strong></>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            cursor: exportMutation.isPending ? 'not-allowed' : 'pointer',
            opacity: exportMutation.isPending ? 0.6 : 1,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {exportMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export Excel
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
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <label style={labelStyle}>Cari</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / kode UOM..."
            style={inputStyle}
          />
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
          <label style={labelStyle}>Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                {['#', 'Produk', 'UOM', 'Masuk', 'Keluar', 'Stok', 'Setara (satuan branch)', ''].map((label, i) => (
                  <th key={i} style={thStyle}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                    Gagal memuat kartu stok
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
                      <LayoutList size={32} style={{ color: 'var(--foreground-subtle)' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        Tidak ada data kartu stok
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                items.map((item, idx) => {
                  const inTotal = item.card_stock?.in?.total ?? 0
                  const outTotal = item.card_stock?.out?.total ?? 0
                  return (
                    <tr
                      key={item.id}
                      onClick={() => goToMovements(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 12 }}>
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {item.product?.name ?? '—'}
                          </span>
                          {item.product?.code && (
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                              {item.product.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                            {item.name ?? '—'}
                          </span>
                          {item.code && (
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                              {item.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>
                          {inTotal.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--destructive)' }}>
                          {outTotal.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                          {item.stock != null ? item.stock.toLocaleString('id-ID') : '—'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                        {(() => {
                          const baseUom = item.card_stock?.base_uom_code || item.uom?.code || ''
                          const branchConvs = filterConversionsForBranch(
                            item.product?.conversions,
                            activeBranchType,
                          )
                          const branchUnit = resolveBranchUnit(baseUom, branchConvs)

                          if (!branchUnit) {
                            return (
                              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                                {activeBranchType
                                  ? `Tidak ada konversi untuk branch ${activeBranchType}`
                                  : 'Tidak ada konversi'}
                              </span>
                            )
                          }

                          // card_stock.in/out selalu dalam base UOM; stok baris ini
                          // dalam satuan barisnya (item.uom) — sama seperti kolom UOM.
                          const stockFrom = item.uom?.code || baseUom
                          const stockEq =
                            item.stock == null
                              ? null
                              : stockFrom === branchUnit
                                ? item.stock
                                : convertUp(item.stock, stockFrom, branchUnit, branchConvs)
                          const inEq = convertUp(inTotal, baseUom, branchUnit, branchConvs)
                          const outEq = convertUp(outTotal, baseUom, branchUnit, branchConvs)

                          const line = (
                            label: string,
                            value: number | null,
                            color: string,
                          ) => (
                            <div
                              key={label}
                              style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--foreground-muted)',
                                  width: 44,
                                  flexShrink: 0,
                                }}
                              >
                                {label}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color,
                                  textAlign: 'right',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                }}
                              >
                                {formatQty(value)}{' '}
                                <span style={{ fontWeight: 500, color: 'var(--foreground-muted)' }}>
                                  {branchUnit}
                                </span>
                              </span>
                            </div>
                          )

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {line('Masuk', inEq, 'var(--success)')}
                              {line('Keluar', outEq, 'var(--destructive)')}
                              {line('Stok', stockEq, 'var(--foreground)')}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <ExternalLink size={14} style={{ color: 'var(--foreground-muted)' }} />
                      </td>
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
      `}</style>
    </div>
  )
}
