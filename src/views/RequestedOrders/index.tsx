'use client'
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Truck,
  Package,
  Building2,
  Check,
  X,
} from 'lucide-react'

interface RequestedPO {
  id: number
  code: string
  date: string
  total_price: number
  status: 'pending' | 'accepted' | 'rejected' | 'fulfilled' | 'final'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  supplier_branch?: { id: number; name: string }
  purchase_order_details?: Array<{
    id: number
    qty: number
    price: number
    product_uom?: {
      id: number
      code?: string
      product?: { name: string }
      uom?: { name: string }
      franchise_price?: number
    }
  }>
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: {
    label: 'Pending',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  final: {
    label: 'Final',
    color: 'var(--accent)',
    bg: 'var(--accent-bg)',
  },
  accepted: {
    label: 'Accepted',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  rejected: {
    label: 'Rejected',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
  fulfilled: {
    label: 'Fulfilled',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  partially_delivered: {
    label: 'Partially Delivered',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  delivered: {
    label: 'Delivered',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
}

export default function RequestedOrdersView() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const myBranchId = user?.branch?.id
  const canSeeFranchisePrice = hasPermission('common.franchise-price.read')
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'final'>('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['requested-orders', page, debouncedSearch, statusFilter, myBranchId],
    enabled: !!myBranchId,
    queryFn: () =>
      purchaseOrdersService
        .list({
          page,
          per_page: 15,
          include:
            'branch,supplier_branch,purchase_order_details,purchase_order_details.product_uom',
          sort: '-created_at',
          'filter[supplier_branch_id]': myBranchId || undefined,
          'filter[type]': 'branch',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: RequestedPO[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'reject' }) =>
      action === 'accept'
        ? purchaseOrdersService.accept(id)
        : purchaseOrdersService.reject(id),
    onSuccess: (_res, vars) => {
      // Refresh the supplier's incoming list AND the requester's PO list.
      queryClient.invalidateQueries({ queryKey: ['requested-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success(vars.action === 'accept' ? 'Order accepted' : 'Order rejected')
    },
    onError: (err: any) => toastMutationApiError(err, 'Action failed'),
  })

  const handleAction = (id: number, action: 'accept' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this order?`)) return
    actionMutation.mutate({ id, action })
  }

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    display: 'block',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Requested PO
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Purchase orders from other branches requesting supply from your branch
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
          marginBottom: 20,
        }}
      >
        <div style={{ position: 'relative', maxWidth: 280, width: '100%' }}>
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
            placeholder="Search by code..."
            style={{
              ...inputBase,
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as '' | 'pending' | 'final')
          }
          style={{
            ...inputBase,
            padding: '8px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Fulfilled</option>
        </select>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!myBranchId ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <Package size={32} color="var(--border)" style={{ margin: '0 auto' }} />
            <span
              style={{
                display: 'block',
                marginTop: 8,
                fontSize: 14,
                color: 'var(--foreground-muted)',
              }}
            >
              No branch assigned
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 12,
                color: 'var(--foreground-subtle)',
              }}
            >
              Assign a branch to your account to see incoming requests
            </span>
          </div>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              style={{
                height: 80,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                opacity: 0.6,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))
        ) : isError ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
              Failed to load requested orders.
            </span>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <Package size={32} color="var(--border)" style={{ margin: '0 auto' }} />
            <span
              style={{
                display: 'block',
                marginTop: 8,
                fontSize: 14,
                color: 'var(--foreground-muted)',
              }}
            >
              No incoming requests
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 12,
                color: 'var(--foreground-subtle)',
              }}
            >
              Other branches haven&apos;t requested supply from your branch yet
            </span>
          </div>
        ) : (
          items.map((item) => {
            const isExpanded = expandedId === item.id
            const statusMeta =
              STATUS_META[item.status as keyof typeof STATUS_META] ?? STATUS_META.pending
            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {item.code}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: statusMeta.bg,
                          color: statusMeta.color,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        from
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Building2 size={12} color="var(--foreground-subtle)" />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--accent)',
                          }}
                        >
                          {item.branch?.name ?? '—'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                      >
                        {item.date
                          ? formatDate(item.date)
                          : '—'}
                      </span>
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                      >
                        {item.purchase_order_details?.length ?? 0} item(s)
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', gap: 6 }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/purchase/internal-orders/${item.id}/detail`)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--foreground-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <Eye size={12} />
                      View
                    </button>
                    {(item.status === 'pending' || item.status === 'rejected') && (
                      <button
                        type="button"
                        disabled={actionMutation.isPending}
                        onClick={() => handleAction(item.id, 'accept')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: 'var(--success)',
                          color: 'white',
                          border: '1px solid var(--success)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: actionMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: actionMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        <Check size={12} />
                        Accept
                      </button>
                    )}
                    {(item.status === 'pending' || item.status === 'accepted') && (
                      <button
                        type="button"
                        disabled={actionMutation.isPending}
                        onClick={() => handleAction(item.id, 'reject')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: 'var(--surface)',
                          color: 'var(--destructive)',
                          border: '1px solid var(--destructive)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: actionMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: actionMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        <X size={12} />
                        Reject
                      </button>
                    )}
                    {item.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/purchase/requested-orders/${item.id}/fulfill`,
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
                        <Truck size={12} />
                        Fulfill
                      </button>
                    )}
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={14} color="var(--foreground-muted)" />
                  ) : (
                    <ChevronDown size={14} color="var(--foreground-muted)" />
                  )}
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      padding: '12px 20px 16px',
                      background: 'var(--background)',
                    }}
                  >
                    <span style={{ ...sectionLabelStyle, marginBottom: 8 }}>
                      Requested Items
                    </span>

                    {(item.purchase_order_details?.length ?? 0) > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {(item.purchase_order_details ?? []).map((d, idx) => (
                          <div
                            key={d.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '7px 12px',
                              background: 'var(--surface)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 99,
                                background: 'var(--accent-light-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--accent)',
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--foreground)',
                              }}
                            >
                              {d.product_uom?.product?.name ?? '—'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: 'var(--foreground-muted)',
                                padding: '1px 6px',
                                background: 'var(--background)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {d.product_uom?.uom?.name ?? ''}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--foreground)',
                              }}
                            >
                              {(d.qty ?? 0).toLocaleString('id-ID')}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--accent)',
                                minWidth: 90,
                                textAlign: 'right',
                              }}
                            >
                              {canSeeFranchisePrice
                                ? `Rp ${(d.product_uom?.franchise_price ?? 0).toLocaleString('id-ID')}`
                                : '***'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
                        No items loaded
                      </span>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        padding: '8px 12px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--foreground-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                        }}
                      >
                        Franchise Total
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--accent)',
                        }}
                      >
                        {canSeeFranchisePrice
                          ? `Rp ${(item.total_price ?? 0).toLocaleString('id-ID')}`
                          : '***'}
                      </span>
                    </div>

                    {item.description && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--foreground-muted)',
                            display: 'block',
                            marginBottom: 2,
                          }}
                        >
                          NOTES
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                          {item.description}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {meta && lastPage > 1 && (
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
              color:
                page === lastPage ? 'var(--foreground-subtle)' : 'var(--foreground)',
              cursor: page === lastPage ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
