'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deliveriesService } from '@/services/deliveries.service'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowRight,
  ArrowLeft,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react'
import TransferOutForm from './TransferOutForm'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: {
    label: 'Pending',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  final: {
    label: 'Sent',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
}

export default function StockTransferView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const myBranchId = user?.branch?.id

  const [activeTab, setActiveTab] = useState<'out' | 'in'>('out')
  const [showOutForm, setShowOutForm] = useState(false)
  const [page, setPage] = useState(1)

  // ── Outgoing transfers ──────────────────────────────────────────────────
  const { data: outData, isLoading: outLoading } = useQuery({
    queryKey: ['deliveries-transfer-out', page, myBranchId],
    enabled: activeTab === 'out',
    queryFn: () =>
      deliveriesService
        .list({
          page,
          per_page: 15,
          include: 'target_branch,delivery_details',
          sort: '-created_at',
          'filter[source_type]': 'transfer_to_branch',
          'filter[branch_id]': myBranchId || undefined,
        } as any)
        .then((r) => r.data),
  })
  const outItems: any[] = (outData as any)?.data ?? []
  const outMeta = (outData as any)?.meta

  // ── Incoming transfers ──────────────────────────────────────────────────
  const { data: inData, isLoading: inLoading } = useQuery({
    queryKey: ['deliveries-transfer-in', page, myBranchId],
    enabled: activeTab === 'in' && !!myBranchId,
    queryFn: () =>
      deliveriesService
        .list({
          page,
          per_page: 15,
          include: 'branch,delivery_details',
          sort: '-created_at',
          'filter[source_type]': 'transfer_to_branch',
          'filter[target_branch_id]': myBranchId || undefined,
        } as any)
        .then((r) => r.data),
  })
  const inItems: any[] = (inData as any)?.data ?? []
  const inMeta = (inData as any)?.meta

  // ── Shared styles ───────────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }

  const tabBtn = (tab: 'out' | 'in'): React.CSSProperties => ({
    padding: '10px 20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    borderBottom:
      activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--accent)' : 'var(--foreground-muted)',
  })

  const renderPagination = (meta: any) => {
    const lastPage = meta?.last_page ?? meta?.total_pages ?? 1
    if (!meta || lastPage <= 1) return null
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
          Page {page} of {lastPage}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={page === lastPage}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: page === lastPage ? 'var(--foreground-subtle)' : 'var(--foreground)',
            cursor: page === lastPage ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    )
  }

  const renderEmpty = (label: string) => (
    <tr>
      <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            color: 'var(--foreground-muted)',
          }}
        >
          <Package size={32} style={{ opacity: 0.4 }} />
          <span style={{ fontSize: 14 }}>{label}</span>
        </div>
      </td>
    </tr>
  )

  const renderSkeletonRows = (cols: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={`sk-${i}`}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} style={tdStyle}>
            <div
              style={{
                height: 14,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--border)',
                opacity: 0.6,
                width: '70%',
              }}
            />
          </td>
        ))}
      </tr>
    ))

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Stock Transfer
        </h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Transfer stock between branches
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
          gap: 0,
        }}
      >
        {(['out', 'in'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab)
              setPage(1)
            }}
            style={tabBtn(tab)}
          >
            {tab === 'out' ? '→ Transfer Out' : '← Transfer In'}
          </button>
        ))}
      </div>

      {activeTab === 'out' && (
        <div>
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  margin: 0,
                }}
              >
                Outgoing Transfers
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--foreground-muted)',
                  margin: '2px 0 0',
                }}
              >
                Stock you've sent to other branches
              </p>
            </div>
            {!showOutForm && (
              <button
                type="button"
                onClick={() => setShowOutForm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <ArrowRight size={15} />
                New Transfer
              </button>
            )}
          </div>

          {showOutForm && (
            <TransferOutForm
              onClose={() => setShowOutForm(false)}
              onSuccess={() => {
                setShowOutForm(false)
                queryClient.invalidateQueries({ queryKey: ['deliveries-transfer-out'] })
              }}
            />
          )}

          {/* Outgoing table */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 140 }}>Code</th>
                  <th style={thStyle}>To Branch</th>
                  <th style={{ ...thStyle, width: 80 }}>Items</th>
                  <th style={{ ...thStyle, width: 120 }}>Date</th>
                  <th style={{ ...thStyle, width: 130 }}>Total</th>
                  <th style={{ ...thStyle, width: 100 }}>Status</th>
                  <th style={{ ...thStyle, width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {outLoading
                  ? renderSkeletonRows(7)
                  : outItems.length === 0
                  ? renderEmpty('No outgoing transfers yet')
                  : outItems.map((item: any) => {
                      const meta =
                        STATUS_META[item.status as keyof typeof STATUS_META] ??
                        STATUS_META.pending
                      return (
                        <tr key={item.id}>
                          <td style={tdStyle}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--accent)',
                              }}
                            >
                              {item.code}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--foreground)',
                              }}
                            >
                              {item.target_branch?.name ?? '—'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                            >
                              {item.delivery_details?.length ?? 0} items
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{ fontSize: 13, color: 'var(--foreground-muted)' }}
                            >
                              {item.date
                                ? new Date(item.date).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--foreground)',
                              }}
                            >
                              Rp {Number(item.total_price ?? 0).toLocaleString('id-ID')}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '3px 10px',
                                borderRadius: 99,
                                fontSize: 11,
                                fontWeight: 600,
                                background: meta.bg,
                                color: meta.color,
                              }}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/transfer/deliveries/${item.id}/detail`)
                              }
                              title="View"
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
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>

          {renderPagination(outMeta)}
        </div>
      )}

      {activeTab === 'in' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              Incoming Transfers
            </h2>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '2px 0 0',
              }}
            >
              Deliveries sent to your branch
            </p>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 140 }}>Code</th>
                  <th style={thStyle}>From Branch</th>
                  <th style={{ ...thStyle, width: 80 }}>Items</th>
                  <th style={{ ...thStyle, width: 120 }}>Date</th>
                  <th style={{ ...thStyle, width: 130 }}>Total</th>
                  <th style={{ ...thStyle, width: 100 }}>Status</th>
                  <th style={{ ...thStyle, width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {!myBranchId ? (
                  renderEmpty('No branch assigned to your account')
                ) : inLoading ? (
                  renderSkeletonRows(7)
                ) : inItems.length === 0 ? (
                  renderEmpty('No incoming transfers')
                ) : (
                  inItems.map((item: any) => {
                    const meta =
                      STATUS_META[item.status as keyof typeof STATUS_META] ??
                      STATUS_META.pending
                    return (
                      <tr key={item.id}>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--accent)',
                            }}
                          >
                            {item.code}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: 'var(--foreground)',
                            }}
                          >
                            {item.branch?.name ?? '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                          >
                            {item.delivery_details?.length ?? 0} items
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{ fontSize: 13, color: 'var(--foreground-muted)' }}
                          >
                            {item.date
                              ? new Date(item.date).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                            }}
                          >
                            Rp {Number(item.total_price ?? 0).toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '3px 10px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 600,
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/transfer/deliveries/${item.id}/detail`)
                              }
                              title="View"
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
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/transfer/stock-transfer/receive/${item.id}`,
                                )
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 10px',
                                background: 'var(--accent-light-bg)',
                                color: 'var(--accent)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              <ArrowLeft size={12} />
                              Receive
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {renderPagination(inMeta)}
        </div>
      )}
    </div>
  )
}
