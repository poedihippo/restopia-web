'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dimensionTransferRequestsService } from '@/services/dimension-transfer-requests.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/date'
import { CustomPagination } from '@/components/ui/CustomPagination'
import DimensionTransferRequestSheet from './DimensionTransferRequestSheet'
import { Plus, Search, ArrowRightLeft, Check, X as XIcon } from 'lucide-react'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

interface DimensionRef {
  owner_ref?: string
  owner_display?: string
  owner_company_name?: string
  stage?: string
  stage_name?: string
  location_ref?: string
}

interface DimensionTransferRequestItem {
  id: number
  qty: number
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
  created_at?: string
  approved_at?: string
  from?: DimensionRef
  to?: DimensionRef
  from_owner_ref?: string
  from_stage?: string
  from_location_ref?: string
  to_owner_ref?: string
  to_stage?: string
  to_location_ref?: string
  requested_by?: { id: number; name: string }
  created_by?: { id: number; name: string }
  approved_by?: { id: number; name: string }
  product_uom_batch?: {
    id: number
    code?: string
    product_uom?: {
      id: number
      code?: string
      product?: { id: number; name: string; code?: string }
      uom?: { id: number; name: string; code: string }
    }
  }
}

const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  approved: { label: 'Approved', color: 'var(--success)', bg: 'var(--success-bg)' },
  rejected: { label: 'Rejected', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

export default function DimensionTransferRequestsView() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('dimension-transfer-request.create')
  const canApprove = hasPermission('dimension-transfer-request.approve')
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<DimensionTransferRequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dimension-transfer-requests', page, perPage, debouncedSearch, statusFilter],
    queryFn: () =>
      dimensionTransferRequestsService
        .list({
          page,
          per_page: perPage,
          include:
            'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product,product_uom_batch.product_uom.uom,requested_by,created_by,approved_by',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: DimensionTransferRequestItem[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const approveMutation = useMutation({
    mutationFn: (id: number) => dimensionTransferRequestsService.approve(id),
    onSuccess: () => {
      toast.success('Permintaan disetujui')
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menyetujui permintaan'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      dimensionTransferRequestsService.reject(id, reason),
    onSuccess: () => {
      toast.success('Permintaan ditolak')
      setRejectTarget(null)
      setRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menolak permintaan'),
  })

  const submitReject = () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
  }

  const ownerLabel = (ref?: DimensionRef): string => {
    if (!ref) return '—'
    if (ref.owner_display) return ref.owner_display
    if (ref.owner_company_name) return ref.owner_company_name
    const ownerRef = ref.owner_ref
    if (!ownerRef) return '—'
    if (ownerRef === 'GENERAL') return GENERAL_OWNER_OPTION.label
    return ownerRef
  }

  const dimensionLabel = (ref: DimensionRef | undefined, fallbackOwner?: string, fallbackStage?: string, fallbackLocation?: string): string => {
    const owner = ownerLabel(ref) !== '—' ? ownerLabel(ref) : (fallbackOwner ?? '—')
    const stage = ref?.stage_name ?? ref?.stage ?? fallbackStage ?? '—'
    const location = ref?.location_ref ?? fallbackLocation ?? 'GENERAL'
    return `${owner}/${stage}/${location}`
  }

  const productLabel = (item: DimensionTransferRequestItem): { name: string; sublabel: string } => {
    const product = item.product_uom_batch?.product_uom?.product
    const batchCode = item.product_uom_batch?.code ?? '—'
    const name = `${product?.code ?? ''} ${product?.name ?? ''}`.trim() || '—'
    return { name, sublabel: `Batch ${batchCode}` }
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const actionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    border: '1px solid var(--border)',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Dimension Transfer Requests
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Permintaan pemindahan stok antar owner/stage yang perlu disetujui
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
            Buat Permintaan
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ position: 'relative', maxWidth: 280 }}>
          <Search
            size={15}
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
            placeholder="Cari produk atau batch..."
            style={{
              ...inputBase,
              width: 280,
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ ...inputBase, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                <th style={{ ...thStyle, width: 200 }}>Produk / Batch</th>
                <th style={{ ...thStyle, width: 160 }}>Dari</th>
                <th style={{ ...thStyle, width: 160 }}>Ke</th>
                <th style={{ ...thStyle, width: 80 }}>Qty</th>
                <th style={{ ...thStyle, width: 140 }}>Peminta</th>
                <th style={{ ...thStyle, width: 160 }}>Status</th>
                <th style={{ ...thStyle, width: 130 }}>Tanggal</th>
                <th style={{ ...thStyle, width: 180 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--border)',
                            width: j === 8 ? 120 : j === 0 ? 20 : '75%',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                      Gagal memuat permintaan transfer dimensi.
                    </span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      <ArrowRightLeft size={32} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: 14 }}>Belum ada permintaan transfer dimensi</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                  const { name: productName, sublabel } = productLabel(item)
                  const requester = item.requested_by?.name ?? item.created_by?.name ?? '—'
                  const fromLabel = dimensionLabel(item.from, item.from_owner_ref, item.from_stage, item.from_location_ref)
                  const toLabel = dimensionLabel(item.to, item.to_owner_ref, item.to_stage, item.to_location_ref)
                  const isActioning =
                    (approveMutation.isPending && approveMutation.variables === item.id) ||
                    (rejectMutation.isPending && rejectMutation.variables?.id === item.id)

                  return (
                    <tr key={item.id}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                          {(page - 1) * perPage + idx + 1}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {productName}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                            {sublabel}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{fromLabel}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{toLabel}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                          {item.qty?.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{requester}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 10px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 600,
                              background: statusMeta.bg,
                              color: statusMeta.color,
                              width: 'fit-content',
                            }}
                          >
                            {statusMeta.label}
                          </span>
                          {item.status === 'approved' && (
                            <span style={{ fontSize: 10, color: 'var(--foreground-subtle)' }}>
                              oleh {item.approved_by?.name ?? '—'}
                              {item.approved_at ? ` · ${formatDate(item.approved_at)}` : ''}
                            </span>
                          )}
                          {item.status === 'rejected' && item.reject_reason && (
                            <span
                              title={item.reject_reason}
                              style={{
                                fontSize: 10,
                                color: 'var(--destructive)',
                                maxWidth: 150,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              alasan: {item.reject_reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                          {item.created_at ? formatDate(item.created_at) : '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {item.status === 'pending' && canApprove ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => approveMutation.mutate(item.id)}
                              style={{
                                ...actionBtnStyle,
                                background: 'var(--success-bg)',
                                color: 'var(--success)',
                                borderColor: 'var(--success)',
                                opacity: isActioning ? 0.6 : 1,
                                cursor: isActioning ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <Check size={12} />
                              Setujui
                            </button>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => {
                                setRejectTarget(item)
                                setRejectReason('')
                              }}
                              style={{
                                ...actionBtnStyle,
                                background: 'var(--destructive-bg)',
                                color: 'var(--destructive)',
                                borderColor: 'var(--destructive)',
                                opacity: isActioning ? 0.6 : 1,
                                cursor: isActioning ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <XIcon size={12} />
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>—</span>
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

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      <DimensionTransferRequestSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Reject reason modal */}
      {rejectTarget !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => {
              setRejectTarget(null)
              setRejectReason('')
            }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 420,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Tolak Permintaan
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 16px' }}>
              Berikan alasan penolakan untuk permintaan ini.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Alasan penolakan..."
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--background)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
                resize: 'vertical',
                minHeight: 72,
                marginBottom: 20,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setRejectTarget(null)
                  setRejectReason('')
                }}
                style={{
                  padding: '7px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={submitReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: rejectMutation.isPending || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: rejectMutation.isPending || !rejectReason.trim() ? 0.6 : 1,
                }}
              >
                Tolak Permintaan
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
