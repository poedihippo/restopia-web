'use client'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { formatDate } from '@/utils/date';
import { getInvoiceDueInfo } from '@/utils/invoiceDue';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { invoicesService } from '@/services/invoices.service'
import { receiptsService } from '@/services/receipts.service'
import { branchesService } from '@/services/branches.service'
import { useAuth } from '@/hooks/useAuth'
import { useCentralCompanyScope } from '@/hooks/useCentralCompanyScope'
import { toastMutationApiError } from '@/utils/apiError'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
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
  due_date?: string
  total_price: number
  total_payment?: number
  payment_status?: 'pending' | 'partial' | 'paid'
  status: 'issued' | 'paid' | 'void'
  description?: string
  created_at?: string
  billed_branch?: { id: number; name: string }
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

const PAYMENT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Unpaid', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  partial: { label: 'Partial', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
}

/** Backend payment_status, falling back to total_payment vs total_price. */
function paymentStatusOf(item: Pick<Invoice, 'payment_status' | 'total_payment' | 'total_price'>): string {
  if (item.payment_status) return item.payment_status
  const paid = Number(item.total_payment ?? 0)
  if (paid <= 0) return 'pending'
  return paid >= Number(item.total_price ?? 0) ? 'paid' : 'partial'
}

export default function InvoicesView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  // Warehouse / production: every invoice of the company (Branch filter narrows).
  const { scopeParams } = useCentralCompanyScope()
  const canRead = hasPermission('invoice.read')
  const canCreate = hasPermission('invoice.create')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [billedBranchFilter, setBilledBranchFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'basic'],
    enabled: canRead,
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branchOptions: { id: number; name: string }[] = (branchesData as any)?.data ?? []

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: [
      'invoices', page, perPage, debouncedSearch, statusFilter, paymentStatusFilter,
      branchFilter, billedBranchFilter, dateFrom, dateTo, dueDateFrom, dueDateTo, scopeParams.scope,
    ],
    enabled: canRead,
    queryFn: () => {
      const params: any = { page, per_page: perPage, sort: '-created_at', include: 'billed_branch', ...scopeParams }
      if (debouncedSearch && debouncedSearch.trim()) params['filter[search]'] = debouncedSearch.trim()
      if (statusFilter) params['filter[status]'] = statusFilter
      if (paymentStatusFilter) params['filter[payment_status]'] = paymentStatusFilter
      if (branchFilter) params['filter[branch_id]'] = branchFilter
      if (billedBranchFilter) params['filter[billed_branch_id]'] = billedBranchFilter
      if (dateFrom) params['filter[date_gte]'] = dateFrom
      if (dateTo) params['filter[date_lte]'] = dateTo
      if (dueDateFrom) params['filter[due_date_gte]'] = dueDateFrom
      if (dueDateTo) params['filter[due_date_lte]'] = dueDateTo
      return invoicesService.list(params).then((r) => r.data)
    },
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

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


  const actionBtnStyle: React.CSSProperties = {
    padding: 6,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    display: 'flex',
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
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoices..."
        activeCount={countActive(
          statusFilter, paymentStatusFilter, branchFilter, billedBranchFilter,
          dateFrom, dateTo, dueDateFrom, dueDateTo,
        )}
        onClear={() => {
          setStatusFilter('')
          setPaymentStatusFilter('')
          setBranchFilter('')
          setBilledBranchFilter('')
          setDateFrom('')
          setDateTo('')
          setDueDateFrom('')
          setDueDateTo('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">All Status</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </FilterSelect>
            <FilterSelect value={paymentStatusFilter} onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage(1) }}>
              <option value="">All Payment</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Branches">
          <FilterField label="Branch">
            <FilterSelect block value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1) }}>
              <option value="">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Billed branch">
            <FilterSelect block value={billedBranchFilter} onChange={(e) => { setBilledBranchFilter(e.target.value); setPage(1) }}>
              <option value="">All billed branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Dates">
          <FilterField label="Invoice date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => { setDateFrom(v); setPage(1) }}
              onToChange={(v) => { setDateTo(v); setPage(1) }}
            />
          </FilterField>
          <FilterField label="Due date">
            <DateRange
              from={dueDateFrom}
              to={dueDateTo}
              onFromChange={(v) => { setDueDateFrom(v); setPage(1) }}
              onToChange={(v) => { setDueDateTo(v); setPage(1) }}
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 180 }}>Invoice Code</th>
              <th style={{ ...thStyle, width: 160 }}>Billed Branch</th>
              <th style={{ ...thStyle, width: 120 }}>Date</th>
              <th style={{ ...thStyle, width: 150 }}>Due Date</th>
              <th style={{ ...thStyle, width: 140 }}>Total</th>
              <th style={{ ...thStyle, width: 150 }}>Payment</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
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
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load invoices.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
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
                const due = getInvoiceDueInfo(item)
                const paymentMeta = PAYMENT_STATUS_META[paymentStatusOf(item)] ?? PAYMENT_STATUS_META.pending
                const total = Number(item.total_price ?? 0)
                const paid = Number(item.total_payment ?? 0)
                const paidPct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0
                // Unpaid past its due date → tinted row so it stands out.
                const rowBg = due.isOverdue ? 'var(--destructive-bg)' : 'transparent'
                return (
                  <tr
                    key={item.id}
                    style={{ transition: 'background 120ms', background: rowBg }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = due.isOverdue
                        ? 'var(--destructive-bg)'
                        : 'var(--background)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                      {(page - 1) * perPage + idx + 1}
                    </td>
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
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.date ? formatDate(item.date) : '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: due.isOverdue ? 600 : 400,
                            color: due.isOverdue ? 'var(--destructive)' : 'var(--foreground-muted)',
                          }}
                        >
                          {item.due_date ? formatDate(item.due_date) : '—'}
                        </span>
                        {due.isOverdue && (
                          <span
                            style={{
                              alignSelf: 'flex-start',
                              padding: '1px 8px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'var(--destructive)',
                              color: 'white',
                            }}
                          >
                            Overdue {due.daysOverdue} day{due.daysOverdue === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {getCanReadPrice()
                          ? `Rp ${Number(item.total_price ?? 0).toLocaleString('id-ID')}`
                          : '***'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
                        <span
                          style={{
                            alignSelf: 'flex-start',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: paymentMeta.bg,
                            color: paymentMeta.color,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: paymentMeta.color }} />
                          {paymentMeta.label}
                        </span>
                        {getCanReadPrice() && (
                          <>
                            <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{ width: `${paidPct}%`, height: '100%', background: paymentMeta.color, borderRadius: 99 }} />
                            </div>
                            {paymentStatusOf(item) === 'partial' && (
                              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                                Rp {paid.toLocaleString('id-ID')} paid
                              </span>
                            )}
                          </>
                        )}
                      </div>
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
