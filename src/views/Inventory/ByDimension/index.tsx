'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/hooks/useApi'
import { companiesService } from '@/services/companies.service'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }
const ALL_OPTION = { value: '', label: 'Semua' }

interface DimensionSliceRow {
  id?: number
  code?: string
  product_code?: string
  product_name?: string
  name?: string
  owner_ref?: string
  owner_display?: string
  stage?: string
  stage_name?: string
  total_stock?: number
  stock?: number
  reorder_point?: number
  needs_reorder?: boolean
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'var(--surface)',
  color: active ? 'white' : 'var(--foreground)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
})

const theadCellStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
}

const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const amountCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

export default function InventoryByDimensionView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('product-inventory.read')

  const [mode, setMode] = useState<'owner' | 'stage'>('owner')
  const [ownerFilter, setOwnerFilter] = useState<string>('')
  const [stageFilter, setStageFilter] = useState<string>('')

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all'],
    enabled: canRead,
    queryFn: () => companiesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const ownerOptions = [
    ALL_OPTION,
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    enabled: canRead,
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = [ALL_OPTION, ...stages.map((s) => ({ value: s.code, label: s.name }))]

  const stageLabel = (code: string | undefined): string => {
    if (!code) return '—'
    const match = stages.find((s) => s.code === code)
    return match?.name ?? code
  }

  const { data: byOwnerData, isLoading: byOwnerLoading, isError: byOwnerError } = useQuery({
    queryKey: ['product-inventories-by-owner', ownerFilter],
    enabled: canRead && mode === 'owner',
    queryFn: () =>
      api
        .get('/product-inventories/by-owner', {
          params: ownerFilter ? { owner_ref: ownerFilter } : {},
        })
        .then((r) => r.data),
  })

  const { data: byStageData, isLoading: byStageLoading, isError: byStageError } = useQuery({
    queryKey: ['product-inventories-by-stage', stageFilter],
    enabled: canRead && mode === 'stage',
    queryFn: () =>
      api
        .get('/product-inventories/by-stage', {
          params: stageFilter ? { stage: stageFilter } : {},
        })
        .then((r) => r.data),
  })

  const rows: DimensionSliceRow[] =
    mode === 'owner' ? (byOwnerData as any)?.data ?? [] : (byStageData as any)?.data ?? []
  const isLoading = mode === 'owner' ? byOwnerLoading : byStageLoading
  const isError = mode === 'owner' ? byOwnerError : byStageError

  const rowOwnerLabel = (row: DimensionSliceRow): string => {
    if (row.owner_display) return row.owner_display
    if (!row.owner_ref) return '—'
    if (row.owner_ref === 'GENERAL') return 'Umum (GENERAL)'
    const match = companies.find((c) => String(c.id) === String(row.owner_ref))
    return match?.name ?? row.owner_ref
  }

  const rowStageLabel = (row: DimensionSliceRow): string => {
    if (row.stage_name) return row.stage_name
    return stageLabel(row.stage)
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Stok per Dimensi
        </h1>
        <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Ringkasan stok dikelompokkan per owner atau per stage
        </p>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          Anda tidak memiliki izin untuk melihat stok per dimensi.
        </div>
      ) : (
        <>
          <div style={sectionStyle}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Tampilan</label>
                <div style={{ display: 'flex' }}>
                  <button
                    type="button"
                    onClick={() => setMode('owner')}
                    style={{ ...toggleBtnStyle(mode === 'owner'), borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}
                  >
                    Per Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('stage')}
                    style={{ ...toggleBtnStyle(mode === 'stage'), borderRadius: '0 var(--radius-md) var(--radius-md) 0', borderLeft: 'none' }}
                  >
                    Per Stage
                  </button>
                </div>
              </div>

              {mode === 'owner' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
                  <label style={labelStyle}>Owner</label>
                  <SearchableSelect
                    value={ownerFilter}
                    onChange={(val) => setOwnerFilter(String(val))}
                    options={ownerOptions}
                    placeholder="Semua owner..."
                    searchPlaceholder="Cari perusahaan..."
                    loading={companiesLoading}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
                  <label style={labelStyle}>Stage</label>
                  <SearchableSelect
                    value={stageFilter}
                    onChange={(val) => setStageFilter(String(val))}
                    options={stageOptions}
                    placeholder="Semua stage..."
                    searchPlaceholder="Cari stage..."
                    loading={stagesLoading}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={theadCellStyle}>{mode === 'owner' ? 'Owner' : 'Stage'}</th>
                    <th style={theadCellStyle}>Kode</th>
                    <th style={theadCellStyle}>Produk</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Total Stok</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Reorder Point</th>
                    <th style={theadCellStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Memuat...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                        Gagal memuat data stok
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Tidak ada data stok
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const needsReorder = Boolean(row.needs_reorder)
                      const code = row.code ?? row.product_code ?? '—'
                      const name = row.product_name ?? row.name ?? '—'
                      const totalStock = Number(row.total_stock ?? row.stock ?? 0)
                      const reorderPoint = row.reorder_point ?? null
                      const dimensionLabel = mode === 'owner' ? rowOwnerLabel(row) : rowStageLabel(row)
                      const rowStyle: React.CSSProperties = needsReorder
                        ? { background: 'rgba(192, 54, 44, 0.06)' }
                        : {}
                      return (
                        <tr key={row.id ?? `${code}-${idx}`} style={rowStyle}>
                          <td style={cellStyle}>{dimensionLabel}</td>
                          <td style={cellStyle}>{code}</td>
                          <td style={cellStyle}>{name}</td>
                          <td style={amountCellStyle}>{totalStock.toLocaleString('id-ID')}</td>
                          <td style={amountCellStyle}>
                            {reorderPoint === null || reorderPoint === undefined
                              ? '—'
                              : Number(reorderPoint).toLocaleString('id-ID')}
                          </td>
                          <td style={cellStyle}>
                            {needsReorder ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#c0362c',
                                  background: 'rgba(192, 54, 44, 0.12)',
                                }}
                              >
                                Perlu Reorder
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Cukup</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
