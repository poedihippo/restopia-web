'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { productUomsService } from '@/services/product-uoms.service'
import { productsService } from '@/services/products.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import { withProductType, productTypeLabel } from '@/utils/productUomName'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, useProductTypes } from '@/hooks/useProductTypes'
import {
  convertUp,
  type ConversionEntry,
} from '@/utils/unitDisplay'
import SearchableSelect from '@/components/SearchableSelect'
import MultiSearchableSelect from '@/components/MultiSearchableSelect'
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
 * Satuan tampilan untuk branch type aktif.
 *
 * Kandidat = semua unit yang disebut konversi ber-label branch aktif.
 * - Base unit termasuk satuan branch (mis. branch "other" pada produk GR
 *   dengan konversi KG(1000)→GR ber-label other) → pakai base unit.
 * - Selain itu → pakai satuan branch TERBESAR yang bisa dicapai dari base
 *   (mis. branch warehouse: konversi BALL(50)→KG ber-label warehouse membuat
 *   kandidat BALL & KG; dari base GR → BALL, jadi 350.000 GR tampil 7 BALL).
 *
 * Penghitungan sendiri memakai SEMUA konversi, termasuk step penghubung yang
 * ber-label branch lain (mis. KG(1000)→GR ber-label "other" tetap dipakai
 * sebagai jembatan GR→KG→BALL).
 *
 * Return null → caller memakai base unit.
 */
function resolveBranchUnit(
  baseUomCode: string,
  allConversions: BranchConversion[],
  labeledConversions: BranchConversion[],
): string | null {
  if (!baseUomCode || labeledConversions.length === 0) return null

  const candidates = new Set<string>()
  for (const c of labeledConversions) {
    candidates.add(c.uom_code)
    candidates.add(c.target_uom_code)
  }
  if (candidates.has(baseUomCode)) return null

  let best: string | null = null
  let bestRatio = Number.POSITIVE_INFINITY
  for (const unit of candidates) {
    if (unit === baseUomCode) continue
    // 1 base unit berapa `unit` — ratio paling kecil = satuan paling besar.
    const ratio = convertUp(1, baseUomCode, unit, allConversions)
    if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) continue
    if (ratio < bestRatio) {
      bestRatio = ratio
      best = unit
    }
  }
  return best
}

function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 })
}

/**
 * Satuan angka utama (sudah dikonversi ke satuan branch) + nilai pada satuan
 * aslinya sebagai subteks kecil, hanya bila satuannya berbeda.
 */
function QuantityCell({
  value,
  unit,
  subValue,
  subUnit,
  color,
}: {
  value: number | null | undefined
  unit: string
  subValue?: number | null
  subUnit?: string
  color: string
}) {
  const showSub = subValue != null && !!subUnit && subUnit !== unit
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {formatQty(value)}
        {value != null && (
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground-muted)', marginLeft: 5 }}>
            {unit}
          </span>
        )}
      </span>
      {showSub && (
        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', whiteSpace: 'nowrap' }}>
          {formatQty(subValue)} {subUnit}
        </span>
      )}
    </div>
  )
}

export default function StockCardView() {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const canRead = hasPermission('stock-movement.read')
  const activeProductTypes = useActiveBranchProductTypes()
  // Konversi di kartu stok selalu mengikuti tipe branch yang sedang aktif
  // (warehouse → konversi branch warehouse, production → production, dst).
  const activeBranchType = user?.branch?.type || ''

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productId, setProductId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [startDate, setStartDate] = useState(getToday)
  const [endDate, setEndDate] = useState(getToday)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
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
      label: withProductType((p.name as string) ?? `Product #${p.id}`, p.type),
      sublabel: p.code as string | undefined,
    })),
  ]

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
      'stock-card',
      page,
      perPage,
      debouncedSearch,
      productId,
      startDate,
      endDate,
      productTypesParam,
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
          'filter[product_types]': productTypesParam,
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
        'filter[product_types]': productTypesParam || undefined,
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                {['#', 'Produk', 'UOM', 'Masuk', 'Keluar', 'Stok', ''].map((label, i) => (
                  <th key={i} style={thStyle}>
                    {label}
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                    Gagal memuat kartu stok
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={7}>
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

                  // Satuan tampilan mengikuti branch type aktif (mis. warehouse
                  // → BALL). Semua konversi dipakai untuk penghitungannya,
                  // termasuk step penghubung milik branch lain.
                  const baseUom = item.card_stock?.base_uom_code || item.uom?.code || ''
                  const rowUom = item.uom?.code || baseUom
                  const allConvs = item.product?.conversions ?? []
                  const labeledConvs = filterConversionsForBranch(allConvs, activeBranchType)
                  const displayUnit = resolveBranchUnit(baseUom, allConvs, labeledConvs) ?? baseUom

                  const toDisplay = (
                    value: number,
                    fromUom: string,
                  ): { value: number; unit: string } => {
                    if (!fromUom || fromUom === displayUnit) return { value, unit: displayUnit || fromUom }
                    const converted = convertUp(value, fromUom, displayUnit, allConvs)
                    // Rantai tidak terjangkau → tampil apa adanya di satuan asal
                    if (converted == null || !Number.isFinite(converted)) {
                      return { value, unit: fromUom }
                    }
                    return { value: converted, unit: displayUnit }
                  }

                  const inCell = toDisplay(inTotal, baseUom)
                  const outCell = toDisplay(outTotal, baseUom)
                  const stockCell = item.stock != null ? toDisplay(item.stock, rowUom) : null

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
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                        <QuantityCell
                          value={inCell.value}
                          unit={inCell.unit}
                          subValue={inCell.unit === baseUom ? undefined : inTotal}
                          subUnit={baseUom}
                          color="var(--success)"
                        />
                      </td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                        <QuantityCell
                          value={outCell.value}
                          unit={outCell.unit}
                          subValue={outCell.unit === baseUom ? undefined : outTotal}
                          subUnit={baseUom}
                          color="var(--destructive)"
                        />
                      </td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                        <QuantityCell
                          value={stockCell ? stockCell.value : null}
                          unit={stockCell ? stockCell.unit : rowUom}
                          subValue={
                            stockCell && stockCell.unit !== rowUom ? item.stock : undefined
                          }
                          subUnit={rowUom}
                          color="var(--foreground)"
                        />
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
