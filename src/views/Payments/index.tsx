'use client'
import { formatDateTime } from '@/utils/date';
import { formatCurrency } from '@/utils/price';
import Link from 'next/link';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentsService } from '@/services/payments.service'
import { useAuth } from '@/hooks/useAuth'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CreditCard,
  Ban,
  SplitSquareHorizontal
} from 'lucide-react'
import AllocateModal from './AllocateModal'
import { toastMutationApiError } from '@/utils/apiError';
import { CustomPagination } from '@/components/ui/CustomPagination'

interface Payment {
  id: number
  amount: number
  description?: string
  created_at?: string
  sales_order?: { id: number; code?: string }
  payment_method?: { id: number; name: string }
  branch?: { id: number; name: string }
  created_by?: { id: number; name: string }
  allocations?: { sales_order_id?: number, purchase_order_id?: number, amount: number }[]
  is_reversed?: boolean
}

export default function PaymentsView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("payment.read");
  const canCreate = hasPermission('payment.create')
  const canEdit = hasPermission('payment.update')
  const canDelete = hasPermission('payment.delete')

  // Suppress unused-var warnings for capabilities not yet rendered.
  void canCreate
  void canEdit

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [voidConfirmId, setVoidConfirmId] = useState<number | null>(null)
  const [allocatePayment, setAllocatePayment] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payments', page, perPage, debouncedSearch],
    queryFn: () =>
      paymentsService
        .list({
          page,
          per_page: perPage,
          include: 'sales_order,payment_method,branch,created_by',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: Payment[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete payment'),
  })

  const voidMutation = useMutation({
    mutationFn: (id: number) => paymentsService.void(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment voided')
      setVoidConfirmId(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to void payment'),
  })

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

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
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
            Payments
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Record of all payments received
          </p>
        </div>
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
        <div style={{ position: 'relative', maxWidth: 300, width: '100%' }}>
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
            placeholder="Search payments..."
            style={{
              ...inputBase,
              width: '100%',
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
              <th style={{ ...thStyle, width: 160 }}>Allocated Orders</th>
              <th style={{ ...thStyle, width: 140 }}>Method</th>
              <th style={{ ...thStyle, width: 160 }}>Branch</th>
              <th style={{ ...thStyle, width: 140 }}>Amount</th>
              <th style={{ ...thStyle, width: 140 }}>Recorded By</th>
              <th style={{ ...thStyle, width: 160 }}>Date</th>
              <th style={{ ...thStyle, width: 80 }} />
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
                          width: j === 6 ? 40 : '75%',
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
                    Failed to load payments.
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
                    <CreditCard size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No payments recorded</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
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
                    {canRead ? item.allocations && item.allocations.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {item.allocations.map((alloc, idx) => (
                          <div key={idx}>
                            {alloc.sales_order_id && (
                              <Link 
                                href={`/sales/sales-orders/${alloc.sales_order_id}/detail`}
                                style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                                SO-{alloc.sales_order_id} ({formatCurrency(alloc.amount || 0)})
                              </Link>
                            )}
                            {alloc.purchase_order_id && (
                              <Link 
                                href={`/purchase/purchase-orders/${alloc.purchase_order_id}/detail`}
                                style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                                PO-{alloc.purchase_order_id} ({formatCurrency(alloc.amount || 0)})
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Unallocated</span>
                    ) : "***"}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 99,
                          background: 'var(--accent-light-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <CreditCard size={12} color="var(--accent-light)" />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                        {item.payment_method?.name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.branch?.name ?? '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        textDecoration: item.is_reversed ? 'line-through' : 'none'
                      }}
                    >
                      Rp {(item.amount ?? 0).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.created_by?.name ?? '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.created_at
                        ? formatDateTime(item.created_at)
                        : '—'}
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
                      {!item.is_reversed && canEdit && (
                        <button
                          onClick={() => setAllocatePayment(item)}
                          style={actionBtnStyle}
                          title="Allocate">
                          <SplitSquareHorizontal size={14} />
                        </button>
                      )}
                      {!item.is_reversed && canEdit && (
                        <button
                          onClick={() => setVoidConfirmId(item.id)}
                          style={{ ...actionBtnStyle, color: 'var(--foreground-muted)' }}
                          title="Void">
                          <Ban size={14} />
                        </button>
                      )}
                      {canDelete && (<button
                        onClick={() => setDeleteConfirmId(item.id)}
                        style={{ ...actionBtnStyle, color: 'var(--destructive)' }}
                        title="Delete">
                        <Trash2 size={14} />
                      </button>)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm */}
      {deleteConfirmId !== null && (
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
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 380,
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
              Delete Payment
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently delete this payment and remove all related journal entries. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
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
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
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
      {/* Void confirm */}
      {voidConfirmId !== null && (
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
            onClick={() => setVoidConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 380,
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
              Void Payment
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              Are you sure you want to void this payment? This will reverse the journal entries.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setVoidConfirmId(null)}
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
                onClick={() => voidMutation.mutate(voidConfirmId)}
                disabled={voidMutation.isPending}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: voidMutation.isPending ? 0.7 : 1,
                }}
              >
                Void
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Allocate Modal */}
      {allocatePayment && (
        <AllocateModal
          payment={allocatePayment}
          onClose={() => setAllocatePayment(null)}
        />
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
