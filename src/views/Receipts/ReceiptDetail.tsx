'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate, formatDateTime } from '@/utils/date';
import { getProductUomName } from '@/utils/productUomName';

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { receiptsService } from '@/services/receipts.service'
import { toastMutationApiError } from '@/utils/apiError'
import BackLink from '@/components/BackLink'
import {
  Pencil,
  Trash2,
  ReceiptText,
  ArrowUpRight,
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
    product_uom_batch?: {
      batch_code?: string
      expiry_date?: string
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


  const qtyFmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

  const containerStyle: React.CSSProperties = {
    padding: '28px 24px 48px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
  }

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

  const thStyle: React.CSSProperties = {
    height: 'auto',
    padding: '10px 14px',
    fontSize: 11.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--foreground-muted)',
    background: 'var(--surface-muted)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    height: 'auto',
    padding: '12px 14px',
    fontSize: 13.5,
    color: 'var(--foreground)',
    verticalAlign: 'top',
  }

  // First / last columns keep the 20px card gutter.
  const edgeL: React.CSSProperties = { paddingLeft: 20 }
  const edgeR: React.CSSProperties = { paddingRight: 20 }

  const monoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: 12.5,
  }

  const sharedCss = `
    .rcpt-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .rcpt-summary-cell { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; min-width: 0; }
    .rcpt-summary-cell + .rcpt-summary-cell { border-left: 1px solid var(--border); }
    @media (max-width: 720px) {
      .rcpt-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rcpt-summary-cell:nth-child(3) { border-left: none; }
      .rcpt-summary-cell:nth-child(n + 3) { border-top: 1px solid var(--border); }
    }
  `

  if (isLoading) {
    return (
      <div style={containerStyle} aria-busy="true">
        <div className="v2-skeleton" style={{ width: 90, height: 14 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div className="v2-skeleton" style={{ width: 200, height: 26 }} />
          <div className="v2-skeleton" style={{ width: 60, height: 20, borderRadius: 999 }} />
        </div>
        <div className="v2-skeleton" style={{ width: 260, height: 13, marginTop: 8 }} />
        <div className="v2-card rcpt-summary" style={{ marginTop: 20, overflow: 'hidden' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rcpt-summary-cell">
              <div className="v2-skeleton" style={{ width: 70, height: 11 }} />
              <div className="v2-skeleton" style={{ width: '70%', height: 16 }} />
            </div>
          ))}
        </div>
        <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
          <div style={cardHeaderStyle}>
            <div className="v2-skeleton" style={{ width: 110, height: 14 }} />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 20px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div className="v2-skeleton" style={{ width: 20, height: 14 }} />
              <div className="v2-skeleton" style={{ flex: 1, height: 14 }} />
              <div className="v2-skeleton" style={{ width: 90, height: 14 }} />
              <div className="v2-skeleton" style={{ width: 70, height: 14 }} />
              <div className="v2-skeleton" style={{ width: 60, height: 14 }} />
            </div>
          ))}
        </div>
        <style>{sharedCss}</style>
      </div>
    )
  }

  if (isError || !receipt) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', textAlign: 'center', paddingTop: 80 }}>
        <ReceiptText size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '12px 0 0' }}>
          Receipt not found
        </p>
        <BackLink href="/transfer/receipts" label="Receipts" style={{ alignSelf: 'center', marginTop: 16 }} />
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Back link */}
      <BackLink href="/transfer/receipts" label="Receipts" />

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
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--foreground)',
              }}
            >
              {receipt.code}
            </h1>
            <span style={pillStyle(statusMeta)}>{statusMeta.label}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '6px 0 0' }}>
            Received at{' '}
            <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
              {receipt.branch?.name ?? '—'}
            </span>
            {receipt.delivery?.code && (
              <>
                {' '}· from delivery{' '}
                <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                  {receipt.delivery.code}
                </span>
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {receipt.status !== 'final' && (
            <button
              type="button"
              onClick={() => router.push(`/transfer/receipts/${id}/edit`)}
              className="v2-btn v2-btn-outline"
            >
              <Pencil size={15} />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="v2-btn v2-btn-danger"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="v2-card rcpt-summary" style={{ marginTop: 20, overflow: 'hidden' }}>
        <div className="rcpt-summary-cell">
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Receipt date</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
            {receipt.date ? receipt.date : '—'}
          </span>
        </div>
        <div className="rcpt-summary-cell">
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Branch</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>
            {receipt.branch?.name ?? '—'}
          </span>
        </div>
        <div className="rcpt-summary-cell">
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Linked delivery</span>
          {receipt.delivery?.code ? (
            <Link
              href={`/transfer/deliveries/${receipt.delivery.id}/detail`}
              title="Buka detail delivery"
              style={{
                ...monoStyle,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
                textDecoration: 'none',
                alignSelf: 'flex-start',
              }}
            >
              <span className="v2-link">{receipt.delivery.code}<ArrowUpRight size={12} /></span>
            </Link>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground-muted)' }}>—</span>
          )}
        </div>
        <div className="rcpt-summary-cell">
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Created by</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>
            {receipt.created_by?.name ?? '—'}
          </span>
          {receipt.created_at && (
            <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
              {formatDateTime(receipt.created_at)}
            </span>
          )}
        </div>
      </div>

      {/* Notes */}
      {receipt.description && (
        <div className="v2-card" style={{ marginTop: 16, padding: '14px 20px' }}>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
            Notes
          </span>
          <p style={{ fontSize: 13.5, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
            {receipt.description}
          </p>
        </div>
      )}

      {/* Received items */}
      <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
        <div style={cardHeaderStyle}>
          <h2 style={cardTitleStyle}>Received items</h2>
          <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
            {details.length} item{details.length === 1 ? '' : 's'}
          </span>
        </div>

        {details.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <ReceiptText size={28} style={{ color: 'var(--foreground-subtle)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: 0 }}>No items on this receipt</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th style={{ ...thStyle, ...edgeL, width: 44 }}>#</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Batch</th>
                  <th style={thStyle}>Planned expiry</th>
                  <th style={thStyle}>Client ref</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Received / Delivered">Qty</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, ...edgeR }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => {
                  const detailStatus =
                    STATUS_META[detail.status as keyof typeof STATUS_META] ?? STATUS_META.pending

                  const deliveryDetail = (receipt?.delivery as any)?.delivery_details?.find((dd: any) => dd.id === detail.delivery_detail_id)
                  const productName =
                    getProductUomName(deliveryDetail?.product_uom) ||
                    getProductUomName(detail.product_uom) ||
                    '—'
                  const delivered = detail.delivery_detail?.qty
                  const partial = delivered != null && detail.qty < delivered
                  const expiry = detail.product_uom_batch?.expiry_date || detail.planned_expiry_date

                  return (
                    <tr key={detail.id}>
                      <td style={{ ...tdStyle, ...edgeL, fontSize: 12, color: 'var(--foreground-subtle)' }}>
                        {index + 1}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500, minWidth: 200 }}>{productName}</td>
                      <td style={{ ...tdStyle, ...monoStyle, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                        {detail.product_uom_batch?.batch_code || detail.planned_batch_code || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                        {expiry ? formatDate(expiry) : '—'}
                      </td>
                      <td style={{ ...tdStyle, ...monoStyle, color: 'var(--foreground-muted)', overflowWrap: 'anywhere' }}>
                        {detail.client_ref || '—'}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              delivered == null
                                ? 'var(--foreground)'
                                : partial
                                  ? 'var(--warning)'
                                  : 'var(--success)',
                          }}
                        >
                          {qtyFmt(detail.qty)}
                        </span>
                        <span style={{ color: 'var(--foreground-muted)' }}>
                          {' / ' + (delivered == null ? '—' : qtyFmt(delivered))}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={pillStyle(detailStatus)}>{detailStatus.label}</span>
                      </td>
                      <td style={{ ...tdStyle, ...edgeR, color: 'var(--foreground-muted)', fontSize: 12.5 }}>
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
            onClick={() => setDeleteConfirm(false)}
            className="v2-overlay"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            className="v2-dialog"
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '22px 24px 20px',
              width: 400,
              maxWidth: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Delete Receipt
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
              This will permanently remove receipt <strong style={{ color: 'var(--foreground)' }}>{receipt.code}</strong> and all its
              details.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="v2-btn v2-btn-ghost"
              >
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

      <style>{sharedCss}</style>
    </div>
  )
}
