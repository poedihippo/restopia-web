'use client'
import { formatDate } from '@/utils/date';

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vouchersService } from '@/services/vouchers.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ArrowLeft,
  Trash2,
  Tag,
  Calendar,
  Building2,
  Hash,
} from 'lucide-react'

interface VoucherDetailProps {
  id: number
}

interface VoucherFull {
  id: number
  code: string
  name: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_subtotal_price?: number
  max_discount_price?: number
  scope: 'company' | 'branch'
  valid_from: string
  valid_until: string
  quota?: number
  status: 'active' | 'inactive'
  description?: string
  created_at?: string
  activated_by?: { id: number; name: string }
}

export default function VoucherDetail({ id }: VoucherDetailProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['voucher-detail', id],
    queryFn: () =>
      vouchersService
        .findById(id, { include: 'activated_by,voucher_branches,voucher_product_uoms' })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const voucher = (data as any)?.data as VoucherFull | undefined

  const deleteMutation = useMutation({
    mutationFn: () => vouchersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      toast.success('Voucher deleted')
      router.push('/sales/vouchers')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: () =>
      vouchersService.updateStatus(id, {
        status: voucher?.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['voucher-detail', id] })
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

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
            Loading voucher...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !voucher) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Tag size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Voucher not found
        </p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  const isActive = voucher.status === 'active'
  const capitalizedScope = voucher.scope.charAt(0).toUpperCase() + voucher.scope.slice(1)

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 1000,
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
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--accent)',
                }}
              >
                {voucher.code}
              </h1>
              {isActive ? (
                <span style={badge('var(--success-bg)', 'var(--success)')}>Active</span>
              ) : (
                <span style={badge('var(--background)', 'var(--foreground-muted)')}>
                  Inactive
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--foreground-muted)',
                margin: '4px 0 0',
              }}
            >
              Voucher — {voucher.name}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => toggleStatusMutation.mutate()}
            disabled={toggleStatusMutation.isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: isActive ? 'var(--warning-bg)' : 'var(--success-bg)',
              border: `1px solid ${isActive ? 'var(--warning)' : 'var(--success)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: isActive ? 'var(--warning)' : 'var(--success)',
              opacity: toggleStatusMutation.isPending ? 0.7 : 1,
            }}
          >
            {isActive ? 'Deactivate' : 'Activate'}
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

      {/* Info grid 3 cols */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Tag size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Discount Type</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {voucher.discount_type === 'percent' ? 'Percentage (%)' : 'Fixed Amount (Rp)'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Tag size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Discount Value</span>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--accent)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {voucher.discount_type === 'percent'
              ? voucher.discount_value + '%'
              : 'Rp ' + (voucher.discount_value ?? 0).toLocaleString('id-ID')}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Building2 size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Scope</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {capitalizedScope}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Valid From</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {voucher.valid_from
              ? formatDate(voucher.valid_from)
              : '—'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Valid Until</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {voucher.valid_until
              ? formatDate(voucher.valid_until)
              : '—'}
          </div>
        </div>

        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconBoxStyle}>
              <Hash size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Quota</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {voucher.quota ? voucher.quota.toLocaleString('id-ID') : 'Unlimited'}
          </div>
        </div>
      </div>

      {/* Constraints card */}
      {(voucher.min_subtotal_price || voucher.max_discount_price) && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}
        >
          <span style={{ ...sectionLabelStyle, display: 'block' }}>Usage Constraints</span>
          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            {voucher.min_subtotal_price != null && voucher.min_subtotal_price > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={sectionLabelStyle}>Min. Purchase</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                  {'Rp ' + voucher.min_subtotal_price.toLocaleString('id-ID')}
                </span>
              </div>
            )}
            {voucher.max_discount_price != null && voucher.max_discount_price > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={sectionLabelStyle}>Max. Discount</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--destructive)' }}>
                  {'Rp ' + voucher.max_discount_price.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {voucher.description && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}
        >
          <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 8 }}>
            Description
          </span>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
            {voucher.description}
          </p>
        </div>
      )}

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
              Delete Voucher
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              This will permanently remove voucher <strong>{voucher.code}</strong>.
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
