'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { reportsService } from '@/services/reports.service'
import { suppliersService } from '@/services/suppliers.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import { useDebounce } from '@/hooks/useDebounce'
import {
  FileSpreadsheet,
  Download,
  Loader2,
  PackageCheck,
  Truck,
  Receipt,
  Filter,
} from 'lucide-react'

export default function PurchasingReportsView() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  // Query suppliers — searched on the server (filter[search]). The three
  // supplier pickers share one term; only one dropdown is open at a time and
  // SearchableSelect keeps each picked label cached.
  const [supplierSearch, setSupplierSearch] = useState('')
  const supplierSearchDebounced = useDebounce(supplierSearch, 400)
  const { data: suppliersData, isFetching: suppliersLoading } = useQuery({
    queryKey: ['suppliers-select-purchasing', supplierSearchDebounced],
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      suppliersService
        .list({ per_page: 50, 'filter[search]': supplierSearchDebounced || undefined } as any)
        .then((r) => r.data),
  })
  const suppliers: any[] = (suppliersData as any)?.data ?? []
  const supplierOptions = suppliers.map((s) => ({
    value: s.name ?? String(s.id),
    label: s.name,
  }))

  // Query categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-select-purchasing'],
    queryFn: () => productCategoriesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const categories: any[] = (categoriesData as any)?.data ?? []
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  // Card 1: Purchase Products state
  const [prodStartDate, setProdStartDate] = useState(firstDay)
  const [prodEndDate, setProdEndDate] = useState(todayStr)
  const [prodSupplier, setProdSupplier] = useState<string>('')
  const [prodCategory, setProdCategory] = useState<number | undefined>(undefined)
  const [prodStatus, setProdStatus] = useState<string>('')

  // Card 2: Supplier Purchases state
  const [suppStartDate, setSuppStartDate] = useState(firstDay)
  const [suppEndDate, setSuppEndDate] = useState(todayStr)
  const [suppSupplier, setSuppSupplier] = useState<string>('')

  // Card 3: Purchase Invoices state
  const [invStartDate, setInvStartDate] = useState(firstDay)
  const [invEndDate, setInvEndDate] = useState(todayStr)
  const [invSupplier, setInvSupplier] = useState<string>('')
  const [invStatus, setInvStatus] = useState<string>('')

  // Export Mutations
  const exportProductsMutation = useMutation({
    mutationFn: () =>
      reportsService.exportPurchaseProducts({
        start_date: prodStartDate || undefined,
        end_date: prodEndDate || undefined,
        'filter[supplier]': prodSupplier || undefined,
        'filter[category_id]': prodCategory || undefined,
        'filter[status]': prodStatus || undefined,
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `purchase-products-${prodStartDate}_${prodEndDate}.xlsx`)
      toast.success('Purchase products report downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export purchase products'),
  })

  const exportSuppliersMutation = useMutation({
    mutationFn: () =>
      reportsService.exportSupplierPurchases({
        start_date: suppStartDate || undefined,
        end_date: suppEndDate || undefined,
        'filter[supplier]': suppSupplier || undefined,
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `supplier-purchases-${suppStartDate}_${suppEndDate}.xlsx`)
      toast.success('Supplier purchases report downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export supplier purchases'),
  })

  const exportInvoicesMutation = useMutation({
    mutationFn: () =>
      reportsService.exportPurchaseInvoices({
        start_date: invStartDate || undefined,
        end_date: invEndDate || undefined,
        'filter[supplier]': invSupplier || undefined,
        'filter[status]': invStatus || undefined,
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `purchase-invoices-${invStartDate}_${invEndDate}.xlsx`)
      toast.success('Purchase invoices report downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export purchase invoices'),
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised, #ffffff)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    marginBottom: 4,
    display: 'block',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Purchasing Reports
        </h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Generate and download spreadsheet analyses for procurement, vendor performance, and purchase invoices
        </p>
      </div>

      {/* Grid of Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Card 1: Purchase Products */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-light-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <PackageCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Purchase Products
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Itemized product purchase breakdown
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export line-item quantities, prices, taxes, and vendor details across purchase orders.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={prodStartDate}
                    onChange={(e) => setProdStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="date"
                    value={prodEndDate}
                    onChange={(e) => setProdEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Supplier (Optional)</label>
                <SearchableSelect
                  value={prodSupplier || ''}
                  onChange={(val) => setProdSupplier(val ? String(val) : '')}
                  options={supplierOptions}
                  loading={suppliersLoading}
                  onSearchChange={setSupplierSearch}
                  placeholder="All Suppliers"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={prodCategory ?? ''}
                    onChange={(e) => setProdCategory(e.target.value ? Number(e.target.value) : undefined)}
                    style={inputStyle}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select
                    value={prodStatus}
                    onChange={(e) => setProdStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="received">Received</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => exportProductsMutation.mutate()}
            disabled={exportProductsMutation.isPending}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportProductsMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportProductsMutation.isPending ? 0.75 : 1,
            }}
          >
            {exportProductsMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Products XLSX
          </button>
        </div>

        {/* Card 2: Supplier Purchases */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--success-bg, #f0fdf4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success, #16a34a)',
                }}
              >
                <Truck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Supplier Purchases
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Aggregated spend per supplier
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export procurement volume, order counts, and total monetary commitments per vendor.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={suppStartDate}
                    onChange={(e) => setSuppStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="date"
                    value={suppEndDate}
                    onChange={(e) => setSuppEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Supplier (Optional)</label>
                <SearchableSelect
                  value={suppSupplier || ''}
                  onChange={(val) => setSuppSupplier(val ? String(val) : '')}
                  options={supplierOptions}
                  loading={suppliersLoading}
                  onSearchChange={setSupplierSearch}
                  placeholder="All Suppliers"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => exportSuppliersMutation.mutate()}
            disabled={exportSuppliersMutation.isPending}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportSuppliersMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportSuppliersMutation.isPending ? 0.75 : 1,
            }}
          >
            {exportSuppliersMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Supplier Purchases XLSX
          </button>
        </div>

        {/* Card 3: Purchase Invoices */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--info-bg, #eff6ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--info, #2563eb)',
                }}
              >
                <Receipt size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Purchase Invoices
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Vendor invoices and payables
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export vendor bill amounts, payment statuses, due dates, and outstanding payables.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={invStartDate}
                    onChange={(e) => setInvStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="date"
                    value={invEndDate}
                    onChange={(e) => setInvEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Supplier (Optional)</label>
                <SearchableSelect
                  value={invSupplier || ''}
                  onChange={(val) => setInvSupplier(val ? String(val) : '')}
                  options={supplierOptions}
                  loading={suppliersLoading}
                  onSearchChange={setSupplierSearch}
                  placeholder="All Suppliers"
                />
              </div>

              <div>
                <label style={labelStyle}>Payment Status</label>
                <select
                  value={invStatus}
                  onChange={(e) => setInvStatus(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All Payment Statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={() => exportInvoicesMutation.mutate()}
            disabled={exportInvoicesMutation.isPending}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportInvoicesMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportInvoicesMutation.isPending ? 0.75 : 1,
            }}
          >
            {exportInvoicesMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Invoices XLSX
          </button>
        </div>
      </div>
    </div>
  )
}
