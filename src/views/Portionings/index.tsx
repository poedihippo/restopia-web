'use client'

import React, { useState, useEffect } from 'react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { portioningsService } from '@/services/portionings.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import type { Portioning } from '@/types/api'
import {
  Plus,
  Pencil,
  Trash2,
  Scissors,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'

const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  final: { label: 'Final', color: 'var(--success)', bg: 'var(--success-bg)' },
}

const SORT_OPTIONS = [
  { value: '-id', label: 'Newest First' },
  { value: 'id', label: 'Oldest First' },
  { value: 'code', label: 'Code (A→Z)' },
  { value: '-code', label: 'Code (Z→A)' },
  { value: 'date', label: 'Date (Oldest)' },
  { value: '-date', label: 'Date (Newest)' },
]

function StatusBadge({ status }: { status: string }) {
  const sm = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.pending
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: sm.bg,
        color: sm.color,
      }}
    >
      {sm.label}
    </span>
  )
}

/** Numbers on this screen stay readable: at most 2 decimals, Indonesian format. */
const qty = (v: unknown): string => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'
}

/** Best-effort human name for a material's inventory row. */
const materialName = (m: any): string => {
  const pu = m?.product_inventory?.product_uom_batch?.product_uom ?? m?.product_inventory?.product_uom
  const name = getProductUomName(pu, pu?.product?.name)
  if (name) return name
  if (m?.product_inventory?.code) return String(m.product_inventory.code)
  return m?.product_inventory_id ? `Inventory #${m.product_inventory_id}` : '—'
}

/** Expiry as dd-mm-yyyy, matching the list's Date column. */
const fmtDate = (v: unknown): string => {
  const s = String(v ?? '').slice(0, 10)
  const [y, m, d] = s.split('-')
  return y && m && d ? `${d}-${m}-${y}` : '—'
}

/** Output product name of a detail. */
const outName = (d: any): string =>
  d?.product_uom?.product?.name ?? d?.product_uom?.name ?? `Product UOM #${d?.product_uom_id}`

/**
 * One cut as a sentence: "2 × Choco Monkey Loaf → 4 × Deli Box Choco Monkey",
 * then a quiet meta line with only what adds information (batch is hidden when
 * it is just the portioning code, stage when it is the usual "finished").
 */
function CutLine({ d, portioningCode }: { d: any; portioningCode?: string }) {
  const materials: any[] = d.materials ?? []
  const base = materials.filter((m) => m.role === 'base')
  const packaging = materials.filter((m) => m.role !== 'base')
  const meta: React.ReactNode[] = []
  if (d.yield_qty != null) meta.push(`Yield 1:${qty(d.yield_qty)}`)
  if (d.expiry_date) meta.push(`Exp ${fmtDate(d.expiry_date)}`)
  if (d.batch_code && d.batch_code !== portioningCode) meta.push(`Batch ${d.batch_code}`)
  if (d.stage && d.stage !== 'finished') meta.push(`Stage ${d.stage}`)
  if (d.owner_ref && d.owner_ref !== 'GENERAL') meta.push(d.owner_ref)
  if (Number(d.scrap_qty) > 0)
    meta.push(<span key="scrap" style={{ color: 'var(--warning)' }}>Scrap {qty(d.scrap_qty)}</span>)
  if (packaging.length > 0)
    meta.push(`Kemasan ${packaging.map((m) => `${materialName(m)} × ${qty(m.qty_per_unit)}`).join(', ')}`)

  const num: React.CSSProperties = { fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--foreground-muted)' }}>
        <span>
          <span style={num}>{qty(d.source_qty)}</span> × {base.map(materialName).join(', ') || '—'}
        </span>
        <ArrowRight size={13} style={{ color: 'var(--accent-light)', flex: 'none' }} aria-label="menjadi" />
        <span>
          <span style={num}>{qty(d.qty)}</span> ×{' '}
          <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{outName(d)}</span>
        </span>
      </div>
      {meta.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
          {meta.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ margin: '0 6px' }}>·</span>}
              {m}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PortioningsView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('production.read')
  const canCreate = hasPermission('production.create')
  const canUpdate = hasPermission('production.update')
  const canDelete = hasPermission('production.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState('-id')
  const [cancelConfirm, setCancelConfirm] = useState<Portioning | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, sort])

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['portionings', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, sort],
    queryFn: () =>
      portioningsService
        .list({
          page,
          per_page: perPage,
          // details.materials too, so every row can render its cuts without
          // a per-row fetch (single-cut rows are always shown open).
          include: 'created_by,details,details.materials',
          sort,
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
    enabled: canRead,
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Portioning[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const cancelMutation = useMutation({
    mutationFn: (id: number) => portioningsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portionings'] })
      toast.success('Portioning dibatalkan & stok dibalik')
      setCancelConfirm(null)
      setExpandedId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membatalkan portioning'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* PAGE HEADER */}
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
            Portionings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Cut &amp; portion inventory into sellable items
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/production/portioning/create')}
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
            <Plus size={15} /> New Portioning
          </button>
        )}
      </div>

      {/* TOOLBAR */}
      <FilterBar
        style={{ marginBottom: 0 }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search code or description..."
        activeCount={countActive(statusFilter, dateFrom, dateTo)}
        onClear={() => {
          setSearch('')
          setStatusFilter('')
          setDateFrom('')
          setDateTo('')
          setSort('-id')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="final">Final</option>
            </FilterSelect>
          </>
        }
        actions={
          <FilterSelect value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        }
      >
        <FilterGroup title="Dates">
          <FilterField label="Portioning date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => setDateFrom(v)}
              onToChange={(v) => setDateTo(v)}
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      {/* TABLE */}
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
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              {['No.', 'Code', 'Potongan', 'Status', 'Created', ''].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    {[60, 40, 80, 50, 70].map((w, i) => (
                      <div
                        key={i}
                        style={{ height: 16, borderRadius: 4, background: 'var(--border)', width: `${w}%` }}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load portionings
                </td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Scissors size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No portionings found
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {items.map((item, idx) => {
              const cuts = item.details ?? []
              const isExpanded = expandedId === item.id
              const shown = isExpanded ? cuts : cuts.slice(0, 1)
              const td: React.CSSProperties = { padding: '14px 16px', verticalAlign: 'top' }
              return (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={{ ...td, fontSize: 13, color: 'var(--foreground-subtle)', width: 48 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                      {item.code}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--foreground-subtle)', marginTop: 3 }}>
                      {item.date ? fmtDate(item.date) : '—'}
                    </div>
                  </td>
                  <td style={{ ...td, width: '100%' }}>
                    {cuts.length === 0 ? (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {shown.map((d) => (
                          <CutLine key={d.id} d={d} portioningCode={item.code} />
                        ))}
                        {cuts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            style={{
                              alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 12, fontWeight: 500, color: 'var(--accent)', font: 'inherit',
                            }}
                          >
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            {isExpanded ? 'Sembunyikan' : `+${cuts.length - 1} potongan lainnya`}
                          </button>
                        )}
                        {item.description && (
                          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', fontStyle: 'italic' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                    {item.created_by?.name ?? '—'}
                  </td>
                  <td style={{ ...td, paddingTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      {canUpdate && item.status === 'pending' && (
                        <button
                          onClick={() => router.push(`/production/portioning/${item.id}/edit`)}
                          style={{
                            padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', color: 'var(--info)', display: 'flex',
                          }}
                          title="Edit draft"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setCancelConfirm(item)}
                          title="Cancel portioning"
                          style={{
                            padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', color: 'var(--destructive)', display: 'flex',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {/* CANCEL CONFIRM */}
      {cancelConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
            onClick={() => setCancelConfirm(null)}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 380,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Cancel Portioning {cancelConfirm.code}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              This reverses the portioning&apos;s own stock movements (the source comes back, the
              outputs leave). It is refused once any output has been sold, cut or moved.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelConfirm(null)}
                style={{
                  padding: '8px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Keep
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelConfirm.id)}
                disabled={cancelMutation.isPending}
                style={{
                  padding: '8px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: cancelMutation.isPending ? 0.7 : 1,
                }}
              >
                Cancel Portioning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
