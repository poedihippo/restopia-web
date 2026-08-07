'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate, formatDateTime } from '@/utils/date';

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { receiptsService } from '@/services/receipts.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ReceiptText,
  Calendar,
  Building2,
  Truck,
  FileText,
} from 'lucide-react'

interface ReceiptDetailProps {
  id: number
}

interface ReceiptFull {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  delivery?: { id: number; code: string }
  created_by?: { id: number; name: string }
  receipt_details?: Array<{
    id: number
    qty: number
    price: number
    status: 'pending' | 'success' | 'failed'
    description?: string
    client_ref?: string
    planned_batch_code?: string
    planned_expiry_date?: string
    product_uom?: {
      id: number
      code?: string
      product?: { id: number; name: string }
      uom?: { id: number; name: string; code: string }
    }
    product_uom_id?: number
    delivery_detail_id?: number
    delivery_detail?: { id: number; qty: number }
  }>
}

const STATUS_META = {
  pending: {
    label: 'Pending',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  final: {
    label: 'Final',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  success: {
    label: 'Success',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  failed: {
    label: 'Failed',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

export default function ReceiptDetail({ id }: ReceiptDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['receipt-detail', id],
    queryFn: () =>
      receiptsService
        .findById(id, {
          include: 'branch,delivery,receipt_details,created_by',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const receipt = (data as any)?.data as ReceiptFull | undefined

  const deleteMutation = useMutation({
    mutationFn: () => receiptsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Receipt deleted')
      router.push('/transfer/receipts')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const details = receipt?.receipt_details ?? []
  const statusMeta =
    STATUS_META[receipt?.status as keyof typeof STATUS_META] ?? STATUS_META.pending
  // Internal receipts (from internal deliveries) are price-free.
  const isInternal = ['po_from_branch', 'transfer_to_branch'].includes(
    (receipt?.delivery as any)?.source_type,
  )

  const backBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground-muted)',
    cursor: 'pointer',
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  }

  const pillStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--foreground-muted)',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  }

  const infoCardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  const iconBoxStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    background: 'var(--accent-light-bg)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Loading receipt...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !receipt) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <ReceiptText size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Receipt not found
        </p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => router.back()} style={backBtnStyle}>
            <ArrowLeft size={14} />
            Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                {receipt.code}
              </h1>
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
                }}
              >
                {statusMeta.label}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              Receipt
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => router.push(`/transfer/receipts/${id}/edit`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--destructive-bg)',
              border: '1px solid var(--destructive)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--destructive)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>

      {/* Info grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Building2 size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Branch</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {receipt.branch?.name ?? '—'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Truck size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Linked Delivery</span>
          </div>
          {receipt.delivery?.code ? (
            <span
              style={{
                ...pillStyle,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--accent)',
                alignSelf: 'flex-start',
              }}
            >
              {receipt.delivery.code}
            </span>
          ) : (
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--foreground-muted)',
                fontFamily: 'var(--font-display)',
              }}
            >
              —
            </div>
          )}
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Receipt Date</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {receipt.date
              ? receipt.date
              : '—'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <FileText size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Created By</span>
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {receipt.created_by?.name ?? '—'}
            </div>
            {receipt.created_at && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--foreground-subtle)',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {formatDateTime(receipt.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {receipt.description && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}
        >
          <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 8 }}>Notes</span>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
            {receipt.description}
          </p>
        </div>
      )}

      {/* Line items table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={sectionLabelStyle}>Received Items</span>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {details.length} item(s)
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, width: 50 }}>#</th>
              <th style={thStyle}>Product</th>
              <th style={{ ...thStyle, width: 130 }}>Batch</th>
              <th style={{ ...thStyle, width: 130 }}>Planned Expiry</th>
              <th style={{ ...thStyle, width: 130 }}>Client Ref</th>
              <th style={{ ...thStyle, width: 80 }}>Qty</th>
              <th style={{ ...thStyle, width: 140 }}>Received / Delivered</th>
              {!isInternal && <th style={{ ...thStyle, width: 130 }}>Unit Price</th>}
              {!isInternal && <th style={{ ...thStyle, width: 140 }}>Subtotal</th>}
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 160 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail, index) => {
              const detailStatus =
                STATUS_META[detail.status as keyof typeof STATUS_META] ?? STATUS_META.pending
              
              const deliveryDetail = (receipt?.delivery as any)?.delivery_details?.find((dd: any) => dd.id === detail.delivery_detail_id)
              const productName = deliveryDetail?.product_uom?.product?.name ?? detail.product_uom?.product?.name ?? '—'
              
              return (
                <tr key={detail.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {productName}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {detail.planned_batch_code || '—'}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {detail.planned_expiry_date
                      ? formatDate(detail.planned_expiry_date)
                      : '—'}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {detail.client_ref || '—'}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                    }}
                  >
                    {detail.qty.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {(() => {
                      const delivered = detail.delivery_detail?.qty
                      if (delivered == null) {
                        return <span>{detail.qty.toLocaleString('id-ID')} / —</span>
                      }
                      const partial = detail.qty < delivered
                      return (
                        <>
                          <span
                            style={{
                              fontWeight: 600,
                              color: partial ? 'var(--warning)' : 'var(--success)',
                            }}
                          >
                            {detail.qty.toLocaleString('id-ID')}
                          </span>
                          <span>{' / ' + delivered.toLocaleString('id-ID')}</span>
                        </>
                      )
                    })()}
                  </td>
                  {!isInternal && (
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {formatCurrency(detail.price)}
                    </td>
                  )}
                  {!isInternal && (
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                      }}
                    >
                      {formatCurrency(detail.qty * detail.price)}
                    </td>
                  )}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: detailStatus.bg,
                        color: detailStatus.color,
                      }}
                    >
                      {detailStatus.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {detail.description || '—'}
                  </td>
                </tr>
              )
            })}

            {!isInternal && (
              <tr style={{ background: 'var(--background)', borderTop: '2px solid var(--border)' }}>
                <td
                  colSpan={7}
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Total
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {formatCurrency(receipt.total_price)}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }} />
                <td style={{ padding: '14px 16px' }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
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
            onClick={() => setDeleteConfirm(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 400,
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
              Delete Receipt
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              This will permanently remove receipt <strong>{receipt.code}</strong> and all its
              details.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
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
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
