'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate, formatDateTime } from '@/utils/date';
import { getProductUomName } from '@/utils/productUomName';

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { receiptsService } from '@/services/receipts.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { canUserCreateReceiptForDelivery } from '@/utils/receiptValidation'
import BackLink from '@/components/BackLink'
import {
  Pencil,
  Trash2,
  CheckCircle2,
  PackageSearch,
  Printer,
  Download,
  ClipboardList, ArrowUpRight,
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
    // Batch untuk kolom BATCH / EXPIRED DATE di cetakan Delivery Note
    product_uom_batch?: {
      id?: number
      batch_code?: string
      expiry_date?: string | null
    }
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
  const { user, isSuperadmin, hasPermission } = useAuth()
  const canRead = hasPermission('delivery.read')
  const canCreateReceipt = hasPermission('receipt.create')
  const canUpdate = hasPermission('delivery.update')
  const canDelete = hasPermission('delivery.delete')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['delivery-detail', id],
    queryFn: () =>
      deliveriesService
        .findById(id, {
          include:
            'branch,target_branch,purchase_order,sales_order,created_by,' +
            'delivery_details,delivery_details.product_uom,' +
            'delivery_details.product_uom_batch'
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
        details: rows.map((row) => ({
          id: row.id,
          product_uom_id: row.product_uom_id,
          product_uom_batch_id: row.product_uom_batch_id || undefined,
          purchase_order_detail_id: row.purchase_order_detail_id || undefined,
          sales_order_detail_id: row.sales_order_detail_id || undefined,
          qty: row.qty,
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

  const handleReceiptClick = () => {
    router.push(`/transfer/receipts?delivery_id=${id}`)
  }

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
  // Batch column only when at least one line was picked from a batch.
  const hasBatches = details.some((d) => !!d.product_uom_batch)
  // Once any line has been received, editing would desync the receipts that
  // reference these delivery rows.
  const hasReceivedLines = details.some((d: any) => Number(d?.received_qty ?? 0) > 0)
  const canEditDelivery = canUpdate && !hasReceivedLines
  const statusMeta =
    STATUS_META[delivery?.status as keyof typeof STATUS_META] ?? STATUS_META.pending
  // Internal deliveries/transfers are price-free.
  const isInternal = ['po_from_branch', 'transfer_to_branch'].includes(
    (delivery as any)?.source_type,
  )

  const pillStyle = (meta: { color: string; bg: string }): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 600,
    background: meta.bg,
    color: meta.color,
    whiteSpace: 'nowrap',
  })

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
  }

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: 0,
  }

  const containerStyle: React.CSSProperties = {
    padding: '28px 24px 48px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }

  const monoStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12.5,
  }

  const numFmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

  const sharedStyles = (
    <style>{`
      .dd-meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .dd-meta-cell { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; min-width: 0; }
      .dd-meta-cell + .dd-meta-cell { border-left: 1px solid var(--border); }
      @media (max-width: 720px) {
        .dd-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dd-meta-cell:nth-child(3) { border-left: none; }
        .dd-meta-cell:nth-child(n + 3) { border-top: 1px solid var(--border); }
      }
      .dd-table { width: 100%; border-collapse: separate; border-spacing: 0; }
      .dd-table thead th {
        padding: 10px 20px; height: auto; background: var(--surface-muted);
        border-bottom: 1px solid var(--border); font-size: 11.5px; font-weight: 600;
        text-transform: uppercase; letter-spacing: .04em; color: var(--foreground-muted);
        text-align: left; white-space: nowrap;
      }
      .dd-table tbody td {
        padding: 12px 20px; height: auto; font-size: 13.5px; color: var(--foreground);
        border-bottom: 1px solid var(--border); vertical-align: middle;
      }
      .dd-table tbody tr:last-child td { border-bottom: none; }
      .dd-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    `}</style>
  )

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div className="v2-skeleton" style={{ width: 110, height: 14, borderRadius: 6 }} />
        <div className="v2-skeleton" style={{ width: 260, height: 26, borderRadius: 6 }} />
        <div className="v2-skeleton" style={{ width: 320, height: 14, borderRadius: 6 }} />
        <div className="v2-card dd-meta-grid" style={{ overflow: 'hidden' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dd-meta-cell">
              <div className="v2-skeleton" style={{ width: 70, height: 11, borderRadius: 4 }} />
              <div className="v2-skeleton" style={{ width: 120, height: 16, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div className="v2-card" style={{ overflow: 'hidden' }}>
          <div style={cardHeaderStyle}>
            <div className="v2-skeleton" style={{ width: 90, height: 14, borderRadius: 4 }} />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: '14px 20px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div className="v2-skeleton" style={{ width: '100%', height: 14, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        {sharedStyles}
      </div>
    )
  }

  if (isError || !delivery) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <PackageSearch size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0 }}>Delivery not found</p>
        <BackLink href="/transfer/deliveries" label="Deliveries" style={{ alignSelf: 'center' }} />
      </div>
    )
  }

  const createdAt = delivery.created_at ? formatDateTime(delivery.created_at) : null

  const metaCells: { label: string; value: React.ReactNode }[] = [
    { label: 'Delivery date', value: delivery.date ? formatDate(delivery.date) : '—' },
    {
      label: delivery.purchase_order ? 'Purchase order' : delivery.sales_order ? 'Sales order' : 'Reference',
      value: delivery.purchase_order ? (
        <Link
          href={`/purchase/purchase-orders/${delivery.purchase_order.id}/detail`}
          title="Buka detail purchase order"
          style={{ ...monoStyle, fontSize: 14, color: 'var(--accent)', textDecoration: 'none' }}
        >
          <span className="v2-link">{delivery.purchase_order.code}<ArrowUpRight size={12} /></span>
        </Link>
      ) : delivery.sales_order ? (
        <span style={{ ...monoStyle, fontSize: 14 }}>{delivery.sales_order.code}</span>
      ) : (
        '—'
      ),
    },
    {
      label: 'Created by',
      value: (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{delivery.created_by?.name ?? '—'}</span>
          {createdAt && (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--foreground-muted)' }}>{createdAt}</span>
          )}
        </span>
      ),
    },
    { label: 'Line items', value: `${details.length} item${details.length === 1 ? '' : 's'}` },
  ]

  return (
    <>
      <div className="dd-screen" style={containerStyle}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>
          <BackLink href="/transfer/deliveries" label="Deliveries" />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                  {delivery.code}
                </h1>
                <span style={pillStyle(statusMeta)}>{statusMeta.label}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '6px 0 0' }}>
                from <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{delivery.branch?.name ?? '—'}</span>
                {' → '}to <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{delivery.target_branch?.name ?? '—'}</span>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canRead && (
                <button type="button" onClick={() => window.print()} className="v2-btn v2-btn-outline">
                  <Printer size={15} />
                  Print Surat Jalan
                </button>
              )}

              {/* Download PDF — memakai dialog cetak browser, pilih "Save as PDF" */}
              {canRead && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  title='Pilih "Save as PDF" pada dialog cetak untuk mengunduh PDF'
                  className="v2-btn v2-btn-outline"
                >
                  <Download size={15} />
                  Download PDF
                </button>
              )}

              {canUpdate && (
                <button
                  type="button"
                  onClick={() => router.push(`/transfer/deliveries/${id}/edit`)}
                  disabled={!canEditDelivery}
                  title={hasReceivedLines ? 'Already received — cannot edit' : 'Edit'}
                  className="v2-btn v2-btn-outline"
                >
                  <Pencil size={15} />
                  Edit
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => { if (!hasReceivedLines) setDeleteConfirm(true) }}
                  disabled={hasReceivedLines}
                  title={hasReceivedLines ? 'Already received — cannot delete' : 'Delete'}
                  className="v2-btn v2-btn-danger"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              )}

              {canFinalize && (
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={finalizeMutation.isPending}
                  className="v2-btn v2-btn-primary"
                >
                  <CheckCircle2 size={15} />
                  {finalizeMutation.isPending ? 'Finalizing...' : 'Finalize'}
                </button>
              )}

              {delivery?.status === 'final' &&
                canCreateReceipt &&
                canUserCreateReceiptForDelivery(delivery, user, isSuperadmin) && (
                <button type="button" onClick={handleReceiptClick} className="v2-btn v2-btn-primary">
                  <ClipboardList size={15} />
                  Process Receipt
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="v2-card dd-meta-grid" style={{ overflow: 'hidden' }}>
          {metaCells.map((f) => (
            <div key={f.label} className="dd-meta-cell">
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{f.label}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', minWidth: 0 }}>{f.value}</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {delivery.description && (
          <div className="v2-card" style={{ overflow: 'hidden' }}>
            <div style={cardHeaderStyle}>
              <h2 style={cardTitleStyle}>Notes</h2>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--foreground)', margin: 0, padding: '14px 20px', lineHeight: 1.6 }}>
              {delivery.description}
            </p>
          </div>
        )}

        {/* Line items */}
        <div className="v2-card" style={{ overflow: 'hidden' }}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Line items</h2>
            <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
              {details.length} item{details.length === 1 ? '' : 's'}
            </span>
          </div>

          {details.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <PackageSearch size={28} style={{ color: 'var(--foreground-subtle)', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: 0 }}>No items on this delivery</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dd-table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>Product</th>
                    <th style={{ width: 100 }}>UOM</th>
                    {hasBatches && <th style={{ width: 170 }}>Batch</th>}
                    <th className="num" style={{ width: 90 }}>Qty</th>
                    <th className="num" style={{ width: 160 }}>Delivered / Ordered</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 180 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((detail, index) => {
                    const detailStatus =
                      STATUS_META[detail.status as keyof typeof STATUS_META] ?? STATUS_META.pending
                    const pu = (detail as any).product_uom ?? getProductUom(detail.product_uom_id ?? 0)
                    return (
                      <tr key={detail.id}>
                        <td style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>{index + 1}</td>
                        <td style={{ fontWeight: 500 }}>
                          {getProductUomName(pu) || `UOM #${detail.product_uom_id}`}
                        </td>
                        <td style={{ color: 'var(--foreground-muted)' }}>
                          {pu?.uom?.name ?? pu?.uom?.code ?? '—'}
                        </td>
                        {hasBatches && (
                          <td>
                            {detail.product_uom_batch ? (
                              <>
                                <div style={{ fontSize: 12.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                  {detail.product_uom_batch.batch_code ?? `Batch #${detail.product_uom_batch.id}`}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                                  {detail.product_uom_batch.expiry_date
                                    ? `Exp ${formatDate(detail.product_uom_batch.expiry_date)}`
                                    : 'No expiry'}
                                </div>
                              </>
                            ) : (
                              <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                            )}
                          </td>
                        )}
                        <td className="num" style={{ fontWeight: 600 }}>{numFmt(detail.qty)}</td>
                        <td className="num" style={{ color: 'var(--foreground-muted)' }}>
                          {(() => {
                            const ordered = detail.purchase_order_detail?.qty
                            if (ordered == null) {
                              return <span>{numFmt(detail.qty)} / —</span>
                            }
                            const partial = detail.qty < ordered
                            return (
                              <>
                                <span style={{ fontWeight: 600, color: partial ? 'var(--warning)' : 'var(--success)' }}>
                                  {numFmt(detail.qty)}
                                </span>
                                <span>{' / ' + numFmt(ordered)}</span>
                              </>
                            )
                          })()}
                        </td>
                        <td>
                          <span style={pillStyle(detailStatus)}>{detailStatus.label}</span>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
                          {detail.description || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              className="v2-overlay"
              onClick={() => setDeleteConfirm(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
            />
            <div
              className="v2-dialog"
              style={{
                position: 'relative',
                zIndex: 70,
                background: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                width: 400,
                maxWidth: 'calc(100vw - 32px)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
                Delete Delivery
              </h3>
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
                This will permanently remove delivery <strong>{delivery.code}</strong> and all its
                details. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDeleteConfirm(false)} className="v2-btn v2-btn-ghost">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="v2-btn v2-btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {sharedStyles}
      </div>

      {/* ── Printable A4 Surat Jalan (hidden on screen, shown only in print) ── */}
      <div className="surat-jalan-print">
        {/* Letterhead */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6mm', marginBottom: '6mm' }}>
          <div style={{ fontSize: '13pt', fontWeight: 700 }}>
            DELIVERY NOTE
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
                <strong>Dari:</strong> {delivery.branch?.name ?? '-'}
              </td>
              <td style={{ verticalAlign: 'top', padding: '1mm 0' }}>
                <strong>Kepada:</strong> {delivery.target_branch?.name ?? '-'}
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
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', width: '9mm' }}>NO</th>
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left', width: '22mm' }}>ITEM CODE</th>
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>NAME</th>
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left', width: '18mm' }}>UNIT</th>
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', width: '16mm' }}>DEL</th>
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left', width: '36mm' }}>BATCH</th>
              <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left', width: '22mm' }}>
                EXPIRED DATE
              </th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail, index) => {
              const pu = (detail as any).product_uom ?? getProductUom(detail.product_uom_id ?? 0)
              return (
                <tr key={detail.id}>
                  <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>
                    {index + 1}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '2mm' }}>
                    {pu?.product?.code ?? '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '2mm' }}>
                    {getProductUomName(pu) || `UOM #${detail.product_uom_id}`}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '2mm' }}>
                    {pu?.uom?.name ?? pu?.uom?.code ?? '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right' }}>
                    {detail.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </td>
                  {/* Batch (kode batch dari backend) */}
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '2mm',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {detail.product_uom_batch?.batch_code ?? '-'}
                  </td>
                  {/* Expired date batch (jika ada) */}
                  <td style={{ border: '1px solid #000', padding: '2mm', whiteSpace: 'nowrap' }}>
                    {detail.product_uom_batch?.expiry_date
                      ? formatDate(detail.product_uom_batch.expiry_date)
                      : '-'}
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

        {/* Signatures — 2 columns */}
        <table
          style={{
            width: '100%',
            fontSize: '10pt',
            marginTop: '28mm',
            marginBottom: 0,
            borderCollapse: 'collapse',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          <tbody>
            <tr>
              {['Pengirim', 'Penerima'].map((label) => (
                <td key={label} style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', padding: '0 4mm' }}>
                  <div>{label}</div>
                  <div style={{ height: '45mm' }} />
                  <div style={{ marginTop: '8mm' }}>( ____________ )</div>
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
        /* Isolate: hide the on-screen detail UI, show only the surat jalan.
           Also collapse every hidden element's box (height/min-height) so the
           app shell (GlobalLayout's height:100vh sidebar/topbar/main) can't
           leave residual invisible height in the print flow and push a 2nd page. */
        body * {
          visibility: hidden !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
        }
        .surat-jalan-print, .surat-jalan-print * { visibility: visible !important; }
        .dd-screen { display: none !important; }
        /* The app shell (AppSidebar renders <aside>, TopBar renders <header>)
           isn't part of .dd-screen, so visibility:hidden alone left its full
           expanded-nav content height in the print flow, forcing a 2nd page.
           Collapse their boxes outright. */
        aside, header { display: none !important; }
        .surat-jalan-print {
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0;
          overflow: hidden;
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
