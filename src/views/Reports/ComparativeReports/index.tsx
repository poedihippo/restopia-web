'use client'

import FinanceBranchSelect, { financeBranchParam, type FinanceBranchScope } from '../FinanceBranchSelect'
import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { reportsService } from '@/services/reports.service'
import { fiscalYearsService } from '@/services/accounting.service'
import { customersService } from '@/services/customers.service'
import { suppliersService } from '@/services/suppliers.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import { useDebounce } from '@/hooks/useDebounce'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import {
  TrendingUp,
  Scale,
  CreditCard,
  Building,
  Download,
  Loader2,
  Calendar,
} from 'lucide-react'

export default function ComparativeReportsView() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), 0, 1).toLocaleDateString('en-CA')
  const todayStr = today.toLocaleDateString('en-CA')

  // Query Fiscal Years
  const { data: fiscalYearsData } = useQuery({
    queryKey: ['fiscal-years-select'],
    queryFn: () => fiscalYearsService.list({ per_page: 50, sort: '-id' } as any).then((r) => r.data),
  })
  const fiscalYears: any[] = (fiscalYearsData as any)?.data ?? []
  const fiscalYearOptions = fiscalYears.map((fy) => ({
    value: fy.id,
    label: `${fy.name} (${fy.start_date} ~ ${fy.end_date})`,
  }))

  // Customer / supplier pickers search on the server (filter[search]);
  // SearchableSelect keeps the picked label cached.
  const [customerSearch, setCustomerSearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const customerSearchDebounced = useDebounce(customerSearch, 400)
  const supplierSearchDebounced = useDebounce(supplierSearch, 400)

  // Query Customers for AR Card
  const customerOpts = useInfiniteOptions<any>({
    queryKey: ['customers-select-ar', customerSearchDebounced],
    staleTime: 60_000,
    fetchPage: (page) =>
      customersService
        .list({ page, per_page: 50, 'filter[search]': customerSearchDebounced || undefined } as any)
        .then((r) => r.data),
  })
  const customers: any[] = customerOpts.items
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`,
  }))

  // Query Suppliers for AP Card
  const supplierOpts = useInfiniteOptions<any>({
    queryKey: ['suppliers-select-ap', supplierSearchDebounced],
    staleTime: 60_000,
    fetchPage: (page) =>
      suppliersService
        .list({ page, per_page: 50, 'filter[search]': supplierSearchDebounced || undefined } as any)
        .then((r) => r.data),
  })
  const suppliers: any[] = supplierOpts.items
  // Value is the supplier id (export sends supplier_id); the name is kept as a
  // fallback for the `supplier` param when no id is known.
  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.name,
  }))

  // Card 1: Comparative Income Statement
  // The API only reads fiscal_year_id (a bare `year` is ignored), so a fiscal year is required.
  const [lrFiscalYearId, setLrFiscalYearId] = useState<number | undefined>(undefined)
  const [lrBranch, setLrBranch] = useState<FinanceBranchScope>('')

  // Card 2: Comparative Balance Sheet
  const [bsFiscalYearId, setBsFiscalYearId] = useState<number | undefined>(undefined)
  const [bsBranch, setBsBranch] = useState<FinanceBranchScope>('')

  // Card 3: AR Card
  const [arCustomerId, setArCustomerId] = useState<number | undefined>(undefined)
  const [arStartDate, setArStartDate] = useState(firstDay)
  const [arEndDate, setArEndDate] = useState(todayStr)

  // Card 4: AP Card
  const [apSupplierId, setApSupplierId] = useState<number | undefined>(undefined)
  const [apSupplierName, setApSupplierName] = useState<string>('')
  const apSupplier = apSupplierId ? String(apSupplierId) : apSupplierName
  const [apStartDate, setApStartDate] = useState(firstDay)
  const [apEndDate, setApEndDate] = useState(todayStr)

  const fySlug = (id?: number) =>
    String(fiscalYears.find((fy) => fy.id === id)?.name ?? id ?? '').replace(/\s+/g, '-').toLowerCase()

  // Both card exports return 400 without start_date and end_date.
  const dateRangeBlock = (start: string, end: string): string | null => {
    if (!start || !end) return 'Start date and end date are required'
    if (start > end) return 'Start date must be on or before end date'
    return null
  }
  const arBlock = !arCustomerId ? 'Select a customer first' : dateRangeBlock(arStartDate, arEndDate)
  const apBlock = !apSupplier ? 'Select a supplier first' : dateRangeBlock(apStartDate, apEndDate)
  const lrBlock = !lrFiscalYearId ? 'Select a fiscal year first' : null
  const bsBlock = !bsFiscalYearId ? 'Select a fiscal year first' : null

  // Export Mutations
  const exportLrMutation = useMutation({
    mutationFn: () =>
      reportsService.exportComparativeIncomeStatement({
        fiscal_year_id: lrFiscalYearId,
        ...financeBranchParam(lrBranch),
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `comparative-income-statement-${fySlug(lrFiscalYearId)}.xlsx`)
      toast.success('12-month Comparative Income Statement downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export comparative income statement'),
  })

  const exportBsMutation = useMutation({
    mutationFn: () =>
      reportsService.exportComparativeBalanceSheet({
        fiscal_year_id: bsFiscalYearId,
        ...financeBranchParam(bsBranch),
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `comparative-balance-sheet-${fySlug(bsFiscalYearId)}.xlsx`)
      toast.success('12-month Comparative Balance Sheet downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export comparative balance sheet'),
  })

  const exportArMutation = useMutation({
    mutationFn: () => {
      if (!arCustomerId) throw new Error('Please select a customer')
      return reportsService.exportArCard({
        customer_id: arCustomerId,
        start_date: arStartDate,
        end_date: arEndDate,
      })
    },
    onSuccess: (res) => {
      downloadFileFromResponse(res, `ar-card-customer-${arCustomerId}.xlsx`)
      toast.success('Customer AR Card downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export AR card'),
  })

  const exportApMutation = useMutation({
    mutationFn: () => {
      if (!apSupplier) throw new Error('Please select or enter a supplier')
      return reportsService.exportApCard({
        ...(apSupplierId ? { supplier_id: apSupplierId } : { supplier: apSupplierName }),
        start_date: apStartDate,
        end_date: apEndDate,
      })
    },
    onSuccess: (res) => {
      const slug = (apSupplierName || String(apSupplierId ?? '')).replace(/\s+/g, '-').toLowerCase()
      downloadFileFromResponse(res, `ap-card-${slug}.xlsx`)
      toast.success('Supplier AP Card downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export AP card'),
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
          Comparative Reports & Subledger Cards
        </h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Export multi-month financial comparative statements (12 Bulan) and subledger accounts (Kartu Piutang & Hutang)
        </p>
      </div>

      {/* Grid of Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Card 1: Comparative Income Statement */}
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
                <TrendingUp size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  LR 12 Bulan (Comparative Income Statement)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  12-month revenue, cost, and profit comparison
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              View monthly performance side-by-side across all 12 periods of the selected fiscal year or calendar year.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>
                  Fiscal Year
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={lrFiscalYearId || ''}
                  onChange={(val) => setLrFiscalYearId(val ? Number(val) : undefined)}
                  options={fiscalYearOptions}
                  placeholder="Select Fiscal Year..."
                />
              </div>

              <div>
                <label style={labelStyle}>Branch</label>
                <FinanceBranchSelect value={lrBranch} onChange={setLrBranch} style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>
          </div>

          <button
            onClick={() => { if (!lrBlock) exportLrMutation.mutate() }}
            disabled={exportLrMutation.isPending || !!lrBlock}
            title={lrBlock ?? undefined}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportLrMutation.isPending || lrBlock ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportLrMutation.isPending || lrBlock ? 0.6 : 1,
            }}
          >
            {exportLrMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download LR 12 Bulan XLSX
          </button>
        </div>

        {/* Card 2: Comparative Balance Sheet */}
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
                <Scale size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Neraca 12 Bulan (Comparative Balance Sheet)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  12-month asset, liability, and equity trends
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Compare cumulative balance sheets period-by-period for deep liquidity and capital tracking.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>
                  Fiscal Year
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={bsFiscalYearId || ''}
                  onChange={(val) => setBsFiscalYearId(val ? Number(val) : undefined)}
                  options={fiscalYearOptions}
                  placeholder="Select Fiscal Year..."
                />
              </div>

              <div>
                <label style={labelStyle}>Branch</label>
                <FinanceBranchSelect value={bsBranch} onChange={setBsBranch} style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>
          </div>

          <button
            onClick={() => { if (!bsBlock) exportBsMutation.mutate() }}
            disabled={exportBsMutation.isPending || !!bsBlock}
            title={bsBlock ?? undefined}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportBsMutation.isPending || bsBlock ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportBsMutation.isPending || bsBlock ? 0.6 : 1,
            }}
          >
            {exportBsMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Neraca 12 Bulan XLSX
          </button>
        </div>

        {/* Card 3: AR Card */}
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
                <CreditCard size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Kartu Piutang (AR Card per Customer)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Receivables ledger & transaction history
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export complete debtor movement: beginning balance, sales invoices, settlements, and running balance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>
                  Customer
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={arCustomerId || ''}
                  onChange={(val) => setArCustomerId(val ? Number(val) : undefined)}
                  options={customerOptions}
                  loading={customerOpts.loading}
                  {...customerOpts.selectProps}
                  onSearchChange={setCustomerSearch}
                  placeholder="Select Customer..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date<span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span></label>
                  <input
                    type="date"
                    value={arStartDate}
                    onChange={(e) => setArStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date<span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span></label>
                  <input
                    type="date"
                    value={arEndDate}
                    onChange={(e) => setArEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => { if (!arBlock) exportArMutation.mutate() }}
            disabled={exportArMutation.isPending || !!arBlock}
            title={arBlock ?? undefined}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportArMutation.isPending || arBlock ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportArMutation.isPending || arBlock ? 0.6 : 1,
            }}
          >
            {exportArMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Kartu Piutang XLSX
          </button>
        </div>

        {/* Card 4: AP Card */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--warning-bg, #fffbeb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--warning, #d97706)',
                }}
              >
                <Building size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Kartu Hutang (AP Card per Supplier)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Payables ledger & supplier reconciliation
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export complete vendor movement: beginning payables, purchase invoices, payments, and ending balances.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>
                  Supplier
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={apSupplierId || ''}
                  onChange={(val) => {
                    const id = val ? Number(val) : undefined
                    setApSupplierId(id)
                    setApSupplierName(id ? suppliers.find((x) => x.id === id)?.name ?? '' : '')
                  }}
                  options={supplierOptions}
                  loading={supplierOpts.loading}
                  {...supplierOpts.selectProps}
                  onSearchChange={setSupplierSearch}
                  placeholder="Select Supplier..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date<span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span></label>
                  <input
                    type="date"
                    value={apStartDate}
                    onChange={(e) => setApStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date<span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span></label>
                  <input
                    type="date"
                    value={apEndDate}
                    onChange={(e) => setApEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => { if (!apBlock) exportApMutation.mutate() }}
            disabled={exportApMutation.isPending || !!apBlock}
            title={apBlock ?? undefined}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportApMutation.isPending || apBlock ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportApMutation.isPending || apBlock ? 0.6 : 1,
            }}
          >
            {exportApMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Kartu Hutang XLSX
          </button>
        </div>
      </div>
    </div>
  )
}
