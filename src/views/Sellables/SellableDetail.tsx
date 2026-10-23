'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { sellablesService } from '@/services/sellables.service'
import type { ApiResponse, Sellable, SellableUsage } from '@/types/api'
import { formatDate, formatDateTime } from '@/utils/date'
import { inventoryLabel } from '@/views/SellableSettlements/helpers'
import {
  ArrowLeft,
  PackageOpen,
  Calendar,
  Hash,
  Layers,
  AlertTriangle,
  ListChecks,
} from 'lucide-react'

interface SellableDetailProps {
  id: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'var(--success)', bg: 'var(--success-bg)' },
  closed: { label: 'Closed', color: 'var(--info)', bg: 'var(--info-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const USAGE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'var(--info)', bg: 'var(--info-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  reversed: { label: 'Reversed', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const fmtQty = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 6 })

/** True when the date string (YYYY-MM-DD) is before today's date. */
function isExpiredDate(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().slice(0, 10)
  return String(dateStr).slice(0, 10) < today
}

export default function SellableDetail({ id }: SellableDetailProps) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sellable', id],
    queryFn: () => sellablesService.findById(id).then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const sellable = (data as ApiResponse<Sellable> | undefined)?.data
  const usages: SellableUsage[] = sellable?.usages ?? []

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

  const infoTile = (
    icon: React.ReactNode,
    label: string,
    value: React.ReactNode,
    accent?: boolean,
  ) => (
    <div style={infoCardStyle} key={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={iconBoxStyle}>{icon}</div>
        <span style={sectionLabelStyle}>{label}</span>
      </div>
      <div
        style={{
          fontSize: accent ? 18 : 15,
          fontWeight: accent ? 700 : 600,
          color: accent ? 'var(--accent)' : 'var(--foreground)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {value}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
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
            Loading sellable lot...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !sellable) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <PackageOpen size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Sellable lot not found
        </p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  const statusMeta =
    STATUS_META[String(sellable.status || '').toLowerCase()] ?? STATUS_META.active
  const qty = Number(sellable.qty ?? 0)
  const remaining = Number(sellable.remaining_qty ?? 0)
  const writtenOff = Number(sellable.written_off_qty ?? 0)
  const usedQty = usages
    .filter((u) => String(u.status || '').toLowerCase() !== 'reversed')
    .reduce((sum, u) => sum + Number(u.qty ?? 0), 0)
  const isExpired = isExpiredDate(sellable.expiry_date)

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 1100,
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
          flexWrap: 'wrap',
          gap: 12,
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
                {sellable.batch_code || `Sellable #${sellable.id}`}
              </h1>
              <span style={badge(statusMeta.bg, statusMeta.color)}>{statusMeta.label}</span>
              {isExpired && (
                <span style={badge('var(--destructive-bg)', 'var(--destructive)')}>
                  Expired
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              Sellable Lot — portioned stock with trackable remaining qty
            </p>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {infoTile(
          <Layers size={15} style={{ color: 'var(--accent-light)' }} />,
          'SKU',
          sellable.product_uom
            ? `${sellable.product_uom.product?.name ?? sellable.product_uom.name ?? 'Unknown'} (${
                sellable.product_uom.uom?.code ?? sellable.product_uom.code ?? '—'
              })`
            : inventoryLabel(sellable.product_inventory),
        )}
        {infoTile(
          <Hash size={15} style={{ color: 'var(--accent-light)' }} />,
          'Original Qty',
          fmtQty(qty),
        )}
        {infoTile(
          <PackageOpen size={15} style={{ color: 'var(--accent-light)' }} />,
          'Remaining Qty',
          fmtQty(remaining),
          true,
        )}
        {infoTile(
          <Calendar
            size={15}
            style={{ color: isExpired ? 'var(--destructive)' : 'var(--accent-light)' }}
          />,
          'Expiry Date',
          sellable.expiry_date ? formatDate(sellable.expiry_date) : '—',
        )}
        {infoTile(
          <AlertTriangle size={15} style={{ color: 'var(--accent-light)' }} />,
          'Written Off',
          fmtQty(writtenOff),
        )}
        {infoTile(
          <ListChecks size={15} style={{ color: 'var(--accent-light)' }} />,
          'Usages (count)',
          usages.length.toLocaleString('id-ID'),
        )}
        {infoTile(
          <Layers size={15} style={{ color: 'var(--accent-light)' }} />,
          'Inventory',
          sellable.product_inventory
            ? `#${sellable.product_inventory.id}${
                sellable.product_inventory.location_ref
                  ? ` · ${sellable.product_inventory.location_ref}`
                  : ''
              }`
            : sellable.product_inventory_id
              ? `#${sellable.product_inventory_id}`
              : '—',
        )}
        {infoTile(
          <Hash size={15} style={{ color: 'var(--accent-light)' }} />,
          'Portioning',
          sellable.portioning_id ? `#${sellable.portioning_id}` : '—',
        )}
        {infoTile(
          <Calendar size={15} style={{ color: 'var(--accent-light)' }} />,
          'Created At',
          sellable.created_at ? formatDateTime(sellable.created_at) : '—',
        )}
      </div>

      {/* Progress bar: consumed vs remaining */}
      {qty > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={sectionLabelStyle}>Stock Depletion</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              {fmtQty(remaining)} / {fmtQty(qty)} left
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: 'var(--background)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, (remaining / qty) * 100))}%`,
                height: '100%',
                background:
                  remaining > 0 ? 'var(--success)' : 'var(--foreground-subtle)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--foreground-muted)' }}>
            <span>Used: {fmtQty(usedQty)}</span>
            <span>Written off: {fmtQty(writtenOff)}</span>
          </div>
        </div>
      )}

      {/* Usages */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={sectionLabelStyle}>Usage History</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {usages.length} record{usages.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                <th style={thStyle}>Sold On</th>
                <th style={thStyle}>Sales Order</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                <th style={thStyle}>Settled At</th>
                <th style={thStyle}>Settlement</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {usages.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                      This lot has not been used yet.
                    </p>
                  </td>
                </tr>
              ) : (
                usages.map((usage, idx) => {
                  const usageMeta =
                    USAGE_STATUS_META[String(usage.status || '').toLowerCase()] ??
                    USAGE_STATUS_META.active
                  return (
                    <tr key={usage.id ?? idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          color: 'var(--foreground-muted)',
                          width: 50,
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={tdStyle}>
                        {usage.sold_on ? formatDate(usage.sold_on) : '—'}
                      </td>
                      <td style={tdStyle}>
                        {usage.sales_order_id ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 12.5,
                              color: 'var(--accent)',
                            }}
                          >
                            SO #{usage.sales_order_id}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                        {fmtQty(usage.qty)}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                        {usage.settled_at ? formatDateTime(usage.settled_at) : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                        {usage.settlement_id ? `#${usage.settlement_id}` : '—'}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            color: usageMeta.color,
                            backgroundColor: usageMeta.bg,
                          }}
                        >
                          {usageMeta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  verticalAlign: 'middle',
}
