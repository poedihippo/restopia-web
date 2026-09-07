'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { invoicesService } from '@/services/invoices.service'
import { deliveriesService } from '@/services/deliveries.service'
import { receiptsService } from '@/services/receipts.service'
import { useAuth } from '@/hooks/useAuth'
import { toastMutationApiError } from '@/utils/apiError'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  X,
  Loader2,
  Truck,
} from 'lucide-react'

const todayInputDate = () => new Date().toISOString().split('T')[0]

interface Invoice {
  id: number
  code: string
  date: string
  total_price: number
  status: 'issued' | 'paid' | 'void'
  description?: string
  created_at?: string
  billed_branch?: { id: number; name: string }
  delivery?: { id: number; code: string }
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  issued: {
    label: 'Issued',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  paid: {
    label: 'Paid',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  void: {
    label: 'Void',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

export default function InvoicesView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('invoice.read')
  const canCreate = hasPermission('invoice.create')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', page, perPage, debouncedSearch],
    enabled: canRead,
    queryFn: () => {
      const params: any = { page, per_page: perPage, sort: '-created_at', include: 'billed_branch,delivery' }
      if (debouncedSearch && debouncedSearch.trim()) params['filter[search]'] = debouncedSearch.trim()
      return invoicesService.list(params).then((r) => r.data)
    },
  })

  const items: Invoice[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

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

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const actionBtnStyle: React.CSSProperties = {
    padding: 6,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    display: 'flex',
  }

  const deliveryPillStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--foreground-muted)',
  }

  if (!canRead) {
    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            padding: 24,
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--warning)',
            fontSize: 13,
          }}
        >
          You do not have permission to view invoices.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Invoices
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Invoices billed to a branch, created from a delivery
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/transfer/invoices/create')}
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
            <Plus size={15} />Create Invoice
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ position: 'relative', maxWidth: 280 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            style={{
              ...inputBase,
              width: 280,
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table */}
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
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 180 }}>Invoice Code</th>
              <th style={{ ...thStyle, width: 160 }}>Billed Branch</th>
              <th style={{ ...thStyle, width: 160 }}>Delivery</th>
              <th style={{ ...thStyle, width: 120 }}>Date</th>
              <th style={{ ...thStyle, width: 140 }}>Total</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 6 ? 40 : j === 5 ? 70 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load invoices.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <FileText size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No invoices found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const statusMeta = STATUS_META[item.status] ?? STATUS_META.issued
                return (
                  <tr
                    key={item.id}
                    style={{ transition: 'background 120ms' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--background)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
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
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {item.billed_branch?.name ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {item.delivery?.code ? (
                        <span style={deliveryPillStyle}>{item.delivery.code}</span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.date ? formatDate(item.date) : '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {getCanReadPrice()
                          ? `Rp ${Number(item.total_price ?? 0).toLocaleString('id-ID')}`
                          : '***'}
                      </span>
                    </td>
                    <td style={tdStyle}>
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
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          onClick={() => router.push(`/transfer/invoices/${item.id}`)}
                          style={actionBtnStyle}
                          title="View"
                        >
                          <Eye size={14} />
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

      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
