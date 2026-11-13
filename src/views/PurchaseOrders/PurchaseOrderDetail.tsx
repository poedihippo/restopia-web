'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate, formatDateTime } from '@/utils/date';
import { getProductUomName } from '@/utils/productUomName';

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import {
  Pencil,
  Trash2,
  PackageSearch,
  Truck,
  ShoppingCart,
  Printer,
  Download,
  Check,
  X,
} from 'lucide-react'
import { useBuyerNames } from '@/hooks/useBuyerNames'
import BackLink from '@/components/BackLink'
import AcceptPOModal, { AcceptPODetailPayload } from '../RequestedOrders/AcceptPOModal'
import { purchaseOrderDeleteBlock } from '@/lib/actionGuards'

interface PurchaseOrderDetailProps {
  id: number
}

interface PurchaseOrderFull {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final' | 'accepted' | 'rejected' | 'fulfilled' | 'partially_delivered' | 'delivered'
  type?: 'supplier' | 'branch'
  description?: string
  fulfillment_date?: string
  created_at?: string
  updated_at?: string
  additional_charges?: any[]
  branch?: {
    id: number
    name: string
    address?: string
    company?: { id?: number; name?: string; address?: string | null }
  }
  supplier?: { id: number; name: string }
  supplier_branch?: { id: number; name: string }
  buyer_id?: number | null
  created_by?: { id: number; name: string }
  updated_by?: { id: number; name: string }
  purchase_order_details?: Array<{
    id: number
    qty: number
    received_qty?: number
    outstanding_qty?: number
    price: number
    description?: string
    product_uom_id?: number
    product_uom?: {
      id: number
      code?: string
      name?: string | null
      product?: { id: number; name: string }
      uom?: { id: number; name: string; code: string }
    }
  }>
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: {
    label: 'Pending',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  final: {
    label: 'Final',
    color: 'var(--accent)',
    bg: 'var(--accent-bg)',
  },
  accepted: {
    label: 'Accepted',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  rejected: {
    label: 'Rejected',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
  fulfilled: {
    label: 'Fulfilled',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  partially_delivered: {
    label: 'Partially Delivered',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  delivered: {
    label: 'Delivered',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
}

export default function PurchaseOrderDetail({ id }: PurchaseOrderDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, hasPermission } = useAuth()
  const myBranchId = (user as any)?.branch?.id ?? (user as any)?.branch_id
  const canRead = hasPermission('purchase-order.read')
  const canUpdate = hasPermission('purchase-order.update')
  const canDelete = hasPermission('purchase-order.delete')
  // Accept/Reject use the .update key on either PO route (purchase-orders/.../purchase_order_route.go)
  const canTransition = hasPermission('purchase-order.update') || hasPermission('internal-purchase-order.update')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [acceptModalOpen, setAcceptModalOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['purchase-order-detail', id],
    queryFn: () =>
      purchaseOrdersService
        .findById(id, {
          include:
            'branch,branch.company,supplier,supplier_branch,created_by,updated_by,' +
            'purchase_order_details,purchase_order_details.product_uom,additional_charges',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const order = (data as any)?.data as PurchaseOrderFull | undefined

  const actionMutation = useMutation({
    mutationFn: ({ id, action, details, total_price, tax_id, additional_charges }: { id: number; action: 'accept' | 'reject'; details?: AcceptPODetailPayload[], total_price?: number, tax_id?: number, additional_charges?: { name: string; chart_of_account_id?: number; amount: number; description?: string }[] }) =>
      action === 'accept'
        ? purchaseOrdersService.accept(id, { details, total_price, tax_id, additional_charges })
        : purchaseOrdersService.reject(id),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', id] })
      toast.success(vars.action === 'accept' ? 'Order accepted' : 'Order rejected')
      setAcceptModalOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Action failed'),
  })

  const handleAction = (orderId: number, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      setAcceptModalOpen(true)
    } else {
      if (!window.confirm(`Are you sure you want to ${action} this order?`)) return
      actionMutation.mutate({ id: orderId, action })
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrdersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order deleted')
      router.push('/purchase/purchase-orders')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const details = (order?.purchase_order_details as any[]) ?? []
  const statusMeta = STATUS_META[order?.status as keyof typeof STATUS_META] ?? STATUS_META.pending

  // Print document party resolution: a supplier PO sources from a supplier;
  // an internal-branch PO sources from another branch (supplier_branch) instead.
  const sourceLabel = order?.type === 'branch' ? 'Source Branch' : 'Supplier'
  const sourceName =
    order?.type === 'supplier'
      ? order?.supplier?.name
      : order?.type === 'branch'
        ? order?.supplier_branch?.name
        : order?.supplier?.name ?? order?.supplier_branch?.name

  // Buyer: nama dari GET /buyers/{buyer_id}. Fallback: nama PT (company)
  // dari API → company milik branch aktif user → nama branch → '-'.
  const userBranch = (
    user as {
      branch?: { company?: { name?: string; address?: string | null } }
    } | null
  )?.branch
  const buyerNames = useBuyerNames([order?.buyer_id])
  const buyerName =
    (order?.buyer_id ? buyerNames[order.buyer_id] : undefined) ??
    order?.branch?.company?.name ??
    userBranch?.company?.name ??
    order?.branch?.name ??
    '-'
  // Alamat buyer = alamat PT (company) dari API; bila kosong → '-'.
  const buyerAddress =
    order?.branch?.company?.address ?? userBranch?.company?.address ?? '-'

  // Fulfillment summary — only meaningful once goods start arriving on a final PO.
  const totalOrdered = details.reduce((s, d) => s + Number(d.qty ?? 0), 0)
  const totalReceived = details.reduce(
    (s, d) => s + Number(d.received_qty ?? 0),
    0,
  )
  const showFulfillment = order?.status === 'final' && totalReceived > 0
  const fullyReceived = totalReceived >= totalOrdered

  const thStyle: React.CSSProperties = {
    height: 36,
    padding: '0 20px',
    textAlign: 'left',
    fontSize: 11.5,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    background: 'var(--surface-muted)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 20px',
    fontSize: 13.5,
    color: 'var(--foreground)',
    verticalAlign: 'middle',
  }

  const numStyle: React.CSSProperties = {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }

  const pageStyle: React.CSSProperties = {
    padding: '28px 24px 48px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
  }

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

  const metaStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: 'var(--foreground-muted)',
  }

  const pill = (meta: { color: string; bg: string }): React.CSSProperties => ({
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

  const summaryRow = (label: React.ReactNode, value: React.ReactNode, note?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13 }}>
      <span style={{ color: 'var(--foreground-muted)' }}>
        {label}
        {note ? (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--foreground-subtle)' }}>{note}</span>
        ) : null}
      </span>
      <span style={{ fontWeight: 500, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )

  const metaGridCss = `
    .po-meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .po-meta-cell { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; min-width: 0; }
    .po-meta-cell:not(:nth-child(3n + 1)) { border-left: 1px solid var(--border); }
    .po-meta-cell:nth-child(n + 4) { border-top: 1px solid var(--border); }
    @media (max-width: 720px) {
      .po-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .po-meta-cell:not(:nth-child(3n + 1)) { border-left: none; }
      .po-meta-cell:nth-child(even) { border-left: 1px solid var(--border); }
      .po-meta-cell:nth-child(n + 3) { border-top: 1px solid var(--border); }
    }
  `

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div className="v2-skeleton" style={{ width: 120, height: 14 }} />
        <div className="v2-skeleton" style={{ width: 260, height: 24, marginTop: 14 }} />
        <div className="v2-skeleton" style={{ width: 320, height: 14, marginTop: 8 }} />
        <div className="v2-card" style={{ marginTop: 20, overflow: 'hidden' }}>
          <div className="po-meta-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="po-meta-cell">
                <div className="v2-skeleton" style={{ width: '40%', height: 12 }} />
                <div className="v2-skeleton" style={{ width: '70%', height: 16 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
          <div style={cardHeaderStyle}>
            <div className="v2-skeleton" style={{ width: 90, height: 14 }} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div className="v2-skeleton" style={{ flex: 3, height: 14 }} />
              <div className="v2-skeleton" style={{ flex: 1, height: 14 }} />
              <div className="v2-skeleton" style={{ flex: 1, height: 14 }} />
            </div>
          ))}
        </div>
        <style>{metaGridCss}</style>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError || !order) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <PackageSearch size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: '12px 0 0' }}>
          Purchase order not found
        </p>
        <BackLink href="/purchase/purchase-orders" label="Purchase Orders" style={{ alignSelf: 'center', marginTop: 16 }} />
      </div>
    )
  }

  const isDeliveredStatus = (order as any)?.status === 'delivered'
  const subtotalValue =
    (order as any).subtotal_price ?? details.reduce((sum, d) => sum + d.qty * d.price, 0)

  // ── Content ──────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      {/* Back link */}
      <BackLink href="/purchase/purchase-orders" label="Purchase Orders" />

      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                margin: 0,
                color: 'var(--foreground)',
              }}
            >
              {order.code}
            </h1>
            <span style={pill(statusMeta)}>{statusMeta.label}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '6px 0 0' }}>
            from{' '}
            <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{sourceName || '—'}</span>
            {' → to '}
            <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{order.branch?.name ?? '—'}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canTransition && order.type === 'branch' && order.supplier_branch?.id === myBranchId && (order.status === 'final' || order.status === 'rejected') && (
            <button
              type="button"
              disabled={actionMutation.isPending}
              onClick={() => handleAction(order.id, 'accept')}
              className="v2-btn v2-btn-primary"
            >
              <Check size={15} />
              Accept
            </button>
          )}
          {canTransition && order.type === 'branch' && order.supplier_branch?.id === myBranchId && (order.status === 'final' || order.status === 'accepted') && (
            <button
              type="button"
              disabled={actionMutation.isPending}
              onClick={() => handleAction(order.id, 'reject')}
              className="v2-btn v2-btn-danger"
            >
              <X size={15} />
              Reject
            </button>
          )}
          {canRead && (
            <button type="button" onClick={() => window.print()} className="v2-btn v2-btn-outline">
              <Printer size={15} />
              Print
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
              onClick={() => router.push(`/purchase/purchase-orders/${id}/edit`)}
              disabled={isDeliveredStatus}
              title={isDeliveredStatus ? 'Delivered — cannot edit' : 'Edit'}
              className="v2-btn v2-btn-outline"
            >
              <Pencil size={15} />
              Edit
            </button>
          )}
          {canDelete && (() => {
            const reason = purchaseOrderDeleteBlock(order)
            return (
              <button
                type="button"
                onClick={() => { if (!reason) setDeleteConfirm(true) }}
                disabled={!!reason}
                title={reason ?? 'Delete'}
                className="v2-btn v2-btn-danger"
              >
                <Trash2 size={15} />
                Delete
              </button>
            )
          })()}
          <button
            type="button"
            onClick={() => router.push(`/sales/sales-orders/create?po_id=${id}`)}
            className="v2-btn v2-btn-primary"
          >
            <ShoppingCart size={15} />
            Create Sales Order
          </button>
          {(order.status === 'accepted' || order.status === 'final' || order.status === 'partially_delivered') && (
            <button
              type="button"
              onClick={() => router.push(`/transfer/deliveries/create?po_id=${id}`)}
              className="v2-btn v2-btn-primary"
            >
              <Truck size={15} />
              Create Delivery
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="v2-card" style={{ marginTop: 20, overflow: 'hidden' }}>
        <div className="po-meta-grid">
          {[
            { label: 'Supplier', value: order.supplier?.name ?? '—' },
            { label: 'Buyer', value: buyerName },
            { label: 'Branch', value: order.branch?.name ?? '—' },
            { label: 'Order date', value: order.date ? formatDate(order.date) : '—' },
            { label: 'Fulfillment date', value: order.fulfillment_date ? formatDate(order.fulfillment_date) : '—' },
            {
              label: 'Created by',
              value: (
                <>
                  {order.created_by?.name ?? '—'}
                  {order.created_at && (
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--foreground-muted)', marginTop: 2 }}>
                      {formatDateTime(order.created_at)}
                    </span>
                  )}
                </>
              ),
            },
          ].map((f) => (
            <div key={f.label} className="po-meta-cell">
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{f.label}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', minWidth: 0, overflowWrap: 'anywhere' }}>
                {f.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {order.description && (
        <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Notes</h2>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--foreground)', margin: 0, padding: '14px 20px', lineHeight: 1.6 }}>
            {order.description}
          </p>
        </div>
      )}

      {/* Line items + totals */}
      <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
        <div style={cardHeaderStyle}>
          <h2 style={cardTitleStyle}>Line items</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {showFulfillment && (
              <>
                <span style={metaStyle}>
                  {`Fulfillment: ${totalReceived.toLocaleString('id-ID', { maximumFractionDigits: 2 })} of ${totalOrdered.toLocaleString('id-ID', { maximumFractionDigits: 2 })} received`}
                </span>
                <span
                  style={pill(
                    fullyReceived
                      ? { color: 'var(--success)', bg: 'var(--success-bg)' }
                      : { color: 'var(--warning)', bg: 'var(--warning-bg)' },
                  )}
                >
                  {fullyReceived ? 'Received' : 'Partial'}
                </span>
              </>
            )}
            <span style={metaStyle}>
              {details.length} item{details.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="v2-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 48 }}>#</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>UOM</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Received</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Unit price</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Subtotal</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, padding: '36px 20px', textAlign: 'center' }}>
                    <PackageSearch size={28} style={{ color: 'var(--foreground-subtle)', margin: '0 auto 8px', display: 'block' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>No line items on this order</span>
                  </td>
                </tr>
              ) : (
                details.map((detail, index) => (
                  <tr key={detail.id}>
                    <td style={{ ...tdStyle, fontSize: 12.5, color: 'var(--foreground-subtle)' }}>{index + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {getProductUomName(detail.product_uom, detail.product_uom?.product?.name) || `Item #${detail.product_uom_id ?? detail.id}`}
                        {detail.is_taxable && (
                          <span
                            style={pill({ color: 'var(--foreground-muted)', bg: 'var(--surface-muted)' })}
                          >
                            Taxable
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                      {detail.product_uom?.uom?.name ?? detail.product_uom?.uom?.code ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, ...numStyle, fontWeight: 600 }}>
                      {detail.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...tdStyle, ...numStyle }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            Number(detail.outstanding_qty ?? 0) > 0
                              ? 'var(--warning)'
                              : 'var(--foreground)',
                        }}
                      >
                        {Number(detail.received_qty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ color: 'var(--foreground-subtle)' }}>
                        {' / ' + detail.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, ...numStyle, color: 'var(--foreground-muted)' }}>
                      {formatCurrency(detail.price)}
                    </td>
                    <td style={{ ...tdStyle, ...numStyle, fontWeight: 600 }}>
                      {formatCurrency(detail.qty * detail.price)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12.5, color: 'var(--foreground-muted)', maxWidth: 200 }}>
                      {detail.description || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summaryRow('Subtotal', formatCurrency(subtotalValue))}
            {summaryRow('Tax', formatCurrency((order as any).tax_amount ?? 0))}
            {(order?.additional_charges || []).map((c: any, i: number) => (
              <React.Fragment key={i}>
                {summaryRow(
                  <>
                    {c.name}
                    {(c as any).tax ? ` (Incl. ${(c as any).tax.name} ${(c as any).tax.rate}%)` : ''}
                  </>,
                  formatCurrency(c.amount),
                  c.description || undefined,
                )}
              </React.Fragment>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatCurrency(order.total_price)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
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
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              width: 400,
              maxWidth: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Delete Purchase Order
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
              This will permanently remove order <strong style={{ color: 'var(--foreground)' }}>{order.code}</strong> and all its
              line items. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDeleteConfirm(false)} className="v2-btn v2-btn-outline">
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

      <AcceptPOModal
        isOpen={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        purchaseOrder={order}
        isSubmitting={actionMutation.isPending}
        onConfirm={(payload) => {
          if (order) {
            const calcLineSubtotal = (d: any) => {
              const gross = d.qty * d.price
              if (!d.discount_type || !d.discount_value) return gross
              if (d.discount_type === 'percent') return gross - (gross * d.discount_value / 100)
              return gross - d.discount_value
            }
            const subtotal = payload.details.reduce((sum, d) => sum + calcLineSubtotal(d), 0)
            const chargesTotal = (payload.additional_charges ?? []).reduce((sum, c) => sum + (c.amount || 0), 0)
            const total_price = subtotal + chargesTotal
            actionMutation.mutate({ id: order.id, action: 'accept', details: payload.details, total_price, tax_id: payload.tax_id, additional_charges: payload.additional_charges })
          }
        }}
      />

      {/* 🖨️ Printable A4 Purchase Order (hidden on screen, shown only in print) */}
      <div className="po-print">
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            backgroundColor: '#5c3a21',
            color: '#fff',
            padding: '10mm 0',
            marginBottom: '6mm',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <div style={{ fontSize: '24pt', fontWeight: 800, letterSpacing: '2px' }}>
            PURCHASE ORDER
          </div>
        </div>

        {/* PO info */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '6mm',
            marginBottom: '8mm',
            padding: '0 4mm',
          }}
        >
          {/* Kolom kiri dibatasi lebarnya supaya alamat membungkus ke bawah
              (bukan memanjang ke kanan melewati kolom info PO). */}
          <div style={{ maxWidth: '58%', wordBreak: 'break-word' }}>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: '#5c3a21', textTransform: 'uppercase' }}>
              Buyer
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: '2mm', color: '#333' }}>
              {buyerName}
            </div>
            <div style={{ fontSize: '9.5pt', marginTop: '1.5mm', color: '#666', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>Alamat:</span> {buyerAddress}
            </div>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: '#5c3a21', textTransform: 'uppercase', marginTop: '4mm' }}>
              {sourceLabel}
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: '2mm', color: '#333' }}>
              {sourceName || '-'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>PO No:</strong> {order.code || '-'}
            </div>
            {/* Tanggal PO = saat PO dibuat (created_at) */}
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>PO Date:</strong>{' '}
              {order.created_at ? formatDate(order.created_at) : '-'}
            </div>
            {/* Delivery PO = tanggal delivery yang diminta (field date) */}
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Delivery PO:</strong>{' '}
              {order.date ? formatDate(order.date) : '-'}
            </div>
          </div>
        </div>

        {/* Status label */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6mm', padding: '0 4mm' }}>
          <div
            style={{
              padding: '6px 16px',
              border: `2px solid ${statusMeta.color}`,
              backgroundColor: statusMeta.color + '15',
              color: statusMeta.color,
              fontWeight: 800,
              fontSize: '12pt',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {statusMeta.label}
          </div>
        </div>

        {/* Line items */}
        <div style={{ padding: '0 4mm', marginBottom: '8mm' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0e6d2', color: '#5c3a21' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  No
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Product
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Qty
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Unit Price
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#444' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#222', fontWeight: 500 }}>
                    {getProductUomName(d.product_uom, d.product_uom?.product?.name) || `Item #${d.product_uom_id ?? d.id}`}
                    {d.product_uom?.uom?.name ? ` (${d.product_uom.uom.name})` : ''}
                    {d.is_taxable && <span style={{ fontSize: '8pt', color: '#666', marginLeft: 4 }}>(Taxable)</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', color: '#444' }}>
                    {d.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#444' }}>
                    {`Rp ${Number(d.price ?? 0).toLocaleString('id-ID')}`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 600 }}>
                    {`Rp ${(Number(d.qty ?? 0) * Number(d.price ?? 0)).toLocaleString('id-ID')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4mm' }}>
          <div style={{ width: '50%', backgroundColor: '#fdfbf7', padding: '16px', borderRadius: '8px', border: '1px solid #f0e6d2' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 0', fontSize: '10pt', color: '#5c3a21', borderTop: '2px dashed #d4c4a8' }}>
                    Subtotal
                  </td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#5c3a21', borderTop: '2px dashed #d4c4a8' }}>
                    {`Rp ${Number((order as any).subtotal_price ?? details.reduce((sum, d) => sum + (Number(d.qty ?? 0) * Number(d.price ?? 0)), 0)).toLocaleString('id-ID')}`}
                  </td>
                </tr>
                <tr>
                      <td style={{ padding: '4px 0', fontSize: '10pt', color: '#5c3a21' }}>
                        Tax
                      </td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', color: '#5c3a21' }}>
                        {`Rp ${Number((order as any).tax_amount ?? 0).toLocaleString('id-ID')}`}
                      </td>
                    </tr>
                {(order?.additional_charges || []).map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 0', fontSize: '9pt', color: '#5c3a21' }}>
                      {c.name} {c.tax ? `(${c.tax.name})` : ''}
                    </td>
                    <td style={{ padding: '2px 0', textAlign: 'right', fontSize: '9pt', color: '#5c3a21' }}>
                      {`Rp ${Number(c.amount ?? 0).toLocaleString('id-ID')}`}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    style={{
                      padding: '8px 0',
                      fontSize: '11pt',
                      fontWeight: 700,
                      color: '#5c3a21',
                      borderTop: '1px solid #d4c4a8',
                    }}
                  >
                    Grand Total
                  </td>
                  <td
                    style={{
                      padding: '8px 0',
                      textAlign: 'right',
                      fontSize: '12pt',
                      fontWeight: 800,
                      color: '#5c3a21',
                      borderTop: '1px solid #d4c4a8',
                    }}
                  >
                    {`Rp ${Number(order.total_price ?? 0).toLocaleString('id-ID')}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{metaGridCss}</style>
      <style>{`
        .po-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          /* Enforce background colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Defeat the global pos-print.css rule that otherwise collapses #__next and blanks this page. */
          body > * { display: block !important; }
          #pos-receipt { display: none !important; }
          /* Isolate: hide the on-screen detail UI, show only the PO document. */
          body * { visibility: hidden !important; }
          .po-print, .po-print * { visibility: visible !important; }
          .po-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            font-family: 'Inter', Arial, Helvetica, sans-serif;
          }
          .po-print thead { display: table-header-group; }
        }
      `}</style>
    </div>
  )
}

