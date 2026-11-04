'use client'
import { formatCurrency } from '@/utils/price'
import { formatDate } from '@/utils/date'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vouchersService } from '@/services/vouchers.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { X, Pencil, Trash2, Tag, Package, Building2 } from 'lucide-react'

interface VoucherDetailProps {
  id: number | null
  onClose: () => void
  /** Opens the edit sheet for this voucher (receives the loaded voucher). */
  onEdit?: (voucher: any) => void
}

/** Voucher detail as a right-side panel, opened from the vouchers list. */
export default function VoucherDetail({ id, onClose, onEdit }: VoucherDetailProps) {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('voucher.update')
  const canDelete = hasPermission('voucher.delete')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const open = id != null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['voucher-detail', id],
    enabled: open,
    queryFn: () =>
      vouchersService
        .findById(id!, { include: 'activated_by,voucher_branches,voucher_product_uoms' })
        .then((r) => (r.data as any)?.data),
  })
  const voucher: any = data

  const voucherProducts: any[] = voucher?.voucher_product_uoms ?? []
  const voucherBranches: any[] = voucher?.voucher_branches ?? []

  // product_uom on the pivot is a "simple" resource; fetch the full rows so
  // the list shows product name + UOM + type like the pickers do.
  const productUomIds: number[] = voucherProducts
    .map((p) => p.product_uom_id ?? p.product_uom?.id)
    .filter(Boolean)
  const { data: productUomsData, isLoading: productsLoading } = useQuery({
    queryKey: ['product-uoms-by-ids', productUomIds.slice().sort((a, b) => a - b).join(',')],
    enabled: open && productUomIds.length > 0,
    queryFn: () =>
      productUomsService
        .list({
          'filter[ids]': productUomIds.join(','),
          include: 'product,uom',
          per_page: productUomIds.length,
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
  })
  const productUomById = new Map<number, any>(((productUomsData as any[]) ?? []).map((p) => [p.id, p]))

  const productLabel = (row: any) => {
    const puId = row.product_uom_id ?? row.product_uom?.id
    const pu = productUomById.get(puId) ?? row.product_uom
    if (!pu) return `Product UOM #${puId}`
    const name = getProductUomName(pu, pu.product?.name) || `#${puId}`
    return withProductType(name, pu.product?.type)
  }
  const productCode = (row: any) => {
    const puId = row.product_uom_id ?? row.product_uom?.id
    const pu = productUomById.get(puId) ?? row.product_uom
    return pu?.code || pu?.uom?.code || ''
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vouchers'] })
    qc.invalidateQueries({ queryKey: ['voucher-detail', id] })
  }

  const deleteMutation = useMutation({
    mutationFn: () => vouchersService.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      toast.success('Voucher deleted')
      setDeleteConfirm(false)
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: () =>
      vouchersService.updateStatus(id!, {
        status: voucher?.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Status updated')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update status'),
  })

  if (!open) return null

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  }
  const fieldValueStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--foreground)',
    marginTop: 4,
  }
  const cardStyle: React.CSSProperties = {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: 12,
  }
  const badge = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color,
  })
  const footerBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  })

  const isActive = voucher?.status === 'active'
  const field = (label: string, value: React.ReactNode) => (
    <div style={cardStyle}>
      <div style={sectionLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{value}</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          width: 500,
          maxWidth: '100vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2
                style={{
                  fontFamily: 'monospace',
                  fontSize: 20,
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--accent)',
                }}
              >
                {voucher?.code ?? 'Voucher'}
              </h2>
              {voucher &&
                (isActive ? (
                  <span style={badge('var(--success-bg)', 'var(--success)')}>Active</span>
                ) : (
                  <span style={badge('var(--background)', 'var(--foreground-muted)')}>Inactive</span>
                ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {voucher?.name ?? 'Voucher detail'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: 6,
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
              Loading voucher...
            </div>
          ) : isError || !voucher ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Tag size={32} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', marginTop: 8 }}>Voucher not found</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {field('Discount', (
                  <span style={{ color: 'var(--accent)' }}>
                    {voucher.discount_type === 'percent'
                      ? `${voucher.discount_value}%`
                      : formatCurrency(voucher.discount_value ?? 0)}
                  </span>
                ))}
                {field('Scope', voucher.scope === 'branch' ? 'Branch' : 'Company')}
                {field('Valid From', voucher.valid_from ? formatDate(voucher.valid_from) : '—')}
                {field('Valid Until', voucher.valid_until ? formatDate(voucher.valid_until) : '—')}
                {field('Min. Purchase', voucher.min_subtotal_price ? formatCurrency(voucher.min_subtotal_price) : '—')}
                {field('Max. Discount', voucher.max_discount_price ? formatCurrency(voucher.max_discount_price) : 'No cap')}
                {field(
                  'Quota',
                  voucher.quota
                    ? `${Number(voucher.used_quota ?? 0).toLocaleString('id-ID')} / ${Number(voucher.quota).toLocaleString('id-ID')} used`
                    : 'Unlimited',
                )}
                {field('Activated By', voucher.activated_by?.name ?? '—')}
              </div>

              {/* Products */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Package size={14} style={{ color: 'var(--accent-light)' }} />
                  <span style={sectionLabelStyle}>Discounted Products ({voucherProducts.length})</span>
                </div>
                {voucherProducts.length === 0 ? (
                  <div style={{ ...cardStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>
                    All products — this voucher is not limited to specific products.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {voucherProducts.map((row, i) => (
                      <div
                        key={row.id ?? i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                            {productsLoading && !productUomById.size ? 'Loading...' : productLabel(row)}
                          </div>
                          {productCode(row) && (
                            <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>{productCode(row)}</div>
                          )}
                        </div>
                        {row.quota ? (
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                            {Number(row.used_quota ?? 0)} / {Number(row.quota)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Branches */}
              {voucher.scope === 'branch' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Building2 size={14} style={{ color: 'var(--accent-light)' }} />
                    <span style={sectionLabelStyle}>Branches ({voucherBranches.length})</span>
                  </div>
                  {voucherBranches.length === 0 ? (
                    <div style={{ ...cardStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>No branches selected.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {voucherBranches.map((b, i) => (
                        <span
                          key={b.id ?? i}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 99,
                            fontSize: 12,
                            background: 'var(--warning-bg)',
                            color: 'var(--warning)',
                            border: '1px solid var(--warning)',
                          }}
                        >
                          {b.branch?.name ?? `Branch #${b.branch_id}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {voucher.description && (
                <div>
                  <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>Description</div>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
                    {voucher.description}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {voucher && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            {canDelete ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                style={footerBtn('var(--destructive-bg)', 'var(--destructive)', 'var(--destructive)')}
              >
                <Trash2 size={13} />
                Delete
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 8 }}>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => toggleStatusMutation.mutate()}
                  disabled={toggleStatusMutation.isPending}
                  style={{
                    ...footerBtn(
                      isActive ? 'var(--warning-bg)' : 'var(--success-bg)',
                      isActive ? 'var(--warning)' : 'var(--success)',
                      isActive ? 'var(--warning)' : 'var(--success)',
                    ),
                    opacity: toggleStatusMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </button>
              )}
              {canEdit && onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(voucher)}
                  style={footerBtn('var(--accent)', 'white', 'var(--accent)')}
                >
                  <Pencil size={13} />
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && voucher && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Delete Voucher
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
              This will permanently remove voucher <strong>{voucher.code}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                style={footerBtn('var(--surface)', 'var(--foreground)', 'var(--border)')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                style={{
                  ...footerBtn('var(--destructive)', 'white', 'var(--destructive)'),
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
