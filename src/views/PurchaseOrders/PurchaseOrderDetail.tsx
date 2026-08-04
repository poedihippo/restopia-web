'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate, formatDateTime } from '@/utils/date';

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  PackageSearch,
  Calendar,
  Building2,
  Truck,
  FileText,
  Hash,
  ChevronRight,
  ShoppingCart,
  Printer,
} from 'lucide-react'

interface PurchaseOrderDetailProps {
  id: number
}

interface PurchaseOrderFull {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'final'
  type?: 'supplier' | 'branch'
  description?: string
  created_at?: string
  updated_at?: string
  branch?: { id: number; name: string }
  supplier?: { id: number; name: string }
  supplier_branch?: { id: number; name: string }
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
  const { hasPermission } = useAuth()
  const canRead = hasPermission('purchase-order.read')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['purchase-order-detail', id],
    queryFn: () =>
      purchaseOrdersService
        .findById(id, {
          include:
            'branch,supplier,supplier_branch,created_by,updated_by,' +
            'purchase_order_details,purchase_order_details.product_uom',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const order = (data as any)?.data as PurchaseOrderFull | undefined

  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrdersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order deleted')
      router.push('/purchase/purchase-orders')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const details = order?.purchase_order_details ?? []
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

  // Fulfillment summary — only meaningful once goods start arriving on a final PO.
  const totalOrdered = details.reduce((s, d) => s + Number(d.qty ?? 0), 0)
  const totalReceived = details.reduce(
    (s, d) => s + Number(d.received_qty ?? 0),
    0,
  )
  const showFulfillment = order?.status === 'final' && totalReceived > 0
  const fullyReceived = totalReceived >= totalOrdered

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

  // ── Loading ──────────────────────────────────────────────────────────────
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
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
            Loading order...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError || !order) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <PackageSearch size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Purchase order not found
        </p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  // ── Content ──────────────────────────────────────────────────────────────
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
        {/* Left */}
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
                {order.code}
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
              Purchase Order
            </p>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', gap: 8 }}>
          {canRead && (
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
              Print
            </button>
          )}
          {order?.status === 'final' && (
            <button
              type="button"
              onClick={() => router.push(`/sales/sales-orders/create?po_id=${id}`)}
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
                cursor: 'pointer',
              }}
            >
              <ShoppingCart size={13} />
              Create Sales Order
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/purchase/purchase-orders/${id}/edit`)}
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

      {/* Info grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        {/* Supplier */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Truck size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Supplier</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {order.supplier?.name ?? '—'}
          </div>
        </div>

        {/* Branch */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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
            {order.branch?.name ?? '—'}
          </div>
        </div>

        {/* Date */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Order Date</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {order.date
              ? formatDate(order.date)
              : '—'}
          </div>
        </div>

        {/* Created By */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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
              {order.created_by?.name ?? '—'}
            </div>
            {order.created_at && (
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4, display: 'block' }}>
                {formatDateTime(order.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description block */}
      {order.description && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}
        >
          <span
            style={{
              ...sectionLabelStyle,
              display: 'block',
              marginBottom: 8,
            }}
          >
            Notes
          </span>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
            {order.description}
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
        {/* Table header bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {showFulfillment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {`Fulfillment: ${totalReceived.toLocaleString('id-ID')} of ${totalOrdered.toLocaleString('id-ID')} received`}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    background: fullyReceived
                      ? 'var(--success-bg)'
                      : 'var(--warning-bg)',
                    color: fullyReceived ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {fullyReceived ? 'Received' : 'Partial'}
                </span>
              </div>
            )}
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              {details.length} item(s)
            </span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, width: 50 }}>#</th>
              <th style={thStyle}>Product</th>
              <th style={{ ...thStyle, width: 100 }}>UOM</th>
              <th style={{ ...thStyle, width: 80 }}>Qty</th>
              <th style={{ ...thStyle, width: 130 }}>Received / Outstanding</th>
              <th style={{ ...thStyle, width: 130 }}>Unit Price</th>
              <th style={{ ...thStyle, width: 140 }}>Subtotal</th>
              <th style={{ ...thStyle, width: 160 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail, index) => (
              <tr key={detail.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {index + 1}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                  {detail.product_uom?.product?.name ?? `Item #${detail.product_uom_id ?? detail.id}`}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={pillStyle}>
                    {detail.product_uom?.uom?.name ?? detail.product_uom?.uom?.code ?? '—'}
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
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        Number(detail.outstanding_qty ?? 0) > 0
                          ? 'var(--warning)'
                          : 'var(--foreground)',
                    }}
                  >
                    {Number(detail.received_qty ?? 0).toLocaleString('id-ID')}
                  </span>
                  <span style={{ color: 'var(--foreground-subtle)' }}>
                    {' / ' + detail.qty.toLocaleString('id-ID')}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                  {formatCurrency(detail.price)}
                </td>
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
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {detail.description || '—'}
                </td>
              </tr>
            ))}

            {/* Total row */}
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
                  {formatCurrency(order.total_price)}
                </span>
              </td>
              <td style={{ padding: '14px 16px' }} />
            </tr>
          </tbody>
        </table>
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
              Delete Purchase Order
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
              This will permanently remove order <strong>{order.code}</strong> and all its
              line items. This action cannot be undone.
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
          <div style={{ fontSize: '24pt', fontWeight: 800, letterSpacing: '2px' }}>DAPUR COKLAT</div>
          <div style={{ fontSize: '14pt', fontWeight: 600, marginTop: '2mm', letterSpacing: '1px', opacity: 0.9 }}>
            PURCHASE ORDER
          </div>
        </div>

        {/* PO info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm', padding: '0 4mm' }}>
          <div>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: '#5c3a21', textTransform: 'uppercase' }}>
              Buyer
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: '2mm', color: '#333' }}>
              {order.branch?.name || '-'}
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
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Date:</strong> {order.date ? formatDate(order.date) : '-'}
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
                    {d.product_uom?.product?.name ?? `Item #${d.product_uom_id ?? d.id}`}
                    {d.product_uom?.uom?.name ? ` (${d.product_uom.uom.name})` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', color: '#444' }}>
                    {d.qty.toLocaleString('id-ID')}
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
                  <td
                    style={{
                      padding: '8px 0',
                      fontSize: '11pt',
                      fontWeight: 700,
                      color: '#5c3a21',
                      borderTop: '2px dashed #d4c4a8',
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
                      borderTop: '2px dashed #d4c4a8',
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
