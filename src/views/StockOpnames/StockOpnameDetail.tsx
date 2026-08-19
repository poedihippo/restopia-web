'use client'
import { formatDate } from '@/utils/date'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { stockOpnamesService } from '@/services/stock-opnames.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Save,
  Printer
} from 'lucide-react'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: {
    label: 'Draft',
    color: 'var(--foreground-muted)',
    bg: 'var(--surface)',
  },
  counting: {
    label: 'Counting',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  completed: {
    label: 'Completed',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

export default function StockOpnameDetail() {
  const router = useRouter()
  const { id } = router.query
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['stock-opnames', id],
    queryFn: () => stockOpnamesService.findById(Number(id), { include: 'branch,created_by,stock_opname_details' }).then(r => r.data),
    enabled: !!id,
  })

  const item = (data as any)?.data

  const [countedQtys, setCountedQtys] = useState<Record<number, number>>({})

  useEffect(() => {
    if (item && item.stock_opname_details) {
      const initial: Record<number, number> = {}
      item.stock_opname_details.forEach((d: any) => {
        if (d.counted_qty !== undefined && d.counted_qty !== null) {
          initial[d.product_inventory_id] = d.counted_qty
        }
      })
      setCountedQtys(initial)
    }
  }, [item])

  const updateMutation = useMutation({
    mutationFn: (payload: any) => stockOpnamesService.update(Number(id), payload),
    onSuccess: () => {
      toast.success('Stock Opname progress saved')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames', id] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to save progress'),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockOpnamesService.complete(Number(id)),
    onSuccess: () => {
      toast.success('Stock Opname marked as completed')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames', id] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to complete'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockOpnamesService.cancel(Number(id)),
    onSuccess: () => {
      toast.success('Stock Opname cancelled')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames', id] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to cancel'),
  })

  if (isLoading || !item) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
      </div>
    )
  }

  const statusMeta = STATUS_META[item.status?.toLowerCase()] || STATUS_META.draft
  const isDraft = item.status === 'draft' || item.status === 'counting'

  return (
    <div className="stock-opname-detail" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @media print {
          .stock-opname-detail th, .stock-opname-detail td {
            padding: 4px 8px !important;
            font-size: 11px !important;
          }
          .stock-opname-detail h1 { font-size: 18px !important; }
          .stock-opname-detail .info-cards { gap: 8px !important; }
          .stock-opname-detail .info-card { padding: 8px 12px !important; }
          
          .print-only { display: block !important; }
          .print-hidden { display: none !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => router.back()}
            className="print-hidden"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>
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
              Stock Opname {item.code}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: statusMeta.color,
                  backgroundColor: statusMeta.bg,
                }}
              >
                {statusMeta.label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                {formatDate(item.date)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                •
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                Created At: {item.created_at}
              </span>
            </div>
          </div>
        </div>

        <div className="print-hidden" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
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
            <Printer size={16} />
            <span>Print</span>
          </button>
          
          {isDraft && (
            <>
              <button
                onClick={() => {
                  const payload = {
                    details: item.stock_opname_details.map((d: any) => ({
                      product_inventory_id: d.product_inventory_id,
                      counted_qty: countedQtys[d.product_inventory_id] ?? 0,
                    }))
                  }
                  updateMutation.mutate(payload)
                }}
                disabled={updateMutation.isPending || cancelMutation.isPending || completeMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateMutation.isPending ? 0.6 : 1,
                }}
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Progress</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this Stock Opname?')) {
                    cancelMutation.mutate()
                  }
                }}
                disabled={cancelMutation.isPending || completeMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--destructive)',
                  cursor: cancelMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: cancelMutation.isPending ? 0.6 : 1,
                }}
              >
                <XCircle size={16} />
                <span>Cancel</span>
              </button>
              {item.status !== 'draft' && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to complete this Stock Opname? This will update the inventory stock permanently.')) {
                      completeMutation.mutate()
                    }
                  }}
                  disabled={cancelMutation.isPending || completeMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: 'var(--success)',
                    border: '1px solid var(--success)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#fff',
                    cursor: completeMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: completeMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {completeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  <span>Complete</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="info-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
        <div className="info-card" style={cardStyle}>
          <p style={cardLabelStyle}>Branch</p>
          <p style={cardValueStyle}>{item.branch?.name || '—'}</p>
        </div>
        <div className="info-card" style={cardStyle}>
          <p style={cardLabelStyle}>Created By</p>
          <p style={cardValueStyle}>{item.created_by?.name || '—'}</p>
        </div>
        <div className="info-card" style={cardStyle}>
          <p style={cardLabelStyle}>Description</p>
          <p style={cardValueStyle}>{item.description || '—'}</p>
        </div>
      </div>

      {/* Details Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} />
          Document Details
        </h3>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>No.</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>UOM</th>
                <th style={thStyle}>Batch Code</th>
                <th style={thStyle}>Expiry Date</th>
                <th style={thStyle}>System Qty</th>
                <th style={thStyle}>Counted Qty</th>
                <th className="print-hidden" style={thStyle}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {(!item.stock_opname_details || item.stock_opname_details.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                    No details available
                  </td>
                </tr>
              ) : (
                item.stock_opname_details.map((detail: any, index: number) => {
                  const val = countedQtys[detail.product_inventory_id]
                  const diff = (val ?? 0) - (detail.system_qty ?? 0)
                  const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--destructive)' : 'var(--foreground-muted)'
                  const isZeroOrEmpty = val === undefined || val === null || val === 0

                  return (
                    <tr key={detail.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontWeight: 500 }}>
                            {detail.product_inventory?.product_uom_batch?.product_uom?.product?.name || 'Unknown Product'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                            INV-{detail.product_inventory_id}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>{detail.product_inventory?.product_uom_batch?.product_uom?.uom?.name || '—'}</td>
                      <td style={tdStyle}>{detail.product_inventory?.product_uom_batch?.batch_code || '—'}</td>
                      <td style={tdStyle}>{detail.product_inventory?.product_uom_batch?.expiry_date ? formatDate(detail.product_inventory.product_uom_batch.expiry_date) : '—'}</td>
                      <td style={tdStyle}>{detail.system_qty ?? 0}</td>
                      <td style={tdStyle}>
                        {isDraft ? (
                          <>
                            <div className="print-hidden">
                              <input
                                type="number"
                                value={countedQtys[detail.product_inventory_id] !== undefined ? countedQtys[detail.product_inventory_id] : ''}
                                onChange={(e) => {
                                  const inputVal = e.target.value
                                  if (inputVal === '') {
                                    const newQtys = { ...countedQtys }
                                    delete newQtys[detail.product_inventory_id]
                                    setCountedQtys(newQtys)
                                  } else {
                                    setCountedQtys({ ...countedQtys, [detail.product_inventory_id]: Number(inputVal) })
                                  }
                                }}
                                style={{
                                  width: 100,
                                  padding: '6px 10px',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 13,
                                  background: 'var(--background)',
                                  color: 'var(--foreground)',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div className="print-only" style={{ fontWeight: 600 }}>
                              {isZeroOrEmpty ? '___________' : val}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontWeight: 600 }}>
                            {isZeroOrEmpty ? '___________' : detail.counted_qty}
                          </span>
                        )}
                      </td>
                      <td className="print-hidden" style={{ ...tdStyle, color: diffColor, fontWeight: 600 }}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const cardLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const cardValueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--foreground)',
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
}

const tdStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 13,
  color: 'var(--foreground)',
}
