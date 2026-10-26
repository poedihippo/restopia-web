'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { sellableSettlementsService } from '@/services/sellable-settlements.service'
import type { SellableSettlement, SellableSettlementLine } from '@/types/api'
import { formatCurrency } from '@/utils/price'
import { formatDate } from '@/utils/date'
import { inventoryLabel } from './helpers'
import { ArrowLeft, Layers, Calendar, Hash, User, BookOpen, ListChecks } from 'lucide-react'

interface SellableSettlementDetailProps {
  id: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  final: { label: 'Final', color: 'var(--success)', bg: 'var(--success-bg)' },
  reversed: { label: 'Reversed', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const fmtQty = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 6 })

export default function SellableSettlementDetail({ id }: SellableSettlementDetailProps) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sellable-settlement', id],
    queryFn: () => sellableSettlementsService.findById(id).then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const settlement = (data as any)?.data as SellableSettlement | undefined
  const lines: SellableSettlementLine[] = settlement?.lines ?? []

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
            Loading settlement...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !settlement) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Layers size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Sellable settlement not found
        </p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  const statusMeta =
    STATUS_META[String(settlement.status || '').toLowerCase()] ?? STATUS_META.final
  const totalLines = lines.reduce((sum, line) => sum + Number(line.cogs_amount ?? 0), 0)

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
                {settlement.code}
              </h1>
              <span style={badge(statusMeta.bg, statusMeta.color)}>{statusMeta.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              Sellable Settlement — {settlement.description || 'Stock deduction from deferred SKU sales'}
            </p>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {infoTile(
          <Calendar size={15} style={{ color: 'var(--accent-light)' }} />,
          'Date',
          formatDate(settlement.date),
        )}
        {infoTile(
          <Hash size={15} style={{ color: 'var(--accent-light)' }} />,
          'Total COGS',
          formatCurrency(settlement.total_cogs ?? 0),
          true,
        )}
        {infoTile(
          <ListChecks size={15} style={{ color: 'var(--accent-light)' }} />,
          'Lines',
          lines.length.toLocaleString('id-ID'),
        )}
        {infoTile(
          <BookOpen size={15} style={{ color: 'var(--accent-light)' }} />,
          'COGS Journal',
          settlement.cogs_journal_id ? `#${settlement.cogs_journal_id}` : '—',
        )}
        {infoTile(
          <User size={15} style={{ color: 'var(--accent-light)' }} />,
          'Created By',
          settlement.created_by?.name ?? settlement.created_by_id ?? '—',
        )}
        {infoTile(
          <Calendar size={15} style={{ color: 'var(--accent-light)' }} />,
          'Created At',
          settlement.created_at ? formatDate(settlement.created_at) : '—',
        )}
      </div>

      {/* Description */}
      {settlement.description && (
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
            {settlement.description}
          </p>
        </div>
      )}

      {/* Lines */}
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
          <span style={sectionLabelStyle}>Settlement Lines</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {formatCurrency(totalLines)}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                <th style={thStyle}>Product Inventory</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Sold Qty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Exact Base Qty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Applied Base Qty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Unit Cost</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>COGS</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
                      This settlement has no lines.
                    </p>
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr
                    key={line.id ?? idx}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', width: 50 }}>
                      {idx + 1}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{inventoryLabel(line.product_inventory)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                        Inventory #{line.product_inventory_id}
                        {line.reservation_id ? ` · Reservation #${line.reservation_id}` : ''}
                      </div>
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
                          background:
                            line.role === 'packaging' ? 'var(--info-bg)' : 'var(--accent-light-bg)',
                          color: line.role === 'packaging' ? 'var(--info)' : 'var(--accent)',
                        }}
                      >
                        {line.role}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtQty(line.sold_qty)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--foreground-muted)' }}>
                      {fmtQty(line.exact_base_qty)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtQty(line.applied_base_qty)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {formatCurrency(line.unit_cost ?? 0)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(line.cogs_amount ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--background)' }}>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    Total COGS
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                    {formatCurrency(totalLines)}
                  </td>
                </tr>
              </tfoot>
            )}
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
