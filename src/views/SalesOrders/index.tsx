'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { salesOrdersService as salesOrderService } from '@/services/sales-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { PriceDisplay } from '@/components/PriceDisplay'
import { CustomPagination } from '@/components/ui/CustomPagination'

interface SalesOrder {
  id: number
  code: string
  type: string
  status?: string
  settlement_status?: 'pending' | 'credit' | 'settled' | 'cancelled'
  payment_status?: string
  date?: string
  fulfillment_date?: string
  total_price?: number
  customer?: { name?: string }
  customer_name?: string
  customer_phone?: string
}

const SETTLEMENT_META = {
  pending: { label: 'Pending', color: 'var(--foreground-muted)', bg: 'var(--background)' },
  credit: { label: 'Credit', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const PAYMENT_STATUS_META = {
  pending: { label: 'Unpaid', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  partial: { label: 'Partial', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
}

export default function SalesOrdersView() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("sales-order.read");
  const canCreate = hasPermission('sales-order.create')
  const canEdit = hasPermission('sales-order.update')
  const canDelete = hasPermission('sales-order.delete')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(1000)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [settlementFilter, setSettlementFilter] = useState<
    '' | 'pending' | 'credit' | 'settled' | 'cancelled'
  >('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    '' | 'pending' | 'partial' | 'paid'
  >('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateGte, setDateGte] = useState('')
  const [dateLte, setDateLte] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await salesOrderService.exportExcel({
        'filter[search]': searchDebounced || undefined,
        'filter[status]': statusFilter || undefined,
        'filter[type]': typeFilter || undefined,
        'filter[settlement_status]': settlementFilter || undefined,
        'filter[payment_status]': paymentStatusFilter || undefined,
      })

      const blob = new Blob([response.data], {
        type:
          'application/vnd.openxmlformats-' +
          'officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-orders-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded successfully')
    } catch (err) {
      toast.error('Failed to export')
    } finally {
      setIsExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      'sales-orders',
      page, perPage,
      searchDebounced,
      statusFilter,
      settlementFilter,
      paymentStatusFilter,
      typeFilter,
      dateGte,
      dateLte,
    ],
    queryFn: () =>
      salesOrderService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'branch,customer',
          'filter[search]': searchDebounced || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[settlement_status]': settlementFilter || undefined,
          'filter[payment_status]': paymentStatusFilter || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[date_gte]': dateGte || undefined,
          'filter[date_lte]': dateLte || undefined,
        })
        .then((r) => r.data),
  })

  const items = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => salesOrderService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('Order deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toastMutationApiError(err),
  })

  const statusColor = (s: string) =>
    s === 'final'
      ? { bg: 'var(--success-bg)', color: 'var(--success)' }
      : { bg: 'var(--warning-bg)', color: 'var(--warning)' }

  const typeColor = (t: string) =>
    t === 'online'
      ? { bg: 'var(--info-bg)', color: 'var(--info)' }
      : { bg: 'var(--accent-light-bg)', color: 'var(--accent)' }

  const thStyle = {
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle = {
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Sales Orders
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            All offline and online orders
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
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
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? (
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <Download size={14} />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          {canCreate && (<button
            type="button"
            onClick={() => router.push('/sales/sales-orders/create')}
            style={{
              height: 40,
              padding: '0 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}>+ New Order
                                    </button>)}
        </div>
      </div>
      {/* Filters toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search code / customer..."
          style={{
            height: 36,
            width: 260,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="final">Final</option>
        </select>
        <select
          value={settlementFilter}
          onChange={(e) => {
            setSettlementFilter(
              e.target.value as '' | 'pending' | 'credit' | 'settled' | 'cancelled'
            )
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        >
          <option value="">All Settlements</option>
          <option value="pending">Pending</option>
          <option value="credit">Credit</option>
          <option value="settled">Settled</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(
              e.target.value as '' | 'pending' | 'partial' | 'paid'
            )
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        >
          <option value="">All Payments</option>
          <option value="pending">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        >
          <option value="">All Types</option>
          <option value="offline">Offline</option>
          <option value="online">Online</option>
        </select>
        <input
          type="date"
          value={dateGte}
          onChange={(e) => {
            setDateGte(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>–</span>
        <input
          type="date"
          value={dateLte}
          onChange={(e) => {
            setDateLte(e.target.value)
            setPage(1)
          }}
          style={{
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
          }}
        />
        {(search || statusFilter || settlementFilter || paymentStatusFilter || typeFilter || dateGte || dateLte) && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setSettlementFilter('')
              setPaymentStatusFilter('')
              setTypeFilter('')
              setDateGte('')
              setDateLte('')
              setPage(1)
            }}
            style={{
              height: 36,
              padding: '0 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            Clear
          </button>
        )}
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
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Fulfillment</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: 90 }}>Payment</th>
              <th style={{ ...thStyle, width: 120 }}>Settlement</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 16,
                          background: 'var(--border)',
                          borderRadius: 4,
                          opacity: 0.6,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 48,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No orders found
                </td>
              </tr>
            )}
            {items.map((item: any, idx: number) => {
              const sc = statusColor(item.status)
              const tc = typeColor(item.type)
              return (
                <tr
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/sales/sales-orders/${item.id}/detail`)}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent)' }}>
                    {canRead ? item.code : "***"}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background: tc.bg,
                        color: tc.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {canRead ? item.customer?.name ?? item.customer_name ?? '—' : "***"}
                  </td>
                  <td style={tdStyle}>
                    {canRead ? item.date
                      ? item.date
                      : item.date : "***"}
                  </td>
                  <td style={tdStyle}>
                    {canRead ? item.fulfillment_date
                      ? item.fulfillment_date
                      : item.fulfillment_date : "***"}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <PriceDisplay amount={item.total_price} />
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background: sc.bg,
                        color: sc.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    {canRead ? (() => {
                      const paymentMeta =
                        PAYMENT_STATUS_META[
                        item.payment_status as keyof typeof PAYMENT_STATUS_META
                        ] ?? PAYMENT_STATUS_META.pending
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: paymentMeta.bg,
                            color: paymentMeta.color,
                          }}
                        >
                          {paymentMeta.label}
                        </span>
                      )
                    })() : "***"}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    {canRead ? (() => {
                      const settlementMeta =
                        SETTLEMENT_META[
                        item.settlement_status as keyof typeof SETTLEMENT_META
                        ] ?? SETTLEMENT_META.pending
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: settlementMeta.bg,
                            color: settlementMeta.color,
                          }}
                        >
                          {settlementMeta.label}
                        </span>
                      )
                    })() : "***"}
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => router.push(`/sales/sales-orders/${item.id}/detail`)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          color: 'var(--foreground)',
                        }}
                      >
                        View
                      </button>
                      {canDelete && (<button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--destructive)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--destructive)',
                        }}>Delete
                                                                        </button>)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete dialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                marginBottom: 8,
                color: 'var(--foreground)',
              }}
            >
              Delete Order
            </h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginBottom: 24 }}>
              Delete order <strong>{deleteTarget.code}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  height: 40,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(deleteTarget.id)}
                disabled={deleting}
                style={{
                  flex: 1,
                  height: 40,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive)',
                  color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
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
  );
}
