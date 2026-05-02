'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  PackageSearch,
  Calendar,
  Building2,
  Truck,
  FileText,
} from 'lucide-react'

interface DeliveryDetailProps {
  id: number
}

interface DeliveryFull {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  target_branch?: { id: number; name: string }
  purchase_order?: { id: number; code: string }
  created_by?: { id: number; name: string }
  delivery_details?: Array<{
    id: number
    qty: number
    price: number
    status: 'pending' | 'packaging' | 'packed'
    description?: string
    product_uom?: {
      id: number
      code?: string
      product?: { id: number; name: string }
      uom?: { id: number; name: string; code: string }
    }
    purchase_order_detail_id?: number
    sales_order_detail_id?: number
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
  packaging: {
    label: 'Packaging',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  packed: {
    label: 'Packed',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
}

export default function DeliveryDetail({ id }: DeliveryDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['delivery-detail', id],
    queryFn: () =>
      deliveriesService
        .findById(id, {
          include:
            'branch,target_branch,purchase_order,sales_order,created_by,' +
            'delivery_details.product_uom.product,delivery_details.product_uom.uom',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const delivery = (data as any)?.data as DeliveryFull | undefined

  const deleteMutation = useMutation({
    mutationFn: () => deliveriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Delivery deleted')
      router.push('/transfer/deliveries')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const details = delivery?.delivery_details ?? []
  const statusMeta =
    STATUS_META[delivery?.status as keyof typeof STATUS_META] ?? STATUS_META.pending

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
            Loading delivery...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !delivery) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <PackageSearch size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Delivery not found
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
                {delivery.code}
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
              Delivery
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => router.push(`/transfer/deliveries/${id}/edit`)}
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
            <span style={sectionLabelStyle}>From Branch</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {delivery.branch?.name ?? '—'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Truck size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>To Branch</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {delivery.target_branch?.name ?? '—'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Delivery Date</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {delivery.date
              ? new Date(delivery.date).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
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
              {delivery.created_by?.name ?? '—'}
            </div>
            {delivery.created_at && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--foreground-subtle)',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {new Date(delivery.created_at).toLocaleString('id-ID')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Linked PO card */}
      {delivery.purchase_order && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={sectionLabelStyle}>Linked Purchase Order</span>
          <span
            style={{
              ...pillStyle,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent)',
            }}
          >
            {delivery.purchase_order.code}
          </span>
        </div>
      )}

      {/* Description */}
      {delivery.description && (
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
            {delivery.description}
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
          <span style={sectionLabelStyle}>Line Items</span>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {details.length} item(s)
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, width: 50 }}>#</th>
              <th style={thStyle}>Product</th>
              <th style={{ ...thStyle, width: 100 }}>UOM</th>
              <th style={{ ...thStyle, width: 80 }}>Qty</th>
              <th style={{ ...thStyle, width: 130 }}>Unit Price</th>
              <th style={{ ...thStyle, width: 140 }}>Subtotal</th>
              <th style={{ ...thStyle, width: 110 }}>Status</th>
              <th style={{ ...thStyle, width: 160 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail, index) => {
              const detailStatus =
                STATUS_META[detail.status as keyof typeof STATUS_META] ?? STATUS_META.pending
              return (
                <tr key={detail.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {detail.product_uom?.product?.name ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={pillStyle}>
                      {detail.product_uom?.uom?.name ?? detail.product_uom?.code ?? '—'}
                    </span>
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
                    {'Rp ' + detail.price.toLocaleString('id-ID')}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                    }}
                  >
                    {'Rp ' + (detail.qty * detail.price).toLocaleString('id-ID')}
                  </td>
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

            <tr style={{ background: 'var(--background)', borderTop: '2px solid var(--border)' }}>
              <td
                colSpan={5}
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
                  {'Rp ' + delivery.total_price.toLocaleString('id-ID')}
                </span>
              </td>
              <td style={{ padding: '14px 16px' }} />
              <td style={{ padding: '14px 16px' }} />
            </tr>
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
              Delete Delivery
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              This will permanently remove delivery <strong>{delivery.code}</strong> and all its
              details. This action cannot be undone.
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
