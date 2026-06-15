'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle2,
  PackageSearch,
  Calendar,
  Building2,
  Truck,
  FileText,
  Printer,
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
  source_type?:
    | 'po_from_supplier'
    | 'po_from_branch'
    | 'transfer_to_branch'
    | 'so_to_branch'
  target_branch_id?: number
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  target_branch?: { id: number; name: string }
  purchase_order?: { id: number; code: string }
  sales_order?: { id: number; code: string }
  created_by?: { id: number; name: string }
  delivery_details?: Array<{
    id: number
    qty: number
    price: number
    status: 'pending' | 'packaging' | 'packed'
    description?: string
    product_uom_id?: number
    product_uom_batch_id?: number
    purchase_order_detail_id?: number
    purchase_order_detail?: { id: number; qty: number }
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
            'branch,target_branch,purchase_order,sales_order,created_by,delivery_details,' +
            'delivery_details.purchase_order_detail',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const delivery = (data as any)?.data as DeliveryFull | undefined

  const { data: puData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' } as any)
        .then((r) => r.data),
  })
  const productUoms = (puData as any)?.data ?? []
  const getProductUom = (id: number) =>
    productUoms.find((pu: any) => pu.id === id)

  const deleteMutation = useMutation({
    mutationFn: () => deliveriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Delivery deleted')
      router.push('/transfer/deliveries')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const finalizeMutation = useMutation({
    mutationFn: () => {
      const d = delivery as DeliveryFull
      const rows = d.delivery_details ?? []
      // Match DeliveryForm.buildPayload detail shape, but carry the
      // existing detail `id` so the backend updates the rows in place
      // (instead of recreating them) and flip pending -> packed so the
      // stock_movement_applier fires for this transfer.
      const payload = {
        code: d.code,
        source_type: d.source_type ?? 'transfer_to_branch',
        target_branch_id: d.target_branch?.id ?? d.target_branch_id ?? 0,
        purchase_order_id: d.purchase_order?.id || undefined,
        sales_order_id: d.sales_order?.id || undefined,
        date: d.date,
        status: 'final',
        description: d.description || undefined,
        total_price: d.total_price,
        details: rows.map((row) => ({
          id: row.id,
          product_uom_id: row.product_uom_id,
          product_uom_batch_id: row.product_uom_batch_id || undefined,
          purchase_order_detail_id: row.purchase_order_detail_id || undefined,
          sales_order_detail_id: row.sales_order_detail_id || undefined,
          qty: row.qty,
          price: row.price,
          status: 'packed',
          description: row.description || undefined,
        })),
      }
      return deliveriesService.update(id, payload as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['deliveries-transfer-out'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipts-for-delivery', id] })
      toast.success('Transfer finalized')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to finalize transfer'),
  })

  const handleFinalize = () => {
    if (
      window.confirm(
        'Finalize this transfer? This will decrement stock at the source branch and create a pending receipt at the destination.',
      )
    ) {
      finalizeMutation.mutate()
    }
  }

  const canFinalize =
    delivery?.status === 'pending' &&
    delivery?.source_type === 'transfer_to_branch'

  const details = delivery?.delivery_details ?? []
  const statusMeta =
    STATUS_META[delivery?.status as keyof typeof STATUS_META] ?? STATUS_META.pending
  // Internal deliveries/transfers are price-free.
  const isInternal = ['po_from_branch', 'transfer_to_branch'].includes(
    (delivery as any)?.source_type,
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
    <>
    <div
      className="dd-screen"
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
          {canFinalize && (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizeMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'white',
                cursor: finalizeMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: finalizeMutation.isPending ? 0.7 : 1,
              }}
            >
              <CheckCircle2 size={13} />
              {finalizeMutation.isPending ? 'Finalizing...' : 'Finalize'}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
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
            <Printer size={13} />
            Print Surat Jalan
          </button>
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
              <th style={{ ...thStyle, width: 140 }}>Delivered / Ordered</th>
              {!isInternal && <th style={{ ...thStyle, width: 130 }}>Unit Price</th>}
              {!isInternal && <th style={{ ...thStyle, width: 140 }}>Subtotal</th>}
              <th style={{ ...thStyle, width: 110 }}>Status</th>
              <th style={{ ...thStyle, width: 160 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail, index) => {
              const detailStatus =
                STATUS_META[detail.status as keyof typeof STATUS_META] ?? STATUS_META.pending
              const pu = getProductUom(detail.product_uom_id ?? 0)
              return (
                <tr key={detail.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {pu?.product?.name ?? `UOM #${detail.product_uom_id}`}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={pillStyle}>
                      {pu?.uom?.name ?? pu?.uom?.code ?? '—'}
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
                    {(() => {
                      const ordered = detail.purchase_order_detail?.qty
                      if (ordered == null) {
                        return <span>{detail.qty.toLocaleString('id-ID')} / —</span>
                      }
                      const partial = detail.qty < ordered
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
                          <span>{' / ' + ordered.toLocaleString('id-ID')}</span>
                        </>
                      )
                    })()}
                  </td>
                  {!isInternal && (
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {'Rp ' + detail.price.toLocaleString('id-ID')}
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
                      {'Rp ' + (detail.qty * detail.price).toLocaleString('id-ID')}
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
                  colSpan={6}
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

    {/* ── Printable A4 Surat Jalan (hidden on screen, shown only in print) ── */}
    <div className="surat-jalan-print">
      {/* Letterhead */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6mm', marginBottom: '6mm' }}>
        <div style={{ fontSize: '22pt', fontWeight: 700, letterSpacing: '1px' }}>
          DAPUR COKELAT
        </div>
        {/* TODO: replace with real company address / phone */}
        <div style={{ fontSize: '9pt', marginTop: '2mm' }}>
          Jl. ____, Jakarta · Telp: ____
        </div>
        <div style={{ fontSize: '13pt', fontWeight: 700, marginTop: '3mm' }}>
          SURAT JALAN / DELIVERY ORDER
        </div>
      </div>

      {/* Document meta — two columns */}
      <table style={{ width: '100%', fontSize: '10pt', marginBottom: '6mm', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top', padding: '1mm 0' }}>
              <strong>No. Surat Jalan:</strong> {delivery.code}
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', padding: '1mm 0' }}>
              <strong>Tanggal:</strong>{' '}
              {delivery.date ? String(delivery.date).slice(0, 10) : '-'}
            </td>
          </tr>
          <tr>
            <td style={{ verticalAlign: 'top', padding: '1mm 0' }}>
              <strong>Dari (From):</strong> {delivery.branch?.name ?? '-'}
            </td>
            <td style={{ verticalAlign: 'top', padding: '1mm 0' }}>
              <strong>Kepada (To):</strong> {delivery.target_branch?.name ?? '-'}
            </td>
          </tr>
          {delivery.purchase_order?.code && (
            <tr>
              <td style={{ verticalAlign: 'top', padding: '1mm 0' }}>
                <strong>Ref PO:</strong> {delivery.purchase_order.code}
              </td>
              <td />
            </tr>
          )}
        </tbody>
      </table>

      {/* Items table */}
      <table style={{ width: '100%', fontSize: '10pt', borderCollapse: 'collapse' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr>
            <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', width: '10mm' }}>No</th>
            <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Nama Produk</th>
            <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', width: '24mm' }}>Qty</th>
            <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left', width: '28mm' }}>Satuan</th>
            <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left', width: '45mm' }}>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {details.map((detail, index) => {
            const pu = getProductUom(detail.product_uom_id ?? 0)
            return (
              <tr key={detail.id}>
                <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>
                  {index + 1}
                </td>
                <td style={{ border: '1px solid #000', padding: '2mm' }}>
                  {pu?.product?.name ?? `UOM #${detail.product_uom_id}`}
                </td>
                <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right' }}>
                  {detail.qty.toLocaleString('id-ID')}
                </td>
                <td style={{ border: '1px solid #000', padding: '2mm' }}>
                  {pu?.uom?.name ?? pu?.uom?.code ?? '-'}
                </td>
                <td style={{ border: '1px solid #000', padding: '2mm' }}>
                  {detail.description ?? '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Notes */}
      {delivery.description && (
        <div style={{ fontSize: '10pt', marginTop: '5mm' }}>
          <strong>Catatan:</strong> {delivery.description}
        </div>
      )}

      {/* Signatures — 3 columns */}
      <table style={{ width: '100%', fontSize: '10pt', marginTop: '16mm', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            {['Pengirim', 'Penerima', 'Sopir / Driver'].map((label) => (
              <td key={label} style={{ width: '33%', textAlign: 'center', verticalAlign: 'top', padding: '0 4mm' }}>
                <div>{label}</div>
                <div style={{ height: '22mm' }} />
                <div>( ____________ )</div>
                <div style={{ fontSize: '8pt', marginTop: '1mm' }}>Nama Jelas</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>

    <style>{`
      .surat-jalan-print { display: none; }
      @media print {
        @page { size: A4 portrait; margin: 18mm; }
        /* Defeat the global pos-print.css rule (body > * { display:none })
           that otherwise collapses #__next and blanks this page. */
        body > * { display: block !important; }
        #pos-receipt { display: none !important; }
        /* Isolate: hide the on-screen detail UI, show only the surat jalan. */
        body * { visibility: hidden !important; }
        .surat-jalan-print, .surat-jalan-print * { visibility: visible !important; }
        .dd-screen { display: none !important; }
        .surat-jalan-print {
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          color: #000;
          background: #fff;
          font-family: Arial, Helvetica, sans-serif;
        }
        .surat-jalan-print thead { display: table-header-group; }
      }
    `}</style>
    </>
  )
}
