'use client'
import { paymentSourceLabel } from '@/utils/paymentSource';
import { formatDateTime } from '@/utils/date';
import { formatCurrency } from '@/utils/price';
import Link from 'next/link';

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentsService } from '@/services/payments.service'
import { invoicesService } from '@/services/invoices.service'
import { branchesService } from '@/services/branches.service'
import { BranchOptionGroups } from '@/lib/branchOptions'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { useAuth } from '@/hooks/useAuth'
import { paymentAllocateBlock, paymentVoidBlock, paymentDeleteBlock, blockedStyle } from '@/lib/actionGuards'
import ReferenceLink from '@/components/ReferenceLink'
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  CreditCard,
  Ban,
  SplitSquareHorizontal, ArrowUpRight,
} from 'lucide-react'
import AllocateModal from './AllocateModal'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive } from '@/components/ListFilters'
import { toastMutationApiError } from '@/utils/apiError';
import { CustomPagination } from '@/components/ui/CustomPagination'

interface Payment {
  id: number
  amount: number
  /** Marketplace fee kept on an online payout; 0 for normal payments. */
  fee_amount?: number
  description?: string
  created_at?: string
  sales_order?: { id: number; code?: string }
  payment_method?: { id: number; name: string }
  branch?: { id: number; name: string }
  created_by?: { id: number; name: string }
  allocations?: {
    sales_order_id?: number
    purchase_order_id?: number
    invoice_id?: number
    amount: number
    fee_amount?: number
    fee_chart_of_account_id?: number | null
  }[]
  is_reversed?: boolean
  /** receive | disburse | refund — a refund is money paid back for a partial return. */
  type?: string
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
  const [typeFilter, setTypeFilter] = useState('')
  const [reversedFilter, setReversedFilter] = useState<'' | 'true' | 'false'>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'with-company'],
    enabled: canRead,
    queryFn: () => branchesService.list({ per_page: 100, include: 'company' } as any).then((r) => r.data),
  })
  const branchOptions: any[] = (branchesData as any)?.data ?? []

  const { data: methodsData } = useQuery({
    queryKey: ['payment-methods-all', 'payments-filter'],
    enabled: canRead,
    queryFn: () => paymentMethodsService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
  })
  const methodOptions: any[] = (methodsData as any)?.data ?? []

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: [
      'payments', page, perPage, debouncedSearch, typeFilter, reversedFilter,
      branchFilter, methodFilter, dateFrom, dateTo,
    ],
    queryFn: () =>
      paymentsService
        .list({
          page,
          per_page: perPage,
          include: 'sales_order,payment_method,bank_account,branch,created_by',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[is_reversed]': reversedFilter || undefined,
          'filter[branch_id]': branchFilter || undefined,
          'filter[payment_method_id]': methodFilter || undefined,
          'filter[date_gte]': dateFrom || undefined,
          'filter[date_lte]': dateTo || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Payment[] = (data as any)?.data ?? []

  // Lookup invoice untuk allocation bertipe invoice — payments API hanya
  // mengirim `invoice_id`, jadi datanya diambil via GET /invoices/{id}.
  const invoiceIds = useMemo(() => {
    const ids = new Set<number>()
    items.forEach((item) =>
      (item.allocations ?? []).forEach((a) => {
        if (a.invoice_id) ids.add(a.invoice_id)
      }),
    )
    return Array.from(ids)
  }, [items])

  const { data: invoiceById } = useQuery({
    queryKey: ['payments-invoice-lookup', invoiceIds.join(',')],
    enabled: invoiceIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        invoiceIds.map(async (invId) => {
          try {
            const res = await invoicesService.get(invId)
            const body = res.data as { data?: { id: number; code?: string; status?: string } }
            return [invId, body?.data] as const
          } catch {
            // Invoice tidak ditemukan/gagal diambil → tampilkan fallback INV-{id}
            // (tanpa retry dari React Query).
            return [invId, undefined] as const
          }
        }),
      )
      return Object.fromEntries(pairs) as Record<
        number,
        { id: number; code?: string; status?: string } | undefined
      >
    },
  })
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
    onError: (err: any) => toastMutationApiError(err, 'Failed to void payment'),
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
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search payments..."
        activeCount={countActive(typeFilter, reversedFilter, branchFilter, methodFilter, dateFrom, dateTo)}
        onClear={() => {
          setTypeFilter('')
          setReversedFilter('')
          setBranchFilter('')
          setMethodFilter('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Types</option>
              <option value="receive">Receive</option>
              <option value="disburse">Disburse</option>
              <option value="refund">Refund</option>
            </FilterSelect>
            <FilterSelect
              value={reversedFilter}
              onChange={(e) => {
                setReversedFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All (Reversed)</option>
              <option value="true">Reversed: Yes</option>
              <option value="false">Reversed: No</option>
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Related">
          <FilterField label="Branch">
            <FilterSelect
              block
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Branches</option>
              <BranchOptionGroups branches={branchOptions} label={(o: any) => o.name} getValue={(o) => o.id} />
            </FilterSelect>
          </FilterField>
          <FilterField label="Payment method">
            <FilterSelect
              block
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Methods</option>
              {methodOptions.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Dates">
          <FilterField label="Payment date">
            <DateRange
              from={dateFrom}
              to={dateTo}
              onFromChange={(v) => { setDateFrom(v); setPage(1) }}
              onToChange={(v) => { setDateTo(v); setPage(1) }}
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
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
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
                          width: j === 7 ? 40 : '75%',
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
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={tdStyle}>
                    {canRead ? item.allocations && item.allocations.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {item.allocations.map((alloc, idx) => {
                          // Allocations carry only ids: use a real code when the row
                          // already has it, otherwise name the document type.
                          const amount = <span style={{ color: 'var(--foreground-muted)', fontWeight: 400 }}> · {formatCurrency(alloc.amount || 0)}</span>
                          return (
                            <div key={idx} style={{ fontSize: 13 }}>
                              {alloc.sales_order_id && (
                                <ReferenceLink type="sales_orders" id={alloc.sales_order_id}>
                                  {item.sales_order?.id === alloc.sales_order_id && item.sales_order?.code ? item.sales_order.code : 'Sales order'}
                                  {amount}
                                </ReferenceLink>
                              )}
                              {alloc.purchase_order_id && (
                                <ReferenceLink type="purchase_orders" id={alloc.purchase_order_id}>
                                  Purchase order{amount}
                                </ReferenceLink>
                              )}
                              {alloc.invoice_id && (
                                <ReferenceLink type="invoices" id={alloc.invoice_id}>
                                  {invoiceById?.[alloc.invoice_id]?.code || 'Invoice'}
                                  {amount}
                                </ReferenceLink>
                              )}
                            </div>
                          )
                        })}
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
                        {paymentSourceLabel(item)}
                      </span>
                      {item.type === 'refund' && (
                        <span
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--destructive-bg)', color: 'var(--destructive)',
                          }}
                        >
                          Refund
                        </span>
                      )}
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
                        color: item.type === 'refund' ? 'var(--destructive)' : 'var(--foreground)',
                        textDecoration: item.is_reversed ? 'line-through' : 'none'
                      }}
                    >
                      {item.type === 'refund' ? '− ' : ''}Rp {(item.amount ?? 0).toLocaleString('id-ID')}
                    </span>
                    {Number(item.fee_amount ?? 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, fontSize: 12 }}>
                        <span style={{ color: 'var(--foreground-muted)' }}>
                          Gross {formatCurrency(item.amount ?? 0)}
                        </span>
                        <span style={{ color: 'var(--warning)' }}>
                          Fee −{formatCurrency(item.fee_amount ?? 0)}
                        </span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          Received in bank {formatCurrency(Number(item.amount ?? 0) - Number(item.fee_amount ?? 0))}
                        </span>
                      </div>
                    )}
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
                      {/* A refund is created by a sales order return and can't be reallocated, voided or deleted. */}
                      {item.type !== 'refund' && (() => {
                        const allocateBlock = paymentAllocateBlock(item)
                        const voidBlock = paymentVoidBlock(item)
                        const deleteBlock = paymentDeleteBlock(item)
                        return (
                          <>
                            {canEdit && (
                              <button
                                onClick={() => { if (!allocateBlock) setAllocatePayment(item) }}
                                disabled={!!allocateBlock}
                                style={{ ...actionBtnStyle, ...(allocateBlock ? blockedStyle : {}) }}
                                title={allocateBlock ?? 'Allocate'}>
                                <SplitSquareHorizontal size={14} />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => { if (!voidBlock) setVoidConfirmId(item.id) }}
                                disabled={!!voidBlock}
                                style={{ ...actionBtnStyle, color: 'var(--foreground-muted)', ...(voidBlock ? blockedStyle : {}) }}
                                title={voidBlock ?? 'Void'}>
                                <Ban size={14} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => { if (!deleteBlock) setDeleteConfirmId(item.id) }}
                                disabled={!!deleteBlock}
                                style={{ ...actionBtnStyle, color: 'var(--destructive)', ...(deleteBlock ? blockedStyle : {}) }}
                                title={deleteBlock ?? 'Delete'}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )
                      })()}
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
