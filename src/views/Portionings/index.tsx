'use client'

import React, { useState, useEffect } from 'react'
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
  Search,
  Eye,
  Pencil,
  Trash2,
  Scissors,
  ChevronDown,
  ChevronRight,
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{value}</span>
    </div>
  )
}

function DetailMaterialList({ title, items }: { title: string; items: any[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)' }}>{title}</span>
      {items.map((m, i) => (
        <span key={m.id ?? i} style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
          • {materialName(m)} — <strong style={{ color: 'var(--foreground)' }}>{qty(m.qty_per_unit)}</strong> per hasil
        </span>
      ))}
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portionings', page, perPage, debouncedSearch, statusFilter, dateFrom, dateTo, sort],
    queryFn: () =>
      portioningsService
        .list({
          page,
          per_page: perPage,
          include: 'created_by,details',
          sort,
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
    enabled: canRead,
  })

  const items: Portioning[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const { data: detailData, isFetching: isDetailLoading } = useQuery({
    queryKey: ['portionings', 'detail', expandedId],
    queryFn: () =>
      portioningsService
        .findById(expandedId!, {
          include: 'created_by,updated_by,details,details.materials',
        })
        .then((r) => r.data),
    enabled: expandedId !== null,
  })

  const expandedItem: Portioning | undefined =
    (detailData as any)?.data?.data ?? (detailData as any)?.data

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

  const anyFilter = statusFilter || dateFrom || dateTo || debouncedSearch

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 280 }}>
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
            placeholder="Search code or description..."
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface-raised)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Final</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }}
          />
        </div>

        <select value={sort} onChange={(e) => setSort(e.target.value)} style={inputStyle}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {anyFilter && (
          <button
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setDateFrom('')
              setDateTo('')
              setSort('-id')
              setPage(1)
            }}
            style={{
              padding: '7px 12px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--foreground-muted)',
              cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

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
              {['No.', 'Code', 'Branch', 'Date', 'Status', 'Items', 'Source', 'Output', 'Created', ''].map(
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
                <td colSpan={10} style={{ padding: '48px 16px', textAlign: 'center' }}>
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
                  colSpan={10}
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
                <td colSpan={10}>
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
              const isExpanded = expandedId === item.id
              return (
                <React.Fragment key={item.id}>
                  <tr
                    style={{
                      borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                      background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--foreground-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: 0,
                          font: 'inherit',
                        }}
                        title={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{(page - 1) * perPage + idx + 1}</span>
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent)',
                        }}
                      >
                        {item.code}
                      </span>
                      {item.description && (
                        <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 2 }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.branch?.name ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.date ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        textAlign: 'center',
                      }}
                    >
                      {item.details?.length ?? 0}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.source_stage
                        ? `${item.source_stage}${item.source_owner_ref && item.source_owner_ref !== item.source_stage ? ` · ${item.source_owner_ref}` : ''}`
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.output_stage
                        ? `${item.output_stage}${item.output_owner_ref && item.output_owner_ref !== item.output_stage ? ` · ${item.output_owner_ref}` : ''}`
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.created_by?.name ?? item.created_at ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          style={{
                            padding: 6,
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--foreground-muted)',
                            display: 'flex',
                          }}
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                        {canUpdate && item.status === 'pending' && (
                          <button
                            onClick={() => router.push(`/production/portioning/${item.id}/edit`)}
                            style={{
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--info)',
                              display: 'flex',
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
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--destructive)',
                              display: 'flex',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                      <td colSpan={10} style={{ padding: '4px 16px 16px 48px' }}>
                        {isDetailLoading && (
                          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', padding: '8px 0' }}>
                            Loading details...
                          </div>
                        )}
                        {!isDetailLoading && expandedItem && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--foreground-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.6px',
                              }}
                            >
                              Portioning Details
                            </span>
                            {(expandedItem.details ?? []).length === 0 && (
                              <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                                No details
                              </span>
                            )}
                            {(expandedItem.details ?? []).map((d) => {
                              const materials = d.materials ?? []
                              return (
                                <div
                                  key={d.id}
                                  style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--surface)',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                                      {d.product_uom?.name ?? `Product UOM #${d.product_uom_id}`}
                                    </span>
                                    {d.product_uom?.code && (
                                      <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', fontFamily: 'monospace' }}>
                                        {d.product_uom.code}
                                      </span>
                                    )}
                                    <StatusBadge status={d.status} />
                                  </div>

                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                      gap: 10,
                                    }}
                                  >
                                    <DetailField label="Qty hasil" value={qty(d.qty)} />
                                    <DetailField label="Source qty" value={qty(d.source_qty)} />
                                    <DetailField label="Scrap" value={qty(d.scrap_qty)} />
                                    <DetailField
                                      label="Yield"
                                      value={d.yield_qty == null ? '—' : qty(d.yield_qty)}
                                    />
                                    <DetailField
                                      label="Base cake"
                                      value={
                                        materials
                                          .filter((m) => m.role === 'base')
                                          .map(materialName)
                                          .join(', ') || '—'
                                      }
                                    />
                                    <DetailField label="Batch" value={d.batch_code || '—'} />
                                    <DetailField label="Expired" value={d.expiry_date || '—'} />
                                    <DetailField label="Stage" value={d.stage || '—'} />
                                    <DetailField label="Owner" value={d.owner_ref || '—'} />
                                  </div>

                                  {d.description && (
                                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{d.description}</span>
                                  )}

                                  <DetailMaterialList
                                    title="Base cake yang dipotong (per 1 hasil)"
                                    items={materials.filter((m) => m.role === 'base')}
                                  />
                                  <DetailMaterialList
                                    title="Kemasan yang dipakai (per 1 hasil)"
                                    items={materials.filter((m) => m.role !== 'base')}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
