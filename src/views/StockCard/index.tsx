'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockMovementsService } from '@/services/stock-movements.service'
import { productsService } from '@/services/products.service'
import { companiesService } from '@/services/companies.service'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/date'
import api from '@/hooks/useApi'
import SearchableSelect from '@/components/SearchableSelect'
import {
  TYPE_META,
  REFERENCE_LABELS,
  formatMovementQty,
  MovementDocumentLink,
} from '@/views/StockMovement'
import type { StockMovement } from '@/views/StockMovement'
import { LayoutList } from 'lucide-react'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

export default function StockCardView() {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { user, hasPermission } = useAuth()
  const canRead = hasPermission('stock-movement.read')
  const branchId = user?.branch?.id

  const [productId, setProductId] = useState<number>(0)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'' | 'in' | 'out'>('')

  useEffect(() => {
    const t = setTimeout(() => setProductSearchDebounced(productSearch), 400)
    return () => clearTimeout(t)
  }, [productSearch])

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['stock-card-product-search', productSearchDebounced],
    enabled: productSearchDebounced.length >= 2,
    queryFn: () =>
      productsService
        .list({ per_page: 50, sort: 'name', 'filter[search]': productSearchDebounced } as any)
        .then((r) => r.data),
  })
  const products: any[] = (productsData as any)?.data ?? []
  const productOptions = products.map((p: any) => ({
    value: p.id as number,
    label: (p.name as string) ?? `Product #${p.id}`,
    sublabel: p.code as string | undefined,
  }))

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all', debouncedDropdownSearch],
    queryFn: () => companiesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const ownerOptions = [
    { value: '', label: 'Semua Owner' },
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all', debouncedDropdownSearch],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = [
    { value: '', label: 'Semua Stage' },
    ...stages.map((s) => ({ value: s.code, label: s.name })),
  ]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-card', productId, branchId, directionFilter],
    enabled: productId > 0,
    queryFn: async () => {
      let allRows: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await stockMovementsService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined, 
            page,
            per_page: 500,
            sort: 'created_at',
            'filter[product_id]': productId,
            'filter[branch_id]': branchId || undefined,
            'filter[direction]': directionFilter || undefined,
            include:
              'product_inventory,' +
              'product_inventory.product_uom_batch,' +
              'product_inventory.product_uom_batch.product_uom,' +
              'product_inventory.product_uom_batch.product_uom.product,' +
              'product_inventory.product_uom_batch.product_uom.uom,' +
              'product_inventory.product_uom,' +
              'product_inventory.product_uom.product,' +
              'product_inventory.product_uom.uom,' +
              'branch',
           } as any)
          .then((r) => r.data)
        const rows = (res as any)?.data ?? []
        allRows = allRows.concat(rows)
        totalPages =
          (res as any)?.meta?.last_page ?? (res as any)?.meta?.total_pages ?? 1
        page += 1
      } while (page <= totalPages)
      return { data: allRows }
    },
  })

  const allRows: StockMovement[] = (data as any)?.data ?? []

  const ownerLabel = (row: StockMovement): string => {
    const pi = row.product_inventory
    if (!pi) return '—'
    if (pi.owner_display) return pi.owner_display
    if (pi.owner_company_name) return pi.owner_company_name
    const ownerRef = pi.owner_ref
    if (!ownerRef) return '—'
    if (ownerRef === 'GENERAL') return 'Umum'
    const match = companies.find((c) => String(c.id) === String(ownerRef))
    return match?.name ?? ownerRef
  }

  // Dimension filter isn't a query param — narrow the already-fetched rows
  // client-side by the product_inventory's own owner_ref/stage.
  const rows = allRows.filter((row) => {
    const pi = row.product_inventory
    if (ownerFilter && (pi?.owner_ref ?? '') !== ownerFilter) return false
    if (stageFilter && (pi?.stage ?? '') !== stageFilter) return false
    return true
  })

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

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 20 }}>
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
          Riwayat pergerakan stok per produk dengan saldo berjalan
        </p>
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
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>
            Produk <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <SearchableSelect
            value={productId}
            onChange={(val) => setProductId(Number(val))}
            options={productOptions}
            placeholder="Pilih produk..."
            searchPlaceholder="Ketik minimal 2 huruf untuk mencari..."
            loading={productsLoading}
            onSearchChange={setProductSearch}
          />
        </div>

        <div>
          <label style={labelStyle}>Cabang</label>
          <div
            style={{
              padding: '9px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            {user?.branch?.name ?? '—'}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Arah</label>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as '' | 'in' | 'out')}
            style={{ ...selectStyle, width: '100%' }}
          >
            <option value="">Semua Arah</option>
            <option value="in">Masuk</option>
            <option value="out">Keluar</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Owner (Dimensi)</label>
          <SearchableSelect
            value={ownerFilter}
            onChange={(val) => setOwnerFilter(String(val))}
            options={ownerOptions}
            placeholder="Semua Owner"
            searchPlaceholder="Cari perusahaan..."
            loading={companiesLoading}
            onSearchChange={setDropdownSearch}
/>
        </div>

        <div>
          <label style={labelStyle}>Stage (Dimensi)</label>
          <SearchableSelect
            value={stageFilter}
            onChange={(val) => setStageFilter(String(val))}
            options={stageOptions}
            placeholder="Semua Stage"
            searchPlaceholder="Cari stage..."
            loading={stagesLoading}
            onSearchChange={setDropdownSearch}
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
        {productId === 0 ? (
          <div
            style={{
              padding: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <LayoutList size={32} style={{ color: 'var(--foreground-subtle)' }} />
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              Pilih produk untuk melihat kartu stok
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                  {[
                    'Tanggal',
                    'Dokumen',
                    'Tipe',
                    'Dimensi',
                    'Masuk',
                    'Keluar',
                    'Saldo',
                    'Catatan',
                  ].map((label) => (
                    <th key={label} style={thStyle}>
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

                {!isLoading && !isError && rows.length === 0 && (
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
                          Tidak ada pergerakan stok
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !isError &&
                  rows.map((item) => {
                    const typeMeta = TYPE_META[item.direction] ?? TYPE_META.in
                    const Icon = typeMeta.icon
                    return (
                      <tr key={item.id}>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                            {formatDate(item.created_at)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <MovementDocumentLink item={item} />
                        </td>
                        <td style={tdStyle}>
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
                              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', textTransform: 'capitalize' }}>
                                {(REFERENCE_LABELS[item.reference_type] ?? item.reference_type.replace(/_/g, ' '))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                            {canRead ? `${ownerLabel(item)}/${item.product_inventory?.stage ?? '—'}` : '***'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {item.direction === 'in' && (
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>
                              {formatMovementQty(item)}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {item.direction === 'out' && (
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--destructive)' }}>
                              {formatMovementQty(item)}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                            {item.stock_after != null ? item.stock_after.toLocaleString('id-ID') : '—'}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontSize: 12,
                            color: 'var(--foreground-muted)',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {canRead ? item.description ?? '—' : '***'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
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
