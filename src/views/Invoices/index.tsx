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

  const [createOpen, setCreateOpen] = useState(false)
  const [receiptSearch, setReceiptSearch] = useState('')
  const [debouncedReceiptSearch, setDebouncedReceiptSearch] = useState('')
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<number[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null)
  const [invoiceDate, setInvoiceDate] = useState(todayInputDate())
  const [invoiceDescription, setInvoiceDescription] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedReceiptSearch(receiptSearch), 400)
    return () => clearTimeout(t)
  }, [receiptSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', page, debouncedSearch],
    enabled: canRead,
    queryFn: () => {
      const params: any = { page, per_page: 15, sort: '-created_at', include: 'billed_branch,delivery' }
      if (debouncedSearch && debouncedSearch.trim()) params['filter[search]'] = debouncedSearch.trim()
      return invoicesService.list(params).then((r) => r.data)
    },
  })

  const items: Invoice[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Receipts eligible to be invoiced: only fetch while the modal is open
  const { data: receiptsData, isLoading: receiptsLoading } = useQuery({
    queryKey: ['invoiceable-receipts', debouncedReceiptSearch],
    enabled: createOpen,
    queryFn: () => {
      const params: any = {
        per_page: 50,
        sort: '-created_at',
        include: 'delivery,target_branch,receipt_details',
        'filter[invoiceable]': true,
      }
      if (debouncedReceiptSearch && debouncedReceiptSearch.trim()) {
        params['filter[search]'] = debouncedReceiptSearch.trim()
      }
      return receiptsService.list(params).then((r) => r.data)
    },
  })
  const allReceipts: any[] = (receiptsData as any)?.data ?? []

  const groupedReceipts = React.useMemo(() => {
    const groups: Record<number, any[]> = {}
    allReceipts.forEach((r) => {
      const bid = r.target_branch_id
      if (!groups[bid]) groups[bid] = []
      groups[bid].push(r)
    })
    return groups
  }, [allReceipts])

  // Preview: aggregate receipt_details from selected receipts
  const previewLoading = false
  const previewLines = React.useMemo(() => {
    if (selectedReceiptIds.length === 0) return []
    const selected = allReceipts.filter((r) => selectedReceiptIds.includes(r.id))
    const aggregated: Record<number, any> = {}

    selected.forEach((receipt) => {
      receipt.receipt_details?.forEach((rd: any) => {
        const uomId = rd.product_uom_id
        if (!uomId) return
        if (!aggregated[uomId]) {
          aggregated[uomId] = {
            id: rd.id,
            productLabel: rd.product_uom?.product?.name ?? rd.product_uom?.code ?? `Item #${uomId}`,
            uom: rd.product_uom?.uom?.name ?? rd.product_uom?.uom?.code ?? '—',
            received: 0,
          }
        }
        aggregated[uomId].received += Number(rd.qty ?? 0)
      })
    })

    return Object.values(aggregated)
  }, [selectedReceiptIds, allReceipts])

  const resetCreateForm = () => {
    setSelectedReceiptIds([])
    setSelectedBranchId(null)
    setInvoiceDate(todayInputDate())
    setInvoiceDescription('')
    setReceiptSearch('')
  }

  const createMutation = useMutation({
    mutationFn: () =>
      invoicesService.createFromReceipts({
        receipt_ids: selectedReceiptIds,
        date: invoiceDate || undefined,
        description: invoiceDescription.trim() || undefined,
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created')
      setCreateOpen(false)
      resetCreateForm()
      // The create endpoint only returns a message wrapper today, but navigate
      // straight to the new invoice if a future backend response ever includes the id.
      const newId = res?.data?.data?.id ?? res?.data?.id
      if (newId) router.push(`/transfer/invoices/${newId}`)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create invoice'),
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
    background: 'var(--surface)',
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
            onClick={() => setCreateOpen(true)}
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
                  {Array.from({ length: 7 }).map((__, j) => (
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
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load invoices.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
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
                    <FileText size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No invoices found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
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
      {meta && (meta.last_page ?? meta.total_pages ?? 1) > 1 && (
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
            Page {page} of {meta.last_page ?? meta.total_pages ?? 1}
          </span>
          <button
            onClick={() =>
              setPage((p) => Math.min(meta.last_page ?? meta.total_pages ?? 1, p + 1))
            }
            disabled={page === (meta.last_page ?? meta.total_pages ?? 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color:
                page === (meta.last_page ?? meta.total_pages ?? 1)
                  ? 'var(--foreground-subtle)'
                  : 'var(--foreground)',
              cursor:
                page === (meta.last_page ?? meta.total_pages ?? 1) ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Create Invoice modal */}
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            onClick={() => {
              setCreateOpen(false)
              resetCreateForm()
            }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 24px 20px',
              width: 520,
              maxWidth: '92vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                Create Invoice
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                  resetCreateForm()
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--foreground-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '0 0 16px' }}>
              Select receipts to invoice.
            </p>

            {/* Receipt picker */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                Receipts
              </label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }}
                />
                <input
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="Search receipts or deliveries..."
                  style={{
                    ...inputBase,
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: 260,
                  overflowY: 'auto',
                }}
              >
                {receiptsLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    Loading receipts...
                  </div>
                ) : allReceipts.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    No invoiceable receipts found
                  </div>
                ) : (
                  Object.entries(groupedReceipts).map(([branchIdStr, receipts]) => {
                    const branchId = Number(branchIdStr)
                    const branchName = receipts[0]?.target_branch?.name ?? 'Unknown Branch'
                    const disabledGroup = selectedBranchId !== null && selectedBranchId !== branchId

                    return (
                      <div key={branchId} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--background)', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>
                          <span>{branchName} ({receipts.length} receipts)</span>
                          <button
                            type="button"
                            disabled={disabledGroup}
                            onClick={() => {
                              if (disabledGroup) return
                              const allIds = receipts.map((r: any) => r.id)
                              const allSelected = allIds.every((id: number) => selectedReceiptIds.includes(id))
                              if (allSelected) {
                                // deselect all in this group
                                const next = selectedReceiptIds.filter((id) => !allIds.includes(id))
                                setSelectedReceiptIds(next)
                                if (next.length === 0) setSelectedBranchId(null)
                              } else {
                                // select all in this group
                                const next = Array.from(new Set([...selectedReceiptIds, ...allIds]))
                                setSelectedReceiptIds(next)
                                setSelectedBranchId(branchId)
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: disabledGroup ? 'var(--foreground-subtle)' : 'var(--accent)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: disabledGroup ? 'not-allowed' : 'pointer',
                              padding: 0
                            }}
                          >
                            {receipts.every((r: any) => selectedReceiptIds.includes(r.id)) ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        {receipts.map((d: any) => {
                          const isSelected = selectedReceiptIds.includes(d.id)
                          return (
                            <div
                              key={d.id}
                              onClick={() => {
                                if (disabledGroup && !isSelected) return
                                setSelectedReceiptIds((prev) => {
                                  if (prev.includes(d.id)) {
                                    const next = prev.filter((id) => id !== d.id)
                                    if (next.length === 0) setSelectedBranchId(null)
                                    return next
                                  } else {
                                    if (prev.length === 0) setSelectedBranchId(d.target_branch_id)
                                    return [...prev, d.id]
                                  }
                                })
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                cursor: disabledGroup && !isSelected ? 'not-allowed' : 'pointer',
                                borderBottom: '1px solid var(--border)',
                                background: isSelected ? 'var(--accent-light-bg)' : 'transparent',
                                opacity: disabledGroup && !isSelected ? 0.5 : 1,
                              }}
                            >
                              <Truck size={14} color={isSelected ? 'var(--accent)' : 'var(--foreground-subtle)'} style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--foreground)' }}>
                                    {d.delivery?.code ?? d.code}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 2 }}>
                                  {d.date ? formatDate(d.date) : '—'}
                                  {' · '}
                                  {getCanReadPrice() ? `Rp ${Number(d.total_price ?? 0).toLocaleString('id-ID')}` : '***'}
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                readOnly
                                checked={isSelected}
                                disabled={disabledGroup && !isSelected}
                                style={{ cursor: disabledGroup && !isSelected ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Preview hidden as requested */}

            {/* Optional date + description */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                  Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  style={{ ...inputBase, width: '100%', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
                  Description
                </label>
                <input
                  type="text"
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  placeholder="Optional"
                  style={{ ...inputBase, width: '100%', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                Total: {getCanReadPrice() ? `Rp ${allReceipts.filter((r) => selectedReceiptIds.includes(r.id)).reduce((sum, r) => sum + Number(r.total_price || 0), 0).toLocaleString('id-ID')}` : '***'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false)
                    resetCreateForm()
                  }}
                  style={{
                    padding: '8px 16px',
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
                  onClick={() => createMutation.mutate()}
                  disabled={selectedReceiptIds.length === 0 || createMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'white',
                    cursor: selectedReceiptIds.length === 0 || createMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: selectedReceiptIds.length === 0 || createMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
