'use client'

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sellableSettlementsService } from '@/services/sellable-settlements.service'
import { toastMutationApiError } from '@/utils/apiError'
import { formatCurrency } from '@/utils/price'
import { formatDate } from '@/utils/date'
import type { SellableSettlementRunResult } from '@/types/api'
import { X, PlayCircle, Eye, AlertTriangle } from 'lucide-react'
import { inventoryLabel, humanizeReason } from './helpers'

interface RunSettlementModalProps {
  onClose: () => void
  /** Called after a real (non dry-run) settlement succeeded, with the new settlement id */
  onDone?: (id?: number) => void
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function RunSettlementModal({ onClose, onDone }: RunSettlementModalProps) {
  const qc = useQueryClient()

  const [asOf, setAsOf] = useState<string>(todayISO())
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<SellableSettlementRunResult | null>(null)

  const previewMutation = useMutation({
    mutationFn: () =>
      sellableSettlementsService.run({
        as_of: asOf,
        description: description || undefined,
        dry_run: true,
      }),
    onSuccess: (res) => {
      const body = (res as any)?.data ?? res
      setPreview((body?.data ?? body) as SellableSettlementRunResult)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to preview settlement'),
  })

  const runMutation = useMutation({
    mutationFn: () =>
      sellableSettlementsService.run({
        as_of: asOf,
        description: description || undefined,
        dry_run: false,
      }),
    onSuccess: (res) => {
      const body = (res as any)?.data ?? res
      const result = (body?.data ?? body) as SellableSettlementRunResult
      qc.invalidateQueries({ queryKey: ['sellable-settlements'] })
      toast.success(
        result?.dry_run
          ? 'Settlement previewed (dry run)'
          : `Settlement ${result?.code ?? ''} created`,
      )
      onDone?.(result?.id)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to run settlement'),
  })

  const pending = previewMutation.isPending || runMutation.isPending
  const lines = preview?.lines ?? []
  const skipped = preview?.skipped ?? []

  const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    display: 'block',
    marginBottom: 6,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 70,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <PlayCircle size={16} style={{ color: 'var(--accent-light)' }} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Run Sellable Settlement
              </h3>
              <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
                Turns sales of deferred SKUs into a physical stock deduction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
            <div>
              <label style={sectionLabel}>As Of *</label>
              <input
                type="date"
                value={asOf}
                onChange={(e) => {
                  setAsOf(e.target.value)
                  setPreview(null)
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={sectionLabel}>Description</label>
              <input
                type="text"
                placeholder="e.g. End of day"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setPreview(null)
                }}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Preview summary */}
          {preview && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--background)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={14} style={{ color: 'var(--info)' }} />
                <span style={{ ...sectionLabel, marginBottom: 0 }}>
                  Preview (dry run) — nothing is saved
                </span>
              </div>

              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>As Of</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                    {formatDate(preview.as_of)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                    Usages Settled
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                    {(preview.usage_count ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                    Total COGS
                  </span>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {formatCurrency(preview.total_cogs ?? 0)}
                  </div>
                </div>
              </div>

              {lines.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Product Inventory</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Role</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Sold</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Applied Base</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Unit Cost</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>COGS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={line.id ?? idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={tdStyle}>{inventoryLabel(line.product_inventory)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{line.role}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {Number(line.sold_qty ?? 0).toLocaleString('id-ID')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {Number(line.applied_base_qty ?? 0).toLocaleString('id-ID')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {formatCurrency(line.unit_cost ?? 0)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(line.cogs_amount ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {skipped.length > 0 && (
                <div
                  style={{
                    border: '1px solid var(--warning)',
                    background: 'var(--warning-bg)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--warning)',
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: skipped.length ? 8 : 0,
                    }}
                  >
                    <AlertTriangle size={14} />
                    {skipped.length} usage{skipped.length > 1 ? 's' : ''} skipped
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {skipped.map((row, idx) => (
                      <li key={idx} style={{ fontSize: 12, color: 'var(--foreground)' }}>
                        Product #{row.product_id ?? row.product_inventory_id ?? '—'} ·{' '}
                        {row.role ?? 'base'} ·{' '}
                        {Number(row.applied_base_qty ?? 0).toLocaleString('id-ID')} —{' '}
                        <em>{humanizeReason(row.reason)}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lines.length === 0 && skipped.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                  Nothing to settle for this date.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '16px 22px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <button
            type="button"
            onClick={() => previewMutation.mutate()}
            disabled={pending || !asOf}
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
              cursor: pending || !asOf ? 'not-allowed' : 'pointer',
              opacity: pending || !asOf ? 0.6 : 1,
            }}
          >
            <Eye size={14} />
            {previewMutation.isPending ? 'Previewing...' : 'Preview (dry run)'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
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
              onClick={() => runMutation.mutate()}
              disabled={pending || !asOf}
              style={{
                padding: '7px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                cursor: pending || !asOf ? 'not-allowed' : 'pointer',
                opacity: pending || !asOf ? 0.7 : 1,
              }}
            >
              {runMutation.isPending ? 'Running...' : 'Run Settlement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12.5,
  color: 'var(--foreground)',
  verticalAlign: 'middle',
}
