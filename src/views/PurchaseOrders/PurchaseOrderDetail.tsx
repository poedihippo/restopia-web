'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
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
  description?: string
  created_at?: string
  updated_at?: string
  branch?: { id: number; name: string }
  supplier?: { id: number; name: string }
  created_by?: { id: number; name: string }
  updated_by?: { id: number; name: string }
  purchase_order_details?: Array<{
    id: number
    qty: number
    price: number
    description?: string
    product_inventory?: {
      id: number
      product_uom?: {
        product?: { id: number; name: string }
        uom?: { id: number; name: string; code: string }
      }
      branch?: { id: number; name: string }
    }
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
}

export default function PurchaseOrderDetail({ id }: PurchaseOrderDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['purchase-order-detail', id],
    queryFn: () =>
      purchaseOrdersService
        .findById(id, {
          include:
            'branch,supplier,created_by,updated_by,' +
            'purchase_order_details.product_inventory.product_uom.product,' +
            'purchase_order_details.product_inventory.product_uom.uom,' +
            'purchase_order_details.product_inventory.branch',
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
    onError: () => toast.error('Failed to delete'),
  })

  const details = order?.purchase_order_details ?? []
  const statusMeta = STATUS_META[order?.status as keyof typeof STATUS_META] ?? STATUS_META.pending

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
              ? new Date(order.date).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
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
                {new Date(order.created_at).toLocaleString('id-ID')}
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
                  {detail.product_inventory?.product_uom?.product?.name ?? '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={pillStyle}>
                    {detail.product_inventory?.product_uom?.uom?.code ?? '—'}
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
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {detail.description || '—'}
                </td>
              </tr>
            ))}

            {/* Total row */}
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
                  {'Rp ' + order.total_price.toLocaleString('id-ID')}
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
